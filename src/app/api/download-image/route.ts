import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    console.log('Server-side downloading image:', imageUrl);

    // Download image server-side (no CORS restrictions)
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Petrolis/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    // Convert to buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Convert to base64
    const base64 = buffer.toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Get image dimensions by creating a temporary image
    return NextResponse.json({
      success: true,
      dataUrl,
      mimeType,
      size: buffer.length
    });

  } catch (error) {
    console.error('Error downloading image:', error);
    return NextResponse.json(
      { error: 'Failed to download image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}