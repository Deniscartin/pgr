import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb, authorize } from '@/lib/firebaseAdmin';

const defaultBases = [
  { code: 'LT', name: 'Latina', fullName: '' },
  { code: 'RM', name: 'Roma', fullName: '' },
  { code: 'CH', name: 'Chieti', fullName: '' },
  { code: 'LI', name: 'Livorno', fullName: '' },
  { code: 'FR', name: 'Frosinone', fullName: '' },
];

export async function POST(request: Request) {
  const denied = await authorize(request, ['admin']);
  if (denied) return denied;

  try {
    console.log('🔧 Inizializzazione basi di carico...');
    
    const docRef = adminDb().collection('settings').doc('loadingBases');
    await docRef.set({ bases: defaultBases });
    
    console.log('✅ Basi di carico inizializzate con successo!');
    
    return NextResponse.json({
      success: true,
      message: 'Basi di carico inizializzate con successo',
      bases: defaultBases
    });
  } catch (error) {
    console.error('❌ Errore durante l\'inizializzazione:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore sconosciuto' 
      },
      { status: 500 }
    );
  }
}

