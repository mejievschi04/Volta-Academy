#!/bin/sh
set -e

echo "🚀 Starting Laravel application..."

# Așteaptă baza de date să fie gata (dacă e necesar)
if [ -n "$DB_HOST" ]; then
    echo "⏳ Waiting for database..."
    until php -r "
        try {
            \$pdo = new PDO('mysql:host=$DB_HOST;port=${DB_PORT:-3306}', '$DB_USERNAME', '$DB_PASSWORD');
            \$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            exit(0);
        } catch (PDOException \$e) {
            exit(1);
        }
    " 2>/dev/null; do
        echo "Database is unavailable - sleeping"
        sleep 2
    done
    echo "✅ Database is ready!"
fi

# Generează APP_KEY dacă nu există
if [ -z "$APP_KEY" ]; then
    echo "🔑 Generating application key..."
    php artisan key:generate --force
fi

# Rulează migrații
echo "🗄️  Running migrations..."
php artisan migrate --force || true

# Cache optimizări
echo "⚡ Optimizing Laravel..."
php artisan config:cache || true
php artisan route:cache || true
php artisan view:cache || true

# Creează storage link
php artisan storage:link || true

echo "✅ Application ready!"

exec "$@"
