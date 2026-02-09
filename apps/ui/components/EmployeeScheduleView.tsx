import { useEffect, useMemo, useState } from "react";
import type { DayOfWeek, SegmentBlock, StaffAssignment } from "@core/domain/types";
import { colors } from "../theme";

export type EmployeeScheduleEmployee = {
  id: string;
  name: string;
};

export type EmployeeScheduleSegmentBlock = Pick<
  SegmentBlock,
  "id" | "dayOfWeek" | "segment" | "startTime" | "endTime"
>;

export type EmployeeScheduleAssignment = Pick<
  StaffAssignment,
  "id" | "segmentBlockId" | "employeeId" | "startTime" | "endTime"
>;

interface EmployeeScheduleViewProps {
  employees: EmployeeScheduleEmployee[];
  assignments: EmployeeScheduleAssignment[];
  segmentBlocks: EmployeeScheduleSegmentBlock[];
  daySequence: DayOfWeek[];
  dayDisplayNames: Record<DayOfWeek, string>;
}

const formatTime = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;
};

export default function EmployeeScheduleView({
  employees,
  assignments,
  segmentBlocks,
  daySequence,
  dayDisplayNames
}: EmployeeScheduleViewProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(() => employees[0]?.id ?? "");
  const segmentById = useMemo(() => new Map(segmentBlocks.map((segment) => [segment.id, segment])), [segmentBlocks]);

  useEffect(() => {
    if (!selectedEmployeeId && employees.length > 0) {
      setSelectedEmployeeId(employees[0].id);
      return;
    }
    if (selectedEmployeeId && !employees.some((employee) => employee.id === selectedEmployeeId)) {
      setSelectedEmployeeId(employees[0]?.id ?? "");
    }
  }, [employees, selectedEmployeeId]);

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) ?? null;
  const assignmentsByDay = useMemo(() => {
    const grouped = new Map<DayOfWeek, EmployeeScheduleAssignment[]>();
    daySequence.forEach((day) => grouped.set(day, []));
    assignments
      .filter((assignment) => assignment.employeeId === selectedEmployeeId)
      .forEach((assignment) => {
        const segment = segmentById.get(assignment.segmentBlockId);
        if (!segment) return;
        const dayAssignments = grouped.get(segment.dayOfWeek);
        if (dayAssignments) {
          dayAssignments.push(assignment);
        }
      });
    return grouped;
  }, [assignments, daySequence, segmentById, selectedEmployeeId]);

  return (
    <section
      style={{
        borderRadius: 16,
        border: `1px solid ${colors.borderSubtle}`,
        background: colors.surface,
        padding: "1.1rem",
        display: "grid",
        gap: "1rem"
      }}
    >
      <header style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
        <div style={{ flex: "1 1 220px" }}>
          <p style={{ margin: 0, fontSize: "0.8rem", color: colors.textMuted, fontWeight: 600 }}>View schedule</p>
          <h2 style={{ margin: "0.15rem 0 0", fontSize: "1.1rem" }}>
            {selectedEmployee?.name ?? "Select an employee"}
          </h2>
        </div>
        <div style={{ display: "grid", gap: "0.35rem", minWidth: 220 }}>
          <label style={{ fontSize: "0.75rem", color: colors.textMuted }}>Employee</label>
          <select
            value={selectedEmployeeId}
            onChange={(event) => setSelectedEmployeeId(event.target.value)}
            style={{
              borderRadius: 10,
              border: `1px solid ${colors.borderSubtle}`,
              padding: "0.45rem 0.6rem",
              background: colors.surface
            }}
          >
            {employees.length === 0 && <option value="">No employees</option>}
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div style={{ display: "grid", gap: "0.75rem" }}>
        {daySequence.map((day) => {
          const dayAssignments = assignmentsByDay.get(day) ?? [];
          const displayAssignments = dayAssignments
            .map((assignment) => {
              const segment = segmentById.get(assignment.segmentBlockId);
              return {
                id: assignment.id,
                startTime: assignment.startTime,
                endTime: assignment.endTime,
                segmentLabel: segment?.segment ?? ""
              };
            })
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

          return (
            <div
              key={day}
              style={{
                borderRadius: 12,
                border: `1px solid ${colors.borderSubtle}`,
                padding: "0.75rem",
                background: colors.surfaceAlt
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <span style={{ fontWeight: 600 }}>{dayDisplayNames[day]}</span>
                <span style={{ fontSize: "0.8rem", color: colors.textMuted }}>
                  {displayAssignments.length === 0 ? "No shifts" : `${displayAssignments.length} shift(s)`}
                </span>
              </div>
              {displayAssignments.length === 0 ? (
                <p style={{ margin: 0, color: colors.textMuted, fontSize: "0.85rem" }}>
                  No scheduled blocks.
                </p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.35rem" }}>
                  {displayAssignments.map((assignment) => (
                    <li
                      key={assignment.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.45rem 0.6rem",
                        borderRadius: 10,
                        background: colors.surface
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        {formatTime(assignment.startTime)} - {formatTime(assignment.endTime)}
                      </span>
                      {assignment.segmentLabel && (
                        <span style={{ fontSize: "0.8rem", color: colors.textMuted }}>{assignment.segmentLabel}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
