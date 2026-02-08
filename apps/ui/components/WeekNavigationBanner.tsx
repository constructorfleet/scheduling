import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ScheduleStatus } from "@core/domain/types";
import HelpIconButton from "./HelpIconButton";
import type { HelpTopicId } from "./helpContent";
import { colors, gradients, shadows } from "../theme";

type LabelColor = {
    label: string;
    color: string;
};

const statusBadges: Record<ScheduleStatus, LabelColor> = {
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
  onShiftWeek: (direction: "prev" | "next") => void;
  onOpenViolations: () => void;
  onOpenAuditTimeline: () => void;
  hasViolations: boolean;
  isViolationsOpen: boolean;
  hideViolations?: boolean;
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
  onUpdateDisplayName?: (nextName: string) => void;
  isDisplayNameSaving?: boolean;
  displayNameError?: string | null;
  onLogout: () => void;
  onOpenHelpTopic?: (topicId: HelpTopicId) => void;
  apiStatus: {
    state: "loading" | "saving" | "saved" | "error" | "idle";
    message: string;
  };
  violationCount: number;
}

type PillTone = "neutral" | "active" | "warn" | "danger";

const pillStyle = (tone: PillTone | LabelColor, disabled = false) => {
  const palette: Record<PillTone, { background: string; border: string; color: string }> = {
    neutral: {
      background: "rgba(30, 41, 59, 0.45)",
      border: "1px solid rgba(148, 163, 184, 0.55)",
      color: colors.surface
    },
    active: {
      background: "rgba(14, 165, 233, 0.28)",
      border: "1px solid rgba(56, 189, 248, 0.65)",
      color: colors.textInverse
    },
    warn: {
      background: "rgba(245, 158, 11, 0.25)",
      border: "1px solid rgba(251, 191, 36, 0.6)",
      color: colors.textInverse
    },
    danger: {
      background: "rgba(239, 68, 68, 0.28)",
      border: "1px solid rgba(248, 113, 113, 0.6)",
      color: colors.textInverse
    }
  };
  return {
    borderRadius: 999,
    ...(typeof tone === "string" ? palette[tone] : { background: tone.color, border: `1px solid ${tone.color}`, color: colors.textInverse }),
    padding: "0.42rem 0.88rem",
    display: "inline-flex",
    alignItems: "center",
    fontWeight: 600,
    fontSize: "0.84rem",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.48 : 1
  } as const;
};

const iconPill = (tone: PillTone, disabled = false) => ({
  ...pillStyle(tone, disabled),
  padding: "0.36rem 0.56rem",
  minWidth: 42,
  justifyContent: "center"
});

export default function WeekNavigationBanner({
  schoolOptions,
  selectedSchoolId,
  onSchoolChange,
  weekLabel,
  status,
  onShiftWeek,
  onOpenViolations,
  onOpenAuditTimeline,
  hasViolations,
  isViolationsOpen,
  hideViolations,
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
  onUpdateDisplayName,
  isDisplayNameSaving,
  displayNameError,
  onLogout,
  onOpenHelpTopic,
  apiStatus,
  violationCount
}: WeekNavigationBannerProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(userDisplayName ?? "");

  useEffect(() => {
    setDraftName(userDisplayName ?? "");
  }, [userDisplayName]);
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
        background: gradients.bannerBackground,
        border: "1px solid rgba(148,163,184,0.45)",
        boxShadow: shadows.banner,
        color: colors.textInverse,
        position: "relative",
        overflow: "hidden"
      }}
    >
      <style>{`
        .banner-icon-pill {
          transition: background-color 0.2s linear, border-color 0.2s linear, opacity 0.2s linear;
        }
        .banner-icon-pill__label-container {
          display: inline-grid;
          grid-template-columns: 1fr;
          align-items: center;
          overflow: hidden;
          max-width: 0;
          opacity: 0;
          transition: max-width 0.24s ease-out, opacity 0.24s ease-out, margin-left 0.24s ease-out;
          margin-left: 0;
        }
        .banner-icon-pill:hover .banner-icon-pill__label-container,
        .banner-icon-pill:focus-visible .banner-icon-pill__label-container,
        .banner-icon-pill[data-active="true"] .banner-icon-pill__label-container,
        .banner-icon-pill__label-container.is-permanent {
          max-width: 240px;
          opacity: 1;
          margin-left: 0.4rem;
        }
        .banner-icon-pill__label {
          grid-area: 1 / 1;
          white-space: nowrap;
          transition: opacity 0.2s linear;
        }
        .banner-icon-pill__label.hover-only {
          opacity: 0;
        }
        .banner-icon-pill:hover .banner-icon-pill__label.hover-only,
        .banner-icon-pill:focus-visible .banner-icon-pill__label.hover-only,
        .banner-icon-pill[data-active="true"] .banner-icon-pill__label.hover-only {
          opacity: 1;
        }
        .banner-icon-pill:hover .banner-icon-pill__label.hide-on-hover,
        .banner-icon-pill:focus-visible .banner-icon-pill__label.hide-on-hover,
        .banner-icon-pill[data-active="true"] .banner-icon-pill__label.hide-on-hover {
          opacity: 0;
        }
      `}</style>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: gradients.bannerGrid,
          backgroundSize: "28px 28px",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.4), transparent 80%)",
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
            <p style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.16em", textTransform: "uppercase", color: colors.borderDefault }}>
              Scheduling Workspace
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.4rem" }}>
              <h1 style={{ margin: 0, fontSize: "clamp(1.3rem, 3.6vw, 2.2rem)", lineHeight: 1.1 }}>
                {selectedSchool?.name ?? "Select a school"}
              </h1>
              <select
                value={selectedSchoolId}
                onChange={(event) => onSchoolChange(event.target.value)}
                style={{
                  borderRadius: 999,
                  border: "1px solid rgba(147, 197, 253, 0.45)",
                  background: "rgba(30, 41, 59, 0.65)",
                  color: colors.textInverse,
                  padding: "0.37rem 0.9rem",
                  fontSize: "0.84rem",
                  minWidth: "min(100px, 100%)"
                }}
              >
                {schoolOptions.map((school) => (
                  <option key={school.id} value={school.id} style={{ background: colors.textPrimary, color: colors.textInverse }}>
                    {school.name}
                  </option>
                ))}
              </select>
              <HelpIconButton
                label="Scheduler overview"
                tone="dark"
                onClick={() => onOpenHelpTopic?.("overview")}
                style={{ width: 14, height: 14, fontSize: "0.6rem", alignSelf: "start", marginTop: "0.4rem" }}
              />
            </div>
            <div style={{ marginTop: "0.35rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
              <button type="button" onClick={() => onShiftWeek("prev")} style={pillStyle("neutral")}>
                ←
              </button>
              <p style={{ margin: 0, color: "#bfdbfe", fontWeight: 500 }}>Week of {weekLabel}</p>
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
                →
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: "0.6rem", justifyItems: "end", alignContent: "start" }}>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <span
                style={pillStyle(badge)}
              >
                {badge.label}
              </span>
              <span style={pillStyle(apiTone)}>{apiStatus.message}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
              {userDisplayName && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.35rem" }}>
                  <p style={{ margin: 0, color: "#cbd5e1", fontSize: "0.82rem", textAlign: "right" }}>
                    Signed in as <strong style={{ color: "#f8fafc" }}>{userDisplayName}</strong>
                    {userRoleLabel ? ` (${userRoleLabel})` : ""}
                  </p>
                  {onUpdateDisplayName && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        flexWrap: "wrap",
                        justifyContent: "flex-end"
                      }}
                    >
                      {isEditingName ? (
                        <>
                          <input
                            value={draftName}
                            onChange={(event) => setDraftName(event.target.value)}
                            placeholder="Update display name"
                            style={{
                              borderRadius: 999,
                              border: "1px solid rgba(148, 163, 184, 0.6)",
                              background: "rgba(15, 23, 42, 0.65)",
                              color: "#f8fafc",
                              padding: "0.25rem 0.65rem",
                              fontSize: "0.78rem",
                              minWidth: 160
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateDisplayName(draftName.trim());
                              setIsEditingName(false);
                            }}
                            disabled={Boolean(isDisplayNameSaving)}
                            style={pillStyle("active", Boolean(isDisplayNameSaving))}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDraftName(userDisplayName);
                              setIsEditingName(false);
                            }}
                            style={pillStyle("neutral")}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsEditingName(true)}
                          style={pillStyle("neutral")}
                        >
                          Edit name
                        </button>
                      )}
                    </div>
                  )}
                  {displayNameError && (
                    <span style={{ fontSize: "0.75rem", color: "#fca5a5" }}>{displayNameError}</span>
                  )}
                </div>
              )}
            </div>
            <button type="button" onClick={onLogout} style={pillStyle("danger")}>
                Log out
              </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "0.7rem 1rem",
            alignItems: "center"
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem", justifyContent: "flex-start", alignItems: "center" }}>
            {!hideViolations && (
              <>
                <button
                  type="button"
                  className="banner-icon-pill"
                  data-active={isViolationsOpen}
                  onClick={onOpenViolations}
                  disabled={!hasViolations}
                  aria-label={isViolationsOpen ? "Close Violations" : "Open Violations"}
                  style={iconPill(isViolationsOpen ? "danger" : "neutral", !hasViolations)}
                >
                  <span aria-hidden="true" style={{ fontSize: "1.1rem", fontWeight: 800 }}>!</span>
                  <div className={`banner-icon-pill__label-container ${hasViolations ? 'is-permanent' : ''}`}>
                    <span className="banner-icon-pill__label hide-on-hover">{hasViolations ? `${violationCount} Violations Outstanding` : ''}</span>
                    <span className="banner-icon-pill__label hover-only">{isViolationsOpen ? "Close Violations" : "Open Violations"}</span>
                  </div>
                </button>
                <HelpIconButton
                  label="Violation navigator"
                  tone="dark"
                  onClick={() => onOpenHelpTopic?.("violations")}
                  style={{ width: 14, height: 14, fontSize: "0.6rem", alignSelf: "start" }}
                />
              </>
            )}

            <button type="button" onClick={onAutoSchedule} disabled={!canEditSchedule} style={pillStyle("active", !canEditSchedule)}>
              ⚡ Auto
            </button>
            <HelpIconButton
              label="Auto schedule"
              tone="dark"
              onClick={() => onOpenHelpTopic?.("auto-schedule")}
              style={{ width: 14, height: 14, fontSize: "0.6rem", alignSelf: "start" }}
            />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem", justifyContent: "flex-end", alignItems: "center" }}>
            <button
              type="button"
              className="banner-icon-pill"
              data-active={isAuditOpen}
              onClick={onOpenAuditTimeline}
              aria-label={isAuditOpen ? "Close Audit Log" : "Open Audit Log"}
              style={iconPill(isAuditOpen ? "active" : "neutral")}
            >
              <span style={{ fontSize: "1.2rem" }} aria-hidden="true">↺</span>
              <div className="banner-icon-pill__label-container">
                <span className="banner-icon-pill__label">{isAuditOpen ? "Close Audit Log" : "Open Audit Log"}</span>
              </div>
            </button>
            <HelpIconButton
              label="Audit timeline"
              tone="dark"
              onClick={() => onOpenHelpTopic?.("audit")}
              style={{ width: 14, height: 14, fontSize: "0.6rem", alignSelf: "start" }}
            />

            <button
              type="button"
              className="banner-icon-pill"
              data-active={isSettingsOpen}
              onClick={onOpenSettings}
              disabled={!canManageSettings}
              aria-label={isSettingsOpen ? "Close Settings" : "Open Settings"}
              style={iconPill(isSettingsOpen ? "active" : "neutral", !canManageSettings)}
            >
              <span style={{ fontSize: "1.2rem" }} aria-hidden="true">⚙</span>
              <div className="banner-icon-pill__label-container">
                <span className="banner-icon-pill__label">{isSettingsOpen ? "Close Settings" : "Open Settings"}</span>
              </div>
            </button>

            <button
              type="button"
              className="banner-icon-pill"
              data-active={isUserManagementOpen}
              onClick={onOpenUserManagement}
              disabled={!canManageUsers}
              aria-label={isUserManagementOpen ? "Close Users" : "Manage Users"}
              style={iconPill(isUserManagementOpen ? "active" : "neutral", !canManageUsers)}
            >
              <span style={{ display: "inline-flex", color: colors.textInverse }} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21a8 8 0 0 0-16 0" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <div className="banner-icon-pill__label-container">
                <span className="banner-icon-pill__label">{isUserManagementOpen ? "Close Users" : "Manage Users"}</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
