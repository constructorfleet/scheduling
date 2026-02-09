import { RuleDefinition } from "./types";
import {
    calculateDurationHours,
    getCitationId,
    getDayOfWeekForAssignment,
    getEmployeeById,
    getFieldTripTypeById,
    parseTimeToMinutes,
    getOperatingHoursForDay,
    getScheduleDayById
} from "./utils";
import type { RulesContext, RuleViolation } from "./types";
import type { DayOfWeek, StaffAssignment } from "../domain/types";
import { count1on1StudentsInInterval } from "../domain/constants";

const DEFAULT_POLICY_CITATIONS: Record<string, string> = {
    "ratio-segment": "policy-ratio",
    "certification-per-segment": "policy-certification",
    "shift-break-limits": "policy-shift-limits",
    "segment-coverage": "policy-coverage",
    "field-trip-ratios": "policy-field-trip",
    "schedule-day-metadata": "policy-schedule-day",
    "field-trip-event": "policy-field-trip-event",
    "segment-block-timeline": "policy-coverage",
    "employee-availability": "policy-coverage",
    "open-close-coverage": "policy-open-close",
    "medical-delegated-coverage": "policy-med-delegated",
    "cpr-current-required": "policy-cpr-current",
    "on-call-exclusivity": "policy-on-call",
    "one-on-one-student-name": "policy-1on1"
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
    id: `${ ruleId }:${ targetEntity }:${ targetId }`,
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
        fieldTripStartTime: context.schoolRules?.fieldTripStartTime ?? "09:00",
        fieldTripEndTime: context.schoolRules?.fieldTripEndTime ?? "15:00",
        minimumMedicalDelegated: context.schoolRules?.minimumMedicalDelegated ?? 0,
        requireCurrentCpr: context.schoolRules?.requireCurrentCpr ?? false,
        openerWindowMinutes: context.schoolRules?.openerWindowMinutes ?? 15,
        closerWindowMinutes: context.schoolRules?.closerWindowMinutes ?? 15
    };
};

const formatMinutesAsTime = (value: number) => {
    const clamped = Math.max(0, value);
    const hours = Math.floor(clamped / 60)
        .toString()
        .padStart(2, "0");
    const minutes = (clamped % 60).toString().padStart(2, "0");
    return `${ hours }:${ minutes }`;
};

const normalizeChildrenPerStaff = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) {
        return 1;
    }
    const rounded = Math.round(value);
    if (Math.abs(value - rounded) < 1e-6) {
        return Math.max(1, rounded);
    }
    return Math.max(1, Math.ceil(value));
};

const findTimeWindowRatio = (
    context: RulesContext,
    scheduleTypeValue: string,
    intervalStartMinutes: number,
    intervalEndMinutes: number
): number | undefined => {
    const timeWindows = context.scheduleTypeTimeWindows;
    if (!timeWindows || timeWindows.length === 0) {
        return undefined;
    }

    const relevantWindows = timeWindows.filter(
        w => w.scheduleTypeValue === scheduleTypeValue
    );

    if (relevantWindows.length === 0) {
        return undefined;
    }

    // Find window that fully contains this interval
    for (const window of relevantWindows) {
        const windowStart = parseTimeToMinutes(window.startTime);
        const windowEnd = parseTimeToMinutes(window.endTime);

        if (intervalStartMinutes >= windowStart && intervalEndMinutes <= windowEnd) {
            return window.ratioStudents / window.ratioAdults;
        }
    }

    return undefined;
};

type DayAssignmentWithEmployee = {
    assignment: StaffAssignment;
    employee: NonNullable<ReturnType<typeof getEmployeeById>>;
    start: number;
    end: number;
};

type CoverageInterval = {
    start: number;
    end: number;
    actual: number;
};

const getActiveAssignmentsForDay = (
    context: RulesContext,
    dayOfWeek: DayOfWeek
): DayAssignmentWithEmployee[] =>
    context.staffAssignments
        .filter((assignment) => assignment.status !== "completed")
        .filter((assignment) => !assignment.isOnCall)
        .filter((assignment) => !assignment.is1on1)
        .filter((assignment) => getDayOfWeekForAssignment(context, assignment) === dayOfWeek)
        .map((assignment) => {
            const employee = getEmployeeById(context, assignment.employeeId);
            if (!employee) {
                return undefined;
            }
            return {
                assignment,
                employee,
                start: parseTimeToMinutes(assignment.startTime),
                end: parseTimeToMinutes(assignment.endTime)
            };
        })
        .filter((entry): entry is DayAssignmentWithEmployee => Boolean(entry));

const mergeCoverageIntervals = (intervals: CoverageInterval[]): CoverageInterval[] => {
    const merged: CoverageInterval[] = [];
    intervals.forEach((interval) => {
        const previous = merged[ merged.length - 1 ];
        if (previous && previous.end === interval.start && previous.actual === interval.actual) {
            previous.end = interval.end;
            return;
        }
        merged.push({ ...interval });
    });
    return merged;
};

const addEvent = (
    events: Map<number, { starts: string[]; ends: string[]; }>,
    time: number,
    key: "starts" | "ends",
    employeeId: string
) => {
    const current = events.get(time) ?? { starts: [], ends: [] };
    current[ key ].push(employeeId);
    events.set(time, current);
};

const evaluateMinimumCoverage = (
    dayAssignments: DayAssignmentWithEmployee[],
    windowStart: number,
    windowEnd: number,
    requiredCount: number,
    predicate: (entry: DayAssignmentWithEmployee) => boolean
): { minimumActual: number; failingIntervals: CoverageInterval[]; } => {
    if (windowEnd <= windowStart || requiredCount <= 0) {
        return { minimumActual: requiredCount > 0 ? 0 : Number.POSITIVE_INFINITY, failingIntervals: [] };
    }

    const events = new Map<number, { starts: string[]; ends: string[]; }>();
    const boundaries = new Set<number>([ windowStart, windowEnd ]);
    dayAssignments.forEach((entry) => {
        if (!predicate(entry)) {
            return;
        }
        const clippedStart = Math.max(windowStart, entry.start);
        const clippedEnd = Math.min(windowEnd, entry.end);
        if (clippedEnd <= clippedStart) {
            return;
        }
        boundaries.add(clippedStart);
        boundaries.add(clippedEnd);
        addEvent(events, clippedStart, "starts", entry.employee.id);
        addEvent(events, clippedEnd, "ends", entry.employee.id);
    });

    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
    if (sortedBoundaries.length < 2) {
        return { minimumActual: 0, failingIntervals: [] };
    }

    const activeEmployeeCounts = new Map<string, number>();
    const failingIntervals: CoverageInterval[] = [];
    let minimumActual = Number.POSITIVE_INFINITY;
    for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
        const start = sortedBoundaries[ index ];
        const end = sortedBoundaries[ index + 1 ];
        if (end <= start) {
            continue;
        }
        const intervalEvents = events.get(start);
        intervalEvents?.ends.forEach((employeeId) => {
            const nextCount = (activeEmployeeCounts.get(employeeId) ?? 0) - 1;
            if (nextCount <= 0) {
                activeEmployeeCounts.delete(employeeId);
            } else {
                activeEmployeeCounts.set(employeeId, nextCount);
            }
        });
        intervalEvents?.starts.forEach((employeeId) => {
            const nextCount = (activeEmployeeCounts.get(employeeId) ?? 0) + 1;
            activeEmployeeCounts.set(employeeId, nextCount);
        });

        const actual = activeEmployeeCounts.size;
        minimumActual = Math.min(minimumActual, actual);
        if (actual < requiredCount) {
            failingIntervals.push({ start, end, actual });
        }
    }

    return {
        minimumActual: Number.isFinite(minimumActual) ? minimumActual : 0,
        failingIntervals: mergeCoverageIntervals(failingIntervals)
    };
};

const evaluateConditionalLeaderCoverage = (
    dayAssignments: DayAssignmentWithEmployee[],
    windowStart: number,
    windowEnd: number,
    requiresLeaderPredicate: (entry: DayAssignmentWithEmployee) => boolean,
    isLeaderPredicate: (entry: DayAssignmentWithEmployee) => boolean
): CoverageInterval[] => {
    if (windowEnd <= windowStart) {
        return [];
    }

    const boundaries = new Set<number>([ windowStart, windowEnd ]);
    const requiresEvents = new Map<number, { starts: string[]; ends: string[]; }>();
    const leaderEvents = new Map<number, { starts: string[]; ends: string[]; }>();
    dayAssignments.forEach((entry) => {
        const clippedStart = Math.max(windowStart, entry.start);
        const clippedEnd = Math.min(windowEnd, entry.end);
        if (clippedEnd <= clippedStart) {
            return;
        }
        boundaries.add(clippedStart);
        boundaries.add(clippedEnd);
        if (requiresLeaderPredicate(entry)) {
            addEvent(requiresEvents, clippedStart, "starts", entry.employee.id);
            addEvent(requiresEvents, clippedEnd, "ends", entry.employee.id);
        }
        if (isLeaderPredicate(entry)) {
            addEvent(leaderEvents, clippedStart, "starts", entry.employee.id);
            addEvent(leaderEvents, clippedEnd, "ends", entry.employee.id);
        }
    });

    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
    const activeRequires = new Map<string, number>();
    const activeLeaders = new Map<string, number>();
    const failing: CoverageInterval[] = [];
    for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
        const start = sortedBoundaries[ index ];
        const end = sortedBoundaries[ index + 1 ];
        if (end <= start) {
            continue;
        }
        const requireEvents = requiresEvents.get(start);
        requireEvents?.ends.forEach((employeeId) => {
            const nextCount = (activeRequires.get(employeeId) ?? 0) - 1;
            if (nextCount <= 0) {
                activeRequires.delete(employeeId);
            } else {
                activeRequires.set(employeeId, nextCount);
            }
        });
        requireEvents?.starts.forEach((employeeId) => {
            const nextCount = (activeRequires.get(employeeId) ?? 0) + 1;
            activeRequires.set(employeeId, nextCount);
        });

        const currentLeaderEvents = leaderEvents.get(start);
        currentLeaderEvents?.ends.forEach((employeeId) => {
            const nextCount = (activeLeaders.get(employeeId) ?? 0) - 1;
            if (nextCount <= 0) {
                activeLeaders.delete(employeeId);
            } else {
                activeLeaders.set(employeeId, nextCount);
            }
        });
        currentLeaderEvents?.starts.forEach((employeeId) => {
            const nextCount = (activeLeaders.get(employeeId) ?? 0) + 1;
            activeLeaders.set(employeeId, nextCount);
        });

        if (activeRequires.size > 0 && activeLeaders.size === 0) {
            failing.push({ start, end, actual: 0 });
        }
    }

    return mergeCoverageIntervals(failing);
};

export const ratioSegmentRule: RuleDefinition = {
    id: "ratio-segment",
    description:
        "Ensures each segment block has enough staff to meet the higher of the ratio-derived minimum or the configured minimum staff",
    evaluate: (context: RulesContext) => {
        const violations: RuleViolation[] = [];
        const schoolRules = getSchoolRules(context);
        (context.scheduleDays ?? []).forEach((day) => {
            if (day.scheduleType === "closed" || day.dayScheduleType === "closed") {
                return;
            }
            const hours = getOperatingHoursForDay(context, day.dayOfWeek, day.dayScheduleType);
            if (!hours) {
                return;
            }
            const scheduleType = day.scheduleType;
            const baseEnrollment =
                typeof day.enrollmentCount === "number"
                    ? day.enrollmentCount
                    : 0;
            const activeFieldTripEvent = context.fieldTripEvents.find((event) => {
                if (event.dayOfWeek !== day.dayOfWeek) {
                    return false;
                }
                if (event.scheduleDayId && event.scheduleDayId !== day.id) {
                    return false;
                }
                return Boolean(event.fieldTripTypeId) && !event.isNoFieldTrip;
            });
            const activeFieldTripType = getFieldTripTypeById(context, activeFieldTripEvent?.fieldTripTypeId);
            // Field trip ratios use same format as schedule type ratios: children per adult
            // e.g., 1:10 ratio means adultRatioAdults=1, adultRatioStudents=10
            const fieldTripChildrenPerStaff =
                activeFieldTripType && activeFieldTripType.adultRatioStudents > 0
                    ? activeFieldTripType.adultRatioStudents / activeFieldTripType.adultRatioAdults
                    : undefined;
            const scheduleChildrenPerStaff = scheduleType ? context.scheduleTypeRatios?.[ scheduleType ] : undefined;
            const normalizedScheduleChildrenPerStaff = normalizeChildrenPerStaff(scheduleChildrenPerStaff ?? 1);
            const normalizedFieldTripChildrenPerStaff = fieldTripChildrenPerStaff
                ? normalizeChildrenPerStaff(fieldTripChildrenPerStaff)
                : normalizedScheduleChildrenPerStaff;
            const openMinutes = parseTimeToMinutes(hours.open);
            const closeMinutes = parseTimeToMinutes(hours.close);
            if (closeMinutes <= openMinutes) {
                return;
            }
            const fieldTripWindowStartRaw = parseTimeToMinutes(schoolRules.fieldTripStartTime);
            const fieldTripWindowEndRaw = parseTimeToMinutes(schoolRules.fieldTripEndTime);
            const fieldTripWindowStart = Math.max(openMinutes, fieldTripWindowStartRaw);
            const fieldTripWindowEnd = Math.min(closeMinutes, fieldTripWindowEndRaw);
            const hasFieldTripWindow =
                Boolean(activeFieldTripType) &&
                fieldTripWindowEnd > fieldTripWindowStart;
            const openerWindowEnd = openMinutes + schoolRules.openerWindowMinutes;
            const closerWindowStart = closeMinutes - schoolRules.closerWindowMinutes;
            const dayAssignments = context.staffAssignments
                .filter((assignment) => assignment.status !== "completed")
                .filter((assignment) => !assignment.isOnCall)
                .filter((assignment) => !assignment.is1on1)
                .filter((assignment) => getDayOfWeekForAssignment(context, assignment) === day.dayOfWeek)
                .filter((assignment) => Boolean(getEmployeeById(context, assignment.employeeId)));
            const boundaries = new Set<number>([ openMinutes, closeMinutes ]);
            if (hasFieldTripWindow) {
                boundaries.add(fieldTripWindowStart);
                boundaries.add(fieldTripWindowEnd);
            }
            // Add time window boundaries
            const scheduleTypeWindows = (context.scheduleTypeTimeWindows || [])
                .filter(w => w.scheduleTypeValue === scheduleType);
            scheduleTypeWindows.forEach(window => {
                const windowStart = parseTimeToMinutes(window.startTime);
                const windowEnd = parseTimeToMinutes(window.endTime);
                if (windowStart >= openMinutes && windowStart <= closeMinutes) {
                    boundaries.add(windowStart);
                }
                if (windowEnd >= openMinutes && windowEnd <= closeMinutes) {
                    boundaries.add(windowEnd);
                }
            });
            dayAssignments.forEach((assignment) => {
                const start = parseTimeToMinutes(assignment.startTime);
                const end = parseTimeToMinutes(assignment.endTime);
                if (end <= openMinutes || start >= closeMinutes) {
                    return;
                }
                boundaries.add(Math.max(openMinutes, start));
                boundaries.add(Math.min(closeMinutes, end));
            });
            const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
            const failingIntervals: Array<{
                start: number;
                end: number;
                required: number;
                minStaff: number;
                assigned: number;
                effectiveChildCount: number;
            }> = [];
            for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
                const start = sortedBoundaries[ index ];
                const end = sortedBoundaries[ index + 1 ];
                if (end <= start) {
                    continue;
                }
                let minStaff = 0;
                if (schoolRules.openerCount > 0 && start < openerWindowEnd && end > openMinutes) {
                    minStaff = Math.max(minStaff, schoolRules.openerCount);
                }
                if (schoolRules.closerCount > 0 && start < closeMinutes && end > closerWindowStart) {
                    minStaff = Math.max(minStaff, schoolRules.closerCount);
                }
                // Three-tier priority: FieldTrip > TimeWindow > Default
                let normalizedChildrenPerStaff: number;
                if (hasFieldTripWindow && start >= fieldTripWindowStart && end <= fieldTripWindowEnd) {
                    // Priority 1: Field trip ratio (highest)
                    normalizedChildrenPerStaff = normalizedFieldTripChildrenPerStaff;
                } else {
                    // Priority 2: Check for time window ratio
                    const timeWindowRatio = scheduleType
                        ? findTimeWindowRatio(context, scheduleType, start, end)
                        : undefined;
                    if (timeWindowRatio !== undefined) {
                        normalizedChildrenPerStaff = normalizeChildrenPerStaff(timeWindowRatio);
                    } else {
                        // Priority 3: Default schedule type ratio (fallback)
                        normalizedChildrenPerStaff = normalizedScheduleChildrenPerStaff;
                    }
                }
                // Subtract students in 1:1 assignments during this interval
                const studentsIn1on1 = count1on1StudentsInInterval(
                    context.staffAssignments,
                    day.dayOfWeek,
                    start,
                    end,
                    (assignment) => getDayOfWeekForAssignment(context, assignment),
                    parseTimeToMinutes
                );
                const effectiveChildCount = Math.max(0, baseEnrollment - studentsIn1on1);
                const requiredFromRatio = Math.ceil(effectiveChildCount / normalizedChildrenPerStaff);
                const required = Math.max(minStaff, requiredFromRatio);
                const assigned = new Set(
                    dayAssignments
                        .filter((assignment) => {
                            const assignmentStart = parseTimeToMinutes(assignment.startTime);
                            const assignmentEnd = parseTimeToMinutes(assignment.endTime);
                            return assignmentStart < end && assignmentEnd > start;
                        })
                        .map((assignment) => assignment.employeeId)
                ).size;
                if (assigned < required) {
                    failingIntervals.push({ start, end, required, minStaff, assigned, effectiveChildCount });
                }
            }
            if (failingIntervals.length === 0) {
                return;
            }
            const mergedIntervals: typeof failingIntervals = [];
            failingIntervals.forEach((interval) => {
                const previous = mergedIntervals[ mergedIntervals.length - 1 ];
                if (
                    previous &&
                    previous.end === interval.start &&
                    previous.required === interval.required &&
                    previous.minStaff === interval.minStaff &&
                    previous.assigned === interval.assigned &&
                    previous.effectiveChildCount === interval.effectiveChildCount
                ) {
                    previous.end = interval.end;
                    return;
                }
                mergedIntervals.push({ ...interval });
            });
            const citationId = getCitationId(context, "ratio-segment", DEFAULT_POLICY_CITATIONS[ "ratio-segment" ]);
            mergedIntervals.forEach((interval, intervalIndex) => {
                const relatedSegmentBlockIds = Array.from(
                    new Set(
                        dayAssignments
                            .filter((assignment) => {
                                const assignmentStart = parseTimeToMinutes(assignment.startTime);
                                const assignmentEnd = parseTimeToMinutes(assignment.endTime);
                                return assignmentStart < interval.end && assignmentEnd > interval.start;
                            })
                            .map((assignment) => assignment.segmentBlockId)
                            .filter((segmentBlockId) => Boolean(segmentBlockId))
                    )
                );
                const useFieldTripRatio = hasFieldTripWindow &&
                    interval.start >= fieldTripWindowStart &&
                    interval.end <= fieldTripWindowEnd;
                const normalizedChildrenPerStaff = useFieldTripRatio
                    ? normalizedFieldTripChildrenPerStaff
                    : normalizedScheduleChildrenPerStaff;
                const sourceLabel = useFieldTripRatio ? "field trip override" : "schedule type";
                const message =
                    `${ day.dayOfWeek.toUpperCase() } ${ formatMinutesAsTime(interval.start) }-${ formatMinutesAsTime(interval.end) } ` +
                    `requires ${ interval.required } staff (min ${ interval.minStaff }, ratio ${ normalizedChildrenPerStaff } from ${ sourceLabel }, children ${ interval.effectiveChildCount }) ` +
                    `but only ${ interval.assigned } assigned`;
                violations.push(
                    buildViolation(
                        "ratio-segment",
                        message,
                        "ScheduleDay",
                        `${ day.id }:${ intervalIndex }`,
                        citationId,
                        "error",
                        {
                            dayOfWeek: day.dayOfWeek,
                            childCount: interval.effectiveChildCount,
                            ratioSource: useFieldTripRatio ? "fieldTrip" : "scheduleType",
                            required: interval.required,
                            actual: interval.assigned,
                            minStaff: interval.minStaff,
                            ratioChildrenPerStaff: normalizedChildrenPerStaff,
                            startTime: formatMinutesAsTime(interval.start),
                            endTime: formatMinutesAsTime(interval.end),
                            relatedSegmentBlockIds
                        }
                    )
                );
            });
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
            DEFAULT_POLICY_CITATIONS[ "schedule-day-metadata" ]
        );
        (context.scheduleDays ?? []).forEach((day) => {
            if (day.scheduleType === "closed" || day.dayScheduleType === "closed") {
                return;
            }
            if (!day.scheduleType) {
                violations.push(
                    buildViolation(
                        "schedule-day-metadata",
                        `Schedule day ${ day.date } lacks a selected schedule type`,
                        "ScheduleDay",
                        day.id,
                        citationId,
                        "error",
                        { missing: [ "scheduleType" ] }
                    )
                );
            }
            if (day.enrollmentCount === undefined || day.enrollmentCount === null) {
                violations.push(
                    buildViolation(
                        "schedule-day-metadata",
                        `Schedule day ${ day.date } needs an enrollment headcount`,
                        "ScheduleDay",
                        day.id,
                        citationId,
                        "error",
                        { missing: [ "enrollmentCount" ] }
                    )
                );
            }
            if (!day.fieldTripEventId) {
                violations.push(
                    buildViolation(
                        "schedule-day-metadata",
                        `Schedule day ${ day.date } must link to a field trip decision (or mark "No Field Trip")`,
                        "ScheduleDay",
                        day.id,
                        citationId,
                        "error",
                        { missing: [ "fieldTripEventId" ] }
                    )
                );
                return;
            }
            const hasEvent = context.fieldTripEvents.some((event) => event.id === day.fieldTripEventId);
            if (!hasEvent) {
                violations.push(
                    buildViolation(
                        "schedule-day-metadata",
                        `Schedule day ${ day.date } references a missing field trip decision (${ day.fieldTripEventId })`,
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
        "Validates assignment coverage includes CPR, medical delegation, and leader qualifications when required",
    evaluate: (context: RulesContext) => {
        const violations: RuleViolation[] = [];
        const schoolRules = getSchoolRules(context);
        context.scheduleDays.forEach((day) => {
            if (day.scheduleType === "closed" || day.dayScheduleType === "closed") {
                return;
            }
            const operatingHours = getOperatingHoursForDay(context, day.dayOfWeek, day.dayScheduleType);
            if (!operatingHours) {
                return;
            }

            const windowStart = parseTimeToMinutes(operatingHours.open);
            const windowEnd = parseTimeToMinutes(operatingHours.close);
            if (windowEnd <= windowStart) {
                return;
            }

            const dayAssignments = getActiveAssignmentsForDay(context, day.dayOfWeek);
            const citationId = getCitationId(
                context,
                "certification-per-segment",
                DEFAULT_POLICY_CITATIONS[ "certification-per-segment" ]
            );

            if (schoolRules.requireCurrentCpr) {
                const cprCoverage = evaluateMinimumCoverage(
                    dayAssignments,
                    windowStart,
                    windowEnd,
                    1,
                    (entry) => entry.employee.cprCurrent
                );
                if (cprCoverage.failingIntervals.length > 0) {
                    const firstGap = cprCoverage.failingIntervals[ 0 ];
                    violations.push(
                        buildViolation(
                            "certification-per-segment",
                            `${ day.dayOfWeek.toUpperCase() } operating hours lack an employee with current CPR certification`,
                            "ScheduleDay",
                            day.id,
                            citationId,
                            "error",
                            {
                                dayOfWeek: day.dayOfWeek,
                                operatingHoursId: operatingHours.id,
                                startTime: formatMinutesAsTime(firstGap.start),
                                endTime: formatMinutesAsTime(firstGap.end)
                            }
                        )
                    );
                }
            }

            if (schoolRules.minimumMedicalDelegated > 0) {
                const medCoverage = evaluateMinimumCoverage(
                    dayAssignments,
                    windowStart,
                    windowEnd,
                    1,
                    (entry) => entry.employee.medicallyDelegated
                );
                if (medCoverage.failingIntervals.length > 0) {
                    const firstGap = medCoverage.failingIntervals[ 0 ];
                    violations.push(
                        buildViolation(
                            "certification-per-segment",
                            `${ day.dayOfWeek.toUpperCase() } operating hours lack medically delegated staff`,
                            "ScheduleDay",
                            day.id,
                            citationId,
                            "error",
                            {
                                dayOfWeek: day.dayOfWeek,
                                operatingHoursId: operatingHours.id,
                                startTime: formatMinutesAsTime(firstGap.start),
                                endTime: formatMinutesAsTime(firstGap.end)
                            }
                        )
                    );
                }
            }

            const openWindowEnd = Math.min(windowStart + schoolRules.openerWindowMinutes, windowEnd);
            const closeWindowStart = Math.max(windowEnd - schoolRules.closerWindowMinutes, windowStart);
            const openerLeaderGaps = evaluateConditionalLeaderCoverage(
                dayAssignments,
                windowStart,
                openWindowEnd,
                (entry) => context.jobTitleRules?.[ entry.employee.jobTitle ]?.requiresLeaderForOpenClose ?? false,
                (entry) => entry.employee.leaderQualified
            );
            if (openerLeaderGaps.length > 0) {
                const firstGap = openerLeaderGaps[ 0 ];
                violations.push(
                    buildViolation(
                        "certification-per-segment",
                        `${ day.dayOfWeek.toUpperCase() } opener window lacks a leader-qualified employee`,
                        "ScheduleDay",
                        day.id,
                        citationId,
                        "error",
                        {
                            type: "opener",
                            dayOfWeek: day.dayOfWeek,
                            operatingHoursId: operatingHours.id,
                            startTime: formatMinutesAsTime(firstGap.start),
                            endTime: formatMinutesAsTime(firstGap.end)
                        }
                    )
                );
            }

            const closerLeaderGaps = evaluateConditionalLeaderCoverage(
                dayAssignments,
                closeWindowStart,
                windowEnd,
                (entry) => context.jobTitleRules?.[ entry.employee.jobTitle ]?.requiresLeaderForOpenClose ?? false,
                (entry) => entry.employee.leaderQualified
            );
            if (closerLeaderGaps.length > 0) {
                const firstGap = closerLeaderGaps[ 0 ];
                violations.push(
                    buildViolation(
                        "certification-per-segment",
                        `${ day.dayOfWeek.toUpperCase() } closer window lacks a leader-qualified employee`,
                        "ScheduleDay",
                        day.id,
                        citationId,
                        "error",
                        {
                            type: "closer",
                            dayOfWeek: day.dayOfWeek,
                            operatingHoursId: operatingHours.id,
                            startTime: formatMinutesAsTime(firstGap.start),
                            endTime: formatMinutesAsTime(firstGap.end)
                        }
                    )
                );
            }
        });
        return violations;
    }
};

export const segmentCoverageRule: RuleDefinition = {
    id: "segment-coverage",
    description: "Enforces leader and medical coverage guardrails from assignment windows",
    evaluate: (context: RulesContext) => {
        const violations: RuleViolation[] = [];
        const schoolRules = getSchoolRules(context);
        context.scheduleDays.forEach((day) => {
            if (day.scheduleType === "closed" || day.dayScheduleType === "closed") {
                return;
            }
            const operatingHours = getOperatingHoursForDay(context, day.dayOfWeek, day.dayScheduleType);
            if (!operatingHours) {
                return;
            }
            const windowStart = parseTimeToMinutes(operatingHours.open);
            const windowEnd = parseTimeToMinutes(operatingHours.close);
            if (windowEnd <= windowStart) {
                return;
            }
            const dayAssignments = getActiveAssignmentsForDay(context, day.dayOfWeek);
            const citationId = getCitationId(
                context,
                "segment-coverage",
                DEFAULT_POLICY_CITATIONS[ "segment-coverage" ]
            );
            const openerWindowEnd = Math.min(windowStart + schoolRules.openerWindowMinutes, windowEnd);
            const closerWindowStart = Math.max(windowEnd - schoolRules.closerWindowMinutes, windowStart);
            const openerLeaderGaps = evaluateConditionalLeaderCoverage(
                dayAssignments,
                windowStart,
                openerWindowEnd,
                (entry) => context.jobTitleRules?.[ entry.employee.jobTitle ]?.requiresLeaderForOpenClose ?? false,
                (entry) => entry.employee.leaderQualified
            );
            const closerLeaderGaps = evaluateConditionalLeaderCoverage(
                dayAssignments,
                closerWindowStart,
                windowEnd,
                (entry) => context.jobTitleRules?.[ entry.employee.jobTitle ]?.requiresLeaderForOpenClose ?? false,
                (entry) => entry.employee.leaderQualified
            );

            if (openerLeaderGaps.length > 0) {
                const firstGap = openerLeaderGaps[ 0 ];
                violations.push(
                    buildViolation(
                        "segment-coverage",
                        `${ day.dayOfWeek.toUpperCase() } opener window needs at least one leader-qualified employee`,
                        "ScheduleDay",
                        day.id,
                        citationId,
                        "error",
                        {
                            type: "opener",
                            startTime: formatMinutesAsTime(firstGap.start),
                            endTime: formatMinutesAsTime(firstGap.end)
                        }
                    )
                );
            }
            if (closerLeaderGaps.length > 0) {
                const firstGap = closerLeaderGaps[ 0 ];
                violations.push(
                    buildViolation(
                        "segment-coverage",
                        `${ day.dayOfWeek.toUpperCase() } closer window needs at least one leader-qualified employee`,
                        "ScheduleDay",
                        day.id,
                        citationId,
                        "error",
                        {
                            type: "closer",
                            startTime: formatMinutesAsTime(firstGap.start),
                            endTime: formatMinutesAsTime(firstGap.end)
                        }
                    )
                );
            }

            if (schoolRules.minimumMedicalDelegated > 0) {
                const medicalCoverage = evaluateMinimumCoverage(
                    dayAssignments,
                    windowStart,
                    windowEnd,
                    1,
                    (entry) => entry.employee.medicallyDelegated
                );
                if (medicalCoverage.failingIntervals.length > 0) {
                    const firstGap = medicalCoverage.failingIntervals[ 0 ];
                    violations.push(
                        buildViolation(
                            "segment-coverage",
                            `${ day.dayOfWeek.toUpperCase() } operating hours need medically delegated coverage`,
                            "ScheduleDay",
                            day.id,
                            citationId,
                            "error",
                            {
                                required: 1,
                                actual: medicalCoverage.minimumActual,
                                startTime: formatMinutesAsTime(firstGap.start),
                                endTime: formatMinutesAsTime(firstGap.end)
                            }
                        )
                    );
                }
            }
        });
        return violations;
    }
};

export const segmentBlockTimelineRule: RuleDefinition = {
    id: "segment-block-timeline",
    description: "Detects invalid assignment windows and overlapping shifts for the same employee",
    evaluate: (context: RulesContext) => {
        const violations: RuleViolation[] = [];
        const citationId = getCitationId(
            context,
            "segment-block-timeline",
            DEFAULT_POLICY_CITATIONS[ "segment-block-timeline" ]
        );
        context.staffAssignments
            .filter((assignment) => assignment.status !== "completed")
            .forEach((assignment) => {
                const dayOfWeek = getDayOfWeekForAssignment(context, assignment);
                if (!dayOfWeek) {
                    return;
                }
                const scheduleDay = context.scheduleDays.find((day) => day.dayOfWeek === dayOfWeek);
                if (scheduleDay?.scheduleType === "closed" || scheduleDay?.dayScheduleType === "closed") {
                    return;
                }
                const start = parseTimeToMinutes(assignment.startTime);
                const end = parseTimeToMinutes(assignment.endTime);
                if (start >= end) {
                    violations.push(
                        buildViolation(
                            "segment-block-timeline",
                            `Schedule block ${ dayOfWeek.toUpperCase() } ${ assignment.startTime }-${ assignment.endTime } has an invalid window`,
                            "StaffAssignment",
                            assignment.id,
                            citationId,
                            "error",
                            {
                                startTime: assignment.startTime,
                                endTime: assignment.endTime,
                                dayOfWeek,
                                relatedSegmentBlockIds: [ assignment.segmentBlockId ]
                            }
                        )
                    );
                    return;
                }
                const operatingHours = getOperatingHoursForDay(context, dayOfWeek, scheduleDay?.dayScheduleType);
                if (!operatingHours) {
                    return;
                }
                const openMinutes = parseTimeToMinutes(operatingHours.open);
                const closeMinutes = parseTimeToMinutes(operatingHours.close);
                if (start < openMinutes) {
                    violations.push(
                        buildViolation(
                            "segment-block-timeline",
                            `Schedule block on ${ dayOfWeek.toUpperCase() } starts before operating hours (${ operatingHours.open })`,
                            "StaffAssignment",
                            assignment.id,
                            citationId,
                            "error",
                            {
                                operatingHoursId: operatingHours.id,
                                startTime: assignment.startTime,
                                boundary: operatingHours.open,
                                dayOfWeek,
                                relatedSegmentBlockIds: [ assignment.segmentBlockId ]
                            }
                        )
                    );
                }
                if (end > closeMinutes) {
                    violations.push(
                        buildViolation(
                            "segment-block-timeline",
                            `Schedule block on ${ dayOfWeek.toUpperCase() } ends after operating hours (${ operatingHours.close })`,
                            "StaffAssignment",
                            assignment.id,
                            citationId,
                            "error",
                            {
                                operatingHoursId: operatingHours.id,
                                endTime: assignment.endTime,
                                boundary: operatingHours.close,
                                dayOfWeek,
                                relatedSegmentBlockIds: [ assignment.segmentBlockId ]
                            }
                        )
                    );
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
            const key = `${ assignment.employeeId }:${ dayOfWeek }`;
            if (!assignmentsByEmployeeDay[ key ]) {
                assignmentsByEmployeeDay[ key ] = [];
            }
            assignmentsByEmployeeDay[ key ].push(assignment);
        });

        Object.entries(assignmentsByEmployeeDay).forEach(([ key, assignments ]) => {
            const [ employeeId, dayOfWeek ] = key.split(":");
            const sorted = [ ...assignments ].sort(
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
                            `${ employee?.name ?? "Employee" } has overlapping schdule blocks on ${ dayOfWeek.toUpperCase() } (${ activeAssignment.startTime }-${ activeAssignment.endTime } and ${ assignment.startTime }-${ assignment.endTime })`,
                            "StaffAssignment",
                            assignment.id,
                            citationId,
                            "error",
                            {
                                overlapsWithAssignmentId: activeAssignment.id,
                                relatedSegmentBlockIds: [ primarySegmentId, secondarySegmentId ],
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

const normalizeDateOnly = (value: string) => value.split("T")[ 0 ];
const isDateInRange = (date: string, startDate: string, endDate: string) => {
    const normalized = normalizeDateOnly(date);
    const start = normalizeDateOnly(startDate);
    const end = normalizeDateOnly(endDate);
    return normalized >= start && normalized <= end;
};

export const employeeAvailabilityRule: RuleDefinition = {
    id: "employee-availability",
    description:
        "Ensures assignments only occur on days/times where each employee is available and not marked as requested time off",
    evaluate: (context: RulesContext) => {
        const violations: RuleViolation[] = [];
        const citationId = getCitationId(
            context,
            "employee-availability",
            DEFAULT_POLICY_CITATIONS[ "employee-availability" ]
        );

        context.staffAssignments
            .filter((assignment) => assignment.status !== "completed")
            .forEach((assignment) => {
                const employee = getEmployeeById(context, assignment.employeeId);
                if (!employee) {
                    return;
                }
                const dayOfWeek = getDayOfWeekForAssignment(context, assignment);
                if (!dayOfWeek) {
                    return;
                }
                const scheduleDay = context.scheduleDays.find((day) => day.dayOfWeek === dayOfWeek);
                const date = scheduleDay?.date ? normalizeDateOnly(scheduleDay.date) : undefined;
                const daysOff = employee.requestedDaysOff ?? [];
                const isRequestedOff = Boolean(
                    date &&
                    daysOff.some((dayOff) => isDateInRange(date, dayOff.startDate, dayOff.endDate))
                );
                if (isRequestedOff) {
                    violations.push(
                        buildViolation(
                            "employee-availability",
                            `${ employee.name } is scheduled on a requested day off (${ date })`,
                            "StaffAssignment",
                            assignment.id,
                            citationId,
                            "error",
                            {
                                employeeId: employee.id,
                                employeeName: employee.name,
                                dayOfWeek,
                                date,
                                reason: "requested-day-off",
                                relatedSegmentBlockIds: [ assignment.segmentBlockId ]
                            }
                        )
                    );
                    return;
                }

                const availabilityForDay = employee.availability?.find((day) => day.dayOfWeek === dayOfWeek);
                if (!availabilityForDay) {
                    return;
                }
                const blocks = availabilityForDay.blocks ?? [];
                if (blocks.length === 0) {
                    violations.push(
                        buildViolation(
                            "employee-availability",
                            `${ employee.name } is not available on ${ dayOfWeek.toUpperCase() } but has a scheduled assignment`,
                            "StaffAssignment",
                            assignment.id,
                            citationId,
                            "error",
                            {
                                employeeId: employee.id,
                                employeeName: employee.name,
                                dayOfWeek,
                                date,
                                reason: "not-available-day",
                                relatedSegmentBlockIds: [ assignment.segmentBlockId ]
                            }
                        )
                    );
                    return;
                }

                const assignmentStart = parseTimeToMinutes(assignment.startTime);
                const assignmentEnd = parseTimeToMinutes(assignment.endTime);
                const fitsAvailability = blocks.some((block) => {
                    const blockStart = parseTimeToMinutes(block.startTime);
                    const blockEnd = parseTimeToMinutes(block.endTime);
                    return assignmentStart >= blockStart && assignmentEnd <= blockEnd;
                });

                if (!fitsAvailability) {
                    violations.push(
                        buildViolation(
                            "employee-availability",
                            `${ employee.name } is scheduled outside availability on ${ dayOfWeek.toUpperCase() } (${ assignment.startTime }-${ assignment.endTime })`,
                            "StaffAssignment",
                            assignment.id,
                            citationId,
                            "error",
                            {
                                employeeId: employee.id,
                                employeeName: employee.name,
                                dayOfWeek,
                                date,
                                reason: "outside-availability-window",
                                assignmentWindow: `${ assignment.startTime }-${ assignment.endTime }`,
                                availableWindows: blocks.map((block) => `${ block.startTime }-${ block.endTime }`),
                                relatedSegmentBlockIds: [ assignment.segmentBlockId ]
                            }
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
            dailyTotals[ employee.id ] = dailyTotals[ employee.id ] || {};
            dailyTotals[ employee.id ][ day ] = (dailyTotals[ employee.id ][ day ] ?? 0) + duration;
            weeklyTotals[ employee.id ] = (weeklyTotals[ employee.id ] ?? 0) + duration;

            const cumulativeDay = dailyTotals[ employee.id ][ day ];
            if (
                employee.maxHoursPerDay > 0 &&
                cumulativeDay > employee.maxHoursPerDay &&
                !dailyViolations.has(`${ employee.id }:${ day }`)
            ) {
                dailyViolations.add(`${ employee.id }:${ day }`);
                const citationId = getCitationId(context, "shift-break-limits", employee.id);
                violations.push(
                    buildViolation(
                        "shift-break-limits",
                        `${ employee.name } exceeds daily limit (${ cumulativeDay.toFixed(2) }h > ${ employee.maxHoursPerDay }h)`,
                        "StaffAssignment",
                        assignment.id,
                        citationId,
                        "error",
                        { employeeId: employee.id, day }
                    )
                );
            }

            const cumulativeWeek = weeklyTotals[ employee.id ];
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
                        `${ employee.name } exceeds weekly limit (${ cumulativeWeek.toFixed(2) }h > ${ employee.maxHoursPerWeek }h)`,
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
        const citationId = getCitationId(context, "open-close-coverage", DEFAULT_POLICY_CITATIONS[ "open-close-coverage" ]);

        (context.scheduleDays ?? []).forEach((day) => {
            if (day.scheduleType === "closed" || day.dayScheduleType === "closed") {
                return;
            }
            const hours = getOperatingHoursForDay(context, day.dayOfWeek, day.dayScheduleType);
            if (!hours) {
                return;
            }
            const openMinutes = parseTimeToMinutes(hours.open);
            const closeMinutes = parseTimeToMinutes(hours.close);
            const openerWindowEnd = openMinutes + rules.openerWindowMinutes;
            const closerWindowStart = closeMinutes - rules.closerWindowMinutes;

            const dayAssignments = getActiveAssignmentsForDay(context, day.dayOfWeek);
            const openerCoverage = evaluateMinimumCoverage(
                dayAssignments,
                openMinutes,
                Math.min(openerWindowEnd, closeMinutes),
                Math.max(rules.openerCount, 0),
                () => true
            );
            const closerCoverage = evaluateMinimumCoverage(
                dayAssignments,
                Math.max(closerWindowStart, openMinutes),
                closeMinutes,
                Math.max(rules.closerCount, 0),
                () => true
            );

            if (rules.openerCount > 0 && openerCoverage.failingIntervals.length > 0) {
                violations.push(
                    buildViolation(
                        "open-close-coverage",
                        `${ day.dayOfWeek.toUpperCase() } requires ${ rules.openerCount } opener(s) within ${ rules.openerWindowMinutes } minutes of open`,
                        "ScheduleDay",
                        day.id,
                        citationId,
                        "error",
                        { type: "opener", required: rules.openerCount, actual: openerCoverage.minimumActual }
                    )
                );
            }

            if (rules.closerCount > 0 && closerCoverage.failingIntervals.length > 0) {
                violations.push(
                    buildViolation(
                        "open-close-coverage",
                        `${ day.dayOfWeek.toUpperCase() } requires ${ rules.closerCount } closer(s) within ${ rules.closerWindowMinutes } minutes of close`,
                        "ScheduleDay",
                        day.id,
                        citationId,
                        "error",
                        { type: "closer", required: rules.closerCount, actual: closerCoverage.minimumActual }
                    )
                );
            }

            const openerLeaderGaps = evaluateConditionalLeaderCoverage(
                dayAssignments,
                openMinutes,
                Math.min(openerWindowEnd, closeMinutes),
                (entry) => context.jobTitleRules?.[ entry.employee.jobTitle ]?.requiresLeaderForOpenClose ?? false,
                (entry) => entry.employee.leaderQualified
            );
            if (openerLeaderGaps.length > 0) {
                violations.push(
                    buildViolation(
                        "open-close-coverage",
                        `${ day.dayOfWeek.toUpperCase() } opener coverage requires a leader-qualified staff member`,
                        "ScheduleDay",
                        day.id,
                        citationId,
                        "error",
                        { type: "opener", requiresLeader: true }
                    )
                );
            }

            const closerLeaderGaps = evaluateConditionalLeaderCoverage(
                dayAssignments,
                Math.max(closerWindowStart, openMinutes),
                closeMinutes,
                (entry) => context.jobTitleRules?.[ entry.employee.jobTitle ]?.requiresLeaderForOpenClose ?? false,
                (entry) => entry.employee.leaderQualified
            );
            if (closerLeaderGaps.length > 0) {
                violations.push(
                    buildViolation(
                        "open-close-coverage",
                        `${ day.dayOfWeek.toUpperCase() } closer coverage requires a leader-qualified staff member`,
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
    description: "Requires minimum medically delegated staff across operating hours",
    evaluate: (context: RulesContext) => {
        const violations: RuleViolation[] = [];
        const rules = getSchoolRules(context);
        if (rules.minimumMedicalDelegated <= 0) {
            return violations;
        }

        context.scheduleDays.forEach((day) => {
            if (day.scheduleType === "closed" || day.dayScheduleType === "closed") {
                return;
            }

            const operatingHours = getOperatingHoursForDay(context, day.dayOfWeek, day.dayScheduleType);
            if (!operatingHours) {
                return;
            }

            const windowStart = parseTimeToMinutes(operatingHours.open);
            const windowEnd = parseTimeToMinutes(operatingHours.close);
            if (windowEnd <= windowStart) {
                return;
            }

            const dayAssignments = getActiveAssignmentsForDay(context, day.dayOfWeek);
            const coverage = evaluateMinimumCoverage(
                dayAssignments,
                windowStart,
                windowEnd,
                rules.minimumMedicalDelegated,
                (entry) => entry.employee.medicallyDelegated
            );
            if (coverage.failingIntervals.length === 0) {
                return;
            }
            const citationId = getCitationId(
                context,
                "medical-delegated-coverage",
                DEFAULT_POLICY_CITATIONS[ "medical-delegated-coverage" ]
            );
            const firstGap = coverage.failingIntervals[ 0 ];
            const relatedSegmentBlockIds = Array.from(
                new Set(
                    dayAssignments
                        .map((entry) => entry.assignment.segmentBlockId)
                        .filter((segmentBlockId) => Boolean(segmentBlockId))
                )
            );
            violations.push(
                buildViolation(
                    "medical-delegated-coverage",
                    `${ day.dayOfWeek.toUpperCase() } operating hours require ${ rules.minimumMedicalDelegated } medically delegated staff`,
                    "ScheduleDay",
                    day.id,
                    citationId,
                    "error",
                    {
                        required: rules.minimumMedicalDelegated,
                        actual: coverage.minimumActual,
                        dayOfWeek: day.dayOfWeek,
                        operatingHoursId: operatingHours.id,
                        boundaryStart: operatingHours.open,
                        boundaryEnd: operatingHours.close,
                        startTime: formatMinutesAsTime(firstGap.start),
                        endTime: formatMinutesAsTime(firstGap.end),
                        relatedSegmentBlockIds
                    }
                )
            );
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
                    DEFAULT_POLICY_CITATIONS[ "cpr-current-required" ]
                );
                violations.push(
                    buildViolation(
                        "cpr-current-required",
                        `${ employee.name } cannot be scheduled without current CPR certification`,
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

export const onCallExclusivityRule: RuleDefinition = {
    id: "on-call-exclusivity",
    description: "Ensures employees on-call for a day cannot have regular time block assignments",
    evaluate: (context: RulesContext) => {
        const violations: RuleViolation[] = [];
        const citationId = getCitationId(
            context,
            "on-call-exclusivity",
            DEFAULT_POLICY_CITATIONS["on-call-exclusivity"] || "policy-on-call"
        );

        // Build map: employeeId:dayOfWeek -> on-call assignment
        const onCallByEmployeeDay = new Map<string, StaffAssignment>();
        context.staffAssignments
            .filter((assignment) => assignment.isOnCall)
            .forEach((assignment) => {
                const dayOfWeek = getDayOfWeekForAssignment(context, assignment);
                if (dayOfWeek) {
                    const key = `${assignment.employeeId}:${dayOfWeek}`;
                    onCallByEmployeeDay.set(key, assignment);
                }
            });

        // Check all assignments for conflicts
        context.staffAssignments
            .filter((assignment) => assignment.status !== "completed")
            .forEach((assignment) => {
                const dayOfWeek = getDayOfWeekForAssignment(context, assignment);
                if (!dayOfWeek) return;

                const employee = getEmployeeById(context, assignment.employeeId);
                if (!employee) return;

                const key = `${assignment.employeeId}:${dayOfWeek}`;
                const onCallAssignment = onCallByEmployeeDay.get(key);

                // If on-call, check for conflicting regular assignments
                if (assignment.isOnCall) {
                    const regularAssignments = context.staffAssignments.filter(
                        (other) =>
                            !other.isOnCall &&
                            other.employeeId === assignment.employeeId &&
                            getDayOfWeekForAssignment(context, other) === dayOfWeek &&
                            other.status !== "completed"
                    );

                    if (regularAssignments.length > 0) {
                        violations.push(
                            buildViolation(
                                "on-call-exclusivity",
                                `${employee.name} is on-call for ${dayOfWeek.toUpperCase()} and cannot have regular time blocks`,
                                "StaffAssignment",
                                assignment.id,
                                citationId,
                                "error",
                                { employeeId: employee.id, employeeName: employee.name, dayOfWeek }
                            )
                        );
                    }
                }
                // If regular assignment, check for on-call conflict
                else if (onCallAssignment) {
                    violations.push(
                        buildViolation(
                            "on-call-exclusivity",
                            `${employee.name} cannot have time blocks on ${dayOfWeek.toUpperCase()} while on-call`,
                            "StaffAssignment",
                            assignment.id,
                            citationId,
                            "error",
                            { employeeId: employee.id, employeeName: employee.name, dayOfWeek }
                        )
                    );
                }
            });

        return violations;
    }
};

export const oneOnOneStudentNameRule: RuleDefinition = {
    id: "one-on-one-student-name",
    description: "Ensures 1:1 assignments have a student name specified",
    evaluate: (context: RulesContext) => {
        const violations: RuleViolation[] = [];
        const citationId = getCitationId(
            context,
            "one-on-one-student-name",
            DEFAULT_POLICY_CITATIONS["one-on-one-student-name"] || "policy-1on1"
        );

        context.staffAssignments
            .filter((assignment) => assignment.is1on1)
            .filter((assignment) => assignment.status !== "completed")
            .forEach((assignment) => {
                if (!assignment.studentName || assignment.studentName.trim() === "") {
                    const employee = getEmployeeById(context, assignment.employeeId);
                    const dayOfWeek = getDayOfWeekForAssignment(context, assignment);

                    violations.push(
                        buildViolation(
                            "one-on-one-student-name",
                            `${employee?.name ?? "Staff member"} has 1:1 assignment on ${dayOfWeek?.toUpperCase()} without student name`,
                            "StaffAssignment",
                            assignment.id,
                            citationId,
                            "error",
                            { employeeId: employee?.id, dayOfWeek }
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
            DEFAULT_POLICY_CITATIONS[ "field-trip-event" ]
        );
        context.fieldTripEvents.forEach((event) => {
            const scheduleDay =
                getScheduleDayById(context, event.scheduleDayId) ??
                context.scheduleDays.find((day) => day.dayOfWeek === event.dayOfWeek);
            if (scheduleDay && (scheduleDay.scheduleType === "closed" || scheduleDay.dayScheduleType === "closed")) {
                return;
            }

            const noFieldTripSelected = !event.fieldTripTypeId || event.isNoFieldTrip === true;
            if (noFieldTripSelected) {
                return;
            }
            if (!event.fieldTripTypeId) {
                violations.push(
                    buildViolation(
                        "field-trip-event",
                        `Field trip for ${ event.dayOfWeek.toUpperCase() } must reference a field trip type or declare "No Field Trip"`,
                        "FieldTripEvent",
                        event.id,
                        citationId,
                        "error",
                        { missing: [ "fieldTripTypeId", "isNoFieldTrip" ], dayOfWeek: event.dayOfWeek }
                    )
                );
                return;
            }
            const typeExists = context.fieldTripTypes.some((type) => type.id === event.fieldTripTypeId);
            if (!typeExists) {
                violations.push(
                    buildViolation(
                        "field-trip-event",
                        `Field trip for ${ event.dayOfWeek.toUpperCase() } points to an unknown field trip type`,
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
    description: "Applies field trip leader ratios across assignment windows on days with field trips",
    evaluate: (context: RulesContext) => {
        const violations: RuleViolation[] = [];
        context.scheduleDays.forEach((day) => {
            if (day.scheduleType === "closed" || day.dayScheduleType === "closed") {
                return;
            }
            const schoolRules = getSchoolRules(context);
            const event = context.fieldTripEvents.find((candidate) => {
                if (candidate.dayOfWeek !== day.dayOfWeek) {
                    return false;
                }
                if (candidate.scheduleDayId && candidate.scheduleDayId !== day.id) {
                    return false;
                }
                return Boolean(candidate.fieldTripTypeId) && !candidate.isNoFieldTrip;
            });
            const type = event && getFieldTripTypeById(context, event.fieldTripTypeId);
            if (!event || !type || type.leaderRatioStudents <= 0) {
                return;
            }
            const effectiveChildCount = typeof day.enrollmentCount === "number" ? day.enrollmentCount : 0;
            // Field trip ratios: leaderRatioAdults:leaderRatioStudents (e.g., 1:30 ratio)
            const childrenPerLeader = type.leaderRatioStudents / type.leaderRatioAdults;
            const requiredLeaders = Math.max(1, Math.ceil(effectiveChildCount / childrenPerLeader));
            const operatingHours = getOperatingHoursForDay(context, day.dayOfWeek, day.dayScheduleType);
            if (!operatingHours) {
                return;
            }
            const windowStart = parseTimeToMinutes(operatingHours.open);
            const windowEnd = parseTimeToMinutes(operatingHours.close);
            if (windowEnd <= windowStart) {
                return;
            }
            const fieldTripWindowStartRaw = parseTimeToMinutes(schoolRules.fieldTripStartTime);
            const fieldTripWindowEndRaw = parseTimeToMinutes(schoolRules.fieldTripEndTime);
            const fieldTripWindowStart = Math.max(windowStart, fieldTripWindowStartRaw);
            const fieldTripWindowEnd = Math.min(windowEnd, fieldTripWindowEndRaw);
            if (fieldTripWindowEnd <= fieldTripWindowStart) {
                return;
            }
            const dayAssignments = getActiveAssignmentsForDay(context, day.dayOfWeek);
            const leaderCoverage = evaluateMinimumCoverage(
                dayAssignments,
                fieldTripWindowStart,
                fieldTripWindowEnd,
                requiredLeaders,
                (entry) => entry.employee.leaderQualified
            );
            if (leaderCoverage.failingIntervals.length > 0) {
                const firstGap = leaderCoverage.failingIntervals[ 0 ];
                const citationId = getCitationId(context, "field-trip-ratios", type.policyCitationId);
                violations.push(
                    buildViolation(
                        "field-trip-ratios",
                        `Field trip ${ day.dayOfWeek.toUpperCase() } needs ${ requiredLeaders } leaders but only ${ leaderCoverage.minimumActual } assigned`,
                        "ScheduleDay",
                        day.id,
                        citationId,
                        "error",
                        {
                            assignedLeaders: leaderCoverage.minimumActual,
                            requiredLeaders,
                            dayOfWeek: day.dayOfWeek,
                            startTime: formatMinutesAsTime(firstGap.start),
                            endTime: formatMinutesAsTime(firstGap.end)
                        }
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
    employeeAvailabilityRule,
    shiftBreakLimitsRule,
    openCloseCoverageRule,
    medicalDelegatedCoverageRule,
    cprCurrentRequiredRule,
    onCallExclusivityRule,
    oneOnOneStudentNameRule,
    fieldTripEventIntegrityRule,
    fieldTripRatiosRule
];
