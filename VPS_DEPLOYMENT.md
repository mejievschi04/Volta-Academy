# Ghid Conectare VPS și Deployment - Volta Academy

Acest ghid te ajută să te conectezi la un VPS și să deployezi aplicația Volta Academy folosind Docker.

## 1. Conectare la VPS

### Windows (PowerShell/CMD)

#### Metoda 1: SSH cu parolă
```powershell
ssh username@your-vps-ip
# Exemplu: ssh root@192.168.1.100
# Sau: ssh ubuntu@45.67.89.123
```

#### Metoda 2: SSH cu cheie privată
```powershell
# Dacă ai cheie privată (.pem sau .ppk)
ssh -i path/to/your-key.pem username@your-vps-ip

# Exemplu:
ssh -i C:\Users\User\.ssh\my-key.pem ubuntu@45.67.89.123
```

#### Metoda 3: PuTTY (GUI)
1. Deschide PuTTY
2. Introdu IP-ul VPS-ului în "Host Name"
3. Port: 22
4. Connection type: SSH
5. Click "Open"
6. Login cu username și parolă

### Linux/Mac

```bash
# Cu parolă
ssh username@your-vps-ip

# Cu cheie privată
ssh -i ~/.ssh/your-key.pem username@your-vps-ip

# Primul login - acceptă fingerprint
# Va cere parola sau va folosi cheia automat
```

## 2. Setup Inițial pe VPS

### 2.1. Actualizare Sistem

```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

### 2.2. Instalare Docker

```bash
# Instalează Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Adaugă utilizatorul la grupul docker (pentru a rula fără sudo)
sudo usermod -aG docker $USER

# Reîncarcă grupul (sau reconectează-te)
newgrp docker

# Verifică instalarea
docker --version
docker-compose --version
```

Dacă `docker-compose` nu este instalat:

```bash
# Instalează Docker Compose standalone
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

### 2.3. Instalare Git

```bash
# Ubuntu/Debian
sudo apt install git -y

# CentOS/RHEL
sudo yum install git -y
```

### 2.4. Configurare Firewall

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable

# Firewalld (CentOS)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## 3. Deploy Aplicație pe VPS

### 3.1. Clonează Repository-ul

```bash
# Creează director pentru aplicație
mkdir -p ~/projects
cd ~/projects

# Clonează repository-ul
git clone <your-repository-url> VoltaAcademy
cd VoltaAcademy

# Sau transferă fișierele manual cu SCP/SFTP
```

### 3.2. Transfer Fișiere cu SCP (Windows)

```powershell
# Din PowerShell pe Windows
scp -r C:\Users\User\Desktop\Projects\VoltaAcademy username@vps-ip:~/projects/

# Cu cheie privată
scp -i C:\Users\User\.ssh\key.pem -r C:\Users\User\Desktop\Projects\VoltaAcademy username@vps-ip:~/projects/
```

### 3.3. Transfer Fișiere cu WinSCP (GUI Windows)

1. Deschide WinSCP
2. Conectează-te la VPS (IP, username, password/key)
3. Navighează la `~/projects/`
4. Drag & drop folderul `VoltaAcademy`

### 3.4. Configurează Variabilele de Mediu

```bash
cd ~/projects/VoltaAcademy

# Creează .env pentru Docker Compose
nano .env
# Sau: vi .env
```

Conținut `.env` pentru producție:

```env
# Application
APP_NAME=Volta Academy
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-api-domain.com

# Database
DB_DATABASE=volta_academy
DB_USERNAME=volta_user
DB_PASSWORD=strong_secure_password_here
DB_ROOT_PASSWORD=strong_root_password_here
DB_PORT=3306

# Frontend
FRONTEND_URL=https://your-frontend-domain.com
FRONTEND_PORT=3000
BACKEND_PORT=8000

# Session
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
SESSION_LIFETIME=120

# AI Configuration
AI_PROVIDER=groq
GROQ_API_KEY=your_actual_groq_api_key
GROQ_API_URL=https://api.groq.com/openai/v1
GROQ_MODEL=llama-3.1-8b-instant

# Frontend API URL
VITE_API_URL=https://your-api-domain.com/api

# Logging
LOG_LEVEL=error
```

Salvează: `Ctrl+O`, Enter, `Ctrl+X` (nano) sau `:wq` (vi)

### 3.5. Build și Start Aplicația

```bash
# Build imagini Docker
docker-compose build

# Start serviciile
docker-compose up -d

# Verifică statusul
docker-compose ps

# Verifică log-urile
docker-compose logs -f
```

### 3.6. Inițializare Laravel

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

## 4. Configurare Nginx Reverse Proxy

### 4.1. Instalare Nginx

```bash
sudo apt install nginx -y  # Ubuntu/Debian
# sau
sudo yum install nginx -y  # CentOS/RHEL
```

### 4.2. Configurare Backend API

```bash
sudo nano /etc/nginx/sites-available/volta-api
```

Conținut:

```nginx
server {
    listen 80;
    server_name api.your-domain.com;  # Sau IP-ul direct

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
    }
}
```

### 4.3. Configurare Frontend

```bash
sudo nano /etc/nginx/sites-available/volta-frontend
```

Conținut:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Sau IP-ul direct

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4.4. Activează Site-urile

```bash
# Creează symlink-uri
sudo ln -s /etc/nginx/sites-available/volta-api /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/volta-frontend /etc/nginx/sites-enabled/

# Testează configurația
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## 5. Configurare SSL cu Let's Encrypt

```bash
# Instalează Certbot
sudo apt install certbot python3-certbot-nginx -y  # Ubuntu/Debian

# Configurează SSL
sudo certbot --nginx -d your-domain.com -d api.your-domain.com

# Testează auto-renewal
sudo certbot renew --dry-run
```

După SSL, actualizează `.env`:

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

## 6. Verificare Deployment

```bash
# Verifică containerele
docker-compose ps

# Verifică log-urile
docker-compose logs backend
docker-compose logs frontend

# Testează API
curl http://localhost:8000/up
curl http://localhost:8000/api/auth/me

# Testează din browser
# Frontend: http://your-domain.com
# Backend: http://api.your-domain.com/up
```

## 7. Comenzi Utile pentru Management

### Restart Aplicație

```bash
cd ~/projects/VoltaAcademy
docker-compose restart
```

### Update Aplicație

```bash
cd ~/projects/VoltaAcademy

# Pull latest changes
git pull

# Rebuild și restart
docker-compose build
docker-compose up -d

# Rulare migrații noi (dacă există)
docker-compose exec backend php artisan migrate --force
```

### Backup Baza de Date

```bash
# Backup manual
docker-compose exec mysql mysqldump -u root -p${DB_ROOT_PASSWORD} ${DB_DATABASE} > backup_$(date +%Y%m%d).sql

# Sau cu script automat
cat > ~/backup-db.sh << 'EOF'
#!/bin/bash
cd ~/projects/VoltaAcademy
source .env
docker-compose exec -T mysql mysqldump -u root -p${DB_ROOT_PASSWORD} ${DB_DATABASE} > ~/backups/backup_$(date +%Y%m%d_%H%M%S).sql
EOF

chmod +x ~/backup-db.sh

# Adaugă în crontab pentru backup zilnic
crontab -e
# Adaugă: 0 2 * * * ~/backup-db.sh
```

### Monitorizare

```bash
# Status containere
docker-compose ps

# Resurse utilizate
docker stats

# Log-uri în timp real
docker-compose logs -f

# Disk usage
df -h
docker system df
```

## 8. Troubleshooting

### Probleme de Conectare SSH

```bash
# Verifică că SSH rulează
sudo systemctl status ssh

# Verifică firewall
sudo ufw status

# Verifică portul
sudo netstat -tlnp | grep :22
```

### Probleme Docker

```bash
# Verifică Docker
sudo systemctl status docker

# Restart Docker
sudo systemctl restart docker

# Verifică log-uri Docker
sudo journalctl -u docker.service
```

### Probleme cu Aplicația

```bash
# Verifică log-urile
docker-compose logs backend
docker-compose logs frontend
docker-compose logs mysql

# Rebuild complet
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Probleme cu Permisiuni

```bash
# Fix permisiuni storage
docker-compose exec backend chmod -R 775 storage bootstrap/cache
docker-compose exec backend chown -R www-data:www-data storage bootstrap/cache
```

## 9. Securitate

### Hardening SSH

```bash
# Editează configurația SSH
sudo nano /etc/ssh/sshd_config

# Recomandări:
# PermitRootLogin no
# PasswordAuthentication no  # Dacă folosești chei
# Port 2222  # Schimbă portul default

# Restart SSH
sudo systemctl restart sshd
```

### Firewall Rules

```bash
# Blochează tot, permite doar ce e necesar
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Update Regular

```bash
# Actualizează sistemul regulat
sudo apt update && sudo apt upgrade -y

# Actualizează imagini Docker
docker-compose pull
docker-compose up -d
```

## 10. Quick Reference

```bash
# Conectare VPS
ssh username@vps-ip

# Navigare la aplicație
cd ~/projects/VoltaAcademy

# Start/Stop
docker-compose up -d
docker-compose stop
docker-compose restart

# Logs
docker-compose logs -f

# Executare comenzi
docker-compose exec backend php artisan <command>
docker-compose exec mysql mysql -u root -p

# Update
git pull && docker-compose build && docker-compose up -d
```

## Suport

Pentru probleme:
- Verifică log-urile: `docker-compose logs`
- Verifică statusul: `docker-compose ps`
- Verifică resursele: `docker stats`
- Consultă documentația: `DOCKER_DEPLOYMENT.md`
