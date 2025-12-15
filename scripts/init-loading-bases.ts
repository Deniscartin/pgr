/**
 * Script per inizializzare le basi di carico su Firestore
 * Esegui con: npx ts-node scripts/init-loading-bases.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Configurazione Firebase (usa le stesse variabili di ambiente)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const defaultBases = [
  { code: 'LT', name: 'Latina', fullName: '' },
  { code: 'RM', name: 'Roma', fullName: '' },
  { code: 'CH', name: 'Chieti', fullName: '' },
  { code: 'LI', name: 'Livorno', fullName: '' },
  { code: 'FR', name: 'Frosinone', fullName: '' },
];

async function initLoadingBases() {
  try {
    console.log('🔧 Inizializzazione basi di carico...');
    
    const docRef = doc(db, 'settings', 'loadingBases');
    await setDoc(docRef, { bases: defaultBases });
    
    console.log('✅ Basi di carico inizializzate con successo!');
    console.log('📋 Basi create:');
    defaultBases.forEach(base => {
      console.log(`   - ${base.code}: ${base.name}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Errore durante l\'inizializzazione:', error);
    process.exit(1);
  }
}

initLoadingBases();

