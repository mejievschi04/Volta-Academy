# Deployment Guide - Volta Academy

Acest ghid conține instrucțiuni pentru deployarea aplicației Volta Academy pe un server de producție.

## Structura Aplicației

Aplicația este compusă din două părți:
- **Backend**: Laravel 12 (PHP 8.2+) - `volta-backend/`
- **Frontend**: React + Vite - `volta-frontend/`

## Cerințe Sistem

### Backend
- PHP >= 8.2
- Composer
- MySQL/MariaDB sau PostgreSQL
- Node.js >= 18 (pentru build assets)
- Extensii PHP necesare: `pdo`, `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `json`, `curl`, `fileinfo`

### Frontend
- Node.js >= 18
- npm sau yarn

## Pași de Deployment

### 1. Pregătire Backend

#### 1.1. Configurare Variabile de Mediu

Creează fișierul `.env` în `volta-backend/` cu următorul conținut:

```env
APP_NAME="Volta Academy"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://your-api-domain.com

LOG_CHANNEL=stack
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=error

# Database Configuration
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=volta_academy
DB_USERNAME=your_db_user
DB_PASSWORD=your_db_password

# Session Configuration
SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
SESSION_DOMAIN=your-domain.com

# CORS Configuration - Frontend URL (poate fi multiplu, separați cu virgulă)
FRONTEND_URL=https://your-frontend-domain.com

# AI Provider Configuration
AI_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key
GROQ_API_URL=https://api.groq.com/openai/v1
GROQ_MODEL=llama-3.1-8b-instant

# Alternative AI Providers (optional)
OPENAI_API_KEY=
OPENAI_API_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

HUGGINGFACE_API_KEY=
HUGGINGFACE_API_URL=https://router.huggingface.co
HUGGINGFACE_MODEL=meta-llama/Meta-Llama-3.1-8B-Instruct

# SSL Verification
AI_VERIFY_SSL=true

# Mail Configuration
MAIL_MAILER=smtp
MAIL_HOST=your_smtp_host
MAIL_PORT=587
MAIL_USERNAME=your_smtp_username
MAIL_PASSWORD=your_smtp_password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="noreply@your-domain.com"
MAIL_FROM_NAME="${APP_NAME}"

# Cache Configuration
CACHE_STORE=file
CACHE_PREFIX=

# Queue Configuration
QUEUE_CONNECTION=sync

# Filesystem Configuration
FILESYSTEM_DISK=local
```

**IMPORTANT**: 
- Generează `APP_KEY` rulând: `php artisan key:generate`
- Actualizează `APP_URL` cu URL-ul real al API-ului
- Actualizează `FRONTEND_URL` cu URL-ul frontend-ului
- Configurează credențialele bazei de date

#### 1.2. Instalare Dependențe

```bash
cd volta-backend
composer install --no-dev --optimize-autoloader
npm install
npm run build
```

#### 1.3. Configurare Baza de Date

```bash
# Creează tabelele
php artisan migrate --force

# (Opțional) Rulează seeders pentru date inițiale
php artisan db:seed
```

#### 1.4. Configurare Permisiuni

```bash
# Asigură-te că storage și cache au permisiuni de scriere
chmod -R 775 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
```

#### 1.5. Optimizare Laravel

```bash
# Cache configurația
php artisan config:cache

# Cache rutele
php artisan route:cache

# Cache view-urile
php artisan view:cache
```

### 2. Pregătire Frontend

#### 2.1. Configurare Variabile de Mediu

Creează fișierul `.env` în `volta-frontend/`:

```env
# API Configuration
VITE_API_URL=https://your-api-domain.com/api
VITE_API_TIMEOUT=10000

# Application Environment
VITE_APP_ENV=production
```

**IMPORTANT**: Actualizează `VITE_API_URL` cu URL-ul complet al API-ului backend.

#### 2.2. Build Frontend

```bash
cd volta-frontend
npm install
npm run build
```

Acest lucru va crea un folder `dist/` cu fișierele statice optimizate pentru producție.

### 3. Configurare Server Web

#### 3.1. Backend (Laravel)

Configurare pentru **Nginx**:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name your-api-domain.com;
    root /path/to/volta-backend/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    index index.php;

    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

Configurare pentru **Apache** (`.htaccess` în `public/`):

```apache
<IfModule mod_rewrite.c>
    <IfModule mod_negotiation.c>
        Options -MultiViews -Indexes
    </IfModule>

    RewriteEngine On

    # Handle Authorization Header
    RewriteCond %{HTTP:Authorization} .
    RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]

    # Redirect Trailing Slashes If Not A Folder...
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_URI} (.+)/$
    RewriteRule ^ %1 [L,R=301]

    # Send Requests To Front Controller...
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.php [L]
</IfModule>
```

#### 3.2. Frontend (Static Files)

Opțiunea 1: **Nginx** pentru fișiere statice:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name your-frontend-domain.com;
    root /path/to/volta-frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Opțiunea 2: **Servire din Backend** (Laravel servește frontend-ul):

Adaugă în `volta-backend/routes/web.php`:

```php
Route::get('/{any}', function () {
    return file_get_contents(public_path('../volta-frontend/dist/index.html'));
})->where('any', '.*');
```

### 4. Configurare SSL/HTTPS

Folosește **Let's Encrypt** cu Certbot:

```bash
sudo certbot --nginx -d your-api-domain.com -d your-frontend-domain.com
```

După configurare SSL, actualizează:
- `APP_URL` în `.env` backend: `https://your-api-domain.com`
- `VITE_API_URL` în `.env` frontend: `https://your-api-domain.com/api`
- `FRONTEND_URL` în `.env` backend: `https://your-frontend-domain.com`

### 5. Verificare Deployment

#### 5.1. Verificare Backend

```bash
# Verifică health check
curl https://your-api-domain.com/up

# Verifică API
curl https://your-api-domain.com/api/auth/me
```

#### 5.2. Verificare Frontend

- Deschide `https://your-frontend-domain.com` în browser
- Verifică că API calls funcționează
- Verifică console pentru erori

### 6. Optimizări Post-Deployment

#### 6.1. Queue Workers (dacă folosești queues)

```bash
# Rulează queue worker
php artisan queue:work --daemon

# Sau folosește Supervisor pentru management
```

#### 6.2. Task Scheduling (Cron)

Adaugă în crontab:

```bash
* * * * * cd /path/to/volta-backend && php artisan schedule:run >> /dev/null 2>&1
```

#### 6.3. Monitoring & Logging

- Configurează log rotation pentru `storage/logs/`
- Configurează monitoring (ex: Laravel Telescope pentru development)
- Setup error tracking (ex: Sentry)

## Troubleshooting

### Probleme CORS

Dacă întâmpini probleme CORS:
1. Verifică că `FRONTEND_URL` este setat corect în `.env` backend
2. Verifică că `VITE_API_URL` este setat corect în `.env` frontend
3. Curăță cache-ul: `php artisan config:clear`

### Probleme cu Sesii

Dacă sesiunile nu funcționează:
1. Verifică că `SESSION_SECURE_COOKIE=true` pentru HTTPS
2. Verifică că `SESSION_DOMAIN` este setat corect
3. Verifică permisiunile pe `storage/framework/sessions`

### Probleme cu Storage

Dacă upload-urile nu funcționează:
1. Verifică permisiunile pe `storage/app/public`
2. Rulează: `php artisan storage:link`
3. Verifică configurația `FILESYSTEM_DISK` în `.env`

## Scripturi Utile

### Deploy Script (Backend)

```bash
#!/bin/bash
cd /path/to/volta-backend
git pull origin main
composer install --no-dev --optimize-autoloader
npm install
npm run build
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### Deploy Script (Frontend)

```bash
#!/bin/bash
cd /path/to/volta-frontend
git pull origin main
npm install
npm run build
# Copiază dist/ la locația serverului web sau deploy direct
```

## Securitate

- Nu commita niciodată fișiere `.env`
- Folosește HTTPS în producție
- Configurează firewall-ul serverului
- Actualizează regulat dependențele
- Folosește strong passwords pentru baza de date
- Configurează backup-uri regulate pentru baza de date

## Suport

Pentru probleme sau întrebări, consultă:
- Laravel Documentation: https://laravel.com/docs
- Vite Documentation: https://vitejs.dev/
