#!/bin/bash
# Deployment script pentru Backend (Laravel)
# Folosește: ./deploy-backend.sh

set -e  # Oprește execuția la prima eroare

echo "🚀 Starting backend deployment..."

# Navighează la directorul backend
cd "$(dirname "$0")/volta-backend" || exit

# Pull latest changes (dacă folosești git)
if [ -d ".git" ]; then
    echo "📥 Pulling latest changes..."
    git pull origin main || git pull origin master
fi

# Instalează dependențe PHP
echo "📦 Installing PHP dependencies..."
composer install --no-dev --optimize-autoloader

# Instalează dependențe Node.js
echo "📦 Installing Node.js dependencies..."
npm install

# Build assets
echo "🔨 Building assets..."
npm run build

# Rulare migrații
echo "🗄️  Running migrations..."
php artisan migrate --force

# Cache optimizări
echo "⚡ Optimizing Laravel..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Clear old caches (opțional)
php artisan cache:clear

echo "✅ Backend deployment completed successfully!"
