# Migrare Utilizatori din SQLite în MySQL

Acest ghid te ajută să migrezi datele utilizatorilor din baza de date SQLite în MySQL.

## Pași pentru migrare

### 1. Asigură-te că MySQL este configurat

Verifică că `.env` este configurat corect pentru MySQL:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=volta_academy
DB_USERNAME=root
DB_PASSWORD=your_password
```

### 2. Rulează migrările

Asigură-te că toate migrările au fost rulate în MySQL:

```powershell
cd volta-backend
php artisan migrate
```

### 3. Verifică că fișierul SQLite există

Scriptul va căuta fișierul `database/database.sqlite`. Asigură-te că există.

### 4. Rulează scriptul de migrare

```powershell
cd volta-backend
php migrate-users-to-mysql.php
```

Scriptul va:
- Conecta la SQLite și citi toți utilizatorii
- Verifica dacă utilizatorii există deja în MySQL (după email)
- Importa doar utilizatorii noi
- Afișa un rezumat al migrării

## Notițe importante

- **Parolele**: Parolele hash-uite din SQLite vor fi păstrate așa cum sunt în MySQL
- **Duplicate**: Utilizatorii cu același email vor fi omiși (nu vor fi duplicați)
- **ID-uri**: ID-urile vor fi generate automat de MySQL (nu vor păstra ID-urile din SQLite)
- **Timestamp-uri**: Timestamp-urile `created_at` și `updated_at` vor fi păstrate dacă există în SQLite

## Verificare după migrare

După migrare, verifică că utilizatorii au fost importați corect:

```powershell
php artisan tinker
```

Apoi în tinker:
```php
DB::table('users')->count();
// Ar trebui să returneze numărul de utilizatori importați
```

## Probleme comune

### Eroare: "Tabelul 'users' nu există în MySQL"
- Soluție: Rulează `php artisan migrate` pentru a crea tabelele

### Eroare: "Fișierul SQLite nu există"
- Soluție: Verifică că fișierul `database/database.sqlite` există

### Eroare: "Duplicate entry for key 'users_email_unique'"
- Soluție: Scriptul ar trebui să evite duplicatele automat, dar dacă apare, înseamnă că există deja utilizatori cu același email

