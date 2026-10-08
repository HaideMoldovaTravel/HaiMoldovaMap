import type { Locale } from "@/features/i18n/messages";
import { translate } from "@/features/i18n/translate";
import type { MapPoint, MapRoute, Coordinates } from "./types";
async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Serviciul nu este disponibil momentan.");
  return data;
}
export function searchAddress(query: string, signal?: AbortSignal) {
  return fetchJson<MapPoint[]>(
    `/api/map/search?q=${encodeURIComponent(query)}`,
    signal,
  );
}
export function calculateRoutes(
  from: Coordinates,
  to: Coordinates,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    from: from.join(","),
    to: to.join(","),
  });
  return fetchJson<MapRoute[]>(`/api/map/route?${params}`, signal);
}
export function formatDistance(meters: number, locale: Locale = "ro") {
  return meters < 1000
    ? `${Math.round(meters)} ${locale === "ru" ? "м" : "m"}`
    : `${(meters / 1000).toFixed(1)} ${locale === "ru" ? "км" : "km"}`;
}
export function formatDuration(seconds: number, locale: Locale = "ro") {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 60
    ? `${minutes} ${locale === "ru" ? "мин" : "min"}`
    : `${Math.floor(minutes / 60)} ${locale === "ru" ? "ч" : "h"} ${minutes % 60} ${locale === "ru" ? "мин" : "min"}`;
}
export function maneuverLabel(
  step: {
    name: string;
    maneuver: { type: string; modifier?: string; exit?: number };
  },
  locale: Locale = "ro",
) {
  const t = (text: string, params?: Record<string, string | number>) =>
    translate(text, locale, params);
  const { type, modifier } = step.maneuver;
  const road = step.name ? ` ${t("pe {{road}}", { road: step.name })}` : "";
  if (type === "depart") return t("Pornește") + road;
  if (type === "arrive") return t("Ai ajuns la destinație");
  if (type === "exit roundabout" || type === "exit rotary")
    return t("Ieși din sensul giratoriu") + road;
  if (type === "roundabout" || type === "rotary" || type === "roundabout turn")
    return step.maneuver.exit
      ? t("La sensul giratoriu, ia ieșirea {{exit}}", {
          exit: step.maneuver.exit,
        }) + (step.name ? ` ${t("spre {{road}}", { road: step.name })}` : "")
      : t("Intră în sensul giratoriu");
  const directions: Record<string, string> = {
    left: "la stânga",
    right: "la dreapta",
    "slight left": "ușor la stânga",
    "slight right": "ușor la dreapta",
    "sharp left": "strâns la stânga",
    "sharp right": "strâns la dreapta",
    straight: "înainte",
    uturn: "înapoi",
  };
  return (
    (modifier && modifier !== "straight"
      ? t("Virează {{direction}}", {
          direction: t(directions[modifier] || modifier),
        })
      : t("Continuă înainte")) + road
  );
}
