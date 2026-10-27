"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  SlidersHorizontal,
  ArrowRight,
  Pencil,
  Archive,
  RotateCcw,
  Upload,
  Save,
  ArrowLeft,
  FileImage,
  CheckCircle2,
  X,
  ShieldCheck,
  Settings,
  RefreshCw,
  Database,
  HardDrive,
  Mail,
  UserRound,
} from "lucide-react";
import type { AdminData } from "./types";
import { CategoryIcon } from "./categories";
import { api } from "@/components/platform/api";
import {
  DataTable,
  PageTitle,
  Notice,
  ConfirmDialog,
  Badge,
  AddLink,
  bytes,
  date,
  roleLabels,
} from "./shared";
export function FormsPage({ data }: { data: AdminData }) {
  const [query, setQuery] = useState("");
  return (
    <>
      <PageTitle
        eyebrow="CONȚINUT"
        title="Formulare"
        description="Personalizează câmpurile completate de prestatori pentru fiecare categorie."
      />
      <label className="ad-forms-search">
        Caută un formular
        <input
          placeholder="Denumirea categoriei…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="ad-template-grid">
        {data.config
          .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
          .map((category) => (
            <section className="ad-card ad-template-card" key={category.id}>
              <div>
                <CategoryIcon category={category} size={24} />
                <Badge value={category.active ? "active" : "archived"}>
                  {category.active ? "Activ" : "Arhivat"}
                </Badge>
              </div>
              <h2>{category.name}</h2>
              <p>
                {category.kind === "experience"
                  ? "Experiențe și activități"
                  : "Locații și puncte de interes"}
              </p>
              <div className="ad-template-stats">
                <span>
                  <strong>{category.template.fields.length}</strong> câmpuri
                </span>
                <span>
                  <strong>
                    {category.template.fields.filter((f) => f.required).length}
                  </strong>{" "}
                  obligatorii
                </span>
                <span>
                  Versiunea <strong>{category.template.version}</strong>
                </span>
              </div>
              <div className="ad-template-sections">
                {[...new Set(category.template.fields.map((f) => f.group))].map(
                  (group) => (
                    <span key={group}>
                      {
                        {
                          presentation: "Prezentare",
                          location: "Poziție",
                          media: "Foto",
                          contacts: "Contacte",
                          details: "Detalii",
                        }[group]
                      }
                    </span>
                  ),
                )}
              </div>
              <Link
                href={`/admin/forms/${category.id}`}
                className="ad-button ad-full-width"
              >
                <SlidersHorizontal size={15} />
                Editează formularul
                <ArrowRight size={15} />
              </Link>
            </section>
          ))}
      </div>
    </>
  );
}
export function MediaPage({ data }: { data: AdminData }) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [confirm, setConfirm] = useState<AdminData["media"][number] | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const configure = ["owner", "admin"].includes(data.actor.role);
  const rows = data.media.filter((file) =>
    filter === "archived"
      ? !!file.archivedAt
      : !file.archivedAt &&
        (!filter ||
          (filter === "used"
            ? file.used
            : filter === "unused"
              ? !file.used
              : file.purpose === "category-icon")),
  );
  return (
    <>
      <PageTitle
        title="Bibliotecă media"
        description="Fotografiile și iconițele încărcate în platformă, împreună cu locurile în care sunt folosite."
        action={
          configure && (
            <AddLink href="/admin/media/add">Încarcă fotografii</AddLink>
          )
        }
      />
      <div className="ad-summary-strip">
        <span>
          <b>{data.media.filter((f) => !f.archivedAt).length}</b> fișiere active
        </span>
        <span>
          <b>{bytes(data.media.reduce((sum, f) => sum + f.size, 0))}</b> stocare
          utilizată
        </span>
        <span>
          <b>{data.media.filter((f) => !f.used && !f.archivedAt).length}</b>{" "}
          neutilizate
        </span>
      </div>
      <Notice message={message} />
      <DataTable
        rows={rows}
        rowKey={(f) => f.id}
        searchText={(f) => `${f.filename} ${f.altText} ${f.ownerName}`}
        searchPlaceholder="Caută un fișier sau autor…"
        filters={
          <select
            aria-label="Utilizarea fișierelor"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Toate fișierele active</option>
            <option value="used">Folosite</option>
            <option value="unused">Nefolosite</option>
            <option value="icons">Iconițe de categorii</option>
            <option value="archived">Arhivate</option>
          </select>
        }
        columns={[
          {
            id: "name",
            label: "Fișier",
            sort: (f) => f.filename,
            render: (f) => (
              <Link
                href={`/admin/media/${f.id}/edit`}
                className="ad-cell-with-icon"
              >
                <img
                  src={f.archivedAt ? "/placeholder.svg" : `/api/media/${f.id}`}
                  alt=""
                  className="ad-thumbnail"
                />
                <span>
                  <strong>{f.filename}</strong>
                  <small>{f.altText || "Fără text alternativ"}</small>
                </span>
              </Link>
            ),
          },
          {
            id: "purpose",
            label: "Tip",
            render: (f) =>
              f.purpose === "category-icon" ? "Iconiță" : "Fotografie",
          },
          {
            id: "size",
            label: "Dimensiune",
            sort: (f) => f.size,
            render: (f) => bytes(f.size),
          },
          {
            id: "usage",
            label: "Folosit în",
            render: (f) =>
              f.categoryName ? (
                <span>Categoria {f.categoryName}</span>
              ) : f.references.length ? (
                <div className="ad-media-references">
                  {f.references.slice(0, 2).map((r) => (
                    <Link
                      key={r.id}
                      href={`/admin/${r.kind === "experience" ? "experiences" : "locations"}/${r.id}`}
                    >
                      {r.name}
                    </Link>
                  ))}
                  {f.references.length > 2 && (
                    <small>+{f.references.length - 2} alte fișe</small>
                  )}
                </div>
              ) : (
                <span className="ad-muted">Neutilizat</span>
              ),
          },
          {
            id: "author",
            label: "Încărcat de",
            sort: (f) => f.ownerName,
            render: (f) => f.ownerName,
          },
          {
            id: "date",
            label: "Data",
            sort: (f) => f.createdAt,
            render: (f) => date(f.createdAt),
          },
          {
            id: "actions",
            label: "Acțiuni",
            render: (f) => (
              <div className="ad-row-actions">
                <Link
                  href={`/admin/media/${f.id}/edit`}
                  className="ad-icon-button"
                  title="Vezi și editează"
                  aria-label={`Editează fișierul ${f.filename}`}
                >
                  <Pencil size={16} />
                </Link>
                {configure && !f.used && (
                  <button
                    className="ad-icon-button"
                    title={f.archivedAt ? "Restabilește" : "Arhivează"}
                    aria-label={`${f.archivedAt ? "Restabilește" : "Arhivează"} fișierul ${f.filename}`}
                    onClick={() => setConfirm(f)}
                  >
                    {f.archivedAt ? (
                      <RotateCcw size={16} />
                    ) : (
                      <Archive size={16} />
                    )}
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />
      {confirm && (
        <ConfirmDialog
          title={
            confirm.archivedAt ? "Restabilești fișierul?" : "Arhivezi fișierul?"
          }
          description="Operația păstrează fișierul în stocare și poate fi inversată. Fișierele folosite în categorii sau revizii nu pot fi arhivate."
          confirmLabel={confirm.archivedAt ? "Restabilește" : "Arhivează"}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await api(
              `${confirm.archivedAt ? "media-restore" : "media-archive"}/${confirm.id}`,
              {},
            );
            setMessage("Starea fișierului a fost actualizată.");
            router.refresh();
          }}
        />
      )}
    </>
  );
}
export function MediaEdit({
  data,
  file,
}: {
  data: AdminData;
  file: AdminData["media"][number];
}) {
  const router = useRouter();
  const [name, setName] = useState(file.filename);
  const [alt, setAlt] = useState(file.altText);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const configure = ["owner", "admin"].includes(data.actor.role);
  return (
    <>
      <PageTitle
        title="Detalii fișier"
        description="Actualizează denumirea și descrierea imaginii, apoi verifică unde este folosită."
        action={
          <Link className="ad-button" href="/admin/media">
            <ArrowLeft size={15} />
            Înapoi la media
          </Link>
        }
      />
      <div className="ad-edit-layout">
        <section className="ad-card ad-media-preview">
          <img
            src={file.archivedAt ? "/placeholder.svg" : `/api/media/${file.id}`}
            alt={file.altText || file.filename}
          />
        </section>
        <form
          className="ad-card ad-form-card"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(`media-update/${file.id}`, {
                filename: name,
                altText: alt,
              });
              setMessage("Informațiile fișierului au fost salvate.");
              router.refresh();
            } catch (error) {
              setMessage((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Informații</h2>
          <Notice message={message} />
          <label>
            Denumire
            <input
              required
              maxLength={200}
              disabled={!configure}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Text alternativ
            <textarea
              maxLength={300}
              disabled={!configure}
              placeholder="Descrie pe scurt ce apare în fotografie…"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
            />
            <small>Ajută persoanele care folosesc cititoare de ecran.</small>
          </label>
          <dl className="ad-metadata">
            <div>
              <dt>Dimensiune</dt>
              <dd>{bytes(file.size)}</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>WebP optimizat</dd>
            </div>
            <div>
              <dt>Încărcat de</dt>
              <dd>{file.ownerName}</dd>
            </div>
            <div>
              <dt>Data</dt>
              <dd>{date(file.createdAt)}</dd>
            </div>
            <div>
              <dt>Utilizare</dt>
              <dd>{file.used ? "Folosit în conținut" : "Neutilizat"}</dd>
            </div>
          </dl>
          {configure && (
            <button
              className="ad-button ad-button-primary ad-full-width"
              disabled={busy}
            >
              <Save size={16} />
              {busy ? "Se salvează…" : "Salvează informațiile"}
            </button>
          )}
        </form>
      </div>
    </>
  );
}
export function MediaUpload() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(0);
  function add(input: FileList | null) {
    if (input)
      setFiles((current) => [...current, ...Array.from(input)].slice(0, 10));
  }
  return (
    <>
      <PageTitle
        title="Încarcă fotografii"
        description="Adaugă până la 10 fotografii. Imaginile sunt optimizate și rămân private până la publicarea într-o fișă."
        action={
          <Link className="ad-button" href="/admin/media">
            <ArrowLeft size={15} />
            Înapoi la bibliotecă
          </Link>
        }
      />
      <section className="ad-card ad-form-card">
        <Notice message={message} error />
        <div
          className="ad-upload-zone ad-upload-large"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            add(e.dataTransfer.files);
          }}
        >
          <Upload size={34} />
          <h2>Trage fotografiile aici</h2>
          <p>
            JPEG, PNG sau WebP · maximum 10 MB și 25 megapixeli per fotografie.
          </p>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => add(e.target.files)}
            aria-label="Fotografii pentru bibliotecă"
          />
          <button
            className="ad-button"
            onClick={() => input.current?.click()}
            disabled={busy}
          >
            Alege fotografii
          </button>
        </div>
        <div className="ad-upload-file-list">
          {files.map((file, i) => (
            <div key={`${file.name}-${i}`}>
              <FileImage size={20} />
              <div>
                <strong>{file.name}</strong>
                <small>{bytes(file.size)}</small>
              </div>
              {i < completed ? (
                <CheckCircle2 size={20} />
              ) : (
                <button
                  className="ad-icon-button"
                  aria-label={`Elimină ${file.name}`}
                  disabled={busy}
                  onClick={() =>
                    setFiles((current) =>
                      current.filter((_, index) => index !== i),
                    )
                  }
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="ad-form-actions">
          <Link href="/admin/media" className="ad-button">
            Renunță
          </Link>
          <button
            className="ad-button ad-button-primary"
            disabled={busy || !files.length}
            onClick={async () => {
              setBusy(true);
              setMessage("");
              try {
                for (let i = completed; i < files.length; i++) {
                  const form = new FormData();
                  form.append("file", files[i]);
                  const response = await fetch("/api/platform/upload", {
                    method: "POST",
                    body: form,
                  });
                  const result = await response.json();
                  if (!response.ok)
                    throw new Error(`${files[i].name}: ${result.error}`);
                  setCompleted(i + 1);
                }
                router.push("/admin/media");
                router.refresh();
              } catch (e) {
                setMessage((e as Error).message);
                setBusy(false);
              }
            }}
          >
            <Upload size={16} />
            {busy
              ? `Se încarcă ${completed}/${files.length}…`
              : "Încarcă în bibliotecă"}
          </button>
        </div>
      </section>
    </>
  );
}
export function UsersPage({ data }: { data: AdminData }) {
  const [verified, setVerified] = useState("");
  return (
    <>
      <PageTitle
        title="Utilizatori"
        description="Conturile înregistrate, verificarea emailurilor și contribuțiile fiecărui utilizator."
      />
      <DataTable
        rows={data.people.filter(
          (p) =>
            !verified ||
            (verified === "verified" ? p.emailVerified : !p.emailVerified),
        )}
        rowKey={(p) => p.id}
        searchText={(p) => `${p.name} ${p.email}`}
        searchPlaceholder="Caută utilizatori după nume sau email…"
        exportName="utilizatori"
        filters={
          <select
            aria-label="Verificarea emailului"
            value={verified}
            onChange={(e) => setVerified(e.target.value)}
          >
            <option value="">Toți utilizatorii</option>
            <option value="verified">Email confirmat</option>
            <option value="unverified">Email neconfirmat</option>
          </select>
        }
        columns={[
          {
            id: "name",
            label: "Utilizator",
            sort: (p) => p.name,
            render: (p) => (
              <div className="ad-cell-with-icon">
                <span className="ad-person-avatar">
                  {p.name.slice(0, 2).toUpperCase()}
                </span>
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.email}</small>
                </span>
              </div>
            ),
          },
          {
            id: "role",
            label: "Rol",
            sort: (p) => p.role,
            render: (p) => roleLabels[p.role],
          },
          {
            id: "verification",
            label: "Email",
            render: (p) => (
              <Badge value={p.emailVerified ? "active" : "pending"}>
                {p.emailVerified ? "Confirmat" : "Neconfirmat"}
              </Badge>
            ),
          },
          {
            id: "contributions",
            label: "Contribuții",
            sort: (p) =>
              new Set(
                data.items
                  .filter((i) => i.listing.ownerId === p.id)
                  .map((i) => i.listing.id),
              ).size,
            render: (p) =>
              new Set(
                data.items
                  .filter((i) => i.listing.ownerId === p.id)
                  .map((i) => i.listing.id),
              ).size,
          },
          {
            id: "date",
            label: "Înregistrat la",
            sort: (p) => p.createdAt,
            render: (p) => date(p.createdAt),
          },
          {
            id: "actions",
            label: "Acțiuni",
            render: (p) => (
              <Link
                className="ad-button ad-button-small"
                href={`/admin/users/${p.id}/edit`}
              >
                <Pencil size={14} />
                Detalii
              </Link>
            ),
          },
        ]}
      />
    </>
  );
}
export function UserEdit({
  data,
  person,
}: {
  data: AdminData;
  person: AdminData["people"][number];
}) {
  const router = useRouter();
  const [name, setName] = useState(person.name);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const owned = [
    ...new Map(
      data.items
        .filter((i) => i.listing.ownerId === person.id)
        .map((i) => [i.listing.id, i]),
    ).values(),
  ];
  return (
    <>
      <PageTitle
        title={person.name}
        description="Profilul utilizatorului și fișele asociate contului său."
        action={
          <Link className="ad-button" href="/admin/users">
            <ArrowLeft size={15} />
            Înapoi la utilizatori
          </Link>
        }
      />
      <div className="ad-edit-layout">
        <form
          className="ad-card ad-form-card"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(`user-update/${person.id}`, { name });
              setMessage("Numele a fost actualizat.");
              router.refresh();
            } catch (error) {
              setMessage((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Profil</h2>
          <Notice message={message} />
          <label>
            Nume
            <input
              value={name}
              required
              minLength={2}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Email
            <input disabled value={person.email} />
          </label>
          <dl className="ad-metadata">
            <div>
              <dt>Rol</dt>
              <dd>{roleLabels[person.role]}</dd>
            </div>
            <div>
              <dt>Înregistrare</dt>
              <dd>{date(person.createdAt)}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{person.emailVerified ? "Confirmat" : "Neconfirmat"}</dd>
            </div>
          </dl>
          <div className="ad-form-actions">
            <button className="ad-button ad-button-primary" disabled={busy}>
              <Save size={15} />
              Salvează profilul
            </button>
          </div>
        </form>
        <aside className="ad-card ad-form-card">
          <h2>Conținut asociat</h2>
          {owned.length ? (
            owned.map((i) => (
              <Link
                key={i.listing.id}
                className="ad-owned-listing"
                href={`/admin/${i.listing.kind === "experience" ? "experiences" : "locations"}/${i.listing.id}`}
              >
                <strong>
                  {String(i.revision.values.name ?? "Fără denumire")}
                </strong>
                <Badge value={i.listing.status} />
              </Link>
            ))
          ) : (
            <p>Acest utilizator nu a adăugat încă nicio fișă.</p>
          )}
          {person.role !== "user" &&
            data.actor.role === "owner" &&
            person.role !== "owner" && (
              <Link
                className="ad-button ad-full-width"
                href={`/admin/team/${person.id}/edit`}
              >
                <ShieldCheck size={15} />
                Gestionează accesul
              </Link>
            )}
        </aside>
      </div>
    </>
  );
}
export function SettingsPage({ data }: { data: AdminData }) {
  const router = useRouter();
  const [name, setName] = useState(data.actor.name);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [services, setServices] = useState<{
    database: boolean;
    storage: boolean;
    emailConfigured: boolean;
    checkedAt: string;
  } | null>(null);
  return (
    <>
      <PageTitle
        title="Setări"
        description="Profilul tău și starea conexiunilor necesare funcționării platformei."
      />
      <div className="ad-edit-layout">
        <form
          className="ad-card ad-form-card"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("profile", { name });
              setMessage("Profilul tău a fost actualizat.");
              router.refresh();
            } catch (error) {
              setMessage((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="ad-card-heading">
            <div>
              <h2>Profilul meu</h2>
              <p>Informații despre contul cu care administrezi platforma.</p>
            </div>
            <UserRound size={20} />
          </div>
          <Notice message={message} />
          <label>
            Nume
            <input
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Email
            <input value={data.actor.email} disabled />
          </label>
          <label>
            Rol
            <input value={roleLabels[data.actor.role]} disabled />
          </label>
          <div className="ad-form-actions">
            <button className="ad-button ad-button-primary" disabled={busy}>
              <Save size={15} />
              {busy ? "Se salvează…" : "Salvează profilul"}
            </button>
          </div>
        </form>
        <section className="ad-card ad-form-card">
          <div className="ad-card-heading">
            <div>
              <h2>Starea platformei</h2>
              <p>Verifică disponibilitatea serviciilor.</p>
            </div>
            <Settings size={20} />
          </div>
          {[
            {
              label: "Bază de date",
              sub: "PostgreSQL / PostGIS",
              key: "database" as const,
              icon: Database,
            },
            {
              label: "Fișiere și fotografii",
              sub: "MinIO · stocare privată",
              key: "storage" as const,
              icon: HardDrive,
            },
            {
              label: "Emailuri",
              sub: data.mailProvider,
              key: "emailConfigured" as const,
              icon: Mail,
            },
          ].map((service) => (
            <div className="ad-service-row" key={service.key}>
              <service.icon size={20} />
              <div>
                <strong>{service.label}</strong>
                <small>{service.sub}</small>
              </div>
              <Badge
                value={
                  services
                    ? services[service.key]
                      ? "active"
                      : "rejected"
                    : "draft"
                }
              >
                {services
                  ? services[service.key]
                    ? service.key === "emailConfigured"
                      ? "Configurat"
                      : "Disponibil"
                    : "Indisponibil"
                  : "Neverificat"}
              </Badge>
            </div>
          ))}
          <button
            className="ad-button ad-full-width"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              try {
                setServices(await api("admin-status"));
              } catch (error) {
                setMessage((error as Error).message);
              } finally {
                setChecking(false);
              }
            }}
          >
            <RefreshCw size={15} />
            {checking ? "Se verifică…" : "Verifică conexiunile"}
          </button>
          {services && (
            <small className="ad-checked-at">
              Verificat la{" "}
              {new Date(services.checkedAt).toLocaleTimeString("ro-RO")}
            </small>
          )}
          {data.actor.role === "owner" && (
            <div className="ad-mail-delivery">
              <h3>Livrarea emailurilor</h3>
              {data.delivery.map((item) => (
                <div key={item.status}>
                  <span>
                    {{
                      pending: "În așteptare",
                      processing: "În curs de livrare",
                      sent: "Livrate",
                      failed: "Eșuate",
                    }[item.status] ?? item.status}
                  </span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
