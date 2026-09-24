#!/bin/bash

# Script per investigare e gestire processi sospetti sul server

SERVER_IP="37.27.13.50"
SERVER_USER="root"

if [ -z "$1" ]; then
  echo "Uso: $0 <PID> [azione]"
  echo ""
  echo "Azioni disponibili:"
  echo "  info    - Mostra informazioni dettagliate (default)"
  echo "  files   - Mostra file aperti dal processo"
  echo "  network - Mostra connessioni di rete"
  echo "  trace   - Traccia chiamate di sistema (richiede strace)"
  echo "  kill    - Termina il processo (ATTENZIONE!)"
  echo ""
  echo "Esempio: $0 1433 info"
  exit 1
fi

PID=$1
ACTION=${2:-info}

ssh ${SERVER_USER}@${SERVER_IP} << EOF
echo "🔍 INVESTIGAZIONE PROCESSO PID: $PID"
echo "=========================================="
echo ""

# Verifica che il processo esista
if [ ! -d "/proc/$PID" ]; then
  echo "❌ Processo $PID non trovato o già terminato"
  exit 1
fi

case "$ACTION" in
  info)
    echo "📋 INFORMAZIONI PROCESSO:"
    echo "--- Comando completo ---"
    cat /proc/$PID/cmdline 2>/dev/null | tr '\0' ' ' || ps -p $PID -o cmd= 2>/dev/null
    echo ""
    echo ""
    echo "--- Percorso eseguibile ---"
    readlink -f /proc/$PID/exe 2>/dev/null || echo "N/A"
    echo ""
    echo "--- Directory di lavoro ---"
    readlink -f /proc/$PID/cwd 2>/dev/null || echo "N/A"
    echo ""
    echo "--- Statistiche CPU/Memoria ---"
    ps -p $PID -o pid,user,%cpu,%mem,etime,cmd 2>/dev/null || echo "Processo non trovato"
    echo ""
    echo "--- Processo padre ---"
    PPID=\$(ps -p $PID -o ppid= 2>/dev/null | tr -d ' ')
    if [ -n "\$PPID" ]; then
      echo "PPID: \$PPID"
      ps -p \$PPID -o pid,user,cmd 2>/dev/null || echo "Processo padre non trovato"
    fi
    echo ""
    echo "--- Variabili d'ambiente ---"
    cat /proc/$PID/environ 2>/dev/null | tr '\0' '\n' | head -20 || echo "N/A"
    echo ""
    echo "--- Limiti risorse ---"
    cat /proc/$PID/limits 2>/dev/null || echo "N/A"
    ;;
    
  files)
    echo "📁 FILE APERTI DAL PROCESSO:"
    if command -v lsof >/dev/null 2>&1; then
      lsof -p $PID 2>/dev/null | head -50
    else
      echo "lsof non disponibile, uso /proc/$PID/fd:"
      ls -la /proc/$PID/fd 2>/dev/null | head -30
    fi
    ;;
    
  network)
    echo "🌐 CONNESSIONI DI RETE:"
    if command -v lsof >/dev/null 2>&1; then
      lsof -p $PID -i 2>/dev/null
    else
      netstat -tunap 2>/dev/null | grep " $PID/"
    fi
    ;;
    
  trace)
    echo "🔬 TRACCIAMENTO CHIAMATE DI SISTEMA (premi Ctrl+C per fermare):"
    if command -v strace >/dev/null 2>&1; then
      strace -p $PID 2>&1 | head -100
    else
      echo "strace non disponibile sul server"
    fi
    ;;
    
  kill)
    echo "⚠️  ATTENZIONE: Stai per terminare il processo $PID"
    echo "Comando: \$(cat /proc/$PID/cmdline 2>/dev/null | tr '\0' ' ')"
    echo ""
    read -p "Sei sicuro? (yes/no): " confirm
    if [ "\$confirm" = "yes" ]; then
      kill -TERM $PID 2>/dev/null && echo "✅ Segnale TERM inviato a $PID" || echo "❌ Errore nell'invio del segnale"
      sleep 2
      if [ -d "/proc/$PID" ]; then
        echo "⚠️  Processo ancora attivo, invio KILL..."
        kill -KILL $PID 2>/dev/null && echo "✅ Processo terminato" || echo "❌ Errore"
      else
        echo "✅ Processo terminato con successo"
      fi
    else
      echo "❌ Operazione annullata"
    fi
    ;;
    
  *)
    echo "❌ Azione non riconosciuta: $ACTION"
    echo "Usa: info, files, network, trace, kill"
    exit 1
    ;;
esac

echo ""
echo "=========================================="
EOF
