#!/usr/bin/env node
/**
 * Ripristina Firestore (database "(default)") dallo stato a un istante passato
 * usando il Point-in-time recovery (PITR, max 7 giorni indietro).
 *
 * Legge TUTTE le collezioni (e sottocollezioni) com'erano a --at e le riscrive
 * nel database attuale con set() (sovrascrive i documenti con lo stesso id).
 * Non cancella documenti creati dopo quell'istante (es. RANSOM_NOTE: va tolto a mano).
 *
 * Uso:
 *   node scripts/restore-firestore-pitr.js --at=2026-11-14T22:30:00Z           -> anteprima (conta i documenti)
 *   node scripts/restore-firestore-pitr.js --at=2026-11-14T22:30:00Z --apply   -> scrive
 *   --only=users,trips   limita alle collezioni indicate
 *
 * Credenziali: gcloud auth application-default login (oppure GOOGLE_APPLICATION_CREDENTIALS).
 */
const path = require('path');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldPath } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  })
);
if (!args.at) {
  console.error('Manca --at=YYYY-MM-DDTHH:MM:00Z');
  process.exit(1);
}
const AT = new Date(args.at);
if (AT.getUTCSeconds() || AT.getUTCMilliseconds()) {
  console.error('PITR accetta solo minuti interi (secondi = 00)');
  process.exit(1);
}
const APPLY = !!args.apply;
const ONLY = args.only ? String(args.only).split(',') : null;
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();
const readTime = Timestamp.fromDate(AT);

// Lettura a un istante passato tramite transazione read-only con readTime.
const readAt = (fn) => db.runTransaction(fn, { readOnly: true, readTime });

// listCollections() dell'SDK non supporta readTime: uso l'API REST listCollectionIds.
const { GoogleAuth } = require('google-auth-library');
const gauth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/datastore'] });
async function listCollectionIdsAt(docPath) {
  const client = await gauth.getClient();
  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const ids = [];
  let pageToken;
  do {
    const res = await client.request({
      url: `${base}${docPath ? '/' + docPath : ''}:listCollectionIds`,
      method: 'POST',
      headers: { 'x-goog-user-project': PROJECT_ID },
      data: { readTime: AT.toISOString(), pageSize: 300, pageToken },
    });
    ids.push(...(res.data.collectionIds || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return ids;
}

const counts = {};
let writer;
let written = 0;

async function copyCollection(colRef, label) {
  // Pagina per id documento per non tenere troppo in memoria.
  let last = null;
  for (;;) {
    let q = colRef.orderBy(FieldPath.documentId()).limit(300);
    if (last) q = q.startAfter(last);
    const snap = await readAt((tx) => tx.get(q));
    if (snap.empty) break;
    for (const d of snap.docs) {
      counts[label] = (counts[label] || 0) + 1;
      if (APPLY) {
        writer.set(d.ref, d.data());
        written++;
      }
    }
    // Sottocollezioni dei documenti letti (lento: una chiamata per documento; attivabile con --subcollections).
    if (args.subcollections) for (const d of snap.docs) {
      const subs = await listCollectionIdsAt(d.ref.path);
      for (const s of subs) await copyCollection(d.ref.collection(s), `${label}/*/${s}`);
    }
    last = snap.docs[snap.docs.length - 1].id;
    process.stdout.write(`\r  ${label}: ${counts[label]}   `);
    if (snap.size < 300) break;
  }
  process.stdout.write('\n');
}

async function main() {
  console.log(`Progetto ${PROJECT_ID} | stato al ${AT.toISOString()} | ${APPLY ? 'SCRITTURA' : 'ANTEPRIMA (usa --apply)'}`);
  if (APPLY) {
    writer = db.bulkWriter();
    writer.onWriteError((e) => {
      console.error(`\n  errore ${e.documentRef.path}: ${e.message}`);
      return e.failedAttempts < 5;
    });
  }
  let names = (await listCollectionIdsAt('')).filter((n) => n !== 'RANSOM_NOTE');
  if (ONLY) names = names.filter((n) => ONLY.includes(n));
  console.log('Collezioni:', names.join(', '));
  for (const n of names) await copyCollection(db.collection(n), n);
  if (APPLY) await writer.close();
  console.log('\nRiepilogo:', counts, APPLY ? `| scritti ${written}` : '');
}

main().catch((e) => {
  console.error('Errore:', e);
  process.exit(1);
});
