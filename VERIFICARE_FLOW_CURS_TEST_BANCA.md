# Raport verificare: Creare Curs → Test → Bancă de întrebări

Verificare făcută pe fluxurile: **creare curs** (wizard), **creare test**, **creare bancă de întrebări**.

---

## Ce funcționează corect

### Creare curs (wizard 6 pași)
- **Step 1 (Setare curs):** Titlu, descriere, categorie, tags, nivel, durată, vizibilitate, imagine.
- **Step 2 (Curriculum):** Module și lecții cu drag & drop, redenumire inline – API-urile `/admin/modules` și `/admin/lessons` sunt apelate corect după ce cursul este creat.
- **Step 5 (Reguli finalizare):** sequential_unlock, min_test_score, has_certificate – trimise la create.
- **Step 6 (Publicare):** Draft/Published, tip acces, **tip înscriere** (open / by_invite / paid) – trimise la backend.
- După „Creează curs” se face redirect la `/admin/courses/{id}/builder`.

### Creare test
- Wizard: Detalii → Sursă întrebări (direct sau din bancă) → Setări → Rezumat.
- **Din bancă:** se poate alege banca și modul (aleatoriu/ordonat) + număr întrebări.
- Backend: `question_source`, `question_set_id`, `question_selection` sunt acceptate; testul se leagă corect de banca alesă.

### Bancă de întrebări
- Creare bancă (titlu, descriere, categorie) → adăugare întrebări (salvare la fiecare add/edit dacă bancă există).
- Întrebările se salvează prin `addQuestionToBank` / `updateQuestionInBank` când `bankId` este setat.

### Legături
- Test legat de curs: din **Course Builder** (curs creat) → „Atasare teste” → attach test la curs/modul/lecție.
- Test cu sursă „Din banca de întrebări”: la creare test se alege banca; backend folosește `question_set_id` = id-ul băncii.

---

## Ce nu era bine (remediat)

### 1. ID-uri la creare modul / lecție (wizard curs)
- **Problema:** Backend returnează `{ message, module }` și `{ message, lesson }`. Wizard-ul folosea `module.id` și trimitea `module_id: module.id` la createLesson → `module_id` era `undefined` → lecțiile nu se legau de modul.
- **Remediat:** În `CourseCreationWizard.jsx` se folosesc `moduleRes?.module ?? moduleRes` și `createdModule?.id` pentru a lua ID-ul modulului creat și a-l trimite la createLesson.

### 2. ID la creare bancă de întrebări
- **Problema:** Backend returnează `{ message, bank }`. Frontend folosea `saved.id` → undefined; URL și state rămâneau fără id-ul băncii noi.
- **Remediat:** În `QuestionBankBuilder.jsx` se folosește `saved?.bank?.id ?? saved?.id` în toate cele 3 locuri (handleNext la step 1, handleSave, handlePublish).

---

## Ce încă nu e bine (de îmbunătățit)

### 1. ~~Conținut lecții (Step 3) și evaluări (Step 4) din wizard nu se salvează~~ **REMEDIAT**
- **Step 3 – Conținut lecții:** După crearea modulelor și lecțiilor, wizard-ul construiește o mapare `lessonIdMap` (id client → id lecție real) și apelează `adminService.builderCreateContentBlock(courseId, realLessonId, { type, source, payload, metadata, visible, order })` pentru fiecare bloc din `courseData.content_blocks`. Conținutul din Step 3 este salvat în builder.
- **Step 4 – Quiz:** Pentru fiecare assessment de tip `quiz`, se creează un test (`createTest`), iar pentru fiecare întrebare se apelează `createQuestion`; apoi testul se atașează la lecție cu `builderAttachTest(courseId, { test_id, scope: 'lesson', scope_id: realLessonId, required, passing_score })`. Quiz-urile configurate în Step 4 sunt create și atașate la lecțiile corespunzătoare.

### 3. Două moduri de a crea un curs (posibilă confuzie)
- **Ruta A:** Admin → Conținut → „Cursuri” → „Creează curs” → **CourseCreationPage** (wizard 6 pași).
- **Ruta B:** Admin → Cursuri (listă) → „+ Curs nou” / VoltInstructor → se deschide **BuildCourseModal** (form scurt: titlu, descriere, opțional PDF) → la submit se creează curs și redirect la builder.
- Utilizatorii pot să nu știe că wizard-ul complet este la Conținut → Cursuri → Creează curs, nu din listă.

### 4. Validare și erori la create curs
- La createCourse cu FormData, dacă backend returnează erori de validare (ex. `image` required), mesajul de eroare este afișat prin toast, dar câmpurile problematice nu sunt evidențiate în form.
- La createModule / createLesson, în caz de eroare (ex. 422) doar toast-ul arată mesajul; pașii nu se deschid la loc la pasul respectiv.

### 5. Test: câmpuri suplimentare la creare
- Wizard-ul trimite `time_limit_minutes`, `max_attempts`, `randomize_questions`, `randomize_answers`, etc. Trebuie verificat că backend-ul (TestAdminController / TestBuilderService) acceptă toate aceste câmpuri la create; unele pot fi doar la update.

### 6. Bancă de întrebări: status la publicare
- Backend acceptă doar `draft` | `published` | `archived`. Frontend trimitea `status: 'active'` la Publish → **remediat:** se trimite `status: 'published'`.

---

## Rezumat acțiuni

| Zonă                    | Status        | Acțiune |
|-------------------------|---------------|--------|
| Wizard: ID modul/lecție | Remediat      | Folosit `module.module.id` și `lesson.lesson.id` (sau echivalent) în CourseCreationWizard. |
| Bancă: ID după create   | Remediat      | Folosit `saved.bank.id` în QuestionBankBuilder. |
| Step 3: content blocks  | **Implementat** | După create, se mapează lessonId client → real și se creează blocuri prin builder API. |
| Step 4: assessments     | **Implementat** | Se creează test per quiz, se adaugă întrebările, se atașează testul la lecție (scope lesson). |
| Două fluxuri „curs nou” | Documentat    | Clarificare în UI sau unificare. |
| Validare / erori API    | Opțional      | Afișare erori pe câmpuri și refocus pe pasul cu eroare. |
| Bancă: status la Publish | Remediat      | Trimis `published` în loc de `active`. |

---

*Document generat după verificarea fluxurilor curs → test → bancă de întrebări.*
