import { RuleViolation } from "../types";

interface ViolationNavigatorProps {
  violations: RuleViolation[];
  onFocusSegment: (segmentId: string) => void;
  onResolveViolation: (violationId: string) => void;
}

const severityStyles: Record<RuleViolation["severity"], { label: string; color: string }> = {
  critical: { label: "Critical", color: "#dc2626" },
  warning: { label: "Warning", color: "#d97706" },
  info: { label: "Info", color: "#0ea5e9" }
};

export default function ViolationNavigator({ violations, onFocusSegment, onResolveViolation }: ViolationNavigatorProps) {
  return (
    <section
      style={{
        background: "#ffffff",
        borderRadius: 18,
        padding: "1rem",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.1)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Violation navigator</h3>
        <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>{violations.length} active</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
        {violations.map((violation) => {
          const severity = severityStyles[violation.severity];
          return (
            <article
              key={violation.id}
              style={{
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: "0.75rem",
                background: violation.resolved ? "#ecfdf5" : "#fff",
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0, fontSize: "1rem" }}>{violation.title}</h4>
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.15rem 0.6rem",
                    borderRadius: 999,
                    background: `${severity.color}1a`,
                    color: severity.color,
                    border: `1px solid ${severity.color}`
                  }}
                >
                  {severity.label}
                </span>
              </div>
              <p style={{ margin: 0, color: "#4b5563" }}>{violation.description}</p>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b7280" }}>
                Citation: {violation.policyCitation.name} ({violation.policyCitation.section})
              </p>
              <p style={{ margin: 0, fontWeight: 600, color: "#166534" }}>{violation.recommendedAction}</p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
                <button
                  onClick={() => onFocusSegment(violation.segmentBlockId)}
                  style={{
                    borderRadius: 999,
                    border: "1px solid #2563eb",
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    padding: "0.35rem 0.85rem"
                  }}
                >
                  Jump to block
                </button>
                {!violation.resolved ? (
                  <button
                    onClick={() => onResolveViolation(violation.id)}
                    style={{
                      borderRadius: 999,
                      border: "none",
                      background: "#10b981",
                      color: "#fff",
                      padding: "0.35rem 0.85rem"
                    }}
                  >
                    Mark resolved
                  </button>
                ) : (
                  <span
                    style={{
                      fontSize: "0.8rem",
                      padding: "0.2rem 0.6rem",
                      borderRadius: 999,
                      background: "#d1fae5",
                      color: "#047857"
                    }}
                  >
                    Resolved
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
