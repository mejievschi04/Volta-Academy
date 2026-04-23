# Ghid de migrare Volta Academy pe VPS

Acest document descrie pașii pentru deploy pe un VPS (Ubuntu/Debian) folosind Docker.

## Cerințe VPS

- **OS**: Ubuntu 22.04 LTS sau Debian 12
- **RAM**: minim 2GB (recomandat 4GB)
- **Storage**: minim 20GB SSD
- **Docker** și **Docker Compose** instalate

---

## 1. Pregătire VPS

### Instalare Docker (Ubuntu/Debian)

```bash
# Actualizare pachete
sudo apt update && sudo apt upgrade -y

# Instalare Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Reconnectează-te sau: newgrp docker

# Instalare Docker Compose
sudo apt install docker-compose-plugin -y
```

### Clonare proiect

```bash
cd /opt  # sau alt director
sudo git clone https://github.com/TU_REPO/VoltaAcademy.git
cd VoltaAcademy
sudo chown -R $USER:$USER .
```

---

## 2. Configurare mediu

### Creare fișier .env

```bash
cp .env.example .env
nano .env  # sau vim
```

**Variabile obligatorii de completat:**

| Variabilă | Descriere | Exemplu |
|-----------|-----------|---------|
| `APP_KEY` | Cheie Laravel | `php artisan key:generate --show` |
| `DB_PASSWORD` | Parolă PostgreSQL | Parolă puternică |
| `APP_URL` | URL aplicație | `https://academy.volta.md` |
| `FRONTEND_URL` | URL frontend (CORS) | `https://academy.volta.md` |
| `VITE_API_URL` | URL API pentru frontend | `https://academy.volta.md/api` |

### Generare APP_KEY

```bash
cd volta-backend
php artisan key:generate --show
# Copiază output-ul în .env la APP_KEY=
```

Sau folosește Docker:
```bash
docker run --rm -v $(pwd)/volta-backend:/app -w /app php:8.2-cli php artisan key:generate --show
```

---

## 3. Deploy cu Docker Compose

### Build și pornire

```bash
# Din rădăcina proiectului (folosește override pentru producție)
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Sau folosește scriptul: `./scripts/deploy-vps.sh`

### Verificare

```bash
docker compose ps
docker compose logs -f backend   # pentru debug
```

---

## 4. Reverse proxy (Nginx + SSL)

Pentru HTTPS, folosește Nginx pe host ca reverse proxy în fața Docker.

### Instalare Nginx și Certbot

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

### Configurare Nginx (un singur domeniu: academy.volta.md)

Creează `/etc/nginx/sites-available/academy-volta-md`:

```nginx
server {
    listen 80;
    server_name academy.volta.md www.academy.volta.md;

    # Upload-uri mari pentru biblioteca. Trebuie sa fie peste limita Laravel/PHP.
    client_max_body_size 550m;

    # API - /api și /storage către backend
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /storage {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Restul - frontend React
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/academy-volta-md /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL cu Let's Encrypt

```bash
sudo certbot --nginx -d academy.volta.md -d www.academy.volta.md
```

---

## 5. Script de deploy automat

Folosește `scripts/deploy-vps.sh` pentru actualizări:

```bash
chmod +x scripts/deploy-vps.sh
./scripts/deploy-vps.sh
```

---

## 6. Backup baza de date (PostgreSQL)

```bash
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

# Export
$COMPOSE exec -T postgres pg_dump -U volta_user volta_academy > backup_$(date +%Y%m%d).sql

# Restore
$COMPOSE exec -T postgres psql -U volta_user -d volta_academy < backup_20250204.sql
```

---

## 7. Troubleshooting

### Eroare DNS la build („unable to select packages”, „transient error”)
1. **Configurează DNS pentru Docker** – creează/editează `/etc/docker/daemon.json`:
   ```json
   {
     "dns": ["8.8.8.8", "1.1.1.1"]
   }
   ```
   Apoi: `sudo systemctl restart docker`

2. **Configurează DNS pe server** (dacă nu merge):
   ```bash
   echo -e "nameserver 8.8.8.8\nnameserver 1.1.1.1" | sudo tee /etc/resolv.conf
   ```

3. **Dockerfile-ul folosește** mirror Alpine alternativ (`alpine.global.ssl.fastly.net`). Fă `git pull` și rebuild.

### `/api/auth/login` sau `/api/auth/me` returnează 500
1. **Test fără sesiune:** deschide `https://DITAU-DOMENIU/api/health` — dacă e **200** cu `"database":"connected"`, PHP și DB merg; problema e aproape sigur la **sesiuni** sau la codul de login. Dacă **500**, verifică `DB_*` în container și logurile.
2. **Loguri:** `docker compose exec backend tail -n 120 storage/logs/laravel.log`
3. **Mesaj în browser (temporar):** în `.env` pune `VOLTA_EXPOSE_API_ERRORS=true`, `docker compose up -d`, repetă requestul la API — răspunsul JSON va include `message` / `file` / `line`. **Dezactivează** după (`false`).
4. **`APP_KEY`** stabil; dacă l-ai schimbat, șterge cookie-urile pentru domeniu.
5. **Docker Compose** setează `SESSION_DRIVER=file` și `CACHE_STORE=file` **fix** pe serviciul backend (nu mai ia `SESSION_DRIVER=database` din `.env` care poate lipsi tabela `sessions`).
6. **`FRONTEND_URL`** în `.env` la rădăcina proiectului = același origin ca SPA (ex. `https://academy.volta.md`).
7. **Proxy:** `trustProxies(at: '*')` pentru `X-Forwarded-Proto` în spatele Nginx.

### Backend nu pornește
- Verifică `APP_KEY` în .env
- Verifică conexiunea la PostgreSQL: `docker compose exec backend php artisan db:show`

### Frontend nu apelază API-ul corect
- `VITE_API_URL` se bazează la **build time**. După modificare, rebuild:
  ```bash
  docker compose build --no-cache frontend && docker compose up -d frontend
  ```

### Permisiuni storage
```bash
docker compose exec backend chmod -R 775 storage bootstrap/cache
docker compose exec backend chown -R www-data:www-data storage bootstrap/cache
```

### Logs
```bash
docker compose logs -f
docker compose logs backend
docker compose logs postgres
```

---

## 8. Audit LMS (testare aplicație)

Pentru a verifica că API-ul și fluxurile LMS funcționează corect și a identifica **ce nu e în regulă**:

```bash
# Din root-ul proiectului (backend pornit)
node scripts/test-lms-audit.js
```

Cu cont admin (pentru verificări complete):

```bash
API_URL=http://localhost:8000/api LMS_TEST_ADMIN_EMAIL=admin@example.com LMS_TEST_ADMIN_PASSWORD=parola node scripts/test-lms-audit.js
```

Raportul este afișat în consolă și salvat în **`LMS_AUDIT_REPORT.md`**. Vezi **`scripts/README.md`** pentru detalii.

---

## 9. Checklist pre-deploy

- [ ] .env creat și completat
- [ ] APP_KEY generat
- [ ] Parole DB puternice
- [ ] DNS configurat (A record către IP VPS)
- [ ] Porturi 80, 443 deschise în firewall
- [ ] SSL configurat cu Certbot
