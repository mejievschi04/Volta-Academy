**Raport UI/UX — Volta Academy**

Data: 10 septembrie 2026. Domeniu: interfața administratorului și a cursantului.

**Concluzie**

Prioritatea recomandată este simplificarea fluxurilor înaintea unei schimbări majore de stil vizual. Interfața cere utilizatorului să înțeleagă prea multe concepte, locuri de configurare și stări pentru operații precum publicarea unui curs sau reluarea învățării.

Cele mai utile intervenții sunt: publicare cu rezumat clar și erori acționabile, diferențierea dintre salvare și publicare, navigare administrativă mai ușor de înțeles și o acțiune evidentă de continuare pentru cursant.

**Metodă și limite**

Analiza este euristică, bazată pe componentele React, textele interfeței și stilurile proiectului. Nu reprezintă un studiu cu utilizatori sau un audit vizual complet în browser. Contrastul efectiv, dimensiunile zonelor de apăsare, comportamentul pe mobil și navigarea cu tastatura necesită verificare pe ecranele randate.

Observațiile despre comportamente și texte sunt susținute de codul inspectat. Propunerile de organizare și aspect sunt recomandări de design; efectul lor trebuie evaluat prin scenarii de utilizare. Nu au fost modificate componentele aplicației pentru acest raport.

**Elemente existente care merită păstrate**

- Crearea manuală a cursului începe cu puține câmpuri: titlu și descriere.
- Catalogul cursantului are căutare și filtre de progres.
- Testele au contor de răspunsuri, navigare între întrebări și marcaje pentru revizie.
- Există componente reutilizabile pentru confirmări și dialoguri, inclusiv gestionarea focusului.
- Există indicatoare de salvare și mesaje de validare; acestea trebuie uniformizate și conectate mai bine la acțiunile de remediere.

**1. Navigarea administratorului: prea multe concepte apropiate**

Prioritate: ridicată. Bază: [App.jsx](../../volta-frontend/src/App.jsx), [AdminContentPage.jsx](../../volta-frontend/src/pages/admin/AdminContentPage.jsx).

Observație: navigarea combină „Content”, „Teste”, „Examene”, „Întrebări”, „Bibliotecă” și „Ghiduri”. Separarea dintre teste și examene nu explică, prin etichete, ce sarcină rezolvă fiecare. Pentru administrator, secțiunea Cursuri deschide organizarea în mape, ceea ce poate introduce un pas suplimentar pentru găsirea unui curs.

Modificări propuse:

- „Content” devine „Conținut”.
- „Teste” și „Examene” se grupează sub „Evaluări”, păstrând tipurile distincte prin filtre dacă există diferențe funcționale necesare.
- „Verificare manuală” devine „De corectat”, cu numărul lucrărilor în așteptare.
- „Toate cursurile” și „Mape” sunt două vederi explicite ale aceleiași secțiuni.
- Terminologia se aplică identic în meniu, titluri, breadcrumbs și butoane.

Criteriu de acceptare: un administrator nou poate identifica unde creează un curs, unde pregătește o evaluare și unde corectează o lucrare fără explicații despre modelele tehnice ale aplicației.

**2. Publicarea: erorile obligă utilizatorul să refacă traseul**

Prioritate: ridicată. Bază: [PublishCourseModal.jsx](../../volta-frontend/src/components/admin/courses/PublishCourseModal.jsx).

Observație: modalul afișează primele cinci erori și apoi numărul celor rămase. Mesajele pot cere închiderea dialogului, accesarea tabului Workflow, remedierea și revenirea la publicare. Selectarea niciunei echipe înseamnă distribuire pentru toți cursanții, o consecință importantă exprimată prin absența selecției.

Propunere: publicarea devine un rezumat cu patru întrebări clare.

| Întrebare | Interfață propusă |
| --- | --- |
| Este cursul pregătit? | Lista completă a problemelor, grupată pe lecții și teste |
| Cine primește acces? | Alegere explicită: „Toți cursanții” sau „Echipe selectate” |
| Unde apare cursul? | Catalog și/sau mapă, cu denumirea destinației |
| Cine este notificat? | Rezumat al destinatarilor, calculat din regulile reale |

Fiecare eroare oferă o acțiune „Deschide lecția” sau „Deschide testul”. După remediere, setările de distribuire se păstrează. Butonul final descrie acțiunea, de exemplu „Publică pentru echipele selectate”.

Criteriu de acceptare: utilizatorul poate vedea toate blocajele, ajunge direct la elementul problematic și revine fără să refacă selecția audienței. Rezumatul corespunde exact accesului și notificărilor aplicate de backend.

**3. Salvarea și publicarea: stări insuficient diferențiate**

Prioritate: ridicată. Bază: [AdminCourseBuilderPage.jsx](../../volta-frontend/src/pages/admin/AdminCourseBuilderPage.jsx).

Observație: builderul afișează starea cursului „Publicat” sau „Ciornă”, dar procesul include și modificări nepublicate. Un mesaj „Salvat” nu spune dacă elevul vede deja schimbarea.

Propunere de afișare permanentă:

> Publicat · Ai modificări nepublicate
>
> Modificările sunt salvate. Cursanții văd versiunea publicată anterior.

Acțiuni: „Previzualizează ca elev” și „Publică modificările”. Pentru o salvare eșuată: „Modificările nu au fost salvate” și „Reîncearcă”, cu păstrarea conținutului introdus.

Criteriu de acceptare: autorul poate distinge fără presupuneri între modificare locală, salvare confirmată și versiune vizibilă cursanților. Această prezentare trebuie introdusă împreună cu garanția tehnică a izolării versiunilor, discutată în auditul general.

**4. Badge-urile de stare pot declanșa acțiuni cu impact**

Prioritate: ridicată. Bază: [AdminCourseBuilderPage.jsx](../../volta-frontend/src/pages/admin/AdminCourseBuilderPage.jsx).

Observație: statusul lecțiilor și testelor poate fi apăsat pentru publicare sau retragere. Aspectul unui indicator de stare poate să nu sugereze suficient că schimbă disponibilitatea conținutului.

Propunere: badge separat pentru informație și meniu explicit pentru „Publică”, „Retrage”, „Duplică” și „Șterge”. Pentru retragerea conținutului utilizat, explicația trebuie să numească elementul și consecința asupra cursanților.

Criteriu de acceptare: simpla explorare a statusului nu schimbă disponibilitatea. Acțiunile sunt accesibile și prin tastatură și pe ecrane tactile.

**5. Crearea cu Volt: promisiune și disponibilitate neclare**

Prioritate: medie. Bază: [CourseCreationPage.jsx](../../volta-frontend/src/pages/admin/CourseCreationPage.jsx).

Observație: textul promite construirea unui „curs complet”, deși materialul generat necesită revizuire. Opțiunea rămâne selectabilă când serviciul nu este disponibil, iar utilizatorul află acest lucru după interacțiune.

Text propus:

> Generează o ciornă cu Volt
>
> Primești o structură și propuneri de lecții pe care le poți revizui.

Disponibilitatea se indică înaintea clickului. Titlul și descrierea deja introduse se reutilizează în generare. Înainte de aplicare, autorul vede ce va fi creat și poate ajusta rezultatul.

Criteriu de acceptare: schimbarea între manual și Volt nu pierde datele introduse; utilizatorul înțelege că rezultatul necesită verificare.

**6. Catalogul cursantului: următoarea acțiune poate fi mai evidentă**

Prioritate: ridicată. Bază: [CoursesPage.jsx](../../volta-frontend/src/pages/CoursesPage.jsx), [DashboardPage.jsx](../../volta-frontend/src/pages/DashboardPage.jsx).

Observație: catalogul oferă căutare și filtre, iar proiectul are componente pentru reluarea învățării. Acestea ar trebui conectate la pagina de intrare efectivă a cursantului, care este Cursuri.

Propunere: primul element util din pagină este reluarea activității, când există progres anterior.

> Continuă: Siguranța la locul de muncă
>
> Lecția 3 din 8 · aproximativ 7 minute
>
> Continuă lecția

Ordine recomandată: continuarea activității → cursuri obligatorii cu termen, când există → cursuri începute → restul catalogului. Mapele rămân disponibile pentru explorare, fără să fie obligatorii pentru reluare.

Criteriu de acceptare: un cursant care revine ajunge la lecția relevantă printr-o singură acțiune din pagina de intrare. Dacă nu are cursuri atribuite, mesajul explică ce se întâmplă mai departe și oferă un contact sau o acțiune disponibilă.

**7. Testele: finalizarea trebuie să reducă incertitudinea**

Prioritate: ridicată. Bază: [ExamPage.jsx](../../volta-frontend/src/pages/ExamPage.jsx), [TestAttemptFooter.jsx](../../volta-frontend/src/components/student/TestAttemptFooter.jsx).

Elemente de păstrat: navigarea întrebărilor, contorul răspunsurilor și marcarea pentru revizie.

Propunere: înainte de trimiterea definitivă, un rezumat al completării și legături directe la întrebările rămase.

> Ai răspuns la 17 din 20 de întrebări.
>
> 3 fără răspuns · 2 marcate pentru revizie.

Acțiuni: „Vezi întrebările fără răspuns” și „Trimite definitiv”. După trimitere, rezultatul diferențiază vizibil „În curs de corectare”, „Promovat” și „Nepromovat”. Reîncercarea explică limita rămasă și condițiile aplicabile.

Criteriu de acceptare: utilizatorul înțelege dacă mai poate modifica răspunsurile, dacă rezultatul este definitiv și care este următorul pas. La eroare de rețea, răspunsurile sunt păstrate și starea trimiterii este clarificată înainte de o nouă încercare.

**8. Lizibilitate și consistență vizuală**

Prioritate: medie. Bază: [admin-course-builder.css](../../volta-frontend/src/styles/admin-course-builder.css), [design-system.css](../../volta-frontend/src/styles/design-system.css).

Observație: în stilurile builderului există dimensiuni de 10–12 px și numeroase variante de text. Aceste valori sunt puncte de verificat în context, mai ales pentru informația importantă.

Propuneri de bază, de validat vizual:

- Text obișnuit de aproximativ 16 px și etichete secundare de 13–14 px.
- O scară scurtă de titluri, spațieri și raze de colț, reutilizată între ecrane.
- Un stil de acțiune principală și unul secundar; acțiunile distructive sunt diferențiate consecvent.
- Terminologie unitară: „cursant”, „ciornă”, „conținut”, „previzualizare”, cu diacritice.
- Stările folosesc text sau iconiță explicativă împreună cu culoarea.

Criteriu de acceptare: aceeași acțiune arată și se numește la fel între ecrane. Contrastul și zoomul sunt verificate pe variantele randate, inclusiv în temele disponibile. Nu se recomandă schimbarea paletei doar pe baza codului CSS.

**9. Accesibilitatea dialogurilor și formularelor este neuniformă**

Prioritate: ridicată. Bază: [Modal.jsx](../../volta-frontend/src/components/common/Modal.jsx), [ConfirmModal.jsx](../../volta-frontend/src/components/common/ConfirmModal.jsx), [PublishCourseModal.jsx](../../volta-frontend/src/components/admin/courses/PublishCourseModal.jsx), [CourseCreationPage.jsx](../../volta-frontend/src/pages/admin/CourseCreationPage.jsx).

Observație: există dialog comun cu gestionarea focusului, dar publicarea folosește o implementare separată. În formularul simplu de creare, unele etichete nu sunt asociate explicit cu inputurile prin `htmlFor` și `id`.

Propuneri: reutilizarea componentei comune, titlu accesibil pentru fiecare dialog, focus inițial potrivit, revenirea focusului la închidere și erori asociate câmpurilor. Motivul indisponibilității unui buton trebuie să fie vizibil, nu comunicat exclusiv prin tooltip.

Criteriu de acceptare: creare curs și publicare realizabile numai cu tastatura; focusul nu ajunge în spatele dialogului; etichetele și erorile pot fi identificate de tehnologiile asistive.

**10. Mobilul necesită o organizare proprie pentru editare**

Prioritate: medie, de validat în browser. Bază: structura builderului și bara fixă din [TestAttemptFooter.jsx](../../volta-frontend/src/components/student/TestAttemptFooter.jsx).

Propunere pentru builder: editor pe toată lățimea, structura cursului într-un panou la cerere și acțiunile esențiale permanent accesibile. Acțiunile nu depind de hover.

Pentru teste: verificarea spațiului rămas când se deschide tastatura și a faptului că bara fixă nu acoperă câmpurile sau ultimul răspuns. Pentru administrare: prioritizarea coloanelor și acces explicit la detalii, fără comprimarea excesivă a textului.

Criteriu de acceptare: verificări la lățimi de 390, 768 și 1440 px, cu titluri lungi, multe întrebări și mesaje de eroare. Aceste dimensiuni sunt propuse pentru testare; nu sunt rezultate deja obținute în acest audit.

**Ordinea recomandată de implementare**

| Etapă | Modificări | Rezultat urmărit |
| --- | --- | --- |
| 1 | Publicare, erori acționabile, audiență explicită și stare salvat/publicat | Mai puțină incertitudine la acțiunile cu impact |
| 2 | Navigare și terminologie; separarea badge-urilor de acțiuni | Găsirea mai rapidă a funcțiilor și reducerea modificărilor accidentale |
| 3 | Continuarea învățării și rezumatul final al testului | Următorul pas evident pentru cursant |
| 4 | Dialoguri/formulare accesibile și feedback unitar la erori | Fluxuri utilizabile cu tastatura și recuperare mai clară |
| 5 | Uniformizarea stilurilor, mobil și formularea funcției Volt | Consistență vizuală și adaptare la contexte diferite |

**Plan de validare cu utilizatori**

Scenariile recomandate sunt: creare manuală a unui curs, găsirea unei erori de publicare, publicare pentru o echipă, modificarea unui curs deja publicat, reluarea unei lecții și trimiterea unui test cu întrebări omise.

Pentru fiecare scenariu se măsoară timpul până la finalizare, numărul de reveniri între ecrane, intervențiile necesare din partea evaluatorului și dacă utilizatorul poate explica rezultatul acțiunii. Se compară versiunea actuală cu propunerea folosind aceleași sarcini. Nu există încă valori de referință sau rezultate măsurate pentru aceste criterii.

Recomandarea este un redesign incremental, începând cu publicarea și claritatea stărilor, păstrând componentele care funcționează deja bine.
