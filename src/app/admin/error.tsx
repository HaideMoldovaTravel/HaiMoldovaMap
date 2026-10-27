"use client";
import { AlertTriangle, RefreshCw } from "lucide-react";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="ad-card ad-error-page">
      <AlertTriangle size={36} />
      <h1>Datele nu au putut fi încărcate</h1>
      <p>
        Conexiunea a fost întreruptă sau operația nu a putut fi finalizată. Poți
        încerca din nou.
      </p>
      <button className="ad-button ad-button-primary" onClick={reset}>
        <RefreshCw size={16} />
        Reîncearcă
      </button>
    </section>
  );
}
