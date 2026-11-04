# Extragerea și importul Village Travel Bot

Sursă: <https://www.implicareplus.org/vtb/>. Scriptul citește numai paginile și imaginile publice. Nu citește `.env`, nu se conectează la baza de date, nu creează conturi și nu scrie în hartă sau în Haide.

## Rulare

Necesită Python 3.10+ și acces la internet, fără biblioteci suplimentare:

```sh
npm run extract:vtb -- --images
npm run test:vtb
```

Implicit scrie în `data/vtb/AAAA-LL-ZZ/`, după data din Europe/Chisinau. Se poate alege alt director:

```sh
npm run extract:vtb -- --images --output data/vtb/2026-10-30
```

Paginile și fotografiile existente se reutilizează; reluarea descarcă numai ce lipsește. `--refresh` reîncarcă paginile publice; imaginile existente se păstrează. Pentru un snapshot complet nou, folosiți un director nou. Între cereri există o pauză de 0,3 secunde, plus timpul răspunsului; maximum trei încercări pentru erori de rețea. Nu sunt enumerate ID-uri ascunse: sunt urmate numai fișele și paginarea publicate în listă.

Numărul fișelor găsite este verificat cu totalul declarat în grupurile sursei. Dacă lipsesc fișe sau structura nu mai poate fi citită, scriptul salvează inventarul parțial și iese cu eroare. Erorile de imagini sunt păstrate separat în `errors` și în sumar; fotografiile lipsă nu sunt înlocuite cu imagini inventate. Indicatorul `complete` privește inventarul fișelor, iar `summary.image_errors` privește fotografiile.

## Fișiere rezultate

- `review.html`: lista cu fotografii locale, căutare, filtre, date complete, probleme, decizii și observații. Deschideți fișierul în browser. Implicit arată propunerile pentru hartă; celelalte filtre includ toate excluderile și cazurile neclare.
- `lista-validare.md`: toate fișele, grupate pe recomandare, cu ID, localitate, motiv și link la sursă.
- `catalog.json`: inventarul complet, incluzând câmpurile originale, contacte, linkuri, coordonate, activități, marcajele de la sursă, media, recomandări și proveniență.
- `raw/`: copiile HTML originale, cu timpul preluării. Ignorat de Git.
- `images/`: fotografii originale, denumite după hashul URL-ului; în JSON se păstrează sursa, rolul, dimensiunea în octeți, calea locală și SHA-256. Ignorat de Git.

Pagina de validare funcționează local și nu face cereri de publicare. Deciziile sunt salvate în browser când acesta permite; **Exportă deciziile** produce `vtb-decizii.json`, care trebuie păstrat pentru transmiterea selecției. Același fișier poate fi încărcat în lista aceleiași extrageri. SHA-256 al catalogului identifică exact snapshotul, astfel încât deciziile din altă extragere să nu se aplice accidental. Regenerarea cu date identice păstrează identificarea snapshotului.

## Criterii și verificare editorială

Recomandările sunt propuneri, nu aprobări. Fiecare fișă are inițial `review_decision: pending`.

- **Locație**: pensiune, cazare, restaurant, vinărie sau furnizor cu servicii descrise. Poate avea activități propuse în interiorul aceleiași fișe.
- **Experiență**: atelier, degustare, excursie organizată ori activitate la fermă/prisacă. Nici telefonul și nici o etichetă de activitate nu confirmă singure rezervarea. Instrucțiunile explicite de programare sunt păstrate ca dovezi; disponibilitatea actuală se confirmă cu gazda.
- **De verificat**: serviciu sau contact insuficient documentat.
- **Excludere**: muzee, monumente, lăcașuri de cult, patrimoniu și puncte naturale/publice fără serviciu organizat.

Regulile sunt în `scripts/vtb/review.py`. Verificările individuale sunt în `scripts/vtb/overrides.json`, cu motivul bazat pe fișa publică. De exemplu, Conacul Drăgălina rămâne restaurant, Arta Rustică este propusă pentru masterclassul de țesut, iar „Băile tătărești” sunt excluse fiind ruine. O pensiune cu muzeu al pâinii este păstrată ca pensiune, fără o intrare separată pentru muzeu.

Lista semnalează neconcordanțe de contact, sezon și tarife, coordonate lipsă, lipsa imaginilor și duplicate după nume. Nu unește automat fișe. Nu verifică încă duplicatele față de catalogul existent al hărții. Nu inventează coordonate, prețuri, capacități, traduceri, durate sau calendare de rezervare. Câmpurile originale, inclusiv tarifele, rămân disponibile integral pentru verificare. O fotografie de istorie nu este automat fotografie comercială a serviciului.

Regenerarea clasificării și listei, fără acces la internet:

```sh
python3 scripts/vtb/review.py data/vtb/2026-10-30
```

## Importul pe hartă

Utilizatorul a delegat ulterior selecția și încărcarea fișelor. Importatorul `scripts/vtb-import.ts` scrie exclusiv în baza și stocarea hărții configurate în `.env`. Nu apelează API-ul Haide și nu trimite mesaje furnizorilor. Nu creează conturi noi. Folosește administratorul principal existent și jurnalizează publicările.

```sh
# Generează selecția delegată și simulează, fără a publica:
npm run import:vtb -- data/vtb/2026-10-30/catalog.json --select

# Verifică selecția existentă:
npm run import:vtb -- data/vtb/2026-10-30/catalog.json

# Publică numai selecția verificată, în baza configurată:
npm run import:vtb -- data/vtb/2026-10-30/catalog.json --apply
```

`selection.json` păstrează deciziile, motivul și SHA-256 al inventarului. Importatorul respinge snapshoturi incomplete, identități incorecte, selecții din alt snapshot și orice destinație diferită de `map_only` / `sync_to_haide: false`. Verifică fișele existente și nu suprascrie ID-urile deja importate, inclusiv cele retrase editorial. O rerulare nu creează copii și nu republică fișele retrase.

Raioanele se mapează la Nord/Centru/Sud, iar coordonatele sau localitățile absente blochează publicarea fișei. Colibași este completat exclusiv pentru Casa Dulce Colibași, fiind scris în denumirea originală. Restaurantul și hotelul Eco Resort Butuceni se reunesc într-o singură locație, cu descrierile și fotografiile ambelor surse.

Pentru experiențe este obligatoriu un telefon valid. Numărul indicat explicit în instrucțiunile de rezervare are prioritate față de contactul generic. Se normalizează prefixul Moldovei și se păstrează contactele originale intern. Pentru mobile există link `wa.me` către același număr; existența unui cont WhatsApp nu a fost verificată și nu s-au trimis mesaje/apeluri. Nu se importă `booking_url` sau `haide_url`. Prețurile sunt „La cerere”, fără a inventa durate, capacități sau calendare.

Tariful de peșteră introdus greșit la Colina Levănțică nu este publicat în descriere. Pentru Casa Trandafirului, perioadele contradictorii sunt înlocuite cu programare și confirmarea telefonică a sezonului. Datele originale rămân integral în inventar.

Fotografiile sunt verificate după hash, decodate, redimensionate și optimizate WebP prin același mecanism folosit de platformă, apoi încărcate în stocarea hărții. Galeria referă ID-uri reale de asset; imaginile istorice sunt omise. Publicările se fac într-o singură tranzacție cu lock împotriva suprapunerii importurilor. Erorile și fișele omise sunt păstrate în `import-preview.json` / `import-result.json`.

## Rularea locală din 30 octombrie 2026

Importul a fost aplicat în **instalarea locală** configurată în acest proiect (`localhost:3000`), nu pe un server de producție. Înaintea aplicării a fost salvat un backup local în directorul ignorat `backup/`.

- 222 de fișe extrase integral, cu 396 referințe de imagine; 389 imagini distincte descărcate. O fotografie Goian Glamping răspunde 404 la sursă.
- 50 de locații și 10 experiențe publicate, cu 101 fotografii optimizate.
- Toate cele 10 experiențe au apel și WhatsApp. Nicio fișă VTB nu are redirecționare Haide.
- Hotelul Eco Resort Butuceni a fost reunit cu restaurantul. Oleandra Floare de colț rămâne în inventar fără import, fiindcă nu are coordonate. Goian Glamping rămâne fără import din cauza datelor insuficiente și fotografiei indisponibile.
- 156 de obiective excluse și 3 fișe neclare nu au fost importate.

Rezultatul complet: `data/vtb/2026-10-30/import-result.json`. Importul nu modifică alte fișe ale hărții. Proveniența și limitarea la hartă sunt păstrate în notele interne ale fiecărei fișe `vtb-*`; viitoarea integrare Hartă → Haide trebuie să respecte această alegere editorială.

## Publicarea pe server, 30 octombrie 2026

La cererea utilizatorului, întregul cod al hărții a fost publicat pe <https://map.haide.md/>, iar aceeași selecție VTB a fost importată în producție: **50 de locații, 10 experiențe, 101 fotografii**. Nu au fost create fișe sau conturi în Haide.

Buildul și 52 de teste au trecut pe server; testul integrării Haide pe bază separată a rămas omis în producție. Migrările sunt aplicate. Serviciile aplicației, workerului, sincronizării și poziționării Haide au fost repornite cu noua versiune. Cele 27 de fișe Haide existente au fost păstrate.

Toate cele 101 imagini au fost verificate prin HTTPS, împreună cu pagina principală și autentificarea. În browser au fost confirmate afișarea pe hartă, fotografia și butoanele `Sună` / `WhatsApp` pentru o experiență VTB. Nicio fișă VTB nu are link de rezervare către Haide.

Backupul bazei, sursele anterioare, manifestul fișierelor, jurnalul buildului și verificarea de producție sunt păstrate pe server în `/opt/hai-moldova/backup/vtb-20261030-full/`. Imaginea anterioară are eticheta `hai-moldova-app:before-vtb-20261030-full`. Configurația `.env` a serverului a fost păstrată. La instalarea dependențelor au fost raportate 6 vulnerabilități (5 moderate și una critică), care necesită remediere separată.
