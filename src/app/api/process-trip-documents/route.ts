import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ParsedEDASData, ParsedLoadingNoteData, ValidationResult } from '@/lib/types';
// DISABILITATO: import { parseLoadingNote, parseEdas } from '@/lib/documentParsers';

/**
 * Chiama la nostra API OCR locale per processare un'immagine
 */
async function parseWithLocalOCR(imageUrl: string): Promise<ParsedLoadingNoteData | ParsedEDASData | null> {
  try {
    console.log('🤖 Chiamata OCR API locale per:', imageUrl.substring(0, 80) + '...');
    
    // Scarica l'immagine
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }
    
    const imageBlob = await imageResponse.blob();
    
    // Prepara FormData per OCR API
    const formData = new FormData();
    formData.append('image', imageBlob, 'document.jpg');
    
    // URL del server OCR locale
    const OCR_API_URL = process.env.OCR_API_URL || 'http://77.42.92.255:8000';
    
    // Chiama OCR API
    const ocrResponse = await fetch(`${OCR_API_URL}/api/scan`, {
      method: 'POST',
      body: formData,
    });
    
    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      throw new Error(`OCR API error: ${ocrResponse.status} - ${errorText}`);
    }
    
    const ocrResult = await ocrResponse.json();
    console.log('✅ OCR Result tipo:', ocrResult.tipo);
    console.log('📋 OCR Result dati.numero (DAS):', ocrResult.dati?.numero);
    
    if (ocrResult.status !== 'ok') {
      throw new Error(ocrResult.message || 'OCR failed');
    }
    
    const dati = ocrResult.dati;
    const tipo = ocrResult.tipo; // "DAS" o "NOTA"
    
    // Estrai nome azienda da destinazione (rimuovi indirizzo dopo " - ")
    const extractCompanyName = (destinazione: string): string => {
      if (!destinazione) return '';
      const parts = destinazione.split(' - ');
      return parts[0].trim();
    };
    
    // Per le Note: ignora cliente se è ENIMOOV (fornitore), usa sempre destinazione
    // Per i DAS: usa cliente se disponibile, altrimenti destinazione
    let clienteName = '';
    if (tipo === 'NOTA') {
      clienteName = extractCompanyName(dati.destinazione || '') || '';
    } else {
      clienteName = dati.cliente || extractCompanyName(dati.destinazione || '') || '';
    }
    
    if (tipo === 'DAS') {
      // Mappa a ParsedEDASData
      const edasData: ParsedEDASData = {
        documentInfo: {
          dasNumber: dati.numero || '',
          version: '1',
          localReferenceNumber: '',
          invoiceNumber: '',
          invoiceDate: dati.data || '',
          registrationDateTime: '',
          shippingDateTime: '',
          validityExpirationDateTime: '',
        },
        senderInfo: {
          depositoMittenteCode: '',
          name: dati.deposito || '',
          address: '',
        },
        depositorInfo: {
          name: dati.deposito || '',
          id: '',
        },
        recipientInfo: {
          name: clienteName,
          address: clienteName,
          taxCode: '',
        },
        transportInfo: {
          transportManager: '',
          transportMode: '',
          vehicleType: '',
          vehicleId: '',
          estimatedDuration: '',
          firstCarrierName: '',
          firstCarrierId: '',
          driverName: '',
        },
        productInfo: {
          productCode: '',
          description: dati.prodotto || '',
          unCode: '',
          netWeightKg: 0,
          volumeAtAmbientTempL: dati.quantita_litri || 0,
          volumeAt15CL: dati.quantita_litri || 0,
          densityAtAmbientTemp: 0,
          densityAt15C: 0,
        },
      };
      return edasData;
    } else {
      // Mappa a ParsedLoadingNoteData
      const loadingNoteData: ParsedLoadingNoteData = {
        // Per Note: usa das_riferimento (DAS) se disponibile, altrimenti numero
        documentNumber: dati.das_riferimento || dati.numero || '',
        loadingDate: dati.data || '',
        carrierName: '',
        shipperName: tipo === 'NOTA' ? (dati.fornitore || '') : (dati.deposito || ''),
        consigneeName: clienteName,
        productDescription: dati.prodotto || '',
        grossWeightKg: 0,
        netWeightKg: 0,
        volumeLiters: dati.quantita_litri || 0,
        notes: `Tipo: ${tipo}`,
        depotLocation: dati.deposito || dati.fornitore || '',
        destinationName: clienteName,
      };
      return loadingNoteData;
    }
    
  } catch (error) {
    console.error('❌ Errore OCR locale:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tripId, orderId, driverId, edasImageUrl, loadingNoteImageUrl, cartelloCounterImageUrl } = await request.json();

    if (!tripId || !orderId || !driverId || !edasImageUrl || !loadingNoteImageUrl || !cartelloCounterImageUrl) {
      return NextResponse.json(
        { error: 'Trip ID, Order ID, Driver ID e URLs delle immagini sono richiesti' },
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

    console.log(`🚀 Inizio processamento documenti per trip ${tripId}`);
    console.log('📋 L\'autista ha già caricato i documenti nei campi corretti!');
    console.log('  - e-DAS:', edasImageUrl);
    console.log('  - Loading Note:', loadingNoteImageUrl);
    console.log('  - Cartellino:', cartelloCounterImageUrl);

    // Step 1: Process e-DAS with local OCR
    let edasData: ParsedEDASData | null = null;
    try {
      console.log('📄 Step 1: Processing e-DAS with local OCR API...');
      const result = await parseWithLocalOCR(edasImageUrl);
      if (result && 'documentInfo' in result) {
        edasData = result as ParsedEDASData;
        console.log('✅ e-DAS processed successfully');
      }
    } catch (error) {
      console.error('❌ Error processing e-DAS:', error);
    }

    // Step 2: Process Loading Note with local OCR
    let loadingNoteData: ParsedLoadingNoteData | null = null;
    try {
      console.log('📄 Step 2: Processing Loading Note with local OCR API...');
      const result = await parseWithLocalOCR(loadingNoteImageUrl);
      if (result && 'documentNumber' in result) {
        loadingNoteData = result as ParsedLoadingNoteData;
        console.log('✅ Loading Note processed successfully');
      }
    } catch (error) {
      console.error('❌ Error processing Loading Note:', error);
    }

    // Step 3: Cartellino Counter - saved as image only (no OCR)
    console.log('📸 Step 3: Cartellino Counter saved as image (no OCR processing)');

    // Step 4: Update Order with extracted data
    console.log('💾 Step 4: Updating order with extracted data...');
    try {
      const orderRef = doc(db, 'orders', tripDoc.data().orderId);
      const orderUpdateData: any = {
        updatedAt: Timestamp.now()
      };

      // Use Loading Note data as primary source
      if (loadingNoteData) {
        orderUpdateData.orderNumber = loadingNoteData.documentNumber || `TEMP_${Date.now()}`;
        orderUpdateData.product = loadingNoteData.productDescription || 'DA ESTRARRE';
        orderUpdateData.quantity = loadingNoteData.volumeLiters || 0;
        orderUpdateData.customerName = loadingNoteData.destinationName || loadingNoteData.consigneeName || 'DA ESTRARRE';
        orderUpdateData.deliveryAddress = loadingNoteData.destinationName || 'DA ESTRARRE';
      }

      // Use e-DAS data as fallback or to fill missing fields
      if (edasData) {
        if (!orderUpdateData.product || orderUpdateData.product === 'DA ESTRARRE') {
          orderUpdateData.product = edasData.productInfo.description || 'DA ESTRARRE';
        }
        if (!orderUpdateData.quantity || orderUpdateData.quantity === 0) {
          orderUpdateData.quantity = edasData.productInfo.volumeAtAmbientTempL || 0;
        }
        if (!orderUpdateData.customerName || orderUpdateData.customerName === 'DA ESTRARRE') {
          orderUpdateData.customerName = edasData.recipientInfo.name || 'DA ESTRARRE';
        }
      }

      orderUpdateData.notes = `Ordine aggiornato da documenti processati`;
      
      await updateDoc(orderRef, orderUpdateData);
      console.log('✅ Order updated successfully');
    } catch (error) {
      console.error('❌ Error updating order:', error);
    }

    // Step 5: Cross-validation between e-DAS and Loading Note
    const validationResults: ValidationResult[] = [];
    if (edasData && loadingNoteData) {
      console.log('🔍 Step 5: Cross-validating e-DAS and Loading Note data...');
      const crossValidation = validateDocuments(edasData, loadingNoteData);
      validationResults.push(...crossValidation);
      console.log('✅ Validation completed:', validationResults);
    }

    // Step 6: Update trip with processed data
    console.log('💾 Step 6: Updating trip with processed data...');
    const updateData: any = {
      updatedAt: Timestamp.now(),
      status: 'completato',
      completedAt: Timestamp.now(),
      edasImageUrl: edasImageUrl,
      loadingNoteImageUrl: loadingNoteImageUrl,
      cartelloCounterImageUrl: cartelloCounterImageUrl,
      edasData: edasData,
      loadingNoteData: loadingNoteData,
      validationResults: validationResults.length > 0 ? validationResults : undefined,
      processingMode: 'local_ocr',
      processedAt: Timestamp.now()
    };

    await updateDoc(tripRef, updateData);

    console.log(`🎉 Processamento completato per trip ${tripId}`);
    console.log(`  - e-DAS processed: ${!!edasData}`);
    console.log(`  - Loading Note processed: ${!!loadingNoteData}`);
    console.log(`  - Validation results: ${validationResults.length}`);

    return NextResponse.json({
      success: true,
      tripId,
      processingMode: 'local_ocr',
      edasProcessed: !!edasData,
      loadingNoteProcessed: !!loadingNoteData,
      cartelloCounterProcessed: true,
      validationResults,
      edasData: edasData ? {
        dasNumber: edasData.documentInfo.dasNumber,
        product: edasData.productInfo.description,
        volume: edasData.productInfo.volumeAtAmbientTempL,
      } : null,
      loadingNoteData: loadingNoteData ? {
        documentNumber: loadingNoteData.documentNumber,
        product: loadingNoteData.productDescription,
        volume: loadingNoteData.volumeLiters,
      } : null
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

  // Validazione del volume
  if (edasData.productInfo.volumeAtAmbientTempL && loadingNoteData.volumeLiters) {
    const volumeDifference = Math.abs(edasData.productInfo.volumeAtAmbientTempL - loadingNoteData.volumeLiters);
    const volumeToleranceL = 100; // Tolleranza di 100L
    
    results.push({
      field: 'Volume (L)',
      edasValue: edasData.productInfo.volumeAtAmbientTempL,
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
