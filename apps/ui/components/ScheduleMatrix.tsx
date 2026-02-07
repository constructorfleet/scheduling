import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  DayOfWeek,
  Employee,
  FieldTripEvent,
  FieldTripType,
  OperatingHours,
  ScheduleDay,
  ScheduleType,
  SegmentBlock,
  StaffAssignment
} from "@core/domain/types";
import { ScheduleTypeOption, FieldTripSelection } from "./DayMetadataStrip";
import { parseTimeToMinutes } from "@core/rules/utils";

interface ScheduleMatrixProps {
  staff: Employee[];
  employeeOptions: Employee[];
  assignments: StaffAssignment[];
  segmentBlocks: SegmentBlock[];
  days: ScheduleDay[];
  daySequence: DayOfWeek[];
  dayDisplayNames: Record<DayOfWeek, string>;
  scheduleTypeOptions: ScheduleTypeOption[];
  fieldTripTypes: FieldTripType[];
  fieldTripEventsByDay: Record<DayOfWeek, FieldTripEvent | undefined>;
  operatingHoursByDay: Record<DayOfWeek, OperatingHours | undefined>;
  onEnrollmentChange: (dayId: string, enrollment: number | undefined) => void;
  onScheduleTypeChange: (dayId: string, scheduleType: ScheduleType | undefined) => void;
  onFieldTripSelection: (dayId: string, selection: FieldTripSelection) => void;
  onUpdateAssignmentTime: (assignmentId: string, startTime: string, endTime: string) => void;
  onDeleteAssignment: (assignmentId: string) => void;
  onCreateAssignment: (payload: { employeeId: string; dayOfWeek: DayOfWeek; startTime: string; endTime: string }) => void;
  onReassignUnlinkedStaff: (fromEmployeeId: string, toEmployeeId: string) => void;
  focusedSegmentIds?: string[] | null;
}

const formatTime = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${period}`;
};

const formatDateLabel = (value?: string) => {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const normalizeDateOnly = (value: string) => value.split("T")[0];

const getDurationHours = (start: string, end: string) => {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startDecimal = startHour + startMinute / 60;
  const endDecimal = endHour + endMinute / 60;
  return Math.max(0, endDecimal - startDecimal);
};

const FIELD_TRIP_OPTIONS = (fieldTripTypes: FieldTripType[]) => [
  {
    value: "no-field-trip",
    label: "No Field Trip"
  },
  ...fieldTripTypes.map((type) => ({
    value: type.id,
    label: type.name
  }))
];

const ratioToPair = (ratio: number) => {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return { adults: 1, students: 1 };
  }
  if (ratio >= 1) {
    return { adults: Math.max(1, Math.round(ratio)), students: 1 };
  }
  return { adults: 1, students: Math.max(1, Math.round(1 / ratio)) };
};

export default function ScheduleMatrix({
  staff,
  employeeOptions,
  assignments,
  segmentBlocks,
  days,
  daySequence,
  dayDisplayNames,
  scheduleTypeOptions,
  fieldTripTypes,
  fieldTripEventsByDay,
  operatingHoursByDay,
  onEnrollmentChange,
  onScheduleTypeChange,
  onFieldTripSelection,
  onUpdateAssignmentTime,
  onDeleteAssignment,
  onCreateAssignment,
  onReassignUnlinkedStaff,
  focusedSegmentIds
}: ScheduleMatrixProps) {
  const focusedSet = useMemo(() => new Set(focusedSegmentIds ?? []), [focusedSegmentIds]);
  const primaryFocusedSegmentId = focusedSegmentIds?.[0] ?? null;
  const [editing, setEditing] = useState<{
    assignmentId?: string;
    employeeId: string;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    isNew: boolean;
  } | null>(null);
  const [reassignmentTargetBySource, setReassignmentTargetBySource] = useState<Record<string, string>>({});
  const openerWindowMinutes = 15;
  const closerWindowMinutes = 15;
  const dayMetadataByDay = Object.fromEntries(days.map((day) => [day.dayOfWeek, day]));
  const segmentById = Object.fromEntries(segmentBlocks.map((segment) => [segment.id, segment]));
  const isClosedDay = (day: DayOfWeek) => {
    const metadata = dayMetadataByDay[day];
    return metadata?.scheduleType === "closed" || metadata?.dayScheduleType === "closed";
  };

  const operatingWindowByDay = useMemo(() => {
    return daySequence.reduce<Record<DayOfWeek, { open: number; close: number } | null>>((map, day) => {
      const hours = operatingHoursByDay[day];
      if (!hours) {
        map[day] = null;
        return map;
      }
      map[day] = {
        open: parseTimeToMinutes(hours.open),
        close: parseTimeToMinutes(hours.close)
      };
      return map;
    }, {} as Record<DayOfWeek, { open: number; close: number } | null>);
  }, [daySequence, operatingHoursByDay]);

  const assignmentsByEmployeeDay = assignments.reduce<Record<string, Record<DayOfWeek, StaffAssignment[]>>>(
    (map, assignment) => {
      const segment = segmentById[assignment.segmentBlockId];
      if (!segment) {
        return map;
      }
      const day = segment.dayOfWeek;
      if (!map[assignment.employeeId]) {
        map[assignment.employeeId] = {} as Record<DayOfWeek, StaffAssignment[]>;
      }
      if (!map[assignment.employeeId][day]) {
        map[assignment.employeeId][day] = [];
      }
      map[assignment.employeeId][day].push(assignment);
      return map;
    },
    {}
  );

  const fieldTripOptions = FIELD_TRIP_OPTIONS(fieldTripTypes);
  const scheduleTypeOptionByValue = useMemo(
    () => new Map(scheduleTypeOptions.map((option) => [option.value, option])),
    [scheduleTypeOptions]
  );
  const fieldTripTypeById = useMemo(
    () => new Map(fieldTripTypes.map((type) => [type.id, type])),
    [fieldTripTypes]
  );
  const getOverlapMessage = (payload: {
    assignmentId?: string;
    employeeId: string;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
  }) => {
    if (!payload.startTime || !payload.endTime) {
      return null;
    }
    const start = parseTimeToMinutes(payload.startTime);
    const end = parseTimeToMinutes(payload.endTime);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return null;
    }
    const existingBlocks = (assignmentsByEmployeeDay[payload.employeeId]?.[payload.dayOfWeek] ?? []).filter(
      (block) => block.id !== payload.assignmentId
    );
    const hasOverlap = existingBlocks.some((block) => {
      const blockStart = parseTimeToMinutes(block.startTime);
      const blockEnd = parseTimeToMinutes(block.endTime);
      return start < blockEnd && end > blockStart;
    });
    return hasOverlap ? "Overlaps another block" : null;
  };

  const getHoursForDay = (employeeId: string, dayOfWeek: DayOfWeek) => {
    const dayAssignments = assignmentsByEmployeeDay[employeeId]?.[dayOfWeek] ?? [];
    return dayAssignments.reduce((sum, assignment) => sum + getDurationHours(assignment.startTime, assignment.endTime), 0);
  };

  const segmentBlocksByDay = daySequence.reduce<Record<DayOfWeek, SegmentBlock[]>>((map, day) => {
    map[day] = segmentBlocks.filter((block) => block.dayOfWeek === day);
    return map;
  }, {} as Record<DayOfWeek, SegmentBlock[]>);

  const isEmployeeRequestedOff = (employee: Employee, day: DayOfWeek) => {
    const dayDate = dayMetadataByDay[day]?.date;
    if (!dayDate) {
      return false;
    }
    const normalizedDayDate = normalizeDateOnly(dayDate);
    return (employee.requestedDaysOff ?? []).some((dayOff) => normalizeDateOnly(dayOff.date) === normalizedDayDate);
  };

  const getAvailabilityForDay = (employee: Employee, day: DayOfWeek) =>
    employee.availability?.find((entry) => entry.dayOfWeek === day);

  const getAvailabilityViolationMessage = (
    employee: Employee,
    day: DayOfWeek,
    startTime: string,
    endTime: string
  ) => {
    if (isEmployeeRequestedOff(employee, day)) {
      return "Employee requested this day off";
    }
    const availabilityDay = getAvailabilityForDay(employee, day);
    if (!availabilityDay) {
      return null;
    }
    const windows = availabilityDay.blocks ?? [];
    if (windows.length === 0) {
      return "Employee is unavailable this day";
    }
    const start = parseTimeToMinutes(startTime);
    const end = parseTimeToMinutes(endTime);
    const fitsWindow = windows.some((window) => {
      const windowStart = parseTimeToMinutes(window.startTime);
      const windowEnd = parseTimeToMinutes(window.endTime);
      return start >= windowStart && end <= windowEnd;
    });
    if (fitsWindow) {
      return null;
    }
    const labels = windows.map((window) => `${formatTime(window.startTime)}-${formatTime(window.endTime)}`);
    return `Outside availability (${labels.join(", ")})`;
  };

  useEffect(() => {
    if (!primaryFocusedSegmentId) return;
    const focusedSegment = segmentById[primaryFocusedSegmentId];
    const target =
      document.querySelector<HTMLElement>(
        `[data-segment-id="${primaryFocusedSegmentId}"]:not([data-segment-anchor="true"])`
      ) ??
      (focusedSegment
        ? document.querySelector<HTMLElement>(`[data-day-column-header="${focusedSegment.dayOfWeek}"]`)
        : null);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  }, [primaryFocusedSegmentId, segmentById]);

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "linear", layout: { type: "tween", duration: 0.2, ease: "linear" } }}
      style={{
        background: "#ffffff",
        borderRadius: 18,
        padding: "1rem",
        boxShadow: "0 20px 40px rgba(15, 23, 42, 0.08)",
        overflowX: "auto"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0 }}>Schedule grid</h3>
          <p style={{ margin: 0, color: "#6b7280" }}>
            Staff rows combine day metadata and clock-in/out blocks in one matrix.
          </p>
        </div>
      </div>

      <motion.table
        layout
        transition={{ layout: { type: "tween", duration: 0.2, ease: "linear" } }}
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: "1rem",
          minWidth: 960
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                padding: "0.75rem",
                border: "1px solid #e5e7eb",
                background: "#f8fafc",
                minWidth: 220
              }}
            >
              Employee
            </th>
            {daySequence.map((day) => {
              const dayMeta = dayMetadataByDay[day];
              const fieldTripEvent = fieldTripEventsByDay[day];
              const focusedDay = primaryFocusedSegmentId ? segmentById[primaryFocusedSegmentId]?.dayOfWeek : undefined;
              const isFocusedDay = focusedDay === day;
              const closedDay = isClosedDay(day);
              const scheduleTypeOption = dayMeta?.scheduleType
                ? scheduleTypeOptionByValue.get(dayMeta.scheduleType)
                : undefined;
              const fieldTripType = fieldTripEvent?.fieldTripTypeId
                ? fieldTripTypeById.get(fieldTripEvent.fieldTripTypeId)
                : undefined;
              const baseRatioLabel = scheduleTypeOption
                ? `${scheduleTypeOption.ratio.adults}:${scheduleTypeOption.ratio.students}`
                : "not set";
              const fieldTripAdultRatioLabel = fieldTripType
                ? `${ratioToPair(fieldTripType.minAdultStudentRatio).adults}:${ratioToPair(fieldTripType.minAdultStudentRatio).students}`
                : undefined;
              const fieldTripLeaderRatioLabel = fieldTripType && fieldTripType.minLeaderStudentRatio > 0
                ? `${ratioToPair(fieldTripType.minLeaderStudentRatio).adults}:${ratioToPair(fieldTripType.minLeaderStudentRatio).students}`
                : undefined;
              return (
                <th
                  key={`header-${day}`}
                  data-day-column-header={day}
                  style={{
                    padding: "0.5rem",
                    border: "1px solid #e5e7eb",
                    background: isFocusedDay ? "#e0ecff" : "#f8fafc",
                    minWidth: 200,
                    verticalAlign: "top",
                    boxShadow: isFocusedDay ? "inset 0 0 0 2px rgba(37, 99, 235, 0.45)" : "none"
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    <span style={{ fontWeight: 700 }}>{dayDisplayNames[day]}</span>
                    <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 600 }}>
                      {formatDateLabel(dayMeta?.date)}
                    </span>
                    <label style={{ fontSize: "0.7rem", color: "#475569" }}>Schedule type</label>
                    <select
                      value={dayMeta?.scheduleType ?? ""}
                      onChange={(event) => {
                        if (!dayMeta) return;
                        const nextValue = event.target.value as ScheduleType | "";
                        onScheduleTypeChange(dayMeta.id, nextValue === "" ? undefined : nextValue);
                      }}
                      style={{
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        padding: "0.3rem 0.5rem",
                        fontSize: "0.75rem"
                      }}
                    >
                      <option value="">Select type</option>
                      {scheduleTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    <label style={{ fontSize: "0.7rem", color: "#475569" }}>Field trip</label>
                    <select
                      value={
                        fieldTripEvent?.fieldTripTypeId
                          ? fieldTripEvent.fieldTripTypeId
                          : "no-field-trip"
                      }
                      onChange={(event) => {
                        if (!dayMeta) return;
                        if (closedDay) return;
                        const value = event.target.value;
                        if (value === "no-field-trip") {
                          onFieldTripSelection(dayMeta.id, { type: "none" });
                          return;
                        }
                        onFieldTripSelection(dayMeta.id, { type: "trip", fieldTripTypeId: value });
                      }}
                      style={{
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        padding: "0.3rem 0.5rem",
                        fontSize: "0.75rem",
                        opacity: closedDay ? 0.6 : 1,
                        cursor: closedDay ? "not-allowed" : "pointer"
                      }}
                      disabled={closedDay}
                    >
                      {fieldTripOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    <label style={{ fontSize: "0.7rem", color: "#475569" }}>Enrollment</label>
                  <input
                    type="number"
                    min={0}
                    value={dayMeta?.enrollmentCount ?? ""}
                    onChange={(event) => {
                      if (!dayMeta) return;
                      if (closedDay) return;
                      const raw = event.target.value;
                      if (raw === "") {
                        onEnrollmentChange(dayMeta.id, undefined);
                        return;
                      }
                      const parsed = Number(raw);
                      if (!Number.isNaN(parsed)) {
                        onEnrollmentChange(dayMeta.id, parsed);
                      }
                    }}
                    style={{
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      padding: "0.3rem 0.5rem",
                      fontSize: "0.75rem",
                      opacity: closedDay ? 0.6 : 1,
                      cursor: closedDay ? "not-allowed" : "text"
                    }}
                    disabled={closedDay}
                  />
                  {closedDay && (
                    <span style={{ fontSize: "0.7rem", color: "#b45309", fontWeight: 600 }}>Closed day</span>
                  )}
                  {operatingHoursByDay[day] ? (
                    <span style={{ fontSize: "0.7rem", color: "#475569" }}>
                      Hours: {formatTime(operatingHoursByDay[day]!.open)} – {formatTime(operatingHoursByDay[day]!.close)}
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>Hours: not set</span>
                  )}
                  <span style={{ fontSize: "0.7rem", color: "#475569" }}>
                    Required ratio: {fieldTripAdultRatioLabel ? `${fieldTripAdultRatioLabel} (Field trip)` : baseRatioLabel}
                  </span>
                  {fieldTripAdultRatioLabel && (
                    <span style={{ fontSize: "0.7rem", color: "#475569" }}>
                      Leader ratio: {fieldTripLeaderRatioLabel ?? "not required"}
                    </span>
                  )}
                </div>
              </th>
            );
          })}
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => {
            const employeeAssignments = assignmentsByEmployeeDay[member.id] ?? ({} as Record<DayOfWeek, StaffAssignment[]>);
            const isUnlinkedStaff = member.jobTitle === "Unknown";
            const reassignmentTarget = reassignmentTargetBySource[member.id] ?? "";
            const totalHours = Object.values(employeeAssignments)
              .flat()
              .reduce((sum, assignment) => sum + getDurationHours(assignment.startTime, assignment.endTime), 0);
            const overscheduled = totalHours > member.maxHoursPerWeek;
            const badges: string[] = [];
            if (member.leaderQualified) badges.push("Leader");
            if (member.cprCurrent) badges.push("CPR");
            if (member.medicallyDelegated) badges.push("Med Del");

            return (
              <motion.tr
                key={member.id}
                layout
                transition={{ layout: { type: "tween", duration: 0.2, ease: "linear" } }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  background: overscheduled ? "#fff1f2" : undefined
                }}
              >
                <td
                  style={{
                    border: "1px solid #e5e7eb",
                    padding: "0.75rem",
                    verticalAlign: "top",
                    background: overscheduled ? "#fff1f2" : "#fff",
                    position: "relative"
                  }}
                >
                  {overscheduled && (
                    <span
                      title={`${member.name} is over weekly max hours (${totalHours.toFixed(1)} > ${member.maxHoursPerWeek}).`}
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        border: "1px solid #dc2626",
                        background: "#fee2e2",
                        color: "#b91c1c",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "help"
                      }}
                    >
                      ?
                    </span>
                  )}
                  <div style={{ fontWeight: 600 }}>{member.name}</div>
                  <div style={{ color: "#6b7280", fontSize: "0.8rem" }}>{member.jobTitle}</div>
                  {isUnlinkedStaff && (
                    <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.35rem", alignItems: "center" }}>
                      <select
                        value={reassignmentTarget}
                        onChange={(event) =>
                          setReassignmentTargetBySource((prev) => ({
                            ...prev,
                            [member.id]: event.target.value
                          }))
                        }
                        style={{
                          borderRadius: 8,
                          border: "1px solid #d1d5db",
                          padding: "0.25rem 0.45rem",
                          fontSize: "0.75rem",
                          minWidth: 150
                        }}
                      >
                        <option value="">Assign to employee</option>
                        {employeeOptions.map((employee) => (
                          <option key={`reassign-${member.id}-${employee.id}`} value={employee.id}>
                            {employee.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!reassignmentTarget}
                        onClick={() => {
                          if (!reassignmentTarget) return;
                          onReassignUnlinkedStaff(member.id, reassignmentTarget);
                          setReassignmentTargetBySource((prev) => {
                            const next = { ...prev };
                            delete next[member.id];
                            return next;
                          });
                        }}
                        style={{
                          borderRadius: 999,
                          border: "1px solid #bfdbfe",
                          background: reassignmentTarget ? "#eff6ff" : "#f1f5f9",
                          color: reassignmentTarget ? "#1d4ed8" : "#94a3b8",
                          padding: "0.25rem 0.65rem",
                          fontSize: "0.75rem"
                        }}
                      >
                        Assign
                      </button>
                    </div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.4rem" }}>
                    {badges.map((badge) => (
                      <span
                        key={`${member.id}-${badge}`}
                        style={{
                          fontSize: "0.7rem",
                          padding: "0.1rem 0.45rem",
                          borderRadius: 999,
                          border: "1px solid #e5e7eb",
                          background: "#f8fafc"
                        }}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: "0.45rem", fontSize: "0.78rem", color: overscheduled ? "#b91c1c" : "#475569", fontWeight: 600 }}>
                    Total hours: {totalHours.toFixed(1)}
                  </div>
                </td>
                {daySequence.map((day) => {
                  const blocks = (employeeAssignments[day] ?? [])
                    .slice()
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .slice(0, 2);
                  const operatingWindow = operatingWindowByDay[day];
                  const dayHours = getHoursForDay(member.id, day);
                  const closedDay = isClosedDay(day);
                  const hasRequestedDayOff = isEmployeeRequestedOff(member, day);
                  const availabilityForDay = getAvailabilityForDay(member, day);
                  const hasAvailabilityEntry = Boolean(availabilityForDay);
                  const isAvailableDay = !hasAvailabilityEntry || (availabilityForDay?.blocks?.length ?? 0) > 0;
                  const canCreateAssignment = !closedDay && !hasRequestedDayOff && isAvailableDay;
                  const isOverDaily = dayHours > member.maxHoursPerDay;
                  const cellBorder = isOverDaily ? "2px solid #dc2626" : "1px solid #e5e7eb";
                  const focusedDay = primaryFocusedSegmentId ? segmentById[primaryFocusedSegmentId]?.dayOfWeek : undefined;
                  const isFocusedDay = focusedDay === day;

                  return (
                    <td
                      key={`${member.id}-${day}`}
                      style={{
                        border: cellBorder,
                        padding: "0.5rem",
                        verticalAlign: "top",
                        background: closedDay ? "#f8fafc" : isFocusedDay ? "#f6faff" : overscheduled ? "#fff7f8" : "#fff",
                        position: "relative"
                      }}
                    >
                      {segmentBlocksByDay[day]?.map((block) => (
                        <span
                          key={`anchor-${member.id}-${block.id}`}
                          data-segment-anchor-id={block.id}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: 1,
                            height: 1,
                            overflow: "hidden"
                          }}
                        />
                      ))}
                      {isOverDaily && (
                        <span
                          title="Over max hours"
                          style={{
                            position: "absolute",
                            top: 6,
                            right: 6,
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            border: "1px solid #dc2626",
                            background: "#fee2e2",
                            color: "#b91c1c",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "default"
                          }}
                        >
                          ?
                        </span>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                        {blocks.map((block) => {
                          const overlapMessage =
                            editing && editing.assignmentId === block.id ? getOverlapMessage(editing) : null;
                          const availabilityMessage = getAvailabilityViolationMessage(
                            member,
                            day,
                            block.startTime,
                            block.endTime
                          );
                          const isOpener = operatingWindow
                            ? Math.abs(parseTimeToMinutes(block.startTime) - operatingWindow.open) <=
                              openerWindowMinutes
                            : false;
                          const isCloser = operatingWindow
                            ? Math.abs(parseTimeToMinutes(block.endTime) - operatingWindow.close) <=
                              closerWindowMinutes
                            : false;
                          const blockBackground = isOpener && isCloser
                            ? "linear-gradient(135deg, rgba(59,130,246,0.22), rgba(147,51,234,0.22))"
                            : isOpener
                              ? "rgba(0, 96, 250, 0.25)"
                              : isCloser
                                ? "rgba(132, 0, 255, 0.25)"
                                : "#ecfeff";
                          const blockBorder = isOpener || isCloser ? "1px solid rgba(79,70,229,0.5)" : "1px solid #bae6fd";
                          const isFocused = focusedSet.has(block.segmentBlockId);
                          const hasAvailabilityViolation = Boolean(availabilityMessage);

                          return (
                            <motion.div
                              layout
                              transition={{ layout: { type: "tween", duration: 0.2, ease: "linear" } }}
                              key={`${member.id}-${day}-${block.id}`}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.25rem",
                                padding: "0.25rem 0.4rem",
                                borderRadius: 8,
                                background: hasAvailabilityViolation
                                  ? "#fee2e2"
                                  : isFocused
                                    ? "#fef3c7"
                                    : blockBackground,
                                border: hasAvailabilityViolation
                                  ? "2px solid #dc2626"
                                  : isFocused
                                    ? "2px solid #f59e0b"
                                    : blockBorder,
                                position: "relative",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                boxShadow: isFocused
                                  ? "0 0 0 4px rgba(245, 158, 11, 0.35), 0 6px 20px rgba(245, 158, 11, 0.2)"
                                  : "none",
                                transition: "box-shadow 180ms linear, background-color 180ms linear, border-color 180ms linear"
                              }}
                              data-segment-id={block.segmentBlockId}
                              onClick={() => {
                                if (closedDay) {
                                  return;
                                }
                                setEditing({
                                  assignmentId: block.id,
                                  employeeId: member.id,
                                  dayOfWeek: day,
                                  startTime: block.startTime,
                                  endTime: block.endTime,
                                  isNew: false
                                });
                              }}
                              title={availabilityMessage ?? undefined}
                            >
                              {hasAvailabilityViolation && (
                                <span
                                  style={{
                                    position: "absolute",
                                    top: 4,
                                    right: 4,
                                    width: 16,
                                    height: 16,
                                    borderRadius: "50%",
                                    border: "1px solid #dc2626",
                                    background: "#fff",
                                    color: "#b91c1c",
                                    fontSize: "0.65rem",
                                    fontWeight: 700,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                  }}
                                >
                                  ?
                                </span>
                              )}
                              {editing?.assignmentId === block.id ? (
                                <>
                                  <input
                                    type="time"
                                    value={editing.startTime}
                                    onChange={(event) =>
                                      setEditing((prev) =>
                                        prev ? { ...prev, startTime: event.target.value } : prev
                                      )
                                    }
                                    style={{
                                      borderRadius: 6,
                                      border: "1px solid #cbd5f5",
                                      padding: "0.2rem 0.3rem",
                                      fontSize: "0.7rem"
                                    }}
                                  />
                                  <input
                                    type="time"
                                    value={editing.endTime}
                                    onChange={(event) =>
                                      setEditing((prev) =>
                                        prev ? { ...prev, endTime: event.target.value } : prev
                                      )
                                    }
                                    style={{
                                      borderRadius: 6,
                                      border: "1px solid #cbd5f5",
                                      padding: "0.2rem 0.3rem",
                                      fontSize: "0.7rem"
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (!editing?.startTime || !editing?.endTime) {
                                        return;
                                      }
                                      if (overlapMessage) {
                                        return;
                                      }
                                      onUpdateAssignmentTime(block.id, editing.startTime, editing.endTime);
                                      setEditing(null);
                                    }}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    style={{
                                      borderRadius: 999,
                                      border: "none",
                                      background: overlapMessage ? "#94a3b8" : "#2563eb",
                                      color: "#fff",
                                      padding: "0.15rem 0.6rem",
                                      fontSize: "0.7rem",
                                      alignSelf: "flex-start",
                                      cursor: overlapMessage ? "not-allowed" : "pointer"
                                    }}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onDeleteAssignment(block.id);
                                      setEditing(null);
                                    }}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    style={{
                                      borderRadius: 999,
                                      border: "1px solid #fecaca",
                                      background: "#fee2e2",
                                      color: "#b91c1c",
                                      padding: "0.15rem 0.6rem",
                                      fontSize: "0.7rem",
                                      alignSelf: "flex-start",
                                      cursor: "pointer"
                                    }}
                                  >
                                    Delete
                                  </button>
                                  {overlapMessage && (
                                    <span style={{ fontSize: "0.7rem", color: "#b91c1c" }}>{overlapMessage}</span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span>{formatTime(block.startTime)}</span>
                                  <span>{formatTime(block.endTime)}</span>
                                </>
                              )}
                            </motion.div>
                          );
                        })}
                        {canCreateAssignment && dayHours < member.maxHoursPerDay && (
                          <motion.button
                            layout
                            transition={{ layout: { type: "tween", duration: 0.2, ease: "linear" } }}
                            type="button"
                            onClick={() => {
                              const defaultStart = operatingWindow
                                ? `${Math.floor(operatingWindow.open / 60)
                                    .toString()
                                    .padStart(2, "0")}:${(operatingWindow.open % 60)
                                    .toString()
                                    .padStart(2, "0")}`
                                : "08:00";
                              const defaultEnd = operatingWindow
                                ? `${Math.floor((operatingWindow.open + 120) / 60)
                                    .toString()
                                    .padStart(2, "0")}:${((operatingWindow.open + 120) % 60)
                                    .toString()
                                    .padStart(2, "0")}`
                                : "10:00";
                              setEditing({
                                employeeId: member.id,
                                dayOfWeek: day,
                                startTime: defaultStart,
                                endTime: defaultEnd,
                                isNew: true
                              });
                            }}
                            style={{
                              height: 30,
                              borderRadius: 8,
                              border: "1px dashed #cbd5f5",
                              background: "#f8fafc",
                              fontSize: "0.7rem",
                              color: "#64748b",
                              textAlign: "left",
                              paddingLeft: "0.5rem",
                              cursor: "pointer"
                            }}
                          >
                            Add block
                          </motion.button>
                        )}
                        {!closedDay && !canCreateAssignment && (
                          <span style={{ fontSize: "0.7rem", color: "#b91c1c", fontWeight: 600 }}>
                            {hasRequestedDayOff
                              ? "Requested day off"
                              : hasAvailabilityEntry
                                ? "Unavailable this day"
                                : "Unavailable"}
                          </span>
                        )}
                        {!closedDay &&
                          editing?.isNew &&
                          editing.employeeId === member.id &&
                          editing.dayOfWeek === day && (
                          <motion.div
                            layout
                            transition={{ layout: { type: "tween", duration: 0.2, ease: "linear" } }}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.25rem",
                              padding: "0.25rem 0.4rem",
                              borderRadius: 8,
                              background: "#fff7ed",
                              border: "1px solid #fed7aa"
                            }}
                          >
                            {(() => {
                              if (!editing) {
                                return null;
                              }
                              const overlapMessage = getOverlapMessage(editing);
                              return (
                                <>
                            <input
                              type="time"
                              value={editing.startTime}
                              onChange={(event) =>
                                setEditing((prev) =>
                                  prev ? { ...prev, startTime: event.target.value } : prev
                                )
                              }
                              style={{
                                borderRadius: 6,
                                border: "1px solid #cbd5f5",
                                padding: "0.2rem 0.3rem",
                                fontSize: "0.7rem"
                              }}
                            />
                            <input
                              type="time"
                              value={editing.endTime}
                              onChange={(event) =>
                                setEditing((prev) =>
                                  prev ? { ...prev, endTime: event.target.value } : prev
                                )
                              }
                              style={{
                                borderRadius: 6,
                                border: "1px solid #cbd5f5",
                                padding: "0.2rem 0.3rem",
                                fontSize: "0.7rem"
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!editing.startTime || !editing.endTime) {
                                  return;
                                }
                                if (overlapMessage) {
                                  return;
                                }
                                onCreateAssignment({
                                  employeeId: editing.employeeId,
                                  dayOfWeek: editing.dayOfWeek,
                                  startTime: editing.startTime,
                                  endTime: editing.endTime
                                });
                                setEditing(null);
                              }}
                              style={{
                                borderRadius: 999,
                                border: "none",
                                background: overlapMessage ? "#94a3b8" : "#2563eb",
                                color: "#fff",
                                padding: "0.15rem 0.6rem",
                                fontSize: "0.7rem",
                                alignSelf: "flex-start",
                                cursor: overlapMessage ? "not-allowed" : "pointer"
                              }}
                            >
                              Save
                            </button>
                            {overlapMessage && (
                              <span style={{ fontSize: "0.7rem", color: "#b91c1c" }}>{overlapMessage}</span>
                            )}
                            </>
                              );
                            })()}
                          </motion.div>
                          )}
                      </div>
                    </td>
                  );
                })}
              </motion.tr>
            );
          })}
        </tbody>
      </motion.table>
    </motion.section>
  );
}
