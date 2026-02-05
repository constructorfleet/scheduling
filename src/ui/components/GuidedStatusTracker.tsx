import { GuidedStep } from "../types";

interface GuidedStatusTrackerProps {
  steps: GuidedStep[];
  onStepAction?: (stepId: string) => void;
}

const statusIndicators: Record<GuidedStep["status"], { label: string; color: string }> = {
  complete: { label: "Complete", color: "#16a34a" },
  in_progress: { label: "In progress", color: "#f97316" },
  blocked: { label: "Blocked", color: "#dc2626" }
};

export default function GuidedStatusTracker({ steps, onStepAction }: GuidedStatusTrackerProps) {
  return (
    <section
      style={{
        background: "#ffffff",
        borderRadius: 18,
        padding: "1rem",
        boxShadow: "0 20px 40px rgba(15, 23, 42, 0.1)"
      }}
    >
      <h3 style={{ margin: 0 }}>Guided status tracker</h3>
      <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {steps.map((step, index) => {
          const indicator = statusIndicators[step.status];
          return (
            <article
              key={step.id}
              style={{
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                padding: "0.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
                background: step.status === "blocked" ? "#fef2f2" : "#f8fafc"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {index + 1}. {step.label}
                  </p>
                  <p style={{ margin: 0, color: "#6b7280", fontSize: "0.85rem" }}>{step.detail}</p>
                </div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.2rem 0.7rem",
                    borderRadius: 999,
                    background: `${indicator.color}1a`,
                    color: indicator.color,
                    border: `1px solid ${indicator.color}`
                  }}
                >
                  {indicator.label}
                </span>
              </div>
              {step.blockingReason && (
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#b91c1c" }}>{step.blockingReason}</p>
              )}
              {step.actionLabel && step.status !== "complete" && (
                <button
                  onClick={() => onStepAction?.(step.id)}
                  style={{
                    alignSelf: "flex-start",
                    borderRadius: 999,
                    border: "none",
                    background: "#2563eb",
                    color: "#fff",
                    padding: "0.4rem 0.9rem"
                  }}
                >
                  {step.actionLabel}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
