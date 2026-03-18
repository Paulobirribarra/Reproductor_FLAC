#!/bin/bash

# Script para lanzar Reproductor FLAC en desarrollo
# Ejecuta backend y frontend en paralelo con hot-reload

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Lanzando Reproductor FLAC (Backend + Frontend)..."
echo ""

# Backend
echo "Backend (Express)..."
cd "$PROJECT_ROOT/backend"
npm run dev &
BACKEND_PID=$!

# Frontend  
echo "Frontend (React + Vite)..."
cd "$PROJECT_ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Ambos servicios iniciados:"
echo "   Backend PID:  $BACKEND_PID (http://localhost:3000)"
echo "   Frontend PID: $FRONTEND_PID (http://localhost:5174)"
echo ""
echo "Presiona Ctrl+C para detener..."

# Mantener vivos los procesos y capturar Ctrl+C
wait $BACKEND_PID $FRONTEND_PID
