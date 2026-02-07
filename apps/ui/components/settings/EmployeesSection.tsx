import type { Employee } from "@core/domain/types";

interface EmployeesSectionProps {
  draftEmployees: Employee[];
  jobTitleOptions: string[];
  onChange: (next: Employee[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onSave: () => void;
  canSave: boolean;
}

export default function EmployeesSection({
  draftEmployees,
  jobTitleOptions,
  onChange,
  onAdd,
  onRemove,
  onSave,
  canSave
}: EmployeesSectionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr 1fr 1fr auto",
          gap: "0.75rem",
          fontSize: "0.75rem",
          color: "#6b7280",
          paddingLeft: "0.25rem"
        }}
      >
        <span>Employee</span>
        <span>Job title</span>
        <span>Max hours/day</span>
        <span>Max hours/week</span>
        <span />
      </div>
      {draftEmployees.map((employee, index) => (
        <div
          key={employee.id}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: "0.75rem",
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "1.2fr 1fr 1fr 1fr auto"
          }}
        >
          <input
            value={employee.name}
            onChange={(event) => {
              const next = [...draftEmployees];
              next[index] = { ...employee, name: event.target.value };
              onChange(next);
            }}
            style={{
              borderRadius: 10,
              border: "1px solid #d1d5db",
              padding: "0.45rem 0.6rem"
            }}
            placeholder="Name"
          />
          <select
            value={employee.jobTitle}
            onChange={(event) => {
              const next = [...draftEmployees];
              next[index] = { ...employee, jobTitle: event.target.value };
              onChange(next);
            }}
            style={{
              borderRadius: 10,
              border: "1px solid #d1d5db",
              padding: "0.45rem 0.6rem"
            }}
          >
            {jobTitleOptions.map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={employee.maxHoursPerDay}
            onChange={(event) => {
              const next = [...draftEmployees];
              next[index] = { ...employee, maxHoursPerDay: Number(event.target.value) || 0 };
              onChange(next);
            }}
            style={{
              borderRadius: 10,
              border: "1px solid #d1d5db",
              padding: "0.45rem 0.6rem"
            }}
            placeholder="Max hours/day"
          />
          <input
            type="number"
            min={1}
            value={employee.maxHoursPerWeek}
            onChange={(event) => {
              const next = [...draftEmployees];
              next[index] = { ...employee, maxHoursPerWeek: Number(event.target.value) || 0 };
              onChange(next);
            }}
            style={{
              borderRadius: 10,
              border: "1px solid #d1d5db",
              padding: "0.45rem 0.6rem"
            }}
            placeholder="Max hours/week"
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
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {([
              { key: "cprCurrent", label: "CPR current" },
              { key: "medicallyDelegated", label: "Med delegated" }
            ] as const).map((flag) => (
              <label key={flag.key} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <input
                  type="checkbox"
                  checked={employee[flag.key]}
                  onChange={(event) => {
                    const next = [...draftEmployees];
                    next[index] = { ...employee, [flag.key]: event.target.checked };
                    onChange(next);
                  }}
                />
                <span style={{ fontSize: "0.85rem", color: "#334155" }}>{flag.label}</span>
              </label>
            ))}
          </div>
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
        Add employee
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
        Save employees
      </button>
    </div>
  );
}
