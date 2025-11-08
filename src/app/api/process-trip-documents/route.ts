import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ParsedEDASData, ParsedLoadingNoteData, ValidationResult } from '@/lib/types';
import { parseLoadingNote } from '@/lib/documentParsers';
import { analyzeDocumentsForMultipleTrips, DocumentType } from '@/lib/aiDocumentAnalysis';

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

    // Step 1: AI Analysis to identify document types and determine trip structure
    console.log('🤖 Step 1: AI Analysis to identify document types and trip structure');
    const imageUrls = [edasImageUrl, loadingNoteImageUrl, cartelloCounterImageUrl];
    const multiTripAnalysis = await analyzeDocumentsForMultipleTrips(imageUrls);
    
    console.log('📋 AI Analysis Results:', multiTripAnalysis.analysis);
    console.log('🚛 Trip Structure:', multiTripAnalysis.trips);

    // Step 2: Handle multiple trips scenario
    if (multiTripAnalysis.trips.length > 1) {
      console.log(`🚛🚛 Creating ${multiTripAnalysis.trips.length} separate trips`);
      return await handleMultipleTrips(multiTripAnalysis, tripId, orderId, driverId);
    }

    // Step 3: Handle single trip (standard or fallback mode)
    const singleTrip = multiTripAnalysis.trips[0];
    console.log('🚛 Processing single trip:', singleTrip);

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

    // Step 4: Process the Loading Note with OCR (if available)
    let loadingNoteData: ParsedLoadingNoteData | null = null;
    if (singleTrip.documents.loadingNote) {
      try {
        console.log('📄 Step 4: Processing Loading Note with OCR...');
        const { base64, mimeType } = await downloadImageAsBase64(singleTrip.documents.loadingNote);
        loadingNoteData = await parseLoadingNote(base64, mimeType);
        console.log('✅ Loading Note processed successfully');
      } catch (error) {
        console.error('❌ Error processing Loading Note:', error);
      }
    } else {
      console.warn('⚠️ No Loading Note available - using e-DAS fallback mode');
    }

    // Step 5: e-DAS and Counter are saved as images only (no OCR processing)
    console.log('📸 Step 5: e-DAS and Counter saved as images (no OCR processing)');
    const edasData: ParsedEDASData | null = null;

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
    const validationResults: ValidationResult[] = [];

    // Step 6: Update trip with processed data and correct image URLs
    console.log('💾 Step 6: Updating trip with processed data and correct image URLs');
    const updateData: any = {
      updatedAt: Timestamp.now(),
      status: 'completato',
      completedAt: Timestamp.now(),
      // Store images in correct fields based on AI analysis
      edasImageUrl: singleTrip.documents.edas?.[0] || edasImageUrl, // AI-identified e-DAS or fallback
      loadingNoteImageUrl: singleTrip.documents.loadingNote || loadingNoteImageUrl, // AI-identified Loading Note or fallback  
      cartelloCounterImageUrl: singleTrip.documents.cartelloCounter || cartelloCounterImageUrl, // AI-identified Counter or fallback
      // Store AI analysis results for debugging/verification
      aiAnalysisResults: multiTripAnalysis.analysis,
      tripStructure: singleTrip,
      processingMode: singleTrip.documents.loadingNote ? 'standard' : 'edas_fallback'
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

    console.log(`🎉 Processamento completato per trip ${tripId}`);

    return NextResponse.json({
      success: true,
      tripId,
      processingMode: singleTrip.documents.loadingNote ? 'standard' : 'edas_fallback',
      aiAnalysisResults: multiTripAnalysis.analysis,
      tripStructure: singleTrip,
      edasProcessed: false, // e-DAS saved as image only
      loadingNoteProcessed: !!loadingNoteData,
      cartelloCounterProcessed: false, // Counter saved as image only
      validationResults,
      multipleTripsCreated: false
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

// Funzione per gestire viaggi multipli (quando sono rilevati 2 o più e-DAS)
async function handleMultipleTrips(multiTripAnalysis: any, originalTripId: string, originalOrderId: string, driverId: string) {
  console.log('🚛🚛 Handling multiple trips creation...');
  
  const { addDoc, collection } = await import('firebase/firestore');
  const createdTrips: string[] = [];
  
  try {
    // Per ogni viaggio identificato dall'AI
    for (let i = 0; i < multiTripAnalysis.trips.length; i++) {
      const tripStructure = multiTripAnalysis.trips[i];
      console.log(`📝 Creating trip ${i + 1}/${multiTripAnalysis.trips.length}:`, tripStructure);
      
      // Crea un nuovo ordine per ogni viaggio (eccetto il primo che usa quello esistente)
      let orderId = originalOrderId;
      if (i > 0) {
        const newOrderData = {
          orderNumber: `TEMP_MULTI_${Date.now()}_${i}`,
          customerName: 'DA ESTRARRE',
          customerCode: 'TEMP',
          deliveryAddress: 'DA ESTRARRE',
          destinationCode: 'TEMP',
          product: 'DA ESTRARRE',
          quantity: 0,
          quantityUnit: 'LT',
          status: 'completato',
          notes: `Ordine multiplo ${i + 1} - documenti in elaborazione`,
          createdBy: driverId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        
        const newOrderRef = await addDoc(collection(db, 'orders'), newOrderData);
        orderId = newOrderRef.id;
        console.log(`✅ Created new order ${orderId} for trip ${i + 1}`);
      }
      
      // Crea il viaggio (il primo aggiorna quello esistente, gli altri sono nuovi)
      let tripId = originalTripId;
      if (i > 0) {
        const newTripData = {
          orderId: orderId,
          driverId: driverId,
          driverName: '', // Will be filled from user profile
          status: 'elaborazione',
          edasImageUrl: tripStructure.documents.edas?.[0] || '',
          loadingNoteImageUrl: tripStructure.documents.loadingNote || '',
          cartelloCounterImageUrl: tripStructure.documents.cartelloCounter || '',
          assignedBy: driverId,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          aiAnalysisResults: multiTripAnalysis.analysis,
          tripStructure: tripStructure,
          processingMode: tripStructure.documents.loadingNote ? 'standard' : 'edas_fallback',
          isMultiTripPart: true,
          multiTripIndex: i + 1,
          multiTripTotal: multiTripAnalysis.trips.length
        };
        
        const newTripRef = await addDoc(collection(db, 'trips'), newTripData);
        tripId = newTripRef.id;
        console.log(`✅ Created new trip ${tripId} for trip ${i + 1}`);
      } else {
        // Aggiorna il viaggio originale
        const tripRef = doc(db, 'trips', originalTripId);
        const updateData = {
          updatedAt: Timestamp.now(),
          edasImageUrl: tripStructure.documents.edas?.[0] || '',
          loadingNoteImageUrl: tripStructure.documents.loadingNote || '',
          cartelloCounterImageUrl: tripStructure.documents.cartelloCounter || '',
          aiAnalysisResults: multiTripAnalysis.analysis,
          tripStructure: tripStructure,
          processingMode: tripStructure.documents.loadingNote ? 'standard' : 'edas_fallback',
          isMultiTripPart: true,
          multiTripIndex: 1,
          multiTripTotal: multiTripAnalysis.trips.length
        };
        
        await updateDoc(tripRef, updateData);
        console.log(`✅ Updated original trip ${originalTripId} as trip 1`);
      }
      
      createdTrips.push(tripId);
      
      // Processa i documenti per questo viaggio
      await processDocumentsForTrip(tripId, tripStructure);
    }
    
    console.log(`🎉 Successfully created ${multiTripAnalysis.trips.length} trips:`, createdTrips);
    
    return NextResponse.json({
      success: true,
      multipleTripsCreated: true,
      totalTrips: multiTripAnalysis.trips.length,
      createdTripIds: createdTrips,
      aiAnalysisResults: multiTripAnalysis.analysis,
      tripStructures: multiTripAnalysis.trips
    });
    
  } catch (error) {
    console.error('❌ Error creating multiple trips:', error);
    throw error;
  }
}

// Funzione per processare i documenti di un singolo viaggio
async function processDocumentsForTrip(tripId: string, tripStructure: any) {
  console.log(`📄 Processing documents for trip ${tripId}:`, tripStructure);
  
  // Per ora processiamo solo la Loading Note se presente
  if (tripStructure.documents.loadingNote) {
    try {
      console.log('📄 Processing Loading Note with OCR...');
      
      // Scarica e processa la Loading Note
      const response = await fetch(tripStructure.documents.loadingNote);
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = 'image/jpeg';
      
      const loadingNoteData = await parseLoadingNote(base64, mimeType);
      
      // Aggiorna il viaggio con i dati processati
      const tripRef = doc(db, 'trips', tripId);
      await updateDoc(tripRef, {
        loadingNoteData: loadingNoteData,
        status: 'completato',
        completedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      console.log(`✅ Loading Note processed for trip ${tripId}`);
      
    } catch (error) {
      console.error(`❌ Error processing Loading Note for trip ${tripId}:`, error);
      
      // Marca il viaggio come completato anche se il processamento fallisce
      const tripRef = doc(db, 'trips', tripId);
      await updateDoc(tripRef, {
        status: 'completato',
        completedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        processingError: 'Loading Note processing failed'
      });
    }
  } else {
    // Nessuna Loading Note - modalità fallback e-DAS
    console.log(`⚠️ No Loading Note for trip ${tripId} - using e-DAS fallback mode`);
    
    const tripRef = doc(db, 'trips', tripId);
    await updateDoc(tripRef, {
      status: 'completato',
      completedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      processingMode: 'edas_fallback'
    });
  }
}