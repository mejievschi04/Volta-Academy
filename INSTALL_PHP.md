# Instalare PHP pe Windows

Există mai multe moduri de a instala PHP pe Windows. Iată cele mai simple opțiuni:

## Opțiunea 1: Laravel Herd (Recomandat pentru Laravel) ⭐

Laravel Herd este cel mai simplu mod de a rula Laravel pe Windows.

1. **Descarcă Laravel Herd:**
   - Accesează: https://herd.laravel.com/windows
   - Descarcă și instalează Herd

2. **După instalare:**
   - Herd include PHP, Composer și toate dependențele
   - Nu mai trebuie să instalezi nimic altceva

3. **Verifică instalarea:**
```powershell
php -v
composer -v
```

## Opțiunea 2: XAMPP (Cel mai popular)

1. **Descarcă XAMPP:**
   - Accesează: https://www.apachefriends.org/download.html
   - Descarcă versiunea pentru Windows (include PHP, MySQL, Apache)

2. **Instalează XAMPP:**
   - Rulează instalatorul
   - Alege locația de instalare (de obicei `C:\xampp`)

3. **Adaugă PHP la PATH:**
   - Deschide "Variabile de mediu" (Environment Variables)
   - Adaugă la PATH: `C:\xampp\php`
   - Sau rulează în PowerShell (ca Administrator):
```powershell
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\xampp\php", "User")
```

4. **Verifică:**
```powershell
php -v
```

## Opțiunea 3: Chocolatey (Package Manager)

1. **Instalează Chocolatey** (dacă nu îl ai):
   - Deschide PowerShell ca Administrator
   - Rulează:
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

2. **Instalează PHP:**
```powershell
choco install php
```

3. **Verifică:**
```powershell
php -v
```

## Opțiunea 4: Instalare manuală

1. **Descarcă PHP:**
   - Accesează: https://windows.php.net/download/
   - Descarcă "VS16 x64 Non Thread Safe" (ZIP)

2. **Extrage PHP:**
   - Extrage în `C:\php`

3. **Configurează:**
   - Copiază `php.ini-development` ca `php.ini`
   - Editează `php.ini` și activează extensiile necesare:
     - `extension=mbstring`
     - `extension=openssl`
     - `extension=pdo_sqlite`
     - `extension=sqlite3`

4. **Adaugă la PATH:**
```powershell
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\php", "User")
```

5. **Verifică:**
```powershell
php -v
```

## După instalarea PHP

1. **Instalează Composer:**
   - Descarcă: https://getcomposer.org/download/
   - Rulează instalatorul Windows

2. **Verifică instalarea:**
```powershell
php -v
composer -v
```

3. **Continuă cu setup-ul backend:**
```powershell
cd volta-backend
composer install
.\setup-db.ps1
php artisan serve
```

## Verificare rapidă

După instalare, rulează:
```powershell
php -v
composer --version
```

Ar trebui să vezi versiunile instalate.

## Notă importantă

După instalarea PHP, **închide și redeschide PowerShell** pentru ca modificările PATH să fie aplicate.

