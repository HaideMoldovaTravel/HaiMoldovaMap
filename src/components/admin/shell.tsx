"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createAuthClient } from "better-auth/react";
import {
  LayoutDashboard,
  MapPin,
  Compass,
  ClipboardCheck,
  Shapes,
  SlidersHorizontal,
  ImageIcon,
  Users,
  ShieldCheck,
  History,
  Settings,
  ArrowUpRight,
  Bell,
  Search,
  Menu,
  X,
  ChevronRight,
  LogOut,
  Leaf,
  HelpCircle,
  Code2,
  BellRing,
} from "lucide-react";
import type { ActorData } from "@/components/platform/types";
import { roleLabels } from "./shared";
const auth = createAuthClient();
const navigation = [
  {
    label: "PRIVIRE DE ANSAMBLU",
    items: [
      { href: "/admin", label: "Prezentare generală", icon: LayoutDashboard },
    ],
  },
  {
    label: "CONȚINUT",
    items: [
      { href: "/admin/locations", label: "Locații", icon: MapPin },
      { href: "/admin/experiences", label: "Experiențe", icon: Compass },
      { href: "/admin/moderation", label: "Moderare", icon: ClipboardCheck },
      {
        href: "/admin/categories",
        label: "Categorii",
        icon: Shapes,
        configure: true,
      },
      {
        href: "/admin/forms",
        label: "Formulare",
        icon: SlidersHorizontal,
        configure: true,
      },
      { href: "/admin/media", label: "Bibliotecă media", icon: ImageIcon },
    ],
  },
  {
    label: "ADMINISTRARE",
    items: [
      {
        href: "/admin/users",
        label: "Utilizatori",
        icon: Users,
        configure: true,
      },
      {
        href: "/admin/team",
        label: "Echipă și acces",
        icon: ShieldCheck,
        owner: true,
      },
      {
        href: "/admin/haide-sync",
        label: "Sincronizare Haide",
        icon: Code2,
        configure: true,
      },
      {
        href: "/admin/integrations",
        label: "Integrări parteneri",
        icon: Code2,
        configure: true,
      },
      {
        href: "/admin/notifications",
        label: "Notificări Telegram",
        icon: BellRing,
        configure: true,
      },
      { href: "/admin/activity", label: "Jurnal de activitate", icon: History },
      { href: "/admin/settings", label: "Setări", icon: Settings },
    ],
  },
];
const titles: Record<string, string> = {
  content: "Conținut",
  locations: "Locații",
  experiences: "Experiențe",
  moderation: "Moderare",
  categories: "Categorii",
  forms: "Formulare",
  media: "Bibliotecă media",
  team: "Echipă și acces",
  users: "Utilizatori",
  activity: "Jurnal de activitate",
  settings: "Setări",
  integrations: "Integrări parteneri",
  "haide-sync": "Sincronizare Haide",
  notifications: "Notificări Telegram",
  add: "Adaugă",
  edit: "Editează",
  invite: "Adaugă un membru",
};
export function AdminShell({
  actor,
  pending,
  children,
}: {
  actor: ActorData;
  pending: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const configure = ["owner", "admin"].includes(actor.role);
  const parts = pathname.split("/").filter(Boolean).slice(1);
  return (
    <div className="platform-shell admin-workspace">
      <aside className={`ad-sidebar ${open ? "is-open" : ""}`}>
        <Link href="/admin" className="ad-brand" onClick={() => setOpen(false)}>
          <span className="ad-brand-icon">
            <Leaf size={22} />
          </span>
          <span>
            hai<span>moldova</span>
            <small>ADMINISTRARE</small>
          </span>
        </Link>
        <button
          className="ad-mobile-close"
          aria-label="Închide meniul"
          onClick={() => setOpen(false)}
        >
          <X size={20} />
        </button>
        <div className="ad-workspace-label">
          <span>HM</span>
          <div>
            Hai Moldova<small>Platforma de turism</small>
          </div>
          <span className="ad-live-dot" />
        </div>
        <nav aria-label="Meniu administrare">
          {navigation.map((group) => (
            <div className="ad-nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items
                .filter(
                  (item) =>
                    (!("configure" in item) || configure) &&
                    (!("owner" in item) || actor.role === "owner"),
                )
                .map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/admin" &&
                      pathname.startsWith(item.href + "/"));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={active ? "active" : ""}
                      aria-current={active ? "page" : undefined}
                    >
                      <item.icon size={18} />
                      <span>{item.label}</span>
                      {item.href === "/admin/moderation" && pending > 0 && (
                        <b>{pending}</b>
                      )}
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>
        <div className="ad-sidebar-bottom">
          <Link href="/" className="ad-website-link">
            Deschide site-ul
            <ArrowUpRight size={16} />
          </Link>
          <div className="ad-sidebar-profile">
            <span className="ad-avatar">
              {actor.name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
            <div>
              <strong>{actor.name}</strong>
              <small>{roleLabels[actor.role]}</small>
            </div>
            <button
              aria-label="Ieșire din cont"
              onClick={async () => {
                await auth.signOut();
                router.push("/autentificare");
                router.refresh();
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {open && (
        <button
          className="ad-sidebar-backdrop"
          aria-label="Închide meniul lateral"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="ad-main">
        <header className="ad-topbar">
          <div className="ad-breadcrumb">
            <button
              className="ad-mobile-menu ad-icon-button"
              aria-label="Deschide meniul"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </button>
            <Link href="/admin">
              <LayoutDashboard size={16} />
              <span>Administrare</span>
            </Link>
            {parts.map((part, index) => (
              <span key={`${part}-${index}`}>
                <ChevronRight size={13} />
                {titles[part] ? (
                  <Link href={`/admin/${parts.slice(0, index + 1).join("/")}`}>
                    {titles[part]}
                  </Link>
                ) : (
                  <span>Detalii</span>
                )}
              </span>
            ))}
          </div>
          <div className="ad-topbar-actions">
            <form
              className="ad-global-search"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/admin/content?q=${encodeURIComponent(query)}`);
              }}
            >
              <Search size={16} />
              <input
                aria-label="Caută în administrare"
                placeholder="Caută în conținut…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <Link
              href="/admin/moderation"
              className="ad-notifications"
              aria-label={`${pending} propuneri de verificat`}
            >
              <Bell size={19} />
              {pending > 0 && <i />}
            </Link>
            <Link
              href="/admin/settings"
              className="ad-avatar ad-avatar-small"
              aria-label="Profilul meu"
            >
              {actor.name[0]}
            </Link>
          </div>
        </header>
        <div className="ad-content">{children}</div>
        <footer className="ad-footer">
          <span>© {new Date().getFullYear()} Hai Moldova</span>
          <Link href="/admin/settings">
            <HelpCircle size={13} />
            Configurare și stare platformă
          </Link>
        </footer>
      </div>
    </div>
  );
}
