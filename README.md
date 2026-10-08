# Hai Moldova

Prototip pentru o hartă interactivă de turism în Moldova, construit cu Next.js 16.4.0, React 19.3, TypeScript, Tailwind CSS 4 și Leaflet.

## Pornire

```sh
npm install
npm run dev
```

Deschide adresa afișată în terminal (implicit http://localhost:3000; dacă portul este ocupat, Next.js alege următorul port liber).

```sh
npm run test
npm run typecheck
npm run lint
npm run build
```

## Funcționalități

- Hartă OpenStreetMap cu deplasare, zoom, marcaje accesibile și localizarea utilizatorului.
- Straturi reale: hartă standard OSM, imagini satelit Esri și activarea/dezactivarea locațiilor turistice.
- Filtrare instantanee a locațiilor demonstrative după nume, categorie, regiune, rating și buget; sortare după recomandări, rating sau preț.
- Căutare geografică reală în Moldova prin Photon: introdu o localitate sau adresă și apasă Enter. Alegerea rezultatului centrează harta.
- Planificator auto prin OSRM: plecare și destinație din locațiile cunoscute sau din căutări geografice. Traseul urmează drumurile reale, cu distanță, durată, alternative când există și indicații pas cu pas. Nu include trafic în timp real.
- Fișe cu galerie, descrieri, rating, program, preț și canale de contact demonstrative.
- Favorite păstrate în browser și interfață adaptată pentru mobil, cu comutare hartă/listă.

Locațiile turistice, prețurile, ratingurile și descrierile sunt mock. Fotografiile Unsplash sunt ilustrative, nu fotografii verificate ale locațiilor. Contactele sunt explicit demonstrative. Harta, căutarea geografică și calcularea traseelor folosesc servicii reale.

## Structură

```text
src/app/                      Next.js App Router și stiluri globale
src/app/api/map/search/       Proxy pentru căutare Photon
src/app/api/map/route/        Proxy pentru trasee OSRM
src/components/explore/       Interfața de explorare, hartă și planificator
src/features/places/          Tipuri, categorii, date mock și filtre
src/features/map/             Tipuri geografice, configurare și servicii
```

`PlacesRepository` definește contractul viitorului furnizor de date. În această etapă interfața folosește datele locale. Pentru backend, înlocuiește sursa din Explorer cu încărcare prin repository și păstrează tipurile și funcția de filtrare. Categoriile sunt definite central și pot fi mutate ulterior în baza de date. Geocodarea și rutarea sunt izolate de interfață și pot fi schimbate fără refacerea componentelor.

## Furnizori și producție

Nu există integrare Google Maps sau cheie Google plătită.

- Harta standard: [OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/). Cererile sunt făcute direct de browser, cu cache normal și atribuire vizibilă; nu există predescărcare sau mod offline.
- Geocodare: [Photon](https://github.com/komoot/photon). Serverul public este pentru utilizare rezonabilă și nu garantează disponibilitate. Căutările sunt explicite, cache-uite 24 de ore și serializate la cel mult o cerere la 1,1 secunde în procesul local.
- Rutare: [OSRM](https://project-osrm.org/docs/v5.24.0/api/). Endpointul public este folosit pentru demo; pentru producție se recomandă o instanță proprie sau un furnizor cu disponibilitate garantată.
- Satelit: Esri World Imagery, atribuit separat. Acest strat nu este OpenStreetMap; înainte de lansare trebuie verificată licența de utilizare pentru contextul comercial final.

Copiază `.env.example` în `.env.local` pentru a înlocui adresele `PHOTON_URL` și `OSRM_URL`. URL-urile straturilor sunt centralizate în `src/features/map/config.ts`. Pentru distribuție pe mai multe instanțe, cache-ul și limitarea geocodării trebuie mutate într-un serviciu partajat. API-urile trebuie protejate prin limitare de trafic înainte de lansarea publică.

Localizarea funcționează la cererea utilizatorului și necesită permisiunea browserului (HTTPS în producție). Traseele folosesc coordonatele punctelor alese pentru cererea către serviciul de rutare; aplicația nu le persistă.

## Verificare

Teste de domeniu pentru filtre, căutări fără diacritice, favorite, validarea coordonatelor și prezentarea indicațiilor. Verificare manuală în browser pentru traseul Chișinău–Cricova, căutare geografică, straturi, fișe și varianta mobilă.

Auditul inițial npm identifică o vulnerabilitate în `braces`, dependență tranzitivă a uneltelor ESLint, pentru care registrul nu oferă încă o versiune corectată. Nu face parte din dependențele runtime ale aplicației. Nu se recomandă downgrade-ul Next.js propus automat de audit; actualizează uneltele când este disponibilă corecția.

## Limbi, identitate vizuală și contacte demo

Interfața, descrierile, categoriile, filtrele și indicațiile de traseu sunt disponibile în română, engleză și rusă. Selectorul RO / EN / RU din antet păstrează alegerea în browser și actualizează limba documentului. Mesajele sunt centralizate în `src/features/i18n/messages.ts`; descrierile locațiilor sunt în `src/features/places/localization.ts`. Identificatorii și valorile de filtrare rămân independente de traduceri.

Montserrat este încărcat prin `next/font/google`, cu suport latin, latin extins și chirilic. Paleta este preluată din stilurile haide.md: `#002626`, `#efc4be`, `#944236`, `#17332d`, `#0f5a52` și fundaluri `#f2f8f5` / `#e4efea`.

Fișele afișează contacte demonstrative complete, cu numere ilustrative și domenii rezervate `.example`. Contactele pot fi copiate; WhatsApp și Viber afișează un mesaj demo. Aceste date nu aparțin locațiilor reale și nu inițiază apeluri sau conversații către gazde.
