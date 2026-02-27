# Scripts Volta Academy

## Audit LMS – `test-lms-audit.js`

Scriptul verifică aplicația (API backend) din perspectiva unui LMS și raportează **ce nu e în regulă**.

### Ce verifică

- **Auth:** login cu credențiale greșite returnează 401/422, `/auth/me` fără sesiune returnează 401.
- **API public:** `GET /courses`, `GET /events` returnează listă.
- **Admin:** rutele `/admin/*` cer autentificare (401/403 fără token/sesiune).
- **Admin (cu auth):** listă cursuri, structură builder (module, lecții), listă teste, listă bănci întrebări, reguli progresie.
- **Model curs (LMS):** cursuri au titlu și câmp status/publicare.
- **Content blocks (LMS):** blocuri de conținut au câmp `type`.
- **Progresie:** endpoint reguli progresie pentru curs.
- **Integritate date:** lecții au `id` și `title` (eșantion).
- **Flux student:** dashboard, progress curs răspund.
- **Examene/Teste:** există listă exams sau tests; test are endpoint pentru întrebări.

### Rulare

Backend-ul trebuie să fie pornit (ex. `php artisan serve` în `volta-backend`).

```bash
# Din root-ul proiectului
node scripts/test-lms-audit.js
```

Cu URL API și (opțional) cont admin pentru verificări complete:

```bash
# Windows (PowerShell)
$env:API_URL="http://localhost:8000/api"; $env:LMS_TEST_ADMIN_EMAIL="admin@example.com"; $env:LMS_TEST_ADMIN_PASSWORD="parola"; node scripts/test-lms-audit.js

# Linux / macOS
API_URL=http://localhost:8000/api LMS_TEST_ADMIN_EMAIL=admin@example.com LMS_TEST_ADMIN_PASSWORD=parola node scripts/test-lms-audit.js
```

Variabile de mediu:

| Variabilă | Descriere | Implicit |
|-----------|-----------|----------|
| `API_URL` sau `VITE_API_URL` | URL de bază pentru API (fără / la final) | `http://localhost:8000/api` |
| `LMS_TEST_ADMIN_EMAIL` | Email cont admin (pentru verificări autentificate) | — |
| `LMS_TEST_ADMIN_PASSWORD` | Parolă cont admin | — |

### Rezultat

- În consolă: raportul în Markdown.
- Fișier **`LMS_AUDIT_REPORT.md`** în root-ul proiectului (suprascris la fiecare rulare).
- Exit code: `0` dacă toate verificările au trecut, `1` dacă există eșecuri, `2` la eroare de execuție.

### Ce nu e în regulă (LMS)

La final, raportul listează toate verificările eșuate sub **„Ce nu e în regulă (LMS)”**. Remediați punctele indicate și relansați scriptul.
