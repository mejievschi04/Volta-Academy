# Audit examene/teste + checklist prioritar

## Stare actuala

### Examene (tab `exams` in content admin)

| Strat | Implementat | Observatii |
| --- | --- | --- |
| UI admin | `volta-frontend/src/pages/admin/AdminExamsPage.jsx` | Lista, creare, setari, acces, verificare manuala, statistica, publicare |
| Rutare | `volta-frontend/src/pages/admin/AdminContentPage.jsx` | Activ pe `?tab=exams` |
| API admin | `volta-backend/routes/api.php` (`/admin/exams/*`) | CRUD, cover, rezultate, pending reviews, manual review |
| Elev | `volta-frontend/src/pages/ExamPage.jsx` | Sustinere, timer, rezultat, retry |
| Model | `volta-backend/app/Models/Exam.php` | `settings` JSON + campuri clasice (`passing_score`, `max_attempts`, etc.) |

### Teste standalone (tab nou propus `tests`)

| Strat | Implementat | Observatii |
| --- | --- | --- |
| API admin | `volta-backend/routes/api.php` (`/admin/tests/*`) | CRUD, publicare, selectie intrebari, link/unlink cu cursuri |
| Client API | `volta-frontend/src/services/api.js` (`adminService.getTests`, `createTest`, etc.) | Metode deja disponibile |
| UI admin dedicat | Lipseste in `AdminContentPage` | Necesita tab + lista/edit minimal |
| Elev | Fluxuri prin `QuizPage`/widget-uri | Separat de `ExamPage` |

### Curs -> quiz la creare

`volta-frontend/src/components/admin/courses/CourseCreationWizard.jsx` include creare quiz in pasul de evaluare, cu creare test/intrebari + attach la curs/lectie.

## MVP prioritar

1. UI admin pentru teste standalone (`?tab=tests`).
2. Camp dedicat pentru instructiuni elev in examene.
3. Preview examen in admin fara salvare rezultat.
4. Aliniere feedback examen (`instant`, `final`, fara feedback) intre admin si pagina elevului.

## V2 (ulterior)

1. Analiza per intrebare in statistici.
2. Duplicare/sabloane examene.
3. Accomodari (timp suplimentar, reguli pe elev/grup).
4. Notificari la publicare.
5. Rubrici pentru raspunsuri deschise.
6. Integritate avansata (proctoring/restrictii browser).
