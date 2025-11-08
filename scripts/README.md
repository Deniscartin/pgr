# Script per Query dei Vettori Firebase

Questo script interroga Firebase Firestore per ottenere tutti i vettori registrati nel sistema Petrolis.

## Prerequisiti

1. **Variabili d'ambiente**: Assicurati che il file `.env.local` nella root del progetto contenga tutte le variabili Firebase necessarie:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

2. **Dipendenze**: Installa le dipendenze necessarie:
   ```bash
   npm install
   ```

## Utilizzo

### 1. Query completa di tutti i vettori
```bash
npm run query-carriers
```
oppure
```bash
node scripts/query-carriers.js
```

Questo comando:
- Mostra statistiche generali (totale utenti, utenti con vettori, vettori unici)
- Elenca tutti i vettori registrati con i dettagli degli utenti associati
- Fornisce statistiche avanzate (vettore più utilizzato, media utilizzi, distribuzione per ruolo)

### 2. Query filtrata per ruolo

Per vedere solo i vettori associati agli operatori:
```bash
npm run query-carriers -- --role operatore
```

Per vedere solo i vettori associati agli autisti:
```bash
npm run query-carriers -- --role autista
```

### 3. Esportazione in formato JSON

Per esportare tutti i dati in un file JSON:
```bash
npm run query-carriers -- --export carriers-export.json
```

Il file JSON conterrà:
- Data di esportazione
- Statistiche generali
- Lista completa dei vettori con dettagli di utilizzo
- Dettagli degli utenti associati ai vettori

## Output dello Script

### Esempio di Output Completo:
```
🔍 Interrogazione Firebase Firestore per tutti i vettori registrati...

📊 STATISTICHE GENERALI:
   Totale utenti: 15
   Utenti con vettori: 8
   Vettori unici trovati: 5

🚛 ELENCO VETTORI REGISTRATI:

================================================================================
1. Trasporti Rossi SRL
   Utilizzato da 3 utente/i (4 utilizzi totali):
   - Mario Rossi (mario.rossi@email.com) - Ruolo: operatore
   - Giuseppe Bianchi (giuseppe.bianchi@email.com) - Ruolo: autista
   - Anna Verdi (anna.verdi@email.com) - Ruolo: autista

2. Logistica Nord SpA
   Utilizzato da 2 utente/i (2 utilizzi totali):
   - Franco Neri (franco.neri@email.com) - Ruolo: operatore
   - Luca Gialli (luca.gialli@email.com) - Ruolo: autista

================================================================================

📈 STATISTICHE AVANZATE:
   Vettore più utilizzato: "Trasporti Rossi SRL" (4 utilizzi)
   Media utilizzi per vettore: 2.40

👥 DISTRIBUZIONE PER RUOLO:
   operatore: 3 associazioni
   autista: 5 associazioni

✅ Query completata con successo!
```

## Struttura dei Dati

Lo script interroga la collection `users` in Firebase Firestore e cerca:

1. **Campo `carriers`** (array): Lista di vettori associati all'utente
2. **Campo `carrier`** (stringa): Vettore singolo (campo legacy per compatibilità)

I vettori vengono estratti da utenti con ruoli:
- `operatore`: Operatori che gestiscono vettori
- `autista`: Autisti associati a specifici vettori

## Gestione Errori

Lo script include gestione completa degli errori con:
- Messaggi di errore dettagliati
- Suggerimenti per la risoluzione dei problemi
- Verifica delle credenziali Firebase
- Controllo dei permessi di accesso

## File Generati

### carriers-export.json
Quando si usa l'opzione `--export`, viene generato un file JSON con struttura:
```json
{
  "exportDate": "2024-01-15T10:30:00.000Z",
  "totalUsers": 15,
  "usersWithCarriers": 8,
  "uniqueCarriers": [
    {
      "name": "Trasporti Rossi SRL",
      "usageCount": 4,
      "usedBy": [
        {
          "userId": "user123",
          "userName": "Mario Rossi",
          "userEmail": "mario.rossi@email.com",
          "userRole": "operatore"
        }
      ]
    }
  ],
  "userDetails": [...]
}
```

## Risoluzione Problemi

### Errore: "Firebase configuration missing"
- Verifica che il file `.env.local` esista e contenga tutte le variabili necessarie
- Controlla che le variabili abbiano il prefisso `NEXT_PUBLIC_`

### Errore: "Permission denied"
- Verifica i permessi di lettura per la collection `users` in Firebase Console
- Assicurati che le regole di sicurezza Firestore permettano la lettura

### Errore: "Network error"
- Controlla la connessione internet
- Verifica che il progetto Firebase sia attivo e accessibile

## Note Tecniche

- Lo script supporta sia il campo `carrier` (legacy) che `carriers` (array) per massima compatibilità
- I vettori duplicati vengono automaticamente normalizzati (trim degli spazi)
- Le statistiche sono calcolate in tempo reale durante la scansione dei documenti
- L'export JSON è ottimizzato per l'importazione in altri sistemi
