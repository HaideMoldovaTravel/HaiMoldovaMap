"use client";
/* eslint-disable @next/next/no-img-element */
import { useState, type ReactNode } from "react";
import { X, UploadCloud } from "lucide-react";
import type { ContentValues } from "@/modules/catalog/schema";
import { validateValues } from "@/modules/catalog/schema";
import {
  simpleExperienceFields,
  validateSimpleExperience,
} from "@/modules/catalog/simple-experience";
import type { CategoryConfig, Item } from "./types";
import { LocationPicker } from "./location-picker";
import { api } from "./api";

export function SimpleExperienceForm({
  category,
  item,
  onClose,
  onSaved,
  onCompleted,
}: {
  category: CategoryConfig;
  item?: Item;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onCompleted?: (
    result: { listingId: string; revisionId: string },
    submitted: boolean,
  ) => void;
}) {
  const [values, setValues] = useState<ContentValues>(() => ({
    currency: "MDL",
    price_unit: "persoană",
    ...Object.fromEntries(
      Object.entries(item?.revision.values ?? {}).filter(([key]) =>
        category.template.fields.some((f) => f.id === key),
      ),
    ),
  }));
  const [ids, setIds] = useState({
    listingId: item?.listing.id,
    baseRevisionId: item?.revision.id,
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const set = (key: string, value: ContentValues[string]) =>
    setValues((old) => ({ ...old, [key]: value }));
  const photos = Array.isArray(values.gallery) ? values.gallery : [];
  const fields = simpleExperienceFields(category.template.fields);

  async function save(submit: boolean) {
    setBusy(true);
    setMessage("");
    try {
      // Validate before saving so a failed submission keeps the form and uploads open.
      const input = {
        ...values,
        price_mode: values.price === 0 ? "Gratuit" : "Fix",
      };
      validateValues(fields, input, submit);
      validateSimpleExperience(input, submit);
      const result = await api<{ listingId: string; revisionId: string }>(
        "listings",
        {
          ...ids,
          formMode: "simple",
          categoryId: category.id,
          templateId: category.template.id,
          parentLocationId: item?.revision.parentLocationId ?? null,
          values: input,
        },
      );
      setIds({
        listingId: result.listingId,
        baseRevisionId: result.revisionId,
      });
      if (submit) await api(`submit/${result.revisionId}`, {});
      await onSaved();
      if (onCompleted) onCompleted(result, submit);
      else onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Salvarea a eșuat.");
    } finally {
      setBusy(false);
    }
  }
  async function upload(files: FileList | null) {
    if (!files?.length || uploading) return;
    setUploading(true);
    setMessage("");
    const next = [...photos];
    try {
      if (next.length + files.length > 5)
        throw new Error("Poți adăuga maximum 5 fotografii.");
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/platform/upload", {
          method: "POST",
          body: form,
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error ?? "Încărcarea a eșuat.");
        next.push(result.id);
        set("gallery", [...next]);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Încărcarea a eșuat.",
      );
    } finally {
      setUploading(false);
    }
  }
  const input = (key: string, label: string, type = "text") => (
    <label>
      {label}
      <input
        aria-label={label}
        type={type}
        value={String(values[key] ?? "")}
        maxLength={1000}
        min={type === "number" ? (key === "price" ? 0 : 1) : undefined}
        step={type === "number" ? (key === "price" ? "0.01" : "1") : undefined}
        onChange={(e) =>
          set(
            key,
            e.target.value === ""
              ? ""
              : type === "number"
                ? Number(e.target.value)
                : e.target.value,
          )
        }
      />
    </label>
  );
  const section = (number: number, title: string, children: ReactNode) => (
    <section className="simple-experience-section">
      <h3>
        <span>{number}</span>
        {title}
      </h3>
      {children}
    </section>
  );
  return (
    <section className="platform-panel simple-experience-form">
      <div className="platform-row">
        <h2>{item ? "Editează experiența" : "Adaugă o experiență"}</h2>
        <button
          className="platform-secondary"
          onClick={onClose}
          disabled={busy || uploading}
        >
          Închide
        </button>
      </div>
      <p>
        Completează cele 8 puncte. Echipa verifică propunerea înainte de
        publicare.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(true);
        }}
      >
        <fieldset disabled={busy || uploading}>
          {section(
            1,
            "Denumire experiență",
            input("name", "Denumirea experienței"),
          )}
          {section(
            2,
            "Descriere",
            <label>
              Ce vor face participanții?
              <textarea
                value={String(values.description ?? "")}
                maxLength={20000}
                onChange={(e) => set("description", e.target.value)}
              />
            </label>,
          )}
          {section(
            3,
            "Număr de persoane",
            <div className="platform-form-grid">
              {input("min_people", "Minimum persoane", "number")}
              {input("max_people", "Maximum persoane", "number")}
            </div>,
          )}
          {section(
            4,
            "Locația",
            <>
              {input("village", "Localitate și adresă")}
              <LocationPicker
                compact
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
                  setValues((old) => ({
                    ...old,
                    latitude: Number(lat.toFixed(6)),
                    longitude: Number(lng.toFixed(6)),
                    ...(address ? { village: address } : {}),
                  }))
                }
              />
              <small role="status">
                {typeof values.latitude === "number" &&
                typeof values.longitude === "number"
                  ? "Poziția pe hartă este selectată."
                  : "Alege poziția exactă pe hartă."}
              </small>
            </>,
          )}
          {section(
            5,
            "Cost",
            <>
              <div className="platform-form-grid">
                {input("price", "Cost", "number")}
                <label>
                  Monedă
                  <select
                    value={String(values.currency ?? "MDL")}
                    onChange={(e) => set("currency", e.target.value)}
                  >
                    {["MDL", "EUR", "USD"].map((currency) => (
                      <option key={currency}>{currency}</option>
                    ))}
                  </select>
                </label>
              </div>
              <small>
                Preț per persoană. Introdu 0 pentru o experiență gratuită.
              </small>
            </>,
          )}
          {section(
            6,
            "Program de lucru",
            input(
              "hours",
              "Program de lucru (de exemplu, Luni–Vineri 09:00–18:00)",
            ),
          )}
          {section(
            7,
            "Număr de contact",
            input("phone", "Număr de contact, cu prefixul țării", "tel"),
          )}
          {section(
            8,
            "Fotografii (4–5)",
            <>
              <label className="simple-photo-upload">
                <UploadCloud size={24} />
                {uploading ? "Se încarcă…" : "Alege fotografii"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={busy || uploading || photos.length >= 5}
                  onChange={(e) => {
                    void upload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <small>
                {photos.length} din 5 fotografii · minimum 4 · JPEG, PNG sau
                WebP, maximum 10 MB fiecare.
              </small>
              <div className="platform-gallery">
                {photos.map((id, index) => (
                  <div key={id}>
                    <img
                      src={`/api/media/${id}`}
                      alt={`Fotografia ${index + 1}`}
                    />
                    <button
                      type="button"
                      aria-label={`Elimină fotografia ${index + 1}`}
                      onClick={() =>
                        set(
                          "gallery",
                          photos.filter((value) => value !== id),
                        )
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </>,
          )}
        </fieldset>
        {message && (
          <p className="platform-notice" role="alert">
            {message}
          </p>
        )}
        <div className="platform-form-actions">
          <button
            type="button"
            className="platform-secondary"
            disabled={busy || uploading}
            onClick={() => void save(false)}
          >
            Salvează ciorna
          </button>
          <button className="platform-primary" disabled={busy || uploading}>
            {busy ? "Se salvează…" : "Trimite spre verificare"}
          </button>
        </div>
      </form>
    </section>
  );
}
