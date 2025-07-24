import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  // Sostituire con le tue credenziali Firebase
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Configurazione separata per lo storage delle immagini
const imageStorageConfig = {
  apiKey: process.env.NEXT_PUBLIC_STORAGE_PUBLIC_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_STORAGE_PUBLIC_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_STORAGE_PUBLIC_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_STORAGE_PUBLIC_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_STORAGE_PUBLIC_APP_ID
};

const app = initializeApp(firebaseConfig);
const imageStorageApp = initializeApp(imageStorageConfig, 'imageStorage');

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const imageStorage = getStorage(imageStorageApp);
export default app; 