#!/bin/bash

echo "🚀 Avvio Petrolis WebApp con Docker..."
echo "   Tutte le credenziali sono già hardcodate nel container"
echo ""

# Ferma eventuali container esistenti
echo "🛑 Fermando container esistenti..."
docker compose down

echo ""
echo "🔨 Building e avvio del container..."
docker compose up -d --build

echo ""
echo "📋 Stato del container:"
docker compose ps

echo ""
echo "🌐 L'applicazione sarà disponibile su: http://localhost:3000"
echo ""
echo "📊 Per visualizzare i logs in tempo reale:"
echo "   docker compose logs -f"
echo ""
echo "🛑 Per fermare l'applicazione:"
echo "   docker compose down" 