#!/bin/bash

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_COMPOSE_FILE="/home/paulo/.docker/reproductor_flac/docker-compose.yml"

echo "Verificando servicios Docker..."

if [ -z "$(docker compose -f "$DOCKER_COMPOSE_FILE" ps -q --status running)" ]; then
    echo "No hay contenedores corriendo. Levantando Docker..."
    docker compose -f "$DOCKER_COMPOSE_FILE" up -d
else
    echo "Docker ya está en ejecución. Omitiendo 'up -d'."
fi

echo ""
echo "Lanzando Reproductor FLAC (Backend + Frontend)..."
echo ""

# Backend
cd "$PROJECT_ROOT/backend"
npm run dev &
BACKEND_PID=$!

# Frontend  
cd "$PROJECT_ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend PID:  $BACKEND_PID (http://localhost:3000)"
echo "Frontend PID: $FRONTEND_PID (http://localhost:5174)"
echo ""
echo "Ctrl+C para detener..."

trap "echo 'Deteniendo servicios...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT

wait $BACKEND_PID $FRONTEND_PID
