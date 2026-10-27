"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shapes,
  Upload,
  ImageIcon,
  X,
  Pencil,
  Copy,
  Archive,
  RotateCcw,
  Save,
  ArrowLeft,
  SlidersHorizontal,
} from "lucide-react";
import { categoryIcons } from "@/components/explore/icons";
import { api } from "@/components/platform/api";
import type { CategoryConfig } from "@/components/platform/types";
import type { AdminData } from "./types";
import { latestItems } from "@/modules/catalog/admin-utils";
import {
  AddLink,
  Badge,
  ConfirmDialog,
  DataTable,
  Notice,
  PageTitle,
} from "./shared";
export function CategoryIcon({
  category,
  size = 22,
}: {
  category: CategoryConfig;
  size?: number;
}) {
  const Icon = categoryIcons[category.id] ?? Shapes;
  return (
    <span
      className="ad-category-icon"
      style={{ color: category.color, background: `${category.color}12` }}
    >
      {category.iconAssetId ? (
        <img
          src={`/api/media/${category.iconAssetId}`}
          alt=""
          width={size}
          height={size}
        />
      ) : (
        <Icon size={size} />
      )}
    </span>
  );
}
export function CategoriesPage({
  data,
  saved = "",
}: {
  data: AdminData;
  saved?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [confirm, setConfirm] = useState<CategoryConfig | null>(null);
  const [message, setMessage] = useState(
    saved ? `Categoria „${saved}” a fost salvată.` : "",
  );
  const all = latestItems(data);
  const rows = data.config.filter(
    (c) => !status || (status === "active" ? c.active : !c.active),
  );
  return (
    <>
      <PageTitle
        eyebrow="CONȚINUT"
        title="Categorii"
        description="Organizează conținutul hărții, personalizează iconițele și configurează formularele."
        action={
          <AddLink href="/admin/categories/add">Adaugă categorie</AddLink>
        }
      />
      <div className="ad-summary-strip">
        <span>
          <b>{data.config.length}</b> categorii în total
        </span>
        <span>
          <i className="ad-live-dot" />
          <b>{data.config.filter((c) => c.active).length}</b> active pe site
        </span>
        <span>
          <b>{data.config.filter((c) => !c.active).length}</b> arhivate
        </span>
      </div>
      <Notice message={message} />
      <DataTable
        rows={rows}
        rowKey={(c) => c.id}
        searchText={(c) => `${c.name} ${c.nameEn} ${c.description ?? ""}`}
        searchPlaceholder="Caută o categorie…"
        exportName="categorii"
        filters={
          <select
            aria-label="Starea categoriilor"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Toate stările</option>
            <option value="active">Active</option>
            <option value="archived">Arhivate</option>
          </select>
        }
        columns={[
          {
            id: "name",
            label: "Categorie",
            sort: (c) => c.name,
            render: (c) => (
              <Link
                href={`/admin/categories/${c.id}/edit`}
                className="ad-cell-with-icon"
              >
                <CategoryIcon category={c} />
                <span>
                  <strong>{c.name}</strong>
                  <small>{c.nameEn}</small>
                </span>
              </Link>
            ),
          },
          {
            id: "kind",
            label: "Tip de conținut",
            sort: (c) => c.kind,
            render: (c) => (c.kind === "experience" ? "Experiențe" : "Locații"),
          },
          {
            id: "content",
            label: "Fișe",
            sort: (c) =>
              all.filter((i) => i.revision.categoryId === c.id).length,
            render: (c) => (
              <Link
                className="ad-text-link"
                href={`/admin/${c.kind === "experience" ? "experiences" : "locations"}?category=${c.id}`}
              >
                {all.filter((i) => i.revision.categoryId === c.id).length} fișe
              </Link>
            ),
          },
          {
            id: "form",
            label: "Formular",
            render: (c) => (
              <Link className="ad-text-link" href={`/admin/forms/${c.id}`}>
                <SlidersHorizontal size={14} />
                {c.template.fields.length} câmpuri · v{c.template.version}
              </Link>
            ),
          },
          {
            id: "order",
            label: "Ordine",
            sort: (c) => c.order,
            render: (c) => c.order + 1,
          },
          {
            id: "status",
            label: "Stare",
            sort: (c) => (c.active ? "Activă" : "Arhivată"),
            render: (c) => (
              <Badge value={c.active ? "active" : "archived"}>
                {c.active ? "Activă" : "Arhivată"}
              </Badge>
            ),
          },
          {
            id: "actions",
            label: "Acțiuni",
            className: "ad-actions-column",
            render: (c) => (
              <div className="ad-row-actions">
                <Link
                  className="ad-icon-button"
                  href={`/admin/categories/${c.id}/edit`}
                  aria-label={`Editează ${c.name}`}
                  title="Editează"
                >
                  <Pencil size={16} />
                </Link>
                <Link
                  className="ad-icon-button"
                  href={`/admin/categories/add?copy=${c.id}`}
                  aria-label={`Duplică ${c.name}`}
                  title="Duplică"
                >
                  <Copy size={16} />
                </Link>
                <button
                  className="ad-icon-button"
                  onClick={() => setConfirm(c)}
                  aria-label={`${c.active ? "Arhivează" : "Reactivează"} ${c.name}`}
                  title={c.active ? "Arhivează" : "Reactivează"}
                >
                  {c.active ? <Archive size={16} /> : <RotateCcw size={16} />}
                </button>
              </div>
            ),
          },
        ]}
      />
      {confirm && (
        <ConfirmDialog
          title={`${confirm.active ? "Arhivezi" : "Reactivezi"} categoria „${confirm.name}”?`}
          description={
            confirm.active
              ? `Categoria și cele ${all.filter((i) => i.revision.categoryId === confirm.id && i.listing.status === "published").length} fișe publicate vor fi ascunse de pe hartă. Datele se păstrează și poți reactiva categoria.`
              : "Categoria și fișele sale aprobate vor deveni din nou vizibile pe site."
          }
          confirmLabel={
            confirm.active ? "Arhivează categoria" : "Reactivează categoria"
          }
          danger={confirm.active}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await api("categories", {
              id: confirm.id,
              name: confirm.name,
              nameEn: confirm.nameEn,
              color: confirm.color,
              kind: confirm.kind,
              active: !confirm.active,
              order: confirm.order,
              description: confirm.description ?? "",
              iconAssetId: confirm.iconAssetId ?? null,
            });
            setMessage("Starea categoriei a fost actualizată.");
            router.refresh();
          }}
        />
      )}
    </>
  );
}
const slug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
export function CategoryForm({
  data,
  category,
  copy,
}: {
  data: AdminData;
  category?: CategoryConfig;
  copy?: CategoryConfig;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const source = category ?? copy;
  const [form, setForm] = useState({
    id: category?.id ?? "",
    name: category?.name ?? (copy ? `${copy.name} (copie)` : ""),
    nameEn: category?.nameEn ?? copy?.nameEn ?? "",
    description: source?.description ?? "",
    kind: source?.kind ?? "location",
    color: source?.color ?? "#0f5a52",
    active: category?.active ?? true,
    order: category?.order ?? data.config.length,
    iconAssetId: source?.iconAssetId ?? (null as string | null),
    sourceCategoryId:
      copy?.id ??
      data.config.find((c) => c.active && c.kind === "location")?.id ??
      "",
  });
  const [customSlug, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      if (file.size > 2 * 1024 * 1024)
        throw new Error("Iconița trebuie să aibă maximum 2 MB.");
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(
        "/api/platform/upload?purpose=category-icon",
        { method: "POST", body },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setForm((f) => ({ ...f, iconAssetId: result.id }));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const id = category?.id || form.id || slug(form.name);
      if (!id) throw new Error("Completează denumirea categoriei.");
      await api("categories", {
        ...form,
        id,
        create: !category,
        sourceCategoryId: form.sourceCategoryId || undefined,
      });
      router.push(
        category
          ? `/admin/categories?saved=${encodeURIComponent(form.name)}`
          : `/admin/forms/${id}?created=1`,
      );
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="CONȚINUT / CATEGORII"
        title={category ? `Editează · ${category.name}` : "Adaugă o categorie"}
        description={
          category
            ? "Actualizează identitatea categoriei și modul în care apare pe hartă."
            : "Definește categoria și alege formularul de la care pornești."
        }
        action={
          <Link href="/admin/categories" className="ad-button">
            <ArrowLeft size={15} />
            Înapoi la categorii
          </Link>
        }
      />
      <form onSubmit={save}>
        <Notice message={message} error />
        <div className="ad-edit-layout">
          <div>
            {!category && (
              <section className="ad-card ad-form-card">
                <div className="ad-card-heading">
                  <div>
                    <h2>Formularul categoriei</h2>
                    <p>
                      Alege un formular existent, apoi adaptează-l pentru noua
                      categorie.
                    </p>
                  </div>
                  <SlidersHorizontal size={20} />
                </div>
                <label>
                  Pornește de la formularul
                  <select
                    value={form.sourceCategoryId}
                    onChange={(e) =>
                      setForm({ ...form, sourceCategoryId: e.target.value })
                    }
                  >
                    {[
                      { kind: "location", label: "Locații" },
                      { kind: "experience", label: "Experiențe" },
                    ].map((group) => (
                      <optgroup key={group.kind} label={group.label}>
                        {data.config
                          .filter((c) => c.kind === group.kind)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} · {c.template.fields.length} câmpuri
                              {!c.active ? " · arhivat" : ""}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                    <option value="">Formular standard</option>
                  </select>
                  <small>
                    Se creează o copie separată. Modificările tale nu afectează
                    formularul original.
                  </small>
                </label>
                <p>După creare vei putea edita câmpurile noului formular.</p>
              </section>
            )}
            <section className="ad-card ad-form-card">
              <div className="ad-card-heading">
                <div>
                  <h2>Informații generale</h2>
                  <p>
                    Denumirile sunt afișate pe site în limba aleasă de
                    vizitator.
                  </p>
                </div>
                <Shapes size={20} />
              </div>
              <div className="ad-form-grid">
                <label>
                  Denumire în română *
                  <input
                    required
                    maxLength={80}
                    placeholder="De exemplu: Ateliere meșteșugărești"
                    value={form.name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        name: e.target.value,
                        ...(!category && !customSlug
                          ? { id: slug(e.target.value) }
                          : {}),
                      })
                    }
                  />
                </label>
                <label>
                  Denumire în engleză *
                  <input
                    required
                    maxLength={80}
                    placeholder="For example: Craft workshops"
                    value={form.nameEn}
                    onChange={(e) =>
                      setForm({ ...form, nameEn: e.target.value })
                    }
                  />
                </label>
                <label className="ad-span-2">
                  Descriere
                  <textarea
                    maxLength={1000}
                    placeholder="O explicație scurtă pentru echipă despre ce include această categorie…"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </label>
                <label>
                  Tip de conținut
                  <select
                    value={form.kind}
                    disabled={!!category}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        kind: e.target.value,
                      })
                    }
                  >
                    <option value="location">Locații</option>
                    <option value="experience">Experiențe</option>
                  </select>
                  <small>
                    {category
                      ? "Tipul este păstrat pentru a proteja fișele existente."
                      : "Stabilește dacă această categorie reprezintă locuri sau activități."}
                  </small>
                </label>
                <label>
                  Poziție în listă
                  <input
                    type="number"
                    min={1}
                    max={1001}
                    value={form.order + 1}
                    onChange={(e) =>
                      setForm({ ...form, order: Number(e.target.value) - 1 })
                    }
                  />
                </label>
              </div>
            </section>
            <section className="ad-card ad-form-card">
              <div className="ad-card-heading">
                <div>
                  <h2>Iconiță și culoare</h2>
                  <p>
                    Identitatea vizuală folosită în filtre, carduri și pe hartă.
                  </p>
                </div>
                <ImageIcon size={20} />
              </div>
              <div className="ad-icon-editor">
                <div
                  className="ad-upload-zone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void upload(e.dataTransfer.files[0]);
                  }}
                >
                  <div
                    className="ad-upload-preview"
                    style={{ background: `${form.color}12`, color: form.color }}
                  >
                    {form.iconAssetId ? (
                      <img
                        src={`/api/media/${form.iconAssetId}`}
                        alt="Previzualizare iconiță"
                      />
                    ) : (
                      <Shapes size={34} />
                    )}
                  </div>
                  <strong>
                    {uploading
                      ? "Se încarcă iconița…"
                      : "Încarcă iconița categoriei"}
                  </strong>
                  <p>Trage imaginea aici sau alege un fișier.</p>
                  <small>
                    PNG, WebP sau JPEG · maximum 2 MB
                    <br />
                    Recomandat: 256 × 256 px, fundal transparent.
                  </small>
                  <input
                    ref={input}
                    type="file"
                    accept="image/png,image/webp,image/jpeg"
                    hidden
                    aria-label="Fișier iconiță categorie"
                    onChange={(e) => void upload(e.target.files?.[0])}
                  />
                  <div>
                    <button
                      type="button"
                      className="ad-button ad-button-small"
                      disabled={uploading}
                      onClick={() => input.current?.click()}
                    >
                      <Upload size={14} />
                      {form.iconAssetId
                        ? "Înlocuiește iconița"
                        : "Alege fișier"}
                    </button>
                    {form.iconAssetId && (
                      <button
                        type="button"
                        className="ad-icon-button"
                        aria-label="Elimină iconița"
                        onClick={() => setForm({ ...form, iconAssetId: null })}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label>
                    Culoarea categoriei
                    <div className="ad-color-input">
                      <input
                        type="color"
                        value={form.color}
                        onChange={(e) =>
                          setForm({ ...form, color: e.target.value })
                        }
                      />
                      <input
                        value={form.color}
                        pattern="#[0-9a-fA-F]{6}"
                        onChange={(e) =>
                          setForm({ ...form, color: e.target.value })
                        }
                        aria-label="Cod culoare"
                      />
                    </div>
                  </label>
                  <div className="ad-color-swatches">
                    {[
                      "#0f5a52",
                      "#944236",
                      "#b06a4a",
                      "#4d9f96",
                      "#17332d",
                      "#7b6aa0",
                      "#c0705f",
                      "#bc933e",
                    ].map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Culoare ${color}`}
                        className={form.color === color ? "selected" : ""}
                        style={{ background: color }}
                        onClick={() => setForm({ ...form, color })}
                      />
                    ))}
                  </div>
                  <small>
                    Alege o culoare distinctă, ușor de recunoscut pe hartă.
                  </small>
                </div>
              </div>
            </section>
          </div>
          <aside>
            <section className="ad-card ad-form-card">
              <h2>Publicare</h2>
              <div className="ad-toggle-row">
                <div>
                  <strong>Categorie activă</strong>
                  <small>Vizibilă în filtrele site-ului.</small>
                </div>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Categorie activă"
                  checked={form.active}
                  onChange={(e) =>
                    setForm({ ...form, active: e.target.checked })
                  }
                />
              </div>
              <p>
                Arhivarea ascunde categoria și fișele sale, fără să elimine
                datele.
              </p>
              <div className="ad-category-preview">
                <small>PREVIZUALIZARE</small>
                <span style={{ color: form.color }}>
                  {form.iconAssetId ? (
                    <img src={`/api/media/${form.iconAssetId}`} alt="" />
                  ) : (
                    <Shapes size={17} />
                  )}
                  <strong>{form.name || "Numele categoriei"}</strong>
                </span>
              </div>
            </section>
            {category && (
              <section className="ad-card ad-form-card">
                <h2>Formularul categoriei</h2>
                <p>
                  {category.template.fields.length} câmpuri configurate ·
                  versiunea {category.template.version}
                </p>
                <Link
                  href={`/admin/forms/${category.id}`}
                  className="ad-button ad-full-width"
                >
                  <SlidersHorizontal size={16} />
                  Editează formularul
                </Link>
              </section>
            )}
            <details className="ad-card ad-form-card">
              <summary>Setări avansate</summary>
              <label>
                Identificator
                <input
                  disabled={!!category}
                  pattern="[a-z][a-z0-9_-]*"
                  value={form.id || slug(form.name)}
                  onChange={(e) => {
                    setCustom(true);
                    setForm({ ...form, id: e.target.value });
                  }}
                />
                <small>
                  Generat automat din denumire; rămâne stabil după creare.
                </small>
              </label>
            </details>
          </aside>
        </div>
        <div className="ad-sticky-actions">
          <Link href="/admin/categories" className="ad-button">
            Renunță
          </Link>
          <button
            className="ad-button ad-button-primary"
            disabled={busy || uploading}
          >
            <Save size={16} />
            {busy
              ? "Se salvează…"
              : category
                ? "Salvează modificările"
                : "Creează și editează formularul"}
          </button>
        </div>
      </form>
    </>
  );
}
