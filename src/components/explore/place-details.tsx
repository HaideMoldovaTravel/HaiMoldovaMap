"use client";
import { useI18n } from "@/features/i18n/provider";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Heart,
  ChevronLeft,
  ChevronRight,
  Star,
  MapPin,
  Navigation,
  Check,
  Bookmark,
  Clock,
  Phone,
  Mail,
  Copy,
  Globe,
  Info,
} from "lucide-react";
import { contactHref, formatPlacePrice } from "@/features/places/presentation";
import { mockContacts } from "@/features/places/contacts";
import { categories } from "@/features/places/data";
import type { Place } from "@/features/places/types";
import {
  fullFeatures,
  type ExplorerFeatures,
} from "@/features/places/features";
import { categoryColors } from "./icons";
import { BookingBar, bookingActions } from "./booking-bar";
export function PlaceDetails({
  place: p,
  saved,
  onSave,
  onClose,
  onDemo,
  onRoute,
  features = fullFeatures,
}: {
  place: Place;
  saved: boolean;
  onSave: () => void;
  onClose: () => void;
  onDemo: (message: string) => void;
  onRoute: () => void;
  features?: ExplorerFeatures;
}) {
  const { t, locale } = useI18n();
  const contacts: Record<string, string> =
    p.contacts ??
    (Object.fromEntries(
      Object.entries(mockContacts[p.id] ?? {}).filter(
        ([, value]) => typeof value === "string",
      ),
    ) as Record<string, string>);
  const contactFields = p.contactFields ?? [
    {
      id: "phone",
      label: "Telefon",
      labelEn: "Phone",
      type: "phone",
      value: contacts.phone,
    },
    {
      id: "website",
      label: "Website",
      labelEn: "Website",
      type: "url",
      value: contacts.website,
    },
    {
      id: "email",
      label: "Email",
      labelEn: "Email",
      type: "email",
      value: contacts.email,
    },
    {
      id: "address",
      label: "Adresă",
      labelEn: "Address",
      type: "text",
      value: contacts.address ?? p.village,
    },
  ];
  // Imported locations may store channels only in contacts.
  const actionFields = [...contactFields];
  for (const id of ["phone", "whatsapp", "booking_url", "email"]) {
    if (!actionFields.some((field) => field.id === id) && contacts[id])
      actionFields.push({
        id,
        label: id,
        labelEn: id,
        type: id === "email" ? "email" : id === "booking_url" ? "url" : "phone",
        value: contacts[id],
      });
  }

  const visibleContacts = contactFields.filter(
    (f) => f.value && !["whatsapp", "viber"].includes(f.id),
  );
  const hasContacts = visibleContacts.length > 0;
  const hasBookingBar = bookingActions(actionFields, t).length > 0;
  const [photo, setPhoto] = useState(0);
  const [tab, setTab] = useState("about");
  useEffect(() => {
    queueMicrotask(() => {
      setPhoto(0);
      setTab("about");
    });
  }, [p.id]);
  return (
    <div className={`place-details ${hasBookingBar ? "has-booking-bar" : ""}`}>
      <button className="back-button" onClick={onClose}>
        <ArrowLeft size={16} />
        {t("Înapoi la locuri")}
      </button>
      <div className="detail-gallery">
        <img
          src={p.images[photo]}
          alt={
            p.imageAlts?.[photo] ||
            (p.demo === false
              ? p.name
              : t("Imagine ilustrativă {{name}}", { name: p.name }))
          }
        />
        {features.favorites && (
          <button
            className={`save-button ${saved ? "saved" : ""}`}
            aria-label={t("Salvează locația")}
            onClick={onSave}
          >
            <Heart size={18} fill={saved ? "currentColor" : "none"} />
          </button>
        )}
        <div className="gallery-controls">
          <button
            aria-label={t("Fotografia precedentă")}
            onClick={() =>
              setPhoto((photo + p.images.length - 1) % p.images.length)
            }
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            {photo + 1} / {p.images.length}
          </span>
          <button
            aria-label={t("Fotografia următoare")}
            onClick={() => setPhoto((photo + 1) % p.images.length)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="detail-content">
        <span
          className="detail-category"
          style={{ color: p.categoryColor ?? categoryColors[p.category] }}
        >
          {(locale === "en" ? p.categoryLabelEn : p.categoryLabel) ??
            t(categories.find((c) => c.id === p.category)?.label)}
        </span>
        <h1>{p.name}</h1>
        {p.reviews > 0 && (
          <div className="detail-rating">
            <Star size={15} fill="currentColor" />
            {p.rating}{" "}
            <span>
              ({p.reviews} {t("recenzii demonstrative")})
            </span>
          </div>
        )}
        <p className="card-location">
          <MapPin size={14} />
          {p.village}
        </p>
        {(features.route || features.favorites) && (
          <div className="detail-actions">
            {features.route && (
              <button className="primary-button" onClick={onRoute}>
                <Navigation size={16} />
                {t("Traseu")}
              </button>
            )}
            {features.favorites && (
              <button className="secondary-button" onClick={onSave}>
                {saved ? <Check size={16} /> : <Bookmark size={16} />}{" "}
                {saved ? t("Salvat") : t("Salvează")}
              </button>
            )}
          </div>
        )}
        <div className="detail-tabs">
          <button
            className={tab === "about" ? "active" : ""}
            onClick={() => setTab("about")}
          >
            {t("Despre loc")}
          </button>
          {hasContacts && (
            <button
              className={tab === "contacts" ? "active" : ""}
              onClick={() => setTab("contacts")}
            >
              {t("Contacte")}
            </button>
          )}
        </div>
        {tab === "about" || !hasContacts ? (
          <>
            <p className="detail-description">{p.description}</p>
            <div className="detail-tags">
              {p.tags.map((t) => (
                <span key={t}>
                  <Check size={12} />
                  {t}
                </span>
              ))}
            </div>
            <div className="detail-fact">
              <Clock size={19} />
              <div>
                <strong>{t("Program orientativ")}</strong>
                <span>{p.hours}</span>
              </div>
            </div>
            {features.prices && (
              <div className="detail-fact">
                <Bookmark size={19} />
                <div>
                  <strong>{formatPlacePrice(p, t)}</strong>
                  <span>
                    {p.priceLabel}
                    {p.demo !== false && <> · {t("preț demonstrativ")}</>}
                  </span>
                </div>
              </div>
            )}
            {p.details?.map((detail) => (
              <div className="detail-fact" key={detail.id}>
                <Info size={19} />
                <div>
                  <strong>
                    {locale === "en" && detail.labelEn
                      ? detail.labelEn
                      : detail.label}
                  </strong>
                  <div>
                    {detail.type === "gallery" &&
                    Array.isArray(detail.value) ? (
                      <div className="detail-extra-gallery">
                        {detail.value.map((url) => (
                          <img
                            key={url}
                            src={url}
                            alt={detail.label}
                            loading="lazy"
                          />
                        ))}
                      </div>
                    ) : typeof detail.value === "boolean" ? (
                      detail.value ? (
                        "Da"
                      ) : (
                        "Nu"
                      )
                    ) : Array.isArray(detail.value) ? (
                      detail.value.join(", ")
                    ) : contactHref(detail.type ?? "", String(detail.value)) ? (
                      <a
                        href={contactHref(
                          detail.type ?? "",
                          String(detail.value),
                        )}
                        target={detail.type === "url" ? "_blank" : undefined}
                        rel="noopener noreferrer"
                      >
                        {String(detail.value)}
                      </a>
                    ) : (
                      String(detail.value)
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="contacts">
            <div className="contact-heading">
              <h2>{t("Contactează gazda")}</h2>
              {p.demo !== false && (
                <span className="contact-demo-badge">DEMO</span>
              )}
            </div>
            {p.demo !== false && (
              <p className="contact-intro">
                {t(
                  "Date ilustrative pentru prezentare. Nu aparțin locației reale.",
                )}
              </p>
            )}
            <div className="contact-list">
              {visibleContacts.map(({ id, label, labelEn, type, value }) => {
                const Icon =
                  type === "phone"
                    ? Phone
                    : type === "email"
                      ? Mail
                      : type === "url"
                        ? Globe
                        : MapPin;
                return (
                  <button
                    key={id}
                    className="contact-row"
                    title={p.demo === false ? label : t("Copiază")}
                    onClick={async () => {
                      if (p.demo === false) {
                        const href = contactHref(type, value, id);
                        if (href) {
                          if (href.startsWith("http"))
                            window.open(href, "_blank", "noopener,noreferrer");
                          else window.location.assign(href);
                          return;
                        }
                      }
                      try {
                        await navigator.clipboard.writeText(value);
                        onDemo(t("Copiat în clipboard."));
                      } catch {
                        onDemo(
                          t(
                            "Nu am putut copia. Selectează și copiază datele manual.",
                          ),
                        );
                      }
                    }}
                  >
                    <span className="contact-icon">
                      <Icon size={20} />
                    </span>
                    <span className="contact-text">
                      <small>
                        {locale === "en" && labelEn ? labelEn : t(label)}
                      </small>
                      <strong>{value}</strong>
                    </span>
                    <Copy size={16} />
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {p.demo !== false && (
          <div className="detail-demo">
            <Info size={14} />
            {t("Informații și fotografii demonstrative.")}
          </div>
        )}
      </div>
      <BookingBar place={p} fields={actionFields} onDemo={onDemo} />
    </div>
  );
}
