import { motion } from "framer-motion";
import { colors, shadows } from "../theme";

interface WeekInitializationModalProps {
  isOpen: boolean;
  weekLabel: string;
  onInitializeBlank: () => void;
  onInitializeCopy: () => void;
}

export default function WeekInitializationModal({
  isOpen,
  weekLabel,
  onInitializeBlank,
  onInitializeCopy
}: WeekInitializationModalProps) {
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
          background: colors.surface,
          borderRadius: 14,
          border: `1px solid ${colors.borderSubtle}`,
          boxShadow: shadows.modal,
          padding: "1rem 1.1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem"
        }}
      >
        <h3 style={{ margin: 0 }}>No schedule exists for {weekLabel}</h3>
        <p style={{ margin: 0, color: "#475569", fontSize: "0.9rem" }}>
          Choose how to initialize this week.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onInitializeBlank}
            style={{
              borderRadius: 999,
              border: "1px solid #cbd5f5",
              background: "#eff6ff",
              color: "#1d4ed8",
              padding: "0.35rem 0.85rem"
            }}
          >
            Create blank schedule
          </button>
          <button
            type="button"
            onClick={onInitializeCopy}
            style={{
              borderRadius: 999,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              padding: "0.35rem 0.9rem"
            }}
          >
            Copy current schedule
          </button>
        </div>
      </motion.div>
    </motion.section>
  );
}
