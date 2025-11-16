# Setup Instructions - Volta Academy

## ⚠️ Prerechizite

**IMPORTANT:** Înainte de a continua, asigură-te că ai instalat:
- **PHP 8.1+** (vezi `INSTALL_PHP.md` pentru instrucțiuni)
- **Composer** (vezi https://getcomposer.org/download/)
- **Node.js** (vezi https://nodejs.org/)

Dacă PHP nu este instalat, vezi fișierul `INSTALL_PHP.md` pentru instrucțiuni detaliate.

## Backend Setup

1. Navigate to the backend directory:
```bash
cd volta-backend
```

2. Install PHP dependencies:
```bash
composer install
```

3. Set up the database:
```powershell
# On Windows PowerShell
.\setup-db.ps1

# Or manually:
# Create .env file if it doesn't exist
copy .env.example .env

# Generate application key
php artisan key:generate

# Create database file
# Make sure database/database.sqlite exists (or create it)

# Run migrations
php artisan migrate

# Seed the database with initial data
php artisan db:seed
```

4. Start the backend server:
```bash
php artisan serve
```

The backend will run on `http://localhost:8000`

## Frontend Setup

1. Navigate to the frontend directory:
```bash
cd volta-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## API Endpoints

### Public Endpoints:
- `GET /api/courses` - Get all courses
- `GET /api/courses/{id}` - Get a specific course
- `GET /api/lessons` - Get all lessons (optional: `?course_id={id}`)
- `GET /api/lessons/{id}` - Get a specific lesson

### Dashboard & Progress:
- `GET /api/dashboard` - Get dashboard data with stats
- `POST /api/lessons/{id}/complete` - Mark a lesson as completed
- `GET /api/courses/{courseId}/progress/{userId}` - Get progress for a course

## Database

The application uses SQLite by default. The database file is located at:
`volta-backend/database/database.sqlite`

The seeder will create:
- 3 teachers
- 2 students
- 6 courses with lessons
- Rewards

## Notes

- CORS is configured to allow requests from `http://localhost:5173`
- Authentication is currently disabled for testing purposes
- The default student user is automatically created/used when needed

