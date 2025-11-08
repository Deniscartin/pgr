# 📦 Archivio Server Remoto - Documentazione

## 🎯 Panoramica

La webapp ora include un sistema di archivio che si connette al server remoto `http://192.168.77.34:8443` per visualizzare, navigare e scaricare i file di backup.

---

## 🔗 Come Funziona

### Architettura

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Next.js App   │◄───────►│  Server Remoto   │◄───────►│  E:/Server/     │
│  (Firestore DB) │  HTTPS  │   (back.py)      │   FS    │  (File Backup)  │
└─────────────────┘         └──────────────────┘         └─────────────────┘
      Firebase                  192.168.77.34                 Local Disk
```

### Flusso Dati

1. **Caricamento Viaggio** (quando l'autista crea un viaggio):
   ```
   Autista → Scatta 3 foto → Upload Firebase Storage
   ↓
   Firebase: /trip-images/
   - edasImageUrl
   - loadingNoteImageUrl  
   - cartelloCounterImageUrl
   ↓
   Firestore DB: Trip document con 3 URLs
   ```

2. **Backup Automatico** (script sul server):
   ```
   FirebaseBackup.exe
   ↓
   Download da Firebase Storage
   ↓
   Salva in: E:/Server/trip-images/
   - Stessi nomi file
   - Struttura identica
   ```

3. **Visualizzazione Archivio** (dalla webapp):
   ```
   Admin → Click "Archivio Server"
   ↓
   ArchiveModal → API back.py
   ↓
   Lista file in E:/Server/
   ↓
   Navigazione / Download / Preview
   ```

---

## 🗂️ Struttura Dati

### Nel Database Firestore

Ogni `Trip` ha 3 immagini:

```typescript
interface Trip {
  id: string;
  driverId: string;
  // ... altri campi ...
  
  // LE 3 IMMAGINI DEL VIAGGIO
  edasImageUrl: string;              // Es: "https://...firebasestorage.../trip-images/1753941060938_edas.jpg"
  loadingNoteImageUrl: string;        // Es: "https://...firebasestorage.../trip-images/1753941060938_loading.jpg"
  cartelloCounterImageUrl: string;    // Es: "https://...firebasestorage.../trip-images/1753941060938_counter.jpg"
}
```

**Le 3 immagini appartengono allo stesso viaggio perché:**
- Condividono lo stesso timestamp prefix (es: `1753941060938`)
- Sono in `trip-images/` folder
- Sono referenziate nello stesso Trip document

### Sul Server di Backup

Struttura file in `E:/Server/`:

```
E:/Server/
├── documents/               ← Documenti generici (dalle altre cartelle Firebase)
│   ├── doc1.pdf
│   └── doc2.jpg
└── trip-images/            ← TUTTE le immagini dei viaggi (le 3 per viaggio)
    ├── 1753941060938_edas.jpg        ┐
    ├── 1753941060938_loading.jpg     ├─ Viaggio 1 (stesso timestamp)
    ├── 1753941060938_counter.jpg     ┘
    ├── 1753941078639_edas.jpg        ┐
    ├── 1753941078639_loading.jpg     ├─ Viaggio 2
    ├── 1753941078639_counter.jpg     ┘
    └── ...
```

---

## 🔌 API Server Remoto

Il server remoto (`back.py`) espone questi endpoint:

### 1. Lista File
```http
GET /api/list?path=E:/Server/trip-images
Authorization: Basic YWRtaW46YWRtaW4=

Response:
{
  "path": "E:/Server/trip-images",
  "items": [
    {
      "name": "1753941060938_edas.jpg",
      "is_dir": false,
      "size": 2458624
    },
    ...
  ]
}
```

### 2. Download File
```http
GET /api/download?path=E:/Server/trip-images/1753941060938_edas.jpg
Authorization: Basic YWRtaW46YWRtaW4=

Response: Binary file (image/jpeg)
```

### 3. Info Server
```http
GET /api/info
Authorization: Basic YWRtaW46YWRtaW4=

Response:
{
  "root_dir": "/",
  "port": 8443,
  "system_info": {
    "hostname": "server",
    "ip_address": "192.168.77.34"
  }
}
```

---

## 💻 Componenti Webapp

### 1. ArchiveModal.tsx

Componente principale per navigare l'archivio:

**Features:**
- 🗂️ Navigazione cartelle
- 🔍 Ricerca file
- 👁️ Preview immagini
- ⬇️ Download file
- 📊 Info file (dimensione, tipo)

**Props:**
```typescript
interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**Stati:**
```typescript
- currentPath: string      // Percorso corrente (es: "E:/Server/trip-images")
- files: ArchiveFile[]     // Lista file nella cartella corrente
- loading: boolean         // Caricamento in corso
- error: string | null     // Errore di connessione
- searchTerm: string       // Termine di ricerca
- selectedImage: string    // Immagine in preview
```

### 2. AdminDashboard.tsx

Aggiunto pulsante "Archivio Server":

```tsx
<button onClick={() => setShowArchive(true)}>
  <Archive className="w-4 h-4 mr-2" />
  Archivio Server
</button>

<ArchiveModal
  isOpen={showArchive}
  onClose={() => setShowArchive(false)}
/>
```

---

## 🔧 Configurazione

### File: `ArchiveModal.tsx`

```typescript
const REMOTE_SERVER = 'http://192.168.77.34:8443';
const REMOTE_USER = 'admin';
const REMOTE_PASS = 'admin';
```

**Per modificare:**
1. Cambia `REMOTE_SERVER` se l'IP del server cambia
2. Cambia credenziali se le modifichi sul server
3. Ricompila la webapp: `npm run build`

---

## 🔒 Sicurezza

### Autenticazione

Il server usa **Basic Authentication**:
```javascript
const auth = btoa(`${REMOTE_USER}:${REMOTE_PASS}`);
headers: {
  'Authorization': `Basic ${auth}`
}
```

**⚠️ IMPORTANTE:**
- Le credenziali sono in chiaro nel codice frontend
- Usare solo in rete locale sicura
- NON esporre il server su internet pubblico
- Considera HTTPS per produzione

### CORS

Il server back.py deve accettare richieste dalla webapp.

Verifica che `back.py` abbia CORS abilitato:
```python
from flask_cors import CORS
CORS(app)
```

---

## 📝 Uso dell'Archivio

### Dalla Dashboard Admin:

1. **Apri Archivio**
   - Click su "Archivio Server"
   - Si apre modal con connessione a 192.168.77.34:8443

2. **Naviga Cartelle**
   - Start: `E:/Server`
   - Click su `trip-images/` per vedere le immagini dei viaggi
   - Click su `documents/` per vedere documenti

3. **Cerca File**
   - Usa barra di ricerca
   - Filtra per nome file
   - Es: cerca "1753941060938" per trovare tutte le immagini di quel viaggio

4. **Visualizza Immagine**
   - Click "Visualizza" su un'immagine
   - Preview fullscreen
   - Click per chiudere

5. **Download File**
   - Click "Download" su qualsiasi file
   - File scaricato nel browser

---

## 🔄 Associazione Immagini → Viaggi

### Come trovare le 3 immagini di un viaggio:

**Dal Database Firestore:**
```typescript
const trip = await getTrip(tripId);

// Le 3 URLs sono nel trip document:
const urls = {
  edas: trip.edasImageUrl,           // EDAS doc
  loading: trip.loadingNoteImageUrl, // Loading note
  counter: trip.cartelloCounterImageUrl // Counter
};
```

**Dal Backup Server:**

1. Estrai timestamp dal nome file:
```typescript
// Da: "https://...trip-images/1753941060938_edas.jpg"
const timestamp = "1753941060938";
```

2. Cerca file con stesso timestamp nell'archivio:
```
E:/Server/trip-images/1753941060938_*.jpg
```

3. Troverai:
   - `1753941060938_edas.jpg`
   - `1753941060938_loading.jpg`
   - `1753941060938_counter.jpg`

### Script per Associare File a Viaggio

```typescript
function getTripImagesFromBackup(trip: Trip): string[] {
  // Estrai timestamp da una delle URL
  const url = trip.edasImageUrl;
  const filename = url.split('/').pop();
  const timestamp = filename?.split('_')[0];
  
  if (!timestamp) return [];
  
  // Le 3 immagini del viaggio
  return [
    `E:/Server/trip-images/${timestamp}_edas.jpg`,
    `E:/Server/trip-images/${timestamp}_loading.jpg`,
    `E:/Server/trip-images/${timestamp}_counter.jpg`
  ];
}
```

---

## 🐛 Troubleshooting

### ❌ "Errore di connessione"

**Causa**: Server remoto non raggiungibile

**Soluzioni**:
1. Verifica che il server sia acceso
2. Ping: `ping 192.168.77.34`
3. Verifica che back.py sia in esecuzione
4. Controlla firewall

### ❌ "Authentication required"

**Causa**: Credenziali errate

**Soluzioni**:
1. Verifica username/password in `ArchiveModal.tsx`
2. Verifica credenziali in `back.py`
3. Devono corrispondere (default: admin/admin)

### ❌ "Nessun file trovato"

**Causa**: Directory vuota o path errato

**Soluzioni**:
1. Verifica che il backup sia stato eseguito
2. Controlla path in `E:/Server/trip-images/`
3. Esegui `FirebaseBackup.exe` per scaricare file

### ❌ Immagini non si caricano in preview

**Causa**: CORS o autenticazione

**Soluzioni**:
1. Verifica CORS in back.py
2. Controlla che l'URL sia corretto
3. Verifica autenticazione nell'header

---

## 📊 Monitoring

### Verifica Backup Attivo

```bash
# Sul server remoto
cd E:/Server/trip-images
dir /b | find /c /v ""    # Conta file

# Ultima modifica
dir /od | more             # Ordina per data
```

### Spazio Disco

```powershell
# Su Windows
Get-ChildItem -Path "E:\Server" -Recurse | 
  Measure-Object -Property Length -Sum | 
  ForEach-Object { "{0:N2} GB" -f ($_.Sum / 1GB) }
```

---

## 🚀 Future Improvements

Possibili miglioramenti:

1. **Cache locale**: Cache delle liste file per performance
2. **Thumbnails**: Anteprime immagini nella griglia
3. **Batch download**: Download multiplo di file
4. **Upload**: Possibilità di caricare file sul server
5. **Delete**: Eliminazione file vecchi dall'archivio
6. **HTTPS**: Comunicazione criptata
7. **Token Auth**: JWT invece di Basic Auth
8. **Sync status**: Indicatore di stato backup/sync
9. **Search avanzata**: Ricerca per data, dimensione, tipo
10. **Viewer PDF**: Preview PDF direttamente nel browser

---

## ✅ Checklist Deployment

Prima di usare l'archivio:

- [ ] Server remoto acceso (192.168.77.34)
- [ ] back.py in esecuzione sulla porta 8443
- [ ] FirebaseBackup.exe eseguito almeno una volta
- [ ] File presenti in E:/Server/trip-images/
- [ ] CORS abilitato in back.py
- [ ] Rete locale funzionante
- [ ] Credenziali corrette (admin/admin)
- [ ] Webapp compilata e deployata

---

**✨ L'archivio è ora integrato e pronto all'uso!**

