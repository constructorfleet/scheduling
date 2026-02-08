import { motion } from "framer-motion";
import { ScheduleStatus } from "@core/domain/types";
import HelpIconButton from "./HelpIconButton";
import type { HelpTopicId } from "./helpContent";

const statusBadges: Record<ScheduleStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#f59e0b" },
  ready_for_review: { label: "In review", color: "#60a5fa" },
  submitted: { label: "Submitted", color: "#34d399" },
  approved: { label: "Approved", color: "#22c55e" },
  archived: { label: "Archived", color: "#94a3b8" }
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
  onOpenUserManagement: () => void;
  isUserManagementOpen: boolean;
  canManageUsers: boolean;
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

type PillTone = "neutral" | "active" | "warn" | "danger";

const pillStyle = (tone: PillTone, disabled = false) => {
  const palette: Record<PillTone, { background: string; border: string; color: string }> = {
    neutral: {
      background: "rgba(15, 23, 42, 0.35)",
      border: "1px solid rgba(148, 163, 184, 0.45)",
      color: "#e2e8f0"
    },
    active: {
      background: "rgba(14, 165, 233, 0.22)",
      border: "1px solid rgba(56, 189, 248, 0.55)",
      color: "#e0f2fe"
    },
    warn: {
      background: "rgba(245, 158, 11, 0.2)",
      border: "1px solid rgba(251, 191, 36, 0.5)",
      color: "#fef3c7"
    },
    danger: {
      background: "rgba(239, 68, 68, 0.22)",
      border: "1px solid rgba(248, 113, 113, 0.5)",
      color: "#fee2e2"
    }
  };
  return {
    borderRadius: 999,
    ...palette[tone],
    padding: "0.42rem 0.88rem",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.42rem",
    fontWeight: 600,
    fontSize: "0.84rem",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.48 : 1
  } as const;
};

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
  onOpenUserManagement,
  isUserManagementOpen,
  canManageUsers,
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

  const apiTone =
    apiStatus.state === "error"
      ? "danger"
      : apiStatus.state === "saved"
        ? "active"
        : apiStatus.state === "loading" || apiStatus.state === "saving"
          ? "warn"
          : "neutral";

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: "linear", layout: { type: "tween", duration: 0.2, ease: "linear" } }}
      style={{
        borderRadius: 24,
        padding: "clamp(1rem, 2.8vw, 1.7rem)",
        marginBottom: "1.5rem",
        background:
          "radial-gradient(circle at 80% -20%, rgba(56,189,248,0.28), transparent 45%), radial-gradient(circle at 10% 110%, rgba(16,185,129,0.2), transparent 40%), linear-gradient(150deg, #0f172a 0%, #111827 45%, #172554 100%)",
        border: "1px solid rgba(148,163,184,0.32)",
        boxShadow: "0 30px 60px rgba(2, 8, 23, 0.35)",
        color: "#f8fafc",
        position: "relative",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.5), transparent 80%)",
          pointerEvents: "none"
        }}
      />
      <div style={{ position: "relative", display: "grid", gap: "1rem" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1rem",
            alignItems: "start"
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "#cbd5e1" }}>
              Scheduling Workspace
            </p>
            <h1 style={{ margin: "0.4rem 0 0", fontSize: "clamp(1.3rem, 3.6vw, 2.2rem)", lineHeight: 1.1 }}>
              {selectedSchool?.name ?? "Select a school"}
            </h1>
            <p style={{ margin: "0.35rem 0 0", color: "#bfdbfe", fontWeight: 500 }}>Week of {weekLabel}</p>
            <div style={{ display: "flex", gap: "0.55rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.75rem" }}>
              <select
                value={selectedSchoolId}
                onChange={(event) => onSchoolChange(event.target.value)}
                style={{
                  borderRadius: 999,
                  border: "1px solid rgba(147, 197, 253, 0.45)",
                  background: "rgba(30, 41, 59, 0.65)",
                  color: "#f8fafc",
                  padding: "0.37rem 0.9rem",
                  fontSize: "0.84rem",
                  minWidth: "min(260px, 100%)"
                }}
              >
                {schoolOptions.map((school) => (
                  <option key={school.id} value={school.id} style={{ background: "#0f172a", color: "#f8fafc" }}>
                    {school.name}
                  </option>
                ))}
              </select>
              <HelpIconButton label="Scheduler overview" tone="dark" onClick={() => onOpenHelpTopic?.("overview")} />
            </div>
          </div>

          <div style={{ display: "grid", gap: "0.55rem", justifyItems: "start" }}>
            <span
              style={{
                borderRadius: 999,
                background: badge.color,
                color: "#0f172a",
                fontWeight: 700,
                fontSize: "0.78rem",
                letterSpacing: "0.02em",
                padding: "0.28rem 0.78rem"
              }}
            >
              {badge.label}
            </span>
            <span style={pillStyle(apiTone)}>{apiStatus.message}</span>
            {userDisplayName && (
              <p style={{ margin: 0, color: "#cbd5e1", fontSize: "0.82rem" }}>
                Signed in as <strong style={{ color: "#f8fafc" }}>{userDisplayName}</strong>
                {userRoleLabel ? ` (${userRoleLabel})` : ""}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
          <button type="button" onClick={onOpenViolations} disabled={!hasViolations} style={pillStyle(isViolationsOpen ? "danger" : "neutral", !hasViolations)}>
            {isViolationsOpen ? "Close Violations" : "Open Violations"}
          </button>
          <HelpIconButton label="Violation navigator" tone="dark" onClick={() => onOpenHelpTopic?.("violations")} />

          <button type="button" onClick={onOpenAuditTimeline} style={pillStyle(isAuditOpen ? "active" : "neutral")}>
            {isAuditOpen ? "Close Audit Log" : "Open Audit Log"}
          </button>
          <HelpIconButton label="Audit timeline" tone="dark" onClick={() => onOpenHelpTopic?.("audit")} />

          <button type="button" onClick={onOpenSettings} disabled={!canManageSettings} style={pillStyle(isSettingsOpen ? "active" : "neutral", !canManageSettings)}>
            {isSettingsOpen ? "Close Settings" : "Open Settings"}
          </button>

          <button type="button" onClick={onOpenUserManagement} disabled={!canManageUsers} style={pillStyle(isUserManagementOpen ? "active" : "neutral", !canManageUsers)}>
            {isUserManagementOpen ? "Close Users" : "Manage Users"}
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem", alignItems: "center" }}>
          <button type="button" onClick={onAutoSchedule} disabled={!canEditSchedule} style={pillStyle("active", !canEditSchedule)}>
            ⚡ Auto
          </button>
          <HelpIconButton label="Auto schedule" tone="dark" onClick={() => onOpenHelpTopic?.("auto-schedule")} />

          <button type="button" onClick={() => onShiftWeek("prev")} style={pillStyle("neutral")}>
            ← Previous
          </button>
          <button
            type="button"
            onClick={() => onShiftWeek("next")}
            style={{
              ...pillStyle("active"),
              background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
              border: "1px solid rgba(125,211,252,0.5)",
              color: "#eff6ff"
            }}
          >
            Next →
          </button>
          <button type="button" onClick={onLogout} style={pillStyle("danger")}>
            Log out
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
          {complianceHighlights.map((highlight) => (
            <span
              key={highlight}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.4)",
                background: "rgba(15,23,42,0.38)",
                padding: "0.4rem 0.78rem",
                color: "#e2e8f0",
                fontSize: "0.81rem"
              }}
            >
              {highlight}
            </span>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
