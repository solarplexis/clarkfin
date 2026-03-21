import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <span className="eyebrow">Community College Finance Lab</span>
        <h1>Build student financial confidence with evidence-rich activity data.</h1>
        <p className="lede">
          ClarkFin is a multi-tenant learning platform for budgeting and debt planning.
          Students save work in progress, instructors see live engagement, and each
          organization exports a clean activity feed for downstream AI reporting.
        </p>
        <div className="actions">
          <Link className="button" href="/login">
            Sign in
          </Link>
          <Link className="button-secondary" href="/invite/demo-code">
            Try invite flow
          </Link>
        </div>
        <div className="stats">
          <article className="stat">
            <div className="muted">Architecture</div>
            <div className="stat-value">Multi-tenant</div>
          </article>
          <article className="stat">
            <div className="muted">Data model</div>
            <div className="stat-value">Activity-first</div>
          </article>
          <article className="stat">
            <div className="muted">Exports</div>
            <div className="stat-value">Per-org API keys</div>
          </article>
        </div>
      </section>
    </main>
  );
}
