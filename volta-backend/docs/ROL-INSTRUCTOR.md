# Rol: Instructor

Rolul **instructor** permite utilizatorilor să creeze și să gestioneze **doar cursuri** și **teste** (inclusiv bănci de întrebări), fără acces la utilizatori, echipe, evenimente, setări sau jurnal de activitate.

## Permisiuni

- **Cursuri**: CRUD doar pentru cursurile unde utilizatorul este `teacher_id` (inclusiv builder, module, lecții, reguli de progresie, atașare teste).
- **Teste**: CRUD doar pentru testele create de el (`created_by`).
- **Bănci de întrebări**: CRUD doar pentru băncile create de el (`created_by`).
- **Examene** (legacy): doar pentru cursurile unde este `teacher_id`.
- **Media**: listare și ștergere doar pentru fișierele încărcate de el.

## Restricții (doar admin)

- Gestionare utilizatori, echipe, evenimente.
- Setări platformă, jurnal activitate, export/import, clear cache.
- Generare AI cursuri/teste.

## Cum se setează rolul

- În baza de date: `users.role = 'instructor'`.
- Un admin poate seta rolul unui utilizator din panoul de administrare (când va fi implementat în frontend) sau direct în DB.

## Middleware

- Rutele din prefixul `/admin` folosesc `AdminOrInstructorMiddleware`: sunt acceptați atât `admin` cât și `instructor`.
- Controller-ele care sunt doar pentru admin (users, teams, events, settings, activity log) returnează 403 pentru instructor.
