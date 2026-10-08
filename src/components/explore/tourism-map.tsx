"use client";
import { useI18n } from "@/features/i18n/provider";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup, TileLayer } from "leaflet";
import {
  Plus,
  Minus,
  LocateFixed,
  Layers,
  Maximize,
  Map as MapIcon,
  Satellite,
  Route,
  MapPin,
  X,
  Navigation,
  Check,
} from "lucide-react";
import type { Place } from "@/features/places/types";
import type { MapPoint, MapRoute } from "@/features/map/types";
import { mapLayers, type MapLayerId } from "@/features/map/config";
import { categoryColors } from "./icons";
import { RoutePlanner } from "./route-planner";
const markerPaths: Record<string, string> = {
  winery: '<path d="M8 3h8l-1 7a4 4 0 0 1-6 0L8 3zm4 11v7m-4 0h8M9 7h6"/>',
  stay: '<path d="M3 18V8m18 10V8M3 14h18M6 14V7h12v7M3 18v3m18-3v3"/>',
  nature: '<path d="m12 3-7 9h4l-5 6h16l-5-6h4L12 3zm0 15v4"/>',
  culture: '<path d="m3 8 9-5 9 5H3zm2 3v7m7-7v7m7-7v7M3 21h18"/>',
  experience: '<path d="m4 17 5-10 5 7 3-5 4 8H4zm5-10 2-4 4 6"/>',
  food: '<path d="M5 3v6c0 3 4 3 4 0V3M7 3v18M18 3c-5 5-5 10 0 10v8V3"/>',
};
export default function TourismMap({
  places,
  selectedId,
  onSelect,
  searchPoint,
  routeDestination,
}: {
  places: Place[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchPoint: MapPoint | null;
  routeDestination: MapPoint | null;
}) {
  const { t } = useI18n();

  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef<LayerGroup | null>(null);
  const routeLayer = useRef<LayerGroup | null>(null);
  const searchLayer = useRef<LayerGroup | null>(null);
  const userLayer = useRef<LayerGroup | null>(null);
  const tile = useRef<TileLayer | null>(null);
  const [ready, setReady] = useState(false);
  const [layer, setLayer] = useState<MapLayerId>("standard");
  const [showPlaces, setShowPlaces] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [error, setError] = useState("");
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [destination, setDestination] = useState<MapPoint | null>(null);
  const [route, setRoute] = useState<{
    route: MapRoute;
    points: [MapPoint, MapPoint];
  } | null>(null);
  const updateRoute = useCallback(
    (route: MapRoute | null, points?: [MapPoint, MapPoint]) =>
      setRoute(route && points ? { route, points } : null),
    [],
  );
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    import("leaflet").then((L) => {
      if (cancelled || !container.current) return;
      map.current = L.map(container.current, {
        zoomControl: false,
        attributionControl: true,
        minZoom: 5,
        maxZoom: 19,
      }).setView([47.08, 28.65], 8);
      markers.current = L.layerGroup().addTo(map.current);
      routeLayer.current = L.layerGroup().addTo(map.current);
      searchLayer.current = L.layerGroup().addTo(map.current);
      userLayer.current = L.layerGroup().addTo(map.current);
      observer = new ResizeObserver(() => map.current?.invalidateSize());
      observer.observe(container.current);
      setReady(true);
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled) return;
      tile.current?.remove();
      const config = mapLayers.find((l) => l.id === layer)!;
      tile.current = L.tileLayer(config.url, {
        attribution: config.attribution,
        maxZoom: config.maxZoom,
        keepBuffer: 1,
      })
        .on("tileerror", () =>
          setError(
            "Un strat al hărții nu se poate încărca. Verifică conexiunea sau schimbă stratul.",
          ),
        )
        .addTo(map.current!);
    });
    return () => {
      cancelled = true;
    };
  }, [layer, ready]);
  useEffect(() => {
    if (!ready || !markers.current) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled) return;
      markers.current?.clearLayers();
      if (!showPlaces) return;
      places.forEach((p) => {
        const selected = p.id === selectedId;
        const icon = L.divIcon({
          className: "tourism-marker-wrap",
          html: `<div class="tourism-marker ${selected ? "selected" : ""}" style="--pin-color:${categoryColors[p.category]}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${markerPaths[p.category]}</svg></div>`,
          iconSize: [42, 48],
          iconAnchor: [21, 43],
          tooltipAnchor: [0, -42],
        });
        L.marker(p.coordinates, {
          icon,
          title: p.name,
          alt: p.name,
          zIndexOffset: selected ? 1000 : 0,
        })
          .bindTooltip(p.name, { direction: "top", className: "place-tooltip" })
          .on("click", () => onSelect(p.id))
          .addTo(markers.current!);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [places, selectedId, onSelect, showPlaces, ready]);
  const selectedPlace = places.find((p) => p.id === selectedId);
  const selectedLat = selectedPlace?.coordinates[0];
  const selectedLng = selectedPlace?.coordinates[1];
  useEffect(() => {
    if (!ready || selectedLat === undefined || selectedLng === undefined)
      return;
    map.current?.flyTo(
      [selectedLat, selectedLng],
      Math.max(map.current.getZoom(), 10),
      { duration: 0.8 },
    );
  }, [selectedId, selectedLat, selectedLng, ready]);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled) return;
      searchLayer.current?.clearLayers();
      if (searchPoint && map.current) {
        const tooltip = document.createElement("span");
        tooltip.textContent = searchPoint.label;
        L.circleMarker(searchPoint.coordinates, {
          radius: 10,
          color: "#fff",
          weight: 3,
          fillColor: "#377dbc",
          fillOpacity: 1,
        })
          .bindTooltip(tooltip, {
            direction: "top",
            className: "place-tooltip",
          })
          .addTo(searchLayer.current!);
        map.current.flyTo(searchPoint.coordinates, 13);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [searchPoint, ready]);
  useEffect(() => {
    if (!routeDestination) {
      queueMicrotask(() => {
        setDestination(null);
        setPlannerOpen(false);
        setRoute(null);
      });
      return;
    }
    queueMicrotask(() => {
      setDestination(routeDestination);
      setPlannerOpen(true);
    });
  }, [routeDestination]);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled) return;
      routeLayer.current?.clearLayers();
      if (!route || !map.current) return;
      const coordinates = route.route.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng] as [number, number],
      );
      L.polyline(coordinates, {
        color: "#fff",
        weight: 9,
        opacity: 0.95,
      }).addTo(routeLayer.current!);
      const line = L.polyline(coordinates, {
        color: "#3776c5",
        weight: 5,
        opacity: 1,
        lineCap: "round",
      }).addTo(routeLayer.current!);
      route.points.forEach((p, i) => {
        const el = document.createElement("span");
        el.textContent = p.label;
        L.circleMarker(p.coordinates, {
          radius: 8,
          color: "#fff",
          weight: 3,
          fillColor: i === 0 ? "#245b48" : "#3776c5",
          fillOpacity: 1,
        })
          .bindTooltip(el, { className: "place-tooltip" })
          .addTo(routeLayer.current!);
      });
      const mobile = map.current.getSize().x <= 600;
      const panelWidth = mobile ? 25 : 350;
      map.current.fitBounds(line.getBounds(), {
        paddingTopLeft: [panelWidth, mobile ? 140 : 100],
        paddingBottomRight: [55, mobile ? 290 : 95],
        maxZoom: 13,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [route, ready]);
  const openPlanner = (point?: MapPoint | null) => {
    setDestination(point || null);
    setPlannerOpen(true);
  };
  const locate = () => {
    if (!navigator.geolocation) {
      setError(t("Localizarea nu este disponibilă."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const L = await import("leaflet");
        if (!map.current) return;
        const coords: [number, number] = [
          p.coords.latitude,
          p.coords.longitude,
        ];
        userLayer.current?.clearLayers();
        L.circle(coords, {
          radius: p.coords.accuracy,
          color: "#377dbc",
          weight: 1,
          fillOpacity: 0.08,
        }).addTo(userLayer.current!);
        L.circleMarker(coords, {
          radius: 7,
          color: "#fff",
          weight: 3,
          fillColor: "#377dbc",
          fillOpacity: 1,
        })
          .bindTooltip(t("Locația mea"))
          .addTo(userLayer.current!);
        map.current.flyTo(coords, 12);
        setError("");
      },
      () =>
        setError(
          t("Nu am putut accesa locația. Permite localizarea în browser."),
        ),
      { timeout: 10000 },
    );
  };
  return (
    <div className={`map-shell ${plannerOpen ? "planning-route" : ""}`}>
      <div
        ref={container}
        className="map-canvas"
        aria-label={t("Harta interactivă OpenStreetMap a Moldovei")}
      />
      {!ready && (
        <div className="map-loading">
          <MapIcon size={28} />
          <span>{t("Pregătim harta Moldovei…")}</span>
        </div>
      )}
      <div className="map-note">
        <span className="live-dot" />
        {t("O țară mică. O mulțime de povești.")}
      </div>
      <div className="map-tools">
        <button
          title={t("Planifică un traseu")}
          onClick={() => openPlanner(searchPoint)}
        >
          <Route size={19} />
        </button>
        <button
          title={t("Arată întreaga hartă")}
          onClick={() => map.current?.flyTo([47.08, 28.65], 8)}
        >
          <Maximize size={19} />
        </button>
        <button title={t("Locația mea")} onClick={locate}>
          <LocateFixed size={19} />
        </button>
        <div className="zoom-tools">
          <button
            title={t("Mărește harta")}
            onClick={() => map.current?.zoomIn()}
          >
            <Plus size={20} />
          </button>
          <button
            title={t("Micșorează harta")}
            onClick={() => map.current?.zoomOut()}
          >
            <Minus size={20} />
          </button>
        </div>
      </div>
      <div className="layers-control">
        <button
          className="layer-button"
          onClick={() => setLayersOpen(!layersOpen)}
          aria-expanded={layersOpen}
        >
          <span
            className={`layer-thumbnail ${layer === "satellite" ? "satellite-thumb" : ""}`}
          />
          <Layers size={16} />
          {t("Straturi")}
        </button>
        {layersOpen && (
          <div className="layer-menu">
            <span className="eyebrow">{t("TIPUL HĂRȚII")}</span>
            <div className="layer-options">
              {mapLayers.map((l) => (
                <button
                  key={l.id}
                  className={layer === l.id ? "active" : ""}
                  onClick={() => {
                    setLayer(l.id);
                    setError("");
                  }}
                >
                  {l.id === "standard" ? (
                    <MapIcon size={20} />
                  ) : (
                    <Satellite size={20} />
                  )}{" "}
                  {t(l.label)}
                </button>
              ))}
            </div>
            <button
              className="layer-toggle"
              role="switch"
              aria-checked={showPlaces}
              onClick={() => setShowPlaces(!showPlaces)}
            >
              <MapPin size={15} />
              {t("Locații turistice")}{" "}
              <span className={showPlaces ? "on" : ""}>
                {showPlaces && <Check size={12} />}
              </span>
            </button>
            <small>{t("Hartă © OpenStreetMap · Satelit © Esri")}</small>
          </div>
        )}
      </div>
      <div className="map-country">
        <span>{t("EXPLOREAZĂ")}</span>
        <strong>{t("Moldova")}</strong>
        <small>47° N · 28° E</small>
      </div>
      {searchPoint && !plannerOpen && (
        <div className="searched-place">
          <MapPin size={20} />
          <div>
            <strong>{searchPoint.label.split(",")[0]}</strong>
            <small>{searchPoint.label}</small>
          </div>
          <button
            title={t("Traseu către acest loc")}
            onClick={() => openPlanner(searchPoint)}
          >
            <Navigation size={18} />
          </button>
        </div>
      )}
      {plannerOpen && (
        <RoutePlanner
          destination={destination}
          onClose={() => {
            setPlannerOpen(false);
            setRoute(null);
          }}
          onRoute={updateRoute}
        />
      )}
      {error && (
        <button className="map-error" onClick={() => setError("")}>
          {t(error)}
          <X size={14} />
        </button>
      )}
    </div>
  );
}
