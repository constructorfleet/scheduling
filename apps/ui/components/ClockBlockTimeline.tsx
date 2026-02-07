import { useEffect, useState } from "react";
import { DayOfWeek, DaySegment, Employee, OperatingHours, SegmentBlock, StaffAssignment } from "@core/domain/types";
import { RuleViolation } from "../types";
import type { SchoolRules } from "./SettingsPanel";

export interface AddClockBlockRequest {
  dayOfWeek: DayOfWeek;
  segment: DaySegment;
  startTime: string;
  endTime: string;
  childCount: number;
  employeeId?: string;
}

interface ClockBlockTimelineProps {
  segments: SegmentBlock[];
  assignments: StaffAssignment[];
  employees: Employee[];
  violations: RuleViolation[];
  focusedSegmentId?: string;
  schoolRules?: Pick<SchoolRules, "openerCount" | "closerCount">;
  scheduleDays: Array<{ id: string; dayOfWeek: DayOfWeek; scheduleType?: string }>;
  scheduleTypeRatios: Record<string, number>;
  onFocusSegment: (segmentId: string) => void;
  daySequence: DayOfWeek[];
  dayDisplayNames: Record<DayOfWeek, string>;
  onAutoBalance?: () => void;
  operatingHoursByDay: Record<DayOfWeek, OperatingHours | undefined>;
  segmentSlotDefinitions: Record<DaySegment, { label: string; start: string; end: string; baseChildCount: number }>;
  onAddClockBlock: (payload: AddClockBlockRequest) => void;
}

const parseTimeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const formatExactTime = (value: string) => {
  const minutes = parseTimeToMinutes(value);
  const hour = Math.floor(minutes / 60);
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour >= 12 ? "p" : "a";
  const minuteLabel = (minutes % 60).toString().padStart(2, "0");
  return `${displayHour}:${minuteLabel}${suffix}`;
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
  schoolRules,
  scheduleDays,
  scheduleTypeRatios,
  onFocusSegment,
  daySequence,
  dayDisplayNames,
  onAutoBalance,
  operatingHoursByDay,
  segmentSlotDefinitions,
  onAddClockBlock
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

  const availableSegments = Object.keys(segmentSlotDefinitions) as DaySegment[];
  const defaultSegment = availableSegments[0] ?? "open";
  const [isAddFormOpen, setIsAddFormOpen] = useState(true);
  const [draftBlock, setDraftBlock] = useState({
    day: daySequence[0],
    segment: defaultSegment,
    startTime: "",
    endTime: "",
    childCount: segmentSlotDefinitions[defaultSegment]?.baseChildCount ?? 0,
    employeeId: employees[0]?.id ?? ""
  });
  const [formError, setFormError] = useState<string | null>(null);

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
  const axisMarkers: number[] = [];
  for (let marker = startMinute; marker <= endMinute; marker += 60) {
    axisMarkers.push(marker);
  }
  const timelineHeight = 360;

  useEffect(() => {
    if (!focusedSegmentId) return;
    const target = document.querySelector<HTMLElement>(`[data-timeline-segment-id="${focusedSegmentId}"]`);
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  }, [focusedSegmentId]);

  const segmentsByDay = daySequence.reduce<Record<DayOfWeek, SegmentBlock[]>>((map, day) => {
    map[day] = segments
      .filter((segment) => segment.dayOfWeek === day)
      .sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
    return map;
  }, {} as Record<DayOfWeek, SegmentBlock[]>);
  const scheduleDaysById = Object.fromEntries(scheduleDays.map((day) => [day.id, day]));
  const scheduleDaysByDow = Object.fromEntries(scheduleDays.map((day) => [day.dayOfWeek, day]));

  const guardrailForDraftDay = operatingHoursByDay[draftBlock.day];
  const handleChildCountChange = (value: string) => {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      setDraftBlock((prev) => ({ ...prev, childCount: parsed }));
    }
  };
  const handleAddBlock = () => {
    setFormError(null);
    if (!draftBlock.startTime || !draftBlock.endTime) {
      setFormError("Clock-in and clock-out times are required.");
      return;
    }
    const startMinutes = parseTimeToMinutes(draftBlock.startTime);
    const endMinutes = parseTimeToMinutes(draftBlock.endTime);
    if (startMinutes >= endMinutes) {
      setFormError("Clock-out must be after clock-in.");
      return;
    }
    if (guardrailForDraftDay) {
      const guardrailStart = parseTimeToMinutes(guardrailForDraftDay.open);
      const guardrailEnd = parseTimeToMinutes(guardrailForDraftDay.close);
      if (startMinutes < guardrailStart || endMinutes > guardrailEnd) {
        setFormError(
          `Clock block must stay within operating hours (${formatExactTime(
            guardrailForDraftDay.open
          )}–${formatExactTime(guardrailForDraftDay.close)}).`
        );
        return;
      }
    }
    onAddClockBlock({
      dayOfWeek: draftBlock.day,
      segment: draftBlock.segment,
      startTime: draftBlock.startTime,
      endTime: draftBlock.endTime,
      childCount: Math.max(1, draftBlock.childCount),
      employeeId: draftBlock.employeeId || undefined
    });
    setDraftBlock((prev) => ({
      ...prev,
      startTime: "",
      endTime: "",
      childCount: segmentSlotDefinitions[prev.segment]?.baseChildCount ?? prev.childCount
    }));
  };

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
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => setIsAddFormOpen((value) => !value)}
            style={{
              borderRadius: 999,
              border: "1px solid #2563eb",
              background: "#eff6ff",
              color: "#1d4ed8",
              padding: "0.45rem 1rem"
            }}
          >
            {isAddFormOpen ? "Hide add block form" : "Add clock block"}
          </button>
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
      </div>

      {isAddFormOpen && (
        <div
          style={{
            marginTop: "1rem",
            borderRadius: 16,
            border: "1px dashed #cbd5f5",
            background: "#f8fafc",
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Add clock block</p>
            <span style={{ fontSize: "0.8rem", color: "#475569" }}>
              {guardrailForDraftDay
                ? `${formatExactTime(guardrailForDraftDay.open)} – ${formatExactTime(guardrailForDraftDay.close)} operating window`
                : "Operating hours not configured"}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "0.75rem"
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.8rem" }}>
              Day
              <select
                value={draftBlock.day}
                onChange={(event) => setDraftBlock((prev) => ({ ...prev, day: event.target.value as DayOfWeek }))}
                style={{ borderRadius: 10, border: "1px solid #d1d5db", padding: "0.4rem 0.6rem" }}
              >
                {daySequence.map((day) => (
                  <option key={day} value={day}>
                    {dayDisplayNames[day]}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.8rem" }}>
              Segment
              <select
                value={draftBlock.segment}
                onChange={(event) => {
                  const nextSegment = event.target.value as DaySegment;
                  setDraftBlock((prev) => ({
                    ...prev,
                    segment: nextSegment,
                    childCount: segmentSlotDefinitions[nextSegment]?.baseChildCount ?? prev.childCount
                  }));
                }}
                style={{ borderRadius: 10, border: "1px solid #d1d5db", padding: "0.4rem 0.6rem" }}
              >
                {availableSegments.map((segment) => (
                  <option key={segment} value={segment}>
                    {segmentSlotDefinitions[segment]?.label ?? segment}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.8rem" }}>
              Start time (HH:MM)
              <input
                type="time"
                value={draftBlock.startTime}
                onChange={(event) => setDraftBlock((prev) => ({ ...prev, startTime: event.target.value }))}
                style={{ borderRadius: 10, border: "1px solid #d1d5db", padding: "0.4rem 0.6rem" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.8rem" }}>
              End time (HH:MM)
              <input
                type="time"
                value={draftBlock.endTime}
                onChange={(event) => setDraftBlock((prev) => ({ ...prev, endTime: event.target.value }))}
                style={{ borderRadius: 10, border: "1px solid #d1d5db", padding: "0.4rem 0.6rem" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.8rem" }}>
              Child count
              <input
                type="number"
                min={1}
                value={draftBlock.childCount}
                onChange={(event) => handleChildCountChange(event.target.value)}
                style={{ borderRadius: 10, border: "1px solid #d1d5db", padding: "0.4rem 0.6rem" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.8rem" }}>
              Staff member (optional)
              <select
                value={draftBlock.employeeId ?? ""}
                onChange={(event) => setDraftBlock((prev) => ({ ...prev, employeeId: event.target.value }))}
                style={{ borderRadius: 10, border: "1px solid #d1d5db", padding: "0.4rem 0.6rem" }}
              >
                <option value="">Assign later</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {formError && (
            <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.8rem" }}>{formError}</p>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#475569" }}>
              Times must land within the operating window shown on each column.
            </p>
            <button
              type="button"
              onClick={handleAddBlock}
              disabled={!draftBlock.startTime || !draftBlock.endTime}
              style={{
                borderRadius: 999,
                border: "none",
                padding: "0.4rem 0.9rem",
                background: "#0ea5e9",
                color: "#fff",
                cursor: !draftBlock.startTime || !draftBlock.endTime ? "not-allowed" : "pointer",
                opacity: !draftBlock.startTime || !draftBlock.endTime ? 0.6 : 1
              }}
            >
              Save clock block
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: `60px repeat(${daySequence.length}, minmax(0, 1fr))`, gap: "0.5rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.75rem", fontWeight: 600 }}>
          {axisMarkers.map((marker) => (
            <span key={`axis-${marker}`} style={{ height: `${timelineHeight / axisMarkers.length}px`, display: "flex", alignItems: "center" }}>
              {formatTimeLabel(marker)}
            </span>
          ))}
        </div>

        {daySequence.map((day) => {
          const guardrail = operatingHoursByDay[day];
          const guardrailStart = guardrail ? parseTimeToMinutes(guardrail.open) : startMinute;
          const guardrailEnd = guardrail ? parseTimeToMinutes(guardrail.close) : endMinute;
          const overlayTop = guardrail
            ? (Math.max(guardrailStart - startMinute, 0) / totalSpan) * timelineHeight
            : 0;
          const overlayHeight = guardrail
            ? (Math.max(Math.min(guardrailEnd, endMinute) - Math.max(guardrailStart, startMinute), 0) / totalSpan) *
              timelineHeight
            : 0;
          const showGuardrailOverlay = Boolean(guardrail && overlayHeight > 0);
          return (
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
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.75rem",
                  color: "#475569",
                  marginBottom: "0.25rem"
                }}
              >
                <span>Operating hours</span>
                <span>
                  {guardrail
                    ? `${formatExactTime(guardrail.open)} – ${formatExactTime(guardrail.close)}`
                    : "Not configured"}
                </span>
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
                {showGuardrailOverlay && (
                  <div
                    style={{
                      position: "absolute",
                      top: overlayTop,
                      height: overlayHeight,
                      left: 0,
                      right: 0,
                      borderRadius: 16,
                      background: "#dcfce7",
                      opacity: 0.45,
                      pointerEvents: "none",
                      zIndex: 1
                    }}
                  />
                )}
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
                    const scheduleDay =
                      (segment.scheduleDayId ? scheduleDaysById[segment.scheduleDayId] : undefined) ??
                      scheduleDaysByDow[segment.dayOfWeek];
                    const ratioChildren =
                      (scheduleDay?.scheduleType ? scheduleTypeRatios[scheduleDay.scheduleType] : undefined) ?? 0;
                    let minStaff = segment.requirementTemplate.minStaff ?? 0;
                    if (segment.segment === "open" && (schoolRules?.openerCount ?? 0) > 0) {
                      minStaff = schoolRules?.openerCount ?? minStaff;
                    } else if (segment.segment === "close" && (schoolRules?.closerCount ?? 0) > 0) {
                      minStaff = schoolRules?.closerCount ?? minStaff;
                    }
                    const requiredStaff = Math.max(
                      minStaff,
                      Math.ceil(segment.childCount / Math.max(ratioChildren, 1))
                    );
                    const hasLeader = assignedStaff.some((employee) => employee.leaderQualified);
                    const violationsForBlock = violationsByBlock[segment.id] ?? [];
                    const blockFocused = focusedSegmentId === segment.id;
                    const hasGuardrailViolation = violationsForBlock.some(
                      (violation) => Boolean(violation.metadata?.operatingHoursId)
                    );

                    return (
                      <button
                        key={segment.id}
                        type="button"
                        aria-pressed={blockFocused}
                        aria-label={`${dayDisplayNames[day]} ${segment.startTime} – ${segment.endTime} ${segment.segment}`}
                        onClick={() => onFocusSegment(segment.id)}
                        data-timeline-segment-id={segment.id}
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
                          textAlign: "left",
                          zIndex: 2
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
                        {hasGuardrailViolation && (
                          <span
                            style={{
                              alignSelf: "flex-start",
                              fontSize: "0.65rem",
                              padding: "0.2rem 0.6rem",
                              borderRadius: 999,
                              background: "#d1fae5",
                              color: "#047857"
                            }}
                          >
                            Operating hours guardrail
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
          );
        })}
      </div>
    </section>
  );
}
