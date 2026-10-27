# Sincronizarea Haide → Hartă

Implementarea inițială, 28 octombrie 2026. Acest document descrie ce există efectiv în cod, nu întregul plan bidirecțional.

## Comportament

- Haide expune un catalog privat, numai pentru citire, prin `GET /api/integrations/map/catalog`.
- Nu sunt modificate formularele, adăugarea experiențelor, moderarea, abonamentele sau rezervările existente în Haide.
- Experiențele publice și organizațiile vizibile sunt copiate în PostgreSQL-ul hărții, în `haide_catalog`. Importul nu creează propuneri pentru moderarea hărții.
- Experiențele cu modificări în moderare folosesc `toPublicDetailArray`: se exportă ultima versiune publicată, nu draftul. Sunt trimise exclusiv câmpurile din contract; nu utilizatori, emailuri private, note de moderare sau rezervări.
- Experiențele rezervabile afișează „Rezervă online” spre pagina publică Haide. Organizațiile și experiențele „coming soon” afișează „Vezi pe Haide”.
- Cazările se exportă numai dacă `hodina.accommodations_enabled` este deja activ în Haide. Linkul public corect este `/ro/stays/{slug}`.
- Fișele fără denumire sau coordonate se salvează cu problema identificată și nu generează markeri inventați. Completați datele în Haide; următorul sync le publică automat.
- Harta citește baza sa la afișare, fără apel la API-ul Haide. Imaginile folosesc URL-urile HTTPS publice Haide; fișierele media nu sunt încă replicate în MinIO.
- Conținutul este în română și engleză. Regiunea Nord/Centru/Sud nu este dedusă automat din localitate.

## Siguranța importului

Prima cerere creează un catalog înghețat în cache Haide, valabil o oră. Paginile ulterioare folosesc același snapshot. Importatorul verifică versiunea contractului, paginile, numărul total, identificatorii unici și originea linkurilor.

Abia după primirea întregului export începe tranzacția PostgreSQL: upsert pe identificatorul compus tip + ID, publicare directă și retragerea intrărilor care nu mai apar în catalogul public. O eroare de rețea, autentificare, paginare sau validare nu retrage date existente. O retragere confirmată ascunde fișa, fără ștergere definitivă.

Lock-ul PostgreSQL împiedică suprapunerea comenzilor manuale cu workerul. Rezultatele și erorile sunt păstrate în `haide_sync_runs`. La schimbarea originii sursei, importul se oprește pentru verificare, în loc să înlocuiască automat catalogul.

Administratorii pot ascunde explicit o fișă importată; `suppressed` se păstrează la sync. Aceasta este o excepție editorială, nu moderare obligatorie. Moderatorii nu pot accesa configurația sau declanșa importul.

## Configurare Haide

1. Publicați cele două clase din `app/Services/Integrations/MapCatalog.php` și `app/Http/Controllers/Integrations/MapCatalogController.php`, configurația `config/map_sync.php` și ruta suplimentară din `routes/api.php`.
2. Configurați `MAP_SYNC_TOKEN` cu o valoare aleatoare de minimum 32 de caractere. Configurația goală dezactivează endpointul. Nu folosiți parola unui utilizator.
3. Verificați că `HODINA_FRONTEND_URL` indică domeniul HTTPS public corect și URL-urile media sunt HTTPS. Cache-ul trebuie să persiste între cereri (nu driverul `array`).
4. Reîncărcați configurația/rutele folosind procedura de deploy existentă în Haide. Nu este necesară o migrare Haide pentru acest flux.

## Configurare Hartă

Variabilele din `.env.example`:

- `HAIDE_API_URL`: baza API, cu `/api/`, fără `/v1/`. Exemplu: `https://api.example.test/api/`.
- `HAIDE_SITE_URL`: originea publică exactă, implicit `https://haide.md`.
- `HAIDE_SYNC_TOKEN`: aceeași valoare ca `MAP_SYNC_TOKEN` din Haide. Nu ajunge în client sau în răspunsul paginii admin.
- `HAIDE_SYNC_INTERVAL_SECONDS`: implicit 1800 (30 de minute); minimum 60.
- `HAIDE_CATEGORY_MAP`: obiect JSON cu categoriile locale existente: `experience`, `guesthouse`, `accommodation`. Implicit `experience`, `culture`, `stay`. Adaptați la ID-urile catalogului real. Organizațiile nu sunt tratate automat ca pensiuni.

Înainte de pornirea codului nou pe baza de producție:

```sh
npm run db:migrate
```

Migrarea `0004_magenta_manta.sql` adaugă două tabele și nu modifică fișele existente.

Test manual și serviciu periodic:

```sh
npm run sync:haide
npm run sync:haide:watch
```

În producția Docker există serviciul `haide-sync` în `compose.prod.yaml`. După migrare și construirea imaginii, porniți-l cu procedura Compose existentă. Este separat de workerul email și nu necesită configurarea serviciului de email. Fără URL/token rămâne inactiv. Nu pornește automat pe server doar prin adăugarea codului local.

Administrare: `/admin/haide-sync`, pentru administrator și administrator principal. Pagina oferă sincronizare manuală, ultimele 20 de rulări și primele 500 de fișe, cu ascundere/restabilire manuală. Frecvența configurată nu este un heartbeat al workerului.

## Verificare

- `npm run typecheck`, `npm run lint`, `npm run build`.
- `node --import tsx --test tests/*.test.ts`: contract, identități distincte pe tip, linkuri, coordonate absente, snapshot incomplet, duplicate și indisponibilitate.
- Test PostgreSQL explicit, pe o bază locală dispensabilă cu nume terminat în `_test`: aplicați migrările, apoi rulați `HAIDE_TEST_DATABASE_URL=... node --import tsx --test tests/haide-sync.integration.test.ts`. Testul golește numai tabelele de sync din acea bază de test.
- Haide: `vendor/bin/phpunit --filter=MapCatalogSyncTest`; testele nu trimit emailuri reale.

## Etapa următoare, încă neimplementată

Exportul Hartă → Haide, asocierea proprietarilor, modalul de creare cont/organizație, invitația prin email, selectarea fișelor în moderare și rezolvarea conflictelor bidirecționale. Nu există încă scrieri în Haide din hartă.

Asocierea cu fișe locale care existau înaintea integrării trebuie tratată în această etapă: importul este idempotent față de ID-urile Haide, dar nu unește automat o fișă de sondaj cu una Haide după nume. Replica media, maparea regională și gestionarea mai multor limbi pot fi extinse separat.
