# Configurazione Sistema Immagini

## Servizio di Storage - Google Cloud Storage via Firebase

Per abilitare il salvataggio delle immagini scansionate, viene utilizzato Google Cloud Storage tramite Firebase:

### 1. Configurazione Firebase
Il sistema utilizza Firebase Storage che è già configurato nel progetto. Le credenziali Firebase necessarie sono:

### 2. Configurazione Variabili d'Ambiente
Il sistema utilizza due configurazioni Firebase separate:

**Firebase principale** (per auth e database):
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_main_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_main_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_main_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_main_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_main_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_main_app_id
```

**Firebase dedicato alle immagini** (ambiente separato per storage):
```env
NEXT_PUBLIC_STORAGE_PUBLIC_API_KEY=your_storage_firebase_api_key
NEXT_PUBLIC_STORAGE_PUBLIC_AUTH_DOMAIN=your_storage_project.firebaseapp.com
NEXT_PUBLIC_STORAGE_PUBLIC_PROJECT_ID=your_storage_project_id
NEXT_PUBLIC_STORAGE_PUBLIC_BUCKET=your_storage_project.appspot.com
NEXT_PUBLIC_STORAGE_PUBLIC_MESSAGING_SENDER_ID=your_storage_sender_id
NEXT_PUBLIC_STORAGE_PUBLIC_APP_ID=your_storage_app_id
```

### 3. Funzionalità Implementate

#### Rilevamento Bordi Automatico
- **Algoritmo Sobel**: Rileva automaticamente i bordi del documento
- **Cropping Intelligente**: Taglia l'immagine per mostrare solo il documento
- **Enhancement**: Migliora contrasto e luminosità per leggibilità

#### Salvataggio su Google Cloud Storage
- **Immagine Processata**: Versione con bordi rilevati e miglioramenti salvata su Firebase Storage
- **URL Sicuri**: Gli URL sono generati automaticamente da Firebase con token di sicurezza
- **Organizzazione**: Le immagini sono salvate nella cartella `documents/` con timestamp

#### Visualizzazione
- **Anteprima Locale**: Preview immediato durante l'upload
- **Conferma Salvataggio**: Indica quando l'upload su Google Cloud è completato
- **Fallback Locale**: Se il cloud non funziona, usa storage locale temporaneo

### 4. Limiti Google Cloud Storage/Firebase
- **Dimensione File**: Max 32GB per file (molto più di quanto necessario)
- **Bandwidth**: Secondo il piano Firebase utilizzato
- **Storage**: Secondo il piano Firebase utilizzato
- **Velocità**: Upload/download ad alta velocità tramite CDN globale

### 5. Vantaggi Doppio Ambiente Firebase
- **Separazione**: Firebase principale per app, Firebase dedicato per immagini
- **Sicurezza**: Controllo accessi separato per immagini vs dati applicativi
- **Performance**: CDN globale per accesso veloce alle immagini
- **Scalabilità**: Ambienti separati permettono scaling indipendente
- **Affidabilità**: 99.999% di uptime garantito da Google

### 6. Sicurezza e Privacy
- **Controllo Accessi**: Le immagini sono private per default
- **Firebase Security Rules**: Controllo granulare su chi può accedere
- **Backup Automatico**: Ridondanza automatica dei dati
- **GDPR Compliant**: Rispetta le normative europee sulla privacy 