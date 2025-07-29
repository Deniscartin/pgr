# Google Cloud Document AI Setup Guide

Il parser della nota di carico è stato sostituito da OpenAI con **Google Cloud Document AI** per una maggiore accuratezza e affidabilità.

## ✅ Configurazione Completata

Il processore Document AI è già configurato e funzionante con i seguenti dettagli:

### Processore Configurato
- **Nome**: petrolisNDC  
- **ID**: d9befe118d921091
- **Tipo**: Custom Extractor
- **Regione**: eu (Europa)
- **Project ID**: tidal-glider-465915-e6
- **Service Account**: petrolisocr@tidal-glider-465915-e6.iam.gserviceaccount.com
- **Stato**: Abilitato
- **Endpoint**: https://eu-documentai.googleapis.com/v1/projects/tidal-glider-465915-e6/locations/eu/processors/d9befe118d921091:process

### Configurazione nel Codice
Il sistema usa il **file JSON delle credenziali** (`tidal-glider-465915-e6-268f0f0d8303.json`) posizionato nella root del progetto. Questo approccio è più sicuro rispetto alle credenziali hardcodate.

```typescript
// Path to service account key file (best practice per sicurezza)
const serviceAccountKeyPath = './tidal-glider-465915-e6-268f0f0d8303.json';

// Initialize Google Cloud Document AI client with EU endpoint and key file
const documentAIClient = new DocumentProcessorServiceClient({
  apiEndpoint: 'eu-documentai.googleapis.com',
  keyFilename: serviceAccountKeyPath
});
```

## Come Funziona

Il processore **Custom Extractor** utilizza AI generativa per:

1. **Analisi intelligente** della nota di carico
2. **Estrazione automatica** di campi chiave-valore
3. **Riconoscimento entità** (date, organizzazioni, persone, indirizzi)
4. **Mappatura precisa** sui campi richiesti:
   - Fornitore → `shipperName`
   - Destinazione → `consigneeName`  
   - Vettore → `carrierName`
   - Descrizione Commerciale/ADR → `productDescription`
   - LITRI → `volumeLiters`
   - KG → `netWeightKg`
   - Densità a 15 → `densityAt15C`
   - Densità Amb → `densityAtAmbientTemp`

## Console Logging

Durante il processamento vedrai log dettagliati:

```
🔍 Inizio parsing Loading Note con Google Cloud Document AI...
📋 Document AI Configuration:
   Processor Name: petrolisNDC
   Processor Type: Custom Extractor
   Project ID: tidal-glider-465915-e6
   Location: eu
   Processor ID: d9befe118d921091
   Service Account: petrolisocr@tidal-glider-465915-e6.iam.gserviceaccount.com

📄 RAW RESPONSE da Document AI (Loading Note)
🔍 CAMPI ESTRATTI (Form Fields)
🔍 ENTITÀ ESTRATTE (Entities)
✅ DATI PARSATI (Loading Note)
```

## Vantaggi di Document AI vs OpenAI

✅ **Specializzazione**: Ottimizzato per documenti strutturati italiani  
✅ **Accuratezza**: Migliore riconoscimento di forme e tabelle  
✅ **Costo**: Più economico per documenti di grandi dimensioni  
✅ **Velocità**: Processamento più rapido  
✅ **Privacy**: Dati processati in Europa (GDPR compliant)  
✅ **OCR avanzato**: Migliore gestione di documenti scansionati  
✅ **Custom Extractor**: AI generativa per comprensione del contesto

## ✅ Completamente Configurato e Pronto all'Uso

Il sistema è già **completamente configurato** con credenziali hardcodate. Non è necessaria alcuna configurazione aggiuntiva o setup di autenticazione!

### Cosa Accade Quando Carichi una Nota di Carico:

1. 🔐 **Autenticazione automatica** con service account hardcodato
2. 📤 **Invio dell'immagine** al processore petrolisNDC su Google Cloud
3. 🤖 **Document AI analizza** la nota con AI generativa
4. 📊 **Estrazione automatica** di tutti i campi strutturati
5. 🗺️ **Mappatura precisa** sui campi `ParsedLoadingNoteData`
6. 📝 **Console log dettagliati** mostrano ogni fase del processo

### Zero Configurazione Richiesta

- ✅ **Credenziali**: Hardcodate nel codice
- ✅ **Project ID**: `tidal-glider-465915-e6`
- ✅ **Processore**: `petrolisNDC` (Custom Extractor)
- ✅ **Service Account**: `petrolisocr@tidal-glider-465915-e6.iam.gserviceaccount.com`
- ✅ **Regione**: Europa (eu) per compliance GDPR

Il sistema è **pronto per essere usato immediatamente**! 🚀 