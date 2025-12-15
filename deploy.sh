#!/bin/bash

# Script di deploy per Petrolis WebApp
# Deploy su Hetzner con Docker + Nginx reverse proxy

SERVER_IP="37.27.247.232"
SERVER_USER="root"
REMOTE_DIR="/opt/petrolis"
DOMAIN="api.petrolis.it"

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
echo "📤 Trasferimento archivio al server Hetzner..."

# Trasferisci l'archivio via SCP
scp /tmp/petrolis-deploy.tar.gz ${SERVER_USER}@${SERVER_IP}:/tmp/

echo "✅ Archivio trasferito!"
echo ""
echo "📦 Estrazione archivio sul server..."

# Estrai l'archivio sul server
ssh ${SERVER_USER}@${SERVER_IP} << 'EOFEXTRACT'
mkdir -p /opt/petrolis
cd /opt/petrolis
tar xzf /tmp/petrolis-deploy.tar.gz
rm /tmp/petrolis-deploy.tar.gz
EOFEXTRACT

# Rimuovi l'archivio locale
rm /tmp/petrolis-deploy.tar.gz

echo "✅ Estrazione completata!"
echo ""
echo "🔧 Ricostruzione e riavvio del container..."

# Esegui i comandi sul server
ssh ${SERVER_USER}@${SERVER_IP} << 'EOF'
cd /opt/petrolis

echo "🧹 Pulizia file metadata sul server..."
find . -type f -name '._*' -delete 2>/dev/null || true
find . -type f -name '.DS_Store' -delete 2>/dev/null || true

echo "⏹️  Fermando il container esistente..."
docker stop petrolis-container 2>/dev/null || true
docker rm petrolis-container 2>/dev/null || true

echo "🏗️  Ricostruendo l'immagine Docker..."
docker build -t petrolis-webapp .

echo "🚀 Avviando il nuovo container..."
docker run -d \
  --name petrolis-container \
  -p 127.0.0.1:3000:3000 \
  --env-file .env.local \
  --restart unless-stopped \
  petrolis-webapp

echo "✅ Deploy completato!"
echo "📊 Stato del container:"
docker ps | grep petrolis-container
EOF

echo "🎉 Deploy completato con successo!"
echo "🌐 Il sito sarà disponibile su https://api.petrolis.it"
