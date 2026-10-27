"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Pencil,
  UserPlus,
  UserCheck,
  Mail,
  Send,
  ShieldCheck,
  ArrowLeft,
  Save,
  RotateCcw,
  X,
  LockKeyhole,
} from "lucide-react";
import { api } from "@/components/platform/api";
import type { AdminData } from "./types";
import {
  AddLink,
  Badge,
  ConfirmDialog,
  DataTable,
  Notice,
  PageTitle,
  date,
  roleLabels,
} from "./shared";
export function TeamPage({
  data,
  invites = false,
}: {
  data: AdminData;
  invites?: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    endpoint: string;
    label: string;
  } | null>(null);
  const members = data.people.filter((p) => p.role !== "user");
  const pending = data.invitations.filter(
    (i) => !i.acceptedAt && !i.revokedAt && new Date(i.expiresAt) > new Date(),
  );
  const state = (i: AdminData["invitations"][number]) =>
    i.revokedAt
      ? "revoked"
      : i.acceptedAt
        ? "accepted"
        : new Date(i.expiresAt) < new Date()
          ? "expired"
          : "pending";
  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRARE"
        title="Echipă și acces"
        description="Gestionează membrii echipei, rolurile și invitațiile de acces la administrare."
        action={<AddLink href="/admin/team/invite">Adaugă un membru</AddLink>}
      />
      <div className="ad-stat-grid ad-stat-grid-three">
        {[
          {
            label: "Membri în echipă",
            value: members.length,
            icon: ShieldCheck,
          },
          {
            label: "Invitații în așteptare",
            value: pending.length,
            icon: Mail,
          },
          {
            label: "Administratori principali",
            value: members.filter((p) => p.role === "owner").length,
            icon: LockKeyhole,
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
      <div className="ad-page-tabs">
        <Link href="/admin/team" className={!invites ? "active" : ""}>
          Membri <span>{members.length}</span>
        </Link>
        <Link
          href="/admin/team?tab=invitations"
          className={invites ? "active" : ""}
        >
          Invitații <span>{pending.length}</span>
        </Link>
      </div>
      <Notice message={message} />
      {invites ? (
        <DataTable
          key="invitations"
          rows={data.invitations.filter((i) => !filter || state(i) === filter)}
          rowKey={(i) => i.id}
          searchText={(i) => i.email}
          searchPlaceholder="Caută o invitație după email…"
          exportName="invitatii"
          filters={
            <select
              aria-label="Starea invitației"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">Toate stările</option>
              <option value="pending">În așteptare</option>
              <option value="accepted">Acceptate</option>
              <option value="expired">Expirate</option>
              <option value="revoked">Anulate</option>
            </select>
          }
          emptyTitle="Nicio invitație"
          emptyDescription="Invită un coleg pentru a colabora la administrarea platformei."
          columns={[
            {
              id: "email",
              label: "Destinatar",
              sort: (i) => i.email,
              render: (i) => (
                <div className="ad-cell-with-icon">
                  <span className="ad-person-avatar">
                    <Mail size={18} />
                  </span>
                  <span>
                    <strong>{i.email}</strong>
                    <small>
                      Invitat de{" "}
                      {data.people.find((p) => p.id === i.invitedBy)?.name ??
                        "Administrator"}
                    </small>
                  </span>
                </div>
              ),
            },
            {
              id: "role",
              label: "Rol",
              sort: (i) => i.role,
              render: (i) => roleLabels[i.role],
            },
            {
              id: "state",
              label: "Stare",
              render: (i) => (
                <Badge value={state(i)}>
                  {state(i) === "pending" ? "În așteptare" : undefined}
                </Badge>
              ),
            },
            {
              id: "date",
              label: "Trimisă la",
              sort: (i) => i.createdAt,
              render: (i) => date(i.createdAt),
            },
            {
              id: "expires",
              label: "Valabilă până la",
              sort: (i) => i.expiresAt,
              render: (i) => date(i.expiresAt),
            },
            {
              id: "actions",
              label: "Acțiuni",
              render: (i) =>
                !i.acceptedAt && !i.revokedAt ? (
                  <div className="ad-row-actions">
                    <button
                      className="ad-icon-button"
                      title="Retrimite invitația"
                      aria-label={`Retrimite invitația pentru ${i.email}`}
                      onClick={() =>
                        setConfirm({
                          title: "Retrimiți invitația?",
                          description: `Un link nou va fi trimis la ${i.email}. Linkul anterior va fi invalidat.`,
                          endpoint: `invitation-resend/${i.id}`,
                          label: "Retrimite invitația",
                        })
                      }
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button
                      className="ad-icon-button"
                      title="Anulează invitația"
                      aria-label={`Anulează invitația pentru ${i.email}`}
                      onClick={() =>
                        setConfirm({
                          title: "Anulezi invitația?",
                          description: `${i.email} nu va mai putea accepta această invitație.`,
                          endpoint: `invitation-cancel/${i.id}`,
                          label: "Anulează invitația",
                        })
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <span className="ad-muted">—</span>
                ),
            },
          ]}
        />
      ) : (
        <DataTable
          key="members"
          rows={members.filter((p) => !filter || p.role === filter)}
          rowKey={(p) => p.id}
          searchText={(p) => `${p.name} ${p.email}`}
          searchPlaceholder="Caută un membru după nume sau email…"
          exportName="echipa"
          filters={
            <select
              aria-label="Rolul membrilor"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">Toate rolurile</option>
              <option value="owner">Administrator principal</option>
              <option value="admin">Administrator</option>
              <option value="moderator">Moderator</option>
            </select>
          }
          columns={[
            {
              id: "name",
              label: "Membru",
              sort: (p) => p.name,
              render: (p) => (
                <div className="ad-cell-with-icon">
                  <span className="ad-person-avatar">
                    {p.name
                      .split(" ")
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span>
                    <strong>
                      {p.name}
                      {p.id === data.actor.id && (
                        <small className="ad-inline-note">Tu</small>
                      )}
                    </strong>
                    <small>{p.email}</small>
                  </span>
                </div>
              ),
            },
            {
              id: "role",
              label: "Rol",
              sort: (p) => p.role,
              render: (p) => (
                <span className={`ad-role ad-role-${p.role}`}>
                  <ShieldCheck size={13} />
                  {roleLabels[p.role]}
                </span>
              ),
            },
            {
              id: "verified",
              label: "Email",
              render: (p) => (
                <Badge value={p.emailVerified ? "active" : "pending"}>
                  {p.emailVerified ? "Confirmat" : "Neconfirmat"}
                </Badge>
              ),
            },
            {
              id: "joined",
              label: "Adăugat la",
              sort: (p) => p.createdAt,
              render: (p) => date(p.createdAt),
            },
            {
              id: "last",
              label: "Ultima activitate",
              sort: (p) => p.lastSeen ?? "",
              render: (p) => date(p.lastSeen),
            },
            {
              id: "actions",
              label: "Acțiuni",
              render: (p) =>
                p.role === "owner" ? (
                  <span className="ad-owner-protected">
                    <LockKeyhole size={13} />
                    Protejat
                  </span>
                ) : (
                  <div className="ad-row-actions">
                    <Link
                      href={`/admin/team/${p.id}/edit`}
                      className="ad-icon-button"
                      aria-label={`Editează accesul pentru ${p.name}`}
                      title="Editează membrul"
                    >
                      <Pencil size={16} />
                    </Link>
                    <button
                      className="ad-icon-button"
                      title="Revocă accesul"
                      aria-label={`Revocă accesul pentru ${p.name}`}
                      onClick={() =>
                        setConfirm({
                          title: "Revoci accesul administrativ?",
                          description: `${p.name} va rămâne cu un cont de prestator. Sesiunile active și invitațiile neacceptate vor fi invalidate.`,
                          endpoint: `revoke/${p.id}`,
                          label: "Revocă accesul",
                        })
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ),
            },
          ]}
        />
      )}
      <div className="ad-help-note">
        <ShieldCheck size={17} />
        <p>
          <strong>Acces controlat.</strong> Administratorii principali
          gestionează echipa. Administratorii configurează conținutul și
          formularele. Moderatorii verifică propunerile.
        </p>
      </div>
      {confirm && (
        <ConfirmDialog
          {...confirm}
          confirmLabel={confirm.label}
          danger
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
const initials = (name: string) =>
  name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function InviteForm({ people }: { people: AdminData["people"] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("moderator");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = email.trim().toLowerCase();
  // Typing an existing account's exact email counts as picking it.
  const picked =
    people.find((p) => p.id === pickedId) ??
    people.find((p) => p.email.toLowerCase() === query);
  const suggestions =
    !picked && query.length >= 2
      ? people
          .filter(
            (p) =>
              p.role !== "owner" &&
              (p.email.toLowerCase().includes(query) ||
                p.name.toLowerCase().includes(query)),
          )
          .slice(0, 6)
      : [];
  const inTeam = !!picked && picked.role !== "user";
  const direct = !!picked && !inTeam && picked.emailVerified;
  const pick = (p: AdminData["people"][number]) => {
    setPickedId(p.id);
    setEmail(p.email);
    setOpen(false);
    setMessage("");
  };
  const clear = () => {
    setPickedId(null);
    setEmail("");
    setActive(0);
  };
  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRARE / ECHIPĂ"
        title="Adaugă un membru"
        description="Alege un cont existent sau trimite o invitație personală pe email."
        action={
          <Link href="/admin/team" className="ad-button">
            <ArrowLeft size={15} />
            Înapoi la echipă
          </Link>
        }
      />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (inTeam) return;
          setBusy(true);
          setMessage("");
          try {
            if (direct) {
              await api("team-members", { userId: picked.id, role });
              router.push("/admin/team");
            } else {
              await api("invitations", { email, role });
              router.push("/admin/team?tab=invitations");
            }
            router.refresh();
          } catch (error) {
            setMessage((error as Error).message);
            setBusy(false);
          }
        }}
      >
        <Notice message={message} error />
        <div className="ad-edit-layout">
          <section className="ad-card ad-form-card">
            <div className="ad-card-heading">
              <div>
                <h2>Membrul echipei</h2>
                <p>
                  Caută după email sau nume. Conturile existente primesc rolul
                  imediat, fără email.
                </p>
              </div>
              <UserPlus size={21} />
            </div>
            {picked ? (
              <div className="ad-user-field">
                <span className="ad-user-label">Cont selectat</span>
                <div className="ad-user-picked">
                  <span className="ad-person-avatar">
                    {initials(picked.name)}
                  </span>
                  <span>
                    <strong>{picked.name}</strong>
                    <small>{picked.email}</small>
                  </span>
                  <button
                    type="button"
                    className="ad-icon-button"
                    title="Alege alt cont"
                    aria-label="Alege alt cont"
                    onClick={clear}
                  >
                    <X size={16} />
                  </button>
                </div>
                {inTeam ? (
                  <p className="ad-user-hint ad-user-hint-warn">
                    Face deja parte din echipă ca{" "}
                    {roleLabels[picked.role].toLowerCase()}. Rolul se schimbă
                    din <Link href={`/admin/team/${picked.id}/edit`}>pagina
                    membrului</Link>.
                  </p>
                ) : direct ? (
                  <p className="ad-user-hint">
                    <UserCheck size={15} />
                    Cont existent cu email confirmat. Primește rolul imediat,
                    fără invitație.
                  </p>
                ) : (
                  <p className="ad-user-hint ad-user-hint-warn">
                    Contul nu are emailul confirmat, așa că va primi o
                    invitație pe email.
                  </p>
                )}
              </div>
            ) : (
              <label className="ad-user-search">
                Email sau nume *
                <input
                  type="email"
                  required
                  placeholder="coleg@exemplu.md"
                  value={email}
                  role="combobox"
                  aria-expanded={open && suggestions.length > 0}
                  aria-controls="team-user-suggestions"
                  aria-autocomplete="list"
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setOpen(true);
                    setActive(0);
                  }}
                  onFocus={() => setOpen(true)}
                  onBlur={() => setOpen(false)}
                  onKeyDown={(e) => {
                    if (!open || !suggestions.length) return;
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      const step = e.key === "ArrowDown" ? 1 : -1;
                      setActive(
                        (active + step + suggestions.length) %
                          suggestions.length,
                      );
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      pick(suggestions[active]);
                    } else if (e.key === "Escape") setOpen(false);
                  }}
                  autoComplete="off"
                />
                {open && suggestions.length > 0 && (
                  <ul
                    id="team-user-suggestions"
                    className="ad-user-suggestions"
                    role="listbox"
                  >
                    {suggestions.map((p, index) => (
                      <li
                        key={p.id}
                        role="option"
                        aria-selected={index === active}
                        className={index === active ? "active" : ""}
                        onMouseEnter={() => setActive(index)}
                        // mousedown fires before the input's blur closes the list
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pick(p);
                        }}
                      >
                        <span className="ad-person-avatar">
                          {initials(p.name)}
                        </span>
                        <span>
                          <strong>{p.name}</strong>
                          <small>{p.email}</small>
                        </span>
                        <em>
                          {p.role !== "user"
                            ? roleLabels[p.role]
                            : p.emailVerified
                              ? "Cont existent"
                              : "Email neconfirmat"}
                        </em>
                      </li>
                    ))}
                  </ul>
                )}
              </label>
            )}
            <label>Alege nivelul de acces</label>
            <div className="ad-role-options">
              {[
                {
                  id: "moderator",
                  title: "Moderator",
                  text: "Verifică propuneri, cere corectări, aprobă și retrage conținut.",
                },
                {
                  id: "admin",
                  title: "Administrator",
                  text: "Gestionează conținutul, categoriile, formularele și biblioteca media.",
                },
              ].map((option) => (
                <label
                  key={option.id}
                  className={role === option.id ? "selected" : ""}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.id}
                    checked={role === option.id}
                    onChange={() => setRole(option.id)}
                  />
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.text}</small>
                  </span>
                  <ShieldCheck size={19} />
                </label>
              ))}
            </div>
          </section>
          <aside className="ad-card ad-form-card">
            <span className="ad-aside-icon">
              {direct ? <UserCheck size={24} /> : <Mail size={24} />}
            </span>
            <h2>Cum funcționează</h2>
            {direct ? (
              <>
                <ol className="ad-steps">
                  <li>Contul primește rolul ales imediat.</li>
                  <li>
                    La următoarea încărcare a paginii vede administrarea.
                  </li>
                </ol>
                <p>
                  Nu se trimite niciun email. Poți schimba sau revoca accesul
                  oricând din tabelul membrilor.
                </p>
              </>
            ) : (
              <>
                <ol className="ad-steps">
                  <li>Membrul primește un email cu invitația.</li>
                  <li>
                    Creează un cont sau se autentifică și confirmă emailul.
                  </li>
                  <li>Acceptă invitația și primește rolul ales.</li>
                </ol>
                <p>
                  Linkul este valabil 48 de ore. Poți retrimite sau anula
                  invitația din tabel.
                </p>
              </>
            )}
          </aside>
        </div>
        <div className="ad-sticky-actions">
          <Link href="/admin/team" className="ad-button">
            Renunță
          </Link>
          <button
            className="ad-button ad-button-primary"
            disabled={busy || inTeam}
          >
            {direct ? <UserCheck size={16} /> : <Send size={16} />}
            {busy
              ? direct
                ? "Se adaugă…"
                : "Se trimite…"
              : direct
                ? "Adaugă în echipă"
                : "Trimite invitația"}
          </button>
        </div>
      </form>
    </>
  );
}
export function MemberForm({
  person,
}: {
  person: AdminData["people"][number];
}) {
  const router = useRouter();
  const [name, setName] = useState(person.name);
  const [role, setRole] = useState(person.role);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <>
      <PageTitle
        title={`Editează accesul · ${person.name}`}
        description="Actualizează numele și rolul. Schimbarea rolului închide sesiunile active."
        action={
          <Link href="/admin/team" className="ad-button">
            <ArrowLeft size={15} />
            Înapoi la echipă
          </Link>
        }
      />
      <form
        className="ad-card ad-form-card ad-form-medium"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(`team/${person.id}`, { name, role });
            router.push("/admin/team");
            router.refresh();
          } catch (error) {
            setMessage((error as Error).message);
            setBusy(false);
          }
        }}
      >
        <Notice message={message} error />
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
          <input disabled value={person.email} />
          <small>
            Identitatea este legată de emailul confirmat al contului.
          </small>
        </label>
        <label>
          Rol
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="moderator">Moderator</option>
            <option value="admin">Administrator</option>
            <option value="user">
              Prestator — revocă accesul administrativ
            </option>
          </select>
        </label>
        <div className="ad-form-actions">
          <Link href="/admin/team" className="ad-button">
            Renunță
          </Link>
          <button className="ad-button ad-button-primary" disabled={busy}>
            <Save size={16} />
            {busy ? "Se salvează…" : "Salvează modificările"}
          </button>
        </div>
      </form>
    </>
  );
}
