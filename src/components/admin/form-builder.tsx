"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Eye,
  Save,
  ArrowLeft,
  Type,
  AlignLeft,
  Phone,
  Mail,
  Link2,
  Hash,
  ToggleLeft,
  ListFilter,
  ListChecks,
  Coins,
  Images,
  LockKeyhole,
  Trash2,
  Copy,
  X,
  ChevronRight,
} from "lucide-react";
import type { ContentField } from "@/modules/catalog/schema";
import type { CategoryConfig } from "@/components/platform/types";
import { api } from "@/components/platform/api";
import { Notice, ConfirmDialog, PageTitle } from "./shared";
export const fieldNames: Record<ContentField["type"], string> = {
  text: "Text scurt",
  textarea: "Text lung",
  phone: "Telefon",
  email: "Email",
  url: "Link",
  number: "Număr",
  boolean: "Da / Nu",
  select: "O singură alegere",
  multiselect: "Alegeri multiple",
  price: "Preț",
  gallery: "Galerie foto",
};
const fieldIcons = {
  text: Type,
  textarea: AlignLeft,
  phone: Phone,
  email: Mail,
  url: Link2,
  number: Hash,
  boolean: ToggleLeft,
  select: ListFilter,
  multiselect: ListChecks,
  price: Coins,
  gallery: Images,
};
const groups = {
  all: "Toate câmpurile",
  presentation: "Prezentare",
  location: "Poziție pe hartă",
  media: "Fotografii",
  contacts: "Contacte și rezervări",
  details: "Detalii și facilități",
};
const core = new Set([
  "name",
  "description",
  "village",
  "region",
  "latitude",
  "longitude",
]);
function SortRow({
  field,
  selected,
  onSelect,
}: {
  field: ContentField;
  selected: boolean;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });
  const Icon = fieldIcons[field.type];
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : 1,
      }}
      className={`ad-sort-row ${selected ? "selected" : ""}`}
      data-field-id={field.id}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="ad-drag-handle"
        aria-label={`Mută ${field.label}`}
      >
        <GripVertical size={17} />
      </button>
      <button className="ad-sort-select" onClick={onSelect}>
        <span className="ad-field-icon">
          <Icon size={17} />
        </span>
        <span>
          <strong>{field.label}</strong>
          <small>
            {fieldNames[field.type]}
            {field.required ? " · Obligatoriu" : ""}
          </small>
        </span>
        {!field.public && <LockKeyhole size={13} />}
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
export function FormBuilder({
  category,
  created = false,
}: {
  category: CategoryConfig;
  created?: boolean;
}) {
  const router = useRouter();
  const [fields, setFields] = useState(category.template.fields);
  const [selectedId, setSelected] = useState(fields[0]?.id);
  const [group, setGroup] = useState<keyof typeof groups>("all");
  const [palette, setPalette] = useState(false);
  const [preview, setPreview] = useState(false);
  const [activeId, setActive] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"delete" | "reset" | null>(null);
  const [message, setMessage] = useState(
    created
      ? "Categoria a fost creată. Acum poți personaliza formularul ei."
      : "",
  );
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [base, setBase] = useState({
    id: category.template.id,
    version: category.template.version,
    json: JSON.stringify(category.template.fields),
  });
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const dirty = JSON.stringify(fields) !== base.json;
  const field = fields.find((f) => f.id === selectedId);
  const existing = category.template.fields.some((f) => f.id === field?.id);
  const visible = fields.filter((f) => group === "all" || f.group === group);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function update(patch: Partial<ContentField>) {
    setFields((list) =>
      list.map((f) => (f.id === selectedId ? { ...f, ...patch } : f)),
    );
    setMessage("");
  }
  function add(type: ContentField["type"], copy?: ContentField) {
    const id = `field_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
    setFields((list) => [
      ...list,
      copy
        ? { ...copy, id, label: `${copy.label} (copie)`, required: false }
        : {
            id,
            label: fieldNames[type],
            labelEn: "",
            type,
            group: group === "all" ? "details" : group,
            required: false,
            public: true,
            help: "",
            options: ["select", "multiselect"].includes(type)
              ? ["Opțiunea 1", "Opțiunea 2"]
              : [],
          },
    ]);
    setSelected(id);
    setPalette(false);
    setPreview(false);
    setMessage("");
  }
  function dragEnd(event: DragEndEvent) {
    setActive(null);
    if (!event.over || event.active.id === event.over.id) return;
    setFields((list) => {
      const from = list.findIndex((f) => f.id === event.active.id);
      const to = list.findIndex((f) => f.id === event.over!.id);
      if (from < 0 || to < 0) return list;
      const reordered = arrayMove(list, from, to);
      // In the complete view, dropping into another section moves the field there too.
      // This keeps the rendered form consistent with the order shown in the builder.
      return group === "all"
        ? reordered.map((field) =>
            field.id === event.active.id
              ? { ...field, group: list[to].group }
              : field,
          )
        : reordered;
    });
  }
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const normalized = fields.map((f) => ({
        ...f,
        options: f.options.map((o) => o.trim()).filter(Boolean),
      }));
      const result = await api<{ id: string; version: number }>(
        `templates/${category.id}`,
        { baseTemplateId: base.id, fields: normalized },
      );
      setFields(normalized);
      setBase({
        id: result.id,
        version: result.version,
        json: JSON.stringify(normalized),
      });
      setError(false);
      setMessage(
        `Versiunea ${result.version} a fost publicată. Formularele noi folosesc acum această structură.`,
      );
      router.refresh();
    } catch (e) {
      setError(true);
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="CONȚINUT / FORMULARE"
        title={`Formular · ${category.name}`}
        description="Configurează informațiile cerute prestatorilor. Trage câmpurile de mâner pentru a le reordona."
        action={
          <>
            <Link className="ad-button" href="/admin/forms">
              <ArrowLeft size={15} />
              Toate formularele
            </Link>
            <button className="ad-button" onClick={() => setPreview(!preview)}>
              <Eye size={16} />
              {preview ? "Înapoi la editor" : "Previzualizare"}
            </button>
            <button
              className="ad-button ad-button-primary"
              disabled={busy || !dirty}
              onClick={() => void save()}
            >
              <Save size={16} />
              {busy ? "Se publică…" : "Publică modificările"}
            </button>
          </>
        }
      />
      <Notice message={message} error={error} />
      <div className="ad-builder-meta">
        <span className="ad-badge ad-badge-approved">
          Versiunea {base.version}
        </span>
        <span>{fields.length} câmpuri</span>
        <span>{fields.filter((f) => f.required).length} obligatorii</span>
        {dirty && (
          <span className="ad-unsaved">
            <i />
            Modificări nesalvate
          </span>
        )}
      </div>
      <div className="ad-builder">
        <aside className="ad-builder-sections">
          <h3>SECȚIUNI</h3>
          {Object.entries(groups).map(([key, label]) => (
            <button
              key={key}
              className={group === key ? "active" : ""}
              onClick={() => setGroup(key as keyof typeof groups)}
            >
              {label}
              <span>
                {key === "all"
                  ? fields.length
                  : fields.filter((f) => f.group === key).length}
              </span>
            </button>
          ))}
          <div className="ad-builder-help">
            <GripVertical size={20} />
            <strong>Tu alegi ordinea</strong>
            <p>
              Trage de mâner sau folosește Space și săgețile de pe tastatură.
            </p>
          </div>
        </aside>
        <section className="ad-builder-canvas">
          <div className="ad-card-heading">
            <div>
              <h2>{preview ? "Previzualizare formular" : groups[group]}</h2>
              <p>
                {preview
                  ? "Așa sunt organizate câmpurile pentru prestator."
                  : "Selectează un câmp pentru a-i modifica proprietățile."}
              </p>
            </div>
            {!preview && (
              <button
                className="ad-button ad-button-small"
                onClick={() => setPalette(true)}
              >
                <Plus size={15} />
                Adaugă câmp
              </button>
            )}
          </div>
          {preview ? (
            <div className="ad-form-preview">
              {visible.map((f) => (
                <label key={f.id}>
                  {f.label}
                  {f.required && " *"}
                  {!f.public && <span className="ad-badge">Intern</span>}
                  {f.type === "textarea" ? (
                    <textarea
                      placeholder={f.help || "Răspunsul prestatorului…"}
                      readOnly
                    />
                  ) : ["select", "multiselect", "boolean"].includes(f.type) ? (
                    <select aria-label={f.label}>
                      <option>Alege…</option>
                      {(f.type === "boolean" ? ["Da", "Nu"] : f.options).map(
                        (o) => (
                          <option key={o}>{o}</option>
                        ),
                      )}
                    </select>
                  ) : f.type === "gallery" ? (
                    <div className="ad-preview-upload">
                      <Images size={22} />
                      Încarcă fotografii
                    </div>
                  ) : (
                    <input
                      placeholder={f.help || fieldNames[f.type]}
                      readOnly
                    />
                  )}
                  {f.help && <small>{f.help}</small>}
                </label>
              ))}
            </div>
          ) : (
            <DndContext
              id={`builder-${category.id}`}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(e) => setActive(String(e.active.id))}
              onDragCancel={() => setActive(null)}
              onDragEnd={dragEnd}
            >
              <SortableContext
                items={visible.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="ad-sort-list">
                  {visible.map((f) => (
                    <SortRow
                      key={f.id}
                      field={f}
                      selected={selectedId === f.id}
                      onSelect={() => setSelected(f.id)}
                    />
                  ))}
                  {!visible.length && (
                    <div className="ad-empty">
                      <Plus size={25} />
                      <h3>Secțiune fără câmpuri</h3>
                      <p>Adaugă primul câmp în această secțiune.</p>
                    </div>
                  )}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activeId && (
                  <div className="ad-drag-overlay">
                    <GripVertical size={18} />
                    {fields.find((f) => f.id === activeId)?.label}
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </section>
        {!preview && field && (
          <aside className="ad-builder-inspector">
            <div className="ad-card-heading">
              <div>
                <h2>Proprietățile câmpului</h2>
                <p>{fieldNames[field.type]}</p>
              </div>
              <button
                className="ad-icon-button"
                title="Duplică acest câmp"
                aria-label="Duplică acest câmp"
                onClick={() => add(field.type, field)}
              >
                <Copy size={16} />
              </button>
            </div>
            <div className="ad-inspector-body">
              <label>
                Denumire în română
                <input
                  value={field.label}
                  onChange={(e) => update({ label: e.target.value })}
                  maxLength={100}
                />
              </label>
              <label>
                Denumire în engleză
                <input
                  value={field.labelEn}
                  onChange={(e) => update({ labelEn: e.target.value })}
                  maxLength={100}
                />
              </label>
              <label>
                Tip de informație
                <select
                  value={field.type}
                  disabled={existing}
                  onChange={(e) =>
                    update({
                      type: e.target.value as ContentField["type"],
                      options: ["select", "multiselect"].includes(
                        e.target.value,
                      )
                        ? ["Opțiunea 1"]
                        : [],
                    })
                  }
                >
                  {Object.entries(fieldNames).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                {existing && (
                  <small>
                    Tipul este păstrat pentru a proteja răspunsurile existente.
                    Pentru alt tip, adaugă un câmp nou.
                  </small>
                )}
              </label>
              <label>
                Secțiune
                <select
                  value={field.group}
                  onChange={(e) =>
                    update({ group: e.target.value as ContentField["group"] })
                  }
                >
                  {Object.entries(groups)
                    .filter(([key]) => key !== "all")
                    .map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Instrucțiuni pentru completare
                <textarea
                  value={field.help}
                  onChange={(e) => update({ help: e.target.value })}
                  placeholder="Un exemplu sau o explicație scurtă…"
                  maxLength={300}
                />
              </label>
              {["select", "multiselect"].includes(field.type) && (
                <label>
                  Opțiuni disponibile
                  <textarea
                    value={field.options.join("\n")}
                    onChange={(e) =>
                      update({ options: e.target.value.split("\n") })
                    }
                  />
                  <small>Câte o opțiune pe fiecare rând.</small>
                </label>
              )}
              <div className="ad-toggle-row">
                <div>
                  <strong>Obligatoriu</strong>
                  <small>Trebuie completat la trimitere.</small>
                </div>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Câmp obligatoriu"
                  checked={field.required}
                  disabled={core.has(field.id)}
                  onChange={(e) => update({ required: e.target.checked })}
                />
              </div>
              <div className="ad-toggle-row">
                <div>
                  <strong>Vizibil pe site</strong>
                  <small>
                    {field.public
                      ? "Apare după aprobarea fișei."
                      : "Accesibil doar în cont și admin."}
                  </small>
                </div>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Câmp vizibil pe site"
                  checked={field.public}
                  disabled={
                    core.has(field.id) ||
                    (existing &&
                      !category.template.fields.find((f) => f.id === field.id)
                        ?.public)
                  }
                  onChange={(e) => update({ public: e.target.checked })}
                />
              </div>
              {core.has(field.id) ? (
                <div className="ad-field-locked">
                  <LockKeyhole size={15} />
                  Câmp standard necesar funcționării hărții.
                </div>
              ) : (
                <button
                  className="ad-button ad-button-danger ad-full-width"
                  onClick={() => setConfirm("delete")}
                >
                  <Trash2 size={15} />
                  Elimină din formular
                </button>
              )}
            </div>
          </aside>
        )}
      </div>
      {dirty && (
        <div className="ad-save-bar">
          <div>
            <span className="ad-unsaved">
              <i />
              Ai modificări nesalvate
            </span>
            <small>Publică pentru a actualiza formularele de completare.</small>
          </div>
          <div>
            <button
              className="ad-button"
              disabled={busy}
              onClick={() => setConfirm("reset")}
            >
              Renunță la modificări
            </button>
            <button
              className="ad-button ad-button-primary"
              disabled={busy}
              onClick={() => void save()}
            >
              <Save size={15} />
              {busy ? "Se publică…" : "Publică modificările"}
            </button>
          </div>
        </div>
      )}
      {palette && (
        <div className="ad-palette-backdrop" onClick={() => setPalette(false)}>
          <section
            className="ad-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Alege tipul câmpului"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="ad-dialog-close"
              aria-label="Închide tipurile de câmp"
              onClick={() => setPalette(false)}
            >
              <X size={20} />
            </button>
            <h2>Ce informație vrei să adaugi?</h2>
            <p>
              Alege tipul. Denumirea și regulile se pot personaliza imediat.
            </p>
            <div>
              {Object.entries(fieldNames).map(([type, label]) => {
                const Icon = fieldIcons[type as ContentField["type"]];
                return (
                  <button
                    key={type}
                    onClick={() => add(type as ContentField["type"])}
                  >
                    <Icon size={21} />
                    <strong>{label}</strong>
                    <Plus size={15} />
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
      {confirm && (
        <ConfirmDialog
          title={
            confirm === "delete"
              ? "Elimini câmpul din formular?"
              : "Renunți la modificări?"
          }
          description={
            confirm === "delete"
              ? "Câmpul nu va mai apărea în formularele noi. Răspunsurile și versiunile istorice se păstrează."
              : "Formularul revine la ultima versiune publicată."
          }
          confirmLabel={
            confirm === "delete" ? "Elimină câmpul" : "Renunță la modificări"
          }
          danger
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            if (confirm === "delete") {
              setFields((list) => list.filter((f) => f.id !== selectedId));
              setSelected(fields.find((f) => f.id !== selectedId)?.id ?? "");
            } else {
              setFields(JSON.parse(base.json));
              setSelected(JSON.parse(base.json)[0]?.id);
            }
          }}
        />
      )}
    </>
  );
}
