#!/usr/bin/env node

/**
 * Script per interrogare Firebase Firestore e ottenere tutti i vettori registrati
 * Questo script estrae i vettori da tutti gli utenti (operatori e autisti) nel database
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');
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

async function queryAllCarriers() {
  try {
    // Inizializza Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('🔍 Interrogazione Firebase Firestore per tutti i vettori registrati...\n');

    // Query per ottenere tutti gli utenti che hanno vettori associati
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    if (usersSnapshot.empty) {
      console.log('❌ Nessun utente trovato nel database.');
      return;
    }

    // Mappa per raccogliere tutti i vettori unici
    const carriersMap = new Map();
    let totalUsers = 0;
    let usersWithCarriers = 0;

    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      const user = {
        id: doc.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        carrier: userData.carrier,
        carriers: userData.carriers,
        createdAt: userData.createdAt?.toDate() || new Date(),
        updatedAt: userData.updatedAt?.toDate() || new Date(),
      };

      totalUsers++;

      // Estrai vettori dall'utente corrente
      const userCarriers = [];
      
      // Aggiungi vettori dal campo carriers (array)
      if (user.carriers && Array.isArray(user.carriers)) {
        userCarriers.push(...user.carriers.filter(c => c.trim() !== ''));
      }
      
      // Aggiungi vettore dal campo carrier (legacy)
      if (user.carrier && user.carrier.trim() !== '') {
        userCarriers.push(user.carrier);
      }

      // Se l'utente ha vettori, aggiornali nella mappa
      if (userCarriers.length > 0) {
        usersWithCarriers++;
        
        userCarriers.forEach(carrierName => {
          const normalizedCarrierName = carrierName.trim();
          
          if (!carriersMap.has(normalizedCarrierName)) {
            carriersMap.set(normalizedCarrierName, {
              name: normalizedCarrierName,
              usedByUsers: [],
              totalUsages: 0
            });
          }

          const carrierInfo = carriersMap.get(normalizedCarrierName);
          carrierInfo.usedByUsers.push({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          });
          carrierInfo.totalUsages++;
        });
      }
    });

    // Stampa i risultati
    console.log('📊 STATISTICHE GENERALI:');
    console.log(`   Totale utenti: ${totalUsers}`);
    console.log(`   Utenti con vettori: ${usersWithCarriers}`);
    console.log(`   Vettori unici trovati: ${carriersMap.size}\n`);

    if (carriersMap.size === 0) {
      console.log('❌ Nessun vettore trovato nel database.');
      return;
    }

    // Converti la mappa in array e ordina per nome
    const sortedCarriers = Array.from(carriersMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log('🚛 ELENCO VETTORI REGISTRATI:\n');
    console.log('='.repeat(80));

    sortedCarriers.forEach((carrier, index) => {
      console.log(`${index + 1}. ${carrier.name}`);
      console.log(`   Utilizzato da ${carrier.usedByUsers.length} utente/i (${carrier.totalUsages} utilizzi totali):`);
      
      carrier.usedByUsers.forEach(user => {
        console.log(`   - ${user.name} (${user.email}) - Ruolo: ${user.role}`);
      });
      
      console.log(''); // Riga vuota per separare i vettori
    });

    console.log('='.repeat(80));
    
    // Statistiche aggiuntive
    const mostUsedCarrier = sortedCarriers.reduce((prev, current) => 
      prev.totalUsages > current.totalUsages ? prev : current
    );
    
    console.log('\n📈 STATISTICHE AVANZATE:');
    console.log(`   Vettore più utilizzato: "${mostUsedCarrier.name}" (${mostUsedCarrier.totalUsages} utilizzi)`);
    
    const avgUsagePerCarrier = sortedCarriers.reduce((sum, carrier) => sum + carrier.totalUsages, 0) / sortedCarriers.length;
    console.log(`   Media utilizzi per vettore: ${avgUsagePerCarrier.toFixed(2)}`);

    // Raggruppa per ruolo
    const roleStats = new Map();
    sortedCarriers.forEach(carrier => {
      carrier.usedByUsers.forEach(user => {
        roleStats.set(user.role, (roleStats.get(user.role) || 0) + 1);
      });
    });

    console.log('\n👥 DISTRIBUZIONE PER RUOLO:');
    roleStats.forEach((count, role) => {
      console.log(`   ${role}: ${count} associazioni`);
    });

    console.log('\n✅ Query completata con successo!');

  } catch (error) {
    console.error('❌ Errore durante l\'interrogazione di Firebase:', error);
    
    if (error instanceof Error) {
      console.error('Dettagli errore:', error.message);
    }
    
    // Suggerimenti per la risoluzione dei problemi
    console.log('\n💡 SUGGERIMENTI PER LA RISOLUZIONE:');
    console.log('1. Verifica che il file .env.local contenga tutte le variabili Firebase necessarie');
    console.log('2. Controlla che le credenziali Firebase siano corrette');
    console.log('3. Assicurati che il progetto Firebase sia accessibile');
    console.log('4. Verifica i permessi di lettura per la collection "users"');
  }
}

// Funzione per query specifiche per ruolo
async function queryCarriersByRole(role) {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log(`🔍 Interrogazione vettori per ruolo: ${role}\n`);

    const usersRef = collection(db, 'users');
    const roleQuery = query(usersRef, where('role', '==', role));
    const querySnapshot = await getDocs(roleQuery);
    
    if (querySnapshot.empty) {
      console.log(`❌ Nessun utente con ruolo "${role}" trovato.`);
      return;
    }

    const carriers = new Set();
    const usersList = [];

    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      const userCarriers = [];
      
      if (userData.carriers && Array.isArray(userData.carriers)) {
        userCarriers.push(...userData.carriers.filter(c => c.trim() !== ''));
      }
      
      if (userData.carrier && userData.carrier.trim() !== '') {
        userCarriers.push(userData.carrier);
      }

      userCarriers.forEach(carrier => carriers.add(carrier.trim()));
      
      usersList.push({
        name: userData.name,
        email: userData.email,
        carriers: userCarriers
      });
    });

    console.log(`📊 Trovati ${querySnapshot.size} utenti con ruolo "${role}"`);
    console.log(`🚛 Vettori unici associati: ${carriers.size}\n`);

    console.log('VETTORI:');
    Array.from(carriers).sort().forEach((carrier, index) => {
      console.log(`${index + 1}. ${carrier}`);
    });

    console.log('\nUTENTI:');
    usersList.forEach(user => {
      console.log(`- ${user.name} (${user.email}): ${user.carriers.join(', ') || 'Nessun vettore'}`);
    });

  } catch (error) {
    console.error(`❌ Errore durante la query per ruolo "${role}":`, error);
  }
}

// Funzione per esportare i vettori in formato JSON
async function exportCarriersToJSON(outputFile = 'carriers-export.json') {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('📤 Esportazione vettori in formato JSON...\n');

    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    const carriersData = {
      exportDate: new Date().toISOString(),
      totalUsers: 0,
      usersWithCarriers: 0,
      uniqueCarriers: [],
      userDetails: []
    };

    const carriersMap = new Map();

    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      carriersData.totalUsers++;

      const userCarriers = [];
      
      if (userData.carriers && Array.isArray(userData.carriers)) {
        userCarriers.push(...userData.carriers.filter(c => c.trim() !== ''));
      }
      
      if (userData.carrier && userData.carrier.trim() !== '') {
        userCarriers.push(userData.carrier);
      }

      if (userCarriers.length > 0) {
        carriersData.usersWithCarriers++;
        
        userCarriers.forEach(carrier => {
          const normalizedCarrier = carrier.trim();
          if (!carriersMap.has(normalizedCarrier)) {
            carriersMap.set(normalizedCarrier, {
              name: normalizedCarrier,
              usageCount: 0,
              usedBy: []
            });
          }
          
          const carrierInfo = carriersMap.get(normalizedCarrier);
          carrierInfo.usageCount++;
          carrierInfo.usedBy.push({
            userId: doc.id,
            userName: userData.name,
            userEmail: userData.email,
            userRole: userData.role
          });
        });

        carriersData.userDetails.push({
          id: doc.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          carriers: userCarriers,
          createdAt: userData.createdAt?.toDate().toISOString() || null,
          updatedAt: userData.updatedAt?.toDate().toISOString() || null
        });
      }
    });

    carriersData.uniqueCarriers = Array.from(carriersMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    // Salva il file JSON
    const fs = require('fs');
    const path = require('path');
    
    const outputPath = path.join(process.cwd(), outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(carriersData, null, 2), 'utf8');
    
    console.log(`✅ Dati esportati con successo in: ${outputPath}`);
    console.log(`📊 Totale vettori unici: ${carriersData.uniqueCarriers.length}`);
    console.log(`👥 Utenti con vettori: ${carriersData.usersWithCarriers}/${carriersData.totalUsers}`);

  } catch (error) {
    console.error('❌ Errore durante l\'esportazione:', error);
  }
}

// Funzione principale
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Query completa di tutti i vettori
    await queryAllCarriers();
  } else if (args[0] === '--role' && (args[1] === 'operatore' || args[1] === 'autista')) {
    // Query filtrata per ruolo
    await queryCarriersByRole(args[1]);
  } else if (args[0] === '--export') {
    // Esporta in JSON
    const outputFile = args[1] || 'carriers-export.json';
    await exportCarriersToJSON(outputFile);
  } else {
    console.log('📖 USO:');
    console.log('  node scripts/query-carriers.js                           # Tutti i vettori');
    console.log('  node scripts/query-carriers.js --role operatore          # Solo operatori');
    console.log('  node scripts/query-carriers.js --role autista            # Solo autisti');
    console.log('  node scripts/query-carriers.js --export [filename.json]  # Esporta in JSON');
    console.log('');
    console.log('📖 CON NPM:');
    console.log('  npm run query-carriers                                    # Tutti i vettori');
    console.log('  npm run query-carriers -- --role operatore               # Solo operatori');
    console.log('  npm run query-carriers -- --role autista                 # Solo autisti');
    console.log('  npm run query-carriers -- --export carriers.json         # Esporta in JSON');
  }
}

// Esegui lo script se chiamato direttamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { queryAllCarriers, queryCarriersByRole, exportCarriersToJSON };
