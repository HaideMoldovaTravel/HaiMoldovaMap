"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import {
  AlignLeft,
  MapPin,
  Images,
  Phone,
  ListChecks,
  ArrowDown,
  UploadCloud,
  X,
  Check,
  ShieldCheck,
} from "lucide-react";
import type { ContentValues } from "@/modules/catalog/schema";
import type { CategoryConfig, Item } from "./types";
import { api } from "./api";
import { LocationPicker } from "./location-picker";
const groups = {
  presentation: "Prezentare",
  location: "Poziția pe hartă",
  media: "Fotografii",
  contacts: "Contacte și rezervări",
  details: "Detalii",
};
const sectionDetails = {
  presentation: {
    icon: AlignLeft,
    description: "Prezintă locul sau experiența și ce o face specială.",
  },
  location: {
    icon: MapPin,
    description: "Alege punctul exact pe hartă și completează adresa.",
  },
  media: {
    icon: Images,
    description:
      "Adaugă fotografii clare, care îi ajută pe vizitatori să descopere locul.",
  },
  contacts: {
    icon: Phone,
    description:
      "Cum te pot contacta vizitatorii și unde pot face o rezervare.",
  },
  details: {
    icon: ListChecks,
    description:
      "Completează informațiile practice, facilitățile și prețurile.",
  },
};
export function ListingForm({
  config,
  item,
  locations,
  onClose,
  onSaved,
  adminMode = false,
  initialCategoryId,
  onCompleted,
}: {
  config: CategoryConfig[];
  item?: Item;
  locations: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  adminMode?: boolean;
  initialCategoryId?: string;
  onCompleted?: (
    result: { listingId: string; revisionId: string },
    submitted: boolean,
  ) => void;
}) {
  const [categoryId, setCategoryId] = useState(
    item?.revision.categoryId ??
      initialCategoryId ??
      config.find((c) => c.active)?.id ??
      "",
  );
  const category = config.find((c) => c.id === categoryId)!;
  const [values, setValues] = useState<ContentValues>(() =>
    Object.fromEntries(
      Object.entries(item?.revision.values ?? {}).filter(([key]) =>
        category.template.fields.some((f) => f.id === key),
      ),
    ),
  );
  const [parentLocationId, setParent] = useState(
    item?.revision.parentLocationId ?? "",
  );
  const [savedIds, setSavedIds] = useState({
    listingId: item?.listing.id,
    baseRevisionId: item?.revision.id,
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (key: string, value: ContentValues[string]) =>
    setValues((v) => ({ ...v, [key]: value }));
  async function save(submit: boolean, publish = false) {
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ listingId: string; revisionId: string }>(
        "listings",
        {
          ...savedIds,
          categoryId,
          templateId: category.template.id,
          parentLocationId: parentLocationId || null,
          values,
        },
      );
      setSavedIds({
        listingId: result.listingId,
        baseRevisionId: result.revisionId,
      });
      if (submit) await api(`submit/${result.revisionId}`, {});
      if (publish)
        await api(`moderate/${result.revisionId}`, {
          decision: "approve",
          feedback: "",
        });
      await onSaved();
      if (onCompleted) onCompleted(result, submit);
      else onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Salvarea a eșuat.");
      await onSaved();
    } finally {
      setBusy(false);
    }
  }
  async function upload(key: string, files: FileList | null) {
    if (!files) return;
    setUploading(true);
    setMessage("");
    const current = Array.isArray(values[key])
      ? [...(values[key] as string[])]
      : [];
    try {
      if (files.length + current.length > 10)
        throw new Error("Maximum 10 fotografii.");
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/platform/upload", {
          method: "POST",
          body: form,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        current.push(result.id);
        set(key, [...current]);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Încărcarea a eșuat.",
      );
    } finally {
      setUploading(false);
    }
  }
  if (!category) return <p>Nu există categorii active.</p>;
  const requiredFields = category.template.fields.filter(
    (field) => field.required,
  );
  const filledRequired = requiredFields.filter((field) => {
    const value = values[field.id];
    return Array.isArray(value)
      ? value.length > 0
      : typeof value === "string"
        ? value.trim().length > 0
        : value !== undefined && value !== null;
  }).length;
  return (
    <section
      className={`platform-panel listing-form ${adminMode ? "ad-listing-editor" : ""}`}
    >
      {!adminMode && (
        <div className="platform-row">
          <div>
            <p className="platform-eyebrow">CONȚINUTUL TĂU</p>
            <h2>
              {item ? "Editează propunerea" : "Adaugă o locație sau experiență"}
            </h2>
          </div>
          <button className="platform-secondary" onClick={onClose}>
            Închide
          </button>
        </div>
      )}
      <div className="listing-intro">
        <span className="listing-intro-icon">
          <ShieldCheck size={22} />
        </span>
        <div>
          <strong>
            {adminMode
              ? "Pregătește fișa pentru publicare"
              : "Povestește-ne despre locul tău"}
          </strong>
          <p>
            {adminMode
              ? "Completează informațiile, apoi salvează o ciornă sau publică pe hartă."
              : "Poți salva o ciornă oricând. Echipa verifică informațiile înainte să apară pe hartă."}
          </p>
        </div>
        <div className="listing-completion">
          <span>
            <strong>
              {filledRequired}/{requiredFields.length}
            </strong>{" "}
            câmpuri obligatorii
          </span>
          <progress
            max={requiredFields.length}
            value={filledRequired}
            aria-label="Câmpuri obligatorii completate"
          />
        </div>
      </div>
      <nav className="listing-section-nav" aria-label="Secțiunile formularului">
        {Object.entries(groups)
          .filter(([group]) =>
            category.template.fields.some((field) => field.group === group),
          )
          .map(([group, label]) => {
            const Icon = sectionDetails[group as keyof typeof groups].icon;
            return (
              <a key={group} href={`#listing-section-${group}`}>
                <Icon size={17} />
                {label}
                <ArrowDown size={13} />
              </a>
            );
          })}
      </nav>
      <form
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          void save(true);
        }}
      >
        <div className="listing-setup">
          <div className="listing-setup-heading">
            <span>01</span>
            <div>
              <h3>Încadrarea fișei</h3>
              <p>
                Alege categoria potrivită pentru informațiile pe care le adaugi.
              </p>
            </div>
          </div>
          <div className="listing-setup-grid">
            <label>
              Categorie
              <select
                value={categoryId}
                disabled={!!item && !adminMode}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  const target = config.find((c) => c.id === e.target.value);
                  setValues((current) =>
                    Object.fromEntries(
                      Object.entries(current).filter(([key]) =>
                        target?.template.fields.some((f) => f.id === key),
                      ),
                    ),
                  );
                  setParent("");
                }}
              >
                {config
                  .filter((c) => c.active || c.id === categoryId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ·{" "}
                      {c.kind === "experience" ? "Experiență" : "Locație"}
                    </option>
                  ))}
              </select>
            </label>
            {category.kind === "experience" && (
              <label>
                Locație asociată (opțional)
                <select
                  value={parentLocationId}
                  onChange={(e) => setParent(e.target.value)}
                >
                  <option value="">Experiență independentă</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
        {Object.entries(groups).map(([group, label]) => {
          const fields = category.template.fields.filter(
            (field) => field.group === group,
          );
          if (!fields.length) return null;
          const detail = sectionDetails[group as keyof typeof groups];
          const Icon = detail.icon;
          return (
            <section
              key={group}
              id={`listing-section-${group}`}
              className="listing-section"
              aria-labelledby={`listing-heading-${group}`}
            >
              <header className="listing-section-heading">
                <span className="listing-section-icon">
                  <Icon size={22} />
                </span>
                <div>
                  <h3 id={`listing-heading-${group}`}>{label}</h3>
                  <p>{detail.description}</p>
                </div>
                <span className="listing-section-count">
                  {fields.length} {fields.length === 1 ? "câmp" : "câmpuri"}
                </span>
              </header>
              <div className="listing-section-body">
                {group === "location" && (
                  <LocationPicker
                    latitude={
                      typeof values.latitude === "number"
                        ? values.latitude
                        : undefined
                    }
                    longitude={
                      typeof values.longitude === "number"
                        ? values.longitude
                        : undefined
                    }
                    onChange={(lat, lng, address) =>
                      setValues((v) => ({
                        ...v,
                        latitude: Number(lat.toFixed(6)),
                        longitude: Number(lng.toFixed(6)),
                        ...(address ? { village: address } : {}),
                      }))
                    }
                  />
                )}

                <div className="platform-form-grid">
                  {fields.map((field) => {
                    const value = values[field.id];
                    const controlProps = {
                      id: `field-${field.id}`,
                      "aria-required": field.required || undefined,
                      "aria-describedby":
                        field.help || !field.public
                          ? `field-help-${field.id}`
                          : undefined,
                    };
                    return (
                      <div
                        key={field.id}
                        className={`listing-field ${["textarea", "gallery", "multiselect"].includes(field.type) ? "platform-wide" : ""}`}
                      >
                        <label
                          id={`field-label-${field.id}`}
                          htmlFor={
                            field.type === "multiselect"
                              ? undefined
                              : `field-${field.id}`
                          }
                        >
                          <span className="listing-label-text">
                            {field.label}
                            {field.required && (
                              <span
                                className="platform-required"
                                aria-hidden="true"
                              >
                                &nbsp;*
                              </span>
                            )}
                          </span>
                          {!field.public && (
                            <span className="listing-private-label">
                              Interne
                            </span>
                          )}
                        </label>
                        {field.type === "textarea" ? (
                          <textarea
                            {...controlProps}
                            value={String(value ?? "")}
                            maxLength={20000}
                            onChange={(e) => set(field.id, e.target.value)}
                          />
                        ) : field.type === "boolean" ? (
                          <select
                            {...controlProps}
                            value={value === undefined ? "" : String(value)}
                            onChange={(e) => {
                              if (e.target.value === "")
                                setValues((v) => {
                                  const next = { ...v };
                                  delete next[field.id];
                                  return next;
                                });
                              else set(field.id, e.target.value === "true");
                            }}
                          >
                            <option value="">Nespecificat</option>
                            <option value="true">Da</option>
                            <option value="false">Nu</option>
                          </select>
                        ) : field.type === "select" ? (
                          <select
                            {...controlProps}
                            value={String(value ?? "")}
                            onChange={(e) => set(field.id, e.target.value)}
                          >
                            <option value="">Alege…</option>
                            {field.options.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                        ) : field.type === "multiselect" ? (
                          <div
                            className="platform-checks"
                            id={`field-${field.id}`}
                            role="group"
                            aria-labelledby={`field-label-${field.id}`}
                            aria-describedby={controlProps["aria-describedby"]}
                          >
                            {field.options.map((o) => (
                              <label key={o}>
                                <input
                                  type="checkbox"
                                  checked={
                                    Array.isArray(value) && value.includes(o)
                                  }
                                  onChange={(e) =>
                                    set(
                                      field.id,
                                      e.target.checked
                                        ? [
                                            ...(Array.isArray(value)
                                              ? value
                                              : []),
                                            o,
                                          ]
                                        : (Array.isArray(value)
                                            ? value
                                            : []
                                          ).filter((v) => v !== o),
                                    )
                                  }
                                />
                                {o}
                              </label>
                            ))}
                          </div>
                        ) : field.type === "gallery" ? (
                          <>
                            <div
                              className={`listing-upload-zone ${uploading ? "is-uploading" : ""}`}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                event.preventDefault();
                                if (!uploading)
                                  void upload(
                                    field.id,
                                    event.dataTransfer.files,
                                  );
                              }}
                            >
                              <span className="listing-upload-icon">
                                <UploadCloud size={28} />
                              </span>
                              <strong>
                                {uploading
                                  ? "Se încarcă fotografiile…"
                                  : "Trage fotografiile aici sau alege fișiere"}
                              </strong>
                              <span>
                                JPEG, PNG sau WebP · maximum 10 MB / fotografie
                              </span>
                              <span className="listing-upload-button">
                                Alege fotografii
                              </span>
                              <input
                                {...controlProps}
                                type="file"
                                className="listing-file-input"
                                aria-label={field.label}
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                disabled={uploading}
                                onChange={(e) =>
                                  void upload(field.id, e.target.files)
                                }
                              />
                            </div>
                            <small className="listing-photo-count">
                              {Array.isArray(value) ? value.length : 0} din 10
                              fotografii
                            </small>
                            <div className="platform-gallery">
                              {(Array.isArray(value) ? value : []).map(
                                (id, photoIndex) => (
                                  <div key={id}>
                                    <img
                                      src={
                                        id.startsWith(
                                          "https://images.unsplash.com/",
                                        )
                                          ? id
                                          : `/api/media/${id}`
                                      }
                                      alt="Fotografie încărcată"
                                    />
                                    <button
                                      type="button"
                                      aria-label={`Elimină fotografia ${photoIndex + 1}`}
                                      onClick={() =>
                                        set(
                                          field.id,
                                          (value as string[]).filter(
                                            (v) => v !== id,
                                          ),
                                        )
                                      }
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                ),
                              )}
                            </div>
                            {uploading && (
                              <small>
                                Se verifică și se optimizează fotografiile…
                              </small>
                            )}
                          </>
                        ) : (
                          <input
                            {...controlProps}
                            type={
                              field.type === "number" || field.type === "price"
                                ? "number"
                                : field.type === "phone"
                                  ? "tel"
                                  : field.type === "url"
                                    ? "url"
                                    : field.type === "email"
                                      ? "email"
                                      : "text"
                            }
                            step="any"
                            maxLength={field.type === "url" ? 2048 : 1000}
                            value={
                              typeof value === "boolean" || Array.isArray(value)
                                ? ""
                                : (value ?? "")
                            }
                            onChange={(e) =>
                              set(
                                field.id,
                                e.target.value === ""
                                  ? ""
                                  : field.type === "number" ||
                                      field.type === "price"
                                    ? Number(e.target.value)
                                    : e.target.value,
                              )
                            }
                          />
                        )}
                        {(field.help || !field.public) && (
                          <small
                            id={`field-help-${field.id}`}
                            className="listing-field-help"
                          >
                            {!field.public &&
                              "Vizibil doar în cont și în administrare. "}
                            {field.help}
                          </small>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
        <div className="listing-save-bar">
          {message && (
            <div className="platform-notice listing-save-error" role="alert">
              {message}
            </div>
          )}
          <div className="listing-save-hint">
            <Check size={18} />
            <span>
              {busy
                ? "Se salvează informațiile…"
                : "Poți salva o ciornă și reveni mai târziu."}
            </span>
          </div>
          <div className="platform-form-actions">
            {adminMode && (
              <button
                type="button"
                className="platform-primary"
                disabled={busy || uploading}
                onClick={() => void save(true, true)}
              >
                Salvează și publică
              </button>
            )}

            <button
              type="button"
              className="platform-secondary"
              disabled={busy || uploading}
              onClick={() => void save(false)}
            >
              Salvează ciorna
            </button>
            <button
              className={adminMode ? "platform-secondary" : "platform-primary"}
              disabled={busy || uploading}
            >
              {busy ? "Se salvează…" : "Trimite spre verificare"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
