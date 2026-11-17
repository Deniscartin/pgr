import { initializeApp, getApps, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';

// Credenziali lato server (ignorano le regole Firestore). In ordine:
//  1. FIREBASE_SERVICE_ACCOUNT = contenuto JSON della chiave service account (una riga)
//  2. GOOGLE_APPLICATION_CREDENTIALS = percorso del file JSON / credenziali di default
function getAdminApp(): App {
  const existing = getApps().find((a) => a.name === 'admin');
  if (existing) return existing;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  const credential = sa ? cert(JSON.parse(sa)) : applicationDefault();
  return initializeApp({ credential, projectId }, 'admin');
}

let dbInstance: Firestore | null = null;
export const adminDb = (): Firestore => {
  if (dbInstance) return dbInstance;
  const app = getAdminApp();
  dbInstance = getFirestore(app);
  // I campi undefined vengono ignorati invece di generare errore.
  dbInstance.settings({ ignoreUndefinedProperties: true });
  return dbInstance;
};
export const adminAuth = () => getAuth(getAdminApp());

export type ApiUser = { uid: string; role: 'admin' | 'operatore' | 'autista' | 'gestore_fatture' };
const ROLES = ['admin', 'operatore', 'autista', 'gestore_fatture'];

export class ApiAuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Verifica il token Firebase nell'header Authorization e che l'utente abbia un ruolo valido. */
export async function requireUser(req: Request, allowed?: ApiUser['role'][]): Promise<ApiUser> {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiAuthError('Non autenticato', 401);
  let uid: string;
  try {
    uid = (await adminAuth().verifyIdToken(token)).uid;
  } catch {
    throw new ApiAuthError('Token non valido', 401);
  }
  const snap = await adminDb().collection('users').doc(uid).get();
  const role = snap.get('role');
  if (!snap.exists || !ROLES.includes(role)) throw new ApiAuthError('Accesso negato', 403);
  if (allowed && !allowed.includes(role)) throw new ApiAuthError('Accesso negato', 403);
  return { uid, role };
}

/** Per le route API: restituisce una risposta 401/403 se l'utente non è autorizzato, altrimenti null. */
export async function authorize(req: Request, allowed?: ApiUser['role'][]): Promise<NextResponse | null> {
  try {
    await requireUser(req, allowed);
    return null;
  } catch (e) {
    if (e instanceof ApiAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
