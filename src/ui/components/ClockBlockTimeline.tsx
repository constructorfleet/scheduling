import { DayOfWeek, Employee, SegmentBlock, StaffAssignment } from "../../domain/types";
import { RuleViolation } from "../types";

interface ClockBlockTimelineProps {
  segments: SegmentBlock[];
  assignments: StaffAssignment[];
  employees: Employee[];
  violations: RuleViolation[];
  focusedSegmentId?: string;
  onFocusSegment: (segmentId: string) => void;
  daySequence: DayOfWeek[];
  dayDisplayNames: Record<DayOfWeek, string>;
  onAutoBalance?: () => void;
}

const parseTimeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const formatTimeLabel = (minutes: number) => {
  const normalizedHour = Math.floor(minutes / 60);
  const displayHour = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
  const suffix = normalizedHour >= 12 ? "p" : "a";
  return `${displayHour}:00${suffix}`;
};

export default function ClockBlockTimeline({
  segments,
  assignments,
  employees,
  violations,
  focusedSegmentId,
  onFocusSegment,
  daySequence,
  dayDisplayNames,
  onAutoBalance
}: ClockBlockTimelineProps) {
  const assignmentsByBlock = assignments.reduce<Record<string, StaffAssignment[]>>((map, assignment) => {
    if (!map[assignment.segmentBlockId]) {
      map[assignment.segmentBlockId] = [];
    }
    map[assignment.segmentBlockId].push(assignment);
    return map;
  }, {});

  const violationsByBlock = violations.reduce<Record<string, RuleViolation[]>>((map, violation) => {
    if (!map[violation.segmentBlockId]) {
      map[violation.segmentBlockId] = [];
    }
    map[violation.segmentBlockId].push(violation);
    return map;
  }, {});

  const employeesById = Object.fromEntries(employees.map((employee) => [employee.id, employee]));

  const hasSegments = segments.length > 0;
  const earliestStart = hasSegments
    ? Math.min(...segments.map((segment) => parseTimeToMinutes(segment.startTime)))
    : 7 * 60;
  const latestEnd = hasSegments
    ? Math.max(...segments.map((segment) => parseTimeToMinutes(segment.endTime)))
    : 18 * 60;
  const startMinute = Math.max(earliestStart - 30, 6 * 60);
  const endMinute = Math.min(latestEnd + 30, 21 * 60);
  const totalSpan = Math.max(endMinute - startMinute, 1);
  const axisMarkers = [];
  for (let marker = startMinute; marker <= endMinute; marker += 60) {
    axisMarkers.push(marker);
  }
  const timelineHeight = 360;

  const segmentsByDay = daySequence.reduce<Record<DayOfWeek, SegmentBlock[]>>((map, day) => {
    map[day] = segments
      .filter((segment) => segment.dayOfWeek === day)
      .sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
    return map;
  }, {} as Record<DayOfWeek, SegmentBlock[]>);

  return (
    <section
      style={{
        background: "#ffffff",
        borderRadius: 18,
        padding: "1rem",
        boxShadow: "0 20px 40px rgba(15, 23, 42, 0.08)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0 }}>Clock block timeline</h3>
          <p style={{ margin: 0, color: "#6b7280" }}>Drag, extend, or add precise clock-in/out windows.</p>
        </div>
        <button
          onClick={() => onAutoBalance?.()}
          style={{
            borderRadius: 999,
            border: "1px solid #2563eb",
            background: "#eff6ff",
            color: "#1d4ed8",
            padding: "0.45rem 1rem"
          }}
        >
          Auto-balance suggestions
        </button>
      </div>

      <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: `60px repeat(${daySequence.length}, minmax(0, 1fr))`, gap: "0.5rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.75rem", fontWeight: 600 }}>
          {axisMarkers.map((marker) => (
            <span key={`axis-${marker}`} style={{ height: `${timelineHeight / axisMarkers.length}px`, display: "flex", alignItems: "center" }}>
              {formatTimeLabel(marker)}
            </span>
          ))}
        </div>

        {daySequence.map((day) => (
          <div key={`timeline-${day}`} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#111827",
                marginBottom: "0.25rem"
              }}
            >
              {dayDisplayNames[day]}
            </div>
            <div
              style={{
                position: "relative",
                minHeight: timelineHeight,
                borderRadius: 16,
                border: "1px solid #e5e7eb",
                background: "#f8fafc",
                overflow: "hidden"
              }}
            >
              {segmentsByDay[day]?.length ? (
                segmentsByDay[day].map((segment) => {
                  const blockStart = Math.max(parseTimeToMinutes(segment.startTime) - startMinute, 0);
                  const blockEnd = Math.min(parseTimeToMinutes(segment.endTime) - startMinute, totalSpan);
                  const duration = Math.max(blockEnd - blockStart, 15);
                  const top = (blockStart / totalSpan) * timelineHeight;
                  const height = Math.max((duration / totalSpan) * timelineHeight, 60);
                  const assigned = assignmentsByBlock[segment.id] ?? [];
                  const assignedStaff = assigned
                    .map((assignment) => employeesById[assignment.employeeId])
                    .filter((employee): employee is Employee => Boolean(employee));
                  const ratioChildren = segment.requirementTemplate.ratioProfile.childrenPerStaff || 0;
                  const requiredStaff = Math.max(
                    segment.requirementTemplate.minStaff,
                    Math.ceil(segment.childCount / Math.max(ratioChildren, 1))
                  );
                  const hasLeader = assignedStaff.some((employee) => employee.leaderQualified);
                  const violationsForBlock = violationsByBlock[segment.id] ?? [];
                  const blockFocused = focusedSegmentId === segment.id;

                  return (
                    <button
                      key={segment.id}
                      type="button"
                      aria-pressed={blockFocused}
                      aria-label={`${dayDisplayNames[day]} ${segment.startTime} – ${segment.endTime} ${segment.segment}`}
                      onClick={() => onFocusSegment(segment.id)}
                      style={{
                        position: "absolute",
                        top,
                        height,
                        left: "8px",
                        right: "8px",
                        borderRadius: 16,
                        border: blockFocused ? "2px solid #2563eb" : "1px solid #d1d5db",
                        background: violationsForBlock.length
                          ? "#fff1f2"
                          : assignedStaff.length >= requiredStaff && hasLeader
                            ? "#ecfdf5"
                            : "#fff7ed",
                        padding: "0.6rem",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "stretch",
                        gap: "0.35rem",
                        cursor: "pointer",
                        textAlign: "left"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600 }}>{segment.startTime} – {segment.endTime}</span>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.15rem 0.5rem",
                            borderRadius: 999,
                            background: "#eef2ff",
                            color: "#1d4ed8"
                          }}
                        >
                          {segment.segment}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                        <span>Children: {segment.childCount}</span>
                        <span>Req staff: {requiredStaff}</span>
                        <span>Ratio 1:{ratioChildren || "?"}</span>
                      </div>
                      {assignedStaff.length === 0 ? (
                        <p style={{ margin: 0, color: "#6b7280", fontSize: "0.8rem" }}>No staff assigned yet.</p>
                      ) : (
                        assignedStaff.map((staff) => (
                          <div
                            key={`${segment.id}-${staff.id}`}
                            style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}
                          >
                            <span>{staff.name}</span>
                            <span>{staff.jobTitle}</span>
                          </div>
                        ))
                      )}
                      {violationsForBlock.length > 0 && (
                        <span
                          style={{
                            alignSelf: "flex-end",
                            fontSize: "0.65rem",
                            padding: "0.2rem 0.6rem",
                            borderRadius: 999,
                            background: "#fee2e2",
                            color: "#991b1b"
                          }}
                        >
                          {violationsForBlock.length} violation(s)
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#9ca3af",
                    fontSize: "0.8rem"
                  }}
                >
                  No blocks yet
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
