# Migrare de la SQLite la MySQL

Acest ghid te ajută să migrezi baza de date de la SQLite la MySQL.

## Pași pentru migrare

### 1. Instalează MySQL

Asigură-te că ai MySQL instalat și pornit pe sistemul tău.

### 2. Configurează conexiunea MySQL

#### Opțiunea A: Folosește scriptul automat (recomandat)

```powershell
cd volta-backend
.\setup-mysql.ps1
```

Scriptul va:
- Crea sau actualiza fișierul `.env`
- Configura variabilele de conexiune MySQL
- Încerca să creeze baza de date automat

#### Opțiunea B: Configurare manuală

Editează fișierul `.env` și actualizează următoarele variabile:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=volta_academy
DB_USERNAME=root
DB_PASSWORD=your_password
```

### 3. Creează baza de date MySQL

Conectează-te la MySQL și creează baza de date:

```sql
CREATE DATABASE volta_academy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Sau folosește MySQL Workbench, phpMyAdmin sau orice alt client MySQL.

### 4. Rulează migrările

```powershell
cd volta-backend
php artisan migrate
```

Aceasta va crea toate tabelele în baza de date MySQL.

### 5. (Opțional) Exportă datele din SQLite și importă în MySQL

Dacă ai date existente în SQLite pe care vrei să le migrezi:

#### Export din SQLite

```powershell
# Instalează sqlite3 dacă nu este deja instalat
# Apoi exportă datele
sqlite3 database/database.sqlite .dump > sqlite_dump.sql
```

#### Convert și import în MySQL

**Notă:** SQLite și MySQL au sintaxe diferite, deci va trebui să ajustezi manual dump-ul sau să folosești un tool de conversie.

Alternativ, poți folosi un tool precum:
- [SQLite to MySQL Converter](https://www.rebasedata.com/)
- Sau exportă datele manual prin API/seeders

### 6. Verifică conexiunea

Testează conexiunea:

```powershell
php artisan tinker
```

Apoi în tinker:
```php
DB::connection()->getPdo();
// Ar trebui să returneze un obiect PDO fără erori
```

### 7. Rulează seeders (opțional)

Dacă vrei să populezi baza de date cu date de test:

```powershell
php artisan db:seed
```

## Verificare

După migrare, verifică că totul funcționează:

1. Pornește serverul Laravel: `php artisan serve`
2. Testează API-urile
3. Verifică în MySQL că tabelele au fost create: `SHOW TABLES;`

## Revenire la SQLite (dacă este necesar)

Dacă vrei să revii la SQLite, actualizează `.env`:

```env
DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite
```

Și șterge variabilele MySQL (DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD).

## Probleme comune

### Eroare: "Access denied for user"
- Verifică că utilizatorul și parola sunt corecte
- Verifică că utilizatorul are permisiuni pentru baza de date

### Eroare: "Unknown database"
- Asigură-te că baza de date a fost creată
- Verifică că numele bazei de date din `.env` este corect

### Eroare: "PDOException: could not find driver"
- Instalează extensia PHP pentru MySQL: `php -m | grep pdo_mysql`
- Pe Windows, dezarhivează `php_pdo_mysql.dll` în directorul PHP și activează în `php.ini`

