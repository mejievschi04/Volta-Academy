# Standarde moderne pentru crearea de conținut în LMS

Document de referință pentru îmbunătățirea fluxurilor de creare: **mape curs**, **teste**, **întrebări**, **evenimente**, aliniat la cele mai bune practici ale LMS-urilor moderne (LearnWorlds, Articulate Rise, Tutor LMS, Open LMS).

---

## 1. Principii generale UX

- **Progressive disclosure**: afișează secțiuni clare; evita formulare foarte lungi dintr-o dată.
- **Feedback imediat**: validare pe câmp (onBlur), mesaje de eroare lângă câmp, confirmare la salvare.
- **Salvare progresivă**: unde e posibil, salvează ca „ciornă” după primul pas și continuă editarea.
- **Consistență**: aceleași pattern-uri pentru modaluri (titlu, secțiuni, Anulare / Salvează), aceleași stiluri pentru formulare.
- **Accesibilitate**: label-uri asociate, focus vizibil, butoane cu aria-label unde e cazul.

---

## 2. Mape de curs (Course maps / categorii)

### Standarde identificate
- Categorii cu **nume** și **descriere** scurtă.
- Gestionare **cursuri în mapă**: adăugare/ștergere clară, fără dependență de Ctrl+click.

### Îmbunătățiri implementate / de implementat
- **Modal create/edit**: 
  - Secțiune „Informații de bază” (nume obligatoriu, descriere opțională).
  - Secțiune „Cursuri în mapă” (la editare): listă cursuri curente cu acțiune „Scoate”; adăugare prin listă cu checkbox-uri (nu select multiplu cu Ctrl).
- **Text de ajutor**: ex. „Cursurile din mapă vor apărea grupat pentru studenți.”
- **Butoane**: Anulare (secondary), Creează / Salvează (primary), aliniate la dreapta în footer modal.

---

## 3. Teste (Quiz / Assessment)

### Standarde identificate
- **Diversitate tipuri întrebări**: multiple choice, true/false, matching, fill-in-the-blank, pentru angajament și evaluare corectă.
- **Setări clare**: limită timp, număr încercări, randomizare întrebări/răspunsuri, afișare rezultate/corecte.
- **Sursă întrebări**: din bancă sau adăugate direct; selecție explicită (ex. „10 întrebări din banca X”).

### Îmbunătățiri implementate
- **Wizard creare**: pași clari (Detalii → Întrebări → Setări → Rezumat); validare per pas; buton „Înapoi” și „Continuă”.
- **Detalii test**: secțiuni „Detalii test” (titlu, descriere + hint) și „Tip & evaluare” (tip test, nr. încercări max).
- **Sursă întrebări**: hint pentru „Direct” și „Din bancă”; label „Număr întrebări afișate”; hint „Aleatoriu reduce copiatul”.
- **Setări**: grupate în „Timp”, „Randomizare”, „Afișare rezultate”, cu hint-uri (ex. randomizare, răspunsuri corecte).
- **Feedback**: la salvare, mesaj de succes și redirecționare în editorul de test.

---

## 4. Întrebări (Question banks & quiz questions)

### Standarde identificate
- **Tipuri**: multiple choice, true/false, short answer, matching etc.
- **Design clar**: întrebare concisă, aliniată la obiective; evitarea întrebărilor „capcană”.
- **Feedback**: explicație pentru răspuns corect (unde e cazul); opțional dificultate/tag-uri.
- **Bănci de întrebări**: organizare pe categorii/teme pentru reutilizare.

### Îmbunătățiri implementate
- **Formular întrebare**: tip selectat clar (Răspuns multiplu, Adevărat/Fals, Răspuns scurt); minim 2 răspunsuri la multiple choice; cel puțin un răspuns corect marcat.
- **Opțiuni**: punctaj, explicație (feedback) cu hint „Afișat elevului după răspuns; îmbunătățește învățarea.”, Dificultate (Ușor/Mediu/Dificil), Tag-uri.
- **Listă întrebări**: tip afișat în română (Răspuns multiplu, Adevărat/Fals, Răspuns scurt); editare/ștergere rapidă.

---

## 5. Evenimente (Webinarii, workshop-uri)

### Standarde identificate
- **Formular clar**: titlu, descriere, tip (live online / fizic / webinar / workshop), program (start/end), locație/link.
- **Date/ora**: datetime-local cu timezone clar (ex. Europe/Bucharest).
- **Acces**: gratuit / inclus în curs; dacă inclus în curs, select curs obligatoriu.
- **Opțional**: capacitate maximă, instructor, replay URL, thumbnail.

### Îmbunătățiri implementate / de implementat
- **Secțiuni în formular**: 
  - „Detalii eveniment” (titlu, descriere, tip).
  - „Program” (dată/ora început, dată/ora sfârșit, timezone).
  - „Locație & acces” (locație, link live, tip acces, curs asociat dacă e cazul).
  - „Opțional” (capacitate, instructor, replay, thumbnail).
- **Validare**: titlu min. 3 caractere; start_date obligatoriu; end_date > start_date.
- **Progress**: indicator de completare (ex. X% completat) opțional pentru formular lung.
- **Design consistent**: același stil de modal/form ca la mape și alte resurse.

---

## 6. Stiluri comune pentru formulare admin

- **Modal**: overlay cu blur; conținut centrat; max-width 480px (standard), 560–640px (lg); titlu + body scrollabil + footer cu acțiuni.
- **Secțiuni**: titlu de secțiune `font-size: 0.875rem`, `font-weight: 600`, `color: var(--text-secondary)`, `margin-top: var(--space-6)`, `margin-bottom: var(--space-2)`.
- **Label**: `admin-form-label`; câmpuri cu `admin-form-input`; erori sub câmp cu culoare de eroare.
- **Butoane**: Anulare = secondary; Salvează/Creează = primary; acțiuni distructive = danger.

---

## Referințe

- LearnWorlds, Articulate Rise, Tutor LMS, Open LMS – course creation & quiz UX.
- Konstantly / Instrumental – design efectiv pentru quiz-uri și assessment.
- Oasis LMS, LearnDash – evenimente și webinarii în LMS.
