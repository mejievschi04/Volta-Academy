# Docker Deployment Guide - Volta Academy

Acest ghid conține instrucțiuni pentru deployarea aplicației Volta Academy folosind Docker și Docker Compose.

## Cerințe

- Docker >= 20.10
- Docker Compose >= 2.0
- Git (pentru clonare repository)

## Structura Docker

Aplicația folosește Docker Compose pentru orchestratie și include:
- **MySQL 8.0** - Baza de date
- **Backend Laravel** - PHP 8.2-FPM
- **Nginx Backend** - Reverse proxy pentru Laravel
- **Frontend React** - Nginx cu build static

## Quick Start

### 1. Clonează Repository-ul

```bash
git clone <repository-url>
cd VoltaAcademy
```

### 2. Configurează Variabilele de Mediu

Creează fișierul `.env` în root-ul proiectului:

```env
# Application
APP_NAME=Volta Academy
APP_ENV=production
APP_DEBUG=false
APP_URL=http://localhost:8000

# Database
DB_DATABASE=volta_academy
DB_USERNAME=volta_user
DB_PASSWORD=your_secure_password
DB_ROOT_PASSWORD=your_root_password
DB_PORT=3306

# Frontend
FRONTEND_URL=http://localhost:3000
FRONTEND_PORT=3000
BACKEND_PORT=8000

# AI Configuration
AI_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key
GROQ_API_URL=https://api.groq.com/openai/v1
GROQ_MODEL=llama-3.1-8b-instant

# Session
SESSION_SECURE_COOKIE=false  # true pentru HTTPS
SESSION_SAME_SITE=lax

# Vite API URL (pentru frontend)
VITE_API_URL=http://localhost:8000/api
```

### 3. Build și Start Containerele

```bash
# Build toate imaginile
docker-compose build

# Start serviciile
docker-compose up -d

# Verifică statusul
docker-compose ps
```

### 4. Inițializare Aplicație

```bash
# Generează APP_KEY
docker-compose exec backend php artisan key:generate

# Rulează migrații
docker-compose exec backend php artisan migrate --force

# Creează storage link
docker-compose exec backend php artisan storage:link

# Cache optimizări
docker-compose exec backend php artisan config:cache
docker-compose exec backend php artisan route:cache
docker-compose exec backend php artisan view:cache
```

### 5. Verificare

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Health Check**: http://localhost:8000/up

## Comenzi Utile

### Logs

```bash
# Toate serviciile
docker-compose logs -f

# Doar backend
docker-compose logs -f backend

# Doar frontend
docker-compose logs -f frontend

# Doar MySQL
docker-compose logs -f mysql
```

### Executare Comenzi în Container

```bash
# Backend - Artisan commands
docker-compose exec backend php artisan <command>

# Backend - Composer
docker-compose exec backend composer <command>

# Backend - Shell
docker-compose exec backend sh

# Frontend - npm
docker-compose exec frontend npm <command>
```

### Restart Servicii

```bash
# Restart toate
docker-compose restart

# Restart un serviciu specific
docker-compose restart backend
docker-compose restart frontend
```

### Stop și Cleanup

```bash
# Stop serviciile (păstrează volume-urile)
docker-compose stop

# Stop și șterge containerele (păstrează volume-urile)
docker-compose down

# Stop și șterge tot (inclusiv volume-urile) - ATENȚIE!
docker-compose down -v
```

## Deployment pe Server

### 1. Pregătire Server

```bash
# Instalează Docker și Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Verifică instalarea
docker --version
docker-compose --version
```

### 2. Clonează și Configurează

```bash
# Clonează repository-ul
git clone <repository-url>
cd VoltaAcademy

# Creează .env cu configurațiile de producție
cp .env.example .env
nano .env  # sau vim/vi
```

**Configurare .env pentru producție:**

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-api-domain.com
FRONTEND_URL=https://your-frontend-domain.com
VITE_API_URL=https://your-api-domain.com/api
SESSION_SECURE_COOKIE=true
DB_PASSWORD=strong_secure_password
DB_ROOT_PASSWORD=strong_root_password
```

### 3. Build și Deploy

```bash
# Build imagini
docker-compose build --no-cache

# Start serviciile
docker-compose up -d

# Verifică statusul
docker-compose ps
docker-compose logs
```

### 4. Configurare SSL/HTTPS cu Nginx Reverse Proxy

Creează `/etc/nginx/sites-available/volta-academy`:

```nginx
# Backend API
server {
    listen 80;
    server_name api.your-domain.com;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Frontend
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activează configurația și configurează SSL:

```bash
sudo ln -s /etc/nginx/sites-available/volta-academy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Configurează SSL cu Certbot
sudo certbot --nginx -d your-domain.com -d api.your-domain.com
```

### 5. Actualizează .env pentru HTTPS

```env
APP_URL=https://api.your-domain.com
FRONTEND_URL=https://your-domain.com
VITE_API_URL=https://api.your-domain.com/api
SESSION_SECURE_COOKIE=true
```

Restart containerele:

```bash
docker-compose restart
```

## Optimizări Producție

### 1. Resource Limits

Adaugă în `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### 2. Health Checks

Health checks sunt deja configurate pentru MySQL. Poți adăuga și pentru alte servicii:

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "php", "artisan", "route:list"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 3. Logging

Configurează logging rotation în `docker-compose.yml`:

```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Backup și Restore

### Backup Baza de Date

```bash
# Backup
docker-compose exec mysql mysqldump -u root -p${DB_ROOT_PASSWORD} ${DB_DATABASE} > backup_$(date +%Y%m%d).sql

# Sau folosind docker exec direct
docker exec volta-mysql mysqldump -u root -p${DB_ROOT_PASSWORD} ${DB_DATABASE} > backup.sql
```

### Restore Baza de Date

```bash
# Restore
docker-compose exec -T mysql mysql -u root -p${DB_ROOT_PASSWORD} ${DB_DATABASE} < backup.sql
```

### Backup Storage

```bash
# Backup storage files
docker-compose exec backend tar -czf storage_backup.tar.gz storage/
docker cp volta-backend:/var/www/html/storage_backup.tar.gz ./
```

## Monitoring

### Verificare Resurse

```bash
# Status containere
docker stats

# Disk usage
docker system df

# Volume usage
docker volume ls
docker volume inspect voltaacademy_mysql_data
```

### Logs Monitoring

```bash
# Tail logs
docker-compose logs -f --tail=100

# Logs cu timestamp
docker-compose logs -f -t
```

## Troubleshooting

### Probleme cu Baza de Date

```bash
# Verifică conexiunea
docker-compose exec backend php artisan db:monitor

# Conectează-te la MySQL
docker-compose exec mysql mysql -u root -p

# Verifică log-urile MySQL
docker-compose logs mysql
```

### Probleme cu Permisiuni

```bash
# Fix permisiuni storage
docker-compose exec backend chmod -R 775 storage bootstrap/cache
docker-compose exec backend chown -R www-data:www-data storage bootstrap/cache
```

### Rebuild Containere

```bash
# Rebuild un serviciu specific
docker-compose build --no-cache backend
docker-compose up -d backend

# Rebuild toate
docker-compose build --no-cache
docker-compose up -d
```

### Clear Cache Laravel

```bash
docker-compose exec backend php artisan cache:clear
docker-compose exec backend php artisan config:clear
docker-compose exec backend php artisan route:clear
docker-compose exec backend php artisan view:clear
```

## Securitate

- ✅ Nu commita fișiere `.env`
- ✅ Folosește strong passwords pentru baza de date
- ✅ Configurează firewall-ul serverului
- ✅ Folosește HTTPS în producție
- ✅ Actualizează regulat imagini Docker
- ✅ Limitează resursele containerelor
- ✅ Configurează backup-uri automate

## Suport

Pentru probleme sau întrebări:
- Docker Documentation: https://docs.docker.com/
- Docker Compose Documentation: https://docs.docker.com/compose/
