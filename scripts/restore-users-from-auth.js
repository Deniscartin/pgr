#!/usr/bin/env node
/**
 * Ricrea i documenti users/{uid} in Firestore partendo dagli utenti presenti in
 * Firebase Authentication (serve dopo che la collezione "users" è stata cancellata).
 *
 * Credenziali (una delle due):
 *   - GOOGLE_APPLICATION_CREDENTIALS=percorso\chiave-service-account.json
 *     (Console Firebase > Impostazioni progetto > Account di servizio > Genera nuova chiave privata)
 *   - oppure: gcloud auth application-default login
 *
 * Uso:
 *   node scripts/restore-users-from-auth.js                 -> solo anteprima (dry run), non scrive nulla
 *   node scripts/restore-users-from-auth.js --apply         -> scrive i documenti mancanti
 *   opzioni:
 *     --default-role=autista   ruolo per chi non è nel file ruoli (default: autista)
 *     --roles=scripts/users-roles.json   file { "email": { "role": "admin", "name": "...", "carriers": ["..."] } }
 *     --overwrite              sovrascrive anche i documenti già esistenti (di default li salta)
 *
 * Salva sempre un backup degli utenti Auth in scripts/auth-users-backup-<data>.json
 */

const fs = require('fs');
const path = require('path');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldPath } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const VALID_ROLES = ['admin', 'autista', 'operatore', 'gestore_fatture'];

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  })
);

const APPLY = !!args.apply;
const OVERWRITE = !!args.overwrite;
const DEFAULT_ROLE = args['default-role'] || 'autista';
const ROLES_FILE = args.roles || path.join(__dirname, 'users-roles.json');
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!VALID_ROLES.includes(DEFAULT_ROLE)) {
  console.error(`Ruolo di default non valido: ${DEFAULT_ROLE}. Validi: ${VALID_ROLES.join(', ')}`);
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

function loadRoles() {
  if (!fs.existsSync(ROLES_FILE)) return {};
  const raw = JSON.parse(fs.readFileSync(ROLES_FILE, 'utf8'));
  const out = {};
  for (const [email, v] of Object.entries(raw)) out[email.toLowerCase()] = v;
  return out;
}

async function listAllAuthUsers() {
  const users = [];
  let pageToken;
  do {
    const res = await auth.listUsers(1000, pageToken);
    users.push(...res.users);
    pageToken = res.pageToken;
  } while (pageToken);
  return users;
}

async function main() {
  console.log(`Progetto: ${PROJECT_ID}  |  modalità: ${APPLY ? 'SCRITTURA' : 'ANTEPRIMA (usa --apply per scrivere)'}\n`);
  const roles = loadRoles();
  const authUsers = await listAllAuthUsers();

  const backupPath = path.join(__dirname, `auth-users-backup-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      authUsers.map((u) => ({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        disabled: u.disabled,
        creationTime: u.metadata.creationTime,
        lastSignInTime: u.metadata.lastSignInTime,
        customClaims: u.customClaims,
      })),
      null,
      2
    )
  );
  console.log(`Backup utenti Auth salvato in ${backupPath}`);
  console.log(`Utenti in Auth: ${authUsers.length}\n`);

  let created = 0, skipped = 0, defaulted = 0;
  const batchSize = 400;
  let batch = db.batch();
  let inBatch = 0;

  for (const u of authUsers) {
    const ref = db.collection('users').doc(u.uid);
    const snap = await ref.get();
    if (snap.exists && !OVERWRITE) {
      skipped++;
      continue;
    }

    const email = (u.email || '').toLowerCase();
    const mapped = roles[email] || {};
    const claimRole = u.customClaims && VALID_ROLES.includes(u.customClaims.role) ? u.customClaims.role : null;
    const role = mapped.role || claimRole || DEFAULT_ROLE;
    if (!mapped.role && !claimRole) defaulted++;
    if (!VALID_ROLES.includes(role)) {
      console.warn(`  ! ruolo non valido "${role}" per ${email}, salto`);
      continue;
    }

    const createdAt = new Date(u.metadata.creationTime);
    const data = {
      name: mapped.name || u.displayName || email.split('@')[0],
      email: u.email,
      role,
      createdAt,
      updatedAt: new Date(),
      restoredFromAuth: true,
    };
    if (Array.isArray(mapped.carriers) && mapped.carriers.length) data.carriers = mapped.carriers;

    console.log(
      `  ${snap.exists ? '~' : '+'} ${u.uid}  ${email.padEnd(35)} ${role.padEnd(16)} ${data.name}` +
        (u.disabled ? '  (DISABILITATO in Auth)' : '')
    );

    if (APPLY) {
      batch.set(ref, data, { merge: OVERWRITE });
      if (++inBatch >= batchSize) {
        await batch.commit();
        batch = db.batch();
        inBatch = 0;
      }
    }
    created++;
  }
  if (APPLY && inBatch) await batch.commit();

  console.log(
    `\n${APPLY ? 'Scritti' : 'Da scrivere'}: ${created}  |  già presenti (saltati): ${skipped}  |  con ruolo di default "${DEFAULT_ROLE}": ${defaulted}`
  );
  if (defaulted) {
    console.log(`Attenzione: assegna i ruoli corretti (es. gli admin) in ${ROLES_FILE} e rilancia con --overwrite, oppure modificali dalla console.`);
  }
}

main().catch((e) => {
  console.error('Errore:', e.message);
  process.exit(1);
});
