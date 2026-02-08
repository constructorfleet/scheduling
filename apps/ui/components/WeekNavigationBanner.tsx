import { motion } from "framer-motion";
import { ScheduleStatus } from "@core/domain/types";
import HelpIconButton from "./HelpIconButton";
import type { HelpTopicId } from "./helpContent";

const statusBadges: Record<ScheduleStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#f59e0b" },
  ready_for_review: { label: "In review", color: "#6366f1" },
  submitted: { label: "Submitted", color: "#10b981" },
  approved: { label: "Approved", color: "#059669" },
  archived: { label: "Archived", color: "#6b7280" }
};

interface WeekNavigationBannerProps {
  schoolOptions: { id: string; name: string }[];
  selectedSchoolId: string;
  onSchoolChange: (schoolId: string) => void;
  weekLabel: string;
  status: ScheduleStatus;
  complianceHighlights: string[];
  onShiftWeek: (direction: "prev" | "next") => void;
  onOpenViolations: () => void;
  onOpenAuditTimeline: () => void;
  hasViolations: boolean;
  isViolationsOpen: boolean;
  isAuditOpen: boolean;
  onOpenSettings: () => void;
  isSettingsOpen: boolean;
  onAutoSchedule: () => void;
  canManageSettings: boolean;
  canEditSchedule: boolean;
  userDisplayName?: string;
  userRoleLabel?: string;
  onLogout: () => void;
  onOpenHelpTopic?: (topicId: HelpTopicId) => void;
  apiStatus: {
    state: "loading" | "saving" | "saved" | "error" | "idle";
    message: string;
  };
}

export default function WeekNavigationBanner({
  schoolOptions,
  selectedSchoolId,
  onSchoolChange,
  weekLabel,
  status,
  complianceHighlights,
  onShiftWeek,
  onOpenViolations,
  onOpenAuditTimeline,
  hasViolations,
  isViolationsOpen,
  isAuditOpen,
  onOpenSettings,
  isSettingsOpen,
  onAutoSchedule,
  canManageSettings,
  canEditSchedule,
  userDisplayName,
  userRoleLabel,
  onLogout,
  onOpenHelpTopic,
  apiStatus
}: WeekNavigationBannerProps) {
  const badge = statusBadges[status] ?? statusBadges.draft;
  const selectedSchool = schoolOptions.find((school) => school.id === selectedSchoolId) ?? schoolOptions[0];

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "linear", layout: { type: "tween", duration: 0.2, ease: "linear" } }}
      style={{
        borderRadius: 18,
        background: "#1f2937",
        color: "#f9fafb",
        padding: "clamp(0.9rem, 2.5vw, 1.5rem)",
        boxShadow: "0 30px 60px rgba(15, 23, 42, 0.25)",
        marginBottom: "1.5rem"
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "0.9rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>School</p>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <h1 style={{ margin: "0.25rem 0", fontSize: "clamp(1.25rem, 4vw, 2rem)", lineHeight: 1.2 }}>
              {selectedSchool?.name ?? "Select a school"}
            </h1>
            <HelpIconButton
              label="Scheduler overview"
              tone="dark"
              onClick={() => onOpenHelpTopic?.("overview")}
            />
            <select
              value={selectedSchoolId}
              onChange={(event) => onSchoolChange(event.target.value)}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.4)",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                padding: "0.25rem 0.9rem",
                fontSize: "0.85rem"
              }}
            >
              {schoolOptions.map((school) => (
                <option key={school.id} value={school.id} style={{ background: "#1f2937", color: "#f9fafb" }}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>
          <p style={{ margin: 0, color: "#cbd5f5" }}>Week of {weekLabel}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.5rem", flex: "1 1 320px", minWidth: 0 }}>
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
          <span
            style={{
              padding: "0.25rem 0.75rem",
              borderRadius: 999,
              fontWeight: 600,
              fontSize: "0.8rem",
              border: "1px solid rgba(255,255,255,0.35)",
              background:
                apiStatus.state === "error"
                  ? "rgba(239,68,68,0.2)"
                  : apiStatus.state === "saved"
                    ? "rgba(16,185,129,0.2)"
                    : apiStatus.state === "loading" || apiStatus.state === "saving"
                      ? "rgba(56,189,248,0.2)"
                      : "rgba(255,255,255,0.08)",
              color:
                apiStatus.state === "error"
                  ? "#fecaca"
                  : apiStatus.state === "saved"
                    ? "#bbf7d0"
                    : "#e2e8f0"
            }}
          >
            {apiStatus.message}
          </span>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-start" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <button
                type="button"
                onClick={onOpenViolations}
                disabled={!hasViolations}
                style={{
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.35)",
                  background: isViolationsOpen ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.12)",
                  color: hasViolations ? "#f9fafb" : "#9ca3af",
                  padding: "0.35rem 0.8rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  cursor: hasViolations ? "pointer" : "not-allowed"
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  {isViolationsOpen ? (
                    <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
                      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
                      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  )}
                </span>
                {isViolationsOpen ? "Close Violations" : "Open Violations"}
              </button>
              <HelpIconButton
                label="Violation navigator"
                tone="dark"
                onClick={() => onOpenHelpTopic?.("violations")}
              />
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <button
                type="button"
                onClick={onOpenAuditTimeline}
                style={{
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.35)",
                  background: isAuditOpen ? "rgba(56,189,248,0.25)" : "rgba(255,255,255,0.12)",
                  color: "#f9fafb",
                  padding: "0.35rem 0.8rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem"
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  {isAuditOpen ? (
                    <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
                      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
                      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  )}
                </span>
                {isAuditOpen ? "Close Audit Log" : "Open Audit Log"}
              </button>
              <HelpIconButton
                label="Audit timeline"
                tone="dark"
                onClick={() => onOpenHelpTopic?.("audit")}
              />
            </div>
            <button
              type="button"
              onClick={onOpenSettings}
              disabled={!canManageSettings}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.35)",
                background: !canManageSettings
                  ? "rgba(255,255,255,0.05)"
                  : isSettingsOpen
                    ? "rgba(99,102,241,0.25)"
                    : "rgba(255,255,255,0.12)",
                color: canManageSettings ? "#f9fafb" : "#9ca3af",
                padding: "0.35rem 0.8rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                cursor: canManageSettings ? "pointer" : "not-allowed"
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {isSettingsOpen ? (
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
                    <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
                    <path d="M12 2h-4l-.5 2.2-2 .8-1.8-1.2-2.8 2.8 1.2 1.8-.8 2L2 12v4l2.2.5.8 2-1.2 1.8 2.8 2.8 1.8-1.2 2 .8.5 2.2h4l.5-2.2 2-.8 1.8 1.2 2.8-2.8-1.2-1.8.8-2L22 16v-4l-2.2-.5-.8-2 1.2-1.8-2.8-2.8-1.8 1.2-2-.8L12 2z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                )}
              </span>
              {isSettingsOpen ? "Close Settings" : "Open Settings"}
            </button>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <button
                onClick={onAutoSchedule}
                disabled={!canEditSchedule}
                style={{
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.4)",
                  background: canEditSchedule ? "#10b981" : "rgba(255,255,255,0.12)",
                  color: canEditSchedule ? "#fff" : "#9ca3af",
                  padding: "0.4rem 0.9rem",
                  fontWeight: 600,
                  cursor: canEditSchedule ? "pointer" : "not-allowed"
                }}
              >
                ⚡ Auto
              </button>
              <HelpIconButton
                label="Auto schedule"
                tone="dark"
                onClick={() => onOpenHelpTopic?.("auto-schedule")}
              />
            </div>
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
            <button
              type="button"
              onClick={onLogout}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.4)",
                background: "rgba(239, 68, 68, 0.2)",
                color: "#fecaca",
                padding: "0.4rem 0.9rem"
              }}
            >
              Log out
            </button>
          </div>
          {userDisplayName && (
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#cbd5f5" }}>
              Signed in as {userDisplayName}
              {userRoleLabel ? ` (${userRoleLabel})` : ""}
            </p>
          )}
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
    </motion.section>
  );
}
