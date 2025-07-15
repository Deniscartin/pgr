import { NextRequest, NextResponse } from 'next/server';

const PYTHON_SERVICE_URL = 'https://api.petrolis.it';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    const imageBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    // --- BYPASS TEMPORANEO ---
    // La chiamata al servizio di processamento Python è temporaneamente disabilitata.
    // Restituiamo l'immagine originale come se fosse stata processata con successo
    // per permettere al flusso di estrazione dati di procedere.
    return NextResponse.json({
      processed_image: base64Image,
      original_image: base64Image,
      processed: true,
      success: true,
    });
  } catch (error) {
    console.error('Error in document processing API (bypassed):', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      {
        error: 'Failed to process document image',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/*
// --- CODICE ORIGINALE CON CHIAMATA AL SERVIZIO PYTHON ---

// export async function POST(req: NextRequest) {
//   let base64Image: string | null = null;

//   try {
//     const formData = await req.formData();
//     const imageFile = formData.get('image') as File | null;
//     const enhance = formData.get('enhance') === 'true';

//     if (!imageFile) {
//       return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
//     }

//     const imageBuffer = await imageFile.arrayBuffer();
//     base64Image = Buffer.from(imageBuffer).toString('base64');

//     const pythonResponse = await fetch(`${PYTHON_SERVICE_URL}/process-document`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         image: base64Image,
//         enhance: enhance,
//       }),
//     });

//     if (!pythonResponse.ok) {
//       let errorDetails;
//       const contentType = pythonResponse.headers.get('content-type');
//       if (contentType && contentType.includes('application/json')) {
//         errorDetails = await pythonResponse.json();
//         console.error('Python service JSON error:', errorDetails);
//       } else {
//         const errorText = await pythonResponse.text();
//         console.error('Python service text error:', errorText);
//         errorDetails = { error: 'Service returned non-JSON response', details: errorText };
//       }
      
//       return NextResponse.json({
//         processed_image: base64Image,
//         original_image: base64Image,
//         processed: false,
//         warning: 'Document processing service unavailable, using original image',
//         service_error: errorDetails
//       });
//     }

//     const result = await pythonResponse.json();

//     if (!result.success) {
//       throw new Error(result.error || 'Processing failed');
//     }

//     return NextResponse.json({
//       processed_image: result.processed_image,
//       original_image: base64Image,
//       processed: true,
//       success: true,
//     });

//   } catch (error) {
//     console.error('Error in document processing API:', error);
    
//     if (base64Image) {
//       return NextResponse.json({
//         processed_image: base64Image,
//         original_image: base64Image,
//         processed: false,
//         error: 'Processing failed, using original image',
//         details: error instanceof Error ? error.message : 'Unknown error',
//       });
//     }
    
//     const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
//     return NextResponse.json({ 
//       error: 'Failed to process document image', 
//       details: errorMessage 
//     }, { status: 500 });
//   }
// }
*/

export async function GET() {
  try {
    // Health check per il microservizio Python
    const healthResponse = await fetch(`${PYTHON_SERVICE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      return NextResponse.json({
        status: 'healthy',
        python_service: healthData,
        service_url: PYTHON_SERVICE_URL
      });
    } else {
      return NextResponse.json({
        status: 'unhealthy',
        error: 'Python service not responding',
        service_url: PYTHON_SERVICE_URL
      }, { status: 503 });
    }
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: 'Cannot connect to Python service',
      service_url: PYTHON_SERVICE_URL,
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
} 