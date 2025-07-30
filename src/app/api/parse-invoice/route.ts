import { NextRequest, NextResponse } from 'next/server';
import { parseInvoiceData, parsePDFText, parseInvoiceXML } from '@/lib/pdfParser';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('invoice') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided', details: 'Nessun file fornito' },
        { status: 400 }
      );
    }

    console.log('Processing invoice file:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Check if file is PDF
    if (file.type === 'application/pdf') {
      try {
        // Parse PDF text
        const pdfText = await parsePDFText(file);
        console.log('Extracted text length:', pdfText.length);
        
        // Parse invoice data from text
        const parsedData = parseInvoiceData(pdfText);
        
        if (parsedData) {
          console.log('Successfully parsed invoice data');
          return NextResponse.json(parsedData);
        } else {
          console.log('Failed to parse invoice data from PDF text');
          return NextResponse.json(
            { 
              error: 'Failed to parse invoice data', 
              details: 'Impossibile estrarre i dati della fattura dal PDF. Verifica che il formato sia corretto.' 
            },
            { status: 400 }
          );
        }
      } catch (pdfError) {
        console.error('Error processing PDF:', pdfError);
        return NextResponse.json(
          { 
            error: 'PDF processing failed', 
            details: `Errore nell'elaborazione del PDF: ${pdfError instanceof Error ? pdfError.message : 'Errore sconosciuto'}` 
          },
          { status: 500 }
        );
      }
    } 
    // Check if file is XML (Italian Electronic Invoice)
    else if (file.type === 'application/xml' || file.type === 'text/xml' || file.name.toLowerCase().endsWith('.xml')) {
      try {
        // Read XML content
        const xmlText = await file.text();
        console.log('Extracted XML length:', xmlText.length);
        
        // Parse invoice data from XML
        const parsedData = parseInvoiceXML(xmlText);
        
        if (parsedData) {
          console.log('Successfully parsed XML invoice data');
          return NextResponse.json(parsedData);
        } else {
          console.log('Failed to parse invoice data from XML');
          return NextResponse.json(
            { 
              error: 'Failed to parse XML invoice data', 
              details: 'Impossibile estrarre i dati della fattura dal file XML. Verifica che il formato sia corretto.' 
            },
            { status: 400 }
          );
        }
      } catch (xmlError) {
        console.error('Error processing XML:', xmlError);
        return NextResponse.json(
          { 
            error: 'XML processing failed', 
            details: `Errore nell'elaborazione del file XML: ${xmlError instanceof Error ? xmlError.message : 'Errore sconosciuto'}` 
          },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { 
          error: 'Invalid file type', 
          details: 'Formato file non supportato. Carica un file PDF o XML della fattura elettronica.' 
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error in parse-invoice API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: `Errore interno del server: ${error instanceof Error ? error.message : 'Errore sconosciuto'}` 
      },
      { status: 500 }
    );
  }
}