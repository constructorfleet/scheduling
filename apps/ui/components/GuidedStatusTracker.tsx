import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { colors, shadows } from "../theme";
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
  const [isCollapsed, setIsCollapsed] = useState(false);

  const activeStep = useMemo(() => {
    return (
      steps.find((step) => step.status === "in_progress") ??
      steps.find((step) => step.status === "blocked") ??
      steps[0]
    );
  }, [steps]);

  const activeIndicator = activeStep ? statusIndicators[activeStep.status] : null;
  const summary = useMemo(() => {
    const total = steps.length;
    const completeCount = steps.filter((step) => step.status === "complete").length;
    const blockedCount = steps.filter((step) => step.status === "blocked").length;
    const inProgressCount = steps.filter((step) => step.status === "in_progress").length;
    const remainingCount = Math.max(0, total - completeCount);
    const progressPercent = total > 0 ? Math.round((completeCount / total) * 100) : 0;
    const nextStep = steps.find((step) => step.status !== "complete");

    return {
      total,
      completeCount,
      blockedCount,
      inProgressCount,
      remainingCount,
      progressPercent,
      nextStep
    };
  }, [steps]);

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "linear", layout: { type: "tween", duration: 0.2, ease: "linear" } }}
      style={{
        background: colors.surface,
        borderRadius: 18,
        padding: "1rem",
        boxShadow: shadows.card
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h3 style={{ margin: 0 }}>Guided status tracker</h3>
          {isCollapsed && activeStep && activeIndicator && (
            <p style={{ margin: "0.35rem 0 0", color: "#6b7280", fontSize: "0.85rem" }}>
              Active: {activeStep.label} · {activeIndicator.label}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed((value) => !value)}
          style={{
            borderRadius: 999,
            border: "1px solid #cbd5f5",
            background: "#eff6ff",
            color: "#1d4ed8",
            padding: "0.35rem 0.85rem",
            fontWeight: 600
          }}
        >
          {isCollapsed ? "Expand" : "Collapse"}
        </button>
      </div>

      <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.6rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.78rem", padding: "0.2rem 0.6rem", borderRadius: 999, background: colors.surfaceAlt, color: colors.textPrimary }}>
            Complete {summary.completeCount}/{summary.total}
          </span>
          <span style={{ fontSize: "0.78rem", padding: "0.2rem 0.6rem", borderRadius: 999, background: colors.surfaceAlt, color: colors.textPrimary }}>
            In progress {summary.inProgressCount}
          </span>
          <span style={{ fontSize: "0.78rem", padding: "0.2rem 0.6rem", borderRadius: 999, background: colors.dangerSurface, color: colors.dangerText }}>
            Blocked {summary.blockedCount}
          </span>
          <span style={{ fontSize: "0.78rem", padding: "0.2rem 0.6rem", borderRadius: 999, background: colors.surfaceAlt, color: colors.textPrimary }}>
            Remaining {summary.remainingCount}
          </span>
          {summary.nextStep && (
            <span style={{ fontSize: "0.78rem", padding: "0.2rem 0.6rem", borderRadius: 999, background: colors.surfaceAccent, color: colors.textPrimary }}>
              Next: {summary.nextStep.label}
            </span>
          )}
        </div>
        <div style={{ height: 8, borderRadius: 999, background: colors.surfaceAlt, overflow: "hidden" }}>
          <div style={{ width: `${summary.progressPercent}%`, height: "100%", background: colors.brandBlue }} />
        </div>
      </div>

      {!isCollapsed && (
        <motion.div
          layout
          transition={{ layout: { type: "tween", duration: 0.2, ease: "linear" } }}
          style={{
            marginTop: "1rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem"
          }}
        >
          {steps.map((step, index) => {
            const indicator = statusIndicators[step.status];
            return (
              <motion.article
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "linear", layout: { type: "tween", duration: 0.2, ease: "linear" } }}
                key={step.id}
                style={{
                  flex: "1 1 220px",
                  minWidth: 220,
                  borderRadius: 14,
                  border: "1px solid #e5e7eb",
                  padding: "0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                  background: step.status === "blocked" ? "#fef2f2" : "#f8fafc"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
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
                <div style={{ marginTop: "auto" }}>
                  {step.actionLabel && step.status !== "complete" && (
                    <button
                      onClick={() => {
                        if (step.actionDisabled) {
                          return;
                        }
                        onStepAction?.(step.id);
                      }}
                      disabled={step.actionDisabled}
                      style={{
                        alignSelf: "flex-start",
                        borderRadius: 999,
                        border: "none",
                        background: step.actionDisabled ? "#cbd5f5" : "#2563eb",
                        color: "#fff",
                        padding: "0.4rem 0.9rem",
                        cursor: step.actionDisabled ? "not-allowed" : "pointer",
                        opacity: step.actionDisabled ? 0.7 : 1
                      }}
                    >
                      {step.actionLabel}
                    </button>
                  )}
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      )}
    </motion.section>
  );
}
