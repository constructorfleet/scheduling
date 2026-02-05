const highlightList = [
  {
    title: "Rules-first scheduling",
    description:
      "Every segment block is shaped by the compliance rules catalog so coverage, certifications, and breaks stay explicit before saving."
  },
  {
    title: "Guided status",
    description:
      "Directors see staged status updates (draft, review, ready) and the planned coverage gaps before sharing with staff."
  },
  {
    title: "Release-ready bundle",
    description:
      "Static assets, metadata, and archives are produced in a single deterministic step that can be replayed on any workstation or CI runner."
  }
];

const quickInfo = [
  {
    label: "Build command",
    detail: "`npm run build:static` (runs `tsc`, bundles the UI, stages `dist-static/`, and records metadata)."
  },
  {
    label: "Deploy command",
    detail:
      "`npm run deploy:static` syncs `dist-static/` to S3, an rsync server, or a local path using the preferred target variables."
  },
  {
    label: "Audit traceability",
    detail: "Each bundle writes `build-metadata.json` so operations and compliance teams can trace releases to commits."
  }
];

export default function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #eef1f5, #fefefe)",
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#111827",
        padding: "2rem"
      }}
    >
      <main
        style={{
          maxWidth: 980,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "2rem"
        }}
      >
        <header>
          <p style={{ fontSize: "0.9rem", color: "#6b7280", marginBottom: "0.25rem" }}>Daycare Scheduler</p>
          <h1 style={{ margin: 0, fontSize: "2.5rem" }}>Operational readiness</h1>
          <p style={{ marginTop: "0.75rem", lineHeight: 1.6 }}>
            Static assets, metadata, and rules validation are aligned so deployment is simply a matter of staging the
            bundle and syncing it to your target host.
          </p>
        </header>

        <section
          style={{
            background: "#ffffff",
            borderRadius: "1.25rem",
            padding: "1.5rem",
            boxShadow: "0 20px 40px rgba(15, 23, 42, 0.08)"
          }}
        >
          <h2 style={{ marginTop: 0 }}>Deployment readiness</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1rem"
            }}
          >
            {quickInfo.map((item) => (
              <article
                key={item.label}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.75rem",
                  padding: "1rem",
                  background: "#f8fafc"
                }}
              >
                <p style={{ fontSize: "0.85rem", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                  {item.label}
                </p>
                <p style={{ margin: "0.4rem 0 0", lineHeight: 1.5 }}>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2>Operations highlights</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1.25rem"
            }}
          >
            {highlightList.map((highlight) => (
              <article
                key={highlight.title}
                style={{
                  padding: "1.25rem",
                  borderRadius: "1rem",
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)"
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>{highlight.title}</h3>
                <p style={{ margin: 0, lineHeight: 1.5 }}>{highlight.description}</p>
              </article>
            ))}
          </div>
        </section>

        <footer style={{ textAlign: "center", color: "#6b7280", fontSize: "0.85rem" }}>
          <p style={{ margin: 0 }}>Need more context? Check the deployment guide in `artifacts/phase-9-deployment/`.</p>
        </footer>
      </main>
    </div>
  );
}
