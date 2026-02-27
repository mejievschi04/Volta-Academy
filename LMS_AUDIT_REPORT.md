# Raport audit LMS – Volta Academy

- **API:** http://localhost:8000/api
- **Autentificare admin:** Da
- **Dată:** 2026-02-23T10:13:11.031Z
- **Durată:** 4110 ms

## Rezumat
- Total verificări: **21**
- Reușite: **21**
- Eșuate: **0**

---

## Autentificare admin

- ✅ **Login admin**: OK academy@volta.md

## Auth (public)

- ✅ **Auth: login respinge credențiale invalide**: OK
- ✅ **Auth: /auth/me neautentificat returnează 401**: OK

## API public

- ✅ **Public: GET /courses returnează listă**: OK
- ✅ **Public: GET /events returnează listă**: OK

## Admin (fără auth)

- ✅ **Admin: rutele admin cer autentificare**: OK

## Admin (autentificat)

- ✅ **Admin: listă cursuri**: OK 4 cursuri
- ✅ **Admin: builder structure returnează module**: OK
- ✅ **LMS: lecții au titlu**: OK
- ✅ **Admin: listă teste**: OK
- ✅ **Admin: listă bănci întrebări**: OK
- ✅ **Admin: reguli progresie curs**: OK

## Model curs (LMS)

- ✅ **LMS: curs are titlu**: OK
- ✅ **LMS: curs are status/publicare**: OK

## Content blocks (LMS)

- ✅ **LMS: content block are tip**: OK

## Progresie & acces (LMS)

- ✅ **LMS: reguli progresie returnează array**: OK

## Integritate date LMS

- ✅ **LMS integritate**: OK Module/lecții au id și titlu (eșantion)

## Flux student

- ✅ **Student: dashboard endpoint răspunde**: OK OK
- ✅ **Student: progress curs răspunde**: OK

## Examene / Teste

- ✅ **LMS: există exams sau tests**: OK tests
- ✅ **LMS: test are endpoint întrebări**: OK

## Status: toate verificările au trecut.