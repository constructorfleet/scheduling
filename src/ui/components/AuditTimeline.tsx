import { AuditEvent } from "../types";

interface AuditTimelineProps {
  events: AuditEvent[];
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export default function AuditTimeline({ events, onUndo, onRedo, canUndo, canRedo }: AuditTimelineProps) {
  return (
    <section
      style={{
        background: "#ffffff",
        borderRadius: 18,
        padding: "1rem",
        boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Audit timeline</h3>
        <div style={{ display: "flex", gap: "0.35rem" }}>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            style={{
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              background: canUndo ? "#eff6ff" : "#f1f5f9",
              color: canUndo ? "#2563eb" : "#94a3b8",
              padding: "0.3rem 0.7rem"
            }}
          >
            Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            style={{
              borderRadius: 999,
              border: "1px solid #e5e7eb",
              background: canRedo ? "#eff6ff" : "#f1f5f9",
              color: canRedo ? "#2563eb" : "#94a3b8",
              padding: "0.3rem 0.7rem"
            }}
          >
            Redo
          </button>
        </div>
      </div>
      <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
        {events.map((event) => (
          <article
            key={event.id}
            style={{
              borderBottom: "1px solid #e5e7eb",
              paddingBottom: "0.5rem",
              display: "flex",
              justifyContent: "space-between",
              gap: "0.5rem"
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{event.action}</p>
              <p style={{ margin: "0.15rem 0", fontSize: "0.85rem", color: "#6b7280" }}>{event.user}</p>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8" }}>
                {new Date(event.timestamp).toLocaleString()} · {event.policyCitation.name}
              </p>
            </div>
            {event.notes && (
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#0f172a" }}>{event.notes}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
