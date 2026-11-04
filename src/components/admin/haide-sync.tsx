"use client";
import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
const LocationPicker = dynamic(
  () =>
    import("@/components/platform/location-picker").then(
      (m) => m.LocationPicker,
    ),
  { ssr: false },
);
export type HaideOverview = {
  enabled: boolean;
  apiUrl: string;
  intervalSeconds: number;
  runs: {
    id: string;
    status: string;
    trigger: string;
    imported: number;
    hidden: number;
    issues: number;
    error: string | null;
    started_at: string;
  }[];
  items: {
    id: string;
    name: string;
    url: string;
    visible: boolean;
    suppressed: boolean;
    issue: string | null;
    latitude: number | null;
    longitude: number | null;
    precision: string | null;
  }[];
};
const date = (s: string) =>
  new Date(s).toLocaleString("ro-RO", { timeZone: "Europe/Chisinau" });
export function HaideSyncPanel({ initial }: { initial: HaideOverview }) {
  const [data, setData] = useState(initial),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [editing, setEditing] = useState<HaideOverview["items"][number] | null>(
    null,
  );
  async function action(payload: object) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/haide-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage("Operațiunea a fost finalizată.");
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Operațiunea a eșuat.",
      );
      return false;
    } finally {
      try {
        const response = await fetch("/api/haide-sync");
        if (response.ok) setData(await response.json());
      } catch {}
      setBusy(false);
    }
  }
  return (
    <div className="ad-page">
      {editing && (
        <PositionDialog
          item={editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (latitude, longitude) => {
            if (
              await action({
                action: "position",
                id: editing.id,
                latitude,
                longitude,
              })
            )
              setEditing(null);
          }}
          onReset={async () => {
            if (await action({ action: "position-reset", id: editing.id }))
              setEditing(null);
          }}
        />
      )}
      <div className="ad-page-title">
        <div>
          <p>INTEGRARE HAIDE</p>
          <h1>Sincronizare catalog</h1>
          <p>
            Conținutul public Haide apare automat pe hartă, fără moderare
            suplimentară.
          </p>
        </div>
      </div>
      <section className="ad-card" style={{ padding: 24, marginBottom: 20 }}>
        <p>
          {data.enabled
            ? `Activă · la fiecare ${data.intervalSeconds / 60} minute`
            : "Neconfigurată · configurează conexiunea și pornește serviciul de sincronizare."}
        </p>
        <p>
          Programarea rulează prin serviciul dedicat. Frecvența configurată nu
          confirmă că serviciul este pornit.
        </p>
        {data.apiUrl && <p>Sursă: {data.apiUrl}</p>}
        <button
          className="ad-button ad-button-primary"
          disabled={busy || !data.enabled}
          onClick={() => void action({ action: "sync" })}
        >
          {busy ? "Se procesează…" : "Sincronizează acum"}
        </button>
        {message && <p role="status">{message}</p>}
      </section>
      <section
        className="ad-card"
        style={{ padding: 24, overflowX: "auto", marginBottom: 20 }}
      >
        <h2>Ultimele sincronizări</h2>
        <table className="ad-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Stare</th>
              <th>Preluate</th>
              <th>Retrase</th>
              <th>Necesită completare</th>
            </tr>
          </thead>
          <tbody>
            {data.runs.map((r) => (
              <tr key={r.id}>
                <td>{date(r.started_at)}</td>
                <td>
                  {
                    (
                      {
                        success: "Finalizată",
                        failed: "Eșuată",
                        running: "În curs",
                      } as Record<string, string>
                    )[r.status]
                  }
                  {r.error && <p>{r.error}</p>}
                </td>
                <td>{r.imported}</td>
                <td>{r.hidden}</td>
                <td>{r.issues}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.runs.length && <p>Nu există sincronizări încă.</p>}
      </section>
      <section className="ad-card" style={{ padding: 24, overflowX: "auto" }}>
        <h2>Fișe Haide</h2>
        <p>
          Sunt afișate primele 500 de fișe. Ascunderea manuală se păstrează la
          sincronizările următoare.
        </p>
        <table className="ad-table">
          <thead>
            <tr>
              <th>Fișă</th>
              <th>Stare</th>
              <th>Acțiune</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.name || item.id}
                  </a>
                  <small style={{ display: "block" }}>{item.id}</small>
                </td>
                <td>
                  {item.suppressed
                    ? "Ascunsă manual"
                    : item.visible
                      ? "Publicată automat"
                      : (item.issue ?? "Retrasă")}
                </td>
                <td>
                  <button
                    className="ad-button"
                    disabled={busy}
                    onClick={() => setEditing(item)}
                  >
                    Ajustează poziția
                  </button>
                  <button
                    className="ad-button"
                    disabled={busy}
                    onClick={() =>
                      void action({
                        action: "visibility",
                        id: item.id,
                        suppressed: !item.suppressed,
                      })
                    }
                  >
                    {item.suppressed
                      ? "Permite afișarea"
                      : "Ascunde de pe hartă"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.items.length && <p>Nu au fost importate fișe.</p>}
      </section>
    </div>
  );
}

function PositionDialog({
  item,
  busy,
  onClose,
  onSave,
  onReset,
}: {
  item: HaideOverview["items"][number];
  busy: boolean;
  onClose: () => void;
  onSave: (lat: number, lng: number) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [lat, setLat] = useState(item.latitude?.toString() ?? ""),
    [lng, setLng] = useState(item.longitude?.toString() ?? "");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="ad-dialog haide-position-dialog"
      aria-label="Ajustează poziția"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2>{item.name}</h2>
      <p>
        Alege punctul pe hartă sau introdu coordonatele. Poziția salvată manual
        se păstrează la sincronizare.
      </p>
      <LocationPicker
        latitude={lat ? Number(lat) : undefined}
        longitude={lng ? Number(lng) : undefined}
        onChange={(a, b) => {
          setLat(String(a));
          setLng(String(b));
        }}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(Number(lat), Number(lng));
        }}
      >
        <label>
          Latitudine
          <input
            type="number"
            step="any"
            min="-90"
            max="90"
            required
            value={lat}
            onChange={(e) => setLat(e.target.value)}
          />
        </label>
        <label>
          Longitudine
          <input
            type="number"
            step="any"
            min="-180"
            max="180"
            required
            value={lng}
            onChange={(e) => setLng(e.target.value)}
          />
        </label>
        <div className="ad-form-actions">
          <button
            type="button"
            className="ad-button"
            disabled={busy}
            onClick={onClose}
          >
            Renunță
          </button>
          {item.precision === "manual" && (
            <button
              type="button"
              className="ad-button"
              disabled={busy}
              onClick={() => void onReset()}
            >
              Revino la poziționare automată
            </button>
          )}
          <button className="ad-button ad-button-primary" disabled={busy}>
            Salvează poziția
          </button>
        </div>
      </form>
    </dialog>
  );
}
