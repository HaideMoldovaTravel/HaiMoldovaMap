"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Pencil,
  Eye,
  Archive,
  RotateCcw,
  ArrowLeft,
  CheckCircle2,
  Send,
  History,
  FileText,
  ExternalLink,
} from "lucide-react";
import { api } from "@/components/platform/api";
import { ListingForm } from "@/components/platform/listing-form";
import type { Item } from "@/components/platform/types";
import type { AdminData } from "./types";
import { latestItems } from "@/modules/catalog/admin-utils";
import {
  AddLink,
  Badge,
  ConfirmDialog,
  DataTable,
  Notice,
  PageTitle,
  date,
  dateTime,
} from "./shared";
const photo = (value: unknown) =>
  typeof value === "string"
    ? value.startsWith("https://images.unsplash.com/")
      ? value
      : `/api/media/${value}`
    : "/placeholder.svg";
export function ContentPage({
  data,
  kind,
  query = "",
  category = "",
  quality = "",
  moderation = false,
}: {
  data: AdminData;
  kind?: "location" | "experience";
  query?: string;
  category?: string;
  quality?: string;
  moderation?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [cat, setCat] = useState(category);
  const [demo, setDemo] = useState("");
  const [confirm, setConfirm] = useState<{
    item: Item;
    action: "archive" | "restore";
  } | null>(null);
  const [message, setMessage] = useState("");
  const all = moderation
    ? data.items.filter(
        (i) =>
          i.revision.status === "pending" &&
          !["archived", "suspended"].includes(i.listing.status),
      )
    : latestItems(data).filter((i) => !kind || i.listing.kind === kind);
  const rows = all.filter(
    (i) =>
      (!status ||
        i.listing.status === status ||
        i.revision.status === status) &&
      (!cat || i.revision.categoryId === cat) &&
      (!demo || (demo === "demo" ? i.listing.demo : !i.listing.demo)) &&
      (!quality ||
        (quality === "photos"
          ? !Array.isArray(i.revision.values.gallery) ||
            !i.revision.values.gallery.length
          : quality === "translation"
            ? !i.revision.values.description_en
            : !["phone", "email", "website"].some(
                (k) => i.revision.values[k],
              ))),
  );
  const title = moderation
    ? "Moderare"
    : kind === "experience"
      ? "Experiențe"
      : kind === "location"
        ? "Locații"
        : "Tot conținutul";
  const base = kind === "experience" ? "experiences" : "locations";
  return (
    <>
      <PageTitle
        eyebrow="CONȚINUT"
        title={title}
        description={
          moderation
            ? "Verifică propunerile și modificările înainte ca acestea să apară pe site."
            : kind === "experience"
              ? "Gestionează activitățile, ofertele și experiențele adăugate pe hartă."
              : "Gestionează locațiile, informațiile publice și starea fiecărei fișe."
        }
        action={
          !moderation && (
            <AddLink href={`/admin/${base}/add`}>
              Adaugă {kind === "experience" ? "experiență" : "locație"}
            </AddLink>
          )
        }
      />
      <div className="ad-summary-strip">
        <span>
          <b>{all.length}</b>{" "}
          {moderation ? "propuneri de verificat" : "fișe în total"}
        </span>
        {!moderation && (
          <>
            <span>
              <i className="ad-live-dot" />
              <b>
                {all.filter((i) => i.listing.status === "published").length}
              </b>{" "}
              publicate
            </span>
            <span>
              <b>{all.filter((i) => i.revision.status === "draft").length}</b>{" "}
              ciorne
            </span>
            <span>
              <b>{all.filter((i) => i.listing.demo).length}</b> demonstrative
            </span>
          </>
        )}
      </div>
      <Notice message={message} />
      {quality && (
        <div className="ad-filter-notice">
          Filtru de calitate:{" "}
          {quality === "photos"
            ? "fără fotografii"
            : quality === "translation"
              ? "traducere EN lipsă"
              : "fără contacte"}
          <Link href={`/admin/${base}`}>Elimină filtrul ×</Link>
        </div>
      )}
      <DataTable
        rows={rows}
        rowKey={(i) => i.revision.id}
        initialQuery={query}
        searchText={(i) =>
          `${i.revision.values.name} ${i.revision.values.village} ${i.authorName}`
        }
        searchPlaceholder="Caută după denumire, localitate sau autor…"
        exportName={moderation ? "moderare" : base}
        emptyTitle={
          moderation ? "Nicio propunere de verificat" : "Nicio fișă găsită"
        }
        filters={
          <>
            <select
              aria-label="Filtrează după categorie"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
            >
              <option value="">Toate categoriile</option>
              {data.config
                .filter((c) => !kind || c.kind === kind)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            {!moderation && (
              <select
                aria-label="Filtrează după stare"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">Toate stările</option>
                <option value="published">Publicate</option>
                <option value="draft">Ciorne</option>
                <option value="pending">În verificare</option>
                <option value="changes">Necesită corectări</option>
                <option value="suspended">Retrase</option>
                <option value="archived">Arhivate</option>
              </select>
            )}
            <select
              aria-label="Tipul datelor"
              value={demo}
              onChange={(e) => setDemo(e.target.value)}
            >
              <option value="">Toate datele</option>
              <option value="real">Date reale</option>
              <option value="demo">Demonstrative</option>
            </select>
          </>
        }
        columns={[
          {
            id: "name",
            label: moderation ? "Propunere" : "Denumire",
            sort: (i) => String(i.revision.values.name ?? ""),
            render: (i) => (
              <Link
                className="ad-cell-with-icon"
                href={
                  moderation
                    ? `/admin/moderation/${i.revision.id}`
                    : `/admin/${i.listing.kind === "experience" ? "experiences" : "locations"}/${i.listing.id}`
                }
              >
                <img
                  className="ad-thumbnail"
                  src={photo(
                    Array.isArray(i.revision.values.gallery)
                      ? i.revision.values.gallery[0]
                      : null,
                  )}
                  alt=""
                />
                <span>
                  <strong>
                    {String(i.revision.values.name ?? "Fără denumire")}
                  </strong>
                  <small>
                    {String(i.revision.values.village ?? "Adresă necompletată")}
                    {i.listing.demo && (
                      <span className="ad-demo-label">DEMO</span>
                    )}
                  </small>
                </span>
              </Link>
            ),
          },
          {
            id: "category",
            label: "Categorie",
            sort: (i) =>
              data.config.find((c) => c.id === i.revision.categoryId)?.name ??
              "",
            render: (i) =>
              data.config.find((c) => c.id === i.revision.categoryId)?.name ??
              "—",
          },
          {
            id: "state",
            label: "Stare",
            render: (i) => (
              <div className="ad-cell-badges">
                <Badge
                  value={
                    i.listing.status === "archived" ||
                    i.listing.status === "suspended"
                      ? i.listing.status
                      : i.revision.status
                  }
                />
                {i.listing.status === "published" &&
                  i.revision.status !== "approved" && (
                    <Badge value="published" />
                  )}
              </div>
            ),
          },
          {
            id: "owner",
            label: "Autor",
            sort: (i) => i.authorName,
            render: (i) => i.authorName,
          },
          {
            id: "date",
            label: moderation ? "Primită la" : "Actualizată la",
            sort: (i) => i.revision.createdAt,
            render: (i) => date(i.revision.createdAt),
          },
          {
            id: "actions",
            label: "Acțiuni",
            render: (i) => (
              <div className="ad-row-actions">
                <Link
                  href={
                    moderation
                      ? `/admin/moderation/${i.revision.id}`
                      : `/admin/${i.listing.kind === "experience" ? "experiences" : "locations"}/${i.listing.id}`
                  }
                  className="ad-icon-button"
                  aria-label={`Vezi ${i.revision.values.name}`}
                  title="Vezi detalii"
                >
                  <Eye size={16} />
                </Link>
                {!moderation && (
                  <>
                    <Link
                      href={`/admin/${i.listing.kind === "experience" ? "experiences" : "locations"}/${i.listing.id}/edit`}
                      className="ad-icon-button"
                      aria-label={`Editează ${i.revision.values.name}`}
                      title="Editează"
                    >
                      <Pencil size={16} />
                    </Link>
                    <button
                      className="ad-icon-button"
                      title={
                        ["archived", "suspended"].includes(i.listing.status)
                          ? "Restabilește"
                          : "Arhivează"
                      }
                      aria-label={`${["archived", "suspended"].includes(i.listing.status) ? "Restabilește" : "Arhivează"} ${i.revision.values.name}`}
                      onClick={() =>
                        setConfirm({
                          item: i,
                          action: ["archived", "suspended"].includes(
                            i.listing.status,
                          )
                            ? "restore"
                            : "archive",
                        })
                      }
                    >
                      {["archived", "suspended"].includes(i.listing.status) ? (
                        <RotateCcw size={16} />
                      ) : (
                        <Archive size={16} />
                      )}
                    </button>
                  </>
                )}
              </div>
            ),
          },
        ]}
      />
      {confirm && (
        <ConfirmDialog
          title={
            confirm.action === "archive"
              ? "Arhivezi această fișă?"
              : "Restabilești această fișă?"
          }
          description={
            confirm.action === "archive"
              ? "Fișa va fi ascunsă de pe site. Datele și istoricul sunt păstrate și o poți restabili ulterior."
              : "Ultima versiune aprobată va redeveni publică. Ciornele rămân private."
          }
          confirmLabel={
            confirm.action === "archive"
              ? "Arhivează fișa"
              : "Restabilește fișa"
          }
          danger={confirm.action === "archive"}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await api(
              `${confirm.action}-listing/${confirm.item.listing.id}`,
              {},
            );
            setMessage("Starea fișei a fost actualizată.");
            router.refresh();
          }}
        />
      )}
    </>
  );
}
export function ListingEditorPage({
  data,
  kind,
  item,
}: {
  data: AdminData;
  kind: "location" | "experience";
  item?: Item;
}) {
  const router = useRouter();
  const base = kind === "experience" ? "experiences" : "locations";
  const config = data.config.filter((c) => c.kind === kind);
  const locations = latestItems(data)
    .filter(
      (i) => i.listing.kind === "location" && i.listing.status === "published",
    )
    .map((i) => ({
      id: i.listing.id,
      name: String(i.revision.values.name ?? ""),
    }));
  return (
    <>
      <PageTitle
        eyebrow={`CONȚINUT / ${kind === "experience" ? "EXPERIENȚE" : "LOCAȚII"}`}
        title={
          item
            ? `Editează · ${String(item.revision.values.name ?? "Fișă")}`
            : `Adaugă ${kind === "experience" ? "o experiență" : "o locație"}`
        }
        description="Completează informațiile, verifică poziția și fotografiile, apoi salvează sau publică."
        action={
          <Link className="ad-button" href={`/admin/${base}`}>
            <ArrowLeft size={15} />
            Înapoi la listă
          </Link>
        }
      />
      {item?.listing.demo && (
        <div className="ad-help-note">
          <FileText size={18} />
          <p>
            Această fișă rămâne marcată ca demonstrativă. Modificările nu o
            transformă automat în date verificate.
          </p>
        </div>
      )}
      {item && ["suspended", "archived"].includes(item.listing.status) && (
        <div className="ad-notice">
          Fișa este retrasă. O poți edita ca ciornă; restabilește fișa înainte
          de publicare.
        </div>
      )}
      <ListingForm
        adminMode
        config={config}
        item={item}
        locations={locations}
        onClose={() => router.push(`/admin/${base}`)}
        onSaved={async () => {
          router.refresh();
        }}
        onCompleted={(result) => {
          router.push(`/admin/${base}/${result.listingId}`);
          router.refresh();
        }}
      />
    </>
  );
}
export function ListingDetail({
  data,
  item,
  review = false,
}: {
  data: AdminData;
  item: Item;
  review?: boolean;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [compare, setCompare] = useState(true);
  const [action, setAction] = useState<"archive" | "restore" | null>(null);
  const base = item.listing.kind === "experience" ? "experiences" : "locations";
  const history = data.items.filter((i) => i.listing.id === item.listing.id);
  const published = history.find(
    (i) => i.revision.id === item.listing.publishedRevisionId,
  );
  const template = data.versions.find((v) => v.id === item.revision.templateId);
  const pending = item.revision.status === "pending";
  const fields = template?.fields ?? [];
  async function decide(decision: string) {
    setBusy(true);
    setMessage("");
    try {
      await api(`moderate/${item.revision.id}`, { decision, feedback });
      router.push(
        review ? "/admin/moderation" : `/admin/${base}/${item.listing.id}`,
      );
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const value = (raw: unknown, type?: string) =>
    type === "gallery" && Array.isArray(raw) ? (
      <div className="ad-detail-gallery">
        {raw.map((id: string) => (
          <a
            href={photo(id)}
            key={id}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src={photo(id)} alt="Fotografie din fișă" />
          </a>
        ))}
      </div>
    ) : typeof raw === "boolean" ? (
      raw ? (
        "Da"
      ) : (
        "Nu"
      )
    ) : Array.isArray(raw) ? (
      raw.join(", ")
    ) : raw === undefined || raw === "" ? (
      <span className="ad-muted">Necompletat</span>
    ) : (
      String(raw)
    );
  return (
    <>
      <PageTitle
        eyebrow={review ? "MODERARE / VERIFICARE" : "CONȚINUT / DETALII"}
        title={String(item.revision.values.name ?? "Fișă fără denumire")}
        description={`${data.config.find((c) => c.id === item.revision.categoryId)?.name ?? ""} · ${String(item.revision.values.village ?? "")}`}
        action={
          <>
            <Link
              href={review ? "/admin/moderation" : `/admin/${base}`}
              className="ad-button"
            >
              <ArrowLeft size={15} />
              Înapoi
            </Link>
            <Link
              href={`/admin/${base}/${item.listing.id}/edit`}
              className="ad-button ad-button-primary"
            >
              <Pencil size={15} />
              Editează fișa
            </Link>
          </>
        }
      />
      <div className="ad-summary-strip">
        <Badge value={item.revision.status} />
        <Badge value={item.listing.status} />
        {item.listing.demo && <span className="ad-demo-label">DEMO</span>}
        <span>
          Autor: <b>{item.authorName}</b>
        </span>
        <span>{dateTime(item.revision.createdAt)}</span>
      </div>
      <Notice message={message} error />
      <div className="ad-detail-layout">
        <div>
          <section className="ad-card">
            <div className="ad-card-heading">
              <div>
                <h2>{review ? "Informații propuse" : "Informațiile fișei"}</h2>
                <p>
                  Formular v{template?.version} · {fields.length} câmpuri
                </p>
              </div>
              {published && published.revision.id !== item.revision.id && (
                <label className="ad-inline-check">
                  <input
                    type="checkbox"
                    checked={compare}
                    onChange={(e) => setCompare(e.target.checked)}
                  />
                  Compară cu publicat
                </label>
              )}
            </div>
            <dl className="ad-detail-values">
              {fields
                .filter(
                  (f) => item.revision.values[f.id] !== undefined || f.required,
                )
                .map((field) => {
                  const val = item.revision.values[field.id];
                  const old = published?.revision.values[field.id];
                  const changed =
                    published &&
                    published.revision.id !== item.revision.id &&
                    JSON.stringify(val) !== JSON.stringify(old);
                  return (
                    <div key={field.id} className={changed ? "changed" : ""}>
                      <dt>
                        {field.label}
                        {!field.public && (
                          <span className="ad-demo-label">INTERN</span>
                        )}
                        {changed && <Badge value="pending">Modificat</Badge>}
                      </dt>
                      <dd>
                        {value(val, field.type)}
                        {compare && changed && (
                          <div className="ad-previous-value">
                            <small>PUBLICAT ANTERIOR</small>
                            {value(old, field.type)}
                          </div>
                        )}
                      </dd>
                    </div>
                  );
                })}
            </dl>
          </section>
          {item.revision.parentLocationId && (
            <section className="ad-card ad-form-card">
              <h2>Locație asociată</h2>
              <Link
                className="ad-text-link"
                href={`/admin/locations/${item.revision.parentLocationId}`}
              >
                <MapPin size={16} />
                {data.items.find(
                  (i) => i.listing.id === item.revision.parentLocationId,
                )?.revision.values.name ?? "Vezi locația"}
                <ExternalLink size={14} />
              </Link>
            </section>
          )}
        </div>
        <aside>
          {pending && (
            <section className="ad-card ad-form-card ad-review-card">
              <span className="ad-aside-icon">
                <CheckCircle2 size={24} />
              </span>
              <h2>Decizia de moderare</h2>
              <p>
                Verifică informațiile și fotografiile. Aprobarea înlocuiește
                versiunea publică.
              </p>
              <label>
                Observații pentru prestator
                <textarea
                  value={feedback}
                  maxLength={3000}
                  placeholder="Explică ce trebuie corectat sau motivul respingerii…"
                  onChange={(e) => setFeedback(e.target.value)}
                />
              </label>
              <button
                className="ad-button ad-button-primary ad-full-width"
                disabled={busy}
                onClick={() => void decide("approve")}
              >
                <CheckCircle2 size={16} />
                Aprobă și publică
              </button>
              <button
                className="ad-button ad-full-width"
                disabled={busy}
                onClick={() => void decide("changes")}
              >
                <Send size={15} />
                Solicită corectări
              </button>
              <button
                className="ad-button ad-button-danger ad-full-width"
                disabled={busy}
                onClick={() => void decide("reject")}
              >
                Respinge propunerea
              </button>
            </section>
          )}
          {item.revision.status === "draft" &&
            !["suspended", "archived"].includes(item.listing.status) && (
              <section className="ad-card ad-form-card">
                <h2>Publicarea ciornei</h2>
                <p>
                  Poți trimite ciorna spre moderare sau o poți publica după
                  validarea câmpurilor.
                </p>
                <button
                  className="ad-button ad-button-primary ad-full-width"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api(`submit/${item.revision.id}`, {});
                      await api(`moderate/${item.revision.id}`, {
                        decision: "approve",
                        feedback: "",
                      });
                      router.refresh();
                    } catch (e) {
                      setMessage((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Validează și publică
                </button>
              </section>
            )}
          {item.revision.feedback && (
            <section className="ad-card ad-form-card">
              <h2>Feedback</h2>
              <p>{item.revision.feedback}</p>
            </section>
          )}
          <section className="ad-card ad-form-card">
            <h2>
              <History size={17} />
              Istoricul reviziilor
            </h2>
            <div className="ad-revision-timeline">
              {history.map((version) => (
                <Link
                  href={`/admin/moderation/${version.revision.id}`}
                  key={version.revision.id}
                  className={
                    version.revision.id === item.revision.id ? "selected" : ""
                  }
                >
                  <i />
                  <div>
                    <Badge value={version.revision.status} />
                    <strong>{version.authorName}</strong>
                    <small>{dateTime(version.revision.createdAt)}</small>
                  </div>
                </Link>
              ))}
            </div>
          </section>
          <section className="ad-card ad-form-card">
            <h2>Administrare</h2>
            <p>Arhivarea păstrează toate datele și istoricul.</p>
            <button
              className="ad-button ad-full-width"
              onClick={() =>
                setAction(
                  ["suspended", "archived"].includes(item.listing.status)
                    ? "restore"
                    : "archive",
                )
              }
            >
              <Archive size={15} />
              {["suspended", "archived"].includes(item.listing.status)
                ? "Restabilește fișa"
                : "Arhivează fișa"}
            </button>
          </section>
        </aside>
      </div>
      {action && (
        <ConfirmDialog
          title={action === "archive" ? "Arhivezi fișa?" : "Restabilești fișa?"}
          description="Datele și istoricul sunt păstrate. Publicarea depinde de existența unei versiuni aprobate."
          confirmLabel={action === "archive" ? "Arhivează" : "Restabilește"}
          danger={action === "archive"}
          onClose={() => setAction(null)}
          onConfirm={async () => {
            await api(`${action}-listing/${item.listing.id}`, {});
            router.refresh();
          }}
        />
      )}
    </>
  );
}
