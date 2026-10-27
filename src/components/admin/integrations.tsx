"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  Check,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  KeyRound,
  LayoutGrid,
  MapPinned,
  Pause,
  Pencil,
  Phone,
  Play,
  Plus,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/components/platform/api";
import {
  defaultIntegrationSettings,
  embedCode,
  expandDomains,
  normalizeDomain,
  type IntegrationSettings,
} from "@/modules/integrations/settings";
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

export type IntegrationRow = {
  id: string;
  publicKey: string;
  title: string;
  partnerName: string;
  contactEmail: string;
  notes: string;
  domains: string[];
  allowSubdomains: boolean;
  status: string;
  settings: IntegrationSettings;
  version: number;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
};
export type IntegrationStat = {
  day: string;
  host: string;
  allowed: boolean;
  count: number;
  lastAt: string;
};
type Category = { id: string; name: string; kind: string; active: boolean };
type Listing = {
  id: string;
  name: string;
  category: string;
  region: string;
  kind: string;
};

function CopyButton({
  text,
  label = "Copiază",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="ad-button ad-button-small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {}
      }}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {copied ? "Copiat" : label}
    </button>
  );
}

export function IntegrationsPage({
  rows,
  baseUrl,
}: {
  rows: (IntegrationRow & { views: number; blocked: number })[];
  baseUrl: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    endpoint: string;
    label: string;
    danger?: boolean;
  } | null>(null);
  const active = rows.filter((r) => r.status === "active");
  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRARE"
        title="Integrări parteneri"
        description="Hărți Hai Moldova afișate pe site-urile partenerilor, cu conținut și funcții alese de voi. Modificările ajung automat pe site-ul partenerului."
        action={
          <AddLink href="/admin/integrations/add">Adaugă integrare</AddLink>
        }
      />
      <div className="ad-stat-grid ad-stat-grid-three">
        {[
          { label: "Integrări active", value: active.length, icon: Code2 },
          {
            label: "Afișări în ultimele 30 de zile",
            value: rows.reduce((sum, r) => sum + r.views, 0),
            icon: Eye,
          },
          {
            label: "Tentative blocate (30 de zile)",
            value: rows.reduce((sum, r) => sum + r.blocked, 0),
            icon: ShieldCheck,
          },
        ].map((s) => (
          <div className="ad-team-stat" key={s.label}>
            <span>
              <s.icon size={20} />
            </span>
            <div>
              <strong>{s.value}</strong>
              <p>{s.label}</p>
            </div>
          </div>
        ))}
      </div>
      <Notice message={message} />
      <DataTable
        rows={rows.filter((r) => !filter || r.status === filter)}
        rowKey={(r) => r.id}
        searchText={(r) =>
          `${r.title} ${r.partnerName} ${r.domains.join(" ")} ${r.contactEmail}`
        }
        searchPlaceholder="Caută după titlu, partener sau domeniu…"
        exportName="integrari"
        filters={
          <select
            aria-label="Starea integrării"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Toate stările</option>
            <option value="active">Active</option>
            <option value="paused">Suspendate</option>
          </select>
        }
        emptyTitle="Nicio integrare"
        emptyDescription="Când un partener cere harta pe site-ul său, adaugă o integrare și trimite-i codul generat."
        columns={[
          {
            id: "title",
            label: "Integrare",
            sort: (r) => r.title,
            render: (r) => (
              <div className="ad-cell-with-icon">
                <span className="ad-person-avatar">
                  <Globe size={18} />
                </span>
                <span>
                  <Link href={`/admin/integrations/${r.id}`}>
                    <strong>{r.title}</strong>
                  </Link>
                  <small>{r.partnerName || "Partener nespecificat"}</small>
                </span>
              </div>
            ),
          },
          {
            id: "domains",
            label: "Domenii",
            sort: (r) => r.domains.join(", "),
            render: (r) => (
              <span className="ad-integration-domains">
                {r.domains.slice(0, 2).map((d) => (
                  <code key={d}>{d}</code>
                ))}
                {r.domains.length > 2 && <small>+{r.domains.length - 2}</small>}
              </span>
            ),
          },
          {
            id: "status",
            label: "Stare",
            sort: (r) => r.status,
            render: (r) => (
              <Badge value={r.status === "active" ? "active" : "suspended"}>
                {r.status === "active" ? "Activă" : "Suspendată"}
              </Badge>
            ),
          },
          {
            id: "views",
            label: "Afișări 30 zile",
            sort: (r) => r.views,
            render: (r) => (
              <span>
                {r.views}
                {r.blocked > 0 && (
                  <small className="ad-integration-blocked">
                    {" "}
                    · {r.blocked} blocate
                  </small>
                )}
              </span>
            ),
          },
          {
            id: "seen",
            label: "Ultima afișare",
            sort: (r) => r.lastSeenAt ?? "",
            render: (r) => (r.lastSeenAt ? dateTime(r.lastSeenAt) : "—"),
          },
          {
            id: "updated",
            label: "Actualizată",
            sort: (r) => r.updatedAt,
            render: (r) => date(r.updatedAt),
          },
          {
            id: "actions",
            label: "Acțiuni",
            render: (r) => (
              <div className="ad-row-actions">
                <Link
                  href={`/admin/integrations/${r.id}`}
                  className="ad-icon-button"
                  title="Editează integrarea"
                  aria-label={`Editează ${r.title}`}
                >
                  <Pencil size={16} />
                </Link>
                <CopyIcon
                  text={embedCode(
                    baseUrl,
                    r.publicKey,
                    r.settings.display.height,
                  )}
                />
                <button
                  className="ad-icon-button"
                  title={r.status === "active" ? "Suspendă" : "Activează"}
                  aria-label={`${r.status === "active" ? "Suspendă" : "Activează"} ${r.title}`}
                  onClick={() =>
                    setConfirm(
                      r.status === "active"
                        ? {
                            title: "Suspenzi integrarea?",
                            description: `Pe ${r.domains[0]} vizitatorii vor vedea mesajul „Hartă indisponibilă temporar” până la reactivare.`,
                            endpoint: `integration-action/${r.id}/pause`,
                            label: "Suspendă",
                            danger: true,
                          }
                        : {
                            title: "Reactivezi integrarea?",
                            description: `Harta va apărea din nou pe ${r.domains[0]}.`,
                            endpoint: `integration-action/${r.id}/activate`,
                            label: "Activează",
                          },
                    )
                  }
                >
                  {r.status === "active" ? (
                    <Pause size={16} />
                  ) : (
                    <Play size={16} />
                  )}
                </button>
              </div>
            ),
          },
        ]}
      />
      <div className="ad-help-note">
        <ShieldCheck size={17} />
        <p>
          <strong>Protejat pe domeniu.</strong> Fiecare cod funcționează numai
          pe domeniile autorizate: browserul refuză afișarea pe orice alt site,
          iar încercările sunt înregistrate aici.
        </p>
      </div>
      {confirm && (
        <ConfirmDialog
          {...confirm}
          confirmLabel={confirm.label}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await api(confirm.endpoint, {});
            setMessage("Operația a fost efectuată.");
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function CopyIcon({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="ad-icon-button"
      title="Copiază codul iframe"
      aria-label="Copiază codul iframe"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {}
      }}
    >
      {copied ? <Check size={16} /> : <Code2 size={16} />}
    </button>
  );
}

function Toggle({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="ad-toggle-row">
      <div>
        <strong>{label}</strong>
        {help && <small>{help}</small>}
      </div>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  );
}

function toggleItem<T>(list: T[], item: T, on: boolean) {
  return on ? [...new Set([...list, item])] : list.filter((x) => x !== item);
}

const featureOptions: {
  id: keyof IntegrationSettings["features"];
  label: string;
  help: string;
}[] = [
  {
    id: "header",
    label: "Antet Hai Moldova",
    help: "Logo și bara de sus. Dezactivează pentru o hartă mai compactă.",
  },
  { id: "search", label: "Căutare", help: "Căutare de localități și adrese." },
  {
    id: "categoryFilter",
    label: "Filtru pe categorii",
    help: "Butoanele de categorii de deasupra hărții.",
  },
  {
    id: "advancedFilters",
    label: "Filtre avansate",
    help: "Regiune, rating și buget.",
  },
  { id: "route", label: "Traseu", help: "Planificarea traseului până la loc." },
  {
    id: "prices",
    label: "Prețuri",
    help: "Când e oprit, prețurile nu se transmit deloc partenerului.",
  },
  {
    id: "favorites",
    label: "Salvare favorite",
    help: "Inimioara și lista Salvate.",
  },
  {
    id: "languageSwitch",
    label: "Schimbarea limbii",
    help: "RO / EN / RU în antet. Altfel rămâne limba aleasă mai jos.",
  },
  { id: "about", label: "„Despre proiect”", help: "Fereastra de prezentare." },
  {
    id: "contribute",
    label: "„Adaugă locația ta”",
    help: "Link spre înscrierea prestatorilor, deschis într-un tab nou.",
  },
  {
    id: "branding",
    label: "Mențiunea „Hartă oferită de Hai Moldova”",
    help: "Link discret spre site-ul principal.",
  },
];

type FormState = {
  title: string;
  partnerName: string;
  contactEmail: string;
  notes: string;
  domains: string[];
  allowSubdomains: boolean;
  status: string;
  settings: IntegrationSettings;
};

export function IntegrationForm({
  integration,
  stats = [],
  categories,
  regions,
  listings,
  baseUrl,
  notice = "",
}: {
  integration?: IntegrationRow;
  stats?: IntegrationStat[];
  categories: Category[];
  regions: string[];
  listings: Listing[];
  baseUrl: string;
  notice?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => ({
    title: integration?.title ?? "",
    partnerName: integration?.partnerName ?? "",
    contactEmail: integration?.contactEmail ?? "",
    notes: integration?.notes ?? "",
    domains: integration?.domains ?? [],
    allowSubdomains: integration?.allowSubdomains ?? false,
    status: integration?.status ?? "active",
    settings: integration?.settings ?? defaultIntegrationSettings,
  }));
  const [domainInput, setDomainInput] = useState("");
  const [domainError, setDomainError] = useState("");
  const [listingQuery, setListingQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<"rotate" | "delete" | null>(null);
  const s = form.settings;
  const update = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };
  const setSettings = <K extends keyof IntegrationSettings>(
    key: K,
    patch: Partial<IntegrationSettings[K]>,
  ) => update({ settings: { ...s, [key]: { ...s[key], ...patch } } });

  const addDomain = (value: string) => {
    const domain = normalizeDomain(value);
    if (!domain) {
      setDomainError(
        "Domeniu invalid. Scrie doar adresa site-ului, de exemplu exemplu.md",
      );
      return false;
    }
    setDomainError("");
    if (!form.domains.includes(domain))
      update({ domains: [...form.domains, domain] });
    setDomainInput("");
    return true;
  };

  const visibleCategories = categories.filter(
    (c) =>
      c.active && s.content.kinds.includes(c.kind as "location" | "experience"),
  );
  const matchingListings = useMemo(
    () =>
      listings.filter((l) => {
        const category = categories.find((c) => c.id === l.category);
        return (
          !!category &&
          s.content.kinds.includes(
            category.kind as "location" | "experience",
          ) &&
          (s.content.categoryMode === "all" ||
            s.content.categoryIds.includes(l.category)) &&
          (s.content.regionMode === "all" ||
            s.content.regions.includes(l.region))
        );
      }),
    [listings, categories, s.content],
  );
  const excluded = s.content.excludedListingIds.filter((id) =>
    matchingListings.some((l) => l.id === id),
  ).length;

  const code = integration
    ? embedCode(baseUrl, integration.publicKey, s.display.height)
    : "";
  const allowedViews = stats.filter((x) => x.allowed);
  const blockedHosts = Object.values(
    stats
      .filter((x) => !x.allowed)
      .reduce<Record<string, { host: string; count: number; lastAt: string }>>(
        (acc, x) => {
          const item = (acc[x.host] ??= {
            host: x.host,
            count: 0,
            lastAt: x.lastAt,
          });
          item.count += x.count;
          if (x.lastAt > item.lastAt) item.lastAt = x.lastAt;
          return acc;
        },
        {},
      ),
  ).sort((a, b) => b.count - a.count);
  const hostViews = Object.entries(
    allowedViews.reduce<Record<string, number>>((acc, x) => {
      acc[x.host] = (acc[x.host] ?? 0) + x.count;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (domainInput.trim() && !addDomain(domainInput)) return;
    setBusy(true);
    setError("");
    try {
      const pendingDomain = domainInput.trim()
        ? normalizeDomain(domainInput)
        : null;
      const payload = {
        ...form,
        domains:
          pendingDomain && !form.domains.includes(pendingDomain)
            ? [...form.domains, pendingDomain]
            : form.domains,
        ...(integration ? { baseVersion: integration.version } : {}),
      };
      const result = await api<{ id: string }>(
        integration ? `integrations/${integration.id}` : "integrations",
        payload,
      );
      setDirty(false);
      router.replace(
        `/admin/integrations/${result.id}?${integration ? "saved" : "created"}=1`,
      );
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRARE / INTEGRĂRI"
        title={integration ? integration.title : "Integrare nouă"}
        description={
          integration
            ? "Modificările salvate apar automat pe site-ul partenerului, în cel mult un minut, fără să schimbe codul instalat."
            : "Configurează harta pentru un partener. După salvare primești codul iframe de trimis partenerului."
        }
        action={
          <Link href="/admin/integrations" className="ad-button">
            <ArrowLeft size={15} />
            Înapoi la integrări
          </Link>
        }
      />
      <Notice message={notice} />
      <form onSubmit={save}>
        <Notice message={error} error />
        <div className="ad-edit-layout">
          <div>
            <section className="ad-card ad-form-card">
              <div className="ad-card-heading">
                <div>
                  <h2>Partener</h2>
                  <p>Date interne. Partenerul și vizitatorii nu le văd.</p>
                </div>
                <Globe size={21} />
              </div>
              <div className="ad-form-grid">
                <label className="ad-span-2">
                  <span>
                    Titlu intern <em>*</em>
                  </span>
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    placeholder="Ex.: Pensiunea X — pagina Atracții"
                    value={form.title}
                    onChange={(e) => update({ title: e.target.value })}
                  />
                </label>
                <label>
                  Partener
                  <input
                    maxLength={160}
                    placeholder="Numele organizației"
                    value={form.partnerName}
                    onChange={(e) => update({ partnerName: e.target.value })}
                  />
                </label>
                <label>
                  Email de contact
                  <input
                    type="email"
                    maxLength={254}
                    placeholder="web@partener.md"
                    value={form.contactEmail}
                    onChange={(e) => update({ contactEmail: e.target.value })}
                  />
                </label>
                <label className="ad-span-2">
                  Notițe
                  <textarea
                    maxLength={3000}
                    placeholder="Ce a cerut partenerul, acorduri, persoane de contact…"
                    value={form.notes}
                    onChange={(e) => update({ notes: e.target.value })}
                  />
                </label>
              </div>
            </section>

            <section className="ad-card ad-form-card">
              <div className="ad-card-heading">
                <div>
                  <h2>Domenii autorizate</h2>
                  <p>
                    Harta se afișează numai pe aceste site-uri. Pe oricare
                    altul, browserul o blochează.
                  </p>
                </div>
                <ShieldCheck size={21} />
              </div>
              <div className="ad-domain-input">
                <input
                  aria-label="Adaugă un domeniu"
                  placeholder="exemplu.md sau https://www.exemplu.md"
                  value={domainInput}
                  onChange={(e) => {
                    setDomainInput(e.target.value);
                    setDomainError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      if (domainInput.trim()) addDomain(domainInput);
                    }
                  }}
                />
                <button
                  type="button"
                  className="ad-button"
                  disabled={!domainInput.trim()}
                  onClick={() => addDomain(domainInput)}
                >
                  <Plus size={15} />
                  Adaugă
                </button>
              </div>
              {domainError && <p className="ad-field-error">{domainError}</p>}
              <div className="ad-domain-chips">
                {form.domains.map((domain) => (
                  <span key={domain}>
                    <Globe size={13} />
                    {domain}
                    <button
                      type="button"
                      aria-label={`Elimină ${domain}`}
                      onClick={() =>
                        update({
                          domains: form.domains.filter((d) => d !== domain),
                        })
                      }
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
                {!form.domains.length && (
                  <small className="ad-muted">
                    Niciun domeniu încă. Adaugă cel puțin unul.
                  </small>
                )}
              </div>
              <Toggle
                label="Permite și subdomeniile"
                help="De exemplu blog.exemplu.md sau shop.exemplu.md."
                checked={form.allowSubdomains}
                onChange={(allowSubdomains) => update({ allowSubdomains })}
              />
              {form.domains.length > 0 && (
                <p className="ad-domain-summary">
                  Acceptat pe:{" "}
                  {expandDomains(form.domains, form.allowSubdomains).map(
                    (h) => (
                      <code key={h}>{h}</code>
                    ),
                  )}
                </p>
              )}
            </section>

            <section className="ad-card ad-form-card">
              <div className="ad-card-heading">
                <div>
                  <h2>Ce conținut apare</h2>
                  <p>
                    Numai fișele publicate care corespund acestor reguli. Fișele
                    noi aprobate apar automat.
                  </p>
                </div>
                <LayoutGrid size={21} />
              </div>
              <h3 className="ad-subheading">Tipuri</h3>
              <div className="ad-check-grid">
                {(
                  [
                    ["location", "Locații"],
                    ["experience", "Experiențe"],
                  ] as const
                ).map(([kind, label]) => (
                  <label key={kind} className="ad-inline-check">
                    <input
                      type="checkbox"
                      checked={s.content.kinds.includes(kind)}
                      disabled={
                        s.content.kinds.length === 1 &&
                        s.content.kinds.includes(kind)
                      }
                      onChange={(e) =>
                        setSettings("content", {
                          kinds: toggleItem(
                            s.content.kinds,
                            kind,
                            e.target.checked,
                          ),
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              <h3 className="ad-subheading">Categorii</h3>
              <div
                className="ad-segmented"
                role="radiogroup"
                aria-label="Categorii"
              >
                {(
                  [
                    ["all", "Toate categoriile"],
                    ["selected", "Doar cele selectate"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    type="button"
                    key={mode}
                    role="radio"
                    aria-checked={s.content.categoryMode === mode}
                    className={s.content.categoryMode === mode ? "active" : ""}
                    onClick={() =>
                      setSettings("content", { categoryMode: mode })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              {s.content.categoryMode === "selected" && (
                <div className="ad-check-grid">
                  {visibleCategories.map((c) => (
                    <label key={c.id} className="ad-inline-check">
                      <input
                        type="checkbox"
                        checked={s.content.categoryIds.includes(c.id)}
                        onChange={(e) =>
                          setSettings("content", {
                            categoryIds: toggleItem(
                              s.content.categoryIds,
                              c.id,
                              e.target.checked,
                            ),
                          })
                        }
                      />
                      {c.name}
                      <small>
                        {c.kind === "experience" ? "experiență" : "locație"}
                      </small>
                    </label>
                  ))}
                </div>
              )}
              <h3 className="ad-subheading">Regiuni</h3>
              <div
                className="ad-segmented"
                role="radiogroup"
                aria-label="Regiuni"
              >
                {(
                  [
                    ["all", "Toată Moldova"],
                    ["selected", "Doar regiunile selectate"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    type="button"
                    key={mode}
                    role="radio"
                    aria-checked={s.content.regionMode === mode}
                    className={s.content.regionMode === mode ? "active" : ""}
                    onClick={() => setSettings("content", { regionMode: mode })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {s.content.regionMode === "selected" && (
                <div className="ad-check-grid">
                  {regions.map((region) => (
                    <label key={region} className="ad-inline-check">
                      <input
                        type="checkbox"
                        checked={s.content.regions.includes(region)}
                        onChange={(e) =>
                          setSettings("content", {
                            regions: toggleItem(
                              s.content.regions,
                              region,
                              e.target.checked,
                            ),
                          })
                        }
                      />
                      {region}
                    </label>
                  ))}
                </div>
              )}
              <details className="ad-exclusions">
                <summary>
                  Exclude fișe anume{" "}
                  <small>
                    {matchingListings.length - excluded} din{" "}
                    {matchingListings.length} fișe vor apărea
                  </small>
                </summary>
                <input
                  aria-label="Caută fișe"
                  placeholder="Caută după denumire…"
                  value={listingQuery}
                  onChange={(e) => setListingQuery(e.target.value)}
                />
                <div className="ad-exclusion-list">
                  {matchingListings
                    .filter((l) =>
                      l.name.toLowerCase().includes(listingQuery.toLowerCase()),
                    )
                    .map((l) => (
                      <label key={l.id} className="ad-inline-check">
                        <input
                          type="checkbox"
                          checked={!s.content.excludedListingIds.includes(l.id)}
                          onChange={(e) =>
                            setSettings("content", {
                              excludedListingIds: toggleItem(
                                s.content.excludedListingIds,
                                l.id,
                                !e.target.checked,
                              ),
                            })
                          }
                        />
                        {l.name}
                        <small>
                          {categories.find((c) => c.id === l.category)?.name} ·{" "}
                          {l.region}
                        </small>
                      </label>
                    ))}
                  {!matchingListings.length && (
                    <small className="ad-muted">
                      Nicio fișă publicată nu corespunde regulilor de mai sus.
                    </small>
                  )}
                </div>
              </details>
            </section>

            <section className="ad-card ad-form-card">
              <div className="ad-card-heading">
                <div>
                  <h2>Contacte și rezervări</h2>
                  <p>
                    Datele dezactivate nu sunt transmise deloc site-ului
                    partenerului, nu doar ascunse.
                  </p>
                </div>
                <Phone size={21} />
              </div>
              <Toggle
                label="Contacte la locații"
                help="Telefon, email, website și adresă pentru locații."
                checked={s.contacts.locations}
                onChange={(locations) => setSettings("contacts", { locations })}
              />
              <Toggle
                label="Contacte la experiențe"
                help="Telefon, email, website pentru experiențe."
                checked={s.contacts.experiences}
                onChange={(experiences) =>
                  setSettings("contacts", { experiences })
                }
              />
              <Toggle
                label="Butonul „Rezervă online”"
                help="Linkul de rezervare al gazdei. Independent de contacte."
                checked={s.contacts.booking}
                onChange={(booking) => setSettings("contacts", { booking })}
              />
              <Toggle
                label="WhatsApp și Viber"
                help="Se aplică doar unde contactele sunt permise."
                checked={s.contacts.messengers}
                onChange={(messengers) =>
                  setSettings("contacts", { messengers })
                }
              />
              <Toggle
                label="Rețele sociale"
                help="Facebook, Instagram, TikTok, YouTube, Telegram."
                checked={s.contacts.social}
                onChange={(social) => setSettings("contacts", { social })}
              />
            </section>

            <section className="ad-card ad-form-card">
              <div className="ad-card-heading">
                <div>
                  <h2>Funcționalități hartă</h2>
                  <p>
                    Alege ce poate face vizitatorul pe site-ul partenerului.
                  </p>
                </div>
                <SlidersHorizontal size={21} />
              </div>
              {featureOptions.map((option) => (
                <Toggle
                  key={option.id}
                  label={option.label}
                  help={option.help}
                  checked={s.features[option.id]}
                  onChange={(value) =>
                    setSettings("features", { [option.id]: value })
                  }
                />
              ))}
            </section>

            <section className="ad-card ad-form-card">
              <div className="ad-card-heading">
                <div>
                  <h2>Afișare</h2>
                  <p>Valorile implicite pentru vizitatorii partenerului.</p>
                </div>
                <MapPinned size={21} />
              </div>
              <div className="ad-form-grid">
                <label>
                  Limba
                  <select
                    value={s.display.locale}
                    onChange={(e) =>
                      setSettings("display", {
                        locale: e.target.value as "ro" | "en",
                      })
                    }
                  >
                    <option value="ro">Română</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label>
                  Pe telefon se deschide
                  <select
                    value={s.display.mobileView}
                    onChange={(e) =>
                      setSettings("display", {
                        mobileView: e.target.value as "map" | "list",
                      })
                    }
                  >
                    <option value="map">Harta</option>
                    <option value="list">Lista</option>
                  </select>
                </label>
                <label>
                  Înălțime iframe (px)
                  <input
                    type="number"
                    min={320}
                    max={1600}
                    step={10}
                    value={s.display.height}
                    onChange={(e) =>
                      setSettings("display", {
                        height: Number(e.target.value) || 640,
                      })
                    }
                  />
                  <small>
                    Schimbarea înălțimii necesită actualizarea codului.
                  </small>
                </label>
              </div>
            </section>
          </div>

          <aside>
            <section className="ad-card ad-form-card">
              <h2>Stare</h2>
              <Toggle
                label="Integrare activă"
                help="Suspendată, afișează un mesaj neutru pe site-ul partenerului."
                checked={form.status === "active"}
                onChange={(on) => update({ status: on ? "active" : "paused" })}
              />
              {integration && (
                <dl className="ad-integration-meta">
                  <div>
                    <dt>Creată</dt>
                    <dd>{date(integration.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Ultima afișare</dt>
                    <dd>
                      {integration.lastSeenAt
                        ? dateTime(integration.lastSeenAt)
                        : "Încă neafișată"}
                    </dd>
                  </div>
                  <div>
                    <dt>Versiune configurare</dt>
                    <dd>{integration.version}</dd>
                  </div>
                </dl>
              )}
            </section>
            <section className="ad-card ad-form-card">
              <h2>Cod de integrare</h2>
              {integration ? (
                <>
                  <p>
                    Trimite-l partenerului. Se lipește în pagina unde vrea
                    harta.
                  </p>
                  <pre className="ad-code">{code}</pre>
                  <div className="ad-code-actions">
                    <CopyButton text={code} label="Copiază codul" />
                    <a
                      className="ad-button ad-button-small"
                      href={`/embed/${integration.publicKey}`}
                      target="_blank"
                      rel="noopener"
                    >
                      <ExternalLink size={15} />
                      Deschide
                    </a>
                  </div>
                  {dirty && (
                    <small className="ad-unsaved">
                      Ai modificări nesalvate. Codul rămâne același; salvează
                      pentru a le publica.
                    </small>
                  )}
                </>
              ) : (
                <p>Codul iframe se generează după salvare.</p>
              )}
            </section>
            {integration && (
              <section className="ad-card ad-form-card">
                <h2>Afișări · 30 de zile</h2>
                {hostViews.length ? (
                  <ul className="ad-host-list">
                    {hostViews.map(([host, count]) => (
                      <li key={host}>
                        <span>{host}</span>
                        <strong>{count}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Nicio afișare încă pe site-ul partenerului.</p>
                )}
                {blockedHosts.length > 0 && (
                  <>
                    <h3 className="ad-subheading ad-blocked-title">
                      <Ban size={15} />
                      Încercări de pe domenii neautorizate
                    </h3>
                    <ul className="ad-host-list ad-host-blocked">
                      {blockedHosts.map((b) => (
                        <li key={b.host}>
                          <span>
                            {b.host}
                            <small>{dateTime(b.lastAt)}</small>
                          </span>
                          <strong>{b.count}</strong>
                          <button
                            type="button"
                            className="ad-text-link"
                            title="Adaugă la domeniile autorizate"
                            onClick={() => addDomain(b.host)}
                          >
                            Autorizează
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}
            {integration && (
              <section className="ad-card ad-form-card">
                <h2>Acțiuni avansate</h2>
                <button
                  type="button"
                  className="ad-button ad-full-width"
                  onClick={() => setConfirm("rotate")}
                >
                  <KeyRound size={15} />
                  Generează cod nou
                </button>
                <button
                  type="button"
                  className="ad-button ad-button-danger ad-full-width"
                  onClick={() => setConfirm("delete")}
                >
                  <Trash2 size={15} />
                  Șterge integrarea
                </button>
              </section>
            )}
          </aside>
        </div>
        {integration && (
          <section className="ad-card ad-form-card ad-embed-preview">
            <div className="ad-card-heading">
              <div>
                <h2>Previzualizare</h2>
                <p>
                  Exact ce vede vizitatorul partenerului (versiunea salvată).
                </p>
              </div>
              <Eye size={21} />
            </div>
            <iframe
              key={integration.version}
              src={`/embed/${integration.publicKey}`}
              title="Previzualizare integrare"
              style={{ height: integration.settings.display.height }}
            />
          </section>
        )}
        <div className="ad-sticky-actions">
          {dirty && <span className="ad-unsaved">Modificări nesalvate</span>}
          <Link href="/admin/integrations" className="ad-button">
            Renunță
          </Link>
          <button
            className="ad-button ad-button-primary"
            disabled={busy || (!form.domains.length && !domainInput.trim())}
          >
            <Save size={16} />
            {busy
              ? "Se salvează…"
              : integration
                ? "Salvează modificările"
                : "Creează integrarea"}
          </button>
        </div>
      </form>
      {confirm && integration && (
        <ConfirmDialog
          title={
            confirm === "rotate"
              ? "Generezi un cod nou?"
              : "Ștergi definitiv integrarea?"
          }
          description={
            confirm === "rotate"
              ? "Codul actual încetează să funcționeze imediat. Partenerul trebuie să instaleze noul cod. Folosește această opțiune dacă vechiul cod a fost compromis."
              : "Harta dispare de pe site-ul partenerului, iar statisticile se șterg. Pentru o oprire temporară, folosește suspendarea."
          }
          confirmLabel={confirm === "rotate" ? "Generează cod nou" : "Șterge"}
          danger
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await api(`integration-action/${integration.id}/${confirm}`, {});
            if (confirm === "delete") router.push("/admin/integrations");
            else
              router.replace(`/admin/integrations/${integration.id}?rotated=1`);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
