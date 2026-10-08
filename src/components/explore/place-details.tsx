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
  MessageCircle,
  Info,
} from "lucide-react";
import { mockContacts } from "@/features/places/contacts";
import { categories } from "@/features/places/data";
import type { Place } from "@/features/places/types";
import { categoryColors } from "./icons";
export function PlaceDetails({
  place: p,
  saved,
  onSave,
  onClose,
  onDemo,
  onRoute,
}: {
  place: Place;
  saved: boolean;
  onSave: () => void;
  onClose: () => void;
  onDemo: (message: string) => void;
  onRoute: () => void;
}) {
  const { t } = useI18n();

  const [photo, setPhoto] = useState(0);
  const [tab, setTab] = useState("about");
  useEffect(() => {
    queueMicrotask(() => {
      setPhoto(0);
      setTab("about");
    });
  }, [p.id]);
  return (
    <div className="place-details">
      <button className="back-button" onClick={onClose}>
        <ArrowLeft size={16} />
        {t("Înapoi la locuri")}
      </button>
      <div className="detail-gallery">
        <img
          src={p.images[photo]}
          alt={t("Imagine ilustrativă {{name}}", { name: p.name })}
        />
        <button
          className={`save-button ${saved ? "saved" : ""}`}
          aria-label={t("Salvează locația")}
          onClick={onSave}
        >
          <Heart size={18} fill={saved ? "currentColor" : "none"} />
        </button>
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
          style={{ color: categoryColors[p.category] }}
        >
          {t(categories.find((c) => c.id === p.category)?.label)}
        </span>
        <h1>{p.name}</h1>
        <div className="detail-rating">
          <Star size={15} fill="currentColor" />
          {p.rating}{" "}
          <span>
            ({p.reviews} {t("recenzii demonstrative")})
          </span>
        </div>
        <p className="card-location">
          <MapPin size={14} />
          {p.village}
        </p>
        <div className="detail-actions">
          <button className="primary-button" onClick={onRoute}>
            <Navigation size={16} />
            {t("Traseu")}
          </button>
          <button className="secondary-button" onClick={onSave}>
            {saved ? <Check size={16} /> : <Bookmark size={16} />}{" "}
            {saved ? t("Salvat") : t("Salvează")}
          </button>
        </div>
        <div className="detail-tabs">
          <button
            className={tab === "about" ? "active" : ""}
            onClick={() => setTab("about")}
          >
            {t("Despre loc")}
          </button>
          <button
            className={tab === "contacts" ? "active" : ""}
            onClick={() => setTab("contacts")}
          >
            {t("Contacte")}
          </button>
        </div>
        {tab === "about" ? (
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
            <div className="detail-fact">
              <Bookmark size={19} />
              <div>
                <strong>
                  {p.price
                    ? t("De la {{price}} MDL", { price: p.price })
                    : t("Acces liber")}
                </strong>
                <span>
                  {p.priceLabel} · {t("preț demonstrativ")}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="contacts">
            <div className="contact-heading">
              <h2>{t("Contactează gazda")}</h2>
              <span className="contact-demo-badge">DEMO</span>
            </div>
            <p className="contact-intro">
              {t(
                "Date ilustrative pentru prezentare. Nu aparțin locației reale.",
              )}
            </p>
            <div className="contact-list">
              {[
                {
                  icon: Phone,
                  label: t("Telefon"),
                  value: mockContacts[p.id].phone,
                },
                {
                  icon: Globe,
                  label: t("Website"),
                  value: mockContacts[p.id].website,
                },
                {
                  icon: Mail,
                  label: t("Email"),
                  value: mockContacts[p.id].email,
                },
                {
                  icon: MapPin,
                  label: t("Adresă"),
                  value: mockContacts[p.id].address,
                },
              ].map(({ icon: Icon, label, value }) => (
                <button
                  key={label}
                  className="contact-row"
                  title={t("Copiază")}
                  onClick={async () => {
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
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </span>
                  <Copy size={16} />
                </button>
              ))}
            </div>
            <div className="social-contacts">
              {["WhatsApp", "Viber"].map((channel) => (
                <button
                  key={channel}
                  className={`social-contact ${channel.toLowerCase()}`}
                  onClick={() =>
                    onDemo(
                      `${channel} · ${t("contact demonstrativ")} · ${mockContacts[p.id].phone}`,
                    )
                  }
                >
                  <MessageCircle size={21} />
                  <span>
                    <strong>{channel}</strong>
                    <small>{mockContacts[p.id].phone}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="detail-demo">
          <Info size={14} />
          {t("Informații și fotografii demonstrative.")}
        </div>
      </div>
    </div>
  );
}
