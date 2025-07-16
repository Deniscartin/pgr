import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ParsedEDASData, ParsedLoadingNoteData, ValidationResult } from '@/lib/types';
import { parseEdas, parseLoadingNote } from '@/lib/documentParsers';

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
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = response.headers.get('content-type') || 'image/jpeg';
      return { base64, mimeType };
    };

    // Processa l'e-DAS
    let edasData: ParsedEDASData | null = null;
    try {
      console.log('Processamento e-DAS...');
      const { base64, mimeType } = await downloadImageAsBase64(edasImageUrl);
      edasData = await parseEdas(base64, mimeType);
      console.log('e-DAS processato con successo');
    } catch (error) {
      console.error('Errore nel processamento e-DAS:', error);
    }

    // Processa la Nota di Carico
    let loadingNoteData: ParsedLoadingNoteData | null = null;
    try {
      console.log('Processamento Nota di Carico...');
      const { base64, mimeType } = await downloadImageAsBase64(loadingNoteImageUrl);
      loadingNoteData = await parseLoadingNote(base64, mimeType);
      console.log('Nota di Carico processata con successo');
    } catch (error) {
      console.error('Errore nel processamento Nota di Carico:', error);
    }

    // Aggiorna l'ordine con i dati veri se abbiamo l'e-DAS
    if (edasData) {
      try {
        console.log('Aggiornamento ordine con dati e-DAS...');
        const orderRef = doc(db, 'orders', tripDoc.data().orderId);
        const orderUpdateData = {
          orderNumber: edasData.documentInfo.dasNumber,
          product: edasData.productInfo.description,
          customerName: edasData.recipientInfo.name,
          customerCode: edasData.recipientInfo.taxCode,
          deliveryAddress: edasData.recipientInfo.address,
          quantity: edasData.productInfo.volumeAt15CL,
          notes: `Ordine aggiornato da e-DAS ${edasData.documentInfo.dasNumber}${loadingNoteData ? ` e Nota di Carico ${loadingNoteData.documentNumber}` : ''}.`,
          updatedAt: Timestamp.now()
        };
        await updateDoc(orderRef, orderUpdateData);
        console.log('Ordine aggiornato con successo');
      } catch (error) {
        console.error('Errore nell\'aggiornamento ordine:', error);
      }
    }

    // Validazione incrociata tra e-DAS e Nota di Carico
    let validationResults: ValidationResult[] = [];
    if (edasData && loadingNoteData) {
      validationResults = validateDocuments(edasData, loadingNoteData);
    }

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
      edasProcessed: !!edasData,
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