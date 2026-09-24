#!/bin/bash

# Script di setup iniziale per server Oracle Cloud (OCI)
# Eseguire UNA SOLA VOLTA per configurare Docker, Nginx e SSL

set -euo pipefail

SERVER_IP="${SERVER_IP:-80.225.87.5}"
SSH_KEY="${SSH_KEY:-$HOME/Desktop/ssh-key-2026-08-27.key}"
DOMAIN="api.petrolis.it"
EMAIL="admin@petrolis.it"

if [ ! -f "$SSH_KEY" ]; then
  echo "❌ Chiave SSH non trovata: $SSH_KEY"
  echo "   Impostala con: SSH_KEY=/percorso/della/chiave ./setup-server.sh"
  exit 1
fi
chmod 600 "$SSH_KEY" 2>/dev/null || true

SSH_OPTS=(-i "$SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new)

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
    echo "   Forza l'utente con: SERVER_USER=opc ./setup-server.sh"
    exit 1
  fi
  echo "✅ Utente rilevato: ${SERVER_USER}"
fi

SSH_TARGET="${SERVER_USER}@${SERVER_IP}"

echo "🚀 Setup iniziale server Oracle Cloud per Petrolis..."
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
scp "${SSH_OPTS[@]}" /tmp/nginx-petrolis.conf "${SSH_TARGET}:/tmp/"

# Connessione al server e setup
ssh "${SSH_OPTS[@]}" "${SSH_TARGET}" 'bash -s' << 'EOFSETUP'
set -e

# Le immagini Oracle Linux usano dnf/yum, quelle Ubuntu apt.
if command -v apt-get &> /dev/null; then
    PKG=apt
elif command -v dnf &> /dev/null; then
    PKG=dnf
else
    PKG=yum
fi
echo "📦 Package manager rilevato: $PKG"

echo "📦 Aggiornamento sistema..."
if [ "$PKG" = "apt" ]; then
    sudo apt-get update && sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
else
    sudo $PKG update -y
fi

echo "🐳 Installazione Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker "$USER" || true
    echo "✅ Docker installato!"
else
    echo "✅ Docker già installato!"
fi

echo "🌐 Installazione Nginx e Certbot..."
if [ "$PKG" = "apt" ]; then
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx
else
    sudo $PKG install -y oracle-epel-release-el9 2>/dev/null || sudo $PKG install -y epel-release 2>/dev/null || true
    sudo $PKG install -y nginx certbot python3-certbot-nginx
fi

echo "📝 Configurazione Nginx..."
if [ -d /etc/nginx/sites-available ]; then
    # Layout Debian/Ubuntu
    sudo mv /tmp/nginx-petrolis.conf /etc/nginx/sites-available/api.petrolis.it
    sudo ln -sf /etc/nginx/sites-available/api.petrolis.it /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
else
    # Layout Oracle Linux / RHEL
    sudo mv /tmp/nginx-petrolis.conf /etc/nginx/conf.d/api.petrolis.it.conf
    # Disattiva il server di default che occupa la porta 80
    sudo sed -i '/^\s*server\s*{/,/^\s*}/ s/^/#/' /etc/nginx/nginx.conf 2>/dev/null || true
    # SELinux: consenti a nginx di fare proxy verso il container
    sudo setsebool -P httpd_can_network_connect 1 2>/dev/null || true
fi

# Test configurazione nginx
sudo nginx -t

# Riavvia nginx
sudo systemctl restart nginx
sudo systemctl enable nginx

echo "✅ Nginx configurato!"

# Crea directory applicazione
sudo mkdir -p /opt/petrolis
sudo chown "$USER":"$USER" /opt/petrolis

echo ""
echo "🔥 Configurazione firewall del sistema operativo..."
if command -v firewall-cmd &> /dev/null && sudo systemctl is-active --quiet firewalld; then
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --permanent --add-service=ssh
    sudo firewall-cmd --reload
else
    # Le immagini Oracle arrivano con iptables che blocca tutto tranne la 22:
    # inserisci le regole PRIMA della REJECT finale e rendile persistenti.
    sudo iptables -I INPUT 5 -p tcp --dport 80 -j ACCEPT
    sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
    if command -v netfilter-persistent &> /dev/null; then
        sudo netfilter-persistent save
    elif [ -f /etc/iptables/rules.v4 ]; then
        sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null
    else
        sudo iptables-save | sudo tee /etc/iptables.rules > /dev/null
    fi
fi

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
echo "0️⃣  Apri le porte nella Security List di OCI:"
echo "    Console Oracle → Networking → VCN → Subnet → Security List"
echo "    Ingress Rules: 0.0.0.0/0 TCP 80 e 0.0.0.0/0 TCP 443"
echo "    (senza questo passaggio il server resta irraggiungibile)"
echo ""
echo "1️⃣  Configura il DNS:"
echo "    Vai nel pannello del tuo registrar DNS e aggiungi:"
echo "    Record A: ${DOMAIN} → ${SERVER_IP}"
echo ""
echo "2️⃣  Dopo che il DNS si è propagato (5-30 minuti), esegui:"
echo "    ssh -i \"${SSH_KEY}\" ${SSH_TARGET} 'sudo certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --email ${EMAIL} --redirect'"
echo ""
echo "3️⃣  Poi esegui il deploy:"
echo "    ./deploy.sh"
echo ""
