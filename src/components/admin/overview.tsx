"use client";
import { useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Compass,
  ClipboardCheck,
  Users,
  ArrowUpRight,
  ArrowRight,
  Plus,
  CheckCircle2,
  Globe,
  ImageIcon,
  Mail,
  Clock3,
  Layers3,
  Activity,
} from "lucide-react";
import type { AdminData } from "./types";
import { PageTitle, Badge, dateTime } from "./shared";
import { latestItems } from "@/modules/catalog/admin-utils";
import { actionLabel } from "./activity";
export function Overview({ data }: { data: AdminData }) {
  const [period, setPeriod] = useState(14);
  const [includeDemo, setDemo] = useState(true);
  const all = latestItems(data);
  const items = all.filter((i) => includeDemo || !i.listing.demo);
  const published = items.filter((i) => i.listing.status === "published");
  const pending = data.items.filter(
    (i) => i.revision.status === "pending" && i.listing.status !== "archived",
  );
  const real = all.filter(
    (i) => !i.listing.demo && i.listing.status !== "archived",
  );
  const demos = all.filter((i) => i.listing.demo).length;
  const stats = [
    {
      label: "Locații în catalog",
      value: items.filter((i) => i.listing.kind === "location").length,
      detail: `${published.filter((i) => i.listing.kind === "location").length} publicate pe hartă`,
      icon: MapPin,
      color: "green",
      href: "/admin/locations",
    },
    {
      label: "Experiențe",
      value: items.filter((i) => i.listing.kind === "experience").length,
      detail: `${published.filter((i) => i.listing.kind === "experience").length} disponibile public`,
      icon: Compass,
      color: "pink",
      href: "/admin/experiences",
    },
    {
      label: "În așteptarea verificării",
      value: pending.length,
      detail: pending.length
        ? "Propuneri care au nevoie de o decizie"
        : "Toate propunerile au fost verificate",
      icon: ClipboardCheck,
      color: "amber",
      href: "/admin/moderation",
    },
    {
      label: "Categorii active",
      value: data.config.filter((c) => c.active).length,
      detail: `${data.config.length} categorii configurate`,
      icon: Layers3,
      color: "purple",
      href: "/admin/categories",
    },
  ];
  const days = Array.from({ length: period }, (_, index) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - period + index + 1);
    const end = new Date(d);
    end.setDate(end.getDate() + 1);
    return {
      date: d,
      count: data.items.filter(
        (i) =>
          (includeDemo || !i.listing.demo) &&
          new Date(i.revision.createdAt) >= d &&
          new Date(i.revision.createdAt) < end,
      ).length,
    };
  });
  const maximum = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((n, d) => n + d.count, 0);
  const categories = data.config
    .map((category) => ({
      ...category,
      count: items.filter(
        (i) =>
          i.revision.categoryId === category.id &&
          i.listing.status !== "archived",
      ).length,
    }))
    .sort((a, b) => b.count - a.count);
  const count = categories.reduce((sum, c) => sum + c.count, 0);
  const quality = [
    {
      label: "Fără fotografii",
      count: real.filter(
        (i) =>
          !Array.isArray(i.revision.values.gallery) ||
          !i.revision.values.gallery.length,
      ).length,
      icon: ImageIcon,
      href: "/admin/content?quality=photos",
    },
    {
      label: "Traducere EN lipsă",
      count: real.filter((i) => !i.revision.values.description_en).length,
      icon: Globe,
      href: "/admin/content?quality=translation",
    },
    {
      label: "Date de contact lipsă",
      count: real.filter(
        (i) => !["phone", "email", "website"].some((k) => i.revision.values[k]),
      ).length,
      icon: Mail,
      href: "/admin/content?quality=contacts",
    },
  ];
  return (
    <>
      <PageTitle
        eyebrow="BUN VENIT ÎNAPOI"
        title="Prezentare generală"
        description="Tot ce se întâmplă cu locurile, experiențele și oamenii de pe platformă."
        action={
          <>
            <Link href="/" className="ad-button">
              <ArrowUpRight size={16} />
              Vezi site-ul
            </Link>
            <Link
              href="/admin/locations/add"
              className="ad-button ad-button-primary"
            >
              <Plus size={16} />
              Adaugă locație
            </Link>
          </>
        }
      />
      <div className="ad-overview-context">
        <span>
          <span className="ad-live-dot" />
          Date actualizate din platformă
        </span>
        <label>
          <input
            type="checkbox"
            checked={includeDemo}
            onChange={(e) => setDemo(e.target.checked)}
          />
          Include cele {demos} fișe demonstrative
        </label>
      </div>
      <div className="ad-stat-grid">
        {stats.map((stat) => (
          <Link href={stat.href} key={stat.label} className="ad-stat-card">
            <div>
              <span className={`ad-stat-icon ${stat.color}`}>
                <stat.icon size={20} />
              </span>
              <ArrowUpRight size={16} />
            </div>
            <p>{stat.label}</p>
            <strong>{stat.value}</strong>
            <small>{stat.detail}</small>
          </Link>
        ))}
      </div>
      <div className="ad-overview-columns">
        <section className="ad-card">
          <div className="ad-card-heading">
            <div>
              <h2>Activitatea conținutului</h2>
              <p>Revizii create în perioada selectată</p>
            </div>
            <select
              aria-label="Perioada activității"
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
            >
              <option value={7}>Ultimele 7 zile</option>
              <option value={14}>Ultimele 14 zile</option>
              <option value={30}>Ultimele 30 zile</option>
            </select>
          </div>
          <div className="ad-chart-total">
            <strong>{total}</strong>
            <span>revizii de conținut</span>
            <span className="ad-chart-legend">
              <i />
              Activitate editorială
            </span>
          </div>
          <div
            className="ad-bar-chart"
            role="img"
            aria-label={`${total} revizii în ultimele ${period} zile`}
          >
            <div className="ad-chart-grid">
              <span>{maximum}</span>
              <span>{Math.floor(maximum / 2)}</span>
              <span>0</span>
            </div>
            <div className="ad-bars">
              {days.map((day, index) => (
                <div
                  key={index}
                  className="ad-bar-column"
                  title={`${day.date.toLocaleDateString("ro-RO")}: ${day.count} revizii`}
                >
                  <div
                    style={{
                      height: `${day.count ? Math.max(4, (day.count / maximum) * 100) : 1}%`,
                    }}
                  />
                  <span>
                    {index === 0 ||
                    index === days.length - 1 ||
                    index === Math.floor(days.length / 2)
                      ? day.date.toLocaleDateString("ro-RO", {
                          day: "numeric",
                          month: "short",
                        })
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="ad-card">
          <div className="ad-card-heading">
            <div>
              <h2>Distribuție pe categorii</h2>
              <p>{count} fișe în catalogul curent</p>
            </div>
            <Layers3 size={18} />
          </div>
          <div className="ad-category-distribution">
            {categories.map((category) => (
              <Link
                href={`/admin/${category.kind === "experience" ? "experiences" : "locations"}?category=${category.id}`}
                key={category.id}
              >
                <div>
                  <span>
                    <i style={{ background: category.color }} />
                    {category.name}
                  </span>
                  <strong>{category.count}</strong>
                </div>
                <div className="ad-progress-track">
                  <i
                    style={{
                      background: category.color,
                      width: `${count ? (category.count / count) * 100 : 0}%`,
                    }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <div className="ad-overview-columns">
        <section className="ad-card">
          <div className="ad-card-heading">
            <div>
              <h2>De verificat</h2>
              <p>Propuneri și modificări trimise de prestatori</p>
            </div>
            <Link href="/admin/moderation" className="ad-text-link">
              Vezi toate
              <ArrowRight size={14} />
            </Link>
          </div>
          {pending.length ? (
            <div className="ad-pending-preview">
              {pending.slice(0, 4).map((item) => (
                <Link
                  key={item.revision.id}
                  href={`/admin/moderation/${item.revision.id}`}
                >
                  <span className="ad-content-avatar">
                    <MapPin size={18} />
                  </span>
                  <div>
                    <strong>
                      {String(item.revision.values.name ?? "Fără denumire")}
                    </strong>
                    <small>
                      {item.authorName} · {dateTime(item.revision.createdAt)}
                    </small>
                  </div>
                  <Badge value="pending" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="ad-queue-clear">
              <span>
                <CheckCircle2 size={29} />
              </span>
              <h3>Ești la zi cu verificările</h3>
              <p>Propunerile noi vor apărea aici imediat după trimitere.</p>
              <Link href="/admin/locations">
                Explorează conținutul
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </section>
        <section className="ad-card">
          <div className="ad-card-heading">
            <div>
              <h2>Calitatea informațiilor</h2>
              <p>Completări recomandate pentru fișele reale</p>
            </div>
            <CheckCircle2 size={18} />
          </div>
          <div className="ad-quality-list">
            {quality.map((issue) => (
              <Link href={issue.href} key={issue.label}>
                <span>
                  <issue.icon size={18} />
                  {issue.label}
                </span>
                <b className={issue.count ? "attention" : ""}>{issue.count}</b>
                <ChevronIcon />
              </Link>
            ))}
          </div>
          <div className="ad-quality-note">
            <CheckCircle2 size={17} />
            <span>
              {quality.every((q) => q.count === 0)
                ? real.length
                  ? "Fișele reale au informațiile de bază completate."
                  : "Nu există încă fișe reale de verificat."
                : "Completează datele pentru ca vizitatorii să găsească ușor ce caută."}
            </span>
          </div>
        </section>
      </div>
      <div className="ad-overview-columns ad-overview-bottom">
        <section className="ad-card">
          <div className="ad-card-heading">
            <div>
              <h2>Activitate recentă</h2>
              <p>Ultimele acțiuni ale echipei</p>
            </div>
            <Link href="/admin/activity" className="ad-text-link">
              Jurnal complet
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="ad-activity-feed">
            {data.events.slice(0, 5).map((event) => (
              <div key={event.id}>
                <span className="ad-feed-icon">
                  <Activity size={15} />
                </span>
                <div>
                  <strong>{actionLabel(event.action)}</strong>
                  <small>{event.actorName ?? "Sistem"}</small>
                </div>
                <time>{dateTime(event.createdAt)}</time>
              </div>
            ))}
            {!data.events.length && <p>Activitatea echipei va apărea aici.</p>}
          </div>
        </section>
        <section className="ad-quick-card">
          <span className="ad-eyebrow">LA ÎNDEMÂNĂ</span>
          <h2>Construim o hartă mai bogată.</h2>
          <p>Adaugă informații utile și păstrează conținutul actualizat.</p>
          <Link href="/admin/locations/add">
            <MapPin size={18} />
            Adaugă o locație
            <Plus size={16} />
          </Link>
          <Link href="/admin/experiences/add">
            <Compass size={18} />
            Adaugă o experiență
            <Plus size={16} />
          </Link>
          {data.actor.role === "owner" && (
            <Link href="/admin/team/invite">
              <Users size={18} />
              Invită un coleg
              <Plus size={16} />
            </Link>
          )}
          <div>
            <Clock3 size={15} />
            {data.delivery.reduce(
              (sum, d) =>
                sum +
                (["pending", "processing"].includes(d.status) ? d.count : 0),
              0,
            )}{" "}
            emailuri în coadă · {data.mailProvider}
          </div>
        </section>
      </div>
    </>
  );
}
function ChevronIcon() {
  return <ArrowUpRight size={14} />;
}
