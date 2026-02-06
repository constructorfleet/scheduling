import { Employee, StaffAssignment } from "../../../src/domain/types";

interface StaffPaletteProps {
  staff: Employee[];
  assignments: StaffAssignment[];
  selectedId?: string;
  onSelect?: (staffId: string) => void;
}

const getDurationHours = (start: string, end: string) => {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startDecimal = startHour + startMinute / 60;
  const endDecimal = endHour + endMinute / 60;
  return Math.max(0, endDecimal - startDecimal);
};

export default function StaffPalette({ staff, assignments, selectedId, onSelect }: StaffPaletteProps) {
  const assignmentsByEmployee = staff.reduce<Record<string, StaffAssignment[]>>((acc, employee) => {
    acc[employee.id] = assignments.filter((assignment) => assignment.employeeId === employee.id);
    return acc;
  }, {});

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 16,
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Staff palette</h3>
        <button
          style={{
            fontSize: "0.85rem",
            border: "none",
            background: "#e5e7eb",
            borderRadius: 999,
            padding: "0.25rem 0.75rem"
          }}
          onClick={() => onSelect?.(staff[0]?.id ?? "")}
        >
          Auto-select
        </button>
      </div>
      {staff.map((member) => {
        const employeeAssignments = assignmentsByEmployee[member.id] ?? [];
        const totalHours = employeeAssignments.reduce((sum, assignment) => sum + getDurationHours(assignment.startTime, assignment.endTime), 0);
        const badges = [] as string[];
        if (member.leaderQualified) {
          badges.push("Leader");
        }
        if (member.cprCurrent) {
          badges.push("CPR");
        }
        if (member.medicallyDelegated) {
          badges.push("Med Del");
        }

        return (
          <button
            key={member.id}
            onClick={() => onSelect?.(member.id)}
            style={{
              borderRadius: 12,
              padding: "0.75rem",
              textAlign: "left",
              border: selectedId === member.id ? "2px solid #2563eb" : "1px solid #e5e7eb",
              background: selectedId === member.id ? "#eef2ff" : "#f8fafc",
              cursor: "pointer"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{member.name}</p>
                <p style={{ margin: 0, color: "#6b7280", fontSize: "0.85rem" }}>{member.jobTitle}</p>
              </div>
              <span style={{ fontSize: "0.9rem", color: "#2563eb" }}>{totalHours.toFixed(1)} hrs</span>
            </div>
            <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
              {badges.map((badge) => (
                <span
                  key={badge}
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.15rem 0.5rem",
                    borderRadius: 999,
                    background: "#fff",
                    border: "1px solid #e5e7eb"
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
