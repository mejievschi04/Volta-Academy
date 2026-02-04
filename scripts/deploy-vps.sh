#!/bin/bash
# Script de deploy Volta Academy pe VPS (Linux)
# Folosire: ./scripts/deploy-vps.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "🚀 Volta Academy - Deploy pe VPS"
echo "================================"

# Verifică .env
if [ ! -f .env ]; then
    echo "❌ Fișier .env lipsește. Copiază .env.example și completează:"
    echo "   cp .env.example .env"
    echo "   nano .env"
    exit 1
fi

# Pull latest (dacă e repo git)
if [ -d .git ]; then
    echo "📥 Pull latest changes..."
    git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || true
fi

# Verifică Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker nu e instalat. Instalează: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

# Build și up (folosește override pentru producție)
echo "🔨 Build containere (fără cache)..."
$COMPOSE_CMD build --no-cache

echo "▶️  Pornire servicii (force recreate)..."
$COMPOSE_CMD up -d --force-recreate

# Așteaptă backend
echo "⏳ Așteptăm backend..."
sleep 5

# Verifică migrații
echo "🗄️  Verificare migrații..."
$COMPOSE_CMD exec -T backend php artisan migrate --force 2>/dev/null || true

# Cache Laravel
echo "⚡ Optimizare Laravel..."
$COMPOSE_CMD exec -T backend php artisan config:cache 2>/dev/null || true
$COMPOSE_CMD exec -T backend php artisan route:cache 2>/dev/null || true
$COMPOSE_CMD exec -T backend php artisan view:cache 2>/dev/null || true

echo ""
echo "✅ Deploy finalizat!"
echo ""
echo "Servicii:"
$COMPOSE_CMD ps
echo ""
echo "Frontend: http://localhost:3000 (sau domeniul tău)"
echo "Backend:  http://localhost:8000 (sau api.domeniul-tau)"
echo ""
echo "Logs: $COMPOSE_CMD logs -f"
