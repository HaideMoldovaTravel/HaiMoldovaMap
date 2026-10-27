"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { searchAddress } from "@/features/map/client";
import type { MapPoint } from "@/features/map/types";
export function LocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude?: number;
  longitude?: number;
  onChange: (lat: number, lng: number, address?: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const callback = useRef(onChange);
  const initial = useRef<[number, number]>([
    latitude ?? 47.0245,
    longitude ?? 28.8353,
  ]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MapPoint[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);
  useEffect(() => {
    let disposed = false;
    import("leaflet").then((L) => {
      if (disposed || !element.current) return;
      const instance = L.map(element.current, {
        scrollWheelZoom: false,
      }).setView(initial.current, 10);
      map.current = instance;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        maxZoom: 19,
      }).addTo(instance);
      marker.current = L.marker(initial.current, {
        draggable: true,
        icon: L.divIcon({
          className: "platform-map-pin",
          html: '<span aria-hidden="true">●</span>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(instance);
      instance.on("click", (event) => {
        marker.current?.setLatLng(event.latlng);
        callback.current(event.latlng.lat, event.latlng.lng);
      });
      marker.current.on("dragend", () => {
        const position = marker.current!.getLatLng();
        callback.current(position.lat, position.lng);
      });
      setReady(true);
    });
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);
  useEffect(() => {
    if (
      ready &&
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    ) {
      marker.current?.setLatLng([latitude, longitude]);
      map.current?.panTo([latitude, longitude]);
    }
  }, [latitude, longitude, ready]);
  async function search() {
    if (query.trim().length < 2) return;
    setBusy(true);
    setError("");
    try {
      const found = await searchAddress(query);
      setResults(found);
      if (!found.length)
        setError("Nu am găsit adresa. Alege punctul direct pe hartă.");
    } catch {
      setError("Căutarea nu este disponibilă. Poți alege punctul pe hartă.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="platform-location-picker">
      <p>
        Caută localitatea, apoi apasă pe hartă sau mută marcajul la intrarea
        exactă.
      </p>
      <div className="platform-row">
        <input
          aria-label="Caută adresa locației"
          placeholder="Localitate sau adresă…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
        />
        <button
          type="button"
          className="platform-secondary"
          disabled={busy}
          onClick={() => void search()}
        >
          {busy ? "Se caută…" : "Caută"}
        </button>
      </div>
      {error && <small role="status">{error}</small>}
      {results.length > 0 && (
        <div className="platform-location-results">
          {results.map((point) => (
            <button
              key={point.id}
              type="button"
              onClick={() => {
                onChange(
                  point.coordinates[0],
                  point.coordinates[1],
                  point.label,
                );
                setQuery(point.label);
                setResults([]);
                map.current?.setZoom(15);
              }}
            >
              {point.label}
            </button>
          ))}
        </div>
      )}
      <div
        ref={element}
        className="platform-mini-map"
        aria-label="Alege poziția locației"
      />
      <small>
        Poți introduce sau corecta și coordonatele în câmpurile de mai jos.
      </small>
    </div>
  );
}
