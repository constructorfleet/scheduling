import { RuleDefinition } from "./types";
import {
  calculateDurationHours,
  getAssignmentsForBlock,
  getCitationId,
  getDayOfWeekForAssignment,
  getEmployeeById,
  getFieldTripEventById,
  getFieldTripTypeById
} from "./utils";
import type { RulesContext, RuleViolation } from "./types";

const DEFAULT_POLICY_CITATIONS: Record<string, string> = {
  "ratio-segment": "policy-ratio",
  "certification-per-segment": "policy-certification",
  "shift-break-limits": "policy-shift-limits",
  "segment-coverage": "policy-coverage",
  "substitute-parity": "policy-substitute",
  "field-trip-ratios": "policy-field-trip",
  "field-trip-signoff": "policy-field-trip-signoff",
  "schedule-day-metadata": "policy-schedule-day",
  "field-trip-event": "policy-field-trip-event"
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

export const ratioSegmentRule: RuleDefinition = {
  id: "ratio-segment",
  description:
    "Ensures each segment block has enough staff to meet the higher of the ratio-derived minimum or the configured minimum staff",
  evaluate: (context: RulesContext) => {
    const violations: RuleViolation[] = [];
    context.segmentBlocks.forEach((block) => {
      if (block.fieldTripEventId) {
        return;
      }
      const ratioProfile = block.requirementTemplate.ratioProfile;
      const childrenPerStaff = ratioProfile.childrenPerStaff || 1;
      const requiredFromRatio = Math.ceil(block.childCount / childrenPerStaff);
      const requiredStaff = Math.max(block.requirementTemplate.minStaff, requiredFromRatio);
      const assigned = getAssignmentsForBlock(context, block.id).length;
      if (assigned < requiredStaff) {
        const citationId = getCitationId(
          context,
          "ratio-segment",
          ratioProfile.policyCitationId ?? block.requirementTemplate.policyCitationId
        );
        const message = `Segment ${block.dayOfWeek}/${block.segment} requires ${requiredStaff} staff (min ${block.requirementTemplate.minStaff}, ratio ${childrenPerStaff}) but only ${assigned} assigned`;
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
    context.segmentBlocks.forEach((block) => {
      const employees = assignedEmployeesForBlock(context, block.id);
      const { requiresCpr, requiresMedicalDelegation, requiresLeader, policyCitationId } =
        block.requirementTemplate;
      const citationId = getCitationId(
        context,
        "certification-per-segment",
        policyCitationId
      );

      if (requiresCpr && !employees.some((employee) => employee.cprCurrent)) {
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
        requiresMedicalDelegation &&
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
    context.segmentBlocks.forEach((block) => {
      const employees = assignedEmployeesForBlock(context, block.id);
      const { requiresLeader, requiresMedicalDelegation, policyCitationId } =
        block.requirementTemplate;
      const citationId = getCitationId(context, "segment-coverage", policyCitationId);

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
        requiresMedicalDelegation &&
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

export const substituteParityRule: RuleDefinition = {
  id: "substitute-parity",
  description: "Requires approved substitute requests with metadata before the assignment is valid",
  evaluate: (context: RulesContext) => {
    const violations: RuleViolation[] = [];
    context.staffAssignments.forEach((assignment) => {
      if (!assignment.isSubstitute) {
        return;
      }
      const request = context.substituteRequests.find(
        (requestItem) => requestItem.id === assignment.substituteRequestId
      );
      const missing: string[] = [];
      if (!request) {
        missing.push("substituteRequest");
      } else {
        if (request.state !== "approved") {
          missing.push("state");
        }
        if (!request.approverId) {
          missing.push("approverId");
        }
        if (!request.approvedAt) {
          missing.push("approvedAt");
        }
        if (!request.reason) {
          missing.push("reason");
        }
      }
      if (missing.length > 0) {
        const citationId = getCitationId(
          context,
          "substitute-parity",
          request?.policyCitationId
        );
        violations.push(
          buildViolation(
            "substitute-parity",
            `Substitute assignment ${assignment.id} is missing required metadata: ${missing.join(", ")}`,
            "StaffAssignment",
            assignment.id,
            citationId,
            "error",
            { missing }
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
      if (event.isNoFieldTrip) {
        return;
      }
      if (!event.fieldTripTypeId) {
        violations.push(
          buildViolation(
            "field-trip-event",
            `Field trip event ${event.id} must reference a FieldTripType or declare "No Field Trip"`,
            "FieldTripEvent",
            event.id,
            citationId,
            "error",
            { missing: ["fieldTripTypeId", "isNoFieldTrip"] }
          )
        );
        return;
      }
      const typeExists = context.fieldTripTypes.some((type) => type.id === event.fieldTripTypeId);
      if (!typeExists) {
        violations.push(
          buildViolation(
            "field-trip-event",
            `Field trip event ${event.id} points to an unknown FieldTripType (${event.fieldTripTypeId})`,
            "FieldTripEvent",
            event.id,
            citationId,
            "error",
            { fieldTripTypeId: event.fieldTripTypeId }
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
      const requiredLeaders = Math.max(1, Math.ceil(block.childCount * type.minLeaderStudentRatio));
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
      if (leaderCount.length < requiredLeaders) {
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

export const fieldTripSignoffRule: RuleDefinition = {
  id: "field-trip-signoff",
  description: "Ensures every field trip override has director approval metadata",
  evaluate: (context: RulesContext) => {
    const violations: RuleViolation[] = [];
    context.fieldTripEvents.forEach((event) => {
      if (event.isNoFieldTrip) {
        return;
      }
      const missing: string[] = [];
      if (!event.approverId) {
        missing.push("approverId");
      }
      if (!event.signedOffAt) {
        missing.push("signedOffAt");
      }
      if (missing.length > 0) {
        const citationId = getCitationId(
          context,
          "field-trip-signoff",
          DEFAULT_POLICY_CITATIONS["field-trip-signoff"]
        );
        violations.push(
          buildViolation(
            "field-trip-signoff",
            `Field trip ${event.id} missing approval metadata: ${missing.join(", ")}`,
            "FieldTripEvent",
            event.id,
            citationId,
            "error",
            { missing }
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
  certificationPerSegmentRule,
  segmentCoverageRule,
  shiftBreakLimitsRule,
  substituteParityRule,
  fieldTripEventIntegrityRule,
  fieldTripRatiosRule,
  fieldTripSignoffRule
];
