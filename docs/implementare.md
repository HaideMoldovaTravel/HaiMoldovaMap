# Decizii și starea implementării

Actualizat: 15 octombrie 2026.

Acest document completează propunerea inițială `arhitectura-platforma.md`. Instrucțiunile ulterioare ale utilizatorului au prioritate: PostgreSQL și întreaga aplicație în Docker, Resend, MinIO în loc de R2, păstrarea interfeței publice și șabloane pentru categoriile existente, inclusiv toate canalele de contact.

## Infrastructura efectivă

- Next.js și worker Node: aceeași imagine, procese separate.
- PostgreSQL 17 + extensia PostGIS: imagine proprie din baza oficială PostgreSQL, compatibilă și cu ARM64. Imaginea standard postgis/postgis testată nu avea manifest ARM64.
- MinIO: compilare din sursa oficială la un release fixat; volumul de fișiere rămâne privat.
- Resend pentru emailurile reale; Mailpit în Docker pentru dezvoltare fără chei externe.
- Migrații Drizzle și bootstrap idempotent printr-un serviciu `initialize` înaintea aplicației.

Serviciile cloud Supabase/Railway/R2 din propunerea inițială nu sunt folosite în configurația livrată. Coada efectivă este un outbox de emailuri în PostgreSQL, cu preluare atomică, lease, retry și deduplicare Resend; pg-boss nu este încă necesar pentru alte sarcini.

## Modelul editorial efectiv

`listings` păstrează identitatea și pointerul spre versiunea publicată. `listing_revisions` păstrează valorile și versiunea de șablon, coordonatele PostGIS, autorul și decizia moderatorului. Datele aprobate sunt citite direct prin join-uri autorizate, fără o proiecție duplicată de căutare în această etapă.

Publicarea folosește o tranzacție și blocarea fișei. Constrângerea compusă garantează că revizia publicată aparține aceleiași fișe. Indexul parțial interzice două propuneri simultan în verificare pentru aceeași fișă. Toate endpointurile de mutație verifică sesiunea, emailul confirmat, rolul, proprietatea și originea.

O experiență poate fi asociată deocamdată cu o singură locație publicată, fără să moștenească automat coordonatele sau proprietatea. Modelul many-to-many rămâne extinderea din arhitectura țintă.

## Șabloane

Șase șabloane inițiale cu câmpuri comune și specifice: Vinării, Pensiuni, Experiențe, Natură, Cultură, Gastronomie. Câmpurile noi sunt păstrate în JSONB și interpretate de același contract de validare pe server. Telefonul, WhatsApp și Viber sunt distincte; canalele sociale sunt URL-uri validate.

Editorul permite câmpuri și reguli de bază, fără editor de cod sau JSON. Schema are versiuni. Câmpurile obligatorii se validează la trimitere; ciornele pot fi incomplete. Formularele noi trebuie să folosească ultima schemă. Reviziile deja salvate pot fi trimise pe propria schemă, pentru a nu pierde munca după modificări editoriale. Schimbarea unui câmp în privat se aplică imediat și răspunsurilor publice existente.

## Fișiere

Uploadul trece printr-un endpoint Next autorizat, nu prin URL semnat direct. Limita este 10 MB și 25 MP; JPEG/PNG/WebP sunt recodificate WebP cu latură maximă 1600 px și fără metadatele originale. Bucketul MinIO nu este public. Endpointul de citire verifică proprietatea sau folosirea fotografiei în revizia curentă aprobată. Răspunsurile nu sunt cache-uite public, pentru a permite retragerea imediată.

Această soluție prioritizează corectitudinea accesului; pentru volum mare se pot adăuga upload direct, variante multiple și distribuție CDN cu mecanism de invalidare. Curățarea fișierelor orfane și retenția versiunilor se vor introduce înainte de lansare publică.

## Funcționalități ulterioare

README-ul enumeră explicit ce există și ce rămâne din arhitectura țintă. Nu tratăm existența paginilor sau a tabelelor drept implementare a widgeturilor, 2FA, revendicărilor, backupurilor sau a condițiilor de formular.

## Administrare extinsă

Dashboardul are layout separat cu sidebar, pagină de statistici editoriale, tabele filtrabile/sortabile/paginate cu export CSV și rute dedicate pentru creare/editare. Editorul vizual de formulare folosește dnd-kit cu mouse, touch și tastatură, inspector de proprietăți, previzualizare și publicarea unei versiuni noi.

Migrația 0002 adaugă descriere/iconiță pentru categorii, scop/text alternativ/arhivare pentru media și revocarea invitațiilor. Iconițele optimizate au maximum 256 px și sunt publice numai cât timp sunt folosite de o categorie activă. Arhivarea media este reversibilă și blocată dacă există referințe în categorii sau în istoricul reviziilor.

Biblioteca media arată utilizările; profilurile permit corectarea numelui fără schimbarea emailului verificat. Membrii echipei și invitațiile au tabele distincte, creare pe /admin/team/invite, retrimitere cu rotația tokenului și anulare. Schimbarea rolului invalidează sesiunile și invitațiile încă neacceptate.
