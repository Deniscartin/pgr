import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ParsedLoadingNoteData } from '@/lib/types';

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
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const mimeType = imageFile.type;

    const prompt = `
      You are an expert data extractor. Analyze the provided image, which is a "Nota di Carico" (loading note or bill of lading), and extract the information in JSON format.
      The JSON object must strictly follow this TypeScript interface:

      interface ParsedLoadingNoteData {
        documentNumber: string; // e.g., "NC-2025-00123"
        loadingDate: string; // e.g., "10/07/2025"
        carrierName: string; // e.g., "NewLogistic S.R.L."
        shipperName: string; // e.g., "DE LORENZO CARBURANTI S.R.L."
        consigneeName: string; // e.g., "D'URZO DOMENICO"
        productDescription: string; // e.g., "GASOLIO 10PPM AGRICOLO"
        grossWeightKg: number; // e.g., 8350
        netWeightKg: number; // e.g., 8200
        volumeLiters: number; // e.g., 10000
        notes: string; // Any additional notes or comments
      }

      Extract all fields accurately. If a field is not present, return an empty string "" for string types, 0 for number types, or null.
      The final output must be only the JSON object, without any other text or explanations.
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });
    
    const content = response.choices[0].message?.content;
    if (!content) {
      throw new Error('No content from OpenAI');
    }

    const parsedData: ParsedLoadingNoteData = JSON.parse(content);

    console.log('Parsed Loading Note Data:', parsedData);

    return NextResponse.json(parsedData);

  } catch (error) {
    console.error('Error in Loading Note parsing API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to parse Loading Note image', details: errorMessage }, { status: 500 });
  }
} 