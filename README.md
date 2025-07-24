# Petrolis Web App

Applicazione web per la gestione di ordini e viaggi per autisti di trasporti.

## Funzionalità

### Per gli Amministratori
- **Dashboard completa** con statistiche su ordini, viaggi e autisti
- **Gestione ordini** con due modalità:
  - **Inserimento manuale**: Creazione singola di ordini con tutti i dati
  - **Importazione PDF**: Parsing automatico di PDF gestionali esterni per creare multipli ordini
- **Gestione autisti**: Creazione di account autisti senza perdere la sessione admin
- **Assegnazione viaggi**: Assegnazione di ordini agli autisti
- **Monitoraggio in tempo reale** dello stato dei viaggi

### Per gli Autisti
- **Dashboard personalizzata** con i propri viaggi assegnati
- **Gestione viaggi** con cambio stato (assegnato → in corso → completato)
- **Scanner QR**: Scansione codici DAS con camera o inserimento manuale
- **Firma digitale**: Raccolta firme digitali per completare i viaggi
- **Visualizzazione dettagli** ordini e destinazioni

### Parsing PDF Automatico
L'applicazione supporta il parsing automatico di PDF gestionali esterni con il seguente formato:
- **Informazioni vettore**: Ragione sociale, partita IVA, indirizzo
- **Informazioni di carico**: Data, luogo, stato
- **Informazioni autista**: Nome, codice, targhe veicoli
- **Ordini multipli** con:
  - Numero ordine
  - Prodotto
  - Cliente e codice
  - Destinazione e codice
  - Quantità e unità di misura
  - Identificativo

## Struttura del Progetto

```
src/
├── app/                    # App Router di Next.js
│   ├── layout.tsx         # Layout principale
│   └── page.tsx           # Homepage con routing basato su ruolo
├── components/            # Componenti React
│   ├── AdminDashboard.tsx
│   ├── DriverDashboard.tsx
│   ├── CreateOrderModal.tsx    # Supporta inserimento manuale e PDF
│   ├── CreateDriverModal.tsx   # Creazione autisti senza logout
│   ├── AssignTripModal.tsx
│   ├── QRScannerModal.tsx
│   ├── SignatureModal.tsx
│   └── LoginForm.tsx
├── contexts/
│   └── AuthContext.tsx    # Autenticazione con Firebase
├── hooks/
│   └── useFirestore.ts    # Hooks per Firestore
├── lib/
│   ├── firebase.ts        # Configurazione Firebase
│   └── pdfParser.ts       # Utilità per parsing PDF
└── types/
    └── index.ts           # Tipi TypeScript
```

## Tecnologie Utilizzate

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Firebase** (Auth, Firestore, Storage)
- **PDF.js** (Parsing PDF)
- **React Hook Form** (Gestione form)
- **Zod** (Validazione)
- **Lucide React** (Icone)

## Setup

1. **Clona il repository**
   ```bash
   git clone <repository-url>
   cd petrolis-webapp
   ```

2. **Installa le dipendenze**
   ```bash
   npm install
   ```

3. **Configura Firebase**
   - Crea un progetto Firebase
   - Abilita Authentication (Email/Password)
   - Crea database Firestore
   - Abilita Storage per upload PDF
   - Copia le credenziali nel file `.env.local`:

   ```bash
   cp .env.local.example .env.local
   ```

   Compila le variabili:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Configura Firestore**
   Regole di sicurezza consigliate:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
         allow read: if request.auth != null && 
           get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
       }
       
       match /orders/{orderId} {
         allow read, write: if request.auth != null && 
           get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
         allow read: if request.auth != null;
       }
       
       match /trips/{tripId} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

5. **Crea il primo utente admin**
   - Registra un utente tramite Firebase Console
   - Aggiungi un documento in Firestore collection `users`:
   ```javascript
   {
     name: "Admin Name",
     role: "admin",
     email: "admin@example.com",
     createdAt: new Date(),
     updatedAt: new Date()
   }
   ```

6. **Avvia l'applicazione**
   ```bash
   npm run dev
   ```

## Utilizzo

### Amministratori
1. **Login** con credenziali admin
2. **Crea ordini** scegliendo tra:
   - Inserimento manuale dei dati
   - Caricamento PDF gestionale (parsing automatico)
3. **Crea autisti** dalla dashboard
4. **Assegna viaggi** collegando ordini ad autisti
5. **Monitora progressi** in tempo reale

### Autisti
1. **Login** con credenziali fornite dall'admin
2. **Visualizza viaggi assegnati**
3. **Avvia viaggio** quando si inizia il trasporto
4. **Scansiona codice DAS** alla destinazione
5. **Raccoglie firma digitale** dal cliente
6. **Completa viaggio**

## Parsing PDF

Il sistema supporta PDF con il seguente formato esempio:

```
di carico: POMEZIA Vettore: 10730181004 - ESSELLE, VIA DI MALAGROTTA, 00050, ROMA (RM), Italia
Data di carico: 27/06/2025 Partita IVA: 10730181004
Stato: In attesa esito

Autista e Mezzi
Autista: MONTELLANICO MARCO (IT U116V5717M) Tank container:
Targa motrice: FK521ZJ (M) Targa rimorchio:

Ordine: 3028825308-10
Prodotto: GASOLIO AUTO 10 PPM - USO COMBUSTIONE/CARBURAZIONE
Cliente: 1829439 - ENIMOOV S.P.A. cod=(1829439), VIALE GIORGIO RIBOTTA, 51, 00144, ROMA (RM), Italia
Destinazione: NCTR SOC.COOP. cod=(DE4984), VIA TENUTA DEL CAVALIERE 1, 00012, GUIDONIA (RM), Italia
Quantità: 3000 Litri (L) Quantità effettiva: Identificativo: 14114641005
```

## Risoluzione Problemi

### Problema: Logout automatico durante creazione autisti
- **Soluzione**: Utilizzata funzione `createUserAsAdmin` che preserva la sessione admin

### Problema: Parsing PDF non funziona
- **Soluzioni**:
  - Verifica che il PDF sia nel formato supportato
  - Controlla console per errori di parsing
  - Usa modalità inserimento manuale come fallback

### Problema: Errori di build
- **Soluzioni**:
  - Verifica che tutte le variabili d'ambiente siano configurate
  - Controlla che Firebase sia configurato correttamente
  - Esegui `npm install` per dependencies aggiornate

## Contributi

1. Fork del progetto
2. Crea feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit delle modifiche (`git commit -m 'Add some AmazingFeature'`)
4. Push del branch (`git push origin feature/AmazingFeature`)
5. Apri una Pull Request

## Licenza

Questo progetto è distribuito sotto licenza MIT. Vedi `LICENSE` per maggiori informazioni.
