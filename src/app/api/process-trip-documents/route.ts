import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ParsedEDASData, ParsedLoadingNoteData, ValidationResult } from '@/lib/types';
import { parseLoadingNote, parseEdas } from '@/lib/documentParsers';

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

    // Step 1: Process e-DAS with OCR
    let edasData: ParsedEDASData | null = null;
    try {
      console.log('📄 Step 1: Processing e-DAS with Document AI...');
      const { base64, mimeType } = await downloadImageAsBase64(edasImageUrl);
      edasData = await parseEdas(base64, mimeType);
      console.log('✅ e-DAS processed successfully');
    } catch (error) {
      console.error('❌ Error processing e-DAS:', error);
    }

    // Step 2: Process Loading Note with OCR
    let loadingNoteData: ParsedLoadingNoteData | null = null;
    try {
      console.log('📄 Step 2: Processing Loading Note with Document AI...');
      const { base64, mimeType } = await downloadImageAsBase64(loadingNoteImageUrl);
      loadingNoteData = await parseLoadingNote(base64, mimeType);
      console.log('✅ Loading Note processed successfully');
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
        orderUpdateData.customerName = loadingNoteData.consigneeName || 'DA ESTRARRE';
        orderUpdateData.deliveryAddress = loadingNoteData.destinationName || 'DA ESTRARRE';
      }

      // Use e-DAS data as fallback or to fill missing fields
      if (edasData) {
        if (!orderUpdateData.product || orderUpdateData.product === 'DA ESTRARRE') {
          orderUpdateData.product = edasData.productInfo.description || 'DA ESTRARRE';
        }
        if (!orderUpdateData.quantity || orderUpdateData.quantity === 0) {
          orderUpdateData.quantity = edasData.productInfo.volumeAt15CL || 0;
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
      // Images are already correctly stored (autista uploaded them in the right fields)
      edasImageUrl: edasImageUrl,
      loadingNoteImageUrl: loadingNoteImageUrl,
      cartelloCounterImageUrl: cartelloCounterImageUrl,
      // Store extracted data
      edasData: edasData,
      loadingNoteData: loadingNoteData,
      // Store validation results
      validationResults: validationResults.length > 0 ? validationResults : undefined,
      // Processing metadata
      processingMode: 'direct', // Autista specified document types
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
      processingMode: 'direct',
      edasProcessed: !!edasData,
      loadingNoteProcessed: !!loadingNoteData,
      cartelloCounterProcessed: true, // Counter saved as image
      validationResults,
      edasData: edasData ? {
        dasNumber: edasData.documentInfo.dasNumber,
        product: edasData.productInfo.description,
        volume: edasData.productInfo.volumeAt15CL,
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
