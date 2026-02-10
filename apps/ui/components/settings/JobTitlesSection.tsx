import { motion, AnimatePresence } from "framer-motion";
import type { JobTitleSetting } from "../SettingsPanel";

interface JobTitlesSectionProps {
  draftJobTitles: JobTitleSetting[];
  onChange: (next: JobTitleSetting[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onSave: () => void;
  canSave: boolean;
}

export default function JobTitlesSection({
  draftJobTitles,
  onChange,
  onAdd,
  onRemove,
  onSave,
  canSave
}: JobTitlesSectionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 88px",
          gap: "0.75rem",
          fontSize: "0.75rem",
          color: "#6b7280",
          paddingLeft: "0.75rem",
          paddingRight: "0.75rem",
          alignItems: "center"
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 180px 220px",
            gap: "0.75rem",
            alignItems: "center"
          }}
        >
          <span style={{ textAlign: "center", justifySelf: "center" }}>Job title</span>
          <span style={{ textAlign: "center", justifySelf: "center" }}>Leader qualified</span>
          <span style={{ textAlign: "center", justifySelf: "center" }}>Requires leader to open/close</span>
        </div>
        <span />
      </div>
      <AnimatePresence initial={false}>
      {draftJobTitles.map((title, index) => (
        <motion.div
          key={title.id}
          initial={{ opacity: 0, maxHeight: 0 }}
          animate={{ opacity: 1, maxHeight: "200px" }}
          exit={{ opacity: 0, maxHeight: 0 }}
          transition={{ duration: 0.15, ease: "easeInOut" }}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: "0.75rem",
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "1fr 180px 220px 88px",
            overflow: "hidden"
          }}
        >
          <input
            value={title.title}
            onChange={(event) => {
              const next = [...draftJobTitles];
              next[index] = { ...title, title: event.target.value };
              onChange(next);
            }}
            style={{
              borderRadius: 10,
              border: "1px solid #d1d5db",
              padding: "0.45rem 0.6rem"
            }}
            placeholder="Job title"
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
              fontSize: "0.85rem"
            }}
          >
            <input
              type="checkbox"
              checked={title.leaderQualified}
              onChange={(event) => {
                const next = [...draftJobTitles];
                next[index] = { ...title, leaderQualified: event.target.checked };
                onChange(next);
              }}
            />
            Leader qualified
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
              fontSize: "0.85rem"
            }}
          >
            <input
              type="checkbox"
              checked={title.requiresLeaderForOpenClose}
              onChange={(event) => {
                const next = [...draftJobTitles];
                next[index] = { ...title, requiresLeaderForOpenClose: event.target.checked };
                onChange(next);
              }}
            />
            Requires leader present for open/close
          </label>
          <button
            type="button"
            onClick={() => onRemove(index)}
            style={{
              borderRadius: 999,
              border: "1px solid #fecaca",
              background: "#fee2e2",
              color: "#b91c1c",
              padding: "0.3rem 0.75rem"
            }}
          >
            Remove
          </button>
        </motion.div>
      ))}
      </AnimatePresence>
      <button
        type="button"
        onClick={onAdd}
        style={{
          alignSelf: "flex-start",
          borderRadius: 999,
          border: "1px solid #cbd5f5",
          background: "#eff6ff",
          color: "#1d4ed8",
          padding: "0.4rem 0.9rem"
        }}
      >
        Add job title
      </button>
      <button
        type="button"
        disabled={!canSave}
        onClick={onSave}
        style={{
          alignSelf: "flex-start",
          borderRadius: 999,
          border: "none",
          background: canSave ? "#2563eb" : "#cbd5f5",
          color: "#fff",
          padding: "0.45rem 0.9rem",
          cursor: canSave ? "pointer" : "not-allowed"
        }}
      >
        Save job titles
      </button>
    </div>
  );
}
