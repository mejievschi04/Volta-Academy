# Ce putem „împrumuta” de la AcademyOcean pentru Volta Academy

Idei utile de la AcademyOcean, prioritizate și cu efort estimat. Ce **ai deja** vs ce **merită adăugat**.

---

## Ce ai deja (și poți doar îmbunătăți)

| Feature AcademyOcean | În Volta Academy | Notă |
|----------------------|-------------------|------|
| Learning funnel + dropoff | ✅ Dashboard: `learning_funnel`, `dropoff_rate`, LearningFunnel.jsx, ProblematicCourses | Poți evidenția mai mult „unde se pierde interesul” (per modul/lecție). |
| Certificate la finalizare | ✅ Blade templates (premium, modern, classic, course) | Poți adăuga editor de șablon / variante (ca „choose template or design your own”). |
| AI pentru quiz | ✅ Generare întrebări din conținut curs sau text (QuestionBankAdminController) | De extins: mai multe tipuri, dificultate, feedback. |
| AI asistent | ✅ AITutor (chat, context curs/lecție, progres, greșeli) | Lipsește: răspunsuri 24/7 din „baza de cunoștințe” (search + RAG). |
| Echipe / learning paths | ✅ Teams, CourseTest, progresie, ProgressionRules | Poți adăuga „learning path” explicit per echipă (ordine cursuri + automate). |
| Rapoarte / statistici | ✅ AdminStatisticsPage, AdminAnalyticsPage, CourseInsights, dropoff | Poți adăuga „insights” text (sugestii AI) peste date. |

---

## 1. AI Author pentru lecții (prioritate mare)

**La ei:** Introduci un topic + cuvinte cheie → AI generează o lecție gata de editare.

**La tine:** Ai generare întrebări; nu ai generare conținut lecție.

**Ce să faci:**
- În LessonCreatorPage (sau editor lecție): buton „Generează cu AI”.
- Input: topic + opțional stil (friendly / formal), limbă.
- Backend: endpoint care apelează același AI (Groq/OpenAI), primește text structurat (titlu, secțiuni, bullet points).
- Salvezi ca draft; utilizatorul editează în block-urile existente (text, liste, etc.).

**Efort:** mediu (1–2 zile backend + UI).

---

## 2. Funnel „unde se pierde interesul” (prioritate mare)

**La ei:** Funnel clar: înscriși → au început → au terminat; identifică unde abandonul e mare.

**La tine:** Ai `dropoff_rate` per curs și learning_funnel global.

**Ce să faci:**
- Funnel **per curs**: pași = Modul 1 … Modul N + „A trecut testul” + „A finalizat”.
- Metrici: câți au intrat în modul X, câți au trecut la X+1, unde e cel mai mare drop-off.
- În dashboard / CourseInsights: „Abandon mare la Modul 3” + link la curs.

**Efort:** mediu (migrare/query pentru progres per modul + UI graf funnel per curs).

---

## 3. 2FA (Two-Factor Authentication) (prioritate mare pentru securitate)

**La ei:** 2FA cu Google Authenticator.

**La tine:** Nu există.

**Ce să faci:**
- Backend: câmpuri `two_factor_secret`, `two_factor_enabled` pe users; bibliotecă TOTP (e.g. `pragmarx/google2fa-laravel` sau echivalent).
- Flow: activare în setări profil → QR code → verificare cod 6 cifre; la login, după parolă ceri codul 2FA.
- Frontend: pagină/ modal activare 2FA, câmp cod la login.

**Efort:** mediu–mare (2–3 zile).

---

## 4. Feedback AI pentru răspunsuri deschise (prioritate medie)

**La ei:** Quiz manager: feedback personalizat și auto-review pentru răspunsuri deschise.

**La tine:** Ai `manual_review` și tipuri short_answer/essay; review-ul e manual.

**Ce să faci:**
- La salvare răspuns deschis: opțional trimitere la AI cu întrebarea + răspunsul corect (sau rubrică).
- AI returnează: score 0–100 și/sau feedback scurt (1–2 propoziții).
- Admin vede sugestia AI și poate o acceptă / o editează / o ignoră (decizie finală rămâne la om).

**Efort:** mediu (endpoint + policy „când trimitem la AI” + UI la review).

---

## 5. „Copilot” bazat pe conținut (prioritate medie)

**La ei:** Wave: răspunde 24/7 din materialele companiei, multilingv, adaptat pe rol.

**La tine:** AITutor e contextual (curs/lecție); nu e „caută în toată baza de cunoștințe”.

**Ce să faci:**
- Indexare conținut: titluri lecții, body text (din block-uri), FAQ cursuri → vectori sau text search.
- Endpoint „întrebare” → căutare în conținut + trimitere la AI cu context găsit → răspuns + surse (curs X, lecția Y).
- În AITutor: buton „Caută în toate materialele” sau ruta separată „Întreabă academía”.

**Efort:** mare (indexare, search, prompt-uri, UI).

---

## 6. Personalizare conținut pe rol / nivel (prioritate medie)

**La ei:** „One lesson — personalized content for each learner” (rol, skill level, locație).

**La tine:** Conținut comun; filtrare pe echipe/cursuri, nu pe „variantă de conținut” în funcție de rol.

**Ce să faci:**
- Variante de conținut: același „slot” de lecție poate avea variante (ex. A pentru începători, B pentru avansați).
- Pe user/echipă: câmpuri `role` sau `level`; la afișare lecție alegi varianta potrivită.
- Sau etichete pe module/lecții (ex. „avansat”) + reguli „arată doar dacă level >= X”.

**Efort:** mare (model date, reguli, UI).

---

## 7. Îmbunătățiri UX rapide (prioritate mică–medie)

| Idee | Implementare scurtă |
|------|----------------------|
| **Tone / stil AI** | În setări curs sau AITutor: dropdown (Prietetenos / Formal / Încurajator) → treci în prompt. |
| **Certificate – mai multe șabloane** | 2–3 variante noi în Blade + selector la setări curs („Certificat: Modern / Clasic / Minimal”). |
| **Insights text pe dashboard** | Un endpoint care primește `dropoff_rate`, `completion_rate` și returnează 1–2 propoziții sugestii (AI); le afișezi sub grafice. |
| **White-label** | Ai temă light/dark; poți adăuga câmpuri „Logo URL”, „Culoare primară”, „Nume academie” în setări și le folosești în header/footer. |

---

## 8. Ce poți lăsa pentru mai târziu

- **Traduceri multilingve cu AI** – util dacă expandați în mai multe limbi; efort mare.
- **Integrări HR (Zapier/Make)** – când există cerere concretă; API-ul tău o poate suporta treptat.
- **SCORM** – doar dacă clienții cer import/export SCORM.

---

## Ordine sugerată de implementare

1. **AI Author pentru lecții** – impact mare pentru creatori, efort rezonabil.
2. **2FA** – securitate și încredere.
3. **Funnel per curs (unde se pierde interesul)** – folosești deja datele, doar le prezenți mai clar.
4. **Feedback AI la răspunsuri deschise** – reduce volumul de review manual.
5. **Insights text + tone AITutor + 1–2 șabloane certificate** – quick wins UX.

Dacă vrei, următorul pas poate fi: detaliere tehnică pentru un singur item (ex. AI Author pentru lecții sau 2FA) direct în codul Volta Academy.
