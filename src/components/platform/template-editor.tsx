"use client";
import { useState } from "react";
import { fieldTypes, type ContentField } from "@/modules/catalog/schema";
import type { CategoryConfig } from "./types";
import { api } from "./api";
const typeLabels: Record<string, string> = {
  text: "Text scurt",
  textarea: "Descriere",
  phone: "Telefon",
  email: "Email",
  url: "Link",
  number: "Număr",
  boolean: "Da / Nu",
  select: "Alegere",
  multiselect: "Alegeri multiple",
  price: "Preț",
  gallery: "Galerie",
};
const core = [
  "name",
  "description",
  "village",
  "region",
  "latitude",
  "longitude",
];
export function TemplateEditor({
  category,
  onSaved,
}: {
  category: CategoryConfig;
  onSaved: () => Promise<void>;
}) {
  const [fields, setFields] = useState<ContentField[]>(
    category.template.fields,
  );
  const [selected, setSelected] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const field = fields[selected];
  const existing = category.template.fields.some((f) => f.id === field?.id);
  function update(patch: Partial<ContentField>) {
    setFields((list) =>
      list.map((f, i) => (i === selected ? { ...f, ...patch } : f)),
    );
  }
  function add() {
    setFields((list) => [
      ...list,
      {
        id: `field_${Date.now().toString(36)}`,
        label: "Câmp nou",
        labelEn: "",
        type: "text",
        group: "details",
        required: false,
        public: true,
        help: "",
        options: [],
      },
    ]);
    setSelected(fields.length);
  }
  function move(direction: number) {
    const destination = selected + direction;
    if (destination < 0 || destination >= fields.length) return;
    const next = [...fields];
    [next[selected], next[destination]] = [next[destination], next[selected]];
    setFields(next);
    setSelected(destination);
  }
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await api(`templates/${category.id}`, {
        baseTemplateId: category.template.id,
        fields,
      });
      setMessage(
        "Șablonul a fost publicat. Fișele aprobate păstrează versiunea lor; formularele noi folosesc aceste câmpuri.",
      );
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
        <div>
          <h2>Formular: {category.name}</h2>
          <p>
            Versiunea {category.template.version} · {fields.length} câmpuri
          </p>
        </div>
        <button className="platform-secondary" onClick={add}>
          + Adaugă câmp
        </button>
      </div>
      <p>
        Modifică etichetele, ordinea și regulile. Câmpurile eliminate rămân în
        istoricul fișelor existente.
      </p>
      <div className="platform-template-layout">
        <div className="platform-field-list">
          {fields.map((f, i) => (
            <button
              key={f.id}
              className={selected === i ? "active" : ""}
              onClick={() => setSelected(i)}
            >
              {f.label}
              <small>
                {typeLabels[f.type]}
                {!f.public ? " · intern" : ""}
              </small>
            </button>
          ))}
        </div>
        {field && (
          <div className="platform-field-settings">
            <label>
              Denumire
              <input
                value={field.label}
                onChange={(e) => update({ label: e.target.value })}
              />
            </label>
            <label>
              Denumire EN
              <input
                value={field.labelEn}
                onChange={(e) => update({ labelEn: e.target.value })}
              />
            </label>
            <label>
              Tipul câmpului
              <select
                value={field.type}
                disabled={existing}
                onChange={(e) =>
                  update({ type: e.target.value as ContentField["type"] })
                }
              >
                {fieldTypes.map((t) => (
                  <option key={t} value={t}>
                    {typeLabels[t]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Secțiune
              <select
                value={field.group}
                onChange={(e) =>
                  update({ group: e.target.value as ContentField["group"] })
                }
              >
                {Object.entries({
                  presentation: "Prezentare",
                  location: "Poziție",
                  media: "Fotografii",
                  contacts: "Contacte",
                  details: "Detalii",
                }).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Text de ajutor
              <textarea
                value={field.help}
                onChange={(e) => update({ help: e.target.value })}
              />
            </label>
            {["select", "multiselect"].includes(field.type) && (
              <label>
                Opțiuni, câte una pe linie
                <textarea
                  value={field.options.join("\n")}
                  onChange={(e) =>
                    update({ options: e.target.value.split("\n") })
                  }
                />
              </label>
            )}
            <label className="platform-checkbox">
              <input
                type="checkbox"
                checked={field.required}
                disabled={core.includes(field.id)}
                onChange={(e) => update({ required: e.target.checked })}
              />
              Obligatoriu la trimitere
            </label>
            <label className="platform-checkbox">
              <input
                type="checkbox"
                checked={field.public}
                disabled={
                  core.includes(field.id) ||
                  (existing &&
                    !category.template.fields.find((f) => f.id === field.id)
                      ?.public)
                }
                onChange={(e) => update({ public: e.target.checked })}
              />
              Vizibil public
            </label>
            <div className="platform-row">
              <button className="platform-secondary" onClick={() => move(-1)}>
                ↑ Mai sus
              </button>
              <button className="platform-secondary" onClick={() => move(1)}>
                ↓ Mai jos
              </button>
              {!core.includes(field.id) && (
                <button
                  className="platform-danger"
                  onClick={() => {
                    setFields((list) => list.filter((_, i) => i !== selected));
                    setSelected(0);
                  }}
                >
                  Elimină din formular
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {message && (
        <div className="platform-notice" role="status">
          {message}
        </div>
      )}
      <button
        className="platform-primary"
        disabled={busy}
        onClick={() => void save()}
      >
        {busy ? "Se publică…" : "Publică versiunea formularului"}
      </button>
    </section>
  );
}
