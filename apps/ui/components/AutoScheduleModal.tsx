import { motion } from "framer-motion";
import type { DayOfWeek } from "@core/domain/types";
import type { MissingMetadata } from "@core/scheduler";

export type AutoScheduleState =
  | { type: "idle" }
  | { type: "validating" }
  | { type: "missing_metadata"; missing: MissingMetadata[] }
  | { type: "confirm_replace" }
  | { type: "scheduling" }
  | { type: "complete"; success: boolean; message: string; violations: number };

interface AutoScheduleModalProps {
  isOpen: boolean;
  state: AutoScheduleState;
  dayDisplayNames: Record<DayOfWeek, string>;
  onClose: () => void;
  onKeepExisting: () => void;
  onStartFromScratch: () => void;
}

export default function AutoScheduleModal({
  isOpen,
  state,
  dayDisplayNames,
  onClose,
  onKeepExisting,
  onStartFromScratch
}: AutoScheduleModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "linear" }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.35)",
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem"
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: "linear" }}
        style={{
          width: "min(520px, 100%)",
          background: "#fff",
          borderRadius: 14,
          border: "1px solid #e2e8f0",
          boxShadow: "0 24px 48px rgba(15, 23, 42, 0.24)",
          padding: "1rem 1.1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem"
        }}
      >
        {state.type === "missing_metadata" && (
          <>
            <h3 style={{ margin: 0 }}>Missing Day Metadata</h3>
            <p style={{ margin: 0, color: "#475569", fontSize: "0.9rem" }}>
              The following days are missing required information. Please populate these fields before auto-scheduling:
            </p>
            <div style={{ background: "#fff7f6", borderRadius: 8, padding: "0.75rem", border: "1px solid #fee2e2" }}>
              {state.missing.map((item) => (
                <div key={item.dayOfWeek} style={{ marginBottom: "0.5rem" }}>
                  <strong>{dayDisplayNames[item.dayOfWeek]}:</strong> {item.missingFields.join(", ")}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  borderRadius: 999,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  padding: "0.35rem 0.9rem"
                }}
              >
                OK
              </button>
            </div>
          </>
        )}

        {state.type === "confirm_replace" && (
          <>
            <h3 style={{ margin: 0 }}>Existing Staff Assignments</h3>
            <p style={{ margin: 0, color: "#475569", fontSize: "0.9rem" }}>
              There are already staff assignments for this week. Would you like to:
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  borderRadius: 999,
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#0f172a",
                  padding: "0.35rem 0.85rem"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onKeepExisting}
                style={{
                  borderRadius: 999,
                  border: "1px solid #cbd5f5",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  padding: "0.35rem 0.85rem"
                }}
              >
                Keep existing assignments
              </button>
              <button
                type="button"
                onClick={onStartFromScratch}
                style={{
                  borderRadius: 999,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  padding: "0.35rem 0.9rem"
                }}
              >
                Start from scratch
              </button>
            </div>
          </>
        )}

        {state.type === "scheduling" && (
          <>
            <h3 style={{ margin: 0 }}>Auto-Scheduling...</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  border: "4px solid #e5e7eb",
                  borderTopColor: "#2563eb",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite"
                }}
              />
              <p style={{ margin: 0, color: "#475569" }}>
                Generating staff assignments and resolving violations...
              </p>
            </div>
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </>
        )}

        {state.type === "complete" && (
          <>
            <h3 style={{ margin: 0 }}>
              {state.success ? "✓ Auto-Scheduling Complete" : "Auto-Scheduling Complete"}
            </h3>
            <p style={{ margin: 0, color: "#475569", fontSize: "0.9rem" }}>
              {state.message}
            </p>
            {state.violations > 0 && (
              <div style={{ background: "#fff7f6", borderRadius: 8, padding: "0.75rem", border: "1px solid #fee2e2" }}>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#991b1b" }}>
                  {state.violations} violation(s) remain. The violations panel will open to help you resolve them.
                </p>
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  borderRadius: 999,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  padding: "0.35rem 0.9rem"
                }}
              >
                OK
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.section>
  );
}
