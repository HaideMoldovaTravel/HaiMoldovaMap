# Formularul scurt din cont

În `/cont`, „Adaugă experiență” deschide formularul scurt pentru toate rolurile, inclusiv administratorul principal, administratorul și moderatorul. Noul formular pornește cu categoria Experiențe, indiferent de ordinea categoriilor. Nu poate reveni automat la formularul Vinării când categoria de experiențe este indisponibilă.

Cele opt puncte sunt denumirea, descrierea, minimum–maximum persoane, locația, costul, programul, telefonul și patru–cinci fotografii. Contul nu afișează alegerea unei categorii de locații, câmpurile în engleză, rețelele sociale sau acțiunea de publicare directă. Editorul complet rămâne disponibil în `/admin`.

Modul `simple` / `full` este salvat pe fiecare revizie și folosit la salvare, trimitere și aprobare. Astfel, drepturile administrative ale autorului sau moderatorului nu fac ca o propunere scurtă să ceară câmpuri ascunse. Un utilizator simplu nu poate ocoli verificarea formularului scurt prin schimbarea modului în cerere.

## Publicare manuală

Înainte de pornirea codului nou, aplică migrările bazei hărții prin procedura de deploy obișnuită:

```sh
npm run db:migrate
```

Migrarea `0007_windy_hawkeye.sql` adaugă `form_mode` la revizii și păstrează validarea scurtă pentru reviziile experiențelor create anterior de utilizatori simpli. Nu schimbă datele publice, stările fișelor sau fotografiile. Nicio comandă de deploy nu este executată prin simpla modificare a acestor fișiere.

Verificarea locală acoperă deschiderea din cont pentru toate cele patru roluri și salvarea, trimiterea și aprobarea efectivă într-o bază temporară separată. Testul de integrare este în `tests/simple-experience.integration.test.ts` și necesită `FORM_TEST_DATABASE_URL` spre o bază locală dispensabilă cu nume terminat în `_test`.

Exportul WhatsApp Haide este modificat separat în `hodina-project/hodina-api/app/Services/Integrations/MapCatalog.php`. Citește exclusiv numărul public al organizației. Se poate publica prin procedura obișnuită de deploy a API-ului Haide; nu necesită o migrare acolo.
