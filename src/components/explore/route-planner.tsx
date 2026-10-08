"use client";
import { useI18n } from "@/features/i18n/provider";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  Car,
  ChevronDown,
  LoaderCircle,
  LocateFixed,
  Route,
  X,
} from "lucide-react";
import {
  calculateRoutes,
  formatDistance,
  formatDuration,
  maneuverLabel,
} from "@/features/map/client";
import type { MapPoint, MapRoute } from "@/features/map/types";
import { AddressPicker, chisinau } from "./address-picker";
export function RoutePlanner({
  destination,
  onClose,
  onRoute,
}: {
  destination: MapPoint | null;
  onClose: () => void;
  onRoute: (route: MapRoute | null, points?: [MapPoint, MapPoint]) => void;
}) {
  const { t, locale } = useI18n();

  const [from, setFrom] = useState<MapPoint | null>(chisinau);
  const [to, setTo] = useState<MapPoint | null>(destination);
  const [routes, setRoutes] = useState<MapRoute[]>([]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stepsOpen, setStepsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current?.abort();
    queueMicrotask(() => {
      setTo(destination);
      setCollapsed(false);
      setRoutes([]);
      setBusy(false);
      setError("");
    });
    onRoute(null);
  }, [destination, onRoute]);
  useEffect(() => () => controller.current?.abort(), []);
  const clear = () => {
    controller.current?.abort();
    setBusy(false);
    setRoutes([]);
    setError("");
    onRoute(null);
  };
  const calculate = async () => {
    if (!from || !to) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError("");
    setRoutes([]);
    onRoute(null);
    try {
      const found = await calculateRoutes(
        from.coordinates,
        to.coordinates,
        current.signal,
      );
      if (current.signal.aborted) return;
      setRoutes(found);
      setCollapsed(window.matchMedia("(max-width:760px)").matches);
      setActive(0);
      onRoute(found[0], [from, to]);
    } catch (e) {
      if (!current.signal.aborted)
        setError(
          e instanceof Error ? e.message : t("Nu am putut calcula traseul."),
        );
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  };
  return (
    <section
      className={`route-planner ${collapsed ? "compact-route" : ""}`}
      aria-label={t("Planifică un traseu")}
    >
      <header>
        <div>
          <span className="eyebrow">{t("HAI LA DRUM")}</span>
          <h2>
            <Route size={19} />
            {t("Planifică o escapadă")}
          </h2>
        </div>
        <button
          aria-label={t("Închide traseul")}
          onClick={() => {
            onRoute(null);
            onClose();
          }}
        >
          <X size={20} />
        </button>
      </header>
      {collapsed && (
        <button className="edit-route" onClick={() => setCollapsed(false)}>
          {t("Modifică traseul")}
          <ChevronDown size={14} />
        </button>
      )}
      <div className="route-fields">
        <div className="route-mode">
          <Car size={16} />
          <strong>{t("Cu mașina")}</strong>
          <span>{t("Traseu pe drumuri reale")}</span>
        </div>
        <AddressPicker
          label="Punct de plecare"
          value={from}
          onChange={(p) => {
            setFrom(p);
            clear();
          }}
        />
        <button
          className="swap-route"
          title={t("Inversează punctele")}
          onClick={() => {
            setFrom(to);
            setTo(from);
            clear();
          }}
        >
          <ArrowDownUp size={14} />
        </button>
        <AddressPicker
          label="Destinație"
          value={to}
          onChange={(p) => {
            setTo(p);
            clear();
          }}
        />
        <button
          className="use-location"
          onClick={() => {
            if (!navigator.geolocation) {
              setError(t("Localizarea nu este disponibilă."));
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (p) => {
                setFrom({
                  id: "my-location",
                  label: t("Locația mea"),
                  coordinates: [p.coords.latitude, p.coords.longitude],
                });
                clear();
              },
              () =>
                setError(
                  t(
                    "Permite localizarea în browser pentru a folosi această opțiune.",
                  ),
                ),
              { timeout: 10000 },
            );
          }}
        >
          <LocateFixed size={13} />
          {t("Pleacă din locația mea")}
        </button>
        <button
          className="primary-button calculate-route"
          disabled={!from || !to || busy}
          onClick={() => void calculate()}
        >
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Route size={17} />
          )}{" "}
          {busy ? t("Calculăm traseul…") : t("Calculează traseul")}{" "}
          {!busy && <ArrowRight size={16} />}
        </button>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {t(error)}
        </p>
      )}
      {routes.length > 0 && (
        <div className="route-results">
          {routes.map((r, i) => (
            <button
              key={i}
              className={`route-option ${active === i ? "active" : ""}`}
              onClick={() => {
                setActive(i);
                onRoute(r, [from!, to!]);
              }}
            >
              <Car size={19} />
              <div>
                <strong>{formatDuration(r.duration, locale)}</strong>
                <span>
                  {i === 0 ? t("Traseu recomandat") : t("Variantă alternativă")}
                </span>
              </div>
              <b>{formatDistance(r.distance, locale)}</b>
            </button>
          ))}
          <button
            className="route-steps-toggle"
            onClick={() => setStepsOpen(!stepsOpen)}
          >
            {t("Indicații pas cu pas")}{" "}
            <ChevronDown
              size={14}
              style={{ rotate: stepsOpen ? "180deg" : "0deg" }}
            />
          </button>
          {stepsOpen && (
            <ol className="route-steps">
              {routes[active].steps.map((s, i) => (
                <li key={i}>
                  <span>{maneuverLabel(s, locale)}</span>
                  <small>{formatDistance(s.distance, locale)}</small>
                </li>
              ))}
            </ol>
          )}
          <p className="route-footnote">
            {t(
              "Durată estimată, fără trafic în timp real. Traseu: OSRM · date OpenStreetMap.",
            )}
          </p>
        </div>
      )}
    </section>
  );
}
