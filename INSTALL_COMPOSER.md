# Instalare Composer pe Windows

Composer este necesar pentru a instala dependențele PHP ale proiectului Laravel.

## Metoda 1: Instalator Windows (Recomandat) ⭐

1. **Descarcă instalatorul Composer:**
   - Accesează: https://getcomposer.org/download/
   - Click pe "Composer-Setup.exe" pentru Windows
   - Sau direct: https://getcomposer.org/Composer-Setup.exe

2. **Rulează instalatorul:**
   - Instalatorul va detecta automat PHP-ul instalat
   - Alege opțiunile default
   - Composer va fi adăugat automat în PATH

3. **Verifică instalarea:**
```powershell
composer --version
```

## Metoda 2: Instalare manuală (via PowerShell)

1. **Descarcă Composer installer:**
```powershell
cd volta-backend
.\install-composer.ps1
```

2. **Sau manual:**
```powershell
# Descarcă installer-ul
Invoke-WebRequest -Uri "https://getcomposer.org/installer" -OutFile composer-setup.php

# Rulează installer-ul
php composer-setup.php

# Șterge installer-ul
Remove-Item composer-setup.php
```

3. **Folosește Composer:**
```powershell
# Local (din directorul unde este composer.phar)
php composer.phar install

# Sau mută composer.phar în PATH pentru folosire globală
```

## Metoda 3: Chocolatey

Dacă ai Chocolatey instalat:
```powershell
choco install composer
```

## Verificare

După instalare, verifică:
```powershell
composer --version
# Sau dacă ai instalat local:
php composer.phar --version
```

Ar trebui să vezi ceva de genul:
```
Composer version 2.x.x
```

## Următorii pași

După instalarea Composer, continuă cu setup-ul backend-ului:
```powershell
cd volta-backend
composer install
.\setup-db.ps1
php artisan serve
```

## Notă

Dacă folosești `composer.phar` local (nu global), înlocuiește `composer` cu `php composer.phar` în toate comenzile.

