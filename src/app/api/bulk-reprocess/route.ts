import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ParsedEDASData, ParsedLoadingNoteData, ValidationResult } from '@/lib/types';
import { parseLoadingNote, parseEdas } from '@/lib/documentParsers';

const downloadImageAsBase64 = async (imageUrl: string): Promise<{ base64: string; mimeType: string }> => {
  try {
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Petrolis/1.0)',
      },
    });
    
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = response.headers.get('content-type') || 'image/jpeg';
      return { base64, mimeType };
    }
    
    throw new Error(`Fetch failed: ${response.statusText}`);
  } catch (fetchError) {
    console.warn('Direct fetch failed, trying alternative approach:', fetchError);
    
    try {
      const { imageStorage } = await import('@/lib/firebase');
      const { ref, getBytes } = await import('firebase/storage');
      
      const url = new URL(imageUrl);
      const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);
      
      if (!pathMatch) {
        throw new Error('Cannot extract file path from Firebase URL');
      }
      
      const filePath = decodeURIComponent(pathMatch[1]);
      const fileRef = ref(imageStorage, filePath);
      
      const bytes = await getBytes(fileRef);
      const base64 = Buffer.from(bytes).toString('base64');
      
      return { base64, mimeType: 'image/jpeg' };
    } catch (firebaseError) {
      console.error('Firebase download also failed:', firebaseError);
      throw new Error(`Failed to download image: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
    }
  }
};

async function reprocessSingleTrip(tripId: string, tripData: any): Promise<{ success: boolean; error?: string }> {
  const edasImageUrl = tripData.edasImageUrl;
  const loadingNoteImageUrl = tripData.loadingNoteImageUrl;

  if (!edasImageUrl && !loadingNoteImageUrl) {
    return { success: false, error: 'Nessuna immagine trovata' };
  }

  let newEdasData: ParsedEDASData | undefined;
  let newLoadingNoteData: ParsedLoadingNoteData | undefined;

  // Riprocessa e-DAS se esiste
  if (edasImageUrl) {
    try {
      console.log(`🔄 [${tripId}] Ri-processamento e-DAS...`);
      const { base64, mimeType } = await downloadImageAsBase64(edasImageUrl);
      newEdasData = await parseEdas(base64, mimeType);
      console.log(`✅ [${tripId}] e-DAS ri-processato con successo`);
    } catch (error) {
      console.error(`❌ [${tripId}] Errore nel ri-processamento e-DAS:`, error);
    }
  }

  // Riprocessa loading note se esiste
  if (loadingNoteImageUrl) {
    try {
      console.log(`🔄 [${tripId}] Ri-processamento Loading Note...`);
      const { base64, mimeType } = await downloadImageAsBase64(loadingNoteImageUrl);
      newLoadingNoteData = await parseLoadingNote(base64, mimeType);
      console.log(`✅ [${tripId}] Loading Note ri-processata con successo`);
    } catch (error) {
      console.error(`❌ [${tripId}] Errore nel ri-processamento Loading Note:`, error);
    }
  }

  if (!newEdasData && !newLoadingNoteData) {
    return { success: false, error: 'Nessun documento riprocessato con successo' };
  }

  // Prepara gli aggiornamenti
  const updates: any = {
    updatedAt: Timestamp.now(),
    lastReprocessedAt: Timestamp.now()
  };

  if (newEdasData) {
    updates.edasData = newEdasData;
  }

  if (newLoadingNoteData) {
    updates.loadingNoteData = newLoadingNoteData;
  }

  // Esegui validazioni se entrambi i documenti sono stati processati
  if (newEdasData && newLoadingNoteData) {
    const validationResults: ValidationResult[] = [];
    
    if (newEdasData.productInfo?.volumeAt15CL && newLoadingNoteData.volumeLiters) {
      const edasVolume = newEdasData.productInfo.volumeAt15CL;
      const loadingNoteVolume = newLoadingNoteData.volumeLiters;
      const volumeDifference = Math.abs(edasVolume - loadingNoteVolume);
      const volumePercentDiff = (volumeDifference / edasVolume) * 100;
      
      validationResults.push({
        field: 'volume',
        edasValue: edasVolume,
        loadingNoteValue: loadingNoteVolume,
        isMatch: volumePercentDiff <= 5,
        severity: volumePercentDiff <= 5 ? 'info' : volumePercentDiff <= 10 ? 'warning' : 'error'
      });
    }

    if (validationResults.length > 0) {
      updates.validationResults = validationResults;
    }
  }

  // Aggiorna il documento nel database
  const tripRef = doc(db, 'trips', tripId);
  await updateDoc(tripRef, updates);

  return { success: true };
}

export async function POST(request: NextRequest) {
  try {
    const { startDate, endDate } = await request.json();

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate e endDate sono richiesti (formato: YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    console.log(`\n🚀 ====== INIZIO BULK REPROCESS ======`);
    console.log(`📅 Periodo: ${startDate} - ${endDate}`);

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);

    // Query trips in date range
    const tripsRef = collection(db, 'trips');
    const q = query(
      tripsRef,
      where('createdAt', '>=', Timestamp.fromDate(start)),
      where('createdAt', '<=', Timestamp.fromDate(end))
    );

    const querySnapshot = await getDocs(q);
    const totalTrips = querySnapshot.size;

    console.log(`📊 Trovati ${totalTrips} viaggi nel periodo`);

    if (totalTrips === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nessun viaggio trovato nel periodo specificato',
        total: 0,
        processed: 0,
        failed: 0,
        results: []
      });
    }

    const results: Array<{
      tripId: string;
      driverName: string;
      dasNumber: string;
      success: boolean;
      error?: string;
    }> = [];

    let processed = 0;
    let failed = 0;

    // Process trips sequentially to avoid overloading Google Document AI
    for (const tripDoc of querySnapshot.docs) {
      const tripId = tripDoc.id;
      const tripData = tripDoc.data();
      const driverName = tripData.driverName || 'N/A';
      const dasNumber = tripData.edasData?.documentInfo?.dasNumber || tripData.loadingNoteData?.documentNumber || 'N/A';

      console.log(`\n--- [${processed + 1}/${totalTrips}] Trip ${tripId.substring(0, 8)}... (Autista: ${driverName}, DAS: ${dasNumber}) ---`);

      try {
        const result = await reprocessSingleTrip(tripId, tripData);
        
        if (result.success) {
          processed++;
          console.log(`✅ [${processed}/${totalTrips}] Trip ${tripId.substring(0, 8)}... completato`);
        } else {
          failed++;
          console.log(`⚠️ [${processed + failed}/${totalTrips}] Trip ${tripId.substring(0, 8)}... fallito: ${result.error}`);
        }

        results.push({
          tripId,
          driverName,
          dasNumber,
          success: result.success,
          error: result.error
        });
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ [${processed + failed}/${totalTrips}] Trip ${tripId.substring(0, 8)}... errore:`, errorMsg);
        
        results.push({
          tripId,
          driverName,
          dasNumber,
          success: false,
          error: errorMsg
        });
      }

      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n🏁 ====== BULK REPROCESS COMPLETATO ======`);
    console.log(`📊 Totale: ${totalTrips} | ✅ Successo: ${processed} | ❌ Errori: ${failed}`);

    return NextResponse.json({
      success: true,
      message: `Riprocessamento completato: ${processed} successi, ${failed} errori su ${totalTrips} totali`,
      total: totalTrips,
      processed,
      failed,
      results
    });

  } catch (error) {
    console.error('Errore nel bulk reprocess:', error);
    return NextResponse.json(
      { error: 'Errore interno del server', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

