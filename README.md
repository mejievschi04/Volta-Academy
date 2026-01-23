# Volta Academy - Learning Management System (LMS)

Un sistem modern de management al învățării (LMS) construit cu tehnologii moderne, oferind o experiență completă pentru studenți și administrație.

## 🚀 Caracteristici

- **Frontend Modern**: React + Vite cu design responsive și accesibil
- **Backend Robust**: Laravel 12 (PHP 8.2+) cu API RESTful
- **Sistem de Cursuri**: Creare, gestionare și urmărire progres cursuri
- **Sistem de Teste**: Creare și administrare teste cu question banks reutilizabile
- **Certificări**: Generare certificări personalizate pentru finalizarea cursurilor
- **Analytics**: Dashboard-uri avansate pentru studenți și administrație
- **AI Integration**: Asistență AI pentru crearea de conținut educațional
- **Multi-tenant**: Suport pentru organizații și utilizatori individuali

## 📁 Structura Proiectului

```
VoltaAcademy/
├── volta-frontend/     # Aplicația React frontend
├── volta-backend/      # API Laravel backend
├── docker/             # Configurații Docker
├── scripts/            # Scripturi utilitare
└── docs/               # Documentație suplimentară
```

## 🛠️ Tehnologii

### Frontend
- **React 18+** - UI framework
- **Vite** - Build tool și dev server
- **React Router** - Routing
- **Axios** - HTTP client
- **CSS Modules** - Stilizare modulară

### Backend
- **Laravel 12** - PHP framework
- **MySQL/PostgreSQL** - Baza de date
- **Sanctum** - Autentificare API
- **Eloquent ORM** - Database ORM

## 📋 Cerințe

### Backend
- PHP >= 8.2
- Composer
- MySQL/MariaDB sau PostgreSQL
- Node.js >= 18 (pentru build assets)
- Extensii PHP: `pdo`, `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `json`, `curl`, `fileinfo`

### Frontend
- Node.js >= 18
- npm sau yarn

## 🚀 Instalare și Setup

### 1. Clonează repository-ul

```bash
git clone https://github.com/yourusername/VoltaAcademy.git
cd VoltaAcademy
```

### 2. Setup Backend

```bash
cd volta-backend

# Instalează dependențele PHP
composer install

# Copiază fișierul de environment
cp env.template .env

# Generează cheia aplicației
php artisan key:generate

# Configurează baza de date în .env
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_DATABASE=volta_academy
# DB_USERNAME=your_username
# DB_PASSWORD=your_password

# Rulează migrările
php artisan migrate

# (Opțional) Populează baza de date cu date de test
php artisan db:seed

# Construiește assets-urile
npm install
npm run build
```

### 3. Setup Frontend

```bash
cd volta-frontend

# Instalează dependențele
npm install

# Copiază fișierul de environment
cp .env.example .env

# Configurează variabilele de mediu în .env
# VITE_API_URL=http://localhost:8000/api
```

### 4. Rulează aplicația

#### Backend (Terminal 1)
```bash
cd volta-backend
php artisan serve
```

#### Frontend (Terminal 2)
```bash
cd volta-frontend
npm run dev
```

Aplicația va fi disponibilă la:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000

## 🐳 Docker Deployment

Pentru deployment cu Docker, consultă [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md)

```bash
docker-compose up -d
```

## 📚 Documentație

- [Deployment Guide](./DEPLOYMENT.md) - Ghid complet de deployment
- [Docker Deployment](./DOCKER_DEPLOYMENT.md) - Deployment cu Docker
- [VPS Deployment](./VPS_DEPLOYMENT.md) - Deployment pe VPS
- [Backend Setup](./volta-backend/SETUP.md) - Setup detaliat backend
- [Backend Architecture](./volta-backend/LMS_ARCHITECTURE.md) - Arhitectura backend

## 🔐 Variabile de Mediu

### Backend (.env)
Vezi [env.template](./volta-backend/env.template) pentru template complet.

Variabile importante:
- `APP_KEY` - Cheia aplicației Laravel
- `DB_*` - Configurații baza de date
- `FRONTEND_URL` - URL-ul frontend-ului pentru CORS
- `GROQ_API_KEY` - Cheia API pentru integrarea AI (opțional)
- `MAIL_*` - Configurații email

### Frontend (.env)
- `VITE_API_URL` - URL-ul API-ului backend

## 🧪 Testing

### Backend
```bash
cd volta-backend
php artisan test
```

### Frontend
```bash
cd volta-frontend
npm run test
```

## 📝 Contribuții

Contribuțiile sunt binevenite! Te rugăm să:

1. Fork repository-ul
2. Creează un branch pentru feature (`git checkout -b feature/AmazingFeature`)
3. Commit schimbările (`git commit -m 'Add some AmazingFeature'`)
4. Push la branch (`git push origin feature/AmazingFeature`)
5. Deschide un Pull Request

## 📄 Licență

Acest proiect este proprietate privată. Toate drepturile rezervate.

## 👥 Echipa

Volta Academy Development Team

## 📞 Contact

Pentru întrebări sau suport, te rugăm să deschizi un issue în repository.

---

**Notă**: Asigură-te că nu comiți fișiere `.env` sau alte informații sensibile în repository. Folosește `.env.example` ca template.
