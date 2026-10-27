export default function Loading() {
  return (
    <div
      className="ad-loading"
      aria-label="Se încarcă administrarea"
      role="status"
    >
      <div />
      <section>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} />
        ))}
      </section>
      <article />
      <span>Se încarcă datele…</span>
    </div>
  );
}
