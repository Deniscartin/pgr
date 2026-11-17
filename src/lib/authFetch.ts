import { auth } from '@/lib/firebase';

/** fetch verso le API interne con il token Firebase dell'utente loggato. */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
