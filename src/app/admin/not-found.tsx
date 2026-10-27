import Link from "next/link";
export default function NotFound() {
  return (
    <section className="ad-card ad-error-page">
      <h1>Pagina nu a fost găsită</h1>
      <p>Înregistrarea nu mai există sau adresa nu este corectă.</p>
      <Link className="ad-button ad-button-primary" href="/admin">
        Înapoi la dashboard
      </Link>
    </section>
  );
}
