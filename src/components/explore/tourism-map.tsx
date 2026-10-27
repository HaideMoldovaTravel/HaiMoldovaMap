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
const CLUSTER_CELL = 56;
const CLUSTER_MAX_ZOOM = 15;
const markerPaths: Record<string, string> = {
  winery: '<path d="M8 3h8l-1 7a4 4 0 0 1-6 0L8 3zm4 11v7m-4 0h8M9 7h6"/>',
  stay: '<path d="M3 18V8m18 10V8M3 14h18M6 14V7h12v7M3 18v3m18-3v3"/>',
  nature: '<path d="m12 3-7 9h4l-5 6h16l-5-6h4L12 3zm0 15v4"/>',
  culture: '<path d="m3 8 9-5 9 5H3zm2 3v7m7-7v7m7-7v7M3 21h18"/>',
  experience: '<path d="m4 17 5-10 5 7 3-5 4 8H4zm5-10 2-4 4 6"/>',
  food: '<path d="M5 3v6c0 3 4 3 4 0V3M7 3v18M18 3c-5 5-5 10 0 10v8V3"/>', // Categories created by scripts/import-places.ts (lucide icon paths).
  worship:
    '<path d="M10 9h4"/><path d="M12 7v5"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="m18 9 3.52 2.147a1 1 0 0 1 .48.854V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6.999a1 1 0 0 1 .48-.854L6 9"/><path d="M6 21V7a1 1 0 0 1 .376-.782l5-3.999a1 1 0 0 1 1.249.001l5 4A1 1 0 0 1 18 7v14"/>',
  monuments:
    '<path d="M10 5V3"/><path d="M14 5V3"/><path d="M15 21v-3a3 3 0 0 0-6 0v3"/><path d="M18 3v8"/><path d="M18 5H6"/><path d="M22 11H2"/><path d="M22 9v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9"/><path d="M6 3v8"/>',
  museums:
    '<path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M18 12h.01"/><path d="M18 16h.01"/><path d="M22 7a1 1 0 0 0-1-1h-2a2 2 0 0 1-1.143-.359L13.143 2.36a2 2 0 0 0-2.286-.001L6.143 5.64A2 2 0 0 1 5 6H3a1 1 0 0 0-1 1v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2z"/><path d="M6 12h.01"/><path d="M6 16h.01"/><circle cx="12" cy="10" r="2"/>',
  theatres:
    '<path d="M10 11h.01"/><path d="M14 6h.01"/><path d="M18 6h.01"/><path d="M6.5 13.1h.01"/><path d="M22 5c0 9-4 12-6 12s-6-3-6-12c0-2 2-3 6-3s6 1 6 3"/><path d="M17.4 9.9c-.8.8-2 .8-2.8 0"/><path d="M10.1 7.1C9 7.2 7.7 7.7 6 8.6c-3.5 2-4.7 3.9-3.7 5.6 4.5 7.8 9.5 8.4 11.2 7.4.9-.5 1.9-2.1 1.9-4.7"/><path d="M9.1 16.5c.3-1.1 1.4-1.7 2.4-1.4"/>',
  galleries:
    '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>',
  parks:
    '<path d="M8 19a4 4 0 0 1-2.24-7.32A3.5 3.5 0 0 1 9 6.03V6a3 3 0 1 1 6 0v.04a3.5 3.5 0 0 1 3.24 5.65A4 4 0 0 1 16 19Z"/><path d="M12 19v3"/>',
  markets:
    '<path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>',
  hotels:
    '<path d="M10 22v-6.57"/><path d="M12 11h.01"/><path d="M12 7h.01"/><path d="M14 15.43V22"/><path d="M15 16a5 5 0 0 0-6 0"/><path d="M16 11h.01"/><path d="M16 7h.01"/><path d="M8 11h.01"/><path d="M8 7h.01"/><rect x="4" y="2" width="16" height="20" rx="2"/>',
  resorts:
    '<circle cx="4" cy="4" r="2"/><path d="m14 5 3-3 3 3"/><path d="m14 10 3-3 3 3"/><path d="M17 14V2"/><path d="M17 14H7l-5 8h20Z"/><path d="M8 14v8"/><path d="m9 14 5 8"/>',
  cafes:
    '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  bars: '<path d="M17 11h1a3 3 0 0 1 0 6h-1"/><path d="M9 12v6"/><path d="M13 12v6"/><path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z"/><path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/>',
  "wine-bars":
    '<path d="M22 5V2l-5.89 5.89"/><circle cx="16.6" cy="15.89" r="3"/><circle cx="8.11" cy="7.4" r="3"/><circle cx="12.35" cy="11.65" r="3"/><circle cx="13.91" cy="5.85" r="3"/><circle cx="18.15" cy="10.09" r="3"/><circle cx="6.56" cy="13.2" r="3"/><circle cx="10.8" cy="17.44" r="3"/><circle cx="5" cy="19" r="3"/>',
  "tour-operators":
    '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
  shopping:
    '<path d="M16 10a4 4 0 0 1-8 0"/><path d="M3.103 6.034h17.794"/><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"/>',
};
export default function TourismMap({
  places,
  selectedId,
  onSelect,
  searchPoint,
  routeDestination,
  allowRoutes = true,
}: {
  places: Place[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchPoint: MapPoint | null;
  routeDestination: MapPoint | null;
  allowRoutes?: boolean;
}) {
  const { t } = useI18n();

  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef<LayerGroup | null>(null);
  const routeLayer = useRef<LayerGroup | null>(null);
  const searchLayer = useRef<LayerGroup | null>(null);
  const userLayer = useRef<LayerGroup | null>(null);
  const tile = useRef<TileLayer | null>(null);
  // Center to apply once a hidden map (mobile list view) becomes visible.
  const pendingView = useRef<[number, number] | null>(null);
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
      observer = new ResizeObserver(() => {
        const current = map.current;
        if (!current) return;
        current.invalidateSize();
        const size = current.getSize();
        if (pendingView.current && size.x && size.y) {
          current.setView(
            pendingView.current,
            Math.max(current.getZoom(), 10),
            {
              animate: false,
            },
          );
          pendingView.current = null;
        }
      });
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
    if (!ready || !markers.current || !map.current) return;
    let cancelled = false;
    const current = map.current;
    let render = () => {};
    import("leaflet").then((L) => {
      if (cancelled) return;
      const addPlace = (p: Place) => {
        const selected = p.id === selectedId;
        const glyph = p.categoryIcon
          ? `<img src="${p.categoryIcon}" width="21" height="21" style="object-fit:contain" alt=""/>`
          : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${markerPaths[p.category] ?? markerPaths.culture}</svg>`;
        const icon = L.divIcon({
          className: "tourism-marker-wrap",
          html: `<div class="tourism-marker ${selected ? "selected" : ""}" style="--pin-color:${p.categoryColor ?? categoryColors[p.category] ?? "#0f5a52"}">${glyph}</div>`,
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
          .bindTooltip(
            Object.assign(document.createElement("span"), {
              textContent: p.name,
            }),
            { direction: "top", className: "place-tooltip" },
          )
          .on("click", () => onSelect(p.id))
          .addTo(markers.current!);
      };
      // Places closer than CLUSTER_CELL pixels merge into one numbered bubble
      // so dense areas (central Chișinău) stay readable and clickable.
      const addCluster = (group: Place[]) => {
        const bounds = L.latLngBounds(group.map((p) => p.coordinates));
        const size = group.length < 10 ? 38 : group.length < 50 ? 46 : 54;
        const colors = [
          ...new Set(
            group.map(
              (p) => p.categoryColor ?? categoryColors[p.category] ?? "#0f5a52",
            ),
          ),
        ].slice(0, 4);
        const ring =
          colors.length > 1
            ? `conic-gradient(${colors.map((c, i) => `${c} ${(i * 100) / colors.length}% ${((i + 1) * 100) / colors.length}%`).join(",")})`
            : colors[0];
        const label = t("{{count}} locuri", { count: group.length });
        L.marker(bounds.getCenter(), {
          icon: L.divIcon({
            className: "tourism-marker-wrap",
            html: `<div class="tourism-cluster" style="--size:${size}px;--ring:${ring}"><span>${group.length}</span></div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          }),
          title: label,
          alt: label,
          keyboard: true,
        })
          .bindTooltip(label, { direction: "top", className: "place-tooltip" })
          .on("click", () =>
            current.fitBounds(bounds, {
              padding: [70, 70],
              maxZoom: CLUSTER_MAX_ZOOM + 1,
            }),
          )
          .addTo(markers.current!);
      };
      render = () => {
        markers.current?.clearLayers();
        if (!showPlaces) return;
        const zoom = current.getZoom();
        if (zoom > CLUSTER_MAX_ZOOM) return places.forEach(addPlace);
        const cells = new Map<string, Place[]>();
        for (const p of places) {
          if (p.id === selectedId) {
            addPlace(p);
            continue;
          }
          const point = current.project(p.coordinates, zoom);
          const key = `${Math.floor(point.x / CLUSTER_CELL)}:${Math.floor(point.y / CLUSTER_CELL)}`;
          cells.set(key, [...(cells.get(key) ?? []), p]);
        }
        for (const group of cells.values())
          if (group.length === 1) addPlace(group[0]);
          else addCluster(group);
      };
      render();
      current.on("zoomend", render);
    });
    return () => {
      cancelled = true;
      current.off("zoomend", render);
    };
  }, [places, selectedId, onSelect, showPlaces, ready, t]);
  const selectedPlace = places.find((p) => p.id === selectedId);
  const selectedLat = selectedPlace?.coordinates[0];
  const selectedLng = selectedPlace?.coordinates[1];
  useEffect(() => {
    if (!ready || selectedLat === undefined || selectedLng === undefined)
      return;
    const current = map.current;
    if (!current) return;
    // Leaflet computes NaN when animating a hidden (0×0) map, which used to
    // crash the page when a place was opened from the mobile list.
    if (!container.current?.clientWidth || !container.current.clientHeight) {
      pendingView.current = [selectedLat, selectedLng];
      return;
    }
    current.invalidateSize();
    current.flyTo([selectedLat, selectedLng], Math.max(current.getZoom(), 10), {
      duration: 0.8,
    });
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
      <div className="map-tools">
        {allowRoutes && (
          <button
            title={t("Planifică un traseu")}
            onClick={() => openPlanner(searchPoint)}
          >
            <Route size={19} />
          </button>
        )}
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
      {searchPoint && !plannerOpen && (
        <div className="searched-place">
          <MapPin size={20} />
          <div>
            <strong>{searchPoint.label.split(",")[0]}</strong>
            <small>{searchPoint.label}</small>
          </div>
          {allowRoutes && (
            <button
              title={t("Traseu către acest loc")}
              onClick={() => openPlanner(searchPoint)}
            >
              <Navigation size={18} />
            </button>
          )}
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
