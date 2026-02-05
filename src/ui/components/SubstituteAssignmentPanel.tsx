import { SubstituteAssignmentCard } from "../types";

interface SubstituteAssignmentPanelProps {
  requests: SubstituteAssignmentCard[];
  onRequestAction?: (requestId: string, action: string) => void;
}

export default function SubstituteAssignmentPanel({ requests, onRequestAction }: SubstituteAssignmentPanelProps) {
  return (
    <section
      style={{
        background: "#ffffff",
        borderRadius: 18,
        padding: "1rem",
        boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)"
      }}
    >
      <h3 style={{ margin: 0 }}>Substitute coverage</h3>
      <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {requests.map((request) => (
          <article
            key={request.requestId}
            style={{
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              padding: "0.75rem",
              background: "#f8fafc"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
              <p style={{ margin: 0, fontWeight: 600 }}>{request.replacementName}</p>
              <span style={{ fontSize: "0.75rem", color: "#2563eb" }}>{request.state}</span>
            </div>
            <p style={{ margin: 0, color: "#6b7280" }}>
              {request.segmentLabel} ({request.originalDay.toUpperCase()})
            </p>
            <p style={{ margin: "0.35rem 0" }}>
              Approver: {request.approver ?? "Missing"} · {request.approvedAt ? "Signed" : "Pending"}
            </p>
            {request.issues.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem", color: "#b91c1c" }}>
                {request.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
            {request.state !== "ready" && (
              <button
                onClick={() => onRequestAction?.(request.requestId, "resolve")}
                style={{
                  marginTop: "0.4rem",
                  borderRadius: 999,
                  border: "none",
                  background: "#10b981",
                  color: "#fff",
                  padding: "0.35rem 0.85rem"
                }}
              >
                Resolve parity
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
