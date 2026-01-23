# Quick Deployment Reference - Volta Academy

## Checklist Pre-Deployment

- [ ] Backend `.env` configurat cu datele corecte
- [ ] Frontend `.env` configurat cu URL-ul API-ului
- [ ] Baza de date creată și configurată
- [ ] `APP_KEY` generat (`php artisan key:generate`)
- [ ] Dependențe instalate (composer, npm)
- [ ] Migrații rulate (`php artisan migrate`)
- [ ] Assets build-uite (`npm run build`)
- [ ] Cache-uri optimizate (`php artisan config:cache`, etc.)
- [ ] Permisiuni setate corect pe storage
- [ ] SSL/HTTPS configurat
- [ ] CORS configurat corect

## Comenzi Rapide

### Backend
```bash
# Instalare dependențe
composer install --no-dev --optimize-autoloader
npm install && npm run build

# Setup inițial
php artisan key:generate
php artisan migrate --force
php artisan storage:link

# Optimizare
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Clear cache (dacă e nevoie)
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan cache:clear
```

### Frontend
```bash
# Instalare și build
npm install
npm run build

# Build-ul va fi în folderul dist/
```

## Variabile de Mediu Esențiale

### Backend (.env)
```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-api-domain.com
FRONTEND_URL=https://your-frontend-domain.com
DB_*=... (configurare baza de date)
```

### Frontend (.env)
```env
VITE_API_URL=https://your-api-domain.com/api
```

## Verificare Post-Deployment

1. **Health Check**: `curl https://your-api-domain.com/up`
2. **API Test**: `curl https://your-api-domain.com/api/auth/me`
3. **Frontend**: Deschide `https://your-frontend-domain.com` în browser
4. **Console Browser**: Verifică erori în Developer Tools
5. **Network Tab**: Verifică că API calls funcționează

## Probleme Comune

### CORS Errors
- Verifică `FRONTEND_URL` în backend `.env`
- Verifică `VITE_API_URL` în frontend `.env`
- Rulează `php artisan config:clear`

### 500 Errors
- Verifică log-urile: `storage/logs/laravel.log`
- Verifică permisiunile pe `storage/` și `bootstrap/cache/`
- Verifică că `APP_KEY` este setat

### Assets Not Loading
- Verifică că `npm run build` a rulat cu succes
- Verifică că `dist/` folder există și conține fișiere
- Verifică configurația serverului web (Nginx/Apache)

### Database Connection Errors
- Verifică credențialele în `.env`
- Verifică că MySQL/MariaDB rulează
- Verifică că baza de date există

## Scripturi de Deployment

### Linux/Mac
```bash
# Backend
./volta-backend/deploy.sh

# Frontend
./volta-frontend/deploy.sh
```

### Windows PowerShell
```powershell
# Backend
.\volta-backend\deploy.ps1

# Frontend
.\volta-frontend\deploy.ps1
```

## Structura Fișierelor pe Server

```
/path/to/server/
├── volta-backend/
│   ├── app/
│   ├── config/
│   ├── database/
│   ├── public/          # Document root pentru Nginx/Apache
│   ├── storage/         # Permisiuni 775
│   ├── .env            # Configurație producție
│   └── ...
└── volta-frontend/
    ├── dist/           # Build production (servit de Nginx)
    ├── .env            # Configurație producție
    └── ...
```

## Securitate

- ✅ Nu commita `.env` files
- ✅ Folosește HTTPS în producție
- ✅ Setează `APP_DEBUG=false`
- ✅ Folosește strong passwords
- ✅ Configurează firewall
- ✅ Actualizează dependențele regulat

## Suport

Pentru detalii complete, vezi `DEPLOYMENT.md`
