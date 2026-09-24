#!/bin/bash

# Script di deploy per Petrolis WebApp
# Deploy su Oracle Cloud (OCI) con Docker + Nginx reverse proxy

set -euo pipefail

SERVER_IP="${SERVER_IP:-80.225.87.5}"
SSH_KEY="${SSH_KEY:-$HOME/Desktop/ssh-key-2026-08-27.key}"
REMOTE_DIR="/opt/petrolis"
DOMAIN="api.petrolis.it"

if [ ! -f "$SSH_KEY" ]; then
  echo "❌ Chiave SSH non trovata: $SSH_KEY"
  echo "   Impostala con: SSH_KEY=/percorso/della/chiave ./deploy.sh"
  exit 1
fi
chmod 600 "$SSH_KEY" 2>/dev/null || true

SSH_OPTS=(-i "$SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new)

# Le istanze Oracle non permettono il login diretto come root:
# individua l'utente di default dell'immagine (opc su Oracle Linux, ubuntu su Ubuntu).
if [ -n "${SERVER_USER:-}" ]; then
  echo "👤 Utente SSH: ${SERVER_USER}"
else
  echo "🔍 Rilevamento utente SSH sul server..."
  for candidate in opc ubuntu oracle root; do
    if ssh "${SSH_OPTS[@]}" -o BatchMode=yes -o ConnectTimeout=10 \
        "${candidate}@${SERVER_IP}" true 2>/dev/null; then
      SERVER_USER="$candidate"
      break
    fi
  done
  if [ -z "${SERVER_USER:-}" ]; then
    echo "❌ Impossibile connettersi a ${SERVER_IP} con la chiave fornita."
    echo "   Forza l'utente con: SERVER_USER=opc ./deploy.sh"
    exit 1
  fi
  echo "✅ Utente rilevato: ${SERVER_USER}"
fi

SSH_TARGET="${SERVER_USER}@${SERVER_IP}"

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
  --exclude='package-lock.json' \
  .

echo "✅ Archivio creato!"
echo ""
echo "📤 Trasferimento archivio al server Oracle (${SERVER_IP})..."

# Trasferisci l'archivio via SCP
scp "${SSH_OPTS[@]}" /tmp/petrolis-deploy.tar.gz "${SSH_TARGET}:/tmp/"

echo "✅ Archivio trasferito!"
echo ""
echo "📦 Estrazione archivio sul server..."

ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" 'bash -s' << 'EOFEXTRACT'
set -e
sudo mkdir -p /opt/petrolis
sudo chown "$USER":"$USER" /opt/petrolis
cd /opt/petrolis

# tar sovrascrive i file dell'archivio ma non rimuove quelli spariti dal
# progetto: senza questa pulizia un sorgente cancellato resta sul server e
# viene ricompilato al deploy successivo. Le tre cartelle arrivano sempre
# complete dall'archivio, quindi si possono azzerare.
# La radice invece non si tocca: contiene .env.local, che esiste solo qui.
rm -rf src public scripts

tar xzf /tmp/petrolis-deploy.tar.gz
rm /tmp/petrolis-deploy.tar.gz
EOFEXTRACT

# Rimuovi l'archivio locale
rm /tmp/petrolis-deploy.tar.gz

echo "✅ Estrazione completata!"
echo ""
echo "🔧 Ricostruzione e riavvio del container..."

ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" 'bash -s' << 'EOF'
set -e
cd /opt/petrolis

echo "🧹 Pulizia file metadata sul server..."
find . -type f -name '._*' -delete 2>/dev/null || true
find . -type f -name '.DS_Store' -delete 2>/dev/null || true

echo "⏹️  Fermando il container esistente..."
sudo docker stop petrolis-container 2>/dev/null || true
sudo docker rm petrolis-container 2>/dev/null || true

echo "🏗️  Ricostruendo l'immagine Docker..."
sudo docker build -t petrolis-webapp .

echo "🚀 Avviando il nuovo container..."
sudo docker run -d \
  --name petrolis-container \
  -p 127.0.0.1:3000:3000 \
  --env-file .env.local \
  --restart unless-stopped \
  petrolis-webapp

echo "✅ Deploy completato!"
echo "📊 Stato del container:"
sudo docker ps | grep petrolis-container
EOF

echo "🎉 Deploy completato con successo!"
echo "🌐 Il sito sarà disponibile su https://${DOMAIN}"
