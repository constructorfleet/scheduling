import { ScheduleStatus } from "../../domain/types";
import { ReactNode } from "react";

const statusBadges: Record<ScheduleStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#f59e0b" },
  ready_for_review: { label: "In review", color: "#6366f1" },
  submitted: { label: "Submitted", color: "#10b981" },
  approved: { label: "Approved", color: "#059669" },
  archived: { label: "Archived", color: "#6b7280" }
};

interface WeekNavigationBannerProps {
  schoolName: string;
  weekLabel: string;
  status: ScheduleStatus;
  complianceHighlights: string[];
  onShiftWeek: (direction: "prev" | "next") => void;
  actionNode?: ReactNode;
}

export default function WeekNavigationBanner({
  schoolName,
  weekLabel,
  status,
  complianceHighlights,
  onShiftWeek,
  actionNode
}: WeekNavigationBannerProps) {
  const badge = statusBadges[status] ?? statusBadges.draft;

  return (
    <section
      style={{
        borderRadius: 18,
        background: "#1f2937",
        color: "#f9fafb",
        padding: "1.5rem",
        boxShadow: "0 30px 60px rgba(15, 23, 42, 0.25)",
        marginBottom: "1.5rem"
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <p style={{ margin: 0, fontSize: "0.9rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>School</p>
          <h1 style={{ margin: "0.25rem 0", fontSize: "2rem" }}>{schoolName}</h1>
          <p style={{ margin: 0, color: "#cbd5f5" }}>Week of {weekLabel}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
          <span
            style={{
              padding: "0.25rem 0.9rem",
              borderRadius: 999,
              background: badge.color,
              fontWeight: 600
            }}
          >
            {badge.label}
          </span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => onShiftWeek("prev")}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.4)",
                background: "transparent",
                color: "#f9fafb",
                padding: "0.4rem 0.9rem"
              }}
            >
              ← Previous
            </button>
            <button
              onClick={() => onShiftWeek("next")}
              style={{
                borderRadius: 999,
                border: "none",
                background: "#2563eb",
                color: "#fff",
                padding: "0.4rem 0.9rem"
              }}
            >
              Next →
            </button>
          </div>
          {actionNode}
        </div>
      </div>
      <div
        style={{
          marginTop: "1.25rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem"
        }}
      >
        {complianceHighlights.map((highlight) => (
          <span
            key={highlight}
            style={{
              padding: "0.5rem 0.9rem",
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              fontSize: "0.85rem"
            }}
          >
            {highlight}
          </span>
        ))}
      </div>
    </section>
  );
}
