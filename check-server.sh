#!/bin/bash

# Script di controllo approfondito del server
# Verifica processi sospetti, risorse e possibili malware

SERVER_IP="37.27.13.50"
SERVER_USER="root"

echo "🔍 CONTROLLO APPROFONDITO DEL SERVER"
echo "=========================================="
echo ""

ssh ${SERVER_USER}@${SERVER_IP} << 'EOF'
echo "📊 INFORMAZIONI SISTEMA:"
echo "Hostname: $(hostname)"
echo "Uptime: $(uptime)"
echo "Data/Ora: $(date)"
echo ""

echo "💾 RISORSE SISTEMA:"
echo "--- Memoria ---"
free -h
echo ""
echo "--- Disco ---"
df -h
echo ""
echo "--- Load Average ---"
uptime | awk -F'load average:' '{print $2}'
echo ""

echo "🔥 TOP 15 PROCESSI PER CPU:"
echo "USER       PID    CPU%   MEM%   COMMAND"
ps aux --sort=-%cpu | head -16 | tail -15 | awk '{printf "%-10s %-6s %-6s %-6s %s\n", $1, $2, $3"%", $4"%", $11}'
echo ""

echo "🧠 TOP 15 PROCESSI PER MEMORIA:"
echo "USER       PID    CPU%   MEM%   COMMAND"
ps aux --sort=-%mem | head -16 | tail -15 | awk '{printf "%-10s %-6s %-6s %-6s %s\n", $1, $2, $3"%", $4"%", $11}'
echo ""

echo "⚠️  PROCESSI CON CONSUMO ELEVATO:"
echo "--- CPU > 30% (esclusi processi di sistema legittimi) ---"
# Escludi: ps, head, grep, awk, ssh, systemd (legittimi), next-server (app)
HIGH_CPU=$(ps aux --sort=-%cpu | awk 'NR>1 && $3>30 && $11 !~ /^(ps|head|grep|awk|ssh|systemd|next-server|docker-proxy|containerd)/ {printf "PID: %-6s CPU: %-6s MEM: %-6s USER: %-10s CMD: %s\n", $2, $3"%", $4"%", $1, $11}')
if [ -z "$HIGH_CPU" ]; then
  echo "✅ Nessun processo sospetto con CPU > 30%"
else
  echo "$HIGH_CPU"
  echo ""
  echo "🔍 DETTAGLI PROCESSI AD ALTO CONSUMO CPU:"
  ps aux --sort=-%cpu | awk 'NR>1 && $3>30 && $11 !~ /^(ps|head|grep|awk|ssh|systemd|next-server|docker-proxy|containerd)/ {print $2}' | while read pid; do
    if [ -n "$pid" ] && [ -d "/proc/$pid" ]; then
      echo "--- PID $pid ---"
      echo "Comando completo: $(cat /proc/$pid/cmdline 2>/dev/null | tr '\0' ' ' || ps -p $pid -o cmd= 2>/dev/null)"
      echo "Percorso eseguibile: $(readlink -f /proc/$pid/exe 2>/dev/null || echo 'N/A')"
      echo "Directory di lavoro: $(readlink -f /proc/$pid/cwd 2>/dev/null || echo 'N/A')"
      echo "Tempo di esecuzione: $(ps -p $pid -o etime= 2>/dev/null || echo 'N/A')"
      echo "Avviato da: $(ps -p $pid -o user= 2>/dev/null || echo 'N/A')"
      echo ""
    fi
  done
fi
echo ""

echo "--- Memoria > 10% ---"
HIGH_MEM=$(ps aux --sort=-%mem | awk 'NR>1 && $4>10 {printf "PID: %-6s CPU: %-6s MEM: %-6s USER: %-10s CMD: %s\n", $2, $3"%", $4"%", $1, $11}')
if [ -z "$HIGH_MEM" ]; then
  echo "✅ Nessun processo con memoria > 10%"
else
  echo "$HIGH_MEM"
fi
echo ""

echo "🕵️  RICERCA MALWARE/MINING:"
echo "--- Pattern comuni di mining ---"
MINING_PATTERNS="minerd|cpuminer|xmrig|stratum|mining|bitcoin|monero|cryptocurrency|\.miner|\.crypto|\.bitcoin|ccminer|nicehash"
MINING=$(ps aux | grep -iE "$MINING_PATTERNS" | grep -v grep)
if [ -z "$MINING" ]; then
  echo "✅ Nessun processo di mining trovato"
else
  echo "🚨 ATTENZIONE: Processi di mining trovati!"
  echo "$MINING"
fi
echo ""

echo "--- Processi da /tmp, /var/tmp, /dev/shm ---"
TMP_PROCS=$(ps aux | awk 'NR>1 {for(i=11;i<=NF;i++) if($i ~ /^\/tmp\/|^\/var\/tmp\/|^\/dev\/shm\//) {printf "PID: %-6s USER: %-10s CMD: %s\n", $2, $1, $11; break}}')
if [ -z "$TMP_PROCS" ]; then
  echo "✅ Nessun processo da percorsi temporanei sospetti"
else
  echo "⚠️  Processi trovati:"
  echo "$TMP_PROCS"
fi
echo ""

echo "--- Processi Python sospetti (esclusi processi di sistema e applicazioni note) ---"
# Escludi processi legittimi: unattended-upgrades, apt, update-manager, check-new-release, uvicorn (fastapi), applicazioni in /app
PYTHON_PROCS=$(ps aux | grep -E '/usr/bin/python3|python3|python' | grep -v grep | grep -v 'check-server\|deploy\|unattended-upgrade\|apt\|update-manager\|software-properties\|check-new-release\|ubuntu-release-upgrader\|uvicorn\|data_server\|telegram_bot\|main\.py')
if [ -z "$PYTHON_PROCS" ]; then
  echo "✅ Nessun processo Python sospetto trovato"
else
  echo "⚠️  Processi Python trovati (verificare se legittimi):"
  echo "$PYTHON_PROCS" | while read line; do
    PID=$(echo "$line" | awk '{print $2}')
    CPU=$(echo "$line" | awk '{print $3}')
    if [ -n "$PID" ] && [ -d "/proc/$PID" ]; then
      CMDLINE=$(cat /proc/$PID/cmdline 2>/dev/null | tr '\0' ' ' || echo "N/A")
      EXE=$(readlink -f /proc/$PID/exe 2>/dev/null || echo "N/A")
      CWD=$(readlink -f /proc/$PID/cwd 2>/dev/null || echo "N/A")
      echo "PID: $PID | CPU: ${CPU}% | MEM: $(echo "$line" | awk '{print $4}')%"
      echo "  Comando: $CMDLINE"
      echo "  Eseguibile: $EXE"
      echo "  Directory: $CWD"
      # Avviso se CPU > 30% (confronto numerico bash)
      CPU_INT=$(echo "$CPU" | cut -d. -f1)
      if [ "$CPU_INT" -gt 30 ] 2>/dev/null; then
        echo "  🚨 ATTENZIONE: CPU > 30% - investigare!"
      fi
      echo ""
    fi
  done
fi
echo ""

echo "--- Processi con nomi strani o nascosti (esclusi kernel e systemd) ---"
# Escludi processi kernel normali e processi systemd legittimi (sd-pam, etc.)
HIDDEN=$(ps aux | awk 'NR>1 && $11 ~ /^\[|^\(/ && $11 !~ /^\[k|^\[r|^\[m|^\[i|^\[j|^\[h|^\[s|^\[p|^\[e|^\[w|^\[c|^\[a|^\[o|^\(sd-pam|^\(udev-worker/ {printf "PID: %-6s USER: %-10s CMD: %s\n", $2, $1, $11}')
if [ -z "$HIDDEN" ]; then
  echo "✅ Nessun processo sospetto con nome nascosto"
else
  echo "⚠️  Processi con nomi strani (non kernel/systemd):"
  echo "$HIDDEN"
fi
echo ""

echo "🌐 CONNESSIONI DI RETE:"
echo "--- Connessioni ESTABLISHED (top 20) ---"
netstat -tunap 2>/dev/null | grep ESTABLISHED | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn | head -20
echo ""

echo "--- Connessioni LISTEN (porte in ascolto) ---"
netstat -tunlp 2>/dev/null | grep LISTEN | awk '{printf "%-10s %-20s %s\n", $1, $4, $7}'
echo ""

echo "🐳 DOCKER:"
echo "--- Container attivi ---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}" 2>/dev/null || echo "Docker non disponibile"
echo ""

echo "--- Statistiche Docker ---"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" 2>/dev/null || echo "Docker non disponibile"
echo ""

# Controlla container Docker ad alto consumo
echo "--- Container Docker ad alto consumo CPU (>50%) ---"
HIGH_DOCKER_CPU=$(docker stats --no-stream --format "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}" 2>/dev/null | awk -F'|' 'NR>1 {cpu=$2; gsub(/%/, "", cpu); if (cpu+0 > 50) print $1 "|" $2 "|" $3}')
if [ -z "$HIGH_DOCKER_CPU" ]; then
  echo "✅ Nessun container Docker con CPU > 50%"
else
  echo "⚠️  Container Docker ad alto consumo:"
  echo "$HIGH_DOCKER_CPU" | while IFS='|' read name cpu mem; do
    echo "  $name: $cpu CPU, $mem MEM"
    echo "  🔍 Investigare: docker logs --tail 50 $name"
    echo "  🔍 Riavviare: docker restart $name"
    echo "  🔍 Limiti: docker update --cpus=\"1.0\" $name (limitare CPU)"
    echo ""
  done
fi
echo ""

echo "📦 CRON JOBS:"
echo "--- Crontab di root ---"
crontab -l 2>/dev/null || echo "Nessun crontab per root"
echo ""

echo "--- Crontab di tutti gli utenti ---"
for user in $(cut -f1 -d: /etc/passwd); do
  crontab -u "$user" -l 2>/dev/null | grep -v "^#" | grep -v "^$" && echo "Utente: $user" || true
done
echo ""

echo "🔐 UTENTI CON SHELL:"
grep -E '/bin/(bash|sh|zsh)$' /etc/passwd | cut -d: -f1
echo ""

echo "📝 PROCESSI RECENTI (ultimi 10 minuti):"
ps -eo pid,user,comm,lstart,etime,pcpu,pmem --sort=-start_time | head -20
echo ""

echo "💡 RACCOMANDAZIONI:"
LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
LOAD_INT=$(echo $LOAD | cut -d. -f1)
if [ "$LOAD_INT" -gt 4 ]; then
  echo "🚨 Load average molto alto ($LOAD) - controllare processi CPU-intensive"
fi

MEM_USED=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
if [ "$MEM_USED" -gt 90 ]; then
  echo "🚨 Memoria utilizzata > 90% - controllare processi memory-intensive"
fi

DISK_USED=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USED" -gt 90 ]; then
  echo "🚨 CRITICO: Disco utilizzato > 90% ($DISK_USED%) - URGENTE: pulizia necessaria!"
  echo ""
  echo "   📊 Analisi spazio disco:"
  echo "   - docker system df (spazio utilizzato da Docker)"
  echo "   - du -sh /var/lib/docker/* | sort -h | tail -10 (directory Docker più grandi)"
  echo "   - du -sh /var/log/* | sort -h | tail -10 (log più grandi)"
  echo ""
  echo "   🧹 Azioni di pulizia (in ordine di sicurezza):"
  echo "   1. docker system prune -f (rimuove container/volumi non usati)"
  echo "   2. docker image prune -a -f (rimuove immagini non usate)"
  echo "   3. journalctl --vacuum-time=7d (pulizia log systemd - mantiene ultimi 7 giorni)"
  echo "   4. apt autoremove && apt autoclean (pulizia pacchetti)"
  echo "   5. find /var/log -type f -name '*.log' -mtime +30 -delete (rimuove log vecchi >30 giorni)"
  echo ""
  echo "   ⚠️  ATTENZIONE: docker system prune -a --volumes rimuove TUTTO (usare con cautela)"
fi

# Controlla processi zombie
ZOMBIES=$(ps aux | awk '$8 ~ /^Z/ {print $2}' | wc -l)
if [ "$ZOMBIES" -gt 0 ]; then
  echo "⚠️  Processi zombie trovati: $ZOMBIES"
  echo "   (Generalmente non critico, ma indica processi figli non raccolti)"
fi

# Controlla processi Python ad alto consumo (esclusi legittimi)
HIGH_PYTHON=$(ps aux | grep -E '/usr/bin/python3|python3' | grep -v grep | grep -v 'unattended-upgrade\|apt\|update-manager\|software-properties\|check-new-release\|ubuntu-release-upgrader' | awk '$3>30 {print $2}')
if [ -n "$HIGH_PYTHON" ]; then
  echo ""
  echo "🚨 ATTENZIONE: Processi Python sospetti con CPU > 30% trovati!"
  echo "   PIDs: $HIGH_PYTHON"
  echo "   Azione consigliata: Investigare questi processi con:"
  for pid in $HIGH_PYTHON; do
    echo "   - ./investigate-process.sh $pid info"
    echo "   - ./investigate-process.sh $pid files"
    echo "   - ./investigate-process.sh $pid network"
    echo "   - ./investigate-process.sh $pid kill (solo se confermato sospetto)"
  done
fi

echo ""
echo "=========================================="
echo "✅ Controllo completato"
echo "=========================================="
EOF
