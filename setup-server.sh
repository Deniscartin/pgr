#!/bin/bash

# Script di setup iniziale per server Hetzner
# Eseguire UNA SOLA VOLTA per configurare Docker, Nginx e SSL

SERVER_IP="37.27.247.232"
SERVER_USER="root"
DOMAIN="api.petrolis.it"
EMAIL="admin@petrolis.it"

echo "🚀 Setup iniziale server Hetzner per Petrolis..."
echo ""

# Prima crea il file di configurazione nginx localmente
cat > /tmp/nginx-petrolis.conf << 'NGINXCONF'
server {
    listen 80;
    listen [::]:80;
    server_name api.petrolis.it;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
    }
}
NGINXCONF

# Trasferisci config nginx
echo "📤 Trasferimento configurazione nginx..."
scp /tmp/nginx-petrolis.conf ${SERVER_USER}@${SERVER_IP}:/tmp/

# Connessione al server e setup
ssh ${SERVER_USER}@${SERVER_IP} << 'EOFSETUP'
set -e

echo "📦 Aggiornamento sistema..."
apt update && apt upgrade -y

echo "🐳 Installazione Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker installato!"
else
    echo "✅ Docker già installato!"
fi

echo "🌐 Installazione Nginx e Certbot..."
apt install -y nginx certbot python3-certbot-nginx

echo "📝 Configurazione Nginx..."
mv /tmp/nginx-petrolis.conf /etc/nginx/sites-available/api.petrolis.it

# Attiva il sito
ln -sf /etc/nginx/sites-available/api.petrolis.it /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# Test configurazione nginx
nginx -t

# Riavvia nginx
systemctl restart nginx
systemctl enable nginx

echo "✅ Nginx configurato!"

# Crea directory applicazione
mkdir -p /opt/petrolis

echo ""
echo "🔥 Configurazione firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable || true

echo ""
echo "✅ Setup base completato!"
EOFSETUP

# Cleanup locale
rm /tmp/nginx-petrolis.conf

echo ""
echo "=========================================="
echo "🎉 Setup server completato!"
echo "=========================================="
echo ""
echo "📋 PROSSIMI PASSI:"
echo ""
echo "1️⃣  Configura il DNS:"
echo "    Vai nel pannello del tuo registrar DNS e aggiungi:"
echo "    Record A: api.petrolis.it → ${SERVER_IP}"
echo ""
echo "2️⃣  Dopo che il DNS si è propagato (5-30 minuti), esegui:"
echo "    ssh ${SERVER_USER}@${SERVER_IP} 'certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --email ${EMAIL} --redirect'"
echo ""
echo "3️⃣  Poi esegui il deploy:"
echo "    ./deploy.sh"
echo ""
