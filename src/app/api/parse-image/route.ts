import { NextRequest, NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import OpenAI from 'openai';
import { ParsedPDFData } from '@/lib/types';

// Initialize Google Vision client for OCR
const vision = new ImageAnnotatorClient({
  // For authentication, set GOOGLE_APPLICATION_CREDENTIALS environment variable
  // or use other authentication methods as per Google Cloud documentation
});

// Initialize OpenAI client for structured parsing
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    const imageBuffer = await imageFile.arrayBuffer();
    const imageBytes = new Uint8Array(imageBuffer);

    // Step 1: Extract text using Google Vision API OCR
    const [result] = await vision.textDetection({
      image: {
        content: Buffer.from(imageBytes).toString('base64'),
      },
    });

    const detections = result.textAnnotations;
    if (!detections || detections.length === 0) {
      return NextResponse.json({ error: 'No text detected in image' }, { status: 400 });
    }

    // The first element contains the entire detected text
    const extractedText = detections[0].description || '';

    // Step 2: Use OpenAI to parse the extracted text into structured data
    const prompt = `
      You are an expert data extractor. I have extracted the following text from a shipping document using OCR. 
      Please analyze this text and extract the information in JSON format.
      The JSON object must strictly follow this TypeScript interface:

      interface ParsedPDFData {
        carrierInfo: {
          vettore: string;
          partitaIva: string;
          address: string;
        };
        loadingInfo: {
          dataCarico: string; // Date of loading
          luogoCarico: string; // Place of loading
          stato: string; // Status
        };
        driverInfo: {
          autista: string; // Driver name
          codiceAutista: string; // Driver code
          targaMotrice: string; // Truck plate
          targaRimorchio: string; // Trailer plate
          tankContainer: string;
        };
        bdcNumber: string; // BDC number
        orders: Array<{
          orderNumber: string;
          product: string;
          customerName: string;
          customerCode: string;
          deliveryAddress: string;
          destinationCode: string;
          quantity: number;
          quantityUnit: string;
          identifier: string;
        }>;
      }

      Extract all fields accurately from the OCR text below. If a field is not present, return an empty string "" for string types, 0 for number types, or an empty array [] for arrays.
      The final output must be only the JSON object, without any other text or explanations.

      OCR Text:
      ${extractedText}
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 2000,
    });
    
    const content = response.choices[0].message?.content;
    if (!content) {
      throw new Error('No content from OpenAI');
    }

    // OpenAI might wrap the JSON in ```json ... ```, so let's clean that up
    const jsonString = content.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsedData: ParsedPDFData = JSON.parse(jsonString);

    return NextResponse.json(parsedData);

  } catch (error) {
    console.error('Error in image parsing API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to parse image', details: errorMessage }, { status: 500 });
  }
} 