Implementare audit — 8 septembrie 2026

Durata ecranului de introducere a fost păstrată, conform interpretării comunicate pentru „1 sărim peste”. Modificările sunt locale; nu s-a executat deploy.

Modificări realizate:

- Tabelul utilizatorilor: acțiuni cu iconițe, etichete accesibile și titluri explicative; coloane limitate, texte lungi gestionate, derulare internă pe mobil și acțiuni fixate în dreapta. Spațiul meniului lateral este rezervat corect. Căutarea are debounce și ignoră răspunsurile întârziate.
- Încărcare dinamică pentru SplashScreen/Three.js și stilurile specifice paginilor; stilurile comune au rămas globale. Worker PDF minificat cu nume versionat prin hash. Chunkuri Recharts fără avertismentele circulare inițiale.
- Ordinea hookurilor reparată, cod nefolosit curățat și exporturi comune separate pentru Fast Refresh. Salvarea notițelor a fost protejată împotriva suprascrierii cu starea inițială goală.
- Rutele demo redirecționează la paginile reale. Disponibilitatea Volt vine din configurația backend, fără expunerea cheilor.
- Progresul folosește interogări agregate; dashboardul reutilizează datele în aceeași cerere și nu repetă testele de curs pentru fiecare modul. Verificarea deblocării eșuată nu produce recomandări accesibile.
- Agregatele de timp sunt filtrate după curs/utilizator în SQL. Timpul cumulativ reprezintă întreaga perioadă pentru selecția respectivă; nu există în această implementare istoric zilnic pentru filtrarea lui după dată.
- Migrare corectivă pentru `courses.settings`, test obligatoriu pentru catalog și migrare idempotentă pentru tabelele cozii.
- Emailurile se trimit prin coadă după commit, cu worker Compose separat. Cache Docker reutilizat implicit; `DEPLOY_NO_CACHE=1` permite rebuild complet. Instalarea dependențelor Docker are straturi separate de surse.
- CI pentru lint, teste frontend, build și PHPUnit.

Verificări locale finale:

| Verificare | Rezultat |
| --- | --- |
| Backend | 70 teste reușite, 282 aserțiuni |
| Frontend | 3 teste reușite |
| ESLint | 0 erori, 53 avertismente rămase |
| Build Vite | Reușit, 3,77 s |
| JavaScript inițial, toate importurile statice | 414,88 kB, față de 915,65 kB; 122,21 kB gzip |
| CSS principal | 386,88 kB, față de 502,74 kB |
| Worker PDF | 1.239,05 kB, față de 2.174,48 kB |

Mărimile exclud modulele încărcate ulterior pentru fiecare rută și nu constituie măsurători de latență în producție. Testul de progres verifică faptul că numărul de interogări rămâne constant pentru 2 și 40 de lecții. Livrarea din coadă a fost testată efectiv cu un worker și transport de email în memorie, inclusiv ordinea față de commit.

Verificările Chrome folosesc API simulat, cu nume/emailuri/echipe lungi, la 1440, 1100, 768 și 390 px. Au fost verificate și autentificarea, catalogul, biblioteca, statisticile și redirecționarea rutei demo. Integrarea browserului cu baza de producție nu a fost testată.

La livrare trebuie rulate migrările și pornit serviciul `queue-worker` împreună cu backendul. Pentru instalări fără Compose este necesar un proces supravegheat `php artisan queue:work database --sleep=2 --tries=3 --timeout=60`, cu `QUEUE_CONNECTION=database` și `DB_QUEUE_RETRY_AFTER=240`. Configurați transportul SMTP pentru livrare reală: valoarea implicită `MAIL_MAILER=log` doar înregistrează mesajele. Monitorizarea se face prin logurile workerului și `php artisan queue:failed`.

Docker nu este disponibil în mediul local: sintaxa YAML și scripturile shell au fost verificate, dar construcția și pornirea containerelor rămân de validat într-un mediu cu Docker. PHPUnit a emis un avertisment de depreciere din dependența Collision pe PHP 8.5; toate testele au trecut.
