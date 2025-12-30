# Setup Instructions pentru Volta Academy Backend

## Pași de instalare după clone/pull din GitHub

### 1. Instalează dependențele
```bash
composer install
npm install
```

### 2. Configurează fișierul .env
```bash
# Copiază .env.example în .env (dacă există)
cp .env.example .env

# Sau creează manual .env cu următoarele setări minime:
APP_NAME="Volta Academy"
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000

DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite

SESSION_DRIVER=database
CACHE_STORE=database
```

### 3. Generează cheia aplicației
```bash
php artisan key:generate
```

### 4. Creează baza de date SQLite (dacă nu există)
```bash
# Windows PowerShell
New-Item -ItemType File -Path database/database.sqlite -Force

# Linux/Mac
touch database/database.sqlite
```

### 5. Rulează migrațiile
```bash
php artisan migrate
```

### 6. Populează baza de date cu date de test
```bash
php artisan db:seed
```

### 7. Creează utilizator de test (opțional)
```bash
php artisan app:create-test-user
```

## Credențiale de test

După rularea seeder-ului, poți folosi:

**Admin:**
- Email: `admin@volta.academy`
- Password: `volta 2025`

**Utilizator de test:**
- Email: `test@example.com`
- Password: `password123`

## Verificare setup

### Verifică migrațiile
```bash
php artisan migrate:status
```

### Verifică baza de date
```bash
php artisan db:show
```

### Verifică utilizatori
```bash
php artisan tinker
>>> App\Models\User::count()
```

## Probleme comune

### Eroare: "no such table: sessions"
```bash
php artisan migrate
```

### Eroare: "no such table: cache"
```bash
php artisan cache:table
php artisan migrate
```

### Eroare: "Class not found"
```bash
composer dump-autoload
php artisan config:clear
php artisan cache:clear
```

## Fișiere importante care NU trebuie să fie în Git

- `.env` (conține configurații sensibile)
- `database/database.sqlite` (baza de date locală)
- `vendor/` (dependențe Composer)
- `node_modules/` (dependențe NPM)
- `storage/logs/*.log` (log-uri)

## Note

- Baza de date SQLite este locală și nu trebuie să fie în Git
- Fișierul `.env` nu trebuie să fie în Git (este în `.gitignore`)
- După pull/clone, trebuie să rulezi `composer install` și `npm install`
- După pull/clone, trebuie să rulezi migrațiile și seeder-ul

