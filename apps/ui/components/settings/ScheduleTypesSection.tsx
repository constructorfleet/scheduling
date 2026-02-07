import type { ScheduleTypeOption } from "../DayMetadataStrip";

interface ScheduleTypesSectionProps {
  draftScheduleTypes: ScheduleTypeOption[];
  onChange: (next: ScheduleTypeOption[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onSave: () => void;
  canSave: boolean;
}

export default function ScheduleTypesSection({
  draftScheduleTypes,
  onChange,
  onAdd,
  onRemove,
  onSave,
  canSave
}: ScheduleTypesSectionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "160px 200px 1fr auto",
          gap: "0.75rem",
          fontSize: "0.75rem",
          color: "#6b7280",
          paddingLeft: "0.75rem",
          paddingRight: "0.75rem",
          alignItems: "center"
        }}
      >
        <span>Schedule type</span>
        <span style={{ textAlign: "center" }}>Adult:Student Ratio</span>
        <span>Description</span>
        <span />
      </div>
      {draftScheduleTypes.map((type, index) => (
        <div
          key={`${type.value}-${index}`}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: "0.75rem",
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "160px 200px 1fr auto",
            alignItems: "center"
          }}
        >
          <input
            value={type.label}
            onChange={(event) => {
              const next = [...draftScheduleTypes];
              next[index] = { ...type, label: event.target.value };
              onChange(next);
            }}
            style={{
              borderRadius: 10,
              border: "1px solid #d1d5db",
              padding: "0.45rem 0.6rem"
            }}
            placeholder="Label"
          />
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
            <input
              type="number"
              min={1}
              value={type.ratio.adults}
              onChange={(event) => {
                const next = [...draftScheduleTypes];
                next[index] = {
                  ...type,
                  ratio: { ...type.ratio, adults: Math.max(1, Number(event.target.value)) }
                };
                onChange(next);
              }}
              style={{
                borderRadius: 10,
                border: "1px solid #d1d5db",
                padding: "0.45rem 0.6rem",
                width: 52,
                textAlign: "center"
              }}
              placeholder="A"
            />
            <span style={{ color: "#6b7280", fontWeight: 600 }}>:</span>
            <input
              type="number"
              min={1}
              value={type.ratio.students}
              onChange={(event) => {
                const next = [...draftScheduleTypes];
                next[index] = {
                  ...type,
                  ratio: { ...type.ratio, students: Math.max(1, Number(event.target.value)) }
                };
                onChange(next);
              }}
              style={{
                borderRadius: 10,
                border: "1px solid #d1d5db",
                padding: "0.45rem 0.6rem",
                width: 52,
                textAlign: "center"
              }}
              placeholder="S"
            />
          </div>
          <input
            value={type.description}
            onChange={(event) => {
              const next = [...draftScheduleTypes];
              next[index] = { ...type, description: event.target.value };
              onChange(next);
            }}
            style={{
              borderRadius: 10,
              border: "1px solid #d1d5db",
              padding: "0.45rem 0.6rem"
            }}
            placeholder="Description"
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
      ))}
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
        Add schedule type
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
        Save schedule types
      </button>
    </div>
  );
}
