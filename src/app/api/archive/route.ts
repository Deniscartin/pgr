import { NextRequest, NextResponse } from 'next/server';

const REMOTE_SERVER = 'http://192.168.77.34:8443';
const REMOTE_USER = 'admin';
const REMOTE_PASS = 'admin';

// API Proxy per bypassare CORS
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const path = searchParams.get('path');

  if (!action) {
    return NextResponse.json({ error: 'Missing action' }, { status: 400 });
  }

  const auth = Buffer.from(`${REMOTE_USER}:${REMOTE_PASS}`).toString('base64');

  try {
    if (action === 'list') {
      // Lista file
      if (!path) {
        return NextResponse.json({ error: 'Missing path' }, { status: 400 });
      }

      const response = await fetch(
        `${REMOTE_SERVER}/api/list?path=${encodeURIComponent(path)}`,
        {
          headers: {
            'Authorization': `Basic ${auth}`
          }
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json({ error: `Server error: ${response.status}`, detail: error }, { status: response.status });
      }

      const data = await response.json();
      return NextResponse.json(data);

    } else if (action === 'download') {
      // Download file
      if (!path) {
        return NextResponse.json({ error: 'Missing path' }, { status: 400 });
      }

      const response = await fetch(
        `${REMOTE_SERVER}/api/download?path=${encodeURIComponent(path)}`,
        {
          headers: {
            'Authorization': `Basic ${auth}`
          }
        }
      );

      if (!response.ok) {
        return NextResponse.json({ error: `Server error: ${response.status}` }, { status: response.status });
      }

      // Forward the file stream
      const blob = await response.blob();
      const headers = new Headers();
      headers.set('Content-Type', response.headers.get('Content-Type') || 'application/octet-stream');
      headers.set('Content-Disposition', response.headers.get('Content-Disposition') || 'attachment');

      return new NextResponse(blob, {
        status: 200,
        headers
      });

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Archive API error:', error);
    return NextResponse.json({ 
      error: 'Connection failed', 
      detail: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

