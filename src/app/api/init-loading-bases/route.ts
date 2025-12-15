import { NextResponse } from 'next/server';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const defaultBases = [
  { code: 'LT', name: 'Latina', fullName: '' },
  { code: 'RM', name: 'Roma', fullName: '' },
  { code: 'CH', name: 'Chieti', fullName: '' },
  { code: 'LI', name: 'Livorno', fullName: '' },
  { code: 'FR', name: 'Frosinone', fullName: '' },
];

export async function POST() {
  try {
    console.log('🔧 Inizializzazione basi di carico...');
    
    const docRef = doc(db, 'settings', 'loadingBases');
    await setDoc(docRef, { bases: defaultBases });
    
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

