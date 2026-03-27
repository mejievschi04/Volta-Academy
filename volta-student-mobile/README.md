# Volta Student Mobile (React Native / Expo)

Aplicație mobilă **doar pentru student** conectată la același backend ca și `volta-frontend`.

## Autentificare

Pe mobil se folosește **token Sanctum** (`Authorization: Bearer …`), trimis automat de app după login. Header `X-Volta-Client: mobile` cere token la `POST /auth/login`.

## Test local (backend + app)

1) **Backend** (din `volta-backend`):

```powershell
composer install
php artisan migrate
php artisan serve --host=0.0.0.0 --port=8000
```

(`0.0.0.0` permite conexiuni de pe telefon / emulator la IP-ul PC-ului.)

2) **Mobil** – în `__DEV__`, app-ul încearcă singur URL-ul corect:

- folosește **IP-ul din Metro** (`expoConfig.hostUri`) → `http://<acelasi-ip>:8000/api` (bine pentru **telefon fizic** pe același Wi‑Fi);
- dacă nu e host detectat: **Android emulator** → `10.0.2.2`, **iOS simulator** → `127.0.0.1`.

Override oricând:

```powershell
$env:EXPO_PUBLIC_API_URL="http://192.168.0.10:8000/api"
```

Apoi:

```powershell
cd volta-student-mobile
npm install
npm run start:dev-client
```

În `.env` backend, pentru SPA local, poți avea `SANCTUM_STATEFUL_DOMAINS=localhost,localhost:5173,127.0.0.1` (nu afectează token-ul mobil).

## Configurare API (producție)

Implicit, în build **production** (`__DEV__` false), app folosește `https://academy.volta.md/api`.

Suprascriere manuală (PowerShell):

```powershell
$env:EXPO_PUBLIC_API_URL="https://academy.volta.md/api"
npm start
```

## Build instalabil (DEV APK)

```powershell
cd volta-student-mobile
eas login
eas build -p android --profile dev-apk
```

În `volta-student-mobile/` există `.easignore` (exclude cache-uri mari la upload).

## Ecrane (student)

- Login
- Home (statistici din `/profile`)
- Cursuri (`/courses`)
- Detalii curs (`/courses/{id}`) + listă module/lecții
- Lecție (`/lessons/{id}` + access check `/lessons/{id}/access`)
