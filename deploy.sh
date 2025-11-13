#!/bin/bash

# Script di deploy per Petrolis WebApp
# Trasferisce i file aggiornati e riavvia il container Docker

PROJECT="tidal-glider-465915-e6"
ZONE="europe-west4-b"
INSTANCE="webapp"
REMOTE_DIR="pgr"

echo "📦 Preparazione archivio per il deploy..."

# Pulisci file metadata macOS localmente
echo "🧹 Pulizia file metadata macOS..."
find . -type f -name '._*' -delete 2>/dev/null || true
find . -type f -name '.DS_Store' -delete 2>/dev/null || true

# Crea un archivio tar escludendo file non necessari
tar czf /tmp/petrolis-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='petrolis-app' \
  --exclude='python-services' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='._*' \
  --exclude='deploy.sh' \
  .

echo "✅ Archivio creato!"
echo ""
echo "📤 Trasferimento archivio al server..."

# Trasferisci l'archivio
gcloud compute scp --zone "$ZONE" --project "$PROJECT" \
  /tmp/petrolis-deploy.tar.gz \
  "$INSTANCE:~/"

echo "✅ Archivio trasferito!"
echo ""
echo "📦 Estrazione archivio sul server..."

# Estrai l'archivio sul server
gcloud compute ssh --zone "$ZONE" "$INSTANCE" --project "$PROJECT" << 'EOFEXTRACT'
mkdir -p ~/pgr
cd ~/pgr
tar xzf ~/petrolis-deploy.tar.gz
rm ~/petrolis-deploy.tar.gz
EOFEXTRACT

# Rimuovi l'archivio locale
rm /tmp/petrolis-deploy.tar.gz

echo "✅ Estrazione completata!"
echo ""
echo "🔧 Ricostruzione e riavvio del container..."

# Esegui i comandi sul server
gcloud compute ssh --zone "$ZONE" "$INSTANCE" --project "$PROJECT" << 'EOF'
cd ~/pgr

echo "🧹 Pulizia file metadata sul server..."
find . -type f -name '._*' -delete 2>/dev/null || true
find . -type f -name '.DS_Store' -delete 2>/dev/null || true

echo "⏹️  Fermando il container esistente..."
docker stop petrolis-container
docker rm petrolis-container

echo "🏗️  Ricostruendo l'immagine Docker..."
docker build -t petrolis-webapp .

echo "🚀 Avviando il nuovo container..."
docker run -d \
  --name petrolis-container \
  -p 3000:3000 \
  --env-file .env.local \
  --restart unless-stopped \
  petrolis-webapp

echo "✅ Deploy completato!"
echo "📊 Stato del container:"
docker ps | grep petrolis-container
EOF

echo "🎉 Deploy completato con successo!"

