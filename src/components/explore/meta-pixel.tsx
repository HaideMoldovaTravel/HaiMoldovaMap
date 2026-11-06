"use client";

import { Cookie } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/features/i18n/provider";

const META_PIXEL_ID = "4602879636619991";
const CONSENT_KEY = "hai-moldova-marketing-consent";

const actions = new Map([
  ["whatsapp", { event: "Contact", method: "whatsapp" }],
  ["phone", { event: "Contact", method: "phone" }],
  ["booking_url", { event: "Schedule", method: "booking_link" }],
  ["haide_url", { event: "Schedule", method: "booking_link" }],
]);

type Pixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: (...args: unknown[]) => void;
  loaded: boolean;
  version: string;
  disablePushState: boolean;
};

declare global {
  interface Window {
    fbq?: Pixel;
    _fbq?: Pixel;
  }
}

function initializePixel() {
  if (window.fbq) return window.fbq;

  const pixel: Pixel = Object.assign(
    (...args: unknown[]) => {
      if (pixel.callMethod) {
        pixel.callMethod(...args);
      } else {
        pixel.queue.push(args);
      }
    },
    {
      queue: [],
      push: (...args: unknown[]) => pixel(...args),
      loaded: true,
      version: "2.0",
      disablePushState: true,
    },
  );
  window.fbq = window._fbq = pixel;
  pixel("set", "autoConfig", false, META_PIXEL_ID);
  pixel("init", META_PIXEL_ID);

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  return pixel;
}

function trackBookingClick(event: MouseEvent) {
  // Demonstration links cancel navigation in their React click handler.
  if (event.defaultPrevented || !(event.target instanceof Element)) return;
  const link = event.target.closest("a.booking-action");
  if (!link) return;

  for (const [className, action] of actions) {
    if (!link.classList.contains(className)) continue;
    const name = link.closest(".place-details")?.querySelector("h1");
    window.fbq?.("track", action.event, {
      content_name: name?.textContent?.trim() ?? "",
      content_category: "map.haide.md",
      method: action.method,
    });
    return;
  }
}

type Consent = "granted" | "denied" | null;

function readConsent(value: string | null): Consent {
  return value === "granted" || value === "denied" ? value : null;
}

export function MetaPixel() {
  const { t } = useI18n();
  const [consent, setConsent] = useState<Consent>(null);
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    let saved: Consent = null;
    try {
      saved = readConsent(localStorage.getItem(CONSENT_KEY));
    } catch {}
    const initialConsent = saved;
    queueMicrotask(() => {
      setConsent(initialConsent);
      setShowPreferences(initialConsent === null);
    });

    function syncConsent(event: StorageEvent) {
      if (event.key !== CONSENT_KEY && event.key !== null) return;
      const choice = readConsent(event.newValue);
      if (choice !== "granted") window.fbq?.("consent", "revoke");
      setConsent(choice);
      setShowPreferences(choice === null);
    }
    window.addEventListener("storage", syncConsent);
    return () => window.removeEventListener("storage", syncConsent);
  }, []);

  useEffect(() => {
    if (consent !== "granted") return;
    const pixel = initializePixel();
    pixel("consent", "grant");
    pixel("track", "PageView");
    document.addEventListener("click", trackBookingClick);
    return () => document.removeEventListener("click", trackBookingClick);
  }, [consent]);

  function saveConsent(choice: Exclude<Consent, null>) {
    try {
      localStorage.setItem(CONSENT_KEY, choice);
    } catch {}
    if (choice === "denied") window.fbq?.("consent", "revoke");
    setConsent(choice);
    setShowPreferences(false);
  }

  return (
    <>
      <button
        type="button"
        className="marketing-preferences-button"
        aria-label={t("Preferințe de marketing")}
        title={t("Preferințe de marketing")}
        aria-expanded={showPreferences}
        onClick={() => setShowPreferences(!showPreferences)}
      >
        <Cookie size={19} />
      </button>
      {showPreferences && (
        <section
          className="marketing-preferences"
          aria-labelledby="marketing-preferences-title"
        >
          <h2 id="marketing-preferences-title">
            {t("Preferințe de marketing")}
          </h2>
          <p>
            {t("Cu acordul tău, folosim Meta Pixel pentru a măsura eficiența reclamelor și clickurile pe rezervare, WhatsApp și telefon.")}
          </p>
          <div className="marketing-preferences-actions">
            <button type="button" onClick={() => saveConsent("denied")}>
              {t("Refuză")}
            </button>
            <button type="button" onClick={() => saveConsent("granted")}>
              {t("Acceptă")}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
