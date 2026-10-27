"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  AlertTriangle,
  Download,
  Plus,
  Check,
} from "lucide-react";
export const roleLabels: Record<string, string> = {
  owner: "Administrator principal",
  admin: "Administrator",
  moderator: "Moderator",
  user: "Prestator",
};
export const statusLabels: Record<string, string> = {
  draft: "Ciornă",
  pending: "În verificare",
  approved: "Aprobată",
  changes: "Necesită corectări",
  rejected: "Respinsă",
  published: "Publicată",
  unpublished: "Nepublicată",
  suspended: "Retrasă",
  archived: "Arhivată",
  active: "Activ",
  expired: "Expirată",
  accepted: "Acceptată",
  revoked: "Anulată",
};
export function Badge({
  value,
  children,
}: {
  value: string;
  children?: ReactNode;
}) {
  return (
    <span className={`ad-badge ad-badge-${value}`}>
      <i />
      {children ?? statusLabels[value] ?? value}
    </span>
  );
}
export const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("ro-RO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
export const dateTime = (value: string) =>
  new Date(value).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export const bytes = (value: number) =>
  value >= 1048576
    ? `${(value / 1048576).toFixed(1)} MB`
    : `${Math.round(value / 1024)} KB`;
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="ad-page-title">
      <div>
        {eyebrow && <span className="ad-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="ad-title-actions">{action}</div>}
    </div>
  );
}
export function AddLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="ad-button ad-button-primary">
      <Plus size={16} />
      {children}
    </Link>
  );
}
export function Notice({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  return message ? (
    <div
      className={`ad-notice ${error ? "ad-notice-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {error ? <AlertTriangle size={17} /> : <Check size={17} />}
      <span>{message}</span>
    </div>
  ) : null;
}
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirmă",
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="ad-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="ad-dialog-icon">
        <AlertTriangle size={25} />
      </div>
      <button
        className="ad-dialog-close"
        aria-label="Închide confirmarea"
        disabled={busy}
        onClick={onClose}
      >
        <X size={20} />
      </button>
      <h2>{title}</h2>
      <p>{description}</p>
      <Notice message={error} error />
      <div className="ad-form-actions">
        <button className="ad-button" disabled={busy} onClick={onClose}>
          Renunță
        </button>
        <button
          className={`ad-button ${danger ? "ad-button-danger" : "ad-button-primary"}`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? "Se procesează…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
export type Column<T> = {
  id: string;
  label: string;
  render: (row: T) => ReactNode;
  sort?: (row: T) => string | number;
  className?: string;
};
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchText,
  searchPlaceholder = "Caută…",
  filters,
  emptyTitle = "Niciun rezultat",
  emptyDescription = "Modifică filtrele sau adaugă o înregistrare nouă.",
  initialQuery = "",
  exportName,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchText: (row: T) => string;
  searchPlaceholder?: string;
  filters?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  initialQuery?: string;
  exportName?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<{ key: string; direction: number } | null>(
    null,
  );
  const normalize = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  let filtered = rows.filter((row) =>
    normalize(searchText(row)).includes(normalize(query.trim())),
  );
  if (sort) {
    const column = columns.find((c) => c.id === sort.key);
    if (column?.sort)
      filtered = [...filtered].sort((a, b) => {
        const first = column.sort!(a),
          second = column.sort!(b);
        return (
          (typeof first === "number" && typeof second === "number"
            ? first - second
            : String(first).localeCompare(String(second), "ro")) *
          sort.direction
        );
      });
  }
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);
  function download() {
    const cols = columns.filter((c) => c.sort);
    const csv =
      "\uFEFF" +
      [
        cols.map((c) => c.label),
        ...filtered.map((row) => cols.map((c) => String(c.sort!(row)))),
      ]
        .map((line) =>
          line
            .map(
              (v) =>
                `"${String(v)
                  .replaceAll('"', '""')
                  .replace(/^[=+@-]/, "'$&")}"`,
            )
            .join(","),
        )
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exportName ?? "export"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="ad-table-card">
      <div className="ad-table-toolbar">
        <div className="ad-search">
          <Search size={17} />
          <input
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          {query && (
            <button aria-label="Șterge căutarea" onClick={() => setQuery("")}>
              <X size={14} />
            </button>
          )}
        </div>
        <div className="ad-table-filters">
          {filters}
          {exportName && (
            <button className="ad-button ad-button-small" onClick={download}>
              <Download size={15} />
              Export CSV
            </button>
          )}
        </div>
      </div>
      <div className="ad-table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.id} className={column.className}>
                  {column.sort ? (
                    <button
                      onClick={() => {
                        setSort({
                          key: column.id,
                          direction:
                            sort?.key === column.id ? -sort.direction : 1,
                        });
                        setPage(1);
                      }}
                    >
                      {column.label}
                      {sort?.key === column.id ? (
                        sort.direction === 1 ? (
                          <ArrowUp size={13} />
                        ) : (
                          <ArrowDown size={13} />
                        )
                      ) : (
                        <ArrowUpDown size={13} />
                      )}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.id} className={column.className}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="ad-empty">
            <Search size={28} />
            <h3>{emptyTitle}</h3>
            <p>{emptyDescription}</p>
          </div>
        )}
      </div>
      <footer className="ad-table-footer">
        <span>
          {filtered.length
            ? `${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, filtered.length)}`
            : "0"}{" "}
          din {filtered.length} înregistrări
        </span>
        <div>
          <label>
            Pe pagină
            <select
              aria-label="Înregistrări pe pagină"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option>10</option>
              <option>25</option>
              <option>50</option>
            </select>
          </label>
          <button
            className="ad-icon-button"
            aria-label="Pagina precedentă"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {current} / {pages}
          </span>
          <button
            className="ad-icon-button"
            aria-label="Pagina următoare"
            disabled={current >= pages}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </footer>
    </section>
  );
}
