import { FieldTripEvent, FieldTripType, PolicyCitation } from "../../../src/domain/types";

interface FieldTripApprovalPanelProps {
  event: FieldTripEvent;
  tripType: FieldTripType;
  citation: PolicyCitation;
  onSignOff: () => void;
}

export default function FieldTripApprovalPanel({ event, tripType, citation, onSignOff }: FieldTripApprovalPanelProps) {
  const signedOff = Boolean(event.approverId && event.signedOffAt);
  const statusLabel = signedOff ? "Approved" : "Sign-off required";

  return (
    <section
      style={{
        background: "#ffffff",
        borderRadius: 18,
        padding: "1rem",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Field trip approval</h3>
        <span
          style={{
            padding: "0.25rem 0.9rem",
            borderRadius: 999,
            background: signedOff ? "#ecfdf5" : "#fee2e2",
            color: signedOff ? "#047857" : "#991b1b",
            fontSize: "0.8rem"
          }}
        >
          {statusLabel}
        </span>
      </div>
      <p style={{ marginTop: "0.5rem", marginBottom: "0.5rem", color: "#6b7280" }}>{tripType.name}</p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: "0.8rem",
            padding: "0.25rem 0.6rem",
            borderRadius: 999,
            background: "#f8fafc",
            border: "1px solid #e5e7eb"
          }}
        >
          Adults 1:{tripType.minAdultStudentRatio}
        </span>
        <span
          style={{
            fontSize: "0.8rem",
            padding: "0.25rem 0.6rem",
            borderRadius: 999,
            background: "#f8fafc",
            border: "1px solid #e5e7eb"
          }}
        >
          Leaders 1:{tripType.minLeaderStudentRatio}
        </span>
      </div>
      <div style={{ marginTop: "0.65rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <p style={{ margin: 0 }}>
          Approver: {event.approverId ?? "Pending"}
        </p>
        <p style={{ margin: 0 }}>
          Signed at: {event.signedOffAt ? new Date(event.signedOffAt).toLocaleString() : "Not recorded"}
        </p>
      </div>
      <p style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#6b7280" }}>
        {citation.name} — {citation.document} §{citation.section}
      </p>
      <button
        onClick={onSignOff}
        disabled={signedOff}
        style={{
          marginTop: "0.5rem",
          borderRadius: 999,
          border: "none",
          background: signedOff ? "#94a3b8" : "#2563eb",
          color: "#fff",
          padding: "0.4rem 0.9rem",
          cursor: signedOff ? "not-allowed" : "pointer"
        }}
      >
        {signedOff ? "Signed off" : "Add director sign-off"}
      </button>
    </section>
  );
}
