import type {
    DayOfWeek,
    Employee,
    FieldTripEvent,
    OperatingHours,
    ScheduleDay,
    SegmentBlock,
    StaffAssignment
} from "../domain/types";
import type { RulesContext, RuleViolation } from "../rules/types";
import { createRulesEngine } from "../rules/engine";

export interface AutoSchedulerContext {
    scheduleDays: ScheduleDay[];
    segmentBlocks: SegmentBlock[];
    staffAssignments: StaffAssignment[];
    employees: Employee[];
    fieldTripEvents: FieldTripEvent[];
    operatingHours: OperatingHours[];
    scheduleTypeRatios?: Record<string, number>;
    schoolRules?: RulesContext[ "schoolRules" ];
    jobTitleRules?: RulesContext[ "jobTitleRules" ];
    fieldTripTypes?: RulesContext[ "fieldTripTypes" ];
    policyCitations?: RulesContext[ "policyCitations" ];
    rulePolicyCitations?: RulesContext[ "rulePolicyCitations" ];
}

export interface MissingMetadata {
    dayOfWeek: DayOfWeek;
    missingFields: string[];
}

export interface AutoSchedulerResult {
    success: boolean;
    staffAssignments: StaffAssignment[];
    segmentBlocks: SegmentBlock[];
    violations: RuleViolation[];
    iterations: number;
    message: string;
}

const MAX_ITERATIONS = 10;

function normalizeChildrenPerStaff(value: number | undefined): number {
    if (!Number.isFinite(value) || !value || value <= 0) {
        return 1;
    }
    return Math.max(1, Math.ceil(value));
}

function getRatioRequiredStaffForDay(
    context: AutoSchedulerContext,
    day: ScheduleDay
): number {
    const enrollmentCount = typeof day.enrollmentCount === "number" ? day.enrollmentCount : 0;
    if (enrollmentCount <= 0) {
        return 0;
    }

    const dayFieldTripEvent = context.fieldTripEvents.find(event => {
        if (event.dayOfWeek !== day.dayOfWeek) return false;
        if (event.scheduleDayId && event.scheduleDayId !== day.id) return false;
        return Boolean(event.fieldTripTypeId) && !event.isNoFieldTrip;
    });
    const fieldTripType = dayFieldTripEvent
        ? context.fieldTripTypes?.find(type => type.id === dayFieldTripEvent.fieldTripTypeId)
        : undefined;
    const fieldTripChildrenPerStaff = fieldTripType && fieldTripType.adultRatioStudents > 0
        ? fieldTripType.adultRatioStudents / fieldTripType.adultRatioAdults
        : undefined;
    const childrenPerStaff = fieldTripChildrenPerStaff
        ?? (day.scheduleType ? context.scheduleTypeRatios?.[ day.scheduleType ] : undefined)
        ?? 1;
    const normalizedChildrenPerStaff = normalizeChildrenPerStaff(childrenPerStaff);
    return Math.max(1, Math.ceil(enrollmentCount / normalizedChildrenPerStaff));
}

/**
 * Validates that all days have required metadata (scheduleType and enrollmentCount)
 */
export function validateDayMetadata(scheduleDays: ScheduleDay[]): MissingMetadata[] {
    const missing: MissingMetadata[] = [];

    for (const day of scheduleDays) {
        const missingFields: string[] = [];

        if (!day.scheduleType) {
            missingFields.push("Schedule Type");
        }

        if (day.enrollmentCount === undefined || day.enrollmentCount === null) {
            missingFields.push("Enrollment Count");
        }

        if (missingFields.length > 0) {
            missing.push({
                dayOfWeek: day.dayOfWeek,
                missingFields
            });
        }
    }

    return missing;
}

/**
 * Generates initial segment blocks and seeds baseline staffing.
 * Seeding order:
 * 1) Required opener count with longest open-start shifts.
 * 2) Required closer count with longest close-ending shifts.
 * 3) Remaining violations are handled by iterative fixing.
 */
function generateInitialAssignments(
    context: AutoSchedulerContext
): { assignments: StaffAssignment[]; segmentBlocks: SegmentBlock[]; } {
    const createdSegmentBlocks: SegmentBlock[] = [];
    const seededAssignments: StaffAssignment[] = [];
    const openedDays: ScheduleDay[] = [];

    // Create segment blocks for each schedule day that needs them
    for (const day of context.scheduleDays) {
        // Skip days without required metadata or closed days
        if (!day.scheduleType || day.enrollmentCount === undefined) {
            continue;
        }
        if (day.scheduleType === "closed" || day.dayScheduleType === "closed") {
            continue;
        }

        // Find operating hours for this day
        const opHours = context.operatingHours.find(
            oh => oh.dayOfWeek === day.dayOfWeek && oh.dayScheduleType === day.dayScheduleType
        ) || context.operatingHours.find(oh => oh.dayOfWeek === day.dayOfWeek);

        if (!opHours || !opHours.open || !opHours.close) {
            continue;
        }

        const openMinutes = timeToMinutes(opHours.open);
        const closeMinutes = timeToMinutes(opHours.close);

        if (closeMinutes <= openMinutes) {
            continue;
        }

        // Create three segment blocks for the day (open, mid, close)
        // Use more reasonable time boundaries
        const totalMinutes = closeMinutes - openMinutes;

        // Round segment boundaries to nearest 15 minutes for cleaner times
        const segmentDuration = Math.floor(totalMinutes / 3);
        const roundToQuarterHour = (minutes: number) => Math.round(minutes / 15) * 15;

        const midStart = roundToQuarterHour(openMinutes + segmentDuration);
        const closeStart = roundToQuarterHour(openMinutes + (2 * segmentDuration));

        const segments: Array<{ start: number; end: number; segment: 'open' | 'mid' | 'close'; }> = [
            { start: openMinutes, end: midStart, segment: 'open' },
            { start: midStart, end: closeStart, segment: 'mid' },
            { start: closeStart, end: closeMinutes, segment: 'close' }
        ];

        for (const seg of segments) {
            const blockId = `auto-block-${ day.dayOfWeek }-${ seg.segment }-${ minutesToTime(seg.start) }`;
            const segmentBlock: SegmentBlock = {
                id: blockId,
                scheduleWeekId: day.scheduleWeekId,
                scheduleDayId: day.id,
                dayOfWeek: day.dayOfWeek,
                segment: seg.segment,
                startTime: minutesToTime(seg.start),
                endTime: minutesToTime(seg.end),
                childCount: day.enrollmentCount,
                status: 'draft'
            };

            createdSegmentBlocks.push(segmentBlock);
        }

        openedDays.push(day);
    }

    const seedingContext: AutoSchedulerContext = {
        ...context,
        segmentBlocks: createdSegmentBlocks
    };

    for (const day of openedDays) {
        const openBlock = createdSegmentBlocks.find(
            block => block.scheduleDayId === day.id && block.segment === "open"
        );
        const closeBlock = createdSegmentBlocks.find(
            block => block.scheduleDayId === day.id && block.segment === "close"
        );
        if (!openBlock || !closeBlock) {
            continue;
        }

        const ratioRequired = getRatioRequiredStaffForDay(context, day);
        const openerCount = Math.max(
            Math.max(0, context.schoolRules?.openerCount ?? 0),
            ratioRequired
        );
        const closerCount = Math.max(
            Math.max(0, context.schoolRules?.closerCount ?? 0),
            ratioRequired
        );
        const minimumMedicalDelegated = Math.max(0, context.schoolRules?.minimumMedicalDelegated ?? 0);
        const requiredMedicalOpeners = Math.min(openerCount, minimumMedicalDelegated);

        for (let i = 0; i < openerCount; i++) {
            const currentMedicalOpeners = seededAssignments
                .filter(assignment => assignment.segmentBlockId === openBlock.id)
                .reduce((count, assignment) => {
                    const employee = context.employees.find(emp => emp.id === assignment.employeeId);
                    return count + (employee?.medicallyDelegated ? 1 : 0);
                }, 0);
            const requireMedDelegated = currentMedicalOpeners < requiredMedicalOpeners;
            const bestOpener = findBestOpeningSeedCandidate(
                seedingContext,
                seededAssignments,
                day,
                openBlock,
                closeBlock,
                requireMedDelegated
            );
            if (!bestOpener) break;
            seededAssignments.push({
                id: `auto-seed-open-${ day.dayOfWeek }-${ i }-${ bestOpener.employee.id }`,
                segmentBlockId: openBlock.id,
                employeeId: bestOpener.employee.id,
                assignmentSource: "template",
                startTime: bestOpener.window.startTime,
                endTime: bestOpener.window.endTime,
                status: "scheduled"
            });
        }

        for (let i = 0; i < closerCount; i++) {
            const bestCloser = findBestClosingSeedCandidate(seedingContext, seededAssignments, day, closeBlock);
            if (!bestCloser) break;
            seededAssignments.push({
                id: `auto-seed-close-${ day.dayOfWeek }-${ i }-${ bestCloser.employee.id }`,
                segmentBlockId: closeBlock.id,
                employeeId: bestCloser.employee.id,
                assignmentSource: "template",
                startTime: bestCloser.window.startTime,
                endTime: bestCloser.window.endTime,
                status: "scheduled"
            });
        }
    }

    return { assignments: seededAssignments, segmentBlocks: createdSegmentBlocks };
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(time: string): number {
    const [ hours, minutes ] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string (HH:MM format)
 */
function minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${ hours.toString().padStart(2, '0') }:${ mins.toString().padStart(2, '0') }`;
}

/**
 * Check if employee is available for the given day and time window
 * Also checks if the employee has requested time off on this date
 */
function isEmployeeAvailable(
    employee: Employee,
    dayOfWeek: DayOfWeek,
    startTime: string,
    endTime: string,
    date?: string
): boolean {
    // Check employment status
    if (employee.employmentStatus !== 'active') {
        return false;
    }

    // Check if employee has requested time off for this date
    if (date && employee.requestedDaysOff && employee.requestedDaysOff.length > 0) {
        for (const timeOff of employee.requestedDaysOff) {
            // Check if the date falls within the time off request
            if (date >= timeOff.startDate && date <= timeOff.endDate) {
                return false; // Employee has requested time off on this day
            }
        }
    }

    // Check availability windows
    if (!employee.availability || employee.availability.length === 0) {
        return true; // No restrictions means available
    }

    const dayAvailability = employee.availability.find(a => a.dayOfWeek === dayOfWeek);
    if (!dayAvailability || dayAvailability.blocks.length === 0) {
        return false; // Not available on this day
    }

    // Check if the requested time falls within any availability block
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    for (const block of dayAvailability.blocks) {
        const blockStart = timeToMinutes(block.startTime);
        const blockEnd = timeToMinutes(block.endTime);

        if (startMinutes >= blockStart && endMinutes <= blockEnd) {
            return true;
        }
    }

    return false;
}

/**
 * Calculate hours already assigned to an employee on a specific day
 */
function getEmployeeHoursOnDay(
    assignments: StaffAssignment[],
    employeeId: string,
    dayOfWeek: DayOfWeek,
    segmentBlocks: SegmentBlock[]
): number {
    let totalHours = 0;

    for (const assignment of assignments) {
        if (assignment.employeeId !== employeeId) continue;

        const block = segmentBlocks.find(b => b.id === assignment.segmentBlockId);
        if (!block || block.dayOfWeek !== dayOfWeek) continue;

        const startMinutes = timeToMinutes(assignment.startTime);
        const endMinutes = timeToMinutes(assignment.endTime);
        totalHours += (endMinutes - startMinutes) / 60;
    }

    return totalHours;
}

function getEmployeeHoursOnWeek(
    assignments: StaffAssignment[],
    employeeId: string
): number {
    let totalHours = 0;
    for (const assignment of assignments) {
        if (assignment.employeeId !== employeeId) continue;
        const startMinutes = timeToMinutes(assignment.startTime);
        const endMinutes = timeToMinutes(assignment.endTime);
        totalHours += (endMinutes - startMinutes) / 60;
    }
    return totalHours;
}

function getOperatingHoursForBlock(
    context: AutoSchedulerContext,
    block: SegmentBlock
): OperatingHours | undefined {
    const scheduleDay = context.scheduleDays.find(d => d.id === block.scheduleDayId);
    return context.operatingHours.find(
        oh => oh.dayOfWeek === block.dayOfWeek && oh.dayScheduleType === scheduleDay?.dayScheduleType
    ) || context.operatingHours.find(oh => oh.dayOfWeek === block.dayOfWeek);
}

function hasOverlappingAssignment(
    assignments: StaffAssignment[],
    employeeId: string,
    dayOfWeek: DayOfWeek,
    proposedStartTime: string,
    proposedEndTime: string,
    segmentBlocks: SegmentBlock[]
): boolean {
    const proposedStart = timeToMinutes(proposedStartTime);
    const proposedEnd = timeToMinutes(proposedEndTime);
    if (proposedEnd <= proposedStart) return true;

    return assignments.some(assignment => {
        if (assignment.employeeId !== employeeId) return false;
        const assignmentBlock = segmentBlocks.find(b => b.id === assignment.segmentBlockId);
        if (!assignmentBlock || assignmentBlock.dayOfWeek !== dayOfWeek) return false;
        const existingStart = timeToMinutes(assignment.startTime);
        const existingEnd = timeToMinutes(assignment.endTime);
        return proposedStart < existingEnd && proposedEnd > existingStart;
    });
}

function getPreferredAssignmentWindow(
    context: AutoSchedulerContext,
    assignments: StaffAssignment[],
    employee: Employee,
    block: SegmentBlock
): { startTime: string; endTime: string; } | null {
    const startMinutes = timeToMinutes(block.startTime);
    const blockEndMinutes = timeToMinutes(block.endTime);
    const operatingHours = getOperatingHoursForBlock(context, block);
    const closeMinutes = operatingHours ? timeToMinutes(operatingHours.close) : blockEndMinutes;

    const hoursOnDay = getEmployeeHoursOnDay(assignments, employee.id, block.dayOfWeek, context.segmentBlocks);
    const hoursOnWeek = getEmployeeHoursOnWeek(assignments, employee.id);
    const remainingDayMinutes = Math.floor((employee.maxHoursPerDay - hoursOnDay) * 60);
    const remainingWeekMinutes = Math.floor((employee.maxHoursPerWeek - hoursOnWeek) * 60);
    const remainingMinutes = Math.min(remainingDayMinutes, remainingWeekMinutes);
    if (remainingMinutes <= 0) {
        return null;
    }

    let maxEndMinutes = Math.min(closeMinutes, startMinutes + remainingMinutes);
    if (employee.availability && employee.availability.length > 0) {
        const dayAvailability = employee.availability.find(a => a.dayOfWeek === block.dayOfWeek);
        const availabilityBlock = dayAvailability?.blocks.find(window => {
            const windowStart = timeToMinutes(window.startTime);
            const windowEnd = timeToMinutes(window.endTime);
            return startMinutes >= windowStart && startMinutes < windowEnd;
        });
        if (!availabilityBlock) {
            return null;
        }
        maxEndMinutes = Math.min(maxEndMinutes, timeToMinutes(availabilityBlock.endTime));
    }

    const hasScheduleOnDay = assignments.some(assignment => {
        if (assignment.employeeId !== employee.id) return false;
        const assignmentBlock = context.segmentBlocks.find(b => b.id === assignment.segmentBlockId);
        return assignmentBlock?.dayOfWeek === block.dayOfWeek;
    });

    const preferredEndMinutes = hasScheduleOnDay ? Math.min(blockEndMinutes, maxEndMinutes) : maxEndMinutes;
    if (preferredEndMinutes <= startMinutes || preferredEndMinutes < blockEndMinutes) {
        return null;
    }

    const startTime = minutesToTime(startMinutes);
    const endTime = minutesToTime(preferredEndMinutes);
    if (hasOverlappingAssignment(assignments, employee.id, block.dayOfWeek, startTime, endTime, context.segmentBlocks)) {
        return null;
    }

    return { startTime, endTime };
}

function getPreferredClosingAssignmentWindow(
    context: AutoSchedulerContext,
    assignments: StaffAssignment[],
    employee: Employee,
    block: SegmentBlock
): { startTime: string; endTime: string; } | null {
    const operatingHours = getOperatingHoursForBlock(context, block);
    const closeMinutes = operatingHours ? timeToMinutes(operatingHours.close) : timeToMinutes(block.endTime);
    const openMinutes = operatingHours ? timeToMinutes(operatingHours.open) : timeToMinutes(block.startTime);
    const blockStartMinutes = timeToMinutes(block.startTime);

    const hoursOnDay = getEmployeeHoursOnDay(assignments, employee.id, block.dayOfWeek, context.segmentBlocks);
    const hoursOnWeek = getEmployeeHoursOnWeek(assignments, employee.id);
    const remainingDayMinutes = Math.floor((employee.maxHoursPerDay - hoursOnDay) * 60);
    const remainingWeekMinutes = Math.floor((employee.maxHoursPerWeek - hoursOnWeek) * 60);
    const remainingMinutes = Math.min(remainingDayMinutes, remainingWeekMinutes);
    if (remainingMinutes <= 0) {
        return null;
    }

    let preferredStartMinutes = Math.max(openMinutes, closeMinutes - remainingMinutes);
    if (employee.availability && employee.availability.length > 0) {
        const dayAvailability = employee.availability.find(a => a.dayOfWeek === block.dayOfWeek);
        const candidateWindows = (dayAvailability?.blocks ?? [])
            .map(window => ({
                start: timeToMinutes(window.startTime),
                end: timeToMinutes(window.endTime)
            }))
            .filter(window => closeMinutes <= window.end && closeMinutes > window.start);
        if (candidateWindows.length === 0) {
            return null;
        }
        preferredStartMinutes = Math.min(
            ...candidateWindows.map(window => Math.max(preferredStartMinutes, window.start))
        );
    }

    if (preferredStartMinutes > blockStartMinutes || preferredStartMinutes >= closeMinutes) {
        return null;
    }

    const startTime = minutesToTime(preferredStartMinutes);
    const endTime = minutesToTime(closeMinutes);
    if (hasOverlappingAssignment(assignments, employee.id, block.dayOfWeek, startTime, endTime, context.segmentBlocks)) {
        return null;
    }
    return { startTime, endTime };
}

function getCandidateScore(employee: Employee): number {
    return (employee.leaderQualified ? 2 : 0) + (employee.medicallyDelegated ? 1 : 0) + (employee.cprCurrent ? 1 : 0);
}

function findBestOpeningSeedCandidate(
    context: AutoSchedulerContext,
    assignments: StaffAssignment[],
    day: ScheduleDay,
    openBlock: SegmentBlock,
    closeBlock: SegmentBlock,
    requireMedDelegated: boolean
): { employee: Employee; window: { startTime: string; endTime: string; }; duration: number; } | null {
    const candidates = context.employees
        .filter(emp => emp.employmentStatus === "active")
        .filter(emp => isEmployeeAvailable(emp, day.dayOfWeek, openBlock.startTime, openBlock.endTime, day.date))
        .map(employee => {
            const window = getPreferredAssignmentWindow(context, assignments, employee, openBlock);
            if (!window) return null;
            const canCoverClose = isEmployeeAvailable(
                employee,
                day.dayOfWeek,
                closeBlock.startTime,
                closeBlock.endTime,
                day.date
            );
            return {
                employee,
                window,
                duration: timeToMinutes(window.endTime) - timeToMinutes(window.startTime),
                openOnlyConstrained: !canCoverClose
            };
        })
        .filter((candidate): candidate is {
            employee: Employee;
            window: { startTime: string; endTime: string; };
            duration: number;
            openOnlyConstrained: boolean;
        } => Boolean(candidate))
        .sort((a, b) => {
            if (requireMedDelegated) {
                const aMed = a.employee.medicallyDelegated ? 1 : 0;
                const bMed = b.employee.medicallyDelegated ? 1 : 0;
                if (bMed !== aMed) {
                    return bMed - aMed;
                }
            }
            const aConstrained = a.openOnlyConstrained ? 1 : 0;
            const bConstrained = b.openOnlyConstrained ? 1 : 0;
            if (bConstrained !== aConstrained) {
                return bConstrained - aConstrained;
            }
            if (b.duration !== a.duration) {
                return b.duration - a.duration;
            }
            return getCandidateScore(b.employee) - getCandidateScore(a.employee);
        });
    return candidates[ 0 ] ?? null;
}

function findBestClosingSeedCandidate(
    context: AutoSchedulerContext,
    assignments: StaffAssignment[],
    day: ScheduleDay,
    closeBlock: SegmentBlock
): { employee: Employee; window: { startTime: string; endTime: string; }; duration: number; } | null {
    const candidates = context.employees
        .filter(emp => emp.employmentStatus === "active")
        .filter(emp => isEmployeeAvailable(emp, day.dayOfWeek, closeBlock.startTime, closeBlock.endTime, day.date))
        .map(employee => {
            const window = getPreferredClosingAssignmentWindow(context, assignments, employee, closeBlock);
            if (!window) return null;
            return {
                employee,
                window,
                duration: timeToMinutes(window.endTime) - timeToMinutes(window.startTime)
            };
        })
        .filter((candidate): candidate is { employee: Employee; window: { startTime: string; endTime: string; }; duration: number; } => Boolean(candidate))
        .sort((a, b) => {
            if (b.duration !== a.duration) {
                return b.duration - a.duration;
            }
            return getCandidateScore(b.employee) - getCandidateScore(a.employee);
        });
    return candidates[ 0 ] ?? null;
}

/**
 * Try to extend an employee's shift to adjacent blocks on the same day
 * This helps schedule people for as many hours as possible
 * Currently disabled to avoid complications with rules engine evaluation
 */
/* function tryExtendShift(
  employee: Employee,
  block: SegmentBlock,
  context: AutoSchedulerContext,
  assignments: StaffAssignment[]
): { startTime: string; endTime: string } {
  // Find all blocks on the same day
  const dayBlocks = context.segmentBlocks
    .filter(b => b.dayOfWeek === block.dayOfWeek && b.scheduleDayId === block.scheduleDayId)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  
  const blockIndex = dayBlocks.findIndex(b => b.id === block.id);
  if (blockIndex === -1) {
    return { startTime: block.startTime, endTime: block.endTime };
  }
  
  // Find schedule day for date checking
  const scheduleDay = context.scheduleDays.find(d => d.id === block.scheduleDayId);
  const blockDate = scheduleDay?.date;
  
  // Try to find contiguous blocks before and after
  let earliestBlock = block;
  let latestBlock = block;
  
  // Look backward for adjacent blocks
  for (let i = blockIndex - 1; i >= 0; i--) {
    const prevBlock = dayBlocks[i];
    if (prevBlock.endTime !== earliestBlock.startTime) break;
    
    // Check if employee is available for this block
    if (!isEmployeeAvailable(employee, prevBlock.dayOfWeek, prevBlock.startTime, prevBlock.endTime, blockDate)) {
      break;
    }
    
    // Check if extending would exceed max hours per day
    const currentHours = getEmployeeHoursOnDay(assignments, employee.id, block.dayOfWeek, context.segmentBlocks);
    const extendedDuration = (timeToMinutes(latestBlock.endTime) - timeToMinutes(prevBlock.startTime)) / 60;
    if (currentHours + extendedDuration > employee.maxHoursPerDay) {
      break;
    }
    
    // Check if someone else is already assigned to this block
    const alreadyAssigned = assignments.some(a => 
      a.segmentBlockId === prevBlock.id && a.employeeId === employee.id
    );
    if (alreadyAssigned) break;
    
    earliestBlock = prevBlock;
  }
  
  // Look forward for adjacent blocks
  for (let i = blockIndex + 1; i < dayBlocks.length; i++) {
    const nextBlock = dayBlocks[i];
    if (nextBlock.startTime !== latestBlock.endTime) break;
    
    // Check if employee is available for this block
    if (!isEmployeeAvailable(employee, nextBlock.dayOfWeek, nextBlock.startTime, nextBlock.endTime, blockDate)) {
      break;
    }
    
    // Check if extending would exceed max hours per day
    const currentHours = getEmployeeHoursOnDay(assignments, employee.id, block.dayOfWeek, context.segmentBlocks);
    const extendedDuration = (timeToMinutes(nextBlock.endTime) - timeToMinutes(earliestBlock.startTime)) / 60;
    if (currentHours + extendedDuration > employee.maxHoursPerDay) {
      break;
    }
    
    // Check if someone else is already assigned to this block
    const alreadyAssigned = assignments.some(a => 
      a.segmentBlockId === nextBlock.id && a.employeeId === employee.id
    );
    if (alreadyAssigned) break;
    
    latestBlock = nextBlock;
  }
  
  return { startTime: earliestBlock.startTime, endTime: latestBlock.endTime };
}
*/

/**
 * Merge consecutive assignments for the same employee on the same day
 * If a person has two shifts that are immediately adjacent, merge them into one
 */
function mergeConsecutiveAssignments(
    assignments: StaffAssignment[],
    segmentBlocks: SegmentBlock[]
): StaffAssignment[] {
    const merged: StaffAssignment[] = [];
    const processed = new Set<string>();

    // Group assignments by employee
    const byEmployee = new Map<string, StaffAssignment[]>();
    for (const assignment of assignments) {
        if (!byEmployee.has(assignment.employeeId)) {
            byEmployee.set(assignment.employeeId, []);
        }
        byEmployee.get(assignment.employeeId)!.push(assignment);
    }

    // Process each employee's assignments
    for (const [ , empAssignments ] of byEmployee) {
        // Group by day
        const byDay = new Map<string, StaffAssignment[]>();
        for (const assignment of empAssignments) {
            const block = segmentBlocks.find(b => b.id === assignment.segmentBlockId);
            if (!block) {
                // If block not found, keep assignment as-is
                merged.push(assignment);
                processed.add(assignment.id);
                continue;
            }

            const key = `${ block.dayOfWeek }`;
            if (!byDay.has(key)) {
                byDay.set(key, []);
            }
            byDay.get(key)!.push(assignment);
        }

        // Merge consecutive assignments on each day
        for (const [ , dayAssignments ] of byDay) {
            // Sort by start time
            const sorted = dayAssignments.sort((a, b) =>
                timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
            );

            let i = 0;
            while (i < sorted.length) {
                if (processed.has(sorted[ i ].id)) {
                    i++;
                    continue;
                }

                const current = sorted[ i ];
                let endTime = current.endTime;
                const mergedIds = [ current.id ];

                // Look for consecutive assignments
                let j = i + 1;
                while (j < sorted.length) {
                    const next = sorted[ j ];
                    if (processed.has(next.id)) {
                        j++;
                        continue;
                    }

                    // Check if next assignment starts exactly when current ends
                    if (next.startTime === endTime) {
                        endTime = next.endTime;
                        mergedIds.push(next.id);
                        processed.add(next.id);
                        j++;
                    } else {
                        break;
                    }
                }

                // Create merged assignment
                if (mergedIds.length > 1) {
                    // Multiple assignments merged
                    merged.push({
                        ...current,
                        endTime,
                        id: `merged-${ mergedIds.join('-') }`
                    });
                } else {
                    // Single assignment, keep as-is
                    merged.push(current);
                }

                processed.add(current.id);
                i++;
            }
        }
    }

    return merged;
}

/**
 * Attempt to fix violations by working through them one by one
 * This is the new violation-based approach
 */
function attemptViolationFixes(
    context: AutoSchedulerContext,
    assignments: StaffAssignment[],
    violations: RuleViolation[]
): StaffAssignment[] {
    let updatedAssignments = [ ...assignments ];

    // Process ratio violations first as they're most critical
    const ratioViolations = violations.filter(v => v.ruleId === 'ratio-segment');

    for (const violation of ratioViolations) {
        if (violation.target.entity !== 'ScheduleDay') continue;

        const metadata = violation.target.metadata;
        if (!metadata) continue;

        const required = metadata.required as number;
        const actual = metadata.actual as number;
        const relatedBlockIds = (metadata.relatedSegmentBlockIds as string[]) || [];

        const needed = required - actual;
        if (needed <= 0) continue;

        // Instead of trying to assign for the full violation period,
        // work with the related segment blocks and assign staff to those
        const relatedBlocks = relatedBlockIds
            .map(id => context.segmentBlocks.find(b => b.id === id))
            .filter((b): b is SegmentBlock => Boolean(b));

        for (const block of relatedBlocks) {
            // Find the schedule day for this block to get the date
            const scheduleDay = context.scheduleDays.find(d => d.id === block.scheduleDayId);
            const blockDate = scheduleDay?.date;

            // Find employees who could work this specific block
            const availableEmployees = context.employees
                .filter(emp => emp.employmentStatus === 'active')
                .filter(emp => isEmployeeAvailable(emp, block.dayOfWeek, block.startTime, block.endTime, blockDate))
                .filter(emp => {
                    const hoursOnDay = getEmployeeHoursOnDay(updatedAssignments, emp.id, block.dayOfWeek, context.segmentBlocks);
                    const shiftDuration = (timeToMinutes(block.endTime) - timeToMinutes(block.startTime)) / 60;
                    return hoursOnDay + shiftDuration <= emp.maxHoursPerDay;
                })
                .filter(emp => {
                    // Check if this employee is already assigned to this block
                    return !updatedAssignments.some(a =>
                        a.segmentBlockId === block.id && a.employeeId === emp.id
                    );
                })
                .filter(emp => {
                    return !hasOverlappingAssignment(
                        updatedAssignments,
                        emp.id,
                        block.dayOfWeek,
                        block.startTime,
                        block.endTime,
                        context.segmentBlocks
                    );
                });

            // Sort by qualifications (prefer leaders and medically delegated)
            availableEmployees.sort((a, b) => {
                const aScore = (a.leaderQualified ? 2 : 0) + (a.medicallyDelegated ? 1 : 0) + (a.cprCurrent ? 1 : 0);
                const bScore = (b.leaderQualified ? 2 : 0) + (b.medicallyDelegated ? 1 : 0) + (b.cprCurrent ? 1 : 0);
                return bScore - aScore;
            });

            // Add staff to this block (we'll add multiple iterations to gradually fill)
            // Try to add multiple staff members per iteration to speed up scheduling
            let staffAdded = 0;
            const maxStaffPerBlock = Math.max(2, needed); // Add at least what's needed

            for (const employee of availableEmployees) {
                if (staffAdded >= maxStaffPerBlock) break;

                const window = getPreferredAssignmentWindow(context, updatedAssignments, employee, block);
                if (!window) continue;

                const assignmentId = `auto-assign-${ block.id }-${ employee.id }-${ Date.now() }-${ staffAdded }`;
                updatedAssignments.push({
                    id: assignmentId,
                    segmentBlockId: block.id,
                    employeeId: employee.id,
                    assignmentSource: 'template',
                    startTime: window.startTime,
                    endTime: window.endTime,
                    status: 'scheduled'
                });
                staffAdded++;
            }
        }
    }

    // Process open-close-coverage violations
    const openCloseViolations = violations.filter(v => v.ruleId === 'open-close-coverage');

    for (const violation of openCloseViolations) {
        if (violation.target.entity !== 'SegmentBlock') continue;

        const block = context.segmentBlocks.find(b => b.id === violation.target.id);
        if (!block) continue;

        // Check if we need a leader
        const blockAssignments = updatedAssignments.filter(a => a.segmentBlockId === block.id);
        const hasLeader = blockAssignments.some(a => {
            const emp = context.employees.find(e => e.id === a.employeeId);
            return emp?.leaderQualified;
        });

        if (!hasLeader) {
            // Find the schedule day for this block to get the date
            const scheduleDay = context.scheduleDays.find(d => d.id === block.scheduleDayId);
            const blockDate = scheduleDay?.date;

            // Find a leader who can work this block
            const availableLeaders = context.employees
                .filter(emp => emp.leaderQualified && emp.employmentStatus === 'active')
                .filter(emp => isEmployeeAvailable(emp, block.dayOfWeek, block.startTime, block.endTime, blockDate))
                .filter(emp => {
                    const hoursOnDay = getEmployeeHoursOnDay(updatedAssignments, emp.id, block.dayOfWeek, context.segmentBlocks);
                    const shiftDuration = (timeToMinutes(block.endTime) - timeToMinutes(block.startTime)) / 60;
                    return hoursOnDay + shiftDuration <= emp.maxHoursPerDay;
                })
                .filter(emp => !blockAssignments.some(a => a.employeeId === emp.id))
                .filter(emp => !hasOverlappingAssignment(
                    updatedAssignments,
                    emp.id,
                    block.dayOfWeek,
                    block.startTime,
                    block.endTime,
                    context.segmentBlocks
                ));

            if (availableLeaders.length > 0) {
                const leader = availableLeaders[ 0 ];
                const window = getPreferredAssignmentWindow(context, updatedAssignments, leader, block);
                if (!window) {
                    continue;
                }
                const assignmentId = `auto-leader-${ block.id }-${ leader.id }`;
                updatedAssignments.push({
                    id: assignmentId,
                    segmentBlockId: block.id,
                    employeeId: leader.id,
                    assignmentSource: 'template',
                    startTime: window.startTime,
                    endTime: window.endTime,
                    status: 'scheduled'
                });
            }
        }
    }

    // Process medical-delegated-coverage violations
    const medicalViolations = violations.filter(v => v.ruleId === 'medical-delegated-coverage');

    for (const violation of medicalViolations) {
        if (violation.target.entity !== 'SegmentBlock') continue;

        const block = context.segmentBlocks.find(b => b.id === violation.target.id);
        if (!block) continue;

        const blockAssignments = updatedAssignments.filter(a => a.segmentBlockId === block.id);
        const medicallyDelegatedCount = blockAssignments.filter(a => {
            const emp = context.employees.find(e => e.id === a.employeeId);
            return emp?.medicallyDelegated;
        }).length;

        const metadata = violation.target.metadata;
        const required = (metadata?.required as number) || 1;
        const needed = required - medicallyDelegatedCount;

        if (needed > 0) {
            // Find the schedule day for this block to get the date
            const scheduleDay = context.scheduleDays.find(d => d.id === block.scheduleDayId);
            const blockDate = scheduleDay?.date;

            const availableMedical = context.employees
                .filter(emp => emp.medicallyDelegated && emp.employmentStatus === 'active')
                .filter(emp => isEmployeeAvailable(emp, block.dayOfWeek, block.startTime, block.endTime, blockDate))
                .filter(emp => {
                    const hoursOnDay = getEmployeeHoursOnDay(updatedAssignments, emp.id, block.dayOfWeek, context.segmentBlocks);
                    const shiftDuration = (timeToMinutes(block.endTime) - timeToMinutes(block.startTime)) / 60;
                    return hoursOnDay + shiftDuration <= emp.maxHoursPerDay;
                })
                .filter(emp => !blockAssignments.some(a => a.employeeId === emp.id))
                .filter(emp => !hasOverlappingAssignment(
                    updatedAssignments,
                    emp.id,
                    block.dayOfWeek,
                    block.startTime,
                    block.endTime,
                    context.segmentBlocks
                ));

            let added = 0;
            for (const emp of availableMedical) {
                if (added >= needed) break;
                const window = getPreferredAssignmentWindow(context, updatedAssignments, emp, block);
                if (!window) continue;

                const assignmentId = `auto-medical-${ block.id }-${ emp.id }`;
                updatedAssignments.push({
                    id: assignmentId,
                    segmentBlockId: block.id,
                    employeeId: emp.id,
                    assignmentSource: 'template',
                    startTime: window.startTime,
                    endTime: window.endTime,
                    status: 'scheduled'
                });
                added++;
            }
        }
    }

    // Process CPR violations - replace non-CPR staff
    const cprViolations = violations.filter(v => v.ruleId === 'cpr-current-required');

    for (const violation of cprViolations) {
        if (violation.target.entity !== 'StaffAssignment') continue;

        const assignment = updatedAssignments.find(a => a.id === violation.target.id);
        if (!assignment) continue;

        const employee = context.employees.find(e => e.id === assignment.employeeId);
        if (!employee || employee.cprCurrent) continue;

        const block = context.segmentBlocks.find(b => b.id === assignment.segmentBlockId);
        if (!block) continue;

        // Find CPR-current replacement
        const cprStaff = context.employees
            .filter(emp => emp.cprCurrent && emp.employmentStatus === 'active')
            .filter(emp => {
                // Find the schedule day for this block to get the date
                const scheduleDay = context.scheduleDays.find(d => d.id === block.scheduleDayId);
                const blockDate = scheduleDay?.date;
                return isEmployeeAvailable(emp, block.dayOfWeek, block.startTime, block.endTime, blockDate);
            })
            .filter(emp => {
                const hoursOnDay = getEmployeeHoursOnDay(updatedAssignments, emp.id, block.dayOfWeek, context.segmentBlocks);
                const shiftDuration = (timeToMinutes(block.endTime) - timeToMinutes(block.startTime)) / 60;
                return hoursOnDay + shiftDuration <= emp.maxHoursPerDay;
            })
            .filter(emp => !updatedAssignments.some(a =>
                a.segmentBlockId === block.id && a.employeeId === emp.id
            ))
            .filter(emp => !hasOverlappingAssignment(
                updatedAssignments,
                emp.id,
                block.dayOfWeek,
                block.startTime,
                block.endTime,
                context.segmentBlocks
            ));

        if (cprStaff.length > 0) {
            // Remove the non-CPR assignment
            updatedAssignments = updatedAssignments.filter(a => a.id !== assignment.id);

            // Add the CPR-current replacement
            const replacement = cprStaff[ 0 ];
            const window = getPreferredAssignmentWindow(context, updatedAssignments, replacement, block);
            if (!window) {
                continue;
            }
            const assignmentId = `auto-cpr-${ block.id }-${ replacement.id }`;
            updatedAssignments.push({
                id: assignmentId,
                segmentBlockId: block.id,
                employeeId: replacement.id,
                assignmentSource: 'template',
                startTime: window.startTime,
                endTime: window.endTime,
                status: 'scheduled'
            });
        }
    }

    return updatedAssignments;
}

/**
 * Main auto-scheduler function
 * 
 * New approach: Work through violations one by one instead of person-by-day scheduling
 * 
 * @param context - The scheduling context including existing assignments and segment blocks
 * @param _weekId - The week identifier (currently unused)
 * @param startFromEmpty - If true, starts with empty assignments; if false, starts with existing assignments from context
 * @returns Result containing the final assignments, segment blocks, violations, and metadata
 */
export function autoSchedule(
    context: AutoSchedulerContext,
    _weekId: string,
    startFromEmpty: boolean = true
): AutoSchedulerResult {
    const engine = createRulesEngine();

    // Determine starting point based on startFromEmpty parameter
    let currentAssignments: StaffAssignment[];
    let allSegmentBlocks: SegmentBlock[];

    if (startFromEmpty) {
        // Start fresh - generate initial segment blocks and ignore existing ones
        const initialResult = generateInitialAssignments(context);
        currentAssignments = initialResult.assignments;
        allSegmentBlocks = initialResult.segmentBlocks; // Use ONLY newly generated blocks
    } else {
        // Start with existing schedule and work through violations
        currentAssignments = [ ...context.staffAssignments ];
        allSegmentBlocks = [ ...context.segmentBlocks ];
    }

    let iterations = 0;
    let violations: RuleViolation[] = [];

    // Work through violations iteratively
    while (iterations < MAX_ITERATIONS) {
        iterations++;

        // Evaluate current state
        const rulesContext: RulesContext = {
            scheduleDays: context.scheduleDays,
            segmentBlocks: allSegmentBlocks,
            staffAssignments: currentAssignments,
            employees: context.employees,
            fieldTripEvents: context.fieldTripEvents,
            fieldTripTypes: context.fieldTripTypes ?? [],
            operatingHours: context.operatingHours,
            scheduleTypeRatios: context.scheduleTypeRatios,
            schoolRules: context.schoolRules,
            jobTitleRules: context.jobTitleRules,
            policyCitations: context.policyCitations,
            rulePolicyCitations: context.rulePolicyCitations
        };

        violations = engine.evaluate(rulesContext);

        // If no violations, we're done
        if (violations.length === 0) {
            // Final merge before returning success
            currentAssignments = mergeConsecutiveAssignments(currentAssignments, allSegmentBlocks);

            return {
                success: true,
                staffAssignments: currentAssignments,
                segmentBlocks: allSegmentBlocks,
                violations: [],
                iterations,
                message: startFromEmpty
                    ? `Successfully auto-scheduled staff with no violations in ${ iterations } iteration(s).`
                    : `Successfully resolved all violations in ${ iterations } iteration(s).`
            };
        }

        // Try to fix violations one by one
        // const previousAssignmentCount = currentAssignments.length;
        // const previousBlockCount = allSegmentBlocks.length;

        // Create a mutable context for attemptViolationFixes to modify
        const mutableContext = {
            ...context,
            segmentBlocks: allSegmentBlocks,
            staffAssignments: currentAssignments
        };

        currentAssignments = attemptViolationFixes(
            mutableContext,
            currentAssignments,
            violations
        );

        // Update segment blocks in case new ones were created
        allSegmentBlocks = mutableContext.segmentBlocks;

        // Merge consecutive assignments for the same employee
        currentAssignments = mergeConsecutiveAssignments(currentAssignments, allSegmentBlocks);

        // If no changes were made, we can't fix any more violations
        // if (currentAssignments.length === previousAssignmentCount && 
        //     allSegmentBlocks.length === previousBlockCount) {
        //   break;
        // }
    }

    // Final merge of consecutive assignments before returning
    currentAssignments = mergeConsecutiveAssignments(currentAssignments, allSegmentBlocks);

    // Reached max iterations or couldn't fix violations
    return {
        success: false,
        staffAssignments: currentAssignments,
        segmentBlocks: allSegmentBlocks,
        violations,
        iterations,
        message: violations.length > 0
            ? `Auto-scheduling incomplete: ${ violations.length } violation(s) remain after ${ iterations } iteration(s).`
            : `Auto-scheduling completed successfully in ${ iterations } iteration(s).`
    };
}
