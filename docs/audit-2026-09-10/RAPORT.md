**Audit procese Volta Academy — 10 septembrie 2026**

Aplicația are probleme de control al accesului, integritate a evaluării și păstrare a conținutului. Prioritatea este corectitudinea fluxurilor de învățare și administrare, înaintea extinderii funcțiilor.

Analiza acoperă rutele API, implementările principale frontend/backend și testele existente. Am reprodus 16 scenarii problematice prin teste izolate cu SQLite în memorie. Nu am modificat logica aplicației, nu am folosit baza de producție și nu am trimis emailuri reale. Verificarea nu include parcurgerea tuturor ecranelor într-un browser, concurență reală pe MySQL, livrare SMTP sau furnizori AI reali. Pentru zonele verificate numai prin citirea codului, concluziile sunt marcate separat.

**Dovezi și verificări**

| Verificare | Rezultat |
| --- | --- |
| Suita backend existentă | 90 teste trecute, 413 aserțiuni |
| Suita frontend existentă | 6 teste trecute |
| ESLint | 0 erori, 50 avertismente |
| Build frontend | Reușit, 4,08 secunde |
| Probe suplimentare pentru audit | 16 scenarii reproduse, 35 aserțiuni |

Probele sunt în [ProcessAuditTest.php](ProcessAuditTest.php). Sunt teste de caracterizare: **PASS înseamnă că bugul descris a fost reprodus**, nu că funcționalitatea este corectă. Au fost păstrate în documentație, separat de suita CI. La remediere, aserțiunile trebuie convertite în comportamentul corect și mutate în suita de regresie.

Rulare din `volta-backend`, cu baza temporară și transporturile izolate:

```sh
DB_CONNECTION=sqlite DB_DATABASE=:memory: APP_ENV=testing MAIL_MAILER=array QUEUE_CONNECTION=sync vendor/bin/phpunit ../docs/audit-2026-09-10/ProcessAuditTest.php
```

**Harta proceselor și acoperirea auditului**

| Proces | Ce am verificat | Concluzie |
| --- | --- | --- |
| Înregistrare → aprobare → autentificare → suspendare | Controller, middleware, teste auth, probe API | Suspendarea și oprirea înregistrărilor nu sunt aplicate consecvent |
| Invitație → activare cont → asociere echipă | Serviciu, acceptare, teste existente | Token hash, expirare și blocare tranzacțională prezente; livrarea externă rămâne de verificat |
| Creare curs → module → lecții → editare | Builder, validator, autosave, teste existente | Validarea conținutului și salvarea la erori au puncte slabe |
| Validare → review → publicare → distribuire | Publicare builder, servicii, probe API | Poate publica teste goale; workflow-ul nu oferă izolare completă a versiunii publicate |
| Duplicare → versiuni → restaurare | Servicii și probe directe | Lecțiile fără modul se pierd în cursul rezultat |
| Catalog → mape → echipe → înscriere | Rute, servicii de vizibilitate/progres și suitele existente | Testele de catalog trec; autorizarea operațiilor de învățare are scăpări |
| Parcurgere → deblocare → progres → finalizare | Motor progres, controllere și probe | Dependențe între cursuri fără legătură; API poate accepta progres neautorizat |
| Creare test → bancă întrebări → publicare | Servicii, administrare întrebări, legare la curs | Publicarea prin curs ocolește validarea testului; lipsește înghețarea întrebărilor pe încercare |
| Susținere test → temporizare → trimitere → reîncercare | ExamPage, ExamController, probe API | Timpul și deblocarea nu sunt impuse la trimitere; soluțiile pot fi expuse |
| Corectare manuală → rezultat → promovare | TestAdminController și probe API | Prag greșit și punctaj care poate depăși 100% |
| Eveniment → înscriere → participare → replay | Rute, model, controller și probe API | Rută inaccesibilă, linkuri expuse și prezență înainte de începere |
| Mesagerie → grupuri → citire | Controller, model și probă API | Citirea unui membru afectează toți membrii |
| Bibliotecă → ghiduri → fișiere media | Control acces, serializare și ștergere | Controale de rol prezente; ștergerea media necesită verificarea utilizărilor |
| Notițe → salvare → recuperare offline | Frontend și API | Fallback local neizolat pe utilizator și eșecuri de salvare absorbite |
| Notificări → emailuri | Controllere, servicii, teste existente | Separare per utilizator și coadă prezente; lipsesc aici probe externe de livrare |
| Statistici → activitate → realizări | Servicii de progres, agregate și teste existente | Datele pot fi contaminate de progres arbitrar și scoruri incorecte |
| Setări → export → import → backup | Controller și căutare a consumatorilor setărilor | Export/import incomplet; unele comutatoare sunt doar persistate |
| Volt / generare AI | Rute, autorizare, configurare și teste de disponibilitate | Acoperire parțială; calitatea generării și erorile furnizorului nu au fost testate live |

**Buguri demonstrate**

P1 = de corectat prioritar: acces, conținut pierdut sau evaluare incorectă. P2 = defect funcțional important, fără aceeași urgență. Numerotarea grupează duplicarea și restaurarea într-o singură constatare, de aceea 16 probe susțin 15 constatări.

**1. P1 — Contul suspendat continuă să acceseze API-ul.**

Reproducere: utilizator cu `status=suspended`, token Sanctum valid, `GET /api/auth/me` → 200 și profilul utilizatorului. Loginul verifică explicit `pending`, dar nu `suspended`; middleware-ul API nu impune status activ. Suspendarea administrativă schimbă statusul fără revocarea accesului.

Impact: administratorul crede că a blocat contul, însă accesul autentificat rămâne posibil. Probă: `test_suspended_account_still_accesses_authenticated_api`. Cod: [AuthController.php](../../volta-backend/app/Http/Controllers/Api/AuthController.php), [UserAdminController.php](../../volta-backend/app/Http/Controllers/Api/Admin/UserAdminController.php), [bootstrap/app.php](../../volta-backend/bootstrap/app.php).

Remediere: verificare centrală a stării contului la fiecare cerere protejată și la login; invalidare sesiuni/tokenuri la suspendare; reguli explicite pentru expirarea suspendării.

**2. P1 — Soluțiile testului sunt returnate de API chiar când afișarea lor este dezactivată.**

Reproducere: `show_correct_answers=false`, `show_results_immediately=false`, `show_only_submitted_answers=true`, `allow_review=false`; trimiterea unui răspuns greșit returnează totuși `result.review_questions[0].correct_answer_indices=[0]`.

Impact: soluțiile pot fi citite din răspunsul API și folosite la reîncercare sau distribuite altor cursanți. Probă: `test_submission_exposes_hidden_solutions`. Cod: [ExamController.php](../../volta-backend/app/Http/Controllers/Api/ExamController.php), `buildReviewQuestionWire` și `submitTest`.

Remediere: aceeași politică de divulgare aplicată în backend pentru submit, reîncărcare și vizualizare rezultat. Câmpurile interzise trebuie eliminate din JSON.

**3. P1 — Testul blocat de un test anterior poate fi trimis direct.**

Reproducere: test B cere promovarea testului A; motorul de progres întoarce `false` pentru B, dar `POST /api/exams/B/submit?course_id=...` acceptă răspunsul și înregistrează promovarea.

Impact: regulile pedagogice pot fi ocolite. Probă: `test_locked_test_can_be_submitted_directly`. Cod: [ExamController.php](../../volta-backend/app/Http/Controllers/Api/ExamController.php), `gateUnpublishedTest` / `submitTest`; [ProgressionEngine.php](../../volta-backend/app/Services/ProgressionEngine.php).

Remediere: verificarea înscrierii, relației test–curs, vizibilității și deblocării la deschidere și trimitere, prin aceeași funcție de autorizare.

**4. P1 — Limita de timp nu este impusă de server.**

Reproducere: test de 1 minut, `started_at` de acum o oră, răspuns corect → 200 și promovat. Browserul setează din nou `Date.now()` la încărcarea testului; răspunsurile sunt recuperate din sessionStorage, dar ora inițială nu este recuperată împreună cu ele.

Impact: reîncărcarea oferă timp suplimentar; un client poate trimite răspunsuri după expirare. Probă: `test_submission_after_time_limit_is_accepted`. Cod: [ExamPage.jsx](../../volta-frontend/src/pages/ExamPage.jsx), [ExamController.php](../../volta-backend/app/Http/Controllers/Api/ExamController.php).

Remediere: încercare persistentă creată pe server, cu `started_at`, `expires_at` și identificator; browserul afișează timpul rămas calculat după expirarea serverului.

**5. P1 — Publicarea cursului publică și teste obligatorii fără întrebări.**

Reproducere: curs cu o lecție validă și test draft gol atașat; publicarea cursului → 200, iar testul devine `published`, cu zero întrebări.

Impact: cursul ajunge la elevi cu evaluare imposibil de susținut. Probă: `test_course_publish_also_publishes_empty_required_test`. Cod: [CourseBuilderController.php](../../volta-backend/app/Http/Controllers/Api/Admin/CourseBuilderController.php), [CourseBuilderService.php](../../volta-backend/app/Services/CourseBuilderService.php), `publishDraftLinkedAssessmentsForCourse`.

Remediere: validare integrală înainte de tranzacția de publicare: întrebări disponibile, selecție din bancă, punctaje, variante corecte, praguri și dependențe. Refolosirea regulilor de publicare ale testelor, inclusiv pentru publicarea din curs.

**6. P1 — Duplicarea și restaurarea omit lecțiile directe.**

Reproducere: curs cu lecție care are `module_id=null`; atât clonarea, cât și restaurarea snapshotului produc curs nou cu zero lecții. Sursa rămâne intactă, dar copia/restaurarea este incompletă.

Cauză: clonarea parcurge doar `modules.lessons`; restaurarea sare peste lecția fără un modul remapat. Probe: `test_clone_loses_root_lessons`, `test_restoring_snapshot_loses_root_lessons`. Cod: [CourseBuilderService.php](../../volta-backend/app/Services/CourseBuilderService.php), `cloneCourse` și `restoreCourseFromVersion`.

Remediere: copierea tuturor lecțiilor, cu mapare explicită a ID-urilor, inclusiv lecțiile root; remaparea blocurilor, prerechizitelor și testelor atașate. Verificare automată a numărului și relațiilor înainte de confirmarea restaurării.

**7. P1 — O lecție poate fi blocată de o lecție din alt curs.**

Reproducere: curs A are lecție root cu ordine 0; prima lecție root din curs B are ordine 1 și deblocare secvențială. Motorul consideră lecția din A drept precedent și blochează B.

Cauză: interogarea precedentului filtrează `module_id=null` și ordinea, fără `course_id`. Probă: `test_root_lesson_is_blocked_by_another_course`. Cod: [ProgressionEngine.php](../../volta-backend/app/Services/ProgressionEngine.php), `checkSequentialUnlock`.

Remediere: limitarea interogării la cursul curent și tratarea explicită a ordinii lecțiilor root, modulelor și conținutului draft.

**8. P1 — Se poate înregistra progres la lecții draft neatribuite.**

Reproducere: elev fără înscriere, lecție din curs draft; `PUT /api/lessons/{id}/progress` cu 50% și 36.000 secunde → 200 și rând persistat.

Impact: progresul și orele de învățare din statistici pot fi false. Probă: `test_draft_unassigned_lesson_accepts_progress_updates`. Cod: [CourseProgressController.php](../../volta-backend/app/Http/Controllers/Api/CourseProgressController.php), `updateLessonProgress`.

Remediere: autorizarea lecției înaintea oricărei scrieri; limitarea creșterii timpului după timpul real dintre cereri; deduplicarea evenimentelor de progres.

**9. P1 — Corectarea manuală poate aplica pragul greșit.**

Reproducere: test independent cu prag 90%, răspuns scris evaluat la 8/10 → `passed=true`. Controllerul folosește implicit 70 și, pentru testele legate la curs, primul `CourseTest` găsit, fără filtrare după cursul rezultatului.

Impact: un elev poate fi promovat sau respins după reguli care nu îi aparțin. Probă: `test_manual_review_uses_70_instead_of_test_passing_score`. Cod: [TestAdminController.php](../../volta-backend/app/Http/Controllers/Api/Admin/TestAdminController.php), `submitManualReview` și rezolvarea cursului din `updateResultScore`.

Remediere: o singură funcție de rezolvare a pragului, bazată pe test și `result.course_id`; ideal, pragul aplicabil se salvează în încercare.

**10. P1 — Corectarea manuală acceptă punctaje duplicate și poate produce 200%.**

Reproducere: o întrebare de 10 puncte, trimisă de două ori în `manual_review_scores`, fiecare cu 10 puncte → procent 200,00. Scorul este însumat de două ori, dar detaliile pe întrebare sunt suprascrise sub aceeași cheie.

Impact: rezultate și statistici contradictorii. Probă: `test_duplicate_manual_scores_can_produce_200_percent`. Cod: [TestAdminController.php](../../volta-backend/app/Http/Controllers/Api/Admin/TestAdminController.php), `submitManualReview`.

Remediere: ID-uri distincte, întrebări limitate la încercarea evaluată, scor total în intervalul permis și recalculare din date validate. Corectarea trebuie să fie atomică.

**11. P1 — Linkurile evenimentelor restricționate sunt publice în API.**

Reproducere: eveniment `course_included`; vizitator fără login → `GET /api/events/{id}` returnează `live_link` și `replay_url`.

Impact: utilizatorii pot obține linkurile fără înscriere la curs/eveniment. Accesul efectiv în platforma video depinde de protecțiile ei, dar scurgerea URL-urilor este demonstrată. Probă: `test_guest_receives_restricted_event_links`. Cod: [EventController.php](../../volta-backend/app/Http/Controllers/Api/EventController.php), [Event.php](../../volta-backend/app/Models/Event.php).

Remediere: răspuns public separat de răspunsul participantului autorizat; linkuri disponibile numai după verificarea accesului și perioadei evenimentului.

**12. P2 — „Evenimentele mele” răspunde cu 404.**

Reproducere: utilizator autentificat, `GET /api/events/my` → 404. Ruta `/events/{id}`, declarată anterior fără restricție numerică, capturează `my`.

Probă: `test_event_my_route_is_shadowed`. Cod: [routes/api.php](../../volta-backend/routes/api.php). Remediere: ruta statică înaintea celei dinamice și `whereNumber('id')` pentru identificatori numerici; test API pentru fiecare rută statică similară.

**13. P2 — Prezența poate fi declarată înaintea evenimentului.**

Reproducere: participant înscris, eveniment care începe mâine, `mark-attendance` → `user_attended=true`.

Impact: prezență și indicatori neverificabili. Probă: `test_attendance_can_be_marked_before_event_starts`. Cod: [EventController.php](../../volta-backend/app/Http/Controllers/Api/EventController.php), `markAttendance`.

Remediere: fereastră de check-in, eveniment activ și o regulă explicită pentru validarea prezenței. Dacă se dorește auto-declarare, această semnificație trebuie reflectată în rapoarte.

**14. P2 — Citirea unui mesaj în grup îl marchează citit pentru ceilalți membri.**

Reproducere: grup cu trei membri; B citește mesajul lui A, iar numărul de mesaje necitite pentru C scade de la 1 la 0, deși C nu l-a citit.

Probă: `test_reading_group_message_marks_it_read_for_everyone`. Cod: [MessageController.php](../../volta-backend/app/Http/Controllers/Api/MessageController.php), `markAsRead`; [Conversation.php](../../volta-backend/app/Models/Conversation.php), `getUnreadCount`.

Remediere: stare de citire per participant, prin ultimul mesaj citit sau tabel de confirmări de citire.

**15. P2 — Dezactivarea înregistrărilor nu oprește crearea conturilor.**

Reproducere: `registration_enabled=0`, apoi POST register valid → 201 și cont pending creat. Setarea este salvată, dar controllerul de înregistrare nu o verifică.

Probă: `test_registration_disabled_setting_is_ignored`. Cod: [SettingsController.php](../../volta-backend/app/Http/Controllers/Api/Admin/SettingsController.php), [AuthController.php](../../volta-backend/app/Http/Controllers/Api/AuthController.php).

Remediere: aplicarea setării în backend, cu politică distinctă pentru invitațiile administrative.

**Alte puncte slabe identificate în cod**

Acestea nu au fost reproduse prin probele de mai sus. Sunt concluzii din implementare sau riscuri care trebuie validate în scenariile indicate.

**16. P1 — Exportul/importul prezentat ca backup nu acoperă datele LMS.** [SettingsController.php](../../volta-backend/app/Http/Controllers/Api/Admin/SettingsController.php) exportă cursuri cu `modules.lessons`, examene legacy și alte entități, dar nu include complet lecțiile root, blocurile, testele noi, rezultatele și fișierele. Importul nici nu restaurează toate entitățile exportate, precum evenimentele și examenele. Backupul nu poate fi considerat recuperare completă. Recomand: inventar explicit, backup DB + storage, versiune de format și exercițiu de restaurare într-o bază goală. Setările de backup automat nu au un consumator în codul backend inspectat; o eventuală automatizare externă nu a fost verificată.

**17. P1 — Încercările nu păstrează o copie completă a întrebărilor și regulilor.** [ExamController.php](../../volta-backend/app/Http/Controllers/Api/ExamController.php) reconstruiește întrebările și soluțiile din test/bancă la vizualizare. [TestResult.php](../../volta-backend/app/Models/TestResult.php) păstrează răspunsuri și scoruri, dar nu snapshotul complet. Editarea sau mutarea unei întrebări poate schimba explicația unui rezultat istoric. Recomand: versiune imuabilă a testului și snapshot pe încercare pentru subset, opțiuni, punctaje, soluții și prag. Scenariu de verificat: finalizează testul, schimbă banca, redeschide rezultatul.

**18. P1 — Trimiterile concurente pot dubla încercările.** În `submitTest`, numărarea încercărilor și inserarea rezultatului sunt operații separate, fără blocarea unei încercări persistente. Două cereri simultane pot vedea aceeași stare. Acesta este un risc din cod, nereprodus pe MySQL. Recomand: ID de încercare, operație atomică de finalizare și cheie de idempotență pentru reîncercarea cererii după o eroare de rețea.

**19. P2 — Notițele locale nu sunt izolate pe utilizator și erorile sunt absorbite.** [NoteTakingSystem.jsx](../../volta-frontend/src/components/student/NoteTakingSystem.jsx) folosește cheia `notes_${lessonId}`. Pe un browser partajat, următorul cont poate încărca fallbackul celuilalt dacă API-ul nu răspunde. Callbackul de salvare prinde eroarea fără să o retransmită, iar [useAutoSave.js](../../volta-frontend/src/hooks/useAutoSave.js) poate considera operația reușită. Recomand: cheie utilizator + lecție, stare „nesincronizat”, reluare controlată și evitarea trimiterii fallbackului altui cont. Verificare în browser cu două conturi și rețea întreruptă.

**20. P2 — Validarea publicării verifică existența conținutului, nu dacă este utilizabil.** [CourseBuilderValidator.php](../../volta-backend/app/Services/CourseBuilderValidator.php) acceptă un bloc existent fără a verifica sursa/payloadul/visibility și consideră textul HTML nevid drept conținut. Auditul de calitate și validatorul de publicare au reguli diferite. Recomand: reguli pe tipul lecției/blocului, HTML gol normalizat, verificare fișiere și mesaje care duc direct la elementul problematic. Auditul calitativ trebuie să trateze corect video/PDF, fără a deduce calitatea numai din lungimea textului.

**21. P2 — Salvarea conținutului are risc de suprascriere la răspunsuri întârziate.** [AdminCourseBuilderPage.jsx](../../volta-frontend/src/pages/admin/AdminCourseBuilderPage.jsx) declanșează cereri după debounce, dar cererile în curs nu sunt serializate; backendul nu verifică o revizie la actualizare. Două salvări care ajung în ordine inversă pot lăsa versiunea veche. Recomand: coadă de salvare pe lecție și revizie verificată de server; test cu latență artificială și două taburi. Trimiterea la review/publicare trebuie să aștepte salvarea confirmată.

**22. P2 — Evenimentele au riscuri suplimentare de capacitate și acces.** [EventController.php](../../volta-backend/app/Http/Controllers/Api/EventController.php) verifică capacitatea înainte de înscriere fără tranzacție cu lock; `markReplayWatched` acceptă existența rândului de participant fără a cere `registered=true` sau `attended=true`. Anularea păstrează rândul. Recomand: înscriere atomică și o politică explicită pentru replay după anulare. Concurența reală și politica comercială pentru `paid` necesită verificare separată.

**23. P2 — Ștergerea media nu verifică referințele în conținut.** [MediaAdminController.php](../../volta-backend/app/Http/Controllers/Api/Admin/MediaAdminController.php), `destroy`, șterge fișierul și înregistrarea. Recomand: afișarea lecțiilor care folosesc fișierul, blocarea ștergerii dacă este utilizat sau înlocuire controlată; verificarea impactului asupra cursurilor clonate și versiunilor istorice.

**Îmbunătățiri pe fluxuri**

| Flux | Îmbunătățire propusă | Criteriu de acceptare |
| --- | --- | --- |
| Creare curs | Checklist unic: structură, conținut, evaluări, audiență, previzualizare | Fiecare eroare indică exact lecția/testul și permite navigarea directă |
| Publicare | Acțiune atomică după salvare; rezumat cu ce devine vizibil și cui | Nu apare „publicat” dacă o parte obligatorie este invalidă |
| Editare curs publicat | Draft separat de versiunea utilizată de cursanți | Modificările nepublicate nu schimbă încercările și parcursurile active |
| Duplicare/restaurare | Copiere verificată și raport de integritate | Lecții, blocuri și referințe păstrate, inclusiv fără module |
| Test | Model unic de încercare, cu expirare și salvare server | Refresh, două taburi și reconectare păstrează aceeași încercare |
| Corectare | Rubrică, întrebări ale încercării, prag explicit și istoric de modificări | Procent între 0 și 100, fără dublare, aceeași regulă în toate ecranele |
| Progres | Autorizație comună pentru citire/scriere/finalizare | Un element blocat în UI este blocat și prin API |
| Distribuire | Previzualizare ca elev concret dintr-o echipă | Administratorul vede efectiv cursurile și testele disponibile acelui elev |
| Notificări | Separarea „în coadă”, „trimis”, „eșuat” și deduplicare la republicare | O reluare a cererii nu generează notificări duplicate |
| Statistici | Separarea timpului observat de estimări și păstrarea istoricului corectării | Indicatorii pot fi explicați din evenimente/rezultate consistente |
| AI | Generare revizuibilă, validată ca orice conținut manual | Întrebările generate nu ocolesc validarea de publicare; timeoutul nu pierde munca |
| Operațiuni | Backup DB/storage și restaurare periodică verificată | Recuperare demonstrată cu teste, fișiere, rezultate și permisiuni |

**Ordinea recomandată de remediere**

1. Acces și evaluare: suspendare, divulgarea soluțiilor, deblocarea testelor, autorizarea progresului, linkuri evenimente.
2. Integritatea cursurilor: publicarea testelor goale, clone/restaurări, dependențe între cursuri; auditul backupului.
3. Modelul încercării: timp server, idempotență, snapshot întrebări, corectare manuală și praguri pe curs.
4. Fiabilitatea utilizării: evenimentele mele, citire grupuri, notițe, salvare la latență și protecția media.
5. Teste browser pentru fluxul complet și verificare pe infrastructura de staging: autor → publicare → elev → test → corectare → finalizare → raportare.

Cele 90 de teste backend existente oferă o bază utilă, însă probele noi arată că succesul suitei nu garantează integritatea tuturor proceselor. Următorul pas tehnic este transformarea acestor scenarii în teste care cer comportamentul corect, împreună cu remedierea fiecărei cauze.
