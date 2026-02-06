import { DayOfWeek, DaySegment, Employee, SegmentBlock, StaffAssignment } from "../../../src/domain/types";
import { RuleViolation } from "../types";

interface ScheduleGridProps {
  segments: SegmentBlock[];
  assignments: StaffAssignment[];
  employees: Employee[];
  violations: RuleViolation[];
  focusedSegmentId?: string;
  onFocusSegment: (segmentId: string) => void;
  daySequence: DayOfWeek[];
  dayDisplayNames: Record<DayOfWeek, string>;
  segmentDefinitions: Record<DaySegment, { label: string; start: string; end: string; baseChildCount?: number }>;
  onAutoBalance?: () => void;
}

const ROW_ORDER: DaySegment[] = ["open", "mid", "close"];

const toHours = (start: string, end: string) => {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  return endHour + endMinute / 60 - (startHour + startMinute / 60);
};

export default function ScheduleGrid({
  segments,
  assignments,
  employees,
  violations,
  focusedSegmentId,
  onFocusSegment,
  daySequence,
  dayDisplayNames,
  segmentDefinitions,
  onAutoBalance
}: ScheduleGridProps) {
  const assignmentsBySegment = assignments.reduce<Record<string, StaffAssignment[]>>((map, assignment) => {
    if (!map[assignment.segmentBlockId]) {
      map[assignment.segmentBlockId] = [];
    }
    map[assignment.segmentBlockId].push(assignment);
    return map;
  }, {});

  const violationsBySegment = violations.reduce<Record<string, RuleViolation[]>>((map, violation) => {
    if (!map[violation.segmentBlockId]) {
      map[violation.segmentBlockId] = [];
    }
    map[violation.segmentBlockId].push(violation);
    return map;
  }, {});

  const employeeById = Object.fromEntries(employees.map((employee) => [employee.id, employee]));

  const renderBlock = (block: SegmentBlock) => {
    const assignmentList = assignmentsBySegment[block.id] ?? [];
    const assignedStaff = assignmentList
      .map((assignment) => employeeById[assignment.employeeId])
      .filter((employee): employee is Employee => Boolean(employee));
    const assignedCount = assignedStaff.length;
    const ratio = block.requirementTemplate.ratioProfile.childrenPerStaff;
    const requiredStaff = Math.max(block.requirementTemplate.minStaff, Math.ceil(block.childCount / ratio));
    const hasLeader = assignedStaff.some((employee) => employee.leaderQualified);
    const hasViolation = (violationsBySegment[block.id]?.length ?? 0) > 0;
    const compliant = assignedCount >= requiredStaff && hasLeader;
    const slot = segmentDefinitions[block.segment];
    if (!slot) {
      return null;
    }
    const blockFocused = focusedSegmentId === block.id;

    const baseStyle = {
      borderRadius: 14,
      padding: "0.75rem",
      border: blockFocused ? "2px solid #2563eb" : hasViolation ? "1px solid #dc2626" : "1px solid #e5e7eb",
      backgroundColor: hasViolation ? "#fef2f2" : compliant ? "#ecfdf5" : "#fffbeb",
      minHeight: 160,
      display: "flex",
      flexDirection: "column",
      gap: "0.35rem",
      cursor: "pointer"
    } as const;

    return (
      <article key={block.id} style={baseStyle} onClick={() => onFocusSegment(block.id)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{slot.label}</p>
          <span
            style={{
              fontSize: "0.75rem",
              padding: "0.15rem 0.5rem",
              borderRadius: 999,
              background: "rgba(15, 23, 42, 0.1)"
            }}
          >
            {block.startTime}–{block.endTime}
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "0.75rem",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#374151"
            }}
          >
            Children: {block.childCount}
          </span>
          <span
            style={{
              fontSize: "0.75rem",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#374151"
            }}
          >
            Required staff: {requiredStaff}
          </span>
          {block.fieldTripEventId && (
            <span style={{ fontSize: "0.75rem", color: "#b45309" }}>Field trip override</span>
          )}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {assignmentList.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>No staff assigned yet.</p>
          ) : (
            assignmentList.map((assignment) => {
              const employee = employeeById[assignment.employeeId];
              if (!employee) return null;
              return (
                <div
                  key={assignment.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "0.35rem 0.5rem",
                    borderRadius: 8,
                    background: "#fff",
                    border: "1px solid #e5e7eb"
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>{employee.name}</p>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "#6b7280" }}>{employee.jobTitle}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: "0.75rem" }}>{toHours(assignment.startTime, assignment.endTime).toFixed(1)} hrs</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", color: "#2563eb", fontWeight: 600 }}>
            {compliant ? "Compliant" : hasViolation ? "Action required" : "Pending review"}
          </span>
          {violationsBySegment[block.id]?.length ? (
            <span style={{ fontSize: "0.75rem", color: "#9f1239" }}>
              {violationsBySegment[block.id].length} violation(s)
            </span>
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <section style={{ background: "#ffffff", borderRadius: 20, padding: "1rem", boxShadow: "0 20px 40px rgba(15, 23, 42, 0.07)", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0 }}>Schedule grid</h3>
          <p style={{ margin: 0, color: "#6b7280" }}>Drag staff cards here or use auto-balancing quick fixes.</p>
        </div>
        <button
          onClick={() => onAutoBalance?.()}
          style={{
            borderRadius: 999,
            border: "1px solid #2563eb",
            background: "#eff6ff",
            color: "#1d4ed8",
            padding: "0.4rem 1rem"
          }}
        >
          Auto-balance suggestions
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${daySequence.length}, minmax(0, 1fr))`,
          gap: "0.75rem"
        }}
      >
        {daySequence.map((day) => (
          <div key={`header-${day}`}>
            <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{dayDisplayNames[day]}</p>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${daySequence.length}, minmax(0, 1fr))`,
          gap: "0.5rem"
        }}
      >
        {ROW_ORDER.map((segmentKey) => (
          <div key={segmentKey} style={{ display: "contents" }}>
            {daySequence.map((day) => {
              const block = segments.find((candidate) => candidate.dayOfWeek === day && candidate.segment === segmentKey);
              if (!block) {
                return (
                  <div
                    key={`${day}-${segmentKey}-placeholder`}
                    style={{
                      minHeight: 160,
                      borderRadius: 14,
                      background: "#f8fafc",
                      border: "1px dashed #d1d5db",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#9ca3af"
                    }}
                  >
                    Coming soon
                  </div>
                );
              }

              return <div key={block.id}>{renderBlock(block)}</div>;
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
