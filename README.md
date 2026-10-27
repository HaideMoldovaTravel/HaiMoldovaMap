# Hai Moldova

Hartă de turism în Moldova, cu site public Next.js, conturi verificate prin email, administrare și moderare. Interfața publică existentă este păstrată.

## Pornire în Docker

Necesită Docker cu Compose și Node.js 24 pentru comanda inițială:

```sh
npm run setup
npm run docker:up
```

`setup` generează `.env` cu parole aleatoare și nu suprascrie configurările existente. Prima construire durează mai mult: imaginea MinIO este compilată din sursa oficială fixată la o versiune.

Servicii locale:

| Adresă                              | Funcție                                                     |
| ----------------------------------- | ----------------------------------------------------------- |
| http://localhost:3000               | Harta existentă                                             |
| http://localhost:3000/autentificare | Înregistrare, autentificare, verificare și resetare parolă  |
| http://localhost:3000/cont          | Locațiile și experiențele utilizatorului                    |
| http://localhost:3000/admin         | Moderare, categorii, formulare și echipă                    |
| http://localhost:8025               | Emailurile locale în Mailpit                                |
| http://localhost:9001               | Consola MinIO, conform capabilităților versiunii comunitare |

Credențialele administratorului principal sunt în `.env`: `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Pentru MinIO: `S3_ACCESS_KEY`, `S3_SECRET_KEY`. Nu publica acest fișier. Contul inițial este verificat prin procedura de bootstrap; conturile publice trebuie să confirme emailul.

PostgreSQL/PostGIS și fișierele MinIO au volume persistente. `npm run docker:down` oprește serviciile fără ștergerea datelor. Nu folosi opțiunea `-v` dacă vrei să păstrezi volumele.

## Emailuri

Implicit, configurația locală folosește Mailpit, pentru a testa înregistrarea și invitațiile fără o cheie externă. Mesajele ajung la http://localhost:8025, nu la destinatari reali.

Pentru Resend, setează în `.env`:

```dotenv
MAIL_TRANSPORT=resend
RESEND_API_KEY=re_...
EMAIL_FROM=Hai Moldova <noreply@domeniul-tau.md>
```

Domeniul expeditorului trebuie verificat în Resend. Repornește `app` și `worker` după schimbări. Pentru producție setează `APP_ENV=production`; livrarea Mailpit este dezactivată de aplicație în acest mod. Mesajele sunt salvate într-un outbox PostgreSQL și preluate de worker, cu retry și cheie de idempotență pentru Resend.

## Funcționalități implementate

- Înregistrare cu email/parolă, confirmare email, autentificare, ieșire, recuperare și resetare parolă prin Better Auth.
- Roluri: utilizator, moderator, administrator, administrator principal. Verificarea drepturilor are loc pe server, inclusiv pentru fiecare fișă.
- Invitații pentru administratori/moderatori, acceptare pe emailul verificat, expirare la 48 de ore și revocarea accesului cu invalidarea sesiunilor.
- Categorii în DB: creare, editare RO/EN, culoare, ordine, tip locație/experiență și arhivare.
- Șabloane inițiale pentru Vinării, Pensiuni, Experiențe, Natură, Cultură și Gastronomie.
- Câmpuri standard: prezentare RO/EN, adresă, coordonate, galerie, telefon, email, website, WhatsApp, Viber, Facebook, Instagram, TikTok, YouTube, Telegram, rezervare online, program, preț/monedă/unitate, facilități, limbi și accesibilitate; plus câmpuri specifice fiecărei categorii.
- Editor de formulare: câmpuri suplimentare, ordine, tipuri, etichete, secțiuni, opțiuni, obligativitate și vizibilitate publică/internă; versiuni distincte ale șabloanelor.
- Contul utilizatorului: ciorne, fotografii, alegerea poziției pe hartă, asocierea unei experiențe cu o locație publicată, trimitere spre verificare și feedback de moderare.
- Moderare: aprobare/publicare, cerere de corectări, respingere, comparație de valori și retragere imediată.
- Reviziile trimise sunt blocate; modificările ulterioare nu afectează versiunea aprobată până la reaprobare. Publicarea este tranzacțională, cu protecție la decizii concurente.
- Upload în MinIO: limită de dimensiune, validare prin decodare, eliminare metadate și optimizare WebP. Imaginile neaprobate sunt private; retragerea fișei elimină accesul anonim.
- Jurnal de activitate și limite de cereri în PostgreSQL.
- Harta, categoriile și contactele publice folosesc DB, inclusiv câmpurile configurabile. Favoritele existente sunt încă locale în browser.

Un câmp nou se adaugă din **Admin → Formulare → categoria dorită → Adaugă câmp → Publică modificările**. Nu este necesar un deploy. Câmpurile standard indispensabile nu se pot elimina, iar tipul câmpurilor existente nu se schimbă distructiv. Un câmp intern existent nu poate deveni public printr-o simplă bifă. Ascunderea unui câmp public se aplică și proiecțiilor deja publicate.

## Dashboard de administrare

Navigare laterală, breadcrumbs, căutare în conținut, pagini distincte și afișare adaptată pentru mobil:

| Rută                                             | Funcție                                                                          |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `/admin`                                         | Statistici din DB, activitate pe 7/14/30 zile, moderare și informații incomplete |
| `/admin/locations`, `/admin/experiences`         | Tabele cu căutare, filtre, sortare, paginare și export CSV                       |
| `/admin/locations/add`, `/admin/experiences/add` | Creare fișă; editare și istoric pe pagina fiecărei fișe                          |
| `/admin/moderation`                              | Propuneri, comparație cu versiunea publicată, aprobare și feedback               |
| `/admin/categories/add`                          | Categorie nouă, iconiță încărcată, culoare și șablon propriu sau copiat          |
| `/admin/categories/:id/edit`                     | Editare categorie; arhivare și restabilire din tabel                             |
| `/admin/forms/:id`                               | Editor cu drag-and-drop, tastatură, proprietăți și previzualizare                |
| `/admin/team`                                    | Tabelul membrilor, roluri, invitații și starea lor                               |
| `/admin/team/invite`                             | Pagină separată pentru invitație; retrimitere/anulare din tabel                  |
| `/admin/media`                                   | Bibliotecă, încărcare, denumire, text alternativ, utilizări și arhivare          |
| `/admin/users`                                   | Utilizatori, profiluri, fișe asociate și editarea numelui                        |
| `/admin/activity`, `/admin/settings`             | Jurnal, profil și verificarea conexiunilor DB/MinIO/email                        |
| `/admin/integrations`                            | Integrări parteneri: hărți iframe cu filtre proprii, protejate pe domeniu        |
| `/admin/notifications`                           | Bot Telegram pentru propunerile noi la moderare                                  |

Iconițele acceptă PNG, JPEG sau WebP de maximum 2 MB; sunt optimizate și apar în filtrele și marcajele hărții. Fișierele folosite în categorii sau în istoricul fișelor sunt protejate de arhivare. Arhivarea unei fișe o retrage din site și permite restabilirea. Retrimiterea unei invitații invalidează linkul anterior; anularea îi retrage imediat valabilitatea. Numai administratorul principal gestionează accesul echipei. Moderatorii au acces la conținut și moderare, iar configurarea categoriilor/formularelor este rezervată administratorilor.

## Integrări parteneri (iframe)

**Admin → Integrări parteneri → Adaugă integrare.** Completezi un titlu intern, domeniile partenerului și ce apare pe hartă: tipuri (locații/experiențe), categorii (toate sau selectate), regiuni, fișe excluse, contacte la locații/experiențe, butonul „Rezervă online”, WhatsApp/Viber, rețele sociale, prețuri, căutare, filtre, traseu, favorite, limbă, antet și mențiunea Hai Moldova. După salvare primești codul `<iframe>` pentru partener.

- **Protecție pe domeniu.** `/embed/:cheie` trimite `Content-Security-Policy: frame-ancestors` cu domeniile autorizate (plus varianta `www.` și, opțional, subdomeniile), deci browserul refuză afișarea pe orice alt site. Serverul verifică suplimentar originea (`Referer`), afișează „Domeniu neautorizat” și înregistrează încercarea; din pagina integrării o poți autoriza cu un clic. Restul aplicației, inclusiv `/admin`, trimite `frame-ancestors 'self'` și nu poate fi încadrat.
- **Datele dezactivate nu pleacă de pe server.** Contactele, linkurile de rezervare și prețurile oprite sunt eliminate înainte de randare, nu doar ascunse.
- **Actualizare automată.** Codul instalat nu se schimbă. Iframe-urile deschise verifică la fiecare minut (și la revenirea în tab) dacă s-a schimbat configurarea sau catalogul publicat și se reîmprospătează fără să piardă selecția vizitatorului.
- **Control.** Suspendare (mesaj neutru pe site-ul partenerului), cod nou dacă cel vechi a fost compromis, ștergere, statistici pe 30 de zile pe domenii și jurnal de activitate.

## Notificări Telegram

1. În Telegram, @BotFather → `/newbot`; pune tokenul în `.env` ca `TELEGRAM_BOT_TOKEN` și repornește `app` și `worker`.
2. Creează grupul echipei, adaugă botul și scrie `/start` în grup.
3. **Admin → Notificări Telegram → Detectează grupul → Trimite mesaj de test**, apoi activează.

Când un prestator trimite o locație sau o experiență la moderare, botul scrie în grup denumirea, categoria, localitatea, autorul și linkul direct `/admin/moderation/:id` (cine nu e autentificat revine la propunere după login). După decizie, mesajul inițial e editat cu „Aprobată / Trimisă la corectări / Respinsă de …”. Opțional: modificări la fișe publicate și un memento zilnic la 09:00 pentru propunerile care așteaptă de peste 24 de ore. Mesajele trec prin outbox-ul PostgreSQL, în aceeași tranzacție cu trimiterea, și sunt livrate de worker cu reîncercări. Pe `localhost`, Telegram nu acceptă butoane, așa că linkul apare doar în text.

## Date demonstrative

`SEED_DEMO=true` păstrează fișele originale pe hartă și aspectul existent. Aceste fișe sunt marcate `demo`, cu fotografii ilustrative și contacte demonstrative. Administratorii pot corecta aceste fișe; marcajul demonstrativ se păstrează. Pentru conținut real, creează o fișă nouă.

Pentru o instalare nouă fără conținut demonstrativ setează `SEED_DEMO=false` înainte de prima pornire. Schimbarea ulterioară nu șterge date existente. `initialize` rulează migrațiile și seedul idempotent; parolele și șabloanele editate nu sunt suprascrise.

## Verificare

```sh
npm install
npm test
npm run typecheck
npm run lint
npm run build
```

Cu stackul local pornit și livrarea prin Mailpit:

```sh
npm run test:integration
```

Testul verifică înregistrarea și confirmarea reală prin email, izolarea a două conturi, imposibilitatea promovării prin signup, uploadul MinIO, moderarea, aprobările concurente, câmpurile dinamice și retragerea imaginilor. Creează conturi/istoric de test, retrage fișa de test și restaurează șablonul inițial la final. Rulează-l pe o bază de dezvoltare, nu pe producție.

## Dezvoltare cu infrastructura în Docker

Pentru modificări rapide, poți rula PostgreSQL, MinIO și Mailpit în Docker, iar Next local:

```sh
docker compose up -d postgres minio mailpit
docker compose run --rm initialize
npm run dev
```

Oprește întâi serviciul `app` dacă ocupă același port. Pentru comenzile locale, `.env` conține adresele `localhost`; Compose le înlocuiește cu numele serviciilor în containere. Workerul trebuie să ruleze pentru livrarea emailurilor.

Migrații versionate în `drizzle/`. Generează schimbări cu `npm run db:generate`, verifică SQL-ul și aplică prin `npm run db:migrate`. Migrația inițială activează PostGIS; o migrație suplimentară conține constrângerile pentru revizia publicată și stările valide.

## Limite ale etapei curente

Aceasta este prima implementare funcțională a fluxului editorial, nu o declarație de pregătire pentru lansare publică. Din arhitectura completă rămân de construit: widgeturi pentru parteneri, revendicări de locații, colaboratori pe fișe, 2FA administrativ, condiții între câmpuri, filtre publice configurabile, căutare/paginare pe server, favorite sincronizate, traducerea completă a suprafețelor noi, politici automate de retenție și backup/restaurare verificată.

UI-ul public și motorul Leaflet sunt păstrate; reproiectarea mobilului și migrarea la hartă vectorială nu sunt incluse în această etapă. Căutarea Photon și rutarea OSRM folosesc încă endpointuri publice de dezvoltare. Rezervările sunt contacte/linkuri externe, fără plăți sau inventar în platformă.

Pentru producție sunt necesare HTTPS, domeniul și cheia Resend, backup separat DB/MinIO, utilizatori DB/S3 cu drepturi minime în locul credențialelor locale de administrare, monitorizare și politica de mentenanță. Porturile infrastructurii sunt legate doar la localhost.

## MinIO

Imaginea este construită din [sursa oficială](https://github.com/minio/minio), versiunea [RELEASE.2025-10-15T17-29-55Z](https://github.com/minio/minio/releases/tag/RELEASE.2025-10-15T17-29-55Z), cu licența upstream inclusă în container. Repository-ul comunitar este arhivat, iar vechea imagine Docker Hub nu mai este disponibilă. Nu folosim un mirror neoficial. Adaptorul S3 permite schimbarea furnizorului prin configurare, fără schimbarea modelului de conținut.

Vezi [arhitectura completă](docs/arhitectura-platforma.md) pentru produsul țintă și [deciziile de implementare](docs/implementare.md) pentru diferențele față de propunerea inițială.
