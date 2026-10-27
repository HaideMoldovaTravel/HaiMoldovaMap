import type { Place } from "./types";
export function formatPlacePrice(
  place: Place,
  t: (value: string, params?: Record<string, string | number>) => string,
) {
  if (place.priceMode === "Gratuit") return t("Acces liber");
  if (place.priceMode === "La cerere" || place.priceMode === "Necunoscut")
    return t("Preț la cerere");
  if (place.price > 0)
    return `${place.priceMode !== "Fix" ? t("De la") : ""} ${place.price} ${place.currency ?? "MDL"}`.trim();
  return place.demo === false ? t("Preț la cerere") : t("Acces liber");
}
export function contactHref(
  type: string,
  value: string,
  id?: string,
): string | undefined {
  if (id === "viber") return undefined;
  if (id === "whatsapp" || type === "phone") {
    let digits = value.replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    // Moldovan local numbers use a leading zero; messaging requires country code.
    if (/^0\d{8}$/.test(digits)) digits = `373${digits.slice(1)}`;
    if (digits.length < 8 || digits.length > 15) return undefined;
    return id === "whatsapp" ? `https://wa.me/${digits}` : `tel:+${digits}`;
  }
  if (type === "email") return `mailto:${encodeURIComponent(value)}`;
  if (type === "url") {
    try {
      const url = new URL(value);
      if (["http:", "https:"].includes(url.protocol)) return url.href;
    } catch {}
  }
}
