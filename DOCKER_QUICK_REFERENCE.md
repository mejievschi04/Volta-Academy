# Quick Docker Reference - Volta Academy

## Comenzi Rapide

### Start Aplicația
```bash
docker-compose up -d
```

### Stop Aplicația
```bash
docker-compose stop
```

### Restart Aplicația
```bash
docker-compose restart
```

### View Logs
```bash
docker-compose logs -f
```

### Build Imagini
```bash
docker-compose build
```

### Executare Comenzi Artisan
```bash
docker-compose exec backend php artisan <command>
```

### Acces MySQL
```bash
docker-compose exec mysql mysql -u root -p
```

## Setup Inițial

1. **Creează .env**
```bash
cp .env.example .env
# Editează .env cu valorile tale
```

2. **Build și Start**
```bash
docker-compose build
docker-compose up -d
```

3. **Inițializare Laravel**
```bash
docker-compose exec backend php artisan key:generate
docker-compose exec backend php artisan migrate --force
docker-compose exec backend php artisan storage:link
docker-compose exec backend php artisan config:cache
docker-compose exec backend php artisan route:cache
docker-compose exec backend php artisan view:cache
```

## URL-uri

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Health Check: http://localhost:8000/up

## Troubleshooting

### Rebuild Containere
```bash
docker-compose build --no-cache
docker-compose up -d
```

### Clear Cache Laravel
```bash
docker-compose exec backend php artisan cache:clear
docker-compose exec backend php artisan config:clear
```

### Verificare Logs
```bash
docker-compose logs backend
docker-compose logs frontend
docker-compose logs mysql
```

### Backup Database
```bash
docker-compose exec mysql mysqldump -u root -p${DB_ROOT_PASSWORD} ${DB_DATABASE} > backup.sql
```

Pentru detalii complete, vezi `DOCKER_DEPLOYMENT.md`
