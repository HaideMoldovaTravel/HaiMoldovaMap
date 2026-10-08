"use client";
import { useI18n } from "@/features/i18n/provider";

/* eslint-disable @next/next/no-img-element */
import { ArrowRight, Heart, MapPin, Sparkles, Star } from "lucide-react";
import { categories } from "@/features/places/data";
import type { Place } from "@/features/places/types";
import { categoryIcons } from "./icons";
export function PlaceCard({
  place: p,
  saved,
  onSave,
  onSelect,
}: {
  place: Place;
  saved: boolean;
  onSave: () => void;
  onSelect: () => void;
}) {
  const { t } = useI18n();

  const Icon = categoryIcons[p.category];
  return (
    <article className="place-card">
      <div className="card-image">
        <button
          className="image-open"
          aria-label={t("Vezi {{name}}", { name: p.name })}
          onClick={onSelect}
        >
          <img
            src={p.image}
            alt={t("Fotografie ilustrativă pentru {{name}}", { name: p.name })}
            loading="lazy"
          />
        </button>
        {p.featured && (
          <span className="recommended-badge">
            <Sparkles size={11} />
            {t("De neratat")}
          </span>
        )}
        <button
          className={`save-button ${saved ? "saved" : ""}`}
          aria-label={
            saved
              ? t("Elimină {{name}} din salvate", { name: p.name })
              : t("Salvează {{name}}", { name: p.name })
          }
          onClick={onSave}
        >
          <Heart size={17} fill={saved ? "currentColor" : "none"} />
        </button>
        <span className="image-category">
          <Icon size={12} />
          {t(categories.find((c) => c.id === p.category)?.label)}
        </span>
      </div>
      <button className="card-body" onClick={onSelect}>
        <div className="card-title">
          <h2>{p.name}</h2>
          <span>
            <Star size={13} fill="currentColor" />
            {p.rating.toFixed(1)} <small>({p.reviews})</small>
          </span>
        </div>
        <div className="card-location">
          <MapPin size={12} />
          {p.village}
        </div>
        <div className="card-tags">
          {p.tags.slice(0, 2).map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="card-price">
          {p.price > 0 ? (
            <>
              <strong>{t("De la {{price}} MDL", { price: p.price })}</strong>
              <span>/ {p.priceLabel}</span>
            </>
          ) : (
            <strong>{t("Acces liber")}</strong>
          )}
          <ArrowRight size={15} />
        </div>
      </button>
    </article>
  );
}
