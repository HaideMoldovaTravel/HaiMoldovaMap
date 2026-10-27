"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAuthClient } from "better-auth/react";
import type { DashboardData, CategoryConfig, Item } from "./types";
import { api } from "./api";
import { ListingForm } from "./listing-form";
import { TemplateEditor } from "./template-editor";
const authClient = createAuthClient();
const statuses: Record<string, string> = {
  draft: "Ciornă",
  pending: "În verificare",
  approved: "Aprobată",
  changes: "Necesită corectări",
  rejected: "Respinsă",
};
export function Dashboard({
  initial,
  admin = false,
}: {
  initial: DashboardData;
  admin?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState("content");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [review, setReview] = useState<Item | null>(null);
  const [templateId, setTemplate] = useState(data.config[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [publicLocations, setLocations] = useState<
    { id: string; name: string }[]
  >([]);
  const canConfigure = ["owner", "admin"].includes(data.actor.role);
  const latest = Array.from(
    new Map(
      [...data.items].reverse().map((item) => [item.listing.id, item]),
    ).values(),
  ).reverse();
  const pending = data.items.filter(
    (item) => item.revision.status === "pending",
  );
  async function refresh() {
    const next = await api<DashboardData>(
      admin ? "dashboard?scope=admin" : "dashboard",
    );
    setData(next);
  }
  async function openForm(item: Item | "new") {
    setMessage("");
    try {
      const places =
        await api<{ id: string; name: string; category: string }[]>("public");
      setLocations(
        places.filter(
          (p) =>
            data.config.find((c) => c.id === p.category)?.kind === "location",
        ),
      );
      setEditing(item);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  async function withdraw(item: Item) {
    if (!window.confirm("Retragi această fișă de pe site și de pe hartă?"))
      return;
    try {
      await api(`suspend/${item.listing.id}`, {});
      await refresh();
      setMessage("Fișa a fost retrasă.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  return (
    <main className="platform-shell">
      <header className="platform-header">
        <Link href="/" className="platform-brand">
          hai<span>moldova</span>
        </Link>
        <div>
          <span>{data.actor.name}</span>
          <Link href="/">Vezi harta ↗</Link>
          {["owner", "admin", "moderator"].includes(data.actor.role) && (
            <Link href={admin ? "/cont" : "/admin"}>
              {admin ? "Contul meu" : "Administrare"}
            </Link>
          )}
          <button
            onClick={async () => {
              await authClient.signOut();
              router.push("/");
              router.refresh();
            }}
          >
            Ieșire
          </button>
        </div>
      </header>
      <div className="platform-body">
        <div className="platform-row platform-page-title">
          <div>
            <p className="platform-eyebrow">
              {admin ? "ADMINISTRARE" : "CONTUL TĂU"}
            </p>
            <h1>
              {admin
                ? "Locurile și oamenii Moldovei"
                : "Locațiile și experiențele tale"}
            </h1>
            <p>
              {admin
                ? "Verifică propuneri, gestionează conținutul și configurează formularele."
                : "Povestește ce oferi. Noi verificăm, apoi publicăm pe hartă."}
            </p>
          </div>
          <button
            className="platform-primary"
            onClick={() => void openForm("new")}
          >
            + Adaugă locație / experiență
          </button>
        </div>
        {message && (
          <div className="platform-notice" role="status">
            {message}
          </div>
        )}
        {editing ? (
          <ListingForm
            config={data.config}
            item={editing === "new" ? undefined : editing}
            locations={publicLocations}
            onClose={() => setEditing(null)}
            onSaved={refresh}
          />
        ) : (
          <>
            {admin && (
              <nav className="platform-tabs" aria-label="Administrare">
                {[
                  ["content", "Toate fișele"],
                  ["moderation", `De verificat (${pending.length})`],
                  ...(canConfigure
                    ? [
                        ["categories", "Categorii"],
                        ["templates", "Formulare"],
                      ]
                    : []),
                  ...(data.actor.role === "owner" ? [["team", "Echipă"]] : []),
                  ["activity", "Activitate"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={tab === key ? "active" : ""}
                    onClick={() => {
                      setTab(key);
                      setReview(null);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            )}
            {review ? (
              <Review
                item={review}
                data={data}
                onClose={() => setReview(null)}
                onSaved={async () => {
                  await refresh();
                  setReview(null);
                }}
              />
            ) : tab === "templates" && canConfigure ? (
              <>
                <label className="platform-category-select">
                  Formularul categoriei
                  <select
                    value={templateId}
                    onChange={(e) => setTemplate(e.target.value)}
                  >
                    {data.config.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                {data.config
                  .filter((c) => c.id === templateId)
                  .map((c) => (
                    <TemplateEditor
                      key={c.template.id}
                      category={c}
                      onSaved={refresh}
                    />
                  ))}
              </>
            ) : tab === "categories" && canConfigure ? (
              <Categories config={data.config} onSaved={refresh} />
            ) : tab === "team" && data.actor.role === "owner" ? (
              <Team data={data} onSaved={refresh} />
            ) : tab === "activity" ? (
              <section className="platform-panel">
                <h2>Activitate recentă</h2>
                {data.activity.map((event) => (
                  <div className="platform-activity" key={event.id}>
                    <strong>{event.action}</strong>
                    <span>
                      {new Date(event.createdAt).toLocaleString("ro-RO")}
                    </span>
                    <small>{event.resourceId}</small>
                  </div>
                ))}
              </section>
            ) : (
              <section className="platform-panel">
                <div className="platform-row">
                  <h2>
                    {tab === "moderation"
                      ? "Propuneri de verificat"
                      : admin
                        ? "Locații și experiențe"
                        : "Propunerile tale"}
                  </h2>
                  <span>
                    {(tab === "moderation" ? pending : latest).length} fișe
                  </span>
                </div>
                {!(tab === "moderation" ? pending : latest).length && (
                  <div className="platform-empty">
                    <h3>
                      {tab === "moderation"
                        ? "Nu sunt propuneri în așteptare"
                        : "Prima ta poveste începe aici"}
                    </h3>
                    <p>
                      Adaugă o locație sau experiență folosind formularul
                      categoriei.
                    </p>
                  </div>
                )}
                <div className="platform-item-list">
                  {(tab === "moderation" ? pending : latest).map((item) => (
                    <article className="platform-item" key={item.revision.id}>
                      <div>
                        <div className="platform-badges">
                          <span
                            className={`platform-badge status-${item.revision.status}`}
                          >
                            {statuses[item.revision.status]}
                          </span>
                          {item.listing.status === "published" && (
                            <span className="platform-badge status-approved">
                              Pe hartă
                            </span>
                          )}
                          {item.listing.status === "suspended" && (
                            <span className="platform-badge status-rejected">
                              Retrasă
                            </span>
                          )}
                          {item.listing.demo && (
                            <span className="platform-badge">Demo</span>
                          )}
                        </div>
                        <h3>
                          {String(item.revision.values.name ?? "Fără denumire")}
                        </h3>
                        <p>
                          {
                            data.config.find(
                              (c) => c.id === item.revision.categoryId,
                            )?.name
                          }{" "}
                          · {String(item.revision.values.village ?? "")}
                          {admin ? ` · ${item.authorName}` : ""}
                        </p>
                        {item.revision.feedback && (
                          <div className="platform-feedback">
                            {item.revision.feedback}
                          </div>
                        )}
                      </div>
                      <div className="platform-item-actions">
                        <button
                          className="platform-secondary"
                          onClick={() => setReview(item)}
                        >
                          {admin && item.revision.status === "pending"
                            ? "Verifică propunerea"
                            : "Vezi detalii"}
                        </button>
                        {item.revision.status !== "pending" &&
                          !item.listing.demo &&
                          !["suspended", "archived"].includes(
                            item.listing.status,
                          ) && (
                            <button
                              className="platform-secondary"
                              onClick={() => void openForm(item)}
                            >
                              {item.revision.status === "approved"
                                ? "Propune modificări"
                                : "Editează"}
                            </button>
                          )}
                        {admin && item.listing.status === "published" && (
                          <button
                            className="platform-danger"
                            onClick={() => void withdraw(item)}
                          >
                            Retrage
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
function Review({
  item,
  data,
  onClose,
  onSaved,
}: {
  item: Item;
  data: DashboardData;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const category = data.config.find((c) => c.id === item.revision.categoryId);
  const published = data.items.find(
    (i) => i.revision.id === item.listing.publishedRevisionId,
  );
  const canReview =
    ["owner", "admin", "moderator"].includes(data.actor.role) &&
    item.revision.status === "pending";
  async function decide(decision: string) {
    setBusy(true);
    try {
      await api(`moderate/${item.revision.id}`, { decision, feedback });
      await onSaved();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="platform-panel">
      <div className="platform-row">
        <h2>{String(item.revision.values.name ?? "Propunere")}</h2>
        <button className="platform-secondary" onClick={onClose}>
          Înapoi
        </button>
      </div>
      <p>
        {statuses[item.revision.status]} · {item.authorName}
      </p>
      <dl className="platform-review">
        {Object.entries(item.revision.values).map(([key, value]) => {
          const field = category?.template.fields.find((f) => f.id === key);
          const old = published?.revision.values[key];
          const changed =
            published && JSON.stringify(old) !== JSON.stringify(value);
          return (
            <div key={key}>
              <dt>
                {field?.label ?? key}
                {field && !field.public && " · intern"}
                {changed && <span className="platform-badge">Modificat</span>}
              </dt>
              <dd>
                {key === "gallery" && Array.isArray(value) ? (
                  <div className="platform-gallery">
                    {value.map((id) => (
                      <img
                        key={id}
                        alt="Fotografie propusă"
                        src={item.listing.demo ? id : `/api/media/${id}`}
                      />
                    ))}
                  </div>
                ) : typeof value === "boolean" ? (
                  value ? (
                    "Da"
                  ) : (
                    "Nu"
                  )
                ) : Array.isArray(value) ? (
                  value.join(", ")
                ) : (
                  String(value)
                )}
                {changed && key !== "gallery" && (
                  <small>
                    Publicat anterior:{" "}
                    {Array.isArray(old)
                      ? old.join(", ")
                      : String(old ?? "Nespecificat")}
                  </small>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {canReview && (
        <>
          <label>
            Observații / motiv
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              maxLength={3000}
            />
          </label>
          {message && (
            <p className="platform-notice" role="alert">
              {message}
            </p>
          )}
          <div className="platform-form-actions">
            <button
              className="platform-danger"
              disabled={busy}
              onClick={() => void decide("reject")}
            >
              Respinge
            </button>
            <button
              className="platform-secondary"
              disabled={busy}
              onClick={() => void decide("changes")}
            >
              Cere corectări
            </button>
            <button
              className="platform-primary"
              disabled={busy}
              onClick={() => void decide("approve")}
            >
              Aprobă și publică
            </button>
          </div>
        </>
      )}
    </section>
  );
}
function Categories({
  config,
  onSaved,
}: {
  config: CategoryConfig[];
  onSaved: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<CategoryConfig | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    id: "",
    name: "",
    nameEn: "",
    color: "#0f5a52",
    kind: "location",
    active: true,
    order: config.length,
  });
  function edit(c: CategoryConfig | null) {
    setSelected(c);
    setCreating(true);
    setForm(
      c
        ? {
            id: c.id,
            name: c.name,
            nameEn: c.nameEn,
            color: c.color,
            kind: c.kind,
            active: c.active,
            order: c.order,
          }
        : {
            id: "",
            name: "",
            nameEn: "",
            color: "#0f5a52",
            kind: "location",
            active: true,
            order: config.length,
          },
    );
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("categories", form);
      await onSaved();
      setCreating(false);
      setMessage("Categoria a fost salvată.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  return (
    <section className="platform-panel">
      <div className="platform-row">
        <h2>Categorii</h2>
        <button className="platform-primary" onClick={() => edit(null)}>
          + Categorie
        </button>
      </div>
      {message && (
        <p className="platform-notice" role="status">
          {message}
        </p>
      )}
      {creating ? (
        <form onSubmit={save}>
          <div className="platform-form-grid">
            <label>
              Denumire RO
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Denumire EN
              <input
                required
                value={form.nameEn}
                onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              />
            </label>
            <label>
              Identificator (litere mici)
              <input
                required
                pattern="[a-z][a-z0-9_-]*"
                disabled={!!selected}
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
              />
            </label>
            <label>
              Tip
              <select
                value={form.kind}
                disabled={!!selected}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
              >
                <option value="location">Locație</option>
                <option value="experience">Experiență</option>
              </select>
            </label>
            <label>
              Culoare
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </label>
            <label>
              Ordine
              <input
                type="number"
                min={0}
                value={form.order}
                onChange={(e) =>
                  setForm({ ...form, order: Number(e.target.value) })
                }
              />
            </label>
            <label className="platform-checkbox">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Activă pe site
            </label>
          </div>
          <p>
            Dezactivarea categoriei ascunde și fișele sale de pe hartă. Datele
            se păstrează.
          </p>
          <div className="platform-form-actions">
            <button
              type="button"
              className="platform-secondary"
              onClick={() => setCreating(false)}
            >
              Renunță
            </button>
            <button className="platform-primary">Salvează categoria</button>
          </div>
        </form>
      ) : (
        config.map((c) => (
          <article className="platform-item" key={c.id}>
            <div>
              <h3>
                <span style={{ color: c.color }}>●</span> {c.name}
              </h3>
              <p>
                {c.nameEn} ·{" "}
                {c.kind === "experience" ? "Experiențe" : "Locații"} ·{" "}
                {c.active ? "Activă" : "Arhivată"}
              </p>
            </div>
            <button className="platform-secondary" onClick={() => edit(c)}>
              Editează
            </button>
          </article>
        ))
      )}
    </section>
  );
}
function Team({
  data,
  onSaved,
}: {
  data: DashboardData;
  onSaved: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("invitations", { email, role });
      setEmail("");
      setMessage(
        "Invitația va fi trimisă prin email. Este valabilă 48 de ore.",
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    if (!window.confirm("Revoci accesul administrativ al acestui utilizator?"))
      return;
    try {
      await api(`revoke/${id}`, {});
      await onSaved();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  return (
    <section className="platform-panel">
      <h2>Echipă și invitații</h2>
      <p>
        Invitația se acceptă de pe un cont cu email confirmat. Nu poți revoca
        administratorii principali de aici.
      </p>
      <form onSubmit={invite} className="platform-invite-form">
        <label>
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Rol
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="admin">Administrator</option>
            <option value="moderator">Moderator</option>
          </select>
        </label>
        <button className="platform-primary" disabled={busy}>
          Trimite invitația
        </button>
      </form>
      {message && (
        <p className="platform-notice" role="status">
          {message}
        </p>
      )}
      {data.team
        .filter((person) => person.role !== "user")
        .map((person) => (
          <article className="platform-item" key={person.id}>
            <div>
              <h3>{person.name}</h3>
              <p>
                {person.email} ·{" "}
                {
                  {
                    owner: "Administrator principal",
                    admin: "Administrator",
                    moderator: "Moderator",
                  }[person.role]
                }
              </p>
            </div>
            {person.role !== "owner" && (
              <button
                className="platform-danger"
                onClick={() => void revoke(person.id)}
              >
                Revocă accesul
              </button>
            )}
          </article>
        ))}
    </section>
  );
}
