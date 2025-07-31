import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ParsedEDASData, ParsedLoadingNoteData, ValidationResult } from '@/lib/types';
import { parseLoadingNote } from '@/lib/documentParsers';

export async function POST(request: NextRequest) {
  try {
    const { tripId, edasImageUrl, loadingNoteImageUrl } = await request.json();

    if (!tripId || !edasImageUrl || !loadingNoteImageUrl) {
      return NextResponse.json(
        { error: 'Trip ID e URLs delle immagini sono richiesti' },
        { status: 400 }
      );
    }

    const tripRef = doc(db, 'trips', tripId);
    const tripDoc = await getDoc(tripRef);
    
    if (!tripDoc.exists() || tripDoc.data().status !== 'elaborazione') {
      return NextResponse.json(
        { error: 'Viaggio non trovato o non in stato di elaborazione' },
        { status: 400 }
      );
    }

    console.log(`Inizio processamento documenti per trip ${tripId}`);

    const downloadImageAsBase64 = async (imageUrl: string): Promise<{ base64: string; mimeType: string }> => {
      try {
        // Prova prima con fetch diretto (funziona localmente)
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
          
          // Estrai il path del file dall'URL Firebase
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

    // e-DAS: Salva solo come immagine (nessun processamento OCR)
    console.log('e-DAS salvato come immagine (nessun processamento OCR)');
    let edasData: ParsedEDASData | null = null;

    // Processa solo la Nota di Carico con OCR
    let loadingNoteData: ParsedLoadingNoteData | null = null;
    try {
      console.log('Processamento Nota di Carico con OCR...');
      const { base64, mimeType } = await downloadImageAsBase64(loadingNoteImageUrl);
      loadingNoteData = await parseLoadingNote(base64, mimeType);
      console.log('Nota di Carico processata con successo');
    } catch (error) {
      console.error('Errore nel processamento Nota di Carico:', error);
    }

    // Aggiorna l'ordine con i dati della Nota di Carico se disponibili
    if (loadingNoteData) {
      try {
        console.log('Aggiornamento ordine con dati Nota di Carico...');
        const orderRef = doc(db, 'orders', tripDoc.data().orderId);
        const orderUpdateData = {
          // Mantieni l'orderNumber temporaneo o usa quello della nota di carico se disponibile
          orderNumber: loadingNoteData.documentNumber || `TEMP_${Date.now()}`,
          product: loadingNoteData.productDescription || 'DA ESTRARRE',
          customerName: 'DA ESTRARRE', // Nota di carico potrebbe non avere questi dati
          customerCode: 'TEMP',
          deliveryAddress: 'DA ESTRARRE',
          quantity: loadingNoteData.volumeLiters || 0,
          notes: `Ordine aggiornato da Nota di Carico ${loadingNoteData.documentNumber || 'N/A'}.`,
          updatedAt: Timestamp.now()
        };
        await updateDoc(orderRef, orderUpdateData);
        console.log('Ordine aggiornato con successo');
      } catch (error) {
        console.error('Errore nell\'aggiornamento ordine:', error);
      }
    }

    // Nessuna validazione incrociata dato che l'e-DAS non viene più processato
    let validationResults: ValidationResult[] = [];

    // Aggiorna il trip con i dati processati
    const updateData: any = {
      updatedAt: Timestamp.now(),
      status: 'completato',
      completedAt: Timestamp.now()
    };

    if (edasData) {
      updateData.edasData = edasData;
    }
    if (loadingNoteData) {
      updateData.loadingNoteData = loadingNoteData;
    }
    if (validationResults.length > 0) {
      updateData.validationResults = validationResults;
    }

    await updateDoc(tripRef, updateData);

    console.log(`Processamento completato per trip ${tripId}`);

    return NextResponse.json({
      success: true,
      tripId,
      edasProcessed: false, // e-DAS salvato solo come immagine
      loadingNoteProcessed: !!loadingNoteData,
      validationResults
    });

  } catch (error) {
    console.error('Errore nel processamento documenti:', error);
    return NextResponse.json(
      { error: 'Errore interno del server durante il processamento' },
      { status: 500 }
    );
  }
}

// Funzione di validazione incrociata tra e-DAS e Nota di Carico
function validateDocuments(edasData: ParsedEDASData, loadingNoteData: ParsedLoadingNoteData): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Validazione del peso netto
  if (edasData.productInfo.netWeightKg && loadingNoteData.netWeightKg) {
    const weightDifference = Math.abs(edasData.productInfo.netWeightKg - loadingNoteData.netWeightKg);
    const weightToleranceKg = 50; // Tolleranza di 50kg
    
    results.push({
      field: 'Peso Netto (kg)',
      edasValue: edasData.productInfo.netWeightKg,
      loadingNoteValue: loadingNoteData.netWeightKg,
      isMatch: weightDifference <= weightToleranceKg,
      severity: weightDifference <= weightToleranceKg ? 'info' : 'warning'
    });
  }

  // Validazione del volume
  if (edasData.productInfo.volumeAt15CL && loadingNoteData.volumeLiters) {
    const volumeDifference = Math.abs(edasData.productInfo.volumeAt15CL - loadingNoteData.volumeLiters);
    const volumeToleranceL = 100; // Tolleranza di 100L
    
    results.push({
      field: 'Volume (L)',
      edasValue: edasData.productInfo.volumeAt15CL,
      loadingNoteValue: loadingNoteData.volumeLiters,
      isMatch: volumeDifference <= volumeToleranceL,
      severity: volumeDifference <= volumeToleranceL ? 'info' : 'warning'
    });
  }

  // Validazione del prodotto (confronto testuale semplificato)
  if (edasData.productInfo.description && loadingNoteData.productDescription) {
    const edasProduct = edasData.productInfo.description.toLowerCase().trim();
    const loadingNoteProduct = loadingNoteData.productDescription.toLowerCase().trim();
    const isProductMatch = edasProduct.includes(loadingNoteProduct) || loadingNoteProduct.includes(edasProduct);
    
    results.push({
      field: 'Descrizione Prodotto',
      edasValue: edasData.productInfo.description,
      loadingNoteValue: loadingNoteData.productDescription,
      isMatch: isProductMatch,
      severity: isProductMatch ? 'info' : 'warning'
    });
  }

  return results;
} 