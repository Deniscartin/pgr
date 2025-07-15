# Configurazione Sistema Immagini

## Servizio di Storage Gratuito - ImgBB

Per abilitare il salvataggio delle immagini scansionate, è necessario configurare ImgBB (servizio gratuito):

### 1. Registrazione ImgBB
1. Vai su https://imgbb.com/
2. Registra un account gratuito
3. Vai su https://api.imgbb.com/
4. Ottieni la tua API key gratuita

### 2. Configurazione Variabili d'Ambiente
Aggiungi al tuo file `.env.local`:

```env
NEXT_PUBLIC_IMGBB_API_KEY=your_imgbb_api_key_here
```

### 3. Funzionalità Implementate

#### Rilevamento Bordi Automatico
- **Algoritmo Sobel**: Rileva automaticamente i bordi del documento
- **Cropping Intelligente**: Taglia l'immagine per mostrare solo il documento
- **Enhancement**: Migliora contrasto e luminosità per leggibilità

#### Salvataggio Doppio
- **Immagine Originale**: Salvata nel cloud storage
- **Immagine Processata**: Versione con bordi rilevati e miglioramenti
- **URLs nel Database**: Entrambe le URL vengono salvate nel trip

#### Visualizzazione
- **Anteprima Side-by-Side**: Mostra originale e processata
- **Conferma Salvataggio**: Indica quando l'upload è completato
- **Fallback Locale**: Se il cloud non funziona, usa storage locale

### 4. Limiti Servizio Gratuito ImgBB
- **Dimensione File**: Max 32MB per immagine
- **Bandwidth**: Illimitato
- **Storage**: Illimitato
- **API Calls**: 100 al minuto

### 5. Alternative Gratuite
Se ImgBB non dovesse funzionare, il sistema include:
- **Fallback Locale**: Usa blob URLs temporanei
- **Facilmente Sostituibile**: Cambia solo la funzione `uploadImageToCloud`

### 6. Sicurezza
- Le API keys sono solo client-side (NEXT_PUBLIC_)
- Le immagini sono pubbliche (come richiesto per il servizio gratuito)
- Non vengono salvate informazioni sensibili nelle immagini 