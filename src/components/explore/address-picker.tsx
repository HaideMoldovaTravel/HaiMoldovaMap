"use client";
import { useI18n } from "@/features/i18n/provider";

import { useEffect, useRef, useState } from "react";
import { Search, MapPin, LoaderCircle, Check } from "lucide-react";
import { searchAddress } from "@/features/map/client";
import type { MapPoint } from "@/features/map/types";
import { localizePlace } from "@/features/places/localization";
import { places, normalize } from "@/features/places/data";
export const chisinau: MapPoint = {
  id: "chisinau",
  label: "Chișinău, centrul orașului",
  coordinates: [47.0245, 28.8353],
};
export const localPoints: MapPoint[] = [
  chisinau,
  ...places.map((p) => ({
    id: p.id,
    label: p.name,
    coordinates: p.coordinates,
  })),
];
export function AddressPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MapPoint | null;
  onChange: (point: MapPoint | null) => void;
}) {
  const { t, locale } = useI18n();

  const [query, setQuery] = useState(t(value?.label || ""));
  const [results, setResults] = useState<MapPoint[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    if (value)
      queueMicrotask(() => {
        const known = places.find((p) => p.id === value.id);
        setQuery(known ? localizePlace(known, locale).name : t(value.label));
        setResults([]);
        setError("");
      });
  }, [value, locale, t]);
  useEffect(() => () => controller.current?.abort(), []);
  const translatedPoints = [
    { ...chisinau, label: t(chisinau.label) },
    ...places.map((place) => ({
      id: place.id,
      label: localizePlace(place, locale).name,
      coordinates: place.coordinates,
    })),
  ];
  const suggestions = translatedPoints
    .filter((p) => normalize(p.label).includes(normalize(query)))
    .slice(0, 5);
  const search = async () => {
    if (query.trim().length < 2) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError("");
    setOpen(true);
    try {
      const found = await searchAddress(query, current.signal);
      setResults(found);
      if (!found.length)
        setError(t("Nicio adresă găsită. Încearcă numele localității."));
    } catch (e) {
      if (!current.signal.aborted)
        setError(e instanceof Error ? e.message : t("Căutarea a eșuat."));
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  };
  const pick = (point: MapPoint) => {
    controller.current?.abort();
    setBusy(false);
    onChange(point);
    setQuery(point.label);
    setOpen(false);
  };
  return (
    <div className="address-picker">
      <label>
        {t(label)}
        <div className={`address-input ${value ? "resolved" : ""}`}>
          <MapPin size={15} />
          <input
            value={query}
            aria-label={t(label)}
            placeholder={t("Localitate, adresă sau locație")}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              controller.current?.abort();
              setBusy(false);
              setQuery(e.target.value);
              setResults([]);
              if (value) onChange(null);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              }
              if (e.key === "Escape") setOpen(false);
            }}
          />
          {value ? (
            <Check size={15} />
          ) : (
            <button
              aria-label={t("Caută {{label}}", {
                label: t(label).toLowerCase(),
              })}
              disabled={busy || query.trim().length < 2}
              onClick={() => void search()}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Search size={16} />
              )}
            </button>
          )}
        </div>
      </label>
      {open && (
        <div className="address-suggestions">
          <button className="suggestion-dismiss" onClick={() => setOpen(false)}>
            {t("Închide lista")}
          </button>
          {(results.length ? results : suggestions).map((p) => (
            <button key={p.id} onClick={() => pick(p)}>
              <MapPin size={13} />
              <span>{p.label}</span>
            </button>
          ))}
          {error && <p className="inline-error">{t(error)}</p>}
          {!value && query.length > 1 && !results.length && (
            <button
              className="search-address-action"
              onClick={() => void search()}
              disabled={busy}
            >
              <Search size={13} /> {t("Caută „{{query}}” pe hartă", { query })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
