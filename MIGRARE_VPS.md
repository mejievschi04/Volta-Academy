## Ghid complet migrare Volta Academy pe VPS (Docker)

Acest document descrie **toți pașii de la 0** pentru a porni aplicația Volta Academy pe un VPS, folosind Docker și Nginx cu SSL.

- **IP VPS**: `195.178.106.107`
- **Domeniu**: `academy.volta.md`
- **Stack**: PostgreSQL + Laravel backend + React frontend (toate în Docker)

---

## 0. Ce îți trebuie înainte

- Acces SSH la VPS (Ubuntu/Debian recomandat, ex. Ubuntu 22.04).
- Domeniul `academy.volta.md` configurat la providerul de DNS.
- Utilizator cu drepturi `sudo` pe VPS.

---

## 1. Configurare DNS

În panoul DNS al domeniului (Cloudflare, Namecheap, etc.), creează:

- **Record A**:
  - **Name**: `academy.volta.md`
  - **Type**: `A`
  - **Value**: `195.178.106.107`
- (Opțional) **Record A** pentru `www`:
  - **Name**: `www.academy.volta.md`
  - **Type**: `A`
  - **Value**: `195.178.106.107`

Salvează și așteaptă propagarea (de obicei 5–30 de minute).

---

## 2. Conectare la VPS și update de bază

Conectează-te prin SSH:

```bash
ssh user@195.178.106.107
```

Actualizează pachetele:

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 3. Instalare Docker și Docker Compose

Instalează Docker:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# reconectează-te (logout / login) sau:
newgrp docker
```

Instalează Docker Compose plugin:

```bash
sudo apt install docker-compose-plugin -y
```

Verifică:

```bash
docker --version
docker compose version
```

---

## 4. Clonarea proiectului pe VPS

Alege un director (ex. `/opt`):

```bash
cd /opt
git clone <URL_REPO_VOLTA_ACADEMY>.git VoltaAcademy
cd VoltaAcademy
sudo chown -R $USER:$USER .
```

> Înlocuiește `<URL_REPO_VOLTA_ACADEMY>` cu URL-ul real al repository-ului tău (HTTPS sau SSH).

---

## 5. Configurare backend (`volta-backend/.env`)

Intră în directorul backend:

```bash
cd /opt/VoltaAcademy/volta-backend
cp .env .env.backup-prim # backup (opțional)
```

Editează fișierul `.env`:

```bash
nano .env
```

Un exemplu recomandat pentru **producție** (valorile cu comentariu le schimbi tu):

```env
APP_NAME=Volta Academy
APP_ENV=production
APP_KEY=base64:MsX9NCJmwK9DCTch3TtYnxYQOQmEVmL7jzPwT1to688=
APP_DEBUG=false
APP_URL=https://academy.volta.md

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

APP_MAINTENANCE_DRIVER=file

BCRYPT_ROUNDS=12

LOG_CHANNEL=stack
LOG_STACK=single
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=error

DATABASE_URL=

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=sync

CACHE_STORE=file
MEMCACHED_HOST=127.0.0.1

REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

MAIL_MAILER=log
MAIL_SCHEME=null
MAIL_HOST=127.0.0.1
MAIL_PORT=2525
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_FROM_ADDRESS="no-reply@academy.volta.md"
MAIL_FROM_NAME="${APP_NAME}"

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
AWS_USE_PATH_STYLE_ENDPOINT=false

VITE_APP_NAME="${APP_NAME}"

DB_CONNECTION=pgsql
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=volta_academy
DB_USERNAME=volta_user
DB_PASSWORD=schimba_parola_aici   # ALEGE o parolă puternică și folosește-o și în postgres
DB_SCHEMA=public
DB_SSLMODE=prefer

VOLTA_ADMIN_EMAIL=
VOLTA_ADMIN_PASSWORD=
VOLTA_ADMIN_NAME=Administrator

AI_PROVIDER=groq
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
GROQ_FALLBACK_MODELS=llama-3.1-8b-instant,llama-3.1-8b
AI_VERIFY_SSL=true
```

### 5.1. Generare APP_KEY (dacă ai nevoie)

Cheia este deja setată, dar dacă vrei să generezi alta:

```bash
docker run --rm -v $(pwd):/app -w /app php:8.2-cli php artisan key:generate --show
```

Copiază valoarea în `APP_KEY=` în `.env`.

---

## 6. Configurare frontend (`volta-frontend/.env`)

Intră în directorul frontend:

```bash
cd /opt/VoltaAcademy/volta-frontend
cp .env .env.backup-prim 2>/dev/null || true
nano .env
```

Setează:

```env
VITE_API_URL=https://academy.volta.md/api
```

> Aceasta este adresa API-ului așa cum va fi văzută de browser, prin Nginx.

---

## 7. Aliniere parolă Postgres cu Docker

În `docker-compose.yml`, serviciul `postgres` folosește variabilele:

```yaml
environment:
  POSTGRES_DB: ${DB_DATABASE:-volta_academy}
  POSTGRES_USER: ${DB_USERNAME:-volta_user}
  POSTGRES_PASSWORD: ${DB_PASSWORD:-volta_password}
```

Ai două opțiuni:

- **Simplu**: pui aceleași valori în fișierul `.env` din rădăcina proiectului, pe VPS:

```bash
cd /opt/VoltaAcademy
cp .env .env.backup-prim 2>/dev/null || true
nano .env
```

Și setezi:

```env
DB_DATABASE=volta_academy
DB_USERNAME=volta_user
DB_PASSWORD=schimba_parola_aici   # ACEEAȘI parolă ca în backend .env
```

- Astfel, Docker va porni Postgres cu aceste valori și backend-ul se va conecta corect.

---

## 8. Build și pornire Docker (prima dată)

Din rădăcina proiectului:

```bash
cd /opt/VoltaAcademy
docker compose build --no-cache
docker compose up -d
```

Verifică statusul containerelor:

```bash
docker compose ps
```

Verifică logurile backend-ului (pentru erori de migrare, DB, etc.):

```bash
docker compose logs -f backend
```

În acest moment:

- Backend (Nginx pentru Laravel) ascultă pe port **8000** pe host.
- Frontend ascultă pe port **3001** pe host.

Poți testa rapid (fără HTTPS) din browser:

- `http://195.178.106.107:8000` → backend (Laravel prin Nginx).
- `http://195.178.106.107:3001` → frontend (React build-uit).

---

## 9. Configurare Nginx pe host (reverse proxy către Docker)

Instalează Nginx și Certbot:

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

Crează un fișier de config:

```bash
sudo nano /etc/nginx/sites-available/academy-volta
```

Conținut recomandat:

```nginx
server {
    listen 80;
    server_name academy.volta.md www.academy.volta.md;

    # API și fișiere Laravel (/api și /storage)
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

    # Frontend React (restul traficului)
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

Activează site-ul:

```bash
sudo ln -s /etc/nginx/sites-available/academy-volta /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Acum, dacă DNS-ul este propagat, `http://academy.volta.md` ar trebui să îți deschidă frontend-ul (fără HTTPS încă).

---

## 10. SSL cu Let's Encrypt (HTTPS)

Rulează:

```bash
sudo certbot --nginx -d academy.volta.md -d www.academy.volta.md
```

Urmează pașii din wizard:

- Alege redirecționare automată HTTP → HTTPS dacă este oferită.

La final, site-ul va fi disponibil la:

- `https://academy.volta.md`

---

## 11. Actualizări ulterioare (redeploy simplu)

Când aduci modificări în cod:

1. Te conectezi pe VPS:

```bash
ssh user@195.178.106.107
cd /opt/VoltaAcademy
git pull
```

2. Rebuild și restart servicii:

```bash
docker compose build --no-cache
docker compose up -d
```

Pentru schimbări doar în frontend (ex. `VITE_API_URL`), poți rebuild-ui doar frontendul:

```bash
docker compose build --no-cache frontend
docker compose up -d frontend
```

---

## 12. Comenzi utile și debugging

- **Status containere**:

```bash
docker compose ps
```

- **Loguri generale**:

```bash
docker compose logs -f
```

- **Log backend**:

```bash
docker compose logs -f backend
```

- **Log Postgres**:

```bash
docker compose logs -f postgres
```

- **Permisiuni Laravel (storage/cache)**:

```bash
docker compose exec backend chmod -R 775 storage bootstrap/cache
docker compose exec backend chown -R www-data:www-data storage bootstrap/cache
```

---

## 13. Checklist final

- [ ] DNS: `academy.volta.md` → `195.178.106.107`
- [ ] Docker și Docker Compose instalate
- [ ] Proiect clonat în `/opt/VoltaAcademy`
- [ ] `volta-backend/.env` configurat pentru producție (APP_URL, DB_*, APP_KEY)
- [ ] `.env` rădăcină cu `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` consistente cu backend
- [ ] `volta-frontend/.env` cu `VITE_API_URL=https://academy.volta.md/api`
- [ ] `docker compose build --no-cache` și `docker compose up -d` rulate cu succes
- [ ] Nginx configurat să proxy-uiască către porturile 8000 (backend) și 3001 (frontend)
- [ ] Certbot rulat, SSL activ pe `https://academy.volta.md`

După ce ai parcurs pașii de mai sus, aplicația Volta Academy ar trebui să fie accesibilă public, în producție, la `https://academy.volta.md`.

