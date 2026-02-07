import { RuleDefinition } from "./types";
import {
  calculateDurationHours,
  getAssignmentsForBlock,
  getCitationId,
  getDayOfWeekForAssignment,
  getEmployeeById,
  getFieldTripEventById,
  getFieldTripEventForBlock,
  getFieldTripTypeById,
  parseTimeToMinutes,
  getOperatingHoursForDay,
  getScheduleDayById
} from "./utils";
import type { RulesContext, RuleViolation } from "./types";
import type { SegmentBlock, StaffAssignment } from "../domain/types";

const DEFAULT_POLICY_CITATIONS: Record<string, string> = {
  "ratio-segment": "policy-ratio",
  "certification-per-segment": "policy-certification",
  "shift-break-limits": "policy-shift-limits",
  "segment-coverage": "policy-coverage",
  "field-trip-ratios": "policy-field-trip",
  "schedule-day-metadata": "policy-schedule-day",
  "field-trip-event": "policy-field-trip-event",
  "segment-block-timeline": "policy-coverage",
  "open-close-coverage": "policy-open-close",
  "medical-delegated-coverage": "policy-med-delegated",
  "cpr-current-required": "policy-cpr-current"
};

const assignedEmployeesForBlock = (context: RulesContext, blockId: string) => {
  const assignments = getAssignmentsForBlock(context, blockId);
  const unique: Record<string, boolean> = {};
  const employees = assignments
    .map((assignment) => getEmployeeById(context, assignment.employeeId))
    .filter((employee): employee is NonNullable<typeof employee> => Boolean(employee));
  return employees.filter((employee) => {
    if (unique[employee.id]) {
      return false;
    }
    unique[employee.id] = true;
    return true;
  });
};

const buildViolation = (
  ruleId: string,
  message: string,
  targetEntity: string,
  targetId: string,
  citationId?: string,
  severity: "error" | "warning" = "error",
  metadata?: Record<string, unknown>
) => ({
  id: `${ruleId}:${targetEntity}:${targetId}`,
  ruleId,
  message,
  severity,
  target: {
    entity: targetEntity,
    id: targetId,
    metadata
  },
  citationId
});

const getSchoolRules = (context: RulesContext) => {
  return {
    openerCount: context.schoolRules?.openerCount ?? 0,
    closerCount: context.schoolRules?.closerCount ?? 0,
    minimumMedicalDelegated: context.schoolRules?.minimumMedicalDelegated ?? 0,
    requireCurrentCpr: context.schoolRules?.requireCurrentCpr ?? false,
    openerWindowMinutes: context.schoolRules?.openerWindowMinutes ?? 15,
    closerWindowMinutes: context.schoolRules?.closerWindowMinutes ?? 15
  };
};

const isClosedScheduleDay = (context: RulesContext, block: SegmentBlock) => {
  const scheduleDay =
    getScheduleDayById(context, block.scheduleDayId) ??
    context.scheduleDays.find((day) => day.dayOfWeek === block.dayOfWeek);
  if (!scheduleDay) {
    return false;
  }
  return scheduleDay.scheduleType === "closed" || scheduleDay.dayScheduleType === "closed";
};

export const ratioSegmentRule: RuleDefinition = {
  id: "ratio-segment",
  description:
    "Ensures each segment block has enough staff to meet the higher of the ratio-derived minimum or the configured minimum staff",
  evaluate: (context: RulesContext) => {
    const violations: RuleViolation[] = [];
    context.segmentBlocks.forEach((block) => {
      if (isClosedScheduleDay(context, block)) {
        return;
      }
      const fieldTripEvent = getFieldTripEventForBlock(context, block);
      if (fieldTripEvent && !fieldTripEvent.isNoFieldTrip) {
        return;
      }
      const scheduleDay =
        getScheduleDayById(context, block.scheduleDayId) ??
        context.scheduleDays.find((day) => day.dayOfWeek === block.dayOfWeek);
      const scheduleType = scheduleDay?.scheduleType;
      const childrenPerStaff =
        (scheduleType ? context.scheduleTypeRatios?.[scheduleType] : undefined) ?? 1;
      const requiredFromRatio = Math.ceil(block.childCount / childrenPerStaff);
      const schoolRules = getSchoolRules(context);
      let minStaff = 0;
      if (block.segment === "open" && schoolRules.openerCount > 0) {
        minStaff = schoolRules.openerCount;
      } else if (block.segment === "close" && schoolRules.closerCount > 0) {
        minStaff = schoolRules.closerCount;
      }
      const requiredStaff = Math.max(minStaff, requiredFromRatio);
      // Only count real scheduled staff (ignore orphan/completed assignments).
      const assigned = getAssignmentsForBlock(context, block.id).filter((assignment) => {
        const employee = getEmployeeById(context, assignment.employeeId);
        return Boolean(employee) && assignment.status !== "completed";
      }).length;
      if (assigned < requiredStaff) {
        const citationId = getCitationId(
          context,
          "ratio-segment",
          DEFAULT_POLICY_CITATIONS["ratio-segment"]
        );
        const message = `Segment ${block.dayOfWeek}/${block.segment} requires ${requiredStaff} staff (min ${minStaff}, ratio ${childrenPerStaff}) but only ${assigned} assigned`;
        violations.push(
          buildViolation("ratio-segment", message, "SegmentBlock", block.id, citationId)
        );
      }
    });
    return violations;
  }
};

export const scheduleDayMetadataRule: RuleDefinition = {
  id: "schedule-day-metadata",
  description:
    "Each schedule day must capture a schedule type, enrollment headcount, and an explicit field trip decision before the week can advance",
  evaluate: (context: RulesContext) => {
    const violations: RuleViolation[] = [];
    const citationId = getCitationId(
      context,
      "schedule-day-metadata",
      DEFAULT_POLICY_CITATIONS["schedule-day-metadata"]
    );
    (context.scheduleDays ?? []).forEach((day) => {
      if (day.scheduleType === "closed" || day.dayScheduleType === "closed") {
        return;
      }
      if (!day.scheduleType) {
        violations.push(
          buildViolation(
            "schedule-day-metadata",
            `Schedule day ${day.date} lacks a selected schedule type`,
            "ScheduleDay",
            day.id,
            citationId,
            "error",
            { missing: ["scheduleType"] }
          )
        );
      }
      if (day.enrollmentCount === undefined || day.enrollmentCount === null) {
        violations.push(
          buildViolation(
            "schedule-day-metadata",
            `Schedule day ${day.date} needs an enrollment headcount`,
            "ScheduleDay",
            day.id,
            citationId,
            "error",
            { missing: ["enrollmentCount"] }
          )
        );
      }
      if (!day.fieldTripEventId) {
        violations.push(
          buildViolation(
            "schedule-day-metadata",
            `Schedule day ${day.date} must link to a field trip decision (or mark "No Field Trip")`,
            "ScheduleDay",
            day.id,
            citationId,
            "error",
            { missing: ["fieldTripEventId"] }
          )
        );
        return;
      }
      const hasEvent = context.fieldTripEvents.some((event) => event.id === day.fieldTripEventId);
      if (!hasEvent) {
        violations.push(
          buildViolation(
            "schedule-day-metadata",
            `Schedule day ${day.date} references a missing field trip decision (${day.fieldTripEventId})`,
            "ScheduleDay",
            day.id,
            citationId,
            "error",
            { fieldTripEventId: day.fieldTripEventId }
          )
        );
      }
    });
    return violations;
  }
};

export const certificationPerSegmentRule: RuleDefinition = {
  id: "certification-per-segment",
  description:
    "Validates that each segment includes employees with current CPR, medical delegation, and leader qualifications when required",
  evaluate: (context: RulesContext) => {
    const violations: RuleViolation[] = [];
    const schoolRules = getSchoolRules(context);
    context.segmentBlocks.forEach((block) => {
      if (isClosedScheduleDay(context, block)) {
        return;
      }
      const employees = assignedEmployeesForBlock(context, block.id);
      const citationId = getCitationId(
        context,
        "certification-per-segment",
        DEFAULT_POLICY_CITATIONS["certification-per-segment"]
      );
      const requiresLeader =
        (block.segment === "open" || block.segment === "close") &&
        employees.some((employee) => {
          return context.jobTitleRules?.[employee.jobTitle]?.requiresLeaderForOpenClose ?? false;
        });

      if (schoolRules.requireCurrentCpr && !employees.some((employee) => employee.cprCurrent)) {
        violations.push(
          buildViolation(
            "certification-per-segment",
            `Segment ${block.dayOfWeek}/${block.segment} lacks an employee with current CPR certification`,
            "SegmentBlock",
            block.id,
            citationId
          )
        );
      }

      if (
        schoolRules.minimumMedicalDelegated > 0 &&
        !employees.some((employee) => employee.medicallyDelegated)
      ) {
        violations.push(
          buildViolation(
            "certification-per-segment",
            `Segment ${block.dayOfWeek}/${block.segment} lacks medically delegated staff`,
            "SegmentBlock",
            block.id,
            citationId
          )
        );
      }

      if (requiresLeader && !employees.some((employee) => employee.leaderQualified)) {
        violations.push(
          buildViolation(
            "certification-per-segment",
            `Segment ${block.dayOfWeek}/${block.segment} lacks a leader-qualified employee`,
            "SegmentBlock",
            block.id,
            citationId
          )
        );
      }
    });
    return violations;
  }
};

export const segmentCoverageRule: RuleDefinition = {
  id: "segment-coverage",
  description: "Enforces leader and medical coverage guardrails per segment",
  evaluate: (context: RulesContext) => {
    const violations: RuleViolation[] = [];
    const schoolRules = getSchoolRules(context);
    context.segmentBlocks.forEach((block) => {
      if (isClosedScheduleDay(context, block)) {
        return;
      }
      const employees = assignedEmployeesForBlock(context, block.id);
      const citationId = getCitationId(
        context,
        "segment-coverage",
        DEFAULT_POLICY_CITATIONS["segment-coverage"]
      );
      const requiresLeader =
        (block.segment === "open" || block.segment === "close") &&
        employees.some((employee) => {
          return context.jobTitleRules?.[employee.jobTitle]?.requiresLeaderForOpenClose ?? false;
        });

      if (requiresLeader && !employees.some((employee) => employee.leaderQualified)) {
        violations.push(
          buildViolation(
            "segment-coverage",
            `Segment ${block.dayOfWeek}/${block.segment} needs at least one leader-qualified employee`,
            "SegmentBlock",
            block.id,
            citationId
          )
        );
      }

      if (
        schoolRules.minimumMedicalDelegated > 0 &&
        !employees.some((employee) => employee.medicallyDelegated)
      ) {
        violations.push(
          buildViolation(
            "segment-coverage",
            `Segment ${block.dayOfWeek}/${block.segment} needs medically delegated coverage`,
            "SegmentBlock",
            block.id,
            citationId
          )
        );
      }
    });
    return violations;
  }
};

export const segmentBlockTimelineRule: RuleDefinition = {
  id: "segment-block-timeline",
  description: "Detects invalid clock windows and overlapping shifts for the same employee",
  evaluate: (context: RulesContext) => {
    const violations: RuleViolation[] = [];
    const citationId = getCitationId(
      context,
      "segment-block-timeline",
      DEFAULT_POLICY_CITATIONS["segment-block-timeline"]
    );
    context.segmentBlocks.forEach((block) => {
      if (isClosedScheduleDay(context, block)) {
        return;
      }
      const start = parseTimeToMinutes(block.startTime);
      const end = parseTimeToMinutes(block.endTime);

      if (start >= end) {
        violations.push(
          buildViolation(
            "segment-block-timeline",
            `Clock block ${block.dayOfWeek.toUpperCase()} ${block.startTime}-${block.endTime} has an invalid window`,
            "SegmentBlock",
            block.id,
            citationId,
            "error",
            { startTime: block.startTime, endTime: block.endTime, dayOfWeek: block.dayOfWeek }
          )
        );
        return;
      }

      const scheduleDay = getScheduleDayById(context, block.scheduleDayId);
      const operatingHours = getOperatingHoursForDay(
        context,
        block.dayOfWeek,
        scheduleDay?.dayScheduleType
      );

      if (operatingHours) {
        const openMinutes = parseTimeToMinutes(operatingHours.open);
        const closeMinutes = parseTimeToMinutes(operatingHours.close);
        if (start < openMinutes) {
          violations.push(
            buildViolation(
              "segment-block-timeline",
              `Clock block on ${block.dayOfWeek.toUpperCase()} starts before operating hours (${operatingHours.open})`,
              "SegmentBlock",
              block.id,
              citationId,
              "error",
              {
                operatingHoursId: operatingHours.id,
                startTime: block.startTime,
                boundary: operatingHours.open,
                dayOfWeek: block.dayOfWeek
              }
            )
          );
        }
        if (end > closeMinutes) {
          violations.push(
            buildViolation(
              "segment-block-timeline",
              `Clock block on ${block.dayOfWeek.toUpperCase()} ends after operating hours (${operatingHours.close})`,
              "SegmentBlock",
              block.id,
              citationId,
              "error",
              {
                operatingHoursId: operatingHours.id,
                endTime: block.endTime,
                boundary: operatingHours.close,
                dayOfWeek: block.dayOfWeek
              }
            )
          );
        }
      }
    });

    const assignmentsByEmployeeDay: Record<string, StaffAssignment[]> = {};
    context.staffAssignments.forEach((assignment) => {
      const dayOfWeek = getDayOfWeekForAssignment(context, assignment);
      if (!dayOfWeek) {
        return;
      }
      const dayMeta = context.scheduleDays.find((day) => day.dayOfWeek === dayOfWeek);
      if (dayMeta?.scheduleType === "closed" || dayMeta?.dayScheduleType === "closed") {
        return;
      }
      const key = `${assignment.employeeId}:${dayOfWeek}`;
      if (!assignmentsByEmployeeDay[key]) {
        assignmentsByEmployeeDay[key] = [];
      }
      assignmentsByEmployeeDay[key].push(assignment);
    });

    Object.entries(assignmentsByEmployeeDay).forEach(([key, assignments]) => {
      const [employeeId, dayOfWeek] = key.split(":");
      const sorted = [...assignments].sort(
        (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
      );
      let activeAssignment: StaffAssignment | null = null;
      let activeEnd = 0;

      sorted.forEach((assignment) => {
        const start = parseTimeToMinutes(assignment.startTime);
        const end = parseTimeToMinutes(assignment.endTime);
        if (activeAssignment && start < activeEnd) {
          const employee = getEmployeeById(context, employeeId);
          const primarySegmentId = assignment.segmentBlockId;
          const secondarySegmentId = activeAssignment.segmentBlockId;
          violations.push(
            buildViolation(
              "segment-block-timeline",
              `${employee?.name ?? "Employee"} has overlapping clock blocks on ${dayOfWeek.toUpperCase()} (${activeAssignment.startTime}-${activeAssignment.endTime} and ${assignment.startTime}-${assignment.endTime})`,
              "StaffAssignment",
              assignment.id,
              citationId,
              "error",
              {
                overlapsWithAssignmentId: activeAssignment.id,
                relatedSegmentBlockIds: [primarySegmentId, secondarySegmentId],
                dayOfWeek
              }
            )
          );
        }

        if (!activeAssignment || end >= activeEnd) {
          activeAssignment = assignment;
          activeEnd = end;
        }
      });
    });

    return violations;
  }
};

export const shiftBreakLimitsRule: RuleDefinition = {
  id: "shift-break-limits",
  description: "Prevents exceeding max shift lengths or weekly hour caps",
  evaluate: (context: RulesContext) => {
    const violations: RuleViolation[] = [];
    const dailyViolations = new Set<string>();
    const weeklyViolations = new Set<string>();
    const dailyTotals: Record<string, Record<string, number>> = {};
    const weeklyTotals: Record<string, number> = {};

    context.staffAssignments.forEach((assignment) => {
      const employee = getEmployeeById(context, assignment.employeeId);
      if (!employee) {
        return;
      }
      const day = getDayOfWeekForAssignment(context, assignment);
      if (!day) {
        return;
      }
      const duration = calculateDurationHours(assignment.startTime, assignment.endTime);
      if (duration <= 0) {
        return;
      }
      dailyTotals[employee.id] = dailyTotals[employee.id] || {};
      dailyTotals[employee.id][day] = (dailyTotals[employee.id][day] ?? 0) + duration;
      weeklyTotals[employee.id] = (weeklyTotals[employee.id] ?? 0) + duration;

      const cumulativeDay = dailyTotals[employee.id][day];
      if (
        employee.maxHoursPerDay > 0 &&
        cumulativeDay > employee.maxHoursPerDay &&
        !dailyViolations.has(`${employee.id}:${day}`)
      ) {
        dailyViolations.add(`${employee.id}:${day}`);
        const citationId = getCitationId(context, "shift-break-limits", employee.id);
        violations.push(
          buildViolation(
            "shift-break-limits",
            `${employee.name} exceeds daily limit (${cumulativeDay.toFixed(2)}h > ${employee.maxHoursPerDay}h)`,
            "StaffAssignment",
            assignment.id,
            citationId,
            "error",
            { employeeId: employee.id, day }
          )
        );
      }

      const cumulativeWeek = weeklyTotals[employee.id];
      if (
        employee.maxHoursPerWeek > 0 &&
        cumulativeWeek > employee.maxHoursPerWeek &&
        !weeklyViolations.has(employee.id)
      ) {
        weeklyViolations.add(employee.id);
        const citationId = getCitationId(context, "shift-break-limits", employee.id);
        violations.push(
          buildViolation(
            "shift-break-limits",
            `${employee.name} exceeds weekly limit (${cumulativeWeek.toFixed(2)}h > ${employee.maxHoursPerWeek}h)`,
            "StaffAssignment",
            assignment.id,
            citationId,
            "error",
            { employeeId: employee.id }
          )
        );
      }
    });
    return violations;
  }
};

export const openCloseCoverageRule: RuleDefinition = {
  id: "open-close-coverage",
  description: "Ensures required opener/closer staffing and leader-qualified coverage for open/close windows",
  evaluate: (context: RulesContext) => {
    const violations: RuleViolation[] = [];
    const rules = getSchoolRules(context);
    if (rules.openerCount <= 0 && rules.closerCount <= 0) {
      return violations;
    }
    const citationId = getCitationId(context, "open-close-coverage", DEFAULT_POLICY_CITATIONS["open-close-coverage"]);

    (context.scheduleDays ?? []).forEach((day) => {
      const hours = getOperatingHoursForDay(context, day.dayOfWeek, day.dayScheduleType);
      if (!hours) {
        return;
      }
      const openMinutes = parseTimeToMinutes(hours.open);
      const closeMinutes = parseTimeToMinutes(hours.close);
      const openerWindowEnd = openMinutes + rules.openerWindowMinutes;
      const closerWindowStart = closeMinutes - rules.closerWindowMinutes;

      const assignments = context.staffAssignments.filter((assignment) =>
        getDayOfWeekForAssignment(context, assignment) === day.dayOfWeek
      );

      const openerAssignments = assignments.filter((assignment) => {
        const start = parseTimeToMinutes(assignment.startTime);
        const end = parseTimeToMinutes(assignment.endTime);
        return start <= openerWindowEnd && end > openMinutes;
      });
      const closerAssignments = assignments.filter((assignment) => {
        const start = parseTimeToMinutes(assignment.startTime);
        const end = parseTimeToMinutes(assignment.endTime);
        return end >= closerWindowStart && start < closeMinutes;
      });

      const uniqueOpeners = new Set(openerAssignments.map((assignment) => assignment.employeeId));
      const uniqueClosers = new Set(closerAssignments.map((assignment) => assignment.employeeId));

      if (rules.openerCount > 0 && uniqueOpeners.size < rules.openerCount) {
        violations.push(
          buildViolation(
            "open-close-coverage",
            `${day.dayOfWeek.toUpperCase()} requires ${rules.openerCount} opener(s) within ${rules.openerWindowMinutes} minutes of open`,
            "ScheduleDay",
            day.id,
            citationId,
            "error",
            { type: "opener", required: rules.openerCount, actual: uniqueOpeners.size }
          )
        );
      }

      if (rules.closerCount > 0 && uniqueClosers.size < rules.closerCount) {
        violations.push(
          buildViolation(
            "open-close-coverage",
            `${day.dayOfWeek.toUpperCase()} requires ${rules.closerCount} closer(s) within ${rules.closerWindowMinutes} minutes of close`,
            "ScheduleDay",
            day.id,
            citationId,
            "error",
            { type: "closer", required: rules.closerCount, actual: uniqueClosers.size }
          )
        );
      }

      const requiresLeader = (assignmentList: StaffAssignment[]) =>
        assignmentList.some((assignment) => {
          const employee = getEmployeeById(context, assignment.employeeId);
          if (!employee) return false;
          return context.jobTitleRules?.[employee.jobTitle]?.requiresLeaderForOpenClose ?? false;
        });

      const hasLeader = (assignmentList: StaffAssignment[]) =>
        assignmentList.some((assignment) => {
          const employee = getEmployeeById(context, assignment.employeeId);
          return Boolean(employee?.leaderQualified);
        });

      if (openerAssignments.length > 0 && requiresLeader(openerAssignments) && !hasLeader(openerAssignments)) {
        violations.push(
          buildViolation(
            "open-close-coverage",
            `${day.dayOfWeek.toUpperCase()} opener coverage requires a leader-qualified staff member`,
            "ScheduleDay",
            day.id,
            citationId,
            "error",
            { type: "opener", requiresLeader: true }
          )
        );
      }

      if (closerAssignments.length > 0 && requiresLeader(closerAssignments) && !hasLeader(closerAssignments)) {
        violations.push(
          buildViolation(
            "open-close-coverage",
            `${day.dayOfWeek.toUpperCase()} closer coverage requires a leader-qualified staff member`,
            "ScheduleDay",
            day.id,
            citationId,
            "error",
            { type: "closer", requiresLeader: true }
          )
        );
      }
    });

    return violations;
  }
};

export const medicalDelegatedCoverageRule: RuleDefinition = {
  id: "medical-delegated-coverage",
  description: "Requires minimum medically delegated staff per segment block",
  evaluate: (context: RulesContext) => {
    const violations: RuleViolation[] = [];
    const rules = getSchoolRules(context);
    if (rules.minimumMedicalDelegated <= 0) {
      return violations;
    }
    const grouped = new Map<string, SegmentBlock[]>();
    context.segmentBlocks.forEach((block) => {
      if (isClosedScheduleDay(context, block)) {
        return;
      }
      const key = `${block.dayOfWeek}:${block.segment}`;
      const current = grouped.get(key) ?? [];
      current.push(block);
      grouped.set(key, current);
    });

    grouped.forEach((blocks, key) => {
      const [dayOfWeek, segment] = key.split(":");
      const uniqueMedDelegated = new Set<string>();
      blocks.forEach((block) => {
        const assignments = getAssignmentsForBlock(context, block.id).filter(
          (assignment) => assignment.status !== "completed"
        );
        assignments.forEach((assignment) => {
          const employee = getEmployeeById(context, assignment.employeeId);
          if (employee?.medicallyDelegated) {
            uniqueMedDelegated.add(employee.id);
          }
        });
      });
      const medicallyDelegatedCount = uniqueMedDelegated.size;
      if (medicallyDelegatedCount < rules.minimumMedicalDelegated) {
        const citationId = getCitationId(
          context,
          "medical-delegated-coverage",
          DEFAULT_POLICY_CITATIONS["medical-delegated-coverage"]
        );
        const primaryBlockId = blocks[0]?.id;
        if (!primaryBlockId) {
          return;
        }
        violations.push(
          buildViolation(
            "medical-delegated-coverage",
            `${dayOfWeek.toUpperCase()} ${segment} requires ${rules.minimumMedicalDelegated} medically delegated staff`,
            "SegmentBlock",
            primaryBlockId,
            citationId,
            "error",
            {
              required: rules.minimumMedicalDelegated,
              actual: medicallyDelegatedCount,
              dayOfWeek,
              relatedSegmentBlockIds: blocks.map((block) => block.id)
            }
          )
        );
      }
    });
    return violations;
  }
};

export const cprCurrentRequiredRule: RuleDefinition = {
  id: "cpr-current-required",
  description: "Prevents scheduling staff with lapsed CPR when current CPR is required",
  evaluate: (context: RulesContext) => {
    const violations: RuleViolation[] = [];
    const rules = getSchoolRules(context);
    if (!rules.requireCurrentCpr) {
      return violations;
    }
    context.staffAssignments.forEach((assignment) => {
      const employee = getEmployeeById(context, assignment.employeeId);
      if (!employee) {
        return;
      }
      if (!employee.cprCurrent) {
        const citationId = getCitationId(
          context,
          "cpr-current-required",
          DEFAULT_POLICY_CITATIONS["cpr-current-required"]
        );
        violations.push(
          buildViolation(
            "cpr-current-required",
            `${employee.name} cannot be scheduled without current CPR certification`,
            "StaffAssignment",
            assignment.id,
            citationId,
            "error",
            { employeeId: employee.id }
          )
        );
      }
    });
    return violations;
  }
};

export const fieldTripEventIntegrityRule: RuleDefinition = {
  id: "field-trip-event",
  description:
    "Field trip events must either declare “No Field Trip” or point to an existing FieldTripType before they can be applied",
  evaluate: (context: RulesContext) => {
    const violations: RuleViolation[] = [];
    const citationId = getCitationId(
      context,
      "field-trip-event",
      DEFAULT_POLICY_CITATIONS["field-trip-event"]
    );
    context.fieldTripEvents.forEach((event) => {
      const scheduleDay =
        getScheduleDayById(context, event.scheduleDayId) ??
        context.scheduleDays.find((day) => day.dayOfWeek === event.dayOfWeek);
      if (scheduleDay && (scheduleDay.scheduleType === "closed" || scheduleDay.dayScheduleType === "closed")) {
        return;
      }

      const noFieldTripSelected =
        event.isNoFieldTrip === true || (!event.fieldTripTypeId && event.isNoFieldTrip !== false);
      if (noFieldTripSelected) {
        return;
      }
      if (!event.fieldTripTypeId) {
        violations.push(
          buildViolation(
            "field-trip-event",
            `Field trip for ${event.dayOfWeek.toUpperCase()} must reference a field trip type or declare "No Field Trip"`,
            "FieldTripEvent",
            event.id,
            citationId,
            "error",
            { missing: ["fieldTripTypeId", "isNoFieldTrip"], dayOfWeek: event.dayOfWeek }
          )
        );
        return;
      }
      const typeExists = context.fieldTripTypes.some((type) => type.id === event.fieldTripTypeId);
      if (!typeExists) {
        violations.push(
          buildViolation(
            "field-trip-event",
            `Field trip for ${event.dayOfWeek.toUpperCase()} points to an unknown field trip type`,
            "FieldTripEvent",
            event.id,
            citationId,
            "error",
            { fieldTripTypeId: event.fieldTripTypeId, dayOfWeek: event.dayOfWeek }
          )
        );
      }
    });
    return violations;
  }
};

export const fieldTripRatiosRule: RuleDefinition = {
  id: "field-trip-ratios",
  description: "Applies field trip ratios for adults and leaders in overridden segments",
  evaluate: (context: RulesContext) => {
    const violations: RuleViolation[] = [];
    context.segmentBlocks.forEach((block) => {
      if (isClosedScheduleDay(context, block)) {
        return;
      }
      if (!block.fieldTripEventId) {
        return;
      }
      const event = getFieldTripEventById(context, block.fieldTripEventId);
      const type = event && getFieldTripTypeById(context, event.fieldTripTypeId);
      if (!event || !type) {
        return;
      }
      const assignments = getAssignmentsForBlock(context, block.id);
      const uniqueEmployeeIds = new Set(assignments.map((assignment) => assignment.employeeId));
      const leaderCount = assignments
        .map((assignment) => getEmployeeById(context, assignment.employeeId))
        .filter((employee): employee is NonNullable<typeof employee> => Boolean(employee))
        .filter((employee) => employee.leaderQualified);
      const requiredAdults = Math.max(1, Math.ceil(block.childCount * type.minAdultStudentRatio));
      const requiredLeaders =
        type.minLeaderStudentRatio > 0
          ? Math.max(1, Math.ceil(block.childCount * type.minLeaderStudentRatio))
          : 0;
      if (uniqueEmployeeIds.size < requiredAdults) {
        const citationId = getCitationId(context, "field-trip-ratios", type.policyCitationId);
        violations.push(
          buildViolation(
            "field-trip-ratios",
            `Field trip block ${block.id} needs ${requiredAdults} adults but only ${uniqueEmployeeIds.size} assigned`,
            "SegmentBlock",
            block.id,
            citationId,
            "error",
            { assignedAdults: uniqueEmployeeIds.size, requiredAdults }
          )
        );
      }
      if (requiredLeaders > 0 && leaderCount.length < requiredLeaders) {
        const citationId = getCitationId(context, "field-trip-ratios", type.policyCitationId);
        violations.push(
          buildViolation(
            "field-trip-ratios",
            `Field trip block ${block.id} needs ${requiredLeaders} leaders but only ${leaderCount.length} assigned`,
            "SegmentBlock",
            block.id,
            citationId,
            "error",
            { assignedLeaders: leaderCount.length, requiredLeaders }
          )
        );
      }
    });
    return violations;
  }
};

export const DEFAULT_RULE_DEFINITIONS: RuleDefinition[] = [
  scheduleDayMetadataRule,
  ratioSegmentRule,
  segmentBlockTimelineRule,
  shiftBreakLimitsRule,
  openCloseCoverageRule,
  medicalDelegatedCoverageRule,
  cprCurrentRequiredRule,
  fieldTripEventIntegrityRule,
  fieldTripRatiosRule
];
