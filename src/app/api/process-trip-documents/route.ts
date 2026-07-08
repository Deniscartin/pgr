import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ParsedEDASData, ParsedLoadingNoteData, ValidationResult } from '@/lib/types';
import { parseLoadingNote, parseEdas } from '@/lib/documentParsers';

/**
 * Scarica un'immagine da URL e la converte in base64 per Google Document AI
 */
async function downloadImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
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
    console.warn('Direct fetch failed, trying Firebase Storage approach:', fetchError);
    
    // Approccio alternativo: estrai il path dall'URL e usa Firebase Storage
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
}

export async function POST(request: NextRequest) {
  try {
    const { tripId, orderId, driverId, edasImageUrl, loadingNoteImageUrl, cartelloCounterImageUrl } = await request.json();

    // edasImageUrl è opzionale (può mancare se ci sono 2 note)
    if (!tripId || !orderId || !driverId || !loadingNoteImageUrl || !cartelloCounterImageUrl) {
      return NextResponse.json(
        { error: 'Trip ID, Order ID, Driver ID, Loading Note URL e Cartellino URL sono richiesti. DAS URL è opzionale.' },
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

    console.log(`🚀 Inizio processamento documenti per trip ${tripId} con Google Document AI`);
    console.log('📋 L\'autista ha già caricato i documenti nei campi corretti!');
    console.log('  - e-DAS:', edasImageUrl);
    console.log('  - Loading Note:', loadingNoteImageUrl);
    console.log('  - Cartellino:', cartelloCounterImageUrl);

    // Step 1: Process e-DAS con Google Document AI (se disponibile)
    let edasData: ParsedEDASData | null = null;
    if (edasImageUrl) {
      try {
        console.log('📄 Step 1: Processing e-DAS con Google Document AI...');
        const { base64, mimeType } = await downloadImageAsBase64(edasImageUrl);
        edasData = await parseEdas(base64, mimeType);
        console.log('✅ e-DAS processed successfully con Google Document AI');
      } catch (error) {
        console.error('❌ Error processing e-DAS:', error);
        console.log('⚠️ DAS non disponibile o errore nel processamento');
      }
    } else {
      console.log('ℹ️ Step 1: DAS non fornito (opzionale)');
    }

    // Step 2: Process Loading Note con Google Document AI
    let loadingNoteData: ParsedLoadingNoteData | null = null;
    try {
      console.log('📄 Step 2: Processing Loading Note con Google Document AI...');
      const { base64, mimeType } = await downloadImageAsBase64(loadingNoteImageUrl);
      loadingNoteData = await parseLoadingNote(base64, mimeType);
      console.log('✅ Loading Note processed successfully con Google Document AI');
    } catch (error) {
      console.error('❌ Error processing Loading Note:', error);
    }

    // Step 2.5: Fallback - Se manca il DAS, crea edasData dai dati della Loading Note
    let isFallbackMode = false;
    if (!edasData && loadingNoteData) {
      console.log('🔄 Fallback: Creazione e-DAS dai dati della Loading Note...');
      isFallbackMode = true;
      edasData = {
        documentInfo: {
          dasNumber: loadingNoteData.documentNumber || '', // Usa il DAS dalla nota se disponibile
          version: '1',
          localReferenceNumber: '',
          invoiceNumber: '',
          invoiceDate: loadingNoteData.loadingDate || '',
          registrationDateTime: '',
          shippingDateTime: '',
          validityExpirationDateTime: '',
        },
        senderInfo: {
          depositoMittenteCode: '',
          name: loadingNoteData.shipperName || loadingNoteData.depotLocation || '',
          address: '',
        },
        depositorInfo: {
          name: loadingNoteData.shipperName || loadingNoteData.depotLocation || '',
          id: '',
        },
        recipientInfo: {
          name: loadingNoteData.destinationName || loadingNoteData.consigneeName || '',
          address: loadingNoteData.destinationName || loadingNoteData.consigneeName || '',
          taxCode: '',
        },
        transportInfo: {
          transportManager: '',
          transportMode: '',
          vehicleType: '',
          vehicleId: '',
          estimatedDuration: '',
          firstCarrierName: loadingNoteData.carrierName || '',
          firstCarrierId: '',
          driverName: '',
        },
        productInfo: {
          productCode: '',
          description: loadingNoteData.productDescription || '',
          unCode: '',
          netWeightKg: 0,
          volumeAtAmbientTempL: loadingNoteData.volumeLiters || 0,
          volumeAt15CL: loadingNoteData.volumeLiters || 0,
          densityAtAmbientTemp: 0,
          densityAt15C: 0,
        },
      };
      console.log('✅ e-DAS creato dai dati della Loading Note (fallback)');
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

      // Use Loading Note data as primary source (sempre priorità)
      if (loadingNoteData) {
        orderUpdateData.orderNumber = loadingNoteData.documentNumber || `TEMP_${Date.now()}`;
        orderUpdateData.product = loadingNoteData.productDescription || 'DA ESTRARRE';
        orderUpdateData.quantity = loadingNoteData.volumeLiters || 0;
        orderUpdateData.customerName = loadingNoteData.destinationName || loadingNoteData.consigneeName || 'DA ESTRARRE';
        orderUpdateData.deliveryAddress = loadingNoteData.destinationName || 'DA ESTRARRE';
      }

      // Use e-DAS data as fallback ONLY if Loading Note data is missing
      // (Non sovrascrivere i dati della Loading Note che hanno sempre priorità)
      if (edasData && !loadingNoteData) {
        // Solo se manca completamente la Loading Note, usa i dati del DAS
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

      orderUpdateData.notes = `Ordine aggiornato da documenti processati con Google Document AI`;
      
      await updateDoc(orderRef, orderUpdateData);
      console.log('✅ Order updated successfully');
    } catch (error) {
      console.error('❌ Error updating order:', error);
    }

    // Step 5: Cross-validation between e-DAS and Loading Note
    // Skip validation if DAS was created from Loading Note (fallback mode)
    const validationResults: ValidationResult[] = [];
    
    if (edasData && loadingNoteData && !isFallbackMode) {
      console.log('🔍 Step 5: Cross-validating e-DAS and Loading Note data...');
      const crossValidation = validateDocuments(edasData, loadingNoteData);
      validationResults.push(...crossValidation);
      console.log('✅ Validation completed:', validationResults);
    } else if (isFallbackMode) {
      console.log('ℹ️ Step 5: Skipping validation (DAS creato da Loading Note in modalità fallback)');
    }

    // Step 6: Update trip with processed data
    console.log('💾 Step 6: Updating trip with processed data...');
    const updateData: any = {
      updatedAt: Timestamp.now(),
      status: 'completato',
      completedAt: Timestamp.now(),
      edasImageUrl: edasImageUrl || null,
      loadingNoteImageUrl: loadingNoteImageUrl,
      cartelloCounterImageUrl: cartelloCounterImageUrl,
      edasData: edasData,
      loadingNoteData: loadingNoteData,
      processingMode: isFallbackMode ? 'google_docai_fallback' : 'google_docai',
      processedAt: Timestamp.now()
    };

    // Aggiungi validationResults solo se non è vuoto (Firestore non accetta undefined)
    if (validationResults.length > 0) {
      updateData.validationResults = validationResults;
    }

    await updateDoc(tripRef, updateData);

    console.log(`🎉 Processamento completato per trip ${tripId} con Google Document AI`);
    console.log(`  - e-DAS processed: ${!!edasData}`);
    console.log(`  - Loading Note processed: ${!!loadingNoteData}`);
    console.log(`  - Validation results: ${validationResults.length}`);

    return NextResponse.json({
      success: true,
      tripId,
      processingMode: isFallbackMode ? 'google_docai_fallback' : 'google_docai',
      edasProcessed: !!edasData,
      loadingNoteProcessed: !!loadingNoteData,
      edasFromFallback: isFallbackMode,
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
