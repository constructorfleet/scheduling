import type { DayOfWeek, ScheduleType } from "@core/domain/types";
import type { OperatingHoursConfig } from "../SettingsPanel";
import type { ScheduleTypeOption } from "../DayMetadataStrip";

interface OperatingHoursSectionProps {
  draftOperatingHours: OperatingHoursConfig[];
  draftScheduleTypes: ScheduleTypeOption[];
  draftClosedDays: DayOfWeek[];
  allDays: DayOfWeek[];
  operatingHoursOverlap: string[];
  onChange: (next: OperatingHoursConfig[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onSave: () => void;
  canSave: boolean;
}

export default function OperatingHoursSection({
  draftOperatingHours,
  draftScheduleTypes,
  draftClosedDays,
  allDays,
  operatingHoursOverlap,
  onChange,
  onAdd,
  onRemove,
  onSave,
  canSave
}: OperatingHoursSectionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 96px",
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
            gridTemplateColumns: "160px 1.5fr 1fr 1fr",
            gap: "0.75rem",
            alignItems: "center"
          }}
        >
          <span style={{ textAlign: "center", justifySelf: "center" }}>Schedule type</span>
          <span style={{ textAlign: "center", justifySelf: "center" }}>Days of week</span>
          <span style={{ textAlign: "center", justifySelf: "center" }}>Open</span>
          <span style={{ textAlign: "center", justifySelf: "center" }}>Close</span>
        </div>
        <span />
      </div>
      {draftOperatingHours.map((entry, index) => {
        const usedDays = new Set<DayOfWeek>();
        draftOperatingHours.forEach((other, otherIndex) => {
          if (otherIndex === index) return;
          if (other.scheduleType !== entry.scheduleType) return;
          other.daysOfWeek.forEach((day) => usedDays.add(day));
        });

        return (
          <div
            key={entry.id}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: "0.75rem",
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "160px 1.5fr 1fr 1fr 96px"
            }}
          >
            <select
              value={entry.scheduleType}
              onChange={(event) => {
                const next = [...draftOperatingHours];
                next[index] = { ...entry, scheduleType: event.target.value as ScheduleType };
                onChange(next);
              }}
              style={{
                borderRadius: 10,
                border: "1px solid #d1d5db",
                padding: "0.45rem 0.6rem"
              }}
            >
              {draftScheduleTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {allDays.map((day) => {
                const isClosed = draftClosedDays.includes(day);
                const isUsedElsewhere = usedDays.has(day);
                const isDisabled = isClosed || isUsedElsewhere;
                return (
                  <label
                    key={`${entry.id}-${day}`}
                    style={{
                      display: "flex",
                      gap: "0.25rem",
                      fontSize: "0.8rem",
                      color: isDisabled ? "#9ca3af" : "#334155"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={entry.daysOfWeek.includes(day)}
                      disabled={isDisabled && !entry.daysOfWeek.includes(day)}
                      onChange={(event) => {
                        const next = [...draftOperatingHours];
                        const days = new Set(entry.daysOfWeek);
                        if (event.target.checked) {
                          days.add(day);
                        } else {
                          days.delete(day);
                        }
                        next[index] = { ...entry, daysOfWeek: Array.from(days) };
                        onChange(next);
                      }}
                    />
                    {day.toUpperCase()}
                  </label>
                );
              })}
            </div>
            <input
              type="time"
              value={entry.open}
              onChange={(event) => {
                const next = [...draftOperatingHours];
                next[index] = { ...entry, open: event.target.value };
                onChange(next);
              }}
              style={{
                borderRadius: 10,
                border: "1px solid #d1d5db",
                padding: "0.45rem 0.6rem"
              }}
            />
            <input
              type="time"
              value={entry.close}
              onChange={(event) => {
                const next = [...draftOperatingHours];
                next[index] = { ...entry, close: event.target.value };
                onChange(next);
              }}
              style={{
                borderRadius: 10,
                border: "1px solid #d1d5db",
                padding: "0.45rem 0.6rem"
              }}
            />
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
          </div>
        );
      })}
      {operatingHoursOverlap.length > 0 && (
        <div
          style={{
            border: "1px solid #fecaca",
            background: "#fee2e2",
            color: "#b91c1c",
            padding: "0.5rem 0.75rem",
            borderRadius: 10
          }}
        >
          {operatingHoursOverlap.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </div>
      )}
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
        Add operating hours set
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
        Save operating hours
      </button>
    </div>
  );
}
