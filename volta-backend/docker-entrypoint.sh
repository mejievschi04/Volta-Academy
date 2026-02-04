#!/bin/sh
set -e

# Așteaptă PostgreSQL și rulează migrații (retry până la 30 secunde)
echo "Waiting for database and running migrations..."
for i in $(seq 1 15); do
  if php artisan migrate --force; then
    echo "Migrations completed."
    break
  fi
  echo "Database not ready, retrying in 2s... ($i/15)"
  sleep 2
done

# Optimizări Laravel
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Storage link (dacă nu există)
php artisan storage:link 2>/dev/null || true

exec "$@"
