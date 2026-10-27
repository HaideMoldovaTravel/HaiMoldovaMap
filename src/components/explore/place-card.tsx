"use client";
import { useI18n } from "@/features/i18n/provider";

/* eslint-disable @next/next/no-img-element */
import { ArrowRight, Heart, MapPin, Sparkles, Star } from "lucide-react";
import { categories } from "@/features/places/data";
import type { Place } from "@/features/places/types";
import { formatPlacePrice } from "@/features/places/presentation";
import { categoryIcons } from "./icons";
export function PlaceCard({
  place: p,
  saved,
  onSave,
  onSelect,
  showSave = true,
  showPrice = true,
}: {
  place: Place;
  saved: boolean;
  onSave: () => void;
  onSelect: () => void;
  showSave?: boolean;
  showPrice?: boolean;
}) {
  const { t, locale } = useI18n();

  const Icon = categoryIcons[p.category] ?? categoryIcons.all;
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
            alt={
              p.imageAlts?.[0] ||
              (p.demo === false
                ? p.name
                : t("Fotografie ilustrativă pentru {{name}}", { name: p.name }))
            }
            loading="lazy"
          />
        </button>
        {p.featured && (
          <span className="recommended-badge">
            <Sparkles size={11} />
            {t("De neratat")}
          </span>
        )}
        {showSave && (
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
        )}
        <span className="image-category">
          {p.categoryIcon ? (
            <img
              src={p.categoryIcon}
              alt=""
              width={12}
              height={12}
              style={{ objectFit: "contain" }}
            />
          ) : (
            <Icon size={12} />
          )}
          {(locale === "en" ? p.categoryLabelEn : p.categoryLabel) ??
            t(categories.find((c) => c.id === p.category)?.label)}
        </span>
      </div>
      <button className="card-body" onClick={onSelect}>
        <div className="card-title">
          <h2>{p.name}</h2>
          {p.reviews > 0 && (
            <span>
              <Star size={13} fill="currentColor" />
              {p.rating.toFixed(1)} <small>({p.reviews})</small>
            </span>
          )}
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
          {showPrice ? (
            <>
              <strong>{formatPlacePrice(p, t)}</strong>
              {p.price > 0 && <span>/ {p.priceLabel}</span>}
            </>
          ) : (
            <strong>{t("Vezi detalii")}</strong>
          )}
          <ArrowRight size={15} />
        </div>
      </button>
    </article>
  );
}
