**A doua verificare generală — 10 septembrie 2026**

Am identificat 13 scenarii problematice suplimentare, reproduse prin 13 teste cu 44 de aserțiuni, și alte 5 constatări din verificarea codului/configurării. Prioritățile sunt autorizarea, protecția datelor la restaurare și izolarea versiunilor publicate.

Proiectul are deja modificări locale ample față de primul audit. Acest raport descrie starea verificată acum. Nu am modificat implementarea aplicației sau modificările existente; am adăugat acest raport și [GeneralAuditTest.php](GeneralAuditTest.php). Testele au folosit SQLite în memorie, fișiere temporare și storage simulat în probele noi care scriu fișiere. Nu am folosit date de producție sau livrare reală de email.

**Rezultatele verificărilor**

| Verificare | Rezultat |
| --- | --- |
| PHPUnit — suita curentă | 128 teste: 127 trecute, 1 omis; 558 aserțiuni |
| Regresiile primului audit, prin `ProcessAuditTest.php` | 31 teste trecute, 94 aserțiuni; sunt incluse și în suita curentă prin `ProcessIntegrityTest` |
| Probe noi de caracterizare | 13 teste trecute, 44 aserțiuni — confirmă comportamentele defecte |
| Frontend | 6 teste trecute |
| ESLint | Eșuat: 1 eroare și 50 avertismente |
| Build frontend | Reușit, 3,93 secunde |
| Docker / PostgreSQL real | Nu au fost rulate; Docker nu este disponibil local |
| Browser | Lansarea Chrome prin Puppeteer a eșuat; execuția HTML și fluxurile vizuale nu sunt declarate testate end-to-end |

Rulare pentru probele noi, din `volta-backend`:

```sh
DB_CONNECTION=sqlite DB_DATABASE=:memory: APP_ENV=testing MAIL_MAILER=array QUEUE_CONNECTION=sync vendor/bin/phpunit ../docs/audit-2026-09-10/GeneralAuditTest.php
```

**Atenție la interpretare:** `GeneralAuditTest.php` verifică existența defectelor. PASS în această suită înseamnă „problema a fost reprodusă”. După remediere, probele trebuie transformate în teste de regresie care cer comportamentul corect. `ProcessAuditTest.php` din primul audit a fost deja transformat într-un adaptor pentru teste de regresie; explicația lui din raportul istoric nu mai descrie implementarea actuală.

**Probleme reproduse — P1: remediere prioritară, P2: defect funcțional**

**1. P1 — Înregistrarea veche ocolește aprobarea și dezactivarea înregistrărilor.**

`POST /register`, ruta web legacy, continuă să creeze și să autentifice imediat utilizatori, chiar cu `registration_enabled=false`. Acceptă și parola simplă de șase caractere `abcdef`, în timp ce API-ul nou are reguli mai stricte. Proba a primit redirect la dashboard, utilizatorul nu era `pending` și sesiunea era autentificată.

Cod: [AuthController.php legacy](../../volta-backend/app/Http/Controllers/AuthController.php), `register`; [routes/web.php](../../volta-backend/routes/web.php). Probă: `test_legacy_register_ignores_disabled_registration_and_approval`.

Remediere: eliminarea rutelor legacy neutilizate sau delegarea către același serviciu de înregistrare și aceleași politici ca API-ul. Verificarea CSRF nu înlocuiește aprobarea contului.

**2. P1 — Un instructor poate muta un modul în cursul altui instructor.**

`PUT /api/admin/modules/{id}` verifică proprietarul modulului inițial, dar acceptă orice `course_id` existent ca destinație. Proba a mutat modulul într-un curs străin cu răspuns 200. Lecțiile lui au rămas cu vechiul `course_id`, deci structura devine inconsistentă.

Cod: [ModuleAdminController.php](../../volta-backend/app/Http/Controllers/Api/Admin/ModuleAdminController.php), `update`; [CourseBuilderService.php](../../volta-backend/app/Services/CourseBuilderService.php), `updateModule`. Probă: `test_instructor_can_move_module_into_another_instructors_course`.

Remediere: autorizarea sursei și destinației; mutare tranzacțională care actualizează lecțiile, testele și dependențele, sau interzicerea schimbării cursului prin endpointul generic de editare.

**3. P1 — Un instructor poate introduce propria lecție într-un modul străin.**

`PUT /api/admin/lessons/{id}` validează existența `module_id`, dar nu dreptul asupra destinației și nici concordanța cu `course_id`. Proba a legat lecția la modulul altui curs, păstrând cursul inițial pe lecție.

Cod: [LessonAdminController.php](../../volta-backend/app/Http/Controllers/Api/Admin/LessonAdminController.php), `update`. Probă: `test_instructor_can_move_lesson_into_foreign_module`.

Remediere: operație explicită de mutare, cu autorizare și consistență obligatorie între curs și modul. Validarea trebuie aplicată și administratorilor pentru a preveni coruperea accidentală a relațiilor.

**4. P1 — Cursul autorizat poate fi schimbat în corpul cererii de trimitere a testului.**

Reproducere: elev înscris numai la cursul A, test comun cu B. Deschiderea testului pentru B răspunde 403. Se deschide testul pentru A, apoi se trimite la `/api/exams/{id}/submit?course_id=A`, cu `course_id=B` în JSON. Cererea răspunde 200 și salvează rezultat promovat pentru B.

Cauză: autorizarea folosește cursul din query, apoi `submitTest` suprascrie variabila cu valoarea din body. Cod: [ExamController.php](../../volta-backend/app/Http/Controllers/Api/ExamController.php), `submit`, `submitTest`, zona `submittedCourseId`. Probă: `test_submit_body_course_bypasses_query_course_authorization`.

Remediere: normalizarea o singură dată a cursului; respingerea valorilor contradictorii; folosirea exclusivă a cursului încercării după identificarea ei.

**5. P1 — O încercare poate fi transferată de la un curs la altul prin `attempt_id`.**

Chiar când elevul are acces la ambele cursuri, poate deschide încercarea pentru A și trimite ID-ul acesteia în contextul B. Proba arată că rândul existent își schimbă `course_id` în B. Interogarea verifică utilizatorul și testul, dar nu cursul încercării.

Cod: [ExamController.php](../../volta-backend/app/Http/Controllers/Api/ExamController.php), căutarea după `attemptId` și actualizarea rezultatului. Probă: `test_attempt_can_be_reassigned_to_another_course_at_submit`.

Impact: istoric, limite de încercări și reguli amestecate între cursuri. Remediere: cursul încercării este imuabil; orice nepotrivire trebuie respinsă înaintea evaluării.

**6. P1 — Un backup invalid poate lăsa baza fără datele existente.**

Restaurarea șterge întâi rândurile existente, apoi inserează datele din fișier, fără tranzacție internă și fără validarea completă prealabilă. În proba cu o coloană invalidă, inserarea a aruncat excepție, iar utilizatorul existent era deja șters. Totul a fost demonstrat exclusiv în SQLite temporar.

Cod: [LmsBackupService.php](../../volta-backend/app/Services/LmsBackupService.php), `replaceTables`. Probă: `test_failed_backup_restore_leaves_existing_rows_deleted`.

Remediere: verificarea formatului, schemei și integrității înainte de scriere; tranzacție pentru restaurarea datelor; recuperare sigură dacă etapa fișierelor eșuează. Pentru operațiunea reală: validare într-o bază separată înainte de înlocuire.

**7. P1 — Două backupuri în aceeași secundă se suprascriu.**

Directorul este numit doar cu `Ymd_His`. Două apeluri cu același timestamp întorc aceeași cale. Proba arată că primul backup ajunge să conțină datele celui de-al doilea.

Cod: [LmsBackupService.php](../../volta-backend/app/Services/LmsBackupService.php), `createBackup`. Probă: `test_two_backups_in_same_second_overwrite_previous_backup`.

Remediere: identificator unic, director temporar și finalizare atomică după validare; blocarea execuțiilor suprapuse.

**8. P1 — Biblioteca păstrează HTML executabil care ajunge la cititor.**

Proba a salvat un articol cu atribut HTML `onerror` prin API-ul de administrare și a verificat că elevul primește același atribut. [LibraryReaderPage.jsx](../../volta-frontend/src/pages/LibraryReaderPage.jsx) introduce `item.body` direct prin `dangerouslySetInnerHTML`.

Cod: [LibraryController.php](../../volta-backend/app/Http/Controllers/Api/LibraryController.php), `storeTextItem`; pagina cititorului. Probă: `test_library_retains_executable_html_for_student_reader`.

Impact: risc de XSS persistent prin conținut introdus sau importat de un autor; acțiuni în sesiunea cititorului dacă browserul execută acel HTML. Persistența și expunerea atributului sunt demonstrate; execuția în aplicația reală nu a fost verificată, deoarece Chrome nu a pornit. Remediere: sanitizare HTML prin listă explicită de elemente/atribute/protocoale permise, aplicată la salvare și afișare; auditarea celorlalte utilizări `dangerouslySetInnerHTML`.

**9. P1 — Ștergerea unei lecții în draft rupe versiunea publicată.**

Reproducere: curs publicat, snapshot publicat, elev înscris; lecția răspunde 200. Ștergerea prin `CourseBuilderService` trece cursul în `editing`, dar următoarea accesare a lecției de către elev răspunde 404, înaintea unei republicări.

Cauză: `LessonController::show` caută mai întâi lecția în tabela curentă; snapshotul este aplicat abia după `findOrFail`. Cod: [LessonController.php](../../volta-backend/app/Http/Controllers/Api/LessonController.php), [CourseBuilderService.php](../../volta-backend/app/Services/CourseBuilderService.php). Probă: `test_deleting_live_lesson_in_draft_breaks_student_url`.

Remediere: versiune publicată cu entități independente de draft sau rezolvarea integrală din snapshot inclusiv pentru lecțiile șterse. Progresul și fișierele acelei versiuni trebuie păstrate până la migrarea controlată.

**10. P1 — Pragul salvat la începutul încercării este ignorat la evaluarea automată.**

Reproducere: test deschis cu prag 90, verificat în `passing_score_applied`; testul este editat la prag 70; elevul obține 80%. Trimiterea promovează elevul și suprascrie pragul istoric cu 70.

Cod: [ExamController.php](../../volta-backend/app/Http/Controllers/Api/ExamController.php), rezolvarea `passingScore` și payloadul rezultatului. Probă: `test_passing_threshold_snapshot_is_overwritten_at_submit`.

Remediere: evaluarea folosește pragul și regulile înghețate ale încercării. Modificările ulterioare se aplică doar încercărilor noi, dacă nu există o recalculare administrativă explicită și auditată.

**11. P2 — Adminul nu poate trimite testul în previzualizare.**

Proba deschide un test cu întrebări ca administrator, apoi trimite răspunsul corect. Serverul răspunde 400: „Testul nu are întrebări disponibile.” Rolurile exceptate de la progres nu primesc încercare persistentă, iar lista întrebărilor din submit rămâne goală.

Cod: [ExamController.php](../../volta-backend/app/Http/Controllers/Api/ExamController.php), `submitTest`. Probă: `test_staff_preview_cannot_submit_nonempty_test`.

Remediere: cale de evaluare pentru preview care încarcă întrebările și produce rezultat fără a modifica statisticile cursanților.

**12. P2 — Eliminarea videoclipului prin `null` este ignorată.**

Cererea cu `video_url=null` răspunde „actualizat”, dar URL-ul vechi rămâne. `array_filter(... !== null)` elimină intenția de ștergere. Același mecanism afectează și alte câmpuri nullable din endpoint.

Cod: [LessonAdminController.php](../../volta-backend/app/Http/Controllers/Api/Admin/LessonAdminController.php), construirea `updateData`. Probă: `test_null_does_not_clear_lesson_video`.

Remediere: diferențiere între câmp absent și câmp trimis explicit cu `null`; teste pentru eliminarea video, prerechizitelor și mutarea lecției la rădăcina cursului.

**13. P2 — Două încărcări de avatar în aceeași secundă șterg fișierul curent.**

Numele este `userId_timestamp.ext`. Al doilea upload cu aceeași extensie scrie în aceeași cale, apoi șterge „avatarul vechi”, adică exact fișierul tocmai scris. Proba verifică faptul că răspunsul este 200, calea rămâne în profil, dar fișierul nu mai există.

Cod: [ProfileController.php](../../volta-backend/app/Http/Controllers/Api/ProfileController.php), `updateAvatar`. Probă: `test_two_avatar_uploads_in_same_second_delete_current_file`.

Remediere: nume unic pentru fiecare upload și ștergerea vechiului fișier după persistența noii referințe, numai dacă diferă căile.

**Alte constatări din cod și configurare**

**14. P2 — Lint blochează CI.** În [NoteTakingSystem.jsx](../../volta-frontend/src/components/student/NoteTakingSystem.jsx), linia 40, `setNotesLoaded(false)` sincron în efect încalcă `react-hooks/set-state-in-effect`. Rularea efectivă a produs 1 eroare și 50 avertismente. Workflow-ul execută lint înainte de test/build, deci buildul local reușit nu compensează eroarea. Recomand: restructurarea inițializării pe schimbarea identității editorului, păstrând protecția pentru încărcarea asincronă.

**15. P1 — Testul pretins de concurență nu testează concurența reală.** [ConcurrentExamSubmitTest.php](../../volta-backend/tests/Feature/ConcurrentExamSubmitTest.php) are un test cu două deschideri secvențiale. Al doilea test face skip în afara MySQL, iar pe MySQL execută numai `assertTrue(true)`. Configurația Compose folosește PostgreSQL. Recomand: două procese/conexiuni reale, sincronizate, pe motorul de producție; verificarea unei singure finalizări, a numărului de încercări și a rezultatului idempotent.

**16. P2 — Backupul programat nu are un proces de scheduler în Compose.** Programarea `hourly()` este prezentă în `bootstrap/app.php`, dar serviciile Compose pornesc PHP-FPM și queue worker, fără `schedule:run`/`schedule:work`. Nu am găsit configurare de cron pentru backup în scripturile inspectate. Un cron extern poate exista pe VPS, însă nu a fost verificat. Recomand: scheduler explicit, monitorizarea ultimei execuții și alertă dacă backupul nu s-a produs la timp.

**17. P2 — Nginx din configurația Compose de bază nu vede storage-ul încărcat.** Backendul scrie în volumul `backend_storage`; `nginx-backend` montează directorul public de pe host, fără acel volum. Fișierele statice precum PNG sunt tratate de o locație Nginx fără fallback Laravel. Rezultatul așteptat în această topologie este 404 pentru imaginile încărcate în volumul backend, dacă nu există un mount extern suplimentar. Override-ul de producție trebuie verificat prin configurația Compose combinată. Nu am pornit containerele. Recomand: volum public comun montat read-only la Nginx și test de upload → URL public în container.

**18. P2 — Rutele web legacy indică și o metodă inexistentă.** [routes/web.php](../../volta-backend/routes/web.php) declară GET/POST `/lessons/{id}/complete` către `LessonController::complete`, însă metoda a fost eliminată din [controllerul legacy](../../volta-backend/app/Http/Controllers/LessonController.php). Ruta GET este declarată fără autentificare. Recomand: eliminarea rutelor moarte și verificare automată că fiecare rută are handler existent; mutările de progres trebuie să rămână pe endpointuri protejate cu metode de scriere.

**Ordinea recomandată**

1. Închide ruta legacy de înregistrare și repară autorizarea destinațiilor pentru cursuri/module/lecții/încercări.
2. Protejează restaurarea backupului înainte de utilizarea pe date reale; previne suprascrierea backupurilor.
3. Sanitizează conținutul HTML și repară izolarea versiunii publicate la ștergere.
4. Folosește regulile încercării la evaluare și repară preview-ul administrativ.
5. Repară lint, eliminarea câmpurilor, avatarurile și verifică schedulerul/storage-ul în staging.

Acest audit nu certifică lipsa altor probleme. Acoperirea este bună pentru scenariile reproduse, dar testarea de concurență pe PostgreSQL, restaurarea completă DB + fișiere și navigarea reală în browser rămân necesare înaintea unei validări de producție.
