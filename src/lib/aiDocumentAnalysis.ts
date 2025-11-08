import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type DocumentType = 'edas' | 'loadingNote' | 'cartelloCounter';

interface DocumentAnalysisResult {
  [imageUrl: string]: DocumentType;
}

interface MultiTripAnalysisResult {
  trips: Array<{
    tripId: string;
    documents: {
      edas?: string[];
      loadingNote?: string;
      cartelloCounter?: string;
    };
  }>;
  analysis: DocumentAnalysisResult;
}

/**
 * Analyze documents using AI to identify DAS vs Loading Note vs Counter
 * Server-side version that takes image URLs instead of local URIs
 * Now supports multiple DAS detection and trip creation logic
 */
export async function analyzeDocumentsForMultipleTrips(imageUrls: string[]): Promise<MultiTripAnalysisResult> {
  const basicAnalysis = await analyzeDocumentsWithGPT(imageUrls);
  return createTripStructure(basicAnalysis, imageUrls);
}

/**
 * Basic document analysis (original function)
 */
export async function analyzeDocumentsWithGPT(imageUrls: string[]): Promise<DocumentAnalysisResult> {
  try {
    console.log('🤖 Starting server-side AI analysis for', imageUrls.length, 'documents');
    
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️ OpenAI API key not found, falling back to mock analysis');
      return fallbackAnalysis(imageUrls);
    }

    const results: DocumentAnalysisResult = {};
    
    // Process images in parallel for better performance
    const analysisPromises = imageUrls.map(async (imageUrl, index) => {
      try {
        // Download and convert image to base64
        const base64Image = await downloadImageAsBase64(imageUrl);
        
        // Analyze with AI
        const documentType = await analyzeDocumentWithGPT(base64Image, index);
        results[imageUrl] = documentType;
        
        console.log(`✅ AI Analysis: Image ${index + 1} identified as ${documentType}`);
        
      } catch (error) {
        console.error(`❌ Error analyzing image ${index + 1}:`, error);
        // Fallback for this specific image
        results[imageUrl] = getFallbackType(index, imageUrls.length);
      }
    });
    
    await Promise.all(analysisPromises);
    
    // Ensure we have all required document types
    const finalResults = ensureAllDocumentTypes(results, imageUrls);
    
    console.log('🎉 Server-side AI analysis completed:', finalResults);
    return finalResults;
    
  } catch (error) {
    console.error('💥 Server-side AI analysis failed:', error);
    return fallbackAnalysis(imageUrls);
  }
}

/**
 * Download image from URL and convert to base64 for AI API
 */
async function downloadImageAsBase64(imageUrl: string): Promise<string> {
  try {
    console.log('📥 Downloading image for AI analysis:', imageUrl);
    
    // Try direct fetch first
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Petrolis/1.0)',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    console.log('✅ Image downloaded and converted to base64');
    return base64;
    
  } catch (error) {
    console.error('❌ Error downloading image for AI analysis:', error);
    throw error;
  }
}

/**
 * Analyze a single document with AI
 */
async function analyzeDocumentWithGPT(base64Image: string, imageIndex: number): Promise<DocumentType> {
  try {
    console.log(`🔍 Analyzing document ${imageIndex + 1} with GPT-4 Vision...`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // GPT-4 with vision capabilities
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analizza questo documento di trasporto e identifica di che tipo si tratta guardando attentamente il testo presente.

CRITERI DI RICONOSCIMENTO:

1. "edas" - e-DAS (Documento di Accompagnamento Semplificato):
   - CERCA LA SCRITTA "ADM" (Agenzia delle Dogane e dei Monopoli)
   - CERCA "DOCUMENTO DI ACCOMPAGNAMENTO" o "ACCOMPAGNAMENTO"
   - CERCA "e-DAS" o "eDAS"
   - Contiene informazioni su mittente, destinatario, prodotto petrolifero, quantità

2. "loadingNote" - Nota di Carico:
   - CERCA "NOTA DI CARICO" o "LOADING NOTE"
   - CERCA "CARICO" o "CARICAMENTO"
   - Documento che certifica il caricamento della merce
   - Contiene peso, volume, caratteristiche del prodotto

3. "cartelloCounter" - Cartellino Conta Litro:
   - CERCA "CARTELLINO" o "CONTA LITRO" o "CONTATORE"
   - CERCA numeri di lettura contatore (es: "Lettura iniziale", "Lettura finale")
   - CERCA "LITRI" con valori numerici
   - Mostra quantità caricate/scaricate in litri

IMPORTANTE: Se vedi "ADM" o "DOCUMENTO DI ACCOMPAGNAMENTO" è sicuramente "edas".

Rispondi SOLO con una di queste parole: "edas", "loadingNote", "cartelloCounter"

Non aggiungere spiegazioni, solo la classificazione.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 10,
      temperature: 0.1, // Low temperature for consistent results
    });

    const result = response.choices[0]?.message?.content?.trim().toLowerCase();
    console.log(`🤖 AI response for image ${imageIndex + 1}: "${result}"`);
    
    // Validate and normalize the response
    if (result === 'edas' || result === 'loadingnote' || result === 'cartellocounter') {
      const finalType = result === 'loadingnote' ? 'loadingNote' : 
                        result === 'cartellocounter' ? 'cartelloCounter' : 
                        result as DocumentType;
      console.log(`✅ AI classified image ${imageIndex + 1} as: ${finalType}`);
      return finalType;
    }
    
    // If AI returns invalid response, use fallback
    console.warn(`⚠️ AI returned invalid response: "${result}", using fallback`);
    return getFallbackType(imageIndex, 3);
    
  } catch (error) {
    console.error('❌ Error calling OpenAI API:', error);
    return getFallbackType(imageIndex, 3);
  }
}

/**
 * Ensure we have exactly one of each document type
 */
function ensureAllDocumentTypes(results: DocumentAnalysisResult, imageUrls: string[]): DocumentAnalysisResult {
  const finalResults = { ...results };
  const usedTypes = new Set(Object.values(finalResults));
  const requiredTypes: DocumentType[] = ['edas', 'loadingNote', 'cartelloCounter'];
  
  // Find missing types
  const missingTypes = requiredTypes.filter(type => !usedTypes.has(type));
  
  if (missingTypes.length > 0) {
    console.log('⚠️ Missing document types:', missingTypes, 'redistributing...');
    
    // Redistribute documents to ensure all types are covered
    const imageUrlList = Object.keys(finalResults);
    
    // Reset all to ensure proper distribution
    requiredTypes.forEach((type, index) => {
      if (index < imageUrlList.length) {
        finalResults[imageUrlList[index]] = type;
      }
    });
  }
  
  return finalResults;
}

/**
 * Fallback analysis when AI is not available
 * Uses URL analysis and position-based logic
 */
function fallbackAnalysis(imageUrls: string[]): DocumentAnalysisResult {
  console.log('🔄 Using fallback document analysis with improved heuristics');
  
  const results: DocumentAnalysisResult = {};
  
  // Analyze each image URL for clues
  imageUrls.forEach((imageUrl, index) => {
    const urlLower = imageUrl.toLowerCase();
    
    // Look for URL hints
    if (urlLower.includes('edas') || urlLower.includes('das') || urlLower.includes('adm') || urlLower.includes('accompagnamento')) {
      results[imageUrl] = 'edas';
    } else if (urlLower.includes('nota') || urlLower.includes('carico') || urlLower.includes('loading')) {
      results[imageUrl] = 'loadingNote';
    } else if (urlLower.includes('cartello') || urlLower.includes('counter') || urlLower.includes('litro') || urlLower.includes('contatore')) {
      results[imageUrl] = 'cartelloCounter';
    } else {
      // Fallback to position-based assignment
      const docTypes: DocumentType[] = ['edas', 'loadingNote', 'cartelloCounter'];
      results[imageUrl] = docTypes[index] || 'cartelloCounter';
    }
  });
  
  // Ensure we have all required document types
  return ensureAllDocumentTypes(results, imageUrls);
}

/**
 * Get fallback document type based on image index
 */
function getFallbackType(index: number, totalImages: number): DocumentType {
  const types: DocumentType[] = ['edas', 'loadingNote', 'cartelloCounter'];
  return types[index] || 'cartelloCounter';
}

/**
 * Create trip structure based on AI analysis results
 * Handles multiple DAS scenario and fallback logic
 */
function createTripStructure(analysis: DocumentAnalysisResult, imageUrls: string[]): MultiTripAnalysisResult {
  console.log('🏗️ Creating trip structure from AI analysis...');
  
  // Group documents by type
  const documentsByType: { [key in DocumentType]: string[] } = {
    edas: [],
    loadingNote: [],
    cartelloCounter: []
  };
  
  Object.entries(analysis).forEach(([url, type]) => {
    documentsByType[type].push(url);
  });
  
  console.log('📊 Documents grouped by type:', documentsByType);
  
  const edasCount = documentsByType.edas.length;
  const loadingNoteCount = documentsByType.loadingNote.length;
  const counterCount = documentsByType.cartelloCounter.length;
  
  console.log(`📈 Document counts: ${edasCount} e-DAS, ${loadingNoteCount} Loading Notes, ${counterCount} Counters`);
  
  // Scenario 1: Multiple e-DAS detected → Create multiple trips
  if (edasCount >= 2) {
    console.log('🚛🚛 Multiple e-DAS detected, creating multiple trips');
    
    const trips = documentsByType.edas.map((edasUrl, index) => ({
      tripId: `trip_${index + 1}`,
      documents: {
        edas: [edasUrl],
        // Distribute other documents evenly or assign to first trip
        loadingNote: index === 0 ? documentsByType.loadingNote[0] : undefined,
        cartelloCounter: index < counterCount ? documentsByType.cartelloCounter[index] : undefined
      }
    }));
    
    console.log(`✅ Created ${trips.length} trips for multiple e-DAS`);
    return { trips, analysis };
  }
  
  // Scenario 2: No Loading Note detected → Use fallback with e-DAS data only
  if (loadingNoteCount === 0 && edasCount > 0) {
    console.log('⚠️ No Loading Note detected, using e-DAS fallback mode');
    
    const trips = [{
      tripId: 'trip_1',
      documents: {
        edas: documentsByType.edas,
        loadingNote: undefined, // No loading note available
        cartelloCounter: documentsByType.cartelloCounter[0]
      }
    }];
    
    console.log('✅ Created fallback trip with e-DAS data only');
    return { trips, analysis };
  }
  
  // Scenario 3: Standard case → Single trip with all documents
  console.log('📋 Standard case: creating single trip with all documents');
  
  const trips = [{
    tripId: 'trip_1',
    documents: {
      edas: documentsByType.edas,
      loadingNote: documentsByType.loadingNote[0],
      cartelloCounter: documentsByType.cartelloCounter[0]
    }
  }];
  
  console.log('✅ Created standard single trip');
  return { trips, analysis };
}
