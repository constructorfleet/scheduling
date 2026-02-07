import type { DayOfWeek } from "@core/domain/types";
import type { SchoolRules } from "../SettingsPanel";

interface SchoolSectionProps {
  draftSchoolName: string;
  draftSchoolRules: SchoolRules;
  draftClosedDays: DayOfWeek[];
  allDays: DayOfWeek[];
  onSchoolNameChange: (value: string) => void;
  onSchoolRulesChange: (next: SchoolRules) => void;
  onClosedDaysChange: (next: DayOfWeek[]) => void;
  onSave: () => void;
  canSave: boolean;
}

export default function SchoolSettingsSection({
  draftSchoolName,
  draftSchoolRules,
  draftClosedDays,
  allDays,
  onSchoolNameChange,
  onSchoolRulesChange,
  onClosedDaysChange,
  onSave,
  canSave
}: SchoolSectionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <label style={{ fontSize: "0.8rem", color: "#475569", fontWeight: 600 }}>School name</label>
        <input
          value={draftSchoolName}
          onChange={(event) => onSchoolNameChange(event.target.value)}
          style={{
            borderRadius: 10,
            border: "1px solid #d1d5db",
            padding: "0.45rem 0.6rem",
            maxWidth: 360
          }}
          placeholder="School name"
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.75rem" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.8rem" }}>
          Number of openers
          <input
            type="number"
            min={0}
            value={draftSchoolRules.openerCount}
            onChange={(event) =>
              onSchoolRulesChange({
                ...draftSchoolRules,
                openerCount: Number(event.target.value) || 0
              })
            }
            style={{ borderRadius: 10, border: "1px solid #d1d5db", padding: "0.45rem 0.6rem" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.8rem" }}>
          Number of closers
          <input
            type="number"
            min={0}
            value={draftSchoolRules.closerCount}
            onChange={(event) =>
              onSchoolRulesChange({
                ...draftSchoolRules,
                closerCount: Number(event.target.value) || 0
              })
            }
            style={{ borderRadius: 10, border: "1px solid #d1d5db", padding: "0.45rem 0.6rem" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.8rem" }}>
          Required Med. Del. at all times
          <input
            type="number"
            min={0}
            value={draftSchoolRules.minimumMedicalDelegated}
            onChange={(event) =>
              onSchoolRulesChange({
                ...draftSchoolRules,
                minimumMedicalDelegated: Number(event.target.value) || 0
              })
            }
            style={{ borderRadius: 10, border: "1px solid #d1d5db", padding: "0.45rem 0.6rem" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.8rem" }}>
          Require current CPR
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <input
              type="checkbox"
              checked={draftSchoolRules.requireCurrentCpr}
              onChange={(event) =>
                onSchoolRulesChange({
                  ...draftSchoolRules,
                  requireCurrentCpr: event.target.checked
                })
              }
            />
            <span style={{ fontSize: "0.8rem", color: "#334155" }}>CPR must be current to schedule</span>
          </label>
        </label>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <span style={{ fontSize: "0.8rem", color: "#475569", fontWeight: 600 }}>Closed days</span>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {allDays.map((day) => (
            <label key={`closed-${day}`} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <input
                type="checkbox"
                checked={draftClosedDays.includes(day)}
                onChange={(event) => {
                  const next = new Set(draftClosedDays);
                  if (event.target.checked) {
                    next.add(day);
                  } else {
                    next.delete(day);
                  }
                  onClosedDaysChange(Array.from(next));
                }}
              />
              <span style={{ fontSize: "0.8rem", color: "#334155" }}>{day.toUpperCase()}</span>
            </label>
          ))}
        </div>
      </div>
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
        Save school settings
      </button>
    </div>
  );
}
