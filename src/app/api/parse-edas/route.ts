import { NextRequest, NextResponse } from 'next/server';
import { parseEdas } from '@/lib/documentParsers';
import { ParsedEDASData } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type');
    let base64Image: string;
    let mimeType: string;

    if (contentType?.includes('application/json')) {
      const { image, mimeType: requestMimeType } = await req.json();
      base64Image = image;
      mimeType = requestMimeType || 'image/jpeg';
    } else {
      const formData = await req.formData();
      const imageFile = formData.get('image') as File | null;
      if (!imageFile) {
        return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
      }
      const imageBuffer = await imageFile.arrayBuffer();
      base64Image = Buffer.from(imageBuffer).toString('base64');
      mimeType = imageFile.type;
    }

    const parsedData: ParsedEDASData = await parseEdas(base64Image, mimeType);

    console.log('Parsed e-DAS Data:', parsedData);

    return NextResponse.json(parsedData);

  } catch (error) {
    console.error('Error in e-DAS parsing API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to parse e-DAS image', details: errorMessage }, { status: 500 });
  }
} 