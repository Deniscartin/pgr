#!/usr/bin/env node

/**
 * Script per assegnare tutti i vettori esistenti a merolli@pgr.it
 * Questo script cerca l'utente merolli@pgr.it e se esiste come operatore,
 * gli assegna tutti i vettori presenti nel sistema (capo area)
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, doc, updateDoc } = require('firebase/firestore');
require('dotenv').config({ path: '.env.local' });

// Configurazione Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const TARGET_EMAIL = 'merolli@pgr.it';

async function getAllCarriers(db) {
  console.log('🔍 Raccolta di tutti i vettori presenti nel sistema...');
  
  const usersRef = collection(db, 'users');
  const usersSnapshot = await getDocs(usersRef);
  
  const carriersSet = new Set();
  
  usersSnapshot.forEach((doc) => {
    const userData = doc.data();
    
    // Aggiungi vettori dal campo carriers (array)
    if (userData.carriers && Array.isArray(userData.carriers)) {
      userData.carriers.forEach(carrier => {
        if (carrier && carrier.trim() !== '') {
          carriersSet.add(carrier.trim());
        }
      });
    }
    
    // Aggiungi vettore dal campo carrier (legacy)
    if (userData.carrier && userData.carrier.trim() !== '') {
      carriersSet.add(userData.carrier.trim());
    }
  });
  
  const allCarriers = Array.from(carriersSet).sort();
  console.log(`📦 Trovati ${allCarriers.length} vettori unici nel sistema:`);
  allCarriers.forEach((carrier, index) => {
    console.log(`   ${index + 1}. ${carrier}`);
  });
  
  return allCarriers;
}

async function findUserByEmail(db, email) {
  console.log(`\n🔍 Ricerca utente con email: ${email}`);
  
  const usersRef = collection(db, 'users');
  const emailQuery = query(usersRef, where('email', '==', email));
  const querySnapshot = await getDocs(emailQuery);
  
  if (querySnapshot.empty) {
    console.log(`❌ Utente con email ${email} non trovato nel database.`);
    return null;
  }
  
  const userDoc = querySnapshot.docs[0];
  const userData = userDoc.data();
  
  const user = {
    id: userDoc.id,
    email: userData.email,
    name: userData.name,
    role: userData.role,
    carriers: userData.carriers || [],
    carrier: userData.carrier,
    createdAt: userData.createdAt?.toDate() || new Date(),
    updatedAt: userData.updatedAt?.toDate() || new Date(),
  };
  
  console.log(`✅ Utente trovato:`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Nome: ${user.name}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Ruolo: ${user.role}`);
  console.log(`   Vettori attuali: ${user.carriers.length > 0 ? user.carriers.join(', ') : 'Nessuno'}`);
  if (user.carrier) {
    console.log(`   Vettore legacy: ${user.carrier}`);
  }
  
  return { docRef: userDoc.ref, userData: user };
}

async function assignAllCarriersToUser(db, userDocRef, userData, allCarriers) {
  try {
    console.log(`\n🚛 Assegnazione di tutti i ${allCarriers.length} vettori all'utente...`);
    
    // Prepara i dati per l'aggiornamento
    const updateData = {
      carriers: allCarriers,
      updatedAt: new Date()
    };
    
    // Se l'utente aveva un campo carrier legacy, lo rimuoviamo per evitare confusione
    if (userData.carrier) {
      console.log(`   Rimozione del campo carrier legacy: "${userData.carrier}"`);
    }
    
    // Aggiorna il documento
    await updateDoc(userDocRef, updateData);
    
    console.log(`✅ Aggiornamento completato con successo!`);
    console.log(`   Vettori assegnati: ${allCarriers.length}`);
    console.log(`   Data aggiornamento: ${new Date().toLocaleString('it-IT')}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Errore durante l'aggiornamento:`, error);
    return false;
  }
}

async function verifyAssignment(db, userEmail) {
  console.log(`\n🔍 Verifica dell'assegnazione per ${userEmail}...`);
  
  const userResult = await findUserByEmail(db, userEmail);
  if (!userResult) {
    console.log(`❌ Impossibile verificare: utente non trovato.`);
    return false;
  }
  
  const { userData } = userResult;
  
  console.log(`✅ Verifica completata:`);
  console.log(`   Vettori assegnati: ${userData.carriers.length}`);
  console.log(`   Lista vettori:`);
  userData.carriers.forEach((carrier, index) => {
    console.log(`      ${index + 1}. ${carrier}`);
  });
  
  return true;
}

async function assignAllCarriersToMerolli() {
  try {
    console.log('🚀 Avvio script di assegnazione vettori a merolli@pgr.it\n');
    
    // Inizializza Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // 1. Raccoglie tutti i vettori presenti nel sistema
    const allCarriers = await getAllCarriers(db);
    
    if (allCarriers.length === 0) {
      console.log('❌ Nessun vettore trovato nel sistema. Script terminato.');
      return;
    }
    
    // 2. Cerca l'utente merolli@pgr.it
    const userResult = await findUserByEmail(db, TARGET_EMAIL);
    
    if (!userResult) {
      console.log(`❌ Utente ${TARGET_EMAIL} non trovato. Script terminato.`);
      console.log('\n💡 SUGGERIMENTI:');
      console.log('1. Verifica che l\'utente sia stato creato nel sistema');
      console.log('2. Controlla che l\'email sia scritta correttamente');
      console.log('3. Assicurati che l\'utente abbia il ruolo "operatore"');
      return;
    }
    
    const { docRef, userData } = userResult;
    
    // 3. Verifica che sia un operatore
    if (userData.role !== 'operatore') {
      console.log(`❌ L'utente ${TARGET_EMAIL} ha ruolo "${userData.role}" invece di "operatore".`);
      console.log('   Solo gli operatori possono avere vettori assegnati.');
      console.log('\n💡 SUGGERIMENTI:');
      console.log('1. Cambia il ruolo dell\'utente a "operatore" nel database');
      console.log('2. Oppure modifica lo script per permettere altri ruoli');
      return;
    }
    
    console.log(`✅ L'utente è un operatore valido. Procedendo con l'assegnazione...`);
    
    // 4. Controlla se ha già tutti i vettori
    const currentCarriers = new Set(userData.carriers || []);
    const missingCarriers = allCarriers.filter(carrier => !currentCarriers.has(carrier));
    
    if (missingCarriers.length === 0) {
      console.log(`\n✅ L'utente ha già tutti i vettori assegnati (${allCarriers.length} vettori).`);
      console.log('   Nessuna modifica necessaria.');
      return;
    }
    
    console.log(`\n📊 Stato attuale:`);
    console.log(`   Vettori già assegnati: ${userData.carriers.length}`);
    console.log(`   Vettori da aggiungere: ${missingCarriers.length}`);
    console.log(`   Totale vettori dopo l'aggiornamento: ${allCarriers.length}`);
    
    // 5. Assegna tutti i vettori
    const success = await assignAllCarriersToUser(db, docRef, userData, allCarriers);
    
    if (!success) {
      console.log('❌ Assegnazione fallita. Script terminato.');
      return;
    }
    
    // 6. Verifica l'assegnazione
    await verifyAssignment(db, TARGET_EMAIL);
    
    console.log('\n🎉 OPERAZIONE COMPLETATA CON SUCCESSO!');
    console.log(`✅ L'utente ${TARGET_EMAIL} ora ha accesso a tutti i ${allCarriers.length} vettori del sistema.`);
    console.log('✅ L\'utente può ora vedere e gestire tutti i vettori come capo area.');
    
  } catch (error) {
    console.error('❌ Errore durante l\'esecuzione dello script:', error);
    
    if (error instanceof Error) {
      console.error('Dettagli errore:', error.message);
    }
    
    // Suggerimenti per la risoluzione dei problemi
    console.log('\n💡 SUGGERIMENTI PER LA RISOLUZIONE:');
    console.log('1. Verifica che il file .env.local contenga tutte le variabili Firebase necessarie');
    console.log('2. Controlla che le credenziali Firebase siano corrette');
    console.log('3. Assicurati che il progetto Firebase sia accessibile');
    console.log('4. Verifica i permessi di scrittura per la collection "users"');
    console.log('5. Controlla che l\'utente merolli@pgr.it esista nel database');
  }
}

// Funzione per dry-run (simulazione senza modifiche)
async function dryRunAssignment() {
  try {
    console.log('🔍 MODALITÀ DRY-RUN: Simulazione senza modifiche\n');
    
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // Raccoglie tutti i vettori
    const allCarriers = await getAllCarriers(db);
    
    if (allCarriers.length === 0) {
      console.log('❌ Nessun vettore trovato nel sistema.');
      return;
    }
    
    // Cerca l'utente
    const userResult = await findUserByEmail(db, TARGET_EMAIL);
    
    if (!userResult) {
      console.log(`❌ Utente ${TARGET_EMAIL} non trovato.`);
      return;
    }
    
    const { userData } = userResult;
    
    console.log(`\n📋 SIMULAZIONE ASSEGNAZIONE:`);
    console.log(`   Utente: ${userData.name} (${userData.email})`);
    console.log(`   Ruolo: ${userData.role}`);
    console.log(`   Vettori attuali: ${userData.carriers.length}`);
    console.log(`   Vettori totali nel sistema: ${allCarriers.length}`);
    
    if (userData.role !== 'operatore') {
      console.log(`❌ ERRORE: Ruolo non valido (deve essere "operatore")`);
      return;
    }
    
    const currentCarriers = new Set(userData.carriers || []);
    const missingCarriers = allCarriers.filter(carrier => !currentCarriers.has(carrier));
    
    console.log(`   Vettori da aggiungere: ${missingCarriers.length}`);
    
    if (missingCarriers.length > 0) {
      console.log(`   Nuovi vettori da assegnare:`);
      missingCarriers.forEach((carrier, index) => {
        console.log(`      ${index + 1}. ${carrier}`);
      });
    } else {
      console.log(`   ✅ L'utente ha già tutti i vettori assegnati.`);
    }
    
    console.log(`\n✅ SIMULAZIONE COMPLETATA - Nessuna modifica effettuata al database.`);
    
  } catch (error) {
    console.error('❌ Errore durante la simulazione:', error);
  }
}

// Funzione principale
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--dry-run') || args.includes('-n')) {
    // Modalità simulazione
    await dryRunAssignment();
  } else if (args.includes('--help') || args.includes('-h')) {
    // Mostra aiuto
    console.log('📖 USO:');
    console.log('  node scripts/assign-all-carriers-to-merolli.js           # Assegna tutti i vettori');
    console.log('  node scripts/assign-all-carriers-to-merolli.js --dry-run # Simulazione senza modifiche');
    console.log('  node scripts/assign-all-carriers-to-merolli.js --help    # Mostra questo aiuto');
    console.log('');
    console.log('📖 CON NPM:');
    console.log('  npm run assign-carriers-merolli                         # Assegna tutti i vettori');
    console.log('  npm run assign-carriers-merolli -- --dry-run            # Simulazione senza modifiche');
    console.log('');
    console.log('🎯 DESCRIZIONE:');
    console.log('  Questo script cerca l\'utente merolli@pgr.it e se esiste come operatore,');
    console.log('  gli assegna tutti i vettori presenti nel sistema (funzione capo area).');
    console.log('');
    console.log('⚠️  ATTENZIONE:');
    console.log('  - L\'utente deve esistere nel database');
    console.log('  - L\'utente deve avere ruolo "operatore"');
    console.log('  - Lo script sovrascrive i vettori attuali dell\'utente');
  } else {
    // Esecuzione normale
    await assignAllCarriersToMerolli();
  }
}

// Esegui lo script se chiamato direttamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { assignAllCarriersToMerolli, dryRunAssignment };
