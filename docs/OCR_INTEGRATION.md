# Documentazione Integrazione OCR Locale

## Panoramica

Questa documentazione descrive l'integrazione del sistema OCR locale per l'estrazione automatica dei dati dai documenti DAS (Documento di Accompagnamento Semplificato) e Note di Consegna, sostituendo Google Document AI con una soluzione self-hosted basata su docTR.

---

## 1. Architettura del Sistema

### 1.1 Componenti

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Frontend      │      │   Next.js API   │      │   OCR Server    │
│   (React)       │─────▶│   Routes        │─────▶│   (Python)      │
│                 │      │                 │      │   Port 8000     │
└─────────────────┘      └─────────────────┘      └─────────────────┘
        │                        │                        │
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Firebase      │      │   Firestore     │      │   docTR Model   │
│   Storage       │      │   Database      │      │   (ResNet50+    │
│   (Immagini)    │      │   (Dati)        │      │    CRNN)        │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

### 1.2 Flusso dei Dati

1. **Upload Immagine** → L'utente carica foto del documento
2. **Storage** → Immagine salvata su Firebase Storage
3. **API Call** → Next.js chiama il server OCR locale
4. **OCR Processing** → docTR estrae il testo dall'immagine
5. **Data Extraction** → Regex e pattern matching estraggono i campi
6. **Response** → Dati strutturati ritornati al frontend
7. **Database** → Dati salvati in Firestore

---

## 2. Server OCR Locale

### 2.1 Posizione File

```
C:\Users\Denis\Desktop\ocr\
├── api_server.py        # Server Flask principale
├── ocr_doctr.py         # Logica OCR con GUI
├── scanner.html         # Interfaccia web mobile
└── requirements.txt     # Dipendenze Python
```

### 2.2 Configurazione Server (`api_server.py`)

```python
# URL di default
OCR_API_URL = 'http://192.168.77.75:8000'

# Endpoints disponibili
GET  /api/status        # Stato del server
POST /api/init          # Inizializza modello
POST /api/scan          # Scansiona documento
POST /api/scan/raw      # Scansiona con testo raw
GET  /api/consumption   # Statistiche consumo
POST /api/consumption/reset  # Reset sessione
```

### 2.3 Avvio Server

```bash
cd C:\Users\Denis\Desktop\ocr
python api_server.py
```

Il server si avvia su `http://0.0.0.0:8000` e inizializza automaticamente il modello docTR.

### 2.4 Modello OCR

- **Detection**: `db_resnet50` (Rilevamento testo)
- **Recognition**: `crnn_vgg16_bn` (Riconoscimento caratteri)
- **Framework**: PyTorch
- **Supporto**: Immagini orizzontali/verticali con auto-rotazione

---

## 3. API Routes Aggiornate

### 3.1 `/api/parse-image/route.ts`

**Scopo**: Parsing immagini per CreateOrderModal

**Prima** (Google Vision + OpenAI):
```typescript
// Usava Google Vision API per OCR
// Poi OpenAI GPT-4 per strutturare i dati
```

**Dopo** (OCR Locale):
```typescript
const OCR_API_URL = process.env.OCR_API_URL || 'http://192.168.77.75:8000';

// Chiama direttamente il server OCR locale
const ocrResponse = await fetch(`${OCR_API_URL}/api/scan`, {
  method: 'POST',
  body: formData,
});
```

### 3.2 `/api/process-trip-documents/route.ts`

**Scopo**: Processamento documenti per trip completati

**Funzione principale**:
```typescript
async function parseWithLocalOCR(imageUrl: string): Promise<ParsedLoadingNoteData | null>
```

**Flusso**:
1. Scarica immagine da Firebase Storage
2. Invia al server OCR locale
3. Mappa risposta a `ParsedLoadingNoteData`
4. Aggiorna Firestore con i dati estratti

### 3.3 `/api/parse-loading-note/route.ts`

**Scopo**: Parsing singola Nota di Carico

**Input**: Immagine (form-data o base64)
**Output**: `ParsedLoadingNoteData`

### 3.4 `/api/parse-edas/route.ts`

**Scopo**: Parsing singolo e-DAS

**Input**: Immagine (form-data o base64)
**Output**: `ParsedEDASData`

### 3.5 `/api/reprocess-trip-documents/route.ts`

**Scopo**: Ri-elaborazione documenti esistenti

**Uso**: Quando si vuole ri-processare un trip con il nuovo OCR

---

## 4. Mappatura Dati OCR → Strutture TypeScript

### 4.1 Risposta OCR Server

```json
{
  "status": "ok",
  "tipo": "DAS" | "NOTA",
  "dati": {
    "numero": "26173259498CH000252",
    "deposito": "ENI INDUSTRIAL EVOLUTION S.P.A.",
    "data": "15/01/2026",
    "cliente": "3J SRL",
    "destinazione": "CNSI SRL - IT10704071009",
    "prodotto": "GASOLIO AUTO 10PPM",
    "quantita_litri": 3000
  },
  "confidence": 85.5,
  "billing": { ... }
}
```

### 4.2 Mappatura a `ParsedLoadingNoteData`

```typescript
const parsedData: ParsedLoadingNoteData = {
  documentNumber: dati.numero,           // Numero DAS/Nota
  loadingDate: dati.data,                // Data documento
  carrierName: '',                       // Non estratto
  shipperName: dati.deposito,            // Deposito/Fornitore
  consigneeName: dati.cliente || dati.destinazione,  // Cliente
  productDescription: dati.prodotto,     // Prodotto
  grossWeightKg: 0,                      // RIMOSSO
  netWeightKg: 0,                        // RIMOSSO
  volumeLiters: dati.quantita_litri,     // Quantità in litri
  notes: `Tipo: ${tipo}`,
  depotLocation: dati.deposito,          // Deposito
  destinationName: dati.destinazione,    // Destinazione
  // CAMPI RIMOSSI:
  // densityAt15C: 0,
  // densityAtAmbientTemp: 0,
};
```

### 4.3 Mappatura a `ParsedEDASData`

```typescript
const parsedData: ParsedEDASData = {
  documentInfo: {
    dasNumber: dati.numero,
    invoiceDate: dati.data,
    // ... altri campi vuoti
  },
  senderInfo: {
    name: dati.deposito,
    // ...
  },
  recipientInfo: {
    name: dati.cliente || dati.destinazione,
    address: dati.destinazione,
    // ...
  },
  productInfo: {
    description: dati.prodotto,
    volumeAtAmbientTempL: dati.quantita_litri,
    volumeAt15CL: dati.quantita_litri,
    // CAMPI RIMOSSI:
    // netWeightKg: 0,
    // densityAtAmbientTemp: 0,
    // densityAt15C: 0,
  },
};
```

---

## 5. Componenti UI Aggiornati

### 5.1 Campi Rimossi

I seguenti campi sono stati rimossi da tutti i componenti:

| Campo | Motivo Rimozione |
|-------|------------------|
| `Densità a 15°` | Non necessario per il flusso operativo |
| `Densità Ambiente` | Non necessario per il flusso operativo |
| `Quantità in KG` | Non estratto dall'OCR locale |
| `Peso Netto` | Non estratto dall'OCR locale |
| `Peso Lordo` | Non estratto dall'OCR locale |

### 5.2 File Modificati

```
src/components/
├── TripDetailModal.tsx      # Rimossi 3 DetailItem (densità, KG)
├── AdminDashboard.tsx       # Rimossi 3 campi export Excel
├── OperatorDashboard.tsx    # Rimossi 3 campi export Excel
├── ManageOrderModal.tsx     # Rimossi Peso Netto/Lordo
├── EDASPreviewModal.tsx     # Rimossi Peso e Densità
└── PastTripsModal.tsx       # Rimossi Peso Netto
```

### 5.3 Esempio Modifica TripDetailModal

**Prima**:
```tsx
<DetailItem label="Densità a 15°" value={trip.loadingNoteData?.densityAt15C} />
<DetailItem label="Densità Ambiente" value={trip.loadingNoteData?.densityAtAmbientTemp} />
<DetailItem label="Quantità in KG" value={trip.loadingNoteData?.netWeightKg} />
```

**Dopo**:
```tsx
// Campi rimossi - non più visualizzati
```

---

## 6. Configurazione

### 6.1 Variabile d'Ambiente

Per cambiare l'URL del server OCR, impostare:

```env
# .env.local
OCR_API_URL=http://192.168.77.75:8000
```

### 6.2 Requisiti Server OCR

```txt
# requirements.txt
python-doctr[torch]
flask
flask-cors
Pillow
opencv-python-headless
```

### 6.3 Dipendenze Next.js

Nessuna nuova dipendenza richiesta. Le API usano `fetch` nativo.

---

## 7. Monitoraggio Consumi

### 7.1 Pricing

```python
# Basato su Google Document AI -30%
PRICE_PER_PAGE_USD = 0.00105  # $1.05 per 1000 pagine
PRICE_PER_PAGE_EUR = 0.00097  # €0.97 per 1000 pagine
```

### 7.2 Endpoint Statistiche

```bash
GET /api/consumption
```

**Risposta**:
```json
{
  "pricing": {
    "price_per_page_eur": 0.00097,
    "note": "Google Document AI -30%"
  },
  "session": {
    "scans": 5,
    "cost_eur": 0.00485
  },
  "all_time": {
    "scans": 150,
    "cost_eur": 0.1455
  }
}
```

---

## 8. Gestione Errori

### 8.1 Server OCR Non Disponibile

```typescript
try {
  const ocrResponse = await fetch(`${OCR_API_URL}/api/scan`, ...);
  if (!ocrResponse.ok) {
    throw new Error(`OCR API error: ${ocrResponse.status}`);
  }
} catch (error) {
  console.error('❌ Errore OCR locale:', error);
  return null; // Continua senza dati OCR
}
```

### 8.2 Immagine Non Scaricabile

Il sistema tenta prima `fetch` diretto, poi fallback su Firebase Storage SDK.

---

## 9. Tipi di Documento Supportati

### 9.1 DAS (e-DAS)

**Keywords rilevamento**:
- `e-das`, `das n`, `documento di accompagnamento`
- `deposito mittente`, `ADM`

**Campi estratti**:
- Numero DAS
- Deposito mittente
- Data
- Cliente/Destinatario
- Prodotto
- Quantità (litri)

### 9.2 Nota di Consegna

**Keywords rilevamento**:
- `nota di consegna`, `fornitore`
- `base sped`, `committente`

**Campi estratti**:
- Numero documento
- DAS riferimento
- Fornitore
- Data
- Cliente
- Destinazione
- Prodotto
- Quantità (litri)

---

## 10. Troubleshooting

### 10.1 Errore "Server OCR non raggiungibile"

1. Verificare che il server sia avviato: `python api_server.py`
2. Controllare il firewall per la porta 8000
3. Verificare l'IP in `OCR_API_URL`

### 10.2 OCR non riconosce il documento

1. Verificare qualità immagine (min 300 DPI consigliati)
2. Assicurarsi che il documento sia ben illuminato
3. Controllare che non sia troppo ruotato

### 10.3 Cliente vuoto

Il sistema usa fallback: `cliente || destinazione`

Se entrambi vuoti, verificare il pattern di estrazione nel server OCR.

---

## 11. Changelog

### v2.0.0 (15/01/2026)

**Breaking Changes**:
- Rimosso Google Document AI
- Rimossi campi densità e peso dalla UI

**Nuove Funzionalità**:
- Server OCR locale con docTR
- Auto-rotazione immagini
- Monitoraggio consumi
- Supporto DAS e Note di Consegna

**File Modificati**:
- `src/app/api/parse-image/route.ts`
- `src/app/api/process-trip-documents/route.ts`
- `src/app/api/parse-loading-note/route.ts`
- `src/app/api/parse-edas/route.ts`
- `src/app/api/reprocess-trip-documents/route.ts`
- `src/components/TripDetailModal.tsx`
- `src/components/AdminDashboard.tsx`
- `src/components/OperatorDashboard.tsx`
- `src/components/ManageOrderModal.tsx`
- `src/components/EDASPreviewModal.tsx`
- `src/components/PastTripsModal.tsx`

---

## 12. Riferimenti

- [docTR Documentation](https://mindee.github.io/doctr/)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Firebase Storage](https://firebase.google.com/docs/storage)

