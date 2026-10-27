# Hai Moldova — arhitectura platformei

Data: 15 octombrie 2026. Statut: propunere de produs și arhitectură, înainte de implementare.

## 1. Recomandarea

O singură aplicație Next.js pentru site, contul prestatorului, panoul administrativ și API, organizată în module de domeniu. PostgreSQL cu PostGIS pentru date și hartă; câmpuri configurabile cu definiții versionate și valori JSONB; Better Auth pentru conturi; Cloudflare R2 pentru fișiere; Resend pentru emailuri.

Aplicația web și un proces de fundal rulează din același repository. Procesul de fundal execută emailuri, procesare imagini, importuri și verificări periodice. Nu există un al doilea backend de business și nu împărțim produsul în microservicii.

Principiul central: identitatea, permisiunile și publicarea au reguli stabile; administratorii configurează datele editoriale, formularele și prezentarea în limite clare. Flexibilitatea câmpurilor nu înseamnă logică arbitrară executabilă din admin.

## 2. Ce există în repository

Analiza fișierelor locale arată:

- Next.js 16.4.0, React 19.3, TypeScript, Tailwind CSS 4, Leaflet.
- Date, categorii și filtre locale în `src/features/places/data.ts`.
- Un singur model `Place`, cu câmpuri fixe și categorii enumerate în `src/features/places/types.ts`.
- `experience` este acum o categorie, nu o entitate cu relație către o locație.
- `Explorer` importă direct toate datele și filtrează în browser; contractul `PlacesRepository` există, dar nu reprezintă încă sursa efectivă pentru interfață.
- Favorite în localStorage; profil demonstrativ; fără autentificare, bază de date, moderare sau upload persistent.
- Contacte generate pentru demonstrație, fotografii ilustrative, ratinguri și prețuri mock.
- RO/EN/RU, cu traduceri în cod și alegerea limbii în localStorage.
- Leaflet cu tile-uri raster OSM/Esri; servicii Photon și OSRM publice pentru căutare și rutare.
- Cache-ul și serializarea căutărilor sunt în memoria unui proces; nu coordonează mai multe instanțe.

Păstrăm identitatea vizuală, componentele reutilizabile și izolarea serviciilor geografice. Refacem modelul de date, sursa de conținut și experiența mobilă. Datele demonstrative nu devin automat conținut real verificat.

Au fost consultate ghidurile livrate cu versiunea Next instalată: `backend-for-frontend.md`, `data-security.md`, `authentication.md`. Acestea cer autorizare în operațiile de server și recomandă un strat dedicat de acces la date; operațiile lungi trebuie tratate separat de răspunsul HTTP.

## 3. Produsul și granițele sale

Trei suprafețe:

1. **Explorare publică:** hartă, listă, căutare, filtre, pagini individuale, contacte, rezervare externă, favorite, formular de raportare.
2. **Contul prestatorului:** profil verificat prin email, locațiile și experiențele proprii, ciorne, trimitere spre verificare, observații și istoric.
3. **Administrare:** moderare, conținut, categorii, șabloane și câmpuri, media, echipă, configurări widget, rapoarte și jurnal de activitate.

Vizitatorii explorează fără cont. Contul este obligatoriu pentru contribuții persistente și trimiterea lor spre validare. Un utilizator poate administra mai multe locații; colaboratorii se adaugă prin invitație, cu drepturi pe fiecare locație.

**Ipoteză de lucru pentru rezervări:** butoanele trimit către gazdă sau către un sistem extern de rezervări. Disponibilitatea, plățile, anulările și confirmarea unei rezervări în platformă ar constitui un modul tranzacțional separat. Etichetele publice trebuie să descrie corect acțiunea: „Contactează pentru rezervare” și „Rezervă online”.

**Politică de limbi propusă:** RO obligatoriu pentru publicare, EN administrat separat; dacă EN lipsește, afișăm explicit conținutul RO. Interfața este completă în RO/EN. Traducerea automată poate ajuta editorul, dar rezultatul nu se publică automat. Publicarea obligatoriu bilingvă poate fi activată ca regulă editorială mai strictă.

## 4. Locațiile și experiențele

Locația este un loc fizic: vinărie, pensiune, muzeu, rezervație. Experiența este o ofertă: degustare, atelier, tur ghidat, plimbare cu caii.

Exemplu: „Pensiunea X” are o fișă proprie și oferă „Atelier de plăcinte”, „Tur al satului”, „Cină tradițională”. Experiențele au descriere, galerie, preț și durată proprii și pot avea canale de rezervare diferite.

Folosim identitatea comună `listing`, cu tip stabil `location` sau `experience`, plus o relație explicită experiență–locație. Interfața admin arată două secțiuni distincte. Tipul este diferit de categorie și de șablon.

- Tip: Locație / Experiență.
- Categorie: Vinării / Cazare / Gastronomie / Ateliere / Natură etc.; administrată în DB, cu traduceri și icon dintr-o bibliotecă sigură.
- Șablon: stabilește ce câmpuri și secțiuni se completează. O experiență gastronomică poate folosi șablonul Atelier.

O experiență poate avea mai multe puncte de desfășurare; modelăm relația many-to-many, cu un punct principal pentru afișarea inițială. Poate exista și independent, cu punct de întâlnire propriu. Dacă folosește coordonatele locației, acest lucru este explicit și se copiază în versiunea publicată; modificările ulterioare ale gazdei nu schimbă implicit experiența aprobată.

Harta grupează ofertele la aceeași poziție: „Pensiunea X · 3 experiențe”. Filtrul permite Locații / Experiențe / Toate. Nu suprapunem marcaje imposibil de selectat.

## 5. Câmpuri configurabile pentru oameni fără experiență tehnică

### 5.1 Nucleul stabil

Câteva elemente rămân structurale: ID, tip, proprietar/membri, pointer la versiunea publicată, ciclu de viață, istoric. Conținutul obligatoriu pentru o fișă publicabilă include nume, adresă sau punct de întâlnire, coordonate și descriere; editorul poate configura prezentarea și cerințe suplimentare, dar nu poate elimina regulile care fac harta funcțională.

Și câmpurile standard apar în editor ca blocuri cunoscute, cu etichete și poziționare configurabile. Telefonul, prețul, programul și linkul de rezervare pot fi activate opțional. Astfel nu duplicăm „Telefon” de fiecare dată și nu ajungem la cinci câmpuri de preț incompatibile.

### 5.2 Tipuri suportate

| Tip de câmp | Comportament |
| --- | --- |
| Text scurt / descriere | Limite de lungime; traduceri unde au sens |
| Număr | Limite, unitate, numere întregi sau zecimale |
| Preț | Sumă exactă, monedă, unitate, mod de tarifare |
| Telefon / email / URL | Validare specifică și prezentare standard |
| Da/Nu | Valori booleene, nu text liber |
| Alegere / alegere multiplă | Opțiuni cu ID-uri stabile și etichete RO/EN |
| Durată | Valoare normalizată în minute, prezentare prietenoasă |
| Dată / perioadă | Inclusiv data de expirare a unei oferte |
| Program | Intervalele săptămânale și excepții, fus Europe/Chisinau |
| Galerie / document | Referințe la fișiere cu permisiuni, nu URL-uri arbitrare |
| Relație | Alegere din locațiile/experiențele permise |
| Facilități | Listă controlată, reutilizabilă în filtre |

Tipurile complexe standard sunt implementate o dată de dezvoltator. Administratorul poate crea câte câmpuri dorește din tipurile disponibile. Un nou tip de comportament — de exemplu disponibilitate rezervabilă — necesită dezvoltare; schimbarea unei etichete sau adăugarea unui telefon nu necesită.

### 5.3 Cum adaugă adminul un câmp

Exemplu: Administrare → Formulare → Atelier → Adaugă câmp → Telefon.

Completează „Telefon pentru rezervări”, eticheta EN, un text de ajutor, dacă este obligatoriu, cine îl completează, dacă se publică și unde apare. Poate alege să se aplice tuturor atelierelor sau doar anumitor categorii. Vede previzualizarea formularului și fișei, apoi publică modificarea.

Configurația permite:

- secțiuni simple: Prezentare, Poziție, Fotografii, Contact, Detalii;
- ordonare prin drag-and-drop;
- vizibilitate publică sau internă, independentă de permisiunea de editare;
- obligatoriu pentru trimitere sau pentru publicare;
- condiții simple, precum „arată Preț dacă Acces gratuit = Nu”; fără cod sau formule arbitrare;
- afișare în fișă, card sau filtru, dacă tipul permite;
- șabloane pregătite, clonare și bibliotecă de câmpuri standard.

Administratorii văd etichete și exemple, fără JSON, SQL sau chei tehnice.

### 5.4 Definiții și valori

Definițiile câmpurilor sunt în tabele; valorile suplimentare sunt JSONB în revizia conținutului, indexate prin ID stabil de câmp. Redenumirea nu schimbă ID-ul și nu pierde valorile existente.

Fiecare definiție versionată conține: tip, etichete, reguli de validare, condiții, secțiune, ordine, drepturi, caracter localizabil și semantică opțională (`contact_phone`, `booking_url`, `price`).

Același contract de schemă generează formularul prestatorului, formularul adminului, validarea pe server și afișarea publică. Nu trimitem automat toate valorile JSONB către browser; construim un răspuns cu numai câmpurile publice autorizate.

Pentru telefon și preț folosim semantică standard. Un telefon suplimentar poate fi prezentat generic în Contacte, dar butonul principal de rezervare folosește câmpul desemnat explicit pentru acel rol. Pentru preț: sumă în unități monetare minore, cod de monedă, unitate (persoană/noapte/grup), mod (fix/de la/gratuit/la cerere/necunoscut). Lipsa prețului nu înseamnă gratuit. Filtrele nu compară o noapte de cazare cu o degustare ca și când ar fi același produs.

### 5.5 Schimbările în timp

Schema are ciornă și versiuni publicate. O revizie de conținut indică versiunea de schemă folosită.

- Schimbarea etichetei și ordinii este sigură.
- Un câmp nou opțional nu blochează conținutul existent.
- Un câmp nou obligatoriu afișează numărul fișelor afectate. Se aplică noilor trimiteri; cele publicate primesc o sarcină de completare, fără să dispară automat.
- Schimbarea tipului sau eliminarea unei opțiuni utilizate cere previzualizarea impactului și o migrare controlată. Nu convertim implicit text în număr.
- Câmpurile utilizate se arhivează, păstrând definițiile istorice și valorile.
- Un formular deschis înaintea schimbării schemei rămâne salvat pe versiunea sa; la trimitere, serverul migrează numai schimbările compatibile și cere completări pentru restul.
- Schimbările de vizibilitate intern/public sunt tratate ca schimbări sensibile; se verifică impactul și se invalidează proiecțiile/cache-urile. Nu publicăm retrospectiv valori interne fără revizie aprobată.
- Proiecția publică folosește definițiile aprobate pentru revizia respectivă; schimbările globale pur vizuale pot fi aplicate separat. Ascunderea urgentă a unui câmp trebuie să poată suprascrie afișarea pentru toate reviziile.

## 6. Conturi, administratori și drepturi

Înregistrare cu nume, email și parolă. Confirmare prin link cu expirare și utilizare unică, retrimitere limitată, recuperare parolă și schimbare email cu reverificare. Linkul revine în fluxul de adăugare început. Formularele sunt salvate pentru a nu pierde munca.

Better Auth gestionează autentificarea și sesiunile în PostgreSQL; Resend livrează emailurile. Folosim un singur sistem de autentificare. Dacă Supabase găzduiește DB, nu activăm în paralel Supabase Auth.

| Rol | Drepturi implicite |
| --- | --- |
| Vizitator | Explorează și salvează local favorite |
| Prestator | Creează și modifică propriile ciorne; trimite spre moderare; invită colaboratori la propriile fișe |
| Moderator | Verifică propuneri, cere corectări, aprobă/respinge și retrage conținut problematic |
| Administrator | Gestionează tot conținutul, categoriile, șabloanele, media și configurările editoriale |
| Administrator principal | Toate cele de mai sus, invită/revocă administratori, atribuie drepturi și gestionează configurările sensibile |

Conturile voastre inițiale sunt administratori principali. Invitațiile pentru alți administratori se fac din interfață, prin email și acceptare pe cont verificat. Dacă un administrator obișnuit trebuie să invite alți administratori, primește explicit permisiunea `team.manage`, fără drept de promovare peste propriul nivel.

Nu există înregistrare publică în rol de admin. Primul administrator principal se creează printr-o procedură de bootstrap unică, apoi dezactivată. Nu se poate revoca ultimul administrator principal. Schimbarea rolurilor și revocarea accesului invalidează sesiunile relevante; operațiile privilegiate verifică drepturile actuale în DB.

Autentificare în doi pași obligatorie pentru echipa administrativă, cu recuperare documentată. Se confirmă compatibilitatea exactă a pluginului în versiunea Better Auth aleasă la implementare.

Drepturile asupra unui listing sunt verificate pe fiecare operație. Un utilizator nu devine proprietar al unei locații doar pentru că și-a confirmat emailul. Revendicarea unei locații create de echipă este o cerere separată, aprobată după verificarea dovezilor; documentele aferente rămân private.

## 7. Moderare și publicare

Stările reviziei: Ciornă → În verificare → Necesită corectări / Respinsă / Aprobată. Starea fișei: Nepublicată / Publicată / Suspendată / Arhivată.

Fluxul inițial:

1. Utilizatorul alege Locație sau Experiență și categoria; primește formularul potrivit.
2. Completează, salvează automat, încarcă imagini, alege punctul exact pe hartă.
3. Serverul verifică emailul, drepturile, schema, coordonatele, relațiile și fișierele procesate.
4. La trimitere se fixează o revizie nemodificabilă, iar adminul primește o sarcină.
5. Moderatorul vede previzualizarea, eventuale duplicate și datele lipsă. Poate cere corectări cu comentarii pe câmpuri, respinge motivat sau publica.
6. Publicarea actualizează atomic pointerul către versiunea aprobată și proiecția pentru căutare/hartă; creează evenimente pentru notificări și invalidarea cache-ului.
7. Utilizatorul vede decizia și istoricul în cont.

**Modificările după publicare:** versiunea aprobată A rămâne online; proprietarul lucrează la B. B trece prin moderare și abia apoi înlocuiește A. Acest lucru include titlu, coordonate, fotografii, traduceri, contacte, legături către experiențe și toate valorile dinamice. Separarea doar a câmpului `status` este insuficientă.

O revizie trimisă nu mai poate fi modificată în timp ce moderatorul o verifică. O corectare creează o revizie nouă. Acțiunile de aprobare sunt condiționate de ID-ul reviziei și versiunea rândului; doi moderatori nu pot suprascrie neobservat deciziile. Repetarea aceleiași cereri nu publică de două ori.

Retragerea urgentă ascunde imediat fișa din toate suprafețele, inclusiv widget și căutare. Pentru această operație nu acceptăm servirea conținutului retras dintr-un cache vechi. Restaurarea unei versiuni anterioare este o acțiune explicită și auditată.

Adminul poate publica propriile corectări dacă are permisiunea, dar ele trec prin aceleași validări și istoric. Proprietarul nu poate reînvia printr-o editare o fișă suspendată.

## 8. Organizarea administrării

Meniu propus:

- **De verificat:** coadă ordonată după vechime, propuneri noi vs. modificări, responsabil, status, timp în așteptare.
- **Locații / Experiențe:** tabel și hartă, filtre, operații în lot controlate, istoric, previzualizare, suspendare/arhivare.
- **Categorii și facilități:** nume RO/EN, descriere, ordine, culoare, icon sigur, ierarhie scurtă; impact înainte de arhivare.
- **Formulare și câmpuri:** șabloane, bibliotecă de câmpuri, condiții simple, previzualizare, publicarea schemei.
- **Fotografii și fișiere:** fișiere asociate, drepturi de utilizare, status de procesare și fișiere neutilizate.
- **Utilizatori și echipă:** invitații, acces pe fișe, suspendare cont, revendicări.
- **Widgeturi:** parteneri, domenii, teme, selecții de conținut, cod de integrare.
- **Calitatea datelor:** traduceri lipsă, contacte vechi, experiențe expirate, linkuri invalide, raportări.
- **Activitate și setări:** cine a făcut ce, exporturi, notificări și configurări operaționale relevante.

Editorul obișnuit vede doar acțiunile necesare muncii sale. Configurarea formularelor este separată de editarea zilnică. Nu permitem ștergerea accidentală a unei categorii care încă are conținut asociat: alegem mutare sau arhivare.

## 9. Baza de date

**PostgreSQL gestionat, cu PostGIS, găzduit inițial în Supabase**, într-o regiune apropiată de serverul aplicației. Supabase este folosit ca furnizor de PostgreSQL, nu ca al doilea backend accesat direct din browser.

De ce: relații și tranzacții pentru drepturi/publicare; JSONB pentru câmpurile configurabile; PostGIS pentru hartă și distanțe. Drizzle oferă acces tipizat și migrații, cu SQL explicit acolo unde interogările geografice sau JSONB o cer. Nu avem nevoie inițial de MongoDB sau Elasticsearch.

Tabele conceptuale:

| Grup | Tabele și responsabilitate |
| --- | --- |
| Autentificare | Tabelele cerute de Better Auth pentru user, session, account și verification; extensiile de rol/2FA conform versiunii alese |
| Echipă | Invitații administrative, granturi de permisiuni, invitații de colaborare |
| Catalog | `listings` pentru identitate și ciclu de viață; `listing_members` pentru acces |
| Versiuni | `listing_revisions`, traduceri, valori JSONB, relații și asocieri media pe revizie |
| Structură | `categories`, traduceri, bibliotecă de câmpuri, versiuni de schemă și configurările de câmp |
| Publicare | `published_listings`, proiecție reconstruibilă exclusiv din reviziile aprobate |
| Media | `assets`, variante, asocieri pe revizii, proprietar, status, acces, sursă și drepturi |
| Moderare | Decizii, comentarii pe câmp, sarcini, revendicări, raportări |
| Utilizator | Favorite sincronizate și notificări în aplicație |
| Integrare | Configurări widget, parteneri și domenii permise |
| Operare | Audit, evenimente outbox și tabelele cozii de sarcini |

ID-uri stabile, chei externe, constrângeri de unicitate și control al concurenței. Categorii, traduceri și relații editoriale afectate de moderare sunt incluse în versiunea aprobată; categoriile globale au propriul control de publicare/arhivare.

Coordonatele: stocare geografică WGS84 și index GiST; căutare pe viewport și rază. Contractul aplicației folosește obiecte `{ lat, lng }`; conversia către GeoJSON/PostGIS este `[lng, lat]`, în timp ce Leaflet folosește `[lat, lng]`. Conversiile se fac în adaptoare și se testează.

Indexuri: pe publicare/tip/categorie, geo, proprietar, coada de moderare, căutare text normalizată. JSONB primește indexuri GIN sau expresii țintite în funcție de interogări; pentru filtrarea tipizată după câmpuri dinamice folosim o proiecție `published_field_values` cu valori număr/bool/opțiune/text. Proiecția este derivată, nu sursa de adevăr.

Activarea unui filtru nou declanșează pregătirea și verificarea proiecției; filtrul apare public după finalizarea acesteia. Administratorul nu creează DDL sau indexuri arbitrare. Interogările folosesc ID-uri de câmp și operatori permiși, valori parametrizate și limite de complexitate.

Browserul comunică doar cu Next.js. DB și cheile privilegiate rămân pe server. Schema aplicației nu este expusă accidental prin Supabase Data API; folosim schemă neexpusă, granturi restrictive și RLS unde este relevant. Conexiunile pooled sunt alese pentru web; workerul folosește un mod de conexiune compatibil cu pg-boss. Validăm limitele și drepturile necesare la configurare.

## 10. Backendul Next.js

Organizare orientativă:

```text
src/app/[locale]/                 explorare și pagini RO/EN
src/app/[locale]/cont/            cont și contribuții
src/app/admin/                   administrare
src/app/embed/[widgetId]/         hartă pentru parteneri
src/app/api/                     auth, căutare, upload, webhooks, widget
src/modules/auth/                identitate și sesiuni
src/modules/access/              roluri și drepturi pe resurse
src/modules/catalog/             locații, experiențe, relații
src/modules/content-schema/      definiții, versiuni, validare
src/modules/moderation/          decizii și publicare
src/modules/media/               fișiere și variante
src/modules/maps/                adaptoare geo și furnizori
src/modules/notifications/       email și notificări interne
src/modules/widgets/             configurare și politici embed
src/server/db/                   schema DB și migrații
src/server/jobs/                 handlers și worker
src/server/audit/                jurnal și outbox
```

Acțiunile și endpointurile sunt subțiri: identifică cererea, validează, apelează serviciul de domeniu. Serviciile aplică autorizarea, regulile și tranzacțiile. Stratul de acces la date rulează `server-only` și întoarce răspunsuri minimale, distincte pentru public, proprietar și admin.

Server Components citesc direct serviciile serverului, fără cerere HTTP internă către propriul `/api`. Clientul interactiv folosește Route Handlers; Server Actions sunt potrivite pentru formularele aplicației. Niciuna nu este considerată protejată doar fiindcă nu apare în meniu. Proxy poate face redirecționări preliminare; autorizarea reală rămâne lângă accesul la date.

Datele din cont și admin sunt private și nu folosesc cache public partajat. Conținutul public poate fi cache-uit cu chei care includ limba, filtrele și configurația widgetului. Publicarea invalidează suprafețele afectate. Retragerea urgentă are un mecanism care previne livrarea unei versiuni retrase din cache.

## 11. Fișiere și fotografii

**Cloudflare R2, compatibil S3**, cu zone/bucketuri separate pentru încărcări private, fișiere publicate și documente private. În DB se păstrează metadatele și referințele; fișierele nu se salvează în repository, în DB sau pe discul temporar al aplicației.

Flux:

1. Next verifică sesiunea, emailul, accesul la fișă, limitele și quota; creează un asset `pending`.
2. Emite un URL semnat pentru un obiect privat cu cheie aleatoare, durată scurtă și CORS restrictiv.
3. Browserul încarcă direct, fără a expune chei de stocare.
4. Finalizarea verifică obiectul în storage: proprietar, dimensiune reală, tip real, integritate și limite de decodare; nu se bazează doar pe extensie sau `Content-Type` declarat.
5. Workerul decodează și recodifică fotografiile, elimină EXIF și produce variante pentru card/galerie. Documentele au verificări specifice și scanare înainte de acces, când sunt acceptate.
6. Moderatorul vede variantele private prin acces temporar. Numai imaginile aprobate sunt promovate în zona publică.

Un upload nou la o fișă publicată rămâne privat până la aprobarea reviziei. Documentele de revendicare nu se promovează niciodată public. Fișierele folosite în revizii istorice nu se șterg printr-o simplă curățare a galeriei. O politică de retenție controlează când se pot elimina.

Propunere inițială de limite, ajustabile: 10 fotografii per fișă, 10 MB per fotografie, JPEG/PNG/WebP, fără SVG sau HTML arbitrar. Declararea sursei și a dreptului de utilizare; text alternativ RO/EN. Orice suport pentru fotografii HEIC pe mobil trebuie implementat și verificat explicit sau comunicat clar în formular.

Originalele private rămân protejate; variantele publice aprobate sunt distribuite prin domeniu media/CDN. URL-urile deja publicate pot fi copiate de terți: retragerea nu garantează ștergerea copiilor externe. În propriul sistem, retragerea elimină referințele și invalidează cache-ul/CDN după politica operațională.

## 12. Sarcini de fundal și fiabilitate

Recomandare: pg-boss peste PostgreSQL și un worker Node separat ca proces, din același repository, cu aceeași logică de domeniu. Evităm un Redis obligatoriu doar pentru coadă.

În tranzacția de publicare scriem modificarea și evenimentul outbox. Workerul livrează ulterior evenimentul în coadă și marchează progresul. Astfel nu pierdem emailul sau reindexarea dacă aplicația se oprește imediat după commit. Repetările sunt tolerate prin chei de idempotență. Nu presupunem că efectele externe se execută exact o dată.

Sarcini: emailuri de verificare și moderare, procesare imagini, export/import, verificare linkuri publice cu restricții anti-SSRF, expirarea ofertelor, remindere pentru date vechi și curățare controlată. Linkurile de autentificare au mecanism de livrare care nu loghează tokenuri și nu permite trimiterea după expirare; retenția datelor sensibile din coadă este limitată.

Retry cu întârzieri, limită de încercări, coadă de eșecuri și relansare din admin. Monitorizăm vechimea celei mai vechi sarcini și erorile, nu doar dacă procesul este pornit.

Emailurile folosesc domeniu verificat, configurare SPF/DKIM/DMARC și template-uri RO/EN. Webhooks de livrare/bounce sunt verificate și procesate idempotent. Notificarea de moderare rămâne vizibilă în cont chiar dacă emailul nu ajunge.

## 13. Harta, căutarea și feedbackul vizual

### Stilul hărții

Leaflet poate schimba marcaje, controale și furnizorul de hartă raster. Nu poate recolora separat drumurile și textele deja desenate în tile-urile raster.

Pentru stil de brand coerent recomand MapLibre GL JS cu tile-uri vectoriale de la un furnizor precum MapTiler. Stilul controlează culori, densitatea etichetelor și ierarhia vizuală. Atribuirile obligatorii rămân. Integrarea se ascunde în spatele componentei/adaptorului existent, nu în serviciile catalogului.

Înainte de migrare: test pe telefoane modeste, WebGL indisponibil, touch și rețea lentă. Lista trebuie să fie complet utilizabilă și fără hartă. MapLibre este motorul de afișare; tile-urile, geocodarea și rutarea sunt servicii distincte, cu licențe și costuri distincte.

Photon/OSRM publice rămân pentru dezvoltare. Pentru lansare alegem furnizori contractați sau instanțe proprii dimensionate; nu operăm serviciile geografice în cadrul procesului Next.js. Cheile browserului sunt restricționate la domenii, iar cheile secrete rămân pe server.

### Mobil

- Hartă pe tot spațiul disponibil, căutare sus și acces permanent la „Adaugă locația sau experiența ta”.
- Panou inferior cu niveluri: sumar restrâns, listă la jumătate de ecran, listă completă. Alternativă accesibilă prin butoane, nu doar gesturi.
- Categorii rapide orizontale; filtre într-un panou separat, cu număr de rezultate și buton „Arată rezultatele”.
- La deplasarea hărții: „Caută în această zonă”; nu resetăm permanent lista în timpul gesturilor.
- Marcajul și cardul selectat sunt sincronizate. Back închide fișa și restabilește lista și poziția hărții.
- URL-ul păstrează limba, filtrele și selecția; share și Back funcționează predictibil.
- Fișa are galerie și contacte clare, cu bară de acțiuni persistentă în partea de jos. Respectăm safe-area și rezervăm spațiu ca să nu acoperim conținutul.
- Butoanele de rezervare apar numai când există date valide; pentru locațiile fără rezervări folosim acțiuni relevante, precum Traseu.
- Textele promoționale redundante din zona hărții sunt eliminate. Harta, căutarea și rezultatele au prioritate.

### Căutarea și performanța

Catalogul și adresele sunt două surse de rezultate distincte. Catalogul caută în conținutul aprobat RO/EN, cu normalizare fără diacritice și potrivire aproximativă. Adresele vin din geocoder. Nu expunem existența ciornelor prin autocomplete sau numărători.

Serverul aplică aceleași filtre pentru hartă, listă și numărători. Lista este paginată cu ordine stabilă. Harta primește date ușoare pe viewport și clustere; detaliile se încarcă la selecție. Nu trimitem toate galeriile și toate câmpurile tuturor locațiilor la încărcarea inițială.

Căutarea inițială folosește PostgreSQL full-text, normalizare și `pg_trgm`; o configurație de căutare RO/EN se verifică pe date reale. Un motor separat se justifică ulterior prin măsurători, nu doar prin posibilitatea de creștere.

Ratingurile și recenziile demonstrative dispar din producție. Un modul real de recenzii ar necesita identitate, moderare, raportări și reguli separate; nu publicăm statistici fabricate.

## 14. Widget pentru parteneri

Rută dedicată `/embed/[widgetId]`, cu aceeași hartă și componentele de explorare, într-un iframe. Fiecare widget are o configurație administrată: categorii, regiune, selecție editorială, limbă inițială, temă, poziție/zoom și partener.

Widgetul are interfață compactă, adaptată și containerelor mici. Afișează numai conținut publicat; nu copiază o bază de date către partener. Actualizările aprobate apar automat. Pagina gazdă nu trebuie să refacă integrarea la schimbarea categoriilor.

Configurările sunt validate și limitate; folosim `Content-Security-Policy: frame-ancestors` pentru domeniile aprobate. ID-ul unui widget nu este un secret. Nu construim politica de acces pe baza unui parametru URL trimis de client. Antetele generale anti-iframe sunt ajustate strict pentru ruta embed.

`postMessage` este permis doar între origini validate, pentru redimensionare și evenimente controlate; verificăm și sursa ferestrei, nu numai originea. CORS nu înlocuiește politica de încadrare. Nu cerem autentificare în iframe: contribuțiile și favoritele sincronizate se deschid în site-ul principal, evitând dependența de cookie-uri terțe.

Adminul vede o previzualizare desktop/mobil și poate copia codul iframe. Măsurăm utilizarea pe partener fără date private despre prestatori.

## 15. Siguranță și integritatea datelor

Cerințe direct legate de contribuțiile publice:

- Sesiuni securizate, validarea originii/CSRF după mecanismul folosit, resetare parolă și limite distribuite pentru login, retrimitere email, upload și trimitere propuneri.
- Confirmarea emailului și un mecanism anti-abuz pentru formularele atacate; CAPTCHA doar unde este necesar.
- Autorizare pe resursă și câmp, inclusiv în operațiile în lot și export. Proprietarul nu poate trimite `ownerId`, rol sau stare de publicare ca și când ar fi câmpuri editoriale.
- Datele utilizatorului nu sunt inserate ca HTML. În componenta actuală Leaflet, `bindTooltip(p.name)` primește un șir; la introducerea conținutului public trebuie înlocuit cu un nod text sigur sau cu randare escapata. Același principiu se aplică descrierilor și URL-urilor.
- Linkuri numai cu scheme permise; fără JavaScript, embed HTML sau SVG încărcat arbitrar. Verificările automate de URL nu accesează rețele interne sau metadate cloud.
- Notele interne, emailul contului și documentele de verificare sunt distincte de contactele publice ale afacerii.
- Audit append-only la nivelul permisiunilor aplicației: autor, acțiune, resursă/revizie, timp și schimbări relevante; fără parole, tokenuri sau conținut privat complet în loguri.
- Politici de retenție și procedură pentru exportul/ștergerea datelor personale; la închiderea unui cont se tratează explicit conținutul public și eventualul transfer de proprietate.

## 16. Hosting, backup și operare

Configurație recomandată pentru lansare:

- **Next.js Node + worker pe Railway**, ca servicii separate din același repository, cu restart automat și health checks. Build standalone, imagini/release-uri versionate. Nu folosim stocarea locală a containerelor pentru media.
- **PostgreSQL în Supabase**, cu plan și politică de backup potrivite pentru producție; regiune apropiată de runtime.
- **Cloudflare R2 + domeniu media**, cu acces public numai pentru variantele aprobate.
- **Resend**, pentru emailurile tranzacționale.
- Monitorizare erori, uptime, performanță, coada de sarcini, stocare și cheltuieli; Sentry este o opțiune, cu eliminarea datelor personale din rapoarte.

Aceasta este o alegere de infrastructură, nu o dependență de business: Node, PostgreSQL și API-ul S3 permit mutarea la alți furnizori. La implementare verificăm compatibilitatea versiunilor și funcțiile planurilor alese. Vercel este o alternativă pentru web; ar necesita păstrarea workerului pe un runtime separat potrivit proceselor persistente.

Dezvoltare, staging și producție au baze și stocare separate. Preview-urile nu primesc secretele de producție. Migrațiile sunt versionate și rulate controlat, cu modificări compatibile între două release-uri consecutive. Revenirea codului nu presupune automat revenirea schemei DB.

Backup-ul PostgreSQL nu este backup pentru fișierele R2. Păstrăm copii independente ale DB și obiectelor, cu retenție, criptare și inventar coerent. Restaurarea verifică și legăturile DB–media, configurațiile schemelor și secretele necesare.

Ținte propuse, care trebuie susținute de planurile cumpărate și demonstrate prin restaurare: pierdere maximă de date DB de o oră (RPO), revenire în patru ore (RTO), backup zilnic al obiectelor cu recuperare separată. Dacă obiectivul DB este o oră, un backup numai zilnic este insuficient; trebuie PITR sau o strategie echivalentă. Exersăm recuperarea înainte de lansare și periodic după aceea.

Costurile se bugetează pe categorii: runtime web/worker, DB și PITR, spațiu/cereri media, CDN/transformări imagini, emailuri, tile-uri/geocodare/rutare, monitorizare și mentenanță. Nu presupunem că un plan gratuit este o bază de operare pe termen lung. O estimare numerică responsabilă cere număr de vizitatori, sesiuni de hartă, fotografii, volum de email și obiective de disponibilitate; tarifele se verifică la alegerea planurilor.

## 17. Alternative și compromisuri

**Admin propriu cu bibliotecă de componente și generator de formulare:** recomandarea principală pentru această cerință. Avantajul este experiența simplă și exactă pentru echipă, inclusiv câmpuri adăugate în timpul funcționării. Costul este dezvoltarea și întreținerea editorului, versionării și moderării. Nu construim un constructor universal de aplicații.

**Payload în Next.js:** poate economisi mult la CRUD, media, acces și versiuni. Totuși, schema obișnuită de colecții/câmpuri este definită în configurare TypeScript. Pentru cerința „adminul adaugă singur câmpuri” trebuie implementat tot un strat de definiții și formulare dinamice. Este o variantă validă dacă echipa dorește să extindă un CMS; nu elimină partea cea mai particulară a acestui proiect. Alegerea finală nu trebuie să conducă la două sisteme paralele de auth sau publicare.

**Directus/alte CMS-uri cu schemă administrabilă:** merită evaluate dacă cerința de backend integral în Next se relaxează; în forma cerută adaugă o platformă separată și un alt model de permisiuni de administrat.

**Totul în JSONB fără structură:** simplifică începutul, dar complică relațiile, prețurile, drepturile și căutarea. **Coloană SQL pentru fiecare câmp nou:** nu oferă autonomia cerută. Soluția hibridă evită ambele probleme.

## 18. Implementare pe etape complete

Etapele sunt ordinea construirii unui produs complet; fiecare are criterii verificabile.

1. **Contract de produs și model:** definim șabloanele inițiale, câmpurile standard, relațiile locație–experiență, politica RO/EN și matricea de drepturi; schițăm adminul și mobilul. Rezultat: fluxurile și datele sunt clare înainte de construcție.
2. **Fundație:** DB/migrații, auth cu confirmare, recuperare, invitații admin, permisiuni și audit, infrastructură web/worker/staging. Criteriu: un cont public nu poate dobândi drepturi de admin și un admin revocat pierde accesul.
3. **Catalog și media:** identități, revizii, categorii în DB, șabloane versionate, generator de formulare, upload privat și procesare. Criteriu: telefonul sau durata se adaugă din admin și funcționează în ambele formulare fără deploy.
4. **Moderare completă:** ciorne, trimitere, corectări, comparație, publicare atomică, notificări, suspendare și revendicări. Criteriu: o editare neaprobată, inclusiv coordonate/imagini, nu modifică fișa publică.
5. **Experiența publică:** proiecții de căutare, pagini RO/EN indexabile, hartă, mobil, filtre dinamice, favorite sincronizate, contacte și rezervări externe. Criteriu: aceeași selecție produce rezultate coerente în hartă și listă, inclusiv pe mobil.
6. **Parteneri și exploatare:** widgeturi, import cu validare și previzualizare, export, calitatea datelor, observabilitate și recuperare. Criteriu: widgetul respectă publicarea și domeniile configurate; restaurarea DB+media este demonstrată.

Nu introducem datele demo ca locații aprobate. Importul real are sursă, drepturi media, proprietar/asociere, traduceri și coordonate validate; propunerile importate trec prin coada editorială. Valorile mock nu sunt prezentate ca recenzii sau prețuri reale.

## 19. Verificări înainte de lansare

Teste de domeniu pentru scheme, drepturi, tranziții și proiecții; teste cu PostgreSQL real pentru tranzacții/concurență; teste end-to-end pentru înregistrare → verificare → propunere → aprobare → editare → reaprobare. Verificăm separarea accesului între doi prestatori, revocarea adminului și tentativa de modificare a reviziei aflate în verificare.

Cazuri obligatorii: URL direct către o ciornă, fișier neaprobat accesat anonim, schimbare de schemă cu formular vechi deschis, revizie cu preț necunoscut, traducere lipsă, notificare reluată, două aprobări simultane și retragere din cache/widget. Fluxul de publicare trebuie să tolereze un worker temporar indisponibil.

QA mobil pe iOS/Android, tastatură și cititor de ecran; gesturile hărții nu blochează navigarea. Testăm căderi geocoder/rutare și lipsa WebGL, fără a pierde accesul la listă și contacte.

Performanța se validează pe un set de date reprezentativ și pe numărul estimat de utilizatori concurenți; măsurăm latența căutării, dimensiunea răspunsurilor, timpii de încărcare mobilă și costul sesiunilor de hartă. Pragurile devin criterii de lansare după stabilirea volumelor.

## 20. Surse tehnice verificate

Pe lângă ghidurile Next.js instalate în proiect:

- [PostgreSQL — JSONB și indexare](https://www.postgresql.org/docs/current/datatype-json.html)
- [PostGIS — căutare la distanță cu ST_DWithin](https://postgis.net/docs/ST_DWithin.html)
- [Supabase — extensia PostGIS](https://supabase.com/docs/guides/database/extensions/postgis)
- [Supabase — backup și recuperare](https://supabase.com/docs/guides/platform/backups)
- [Drizzle — suport PostGIS](https://orm.drizzle.team/docs/guides/postgis-geometry-point)
- [Better Auth — email și parolă](https://better-auth.com/docs/authentication/email-password)
- [Better Auth — administrare și permisiuni](https://better-auth.com/docs/plugins/admin)
- [Cloudflare R2 — URL-uri semnate](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Cloudflare R2 — CORS](https://developers.cloudflare.com/r2/buckets/cors/)
- [pg-boss — coadă de sarcini PostgreSQL](https://github.com/timgit/pg-boss)
- [Resend — evenimente de livrare](https://resend.com/docs/webhooks/introduction)
- [MapLibre — specificația stilurilor](https://maplibre.org/maplibre-style-spec/)
- [MapTiler — API-uri de hartă și servicii geografice](https://docs.maptiler.com/cloud/api/)
- [OSM — politica tile-urilor publice](https://operations.osmfoundation.org/policies/tiles/)
- [Payload — configurarea colecțiilor](https://payloadcms.com/docs/configuration/collections)

Aceste surse confirmă capabilitățile componentelor. Structura produsului, rolurile, politicile de moderare și alegerile de furnizori de mai sus sunt recomandări pentru acest proiect, nu funcționalități deja implementate.
