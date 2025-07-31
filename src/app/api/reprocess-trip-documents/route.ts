import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ParsedEDASData, ParsedLoadingNoteData, ValidationResult } from '@/lib/types';
import { parseLoadingNote, parseEdas } from '@/lib/documentParsers';

export async function POST(request: NextRequest) {
  try {
    const { tripId } = await request.json();

    if (!tripId) {
      return NextResponse.json(
        { error: 'Trip ID è richiesto' },
        { status: 400 }
      );
    }

    console.log(`Inizio ri-processamento documenti per trip ${tripId}`);

    // Ottieni il trip esistente
    const tripRef = doc(db, 'trips', tripId);
    const tripDoc = await getDoc(tripRef);
    
    if (!tripDoc.exists()) {
      return NextResponse.json(
        { error: 'Viaggio non trovato' },
        { status: 404 }
      );
    }

    const tripData = tripDoc.data();
    const edasImageUrl = tripData.edasImageUrl;
    const loadingNoteImageUrl = tripData.loadingNoteImageUrl;

    if (!edasImageUrl && !loadingNoteImageUrl) {
      return NextResponse.json(
        { error: 'Nessuna immagine trovata per questo viaggio' },
        { status: 400 }
      );
    }

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
        
        // Approccio alternativo: estrai il path dall'URL e usa Firebase Storage
        try {
          const { imageStorage } = await import('@/lib/firebase');
          const { ref, getDownloadURL, getBytes } = await import('firebase/storage');
          
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

    let newEdasData: ParsedEDASData | undefined;
    let newLoadingNoteData: ParsedLoadingNoteData | undefined;

    // Riprocessa e-DAS se esiste
    if (edasImageUrl) {
      try {
        console.log('🔄 Ri-processamento e-DAS...');
        const { base64, mimeType } = await downloadImageAsBase64(edasImageUrl);
        newEdasData = await parseEdas(base64, mimeType);
        console.log('✅ e-DAS ri-processato con successo');
      } catch (error) {
        console.error('❌ Errore nel ri-processamento e-DAS:', error);
        // Continua anche se l'e-DAS fallisce
      }
    }

    // Riprocessa loading note se esiste
    if (loadingNoteImageUrl) {
      try {
        console.log('🔄 Ri-processamento Loading Note...');
        const { base64, mimeType } = await downloadImageAsBase64(loadingNoteImageUrl);
        newLoadingNoteData = await parseLoadingNote(base64, mimeType);
        console.log('✅ Loading Note ri-processata con successo');
      } catch (error) {
        console.error('❌ Errore nel ri-processamento Loading Note:', error);
        // Continua anche se la loading note fallisce
      }
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
      
      // Validazione quantità
      if (newEdasData.productInfo?.volumeAt15CL && newLoadingNoteData.volumeLiters) {
        const edasVolume = newEdasData.productInfo.volumeAt15CL;
        const loadingNoteVolume = newLoadingNoteData.volumeLiters;
        const volumeDifference = Math.abs(edasVolume - loadingNoteVolume);
        const volumePercentDiff = (volumeDifference / edasVolume) * 100;
        
        validationResults.push({
          field: 'volume',
          edasValue: edasVolume,
          loadingNoteValue: loadingNoteVolume,
          isMatch: volumePercentDiff <= 5, // 5% tolerance
          severity: volumePercentDiff <= 5 ? 'info' : volumePercentDiff <= 10 ? 'warning' : 'error'
        });
      }

      updates.validationResults = validationResults;
    }

    // Aggiorna il documento nel database
    await updateDoc(tripRef, updates);

    console.log(`✅ Ri-processamento completato per trip ${tripId}`);

    return NextResponse.json({
      success: true,
      message: 'Documenti ri-processati con successo',
      data: {
        edasData: newEdasData,
        loadingNoteData: newLoadingNoteData,
        validationResults: updates.validationResults || []
      }
    });

  } catch (error) {
    console.error('Errore nel ri-processamento:', error);
    return NextResponse.json(
      { error: 'Errore interno del server', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}