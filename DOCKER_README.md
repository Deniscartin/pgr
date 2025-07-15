# Docker Deployment Guide - Petrolis Webapp

Questa guida spiega come deployare la webapp Petrolis usando Docker.

## Prerequisiti

- Docker installato
- Docker Compose plugin installato
- File `.env.local` configurato con le variabili d'ambiente necessarie

## File di Configurazione

### Variabili d'ambiente richieste in `.env.local`:

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY=your-private-key

# Next.js
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

## Metodi di Deployment

### 1. Docker Compose (Consigliato)

```bash
# Avvia solo l'app Next.js
docker compose up -d

# Avvia con NGINX reverse proxy
docker compose --profile with-nginx up -d
```

### 2. Docker diretto

```bash
# Build dell'immagine
docker build -t petrolis-webapp .

# Run del container
docker run -d \
  --name petrolis-webapp \
  -p 3000:3000 \
  --env-file .env.local \
  --restart unless-stopped \
  petrolis-webapp
```

### 3. Script di gestione

Rendi eseguibile lo script:
```bash
chmod +x docker-scripts.sh
```

Comandi disponibili:
```bash
./docker-scripts.sh build              # Build immagine
./docker-scripts.sh compose-up         # Avvia con Docker Compose
./docker-scripts.sh compose-up-nginx   # Avvia con NGINX
./docker-scripts.sh logs               # Mostra logs
./docker-scripts.sh rebuild            # Rebuild e restart
./docker-scripts.sh health             # Check salute
./docker-scripts.sh clean              # Pulizia
```

## Configurazione NGINX (Opzionale)

Se usi il profilo `with-nginx`:

1. **Configura i certificati SSL:**
   ```bash
   mkdir ssl
   # Copia i tuoi certificati in ssl/fullchain.pem e ssl/privkey.pem
   ```

2. **Modifica `nginx.conf`:**
   - Cambia `server_name` con il tuo dominio
   - Aggiorna i percorsi dei certificati SSL se necessario

## Monitoraggio

### Controllo stato
```bash
docker compose ps
```

### Logs
```bash
docker compose logs -f petrolis-webapp
```

### Health check
```bash
curl http://localhost:3000/api/health
```

## Troubleshooting

### Problemi comuni:

1. **Errore `docker: 'compose' is not a docker command.`:**
   - Significa che il plugin Docker Compose non è installato.
   - Installalo con: `sudo apt-get update && sudo apt-get install docker-compose-plugin`

2. **Errore "File is not defined":**
   - Assicurati che il codice sia aggiornato con le modifiche per il supporto base64

3. **Errori di variabili d'ambiente:**
   - Verifica che `.env.local` sia presente e corretto
   - Controlla che tutte le variabili richieste siano impostate

4. **Problemi di connessione:**
   - Verifica che le porte non siano già in uso
   - Controlla i firewall

### Comandi utili:

```bash
# Rebuild completo
docker compose down
docker compose build --no-cache
docker compose up -d

# Pulizia completa
docker system prune -a
docker volume prune

# Accesso al container
docker exec -it petrolis-webapp_petrolis-webapp_1 /bin/sh
```

## Deployment in Produzione

### Con NGINX:
1. Configura i certificati SSL
2. Aggiorna `nginx.conf` con il tuo dominio
3. Avvia con: `docker compose --profile with-nginx up -d`

### Senza NGINX:
1. Avvia con: `docker compose up -d`
2. Configura un reverse proxy esterno (es. Cloudflare, AWS ALB)

## Aggiornamenti

Per aggiornare l'applicazione:

```bash
# Pull nuovo codice
git pull

# Rebuild e restart
./docker-scripts.sh rebuild
```

## Backup

I dati importanti sono:
- File `.env.local` (variabili d'ambiente)
- Certificati SSL nella cartella `ssl/`
- Eventuali volumi Docker persistenti

## Sicurezza

- Non esporre la porta 3000 direttamente in produzione
- Usa sempre HTTPS in produzione
- Mantieni aggiornate le immagini Docker
- Monitora i logs per attività sospette 