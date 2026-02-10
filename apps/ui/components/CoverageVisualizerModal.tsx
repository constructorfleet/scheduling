import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  DayOfWeek,
  FieldTripEvent,
  FieldTripType,
  OperatingHours,
  ScheduleDay,
  StaffAssignment,
  Employee
} from "@core/domain/types";
import type { ScheduleTypeTimeWindow } from "@core/rules/types";
import type { SchoolRules } from "./SettingsPanel";
import { colors, shadows } from "../theme";
import { count1on1StudentsInInterval } from "@core/domain/constants";

interface CoverageVisualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayOfWeek: DayOfWeek;
  day: ScheduleDay;
  operatingHours: OperatingHours;
  assignments: StaffAssignment[];
  employees: Employee[];
  scheduleTypeRatios: Record<string, number>;
  scheduleTypeTimeWindows?: ScheduleTypeTimeWindow[];
  schoolRules: SchoolRules;
  fieldTripEvent?: FieldTripEvent;
  fieldTripType?: FieldTripType;
}

interface CoverageInterval {
  start: number;
  end: number;
  required: number;
  actual: number;
  ratio: {
    required: string;
    actual: string;
  };
  status: "complete" | "partial" | "critical";
  source: "default" | "time-window" | "field-trip";
}

const parseTimeToMinutes = (time: string): number => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const formatMinutesAsTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${mins.toString().padStart(2, "0")} ${ampm}`;
};

const determineRatio = (
  start: number,
  end: number,
  day: ScheduleDay,
  fieldTripType: FieldTripType | undefined,
  scheduleTypeTimeWindows: ScheduleTypeTimeWindow[] | undefined,
  scheduleTypeRatios: Record<string, number>,
  schoolRules: SchoolRules
): { ratio: number; source: CoverageInterval["source"] } => {
  const ftStart = parseTimeToMinutes(schoolRules.fieldTripStartTime || "09:00");
  const ftEnd = parseTimeToMinutes(schoolRules.fieldTripEndTime || "15:00");

  if (fieldTripType && start >= ftStart && end <= ftEnd) {
    return {
      ratio: fieldTripType.adultRatioStudents / fieldTripType.adultRatioAdults,
      source: "field-trip"
    };
  }

  const relevantWindows = scheduleTypeTimeWindows?.filter(
    w => w.scheduleTypeValue === day.scheduleType
  ) || [];

  for (const window of relevantWindows) {
    const wStart = parseTimeToMinutes(window.startTime);
    const wEnd = parseTimeToMinutes(window.endTime);

    if (start >= wStart && end <= wEnd) {
      return {
        ratio: window.ratioStudents / window.ratioAdults,
        source: "time-window"
      };
    }
  }

  return {
    ratio: (day.scheduleType ? scheduleTypeRatios[day.scheduleType] : undefined) || 8,
    source: "default"
  };
};

const MetricCard: React.FC<{ label: string; value: string; color?: string; badge?: string }> = ({
  label,
  value,
  color,
  badge
}) => (
  <div
    style={{
      padding: "0.75rem",
      background: "white",
      borderRadius: 8,
      border: `1px solid ${colors.borderSubtle}`
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
      <span style={{ fontSize: "0.75rem", color: colors.textMuted }}>{label}</span>
      {badge && (
        <span
          style={{
            padding: "0.125rem 0.375rem",
            borderRadius: 999,
            fontSize: "0.625rem",
            background: colors.infoSurface,
            color: "#1e40af"
          }}
        >
          {badge === "field-trip" ? "Field Trip" : badge === "time-window" ? "Time Window" : "Default"}
        </span>
      )}
    </div>
    <span
      style={{
        fontSize: "1.25rem",
        fontWeight: 600,
        color: color || colors.textPrimary
      }}
    >
      {value}
    </span>
  </div>
);

const MetricsDisplay: React.FC<{ interval: CoverageInterval; enrollment: number }> = ({
  interval,
  enrollment
}) => {
  const statusColors = {
    complete: "#16a34a",
    partial: "#f97316",
    critical: "#dc2626"
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: colors.textPrimary }}>
          {formatMinutesAsTime(interval.start)} - {formatMinutesAsTime(interval.end)}
        </h4>
        <span
          style={{
            padding: "0.25rem 0.625rem",
            borderRadius: 999,
            fontSize: "0.75rem",
            fontWeight: 500,
            background: `${statusColors[interval.status]}1a`,
            color: statusColors[interval.status],
            display: "inline-flex",
            alignItems: "center",
            lineHeight: 1
          }}
        >
          {interval.status === "complete" ? "Adequate" : interval.status === "partial" ? "Partial" : "Critical"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
        <MetricCard label="Enrollment" value={enrollment.toString()} />
        <MetricCard
          label="Staff Assigned"
          value={interval.actual.toString()}
          color={interval.actual >= interval.required ? "#16a34a" : "#dc2626"}
        />
        <MetricCard label="Required Ratio" value={interval.ratio.required} badge={interval.source} />
        <MetricCard label="Actual Ratio" value={interval.ratio.actual} />
      </div>
    </div>
  );
};

const Timeline: React.FC<{
  intervals: CoverageInterval[];
  openMinutes: number;
  closeMinutes: number;
  enrollment: number;
}> = ({ intervals, openMinutes, closeMinutes, enrollment }) => {
  const totalMinutes = closeMinutes - openMinutes;
  const [hoveredInterval, setHoveredInterval] = useState<number | null>(null);

  const statusColors = {
    complete: "#16a34a",
    partial: "#f97316",
    critical: "#dc2626"
  };

  return (
    <div style={{ padding: "1rem 0" }}>
      {/* Time axis labels */}
      <div
        style={{
          position: "relative",
          height: "20px",
          marginBottom: "0.5rem"
        }}
      >
        {/* Opening time */}
        <span
          style={{
            position: "absolute",
            left: 0,
            fontSize: "0.75rem",
            color: colors.textMuted,
            fontWeight: 600
          }}
        >
          {formatMinutesAsTime(openMinutes)}
        </span>

        {/* Time window boundary labels */}
        {intervals.slice(0, -1).map((interval, idx) => {
          const position = ((interval.end - openMinutes) / totalMinutes) * 100;
          return (
            <span
              key={`time-label-${idx}`}
              style={{
                position: "absolute",
                left: `${position}%`,
                transform: "translateX(-50%)",
                fontSize: "0.75rem",
                color: colors.textMuted,
                fontWeight: 500
              }}
            >
              {formatMinutesAsTime(interval.end)}
            </span>
          );
        })}

        {/* Closing time */}
        <span
          style={{
            position: "absolute",
            right: 0,
            fontSize: "0.75rem",
            color: colors.textMuted,
            fontWeight: 600
          }}
        >
          {formatMinutesAsTime(closeMinutes)}
        </span>
      </div>

      {/* Timeline bar */}
      <div
        style={{
          position: "relative",
          height: "60px",
          background: colors.surface,
          borderRadius: 8,
          overflow: "visible"
        }}
      >
        {intervals.map((interval, idx) => {
          const left = ((interval.start - openMinutes) / totalMinutes) * 100;
          const width = ((interval.end - interval.start) / totalMinutes) * 100;

          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredInterval(idx)}
              onMouseLeave={() => setHoveredInterval(null)}
              style={{
                position: "absolute",
                left: `${left}%`,
                width: `${width}%`,
                height: "100%",
                background: `${statusColors[interval.status]}${hoveredInterval === idx ? "" : "cc"}`,
                cursor: "pointer",
                transition: "background 0.15s ease",
                overflow: "hidden",
                borderTopLeftRadius: idx === 0 ? 8 : 0,
                borderBottomLeftRadius: idx === 0 ? 8 : 0,
                borderTopRightRadius: idx === intervals.length - 1 ? 8 : 0,
                borderBottomRightRadius: idx === intervals.length - 1 ? 8 : 0
              }}
            />
          );
        })}

        {/* Segment boundaries */}
        {intervals.slice(0, -1).map((interval, idx) => {
          const position = ((interval.end - openMinutes) / totalMinutes) * 100;
          return (
            <div
              key={`boundary-${idx}`}
              style={{
                position: "absolute",
                left: `${position}%`,
                top: 0,
                bottom: 0,
                width: "2px",
                background: "rgba(255, 255, 255, 0.5)",
                pointerEvents: "none"
              }}
            />
          );
        })}

        {/* Popover metrics */}
        <AnimatePresence mode="wait">
          {hoveredInterval !== null && (() => {
            const interval = intervals[hoveredInterval];
            const left = ((interval.start - openMinutes) / totalMinutes) * 100;
            const width = ((interval.end - interval.start) / totalMinutes) * 100;
            const centerPos = left + width / 2;

            return (
              <motion.div
                key={`popover-${hoveredInterval}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
                onMouseEnter={() => setHoveredInterval(hoveredInterval)}
                onMouseLeave={() => setHoveredInterval(null)}
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 12px)",
                  left: centerPos < 50 ? `${left}%` : "auto",
                  right: centerPos >= 50 ? `${100 - (left + width)}%` : "auto",
                  minWidth: "320px",
                  maxWidth: "400px",
                  padding: "1rem",
                  background: "white",
                  borderRadius: 8,
                  border: `1px solid ${colors.borderSubtle}`,
                  boxShadow: shadows.modal,
                  zIndex: 100,
                  pointerEvents: "auto"
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    bottom: "-6px",
                    left: centerPos < 50 ? "20px" : "auto",
                    right: centerPos >= 50 ? "20px" : "auto",
                    width: 0,
                    height: 0,
                    borderLeft: "6px solid transparent",
                    borderRight: "6px solid transparent",
                    borderTop: `6px solid white`
                  }}
                />
                <MetricsDisplay interval={interval} enrollment={enrollment} />
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", fontSize: "0.75rem", color: colors.textSecondary }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <div style={{ width: 12, height: 12, background: "#16a34a", borderRadius: 3 }} />
          <span>Adequate (100%+)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <div style={{ width: 12, height: 12, background: "#f97316", borderRadius: 3 }} />
          <span>Partial (50-99%)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <div style={{ width: 12, height: 12, background: "#dc2626", borderRadius: 3 }} />
          <span>Critical (&lt;50%)</span>
        </div>
      </div>
    </div>
  );
};

export default function CoverageVisualizerModal({
  isOpen,
  onClose,
  dayOfWeek,
  day,
  operatingHours,
  assignments,
  employees,
  scheduleTypeRatios,
  scheduleTypeTimeWindows,
  schoolRules,
  fieldTripType
}: CoverageVisualizerModalProps) {
  const intervals = useMemo(() => {
    const openMinutes = parseTimeToMinutes(operatingHours.open);
    const closeMinutes = parseTimeToMinutes(operatingHours.close);

    const boundaries = new Set<number>([openMinutes, closeMinutes]);

    // Add assignment boundaries
    assignments.forEach(a => {
      boundaries.add(Math.max(openMinutes, parseTimeToMinutes(a.startTime)));
      boundaries.add(Math.min(closeMinutes, parseTimeToMinutes(a.endTime)));
    });

    // Add time window boundaries
    scheduleTypeTimeWindows?.forEach(window => {
      if (window.scheduleTypeValue === day.scheduleType) {
        const wStart = parseTimeToMinutes(window.startTime);
        const wEnd = parseTimeToMinutes(window.endTime);
        if (wStart >= openMinutes && wStart <= closeMinutes) boundaries.add(wStart);
        if (wEnd >= openMinutes && wEnd <= closeMinutes) boundaries.add(wEnd);
      }
    });

    // Add field trip boundaries
    if (fieldTripType) {
      const ftStart = parseTimeToMinutes(schoolRules.fieldTripStartTime || "09:00");
      const ftEnd = parseTimeToMinutes(schoolRules.fieldTripEndTime || "15:00");
      if (ftStart >= openMinutes && ftStart <= closeMinutes) boundaries.add(ftStart);
      if (ftEnd >= openMinutes && ftEnd <= closeMinutes) boundaries.add(ftEnd);
    }

    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
    const result: CoverageInterval[] = [];

    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
      const start = sortedBoundaries[i];
      const end = sortedBoundaries[i + 1];

      const { ratio, source } = determineRatio(
        start,
        end,
        day,
        fieldTripType,
        scheduleTypeTimeWindows,
        scheduleTypeRatios,
        schoolRules
      );

      const baseEnrollment = day.enrollmentCount ?? 0;

      // Subtract students in 1:1 assignments during this interval
      const studentsIn1on1 = count1on1StudentsInInterval(
        assignments,
        day.dayOfWeek,
        start,
        end,
        () => day.dayOfWeek,
        parseTimeToMinutes
      );

      const enrollmentCount = Math.max(0, baseEnrollment - studentsIn1on1);
      const required = Math.ceil(enrollmentCount / ratio);

      const actual = assignments.filter(a => {
        const aStart = parseTimeToMinutes(a.startTime);
        const aEnd = parseTimeToMinutes(a.endTime);
        return aStart < end &&
               aEnd > start &&
               !a.is1on1 &&
               !a.isOnCall &&
               employees.some(e => e.id === a.employeeId);
      }).length;

      let status: CoverageInterval["status"];
      if (actual >= required) status = "complete";
      else if (actual >= required * 0.5) status = "partial";
      else status = "critical";

      result.push({
        start,
        end,
        required,
        actual,
        ratio: {
          required: `1:${Math.round(ratio)}`,
          actual: actual > 0 ? `1:${Math.round(enrollmentCount / actual)}` : "0:0"
        },
        status,
        source
      });
    }

    return result;
  }, [
    operatingHours,
    assignments,
    employees,
    day,
    scheduleTypeTimeWindows,
    scheduleTypeRatios,
    schoolRules,
    fieldTripType
  ]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
    return undefined;
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const dayLabels: Record<DayOfWeek, string> = {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday"
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "linear" }}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        zIndex: 70
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: "linear" }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(820px, calc(100vw - 2rem))",
          maxHeight: "calc(100vh - 2rem)",
          background: colors.surface,
          borderRadius: 14,
          border: `1px solid ${colors.borderSubtle}`,
          boxShadow: shadows.modal,
          overflow: "visible",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.5rem",
            borderBottom: `1px solid ${colors.borderSubtle}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: colors.textPrimary, marginBottom: "0.25rem" }}>
              Coverage Report - {dayLabels[dayOfWeek]}
            </h2>
            <p style={{ fontSize: "0.875rem", color: colors.textSecondary }}>
              {day.enrollmentCount} {day.enrollmentCount === 1 ? "child" : "children"} enrolled · {operatingHours.open} - {operatingHours.close}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: "none",
              background: colors.surfaceAlt,
              color: colors.textSecondary,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.25rem"
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: "1.5rem",
            flex: 1,
            overflow: "visible"
          }}
        >
          <Timeline
            intervals={intervals}
            openMinutes={parseTimeToMinutes(operatingHours.open)}
            closeMinutes={parseTimeToMinutes(operatingHours.close)}
            enrollment={day.enrollmentCount ?? 0}
          />
        </div>
      </motion.div>
    </motion.section>
  );
}
