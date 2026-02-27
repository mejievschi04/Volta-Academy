# Analiză: flow pe pași pentru creare cursuri și teste (LMS)

Cum au implementat alte LMS-uri flow-ul pas-cu-pas pentru creare curs / test. Surse: Teachable, Thinkific, LearnDash, AcademyOcean, Moodle + recomandări UX (NN/G, PatternFly).

---

## 1. Teachable – wizard creare curs

**Sursă:** [Teachable Help – Create and Set Up Your Course](https://support.teachable.com/hc/en-us/articles/220340327)

| Pas | Conținut |
|-----|----------|
| **1. Detalii de bază** | Titlu, autor, descriere (opțional), imagine thumbnail (16:9, 1024×576 px) |
| **2. Thumbnail** | Încărcare imagine reprezentativă (opțional) |
| **3. Plan preț** | Tip: one-time / payment plan / subscription / free; nume plan, monedă, preț, subtitlu |
| **4. Course outline** | Alegere: **manual** (secțiuni + lecții) sau **AI** – generare automată secțiuni, lecții și conținut eșantion din descriere |

După setup: cursul e organizat în **sections** (grupuri de lecții) și **lessons** (text, fișiere, video, imagini). Suport bulk upload (OneDrive, Google Drive, Dropbox, FTP, URL).

**Idei de preluat:** un singur wizard cu 3–4 pași clari; **opțiune AI** la outline (generare structură din descriere); pași opționali (ex. thumbnail, preț) nu blochează.

---

## 2. Thinkific – build course + checklist

**Sursă:** [Thinkific – Build Your Course](https://support.thinkific.com), [8 Steps to Create Your First Course](https://www.thinkific.com/blog/create-first-online-course-8-steps/)

- **Course builder:** drag-and-drop; **AI course outline builder** – structură automată (sections, lessons, chapters).
- **Checklist în dashboard:** listă de pași (ex. „Adaugă conținut”, „Configurează setări”) ca ghid în admin.
- **Organizare:** sections → lessons → chapters; focus pe „structure your course” apoi „produce content”.

**Idei de preluat:** checklist vizibil în dashboard („Ai făcut: 3/7 pași”); AI pentru outline; un singur loc (course builder) pentru structură + conținut.

---

## 3. LearnDash – Course Create Wizard (din URL video)

**Sursă:** [LearnDash – Course Create Wizard](https://www.learndash.com/support/docs/core/courses/course-create-wizard/)

Wizard **specializat** pentru cursuri bazate pe video:

| Pas | Conținut |
|-----|----------|
| **1. Sursă** | Buton „Create from Video Playlist”; utilizatorul introduce URL: **YouTube Playlist**, **Vimeo Showcase** sau **Wistia Project** |
| **2. Încărcare** | „Load the playlist data” – wizard preia datele și pregătește lecțiile (câte una per video) |
| **3. Access** | Setări acces: **Closed** / **Recurring** / **Buy Now** / **Free** / **Open** (cu preț unde e cazul) |
| **4. Progresie** | **Linear** (obligatoriu în ordine, Mark Complete) sau **Free Form** (navigare liberă) |
| **5. Creare** | „Create the course” – curs + lecții create și setate Published; redirecționare la lista de cursuri |

Fiecare lecție creată conține video-ul și transcriptul. Editarea conținutului se face după creare.

**Idei de preluat:** wizard **scurt și cu scop clar** (1 tip de sursă = 1 flow); pași **fixi** (sursă → setări → creare); după wizard, utilizatorul ajunge în editorul obișnuit pentru rafinare.

---

## 4. AcademyOcean – „5 pași” și AI author

**Sursă:** [AcademyOcean – Create Online Courses](https://academyocean.com/solution/create-online-courses), [10 Steps to Create a Successful Online Course](https://academyocean.com/blog/post/overview-of-the-10-steps-to-create-a-successful-online-course)

**Pe produs (UI):**
- **Pas 1 – Create courses:** creare conținut rapid, fără cod; video, multimedia, program, teasers.
- **Pas 2 – Design your platform:** branding, domeniu, interfață, teme portal.
- **Pas 3 – Transform into business:** CRM, plăți, integrări (Zapier, API, Webhooks).
- **Pas 4 – Engage learners:** răspunsuri video/audio, portal learner, awards, feedback.
- **Pas 5 – Analyze to improve:** funnel-uri, progres, dashboard.

**Creare curs concret:** „Launch your first course in **minutes**”; **AI author** – introduci topic + cuvinte cheie → lecție generată în 2–3 minute; editor interactiv, quiz builder, 14 tipuri de întrebări.

**Framework-uri conceptuale (blog):**
- **7 pași Academy (lead gen):** Audience → Problem → Content → Assemble → Promote → Find clients → Process leads.
- **6 pași Product Academy (onboarding):** Inventory → Structure → Start writing → Quizzes → Academy settings → Before publishing.

**Idei de preluat:** **primul pas = „create course”** foarte vizibil; **AI author** ca pas opțional în flow (topic → draft lecție); pașii „design / business / engage / analyze” sunt **după** ce cursul există (nu în același wizard).

---

## 5. Moodle – Course Creation Wizard

**Sursă:** [MoodleDocs – Course Creation Wizard](https://docs.moodle.org/311/en/Course_Creation_Wizard)

- **Acces:** link în blocul de navigare a categoriei: „Course Creation Wizard”.
- **3 opțiuni:**  
  1. **From an existing course** (în categoria aleasă)  
  2. **From a template** (șabloane configurate per categorie/școală)  
  3. **As a blank course**  

Wizard-ul e orientat pe **administrator** (creare în bulk la început de an); profesorii de obicei nu creează cursuri noi. Setări: grupuri de șabloane, ID-uri cursuri template.

**Idei de preluat:** alegere explicită **tip creare** (gol / din template / din curs existent); pentru Volta poți avea „Curs gol”, „Din șablon”, „Cu AI din topic”.

---

## 6. Recomandări UX pentru wizard (NN/G, PatternFly, eleken)

**Când folosești wizard:** proces complex, făcut rar, cu pași dependenți (ex. creare curs/test). [NN/G – Wizards](https://www.nngroup.com/articles/wizards/)

**Structură și navigare:**
- **Sidebar cu pași** numerotați și denumire clară; indicator vizual „pasul curent” și ce e completat.
- **Un singur CTA principal** per pas (ex. „Următorul” / „Creează curs”); secundar: „Înapoi”, „Anulează”.
- Pașii următori **dezactivați** până se completează pasul curent (sau se permit doar vizitări „înainte” fără a salva).
- Pe **mobile:** sidebar → dropdown sau steps orizontale compacte.

**Conținut:**
- **Un pas = un tip de informație** (ex. doar „Detalii curs”, doar „Structură”, doar „Setări publicare”).
- **Titluri orientate pe rezultat** (ex. „Cum se deschide cursul”) nu doar „Setări”.
- Evită scroll mare în același pas; dacă e nevoie, împarte în subpași.

**Validare și flexibilitate:**
- **Validare la trecere** la pasul următor; mesaje de eroare lângă câmpuri.
- **Înapoi** permis fără pierdere date; salvare draft după fiecare pas (opțional).
- **Skip / Start over** unde are sens (ex. „Sari peste imagine” sau „Reîncepe”).

**Închidere:**
- Confirmare înainte de „Închide” dacă există date nesalvate.

---

## 7. Sinteză: ce flow pe pași are sens pentru Volta Academy

### 7.1 Creare CURS – propunere de pași

| Pas | Denumire scurtă | Conținut | Inspirat din |
|-----|------------------|----------|----------------|
| **1** | **Detalii curs** | Titlu, descriere scurtă, imagine (opțional). Opțiune: „Generează cu AI din topic” → după completare, pas 2 poate fi pre-completat. | Teachable 1, AcademyOcean AI |
| **2** | **Structură** | Module + lecții (manual sau **AI outline** din descriere/topic). Doar structură (titluri), fără conținut lecții încă. | Teachable 4, Thinkific |
| **3** | **Conținut (opțional)** | Link „Adaugă conținut lecții” → redirect la builder-ul existent; sau „Continuă mai târziu”. | - |
| **4** | **Teste & setări** | Asociere teste la curs (dacă există), setări minimală (ex. scor minim, încercări). | LearnDash access/progression |
| **5** | **Rezumat & Creează** | Rezumat (titlu, N module, M lecții, X teste); buton „Creează curs” → salvare draft + redirect la builder. | LearnDash „Create the course” |

**Variantă scurtă (quick start):**  
1. Detalii (titlu + descriere).  
2. Structură (1 modul, 1 lecție gol) sau „Din șablon”.  
3. Creează → redirect la builder.  

Restul (conținut, teste) se face în builder / pagini dedicate.

### 7.2 Creare TEST – propunere de pași

| Pas | Denumire scurtă | Conținut | Inspirat din |
|-----|------------------|----------|---------------|
| **1** | **Detalii test** | Titlu, descriere, tip (exersare / notat / final), scor minim, nr. încercări. | LearnDash, AcademyOcean quiz |
| **2** | **Întrebări** | Surse: **Bancă de întrebări** (alegi bancă + eventual filtre) sau **Adaugă manual** sau **Generează cu AI** (din text/curs). Previzualizare număr întrebări. | Teachable/Thinkific AI, Volta existent |
| **3** | **Setări** | Ordine aleatorie, afișare răspunsuri corecte după submit, timp limitat (opțional). | - |
| **4** | **Rezumat & Creează** | Rezumat; „Creează test” → draft + redirect la editor test. | LearnDash |

### 7.3 Principii comune (din analiză)

1. **Primul pas = minim necesar** (titlu + opțional descriere/imagine) ca să existe „entitatea” (curs/test).
2. **Un wizard = un scop** (curs nou / test nou / curs din playlist); nu amesteca creare curs + design platformă în același flow.
3. **AI ca opțiune în pași existenți** (ex. pas „Structură” cu buton „Generează cu AI”; pas „Întrebări” cu „Generează cu AI”), nu wizard separat.
4. **După „Creează”** → redirect clar în **editorul full** (builder curs / editor test) pentru rafinare.
5. **Checklist / progres** în dashboard (ex. „Curs X: 3/5 pași completați”) pentru cursuri draft.
6. **Templates** (curs gol, din șablon, din curs existent) la începutul flow-ului, ca la Moodle.

---

## 8. Referințe

- Teachable: [Create and Set Up Your Course](https://support.teachable.com/hc/en-us/articles/220340327-Create-and-Set-Up-Your-Course)
- Thinkific: [Build Your Course Page](https://support.thinkific.com/hc/en-us/articles/360030727293-Build-Your-Course-Page)
- LearnDash: [Course Create Wizard](https://www.learndash.com/support/docs/core/courses/course-create-wizard/)
- AcademyOcean: [Create Online Courses](https://academyocean.com/solution/create-online-courses)
- Moodle: [Course Creation Wizard](https://docs.moodle.org/311/en/Course_Creation_Wizard)
- NN/G: [Wizards: Definition and Design Recommendations](https://www.nngroup.com/articles/wizards/)
- PatternFly: [Wizard – Design Guidelines](https://patternfly.org/components/wizard/design-guidelines)
- Eleken: [Wizard UI Pattern](https://eleken.co/blog-posts/wizard-ui-pattern-explained)

---

*Document pentru echipa Volta Academy – bază pentru designul flow-urilor pas-cu-pas de creare curs și test.*
