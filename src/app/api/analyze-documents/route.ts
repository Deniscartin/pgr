import { NextRequest, NextResponse } from 'next/server';
import { analyzeDocumentsForMultipleTrips } from '@/lib/aiDocumentAnalysis';

export async function POST(request: NextRequest) {
  try {
    const { imageUrls } = await request.json();

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'URLs delle immagini sono richieste' },
        { status: 400 }
      );
    }

    console.log(`🤖 Starting AI document analysis for ${imageUrls.length} images`);

    // Step 1: AI Analysis to identify document types and determine trip structure
    const multiTripAnalysis = await analyzeDocumentsForMultipleTrips(imageUrls);
    
    console.log('📋 AI Analysis completed:', multiTripAnalysis.analysis);
    console.log('🚛 Trip Structure determined:', multiTripAnalysis.trips);

    // Return the analysis results to the mobile app
    return NextResponse.json({
      success: true,
      analysis: multiTripAnalysis.analysis,
      tripStructure: multiTripAnalysis.trips,
      multipleTripsDetected: multiTripAnalysis.trips.length > 1,
      totalTrips: multiTripAnalysis.trips.length,
      processingRecommendation: {
        mode: multiTripAnalysis.trips.length > 1 ? 'multiple_trips' : 
              multiTripAnalysis.trips[0]?.documents.loadingNote ? 'standard' : 'edas_fallback',
        message: multiTripAnalysis.trips.length > 1 
          ? `Rilevati ${multiTripAnalysis.trips.length} e-DAS. Verranno creati ${multiTripAnalysis.trips.length} viaggi separati.`
          : multiTripAnalysis.trips[0]?.documents.loadingNote 
            ? 'Documenti riconosciuti correttamente. Processamento standard.'
            : 'Nessuna bolla di carico rilevata. Verrà usata modalità fallback con solo e-DAS.'
      }
    });

  } catch (error) {
    console.error('❌ Error in document analysis:', error);
    return NextResponse.json(
      { 
        error: 'Errore durante l\'analisi dei documenti',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
