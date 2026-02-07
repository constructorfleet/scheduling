import type {
  DayOfWeek,
  DaySegment,
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
  employees: Employee[];
  fieldTripEvents: FieldTripEvent[];
  operatingHours: OperatingHours[];
  scheduleTypeRatios?: Record<string, number>;
  schoolRules?: RulesContext["schoolRules"];
  jobTitleRules?: RulesContext["jobTitleRules"];
  fieldTripTypes?: RulesContext["fieldTripTypes"];
  policyCitations?: RulesContext["policyCitations"];
  rulePolicyCitations?: RulesContext["rulePolicyCitations"];
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
 * Generates initial staff assignments based on availability and operating hours
 */
function generateInitialAssignments(
  context: AutoSchedulerContext
): { assignments: StaffAssignment[]; segmentBlocks: SegmentBlock[] } {
  const assignments: StaffAssignment[] = [];
  const createdSegmentBlocks: SegmentBlock[] = [];
  const availableEmployees = context.employees.filter(emp => emp.employmentStatus === 'active');

  // Sort employees by leader qualification (leaders first for better coverage)
  const sortedEmployees = [...availableEmployees].sort((a, b) => {
    if (a.leaderQualified && !b.leaderQualified) return -1;
    if (!a.leaderQualified && b.leaderQualified) return 1;
    return 0;
  });

  // Process each schedule day
  for (const day of context.scheduleDays) {
    // Skip days without required metadata
    if (!day.scheduleType || day.enrollmentCount === undefined) {
      continue;
    }

    // Find operating hours for this day (prefer exact match, fallback to any hours for this day)
    const opHours = context.operatingHours.find(
      oh => oh.dayOfWeek === day.dayOfWeek && oh.dayScheduleType === day.dayScheduleType
    );
    
    const effectiveOpHours = opHours || context.operatingHours.find(oh => oh.dayOfWeek === day.dayOfWeek);
    
    if (!effectiveOpHours) {
      continue; // Skip days without operating hours
    }

    const openTime = effectiveOpHours.open;
    const closeTime = effectiveOpHours.close;

    if (!openTime || !closeTime) {
      continue; // Skip if we can't determine operating hours
    }

    // Track hours assigned per employee for this day
    const employeeHoursToday = new Map<string, number>();

    // Schedule employees starting from opening time, one at a time
    for (const employee of sortedEmployees) {
      const currentHours = employeeHoursToday.get(employee.id) || 0;
      
      // Check if employee has reached max hours for the day
      if (currentHours >= employee.maxHoursPerDay) {
        continue;
      }

      // Check if employee is available on this day
      const dayAvailability = employee.availability?.find(a => a.dayOfWeek === day.dayOfWeek);
      
      // If employee has defined availability but none for this day, skip
      if (employee.availability && employee.availability.length > 0 && !dayAvailability) {
        continue; // Employee explicitly not available on this day
      }
      
      // If no availability restrictions at all, assume available during all operating hours
      if (!employee.availability || employee.availability.length === 0) {
        const remainingHours = employee.maxHoursPerDay - currentHours;
        if (remainingHours > 0) {
          // Schedule for remaining hours or until close, whichever is less
          const openMinutes = timeToMinutes(openTime);
          const closeMinutes = timeToMinutes(closeTime);
          const currentStartMinutes = openMinutes + (currentHours * 60);
          
          if (currentStartMinutes >= closeMinutes) {
            continue; // Can't schedule beyond closing time
          }
          
          const endMinutes = Math.min(
            currentStartMinutes + (remainingHours * 60),
            closeMinutes
          );
          const startTime = minutesToTime(currentStartMinutes);
          const endTime = minutesToTime(endMinutes);
          const actualHours = (endMinutes - currentStartMinutes) / 60;
          
          if (actualHours > 0) {
            const blockId = `auto-block-${day.dayOfWeek}-${employee.id}-${startTime}-${endTime}`;
            const segmentBlock: SegmentBlock = {
              id: blockId,
              scheduleWeekId: day.scheduleWeekId,
              scheduleDayId: day.id,
              dayOfWeek: day.dayOfWeek,
              segment: determineSegment(startTime, openTime, closeTime),
              startTime: startTime,
              endTime: endTime,
              childCount: day.enrollmentCount,
              status: 'draft'
            };
            
            createdSegmentBlocks.push(segmentBlock);
            assignments.push({
              id: `auto-${blockId}-${employee.id}`,
              segmentBlockId: blockId,
              employeeId: employee.id,
              assignmentSource: 'template',
              startTime: startTime,
              endTime: endTime,
              status: 'scheduled'
            });
            
            employeeHoursToday.set(employee.id, currentHours + actualHours);
          }
        }
        continue;
      }

      // Employee has specific availability windows for this day
      // TypeScript needs explicit null check even though dayAvailability is guaranteed above
      if (!dayAvailability?.blocks || dayAvailability.blocks.length === 0) {
        continue; // No availability blocks for this day
      }

      // Sort availability blocks chronologically
      const sortedBlocks = [...dayAvailability.blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
      
      for (const availBlock of sortedBlocks) {
        const remainingHours = employee.maxHoursPerDay - (employeeHoursToday.get(employee.id) || 0);
        if (remainingHours <= 0) {
          break;
        }

        // Constrain availability block to operating hours
        const blockStart = Math.max(timeToMinutes(availBlock.startTime), timeToMinutes(openTime));
        const blockEnd = Math.min(timeToMinutes(availBlock.endTime), timeToMinutes(closeTime));

        if (blockEnd <= blockStart) {
          continue; // No overlap with operating hours
        }

        const availableHours = (blockEnd - blockStart) / 60;
        const hoursToSchedule = Math.min(availableHours, remainingHours);

        if (hoursToSchedule <= 0) {
          continue;
        }

        const startTime = minutesToTime(blockStart);
        const endTime = minutesToTime(blockStart + (hoursToSchedule * 60));

        const blockId = `auto-block-${day.dayOfWeek}-${employee.id}-${startTime}-${endTime}`;
        const segmentBlock: SegmentBlock = {
          id: blockId,
          scheduleWeekId: day.scheduleWeekId,
          scheduleDayId: day.id,
          dayOfWeek: day.dayOfWeek,
          segment: determineSegment(startTime, openTime, closeTime),
          startTime: startTime,
          endTime: endTime,
          childCount: day.enrollmentCount,
          status: 'draft'
        };

        createdSegmentBlocks.push(segmentBlock);
        assignments.push({
          id: `auto-${blockId}-${employee.id}`,
          segmentBlockId: blockId,
          employeeId: employee.id,
          assignmentSource: 'template',
          startTime: startTime,
          endTime: endTime,
          status: 'scheduled'
        });
        
        employeeHoursToday.set(employee.id, (employeeHoursToday.get(employee.id) || 0) + hoursToSchedule);
      }
    }
  }

  return { assignments, segmentBlocks: createdSegmentBlocks };
}

/**
 * Convert minutes since midnight to time string (HH:MM format)
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Determine segment type based on time within operating hours
 */
function determineSegment(time: string, openTime: string, closeTime: string): DaySegment {
  const timeMin = timeToMinutes(time);
  const openMin = timeToMinutes(openTime);
  const closeMin = timeToMinutes(closeTime);
  const totalMinutes = closeMin - openMin;
  const minutesFromOpen = timeMin - openMin;

  if (minutesFromOpen < totalMinutes / 3) {
    return 'open';
  } else if (minutesFromOpen < (2 * totalMinutes) / 3) {
    return 'mid';
  } else {
    return 'close';
  }
}

/**
 * Check if employee is available for the given day and time
 */
function isEmployeeAvailable(
  employee: Employee,
  dayOfWeek: DayOfWeek,
  startTime: string,
  endTime: string
): boolean {
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
 * Convert time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Attempt to fix violations by adjusting assignments
 */
function attemptViolationFixes(
  context: AutoSchedulerContext,
  assignments: StaffAssignment[],
  violations: RuleViolation[]
): StaffAssignment[] {
  let updatedAssignments = [...assignments];

  // Group violations by type
  const ratioViolations = violations.filter(v => v.ruleId === 'ratio-segment');
  const leaderViolations = violations.filter(v => v.ruleId === 'open-close-coverage');
  const cprViolations = violations.filter(v => v.ruleId === 'cpr-current-required');

  // Try to fix ratio violations by adding more staff
  for (const violation of ratioViolations) {
    if (violation.target.entity === 'SegmentBlock') {
      const block = context.segmentBlocks.find(b => b.id === violation.target.id);
      if (!block) continue;

      // Try to add one more staff member to this block
      const availableEmployees = context.employees.filter(emp => 
        emp.employmentStatus === 'active' &&
        !updatedAssignments.some(a => a.segmentBlockId === block.id && a.employeeId === emp.id)
      );

      for (const employee of availableEmployees) {
        if (isEmployeeAvailable(employee, block.dayOfWeek, block.startTime, block.endTime)) {
          updatedAssignments.push({
            id: `auto-fix-${block.id}-${employee.id}`,
            segmentBlockId: block.id,
            employeeId: employee.id,
            assignmentSource: 'template',
            startTime: block.startTime,
            endTime: block.endTime,
            status: 'scheduled'
          });
          break; // Added one staff, move to next violation
        }
      }
    }
  }

  // Try to fix leader violations by replacing non-leader with leader
  for (const violation of leaderViolations) {
    if (violation.target.entity === 'SegmentBlock') {
      const block = context.segmentBlocks.find(b => b.id === violation.target.id);
      if (!block) continue;

      const blockAssignments = updatedAssignments.filter(a => a.segmentBlockId === block.id);
      const hasLeader = blockAssignments.some(a => {
        const emp = context.employees.find(e => e.id === a.employeeId);
        return emp?.leaderQualified;
      });

      if (!hasLeader) {
        // Try to replace a non-leader with a leader
        const leaders = context.employees.filter(emp => 
          emp.leaderQualified && 
          emp.employmentStatus === 'active' &&
          isEmployeeAvailable(emp, block.dayOfWeek, block.startTime, block.endTime)
        );

        if (leaders.length > 0 && blockAssignments.length > 0) {
          // Remove first non-leader assignment
          const nonLeaderAssignment = blockAssignments.find(a => {
            const emp = context.employees.find(e => e.id === a.employeeId);
            return !emp?.leaderQualified;
          });

          if (nonLeaderAssignment) {
            updatedAssignments = updatedAssignments.filter(a => a.id !== nonLeaderAssignment.id);
            updatedAssignments.push({
              id: `auto-fix-leader-${block.id}-${leaders[0].id}`,
              segmentBlockId: block.id,
              employeeId: leaders[0].id,
              assignmentSource: 'template',
              startTime: block.startTime,
              endTime: block.endTime,
              status: 'scheduled'
            });
          }
        }
      }
    }
  }

  // Try to fix CPR violations by replacing non-CPR with CPR-current staff
  for (const violation of cprViolations) {
    if (violation.target.entity === 'StaffAssignment') {
      const assignment = updatedAssignments.find(a => a.id === violation.target.id);
      if (!assignment) continue;

      const employee = context.employees.find(e => e.id === assignment.employeeId);
      if (!employee || employee.cprCurrent) continue;

      // Try to find a CPR-current replacement
      const block = context.segmentBlocks.find(b => b.id === assignment.segmentBlockId);
      if (!block) continue;

      const cprStaff = context.employees.filter(emp => 
        emp.cprCurrent && 
        emp.employmentStatus === 'active' &&
        isEmployeeAvailable(emp, block.dayOfWeek, block.startTime, block.endTime) &&
        !updatedAssignments.some(a => a.segmentBlockId === block.id && a.employeeId === emp.id)
      );

      if (cprStaff.length > 0) {
        updatedAssignments = updatedAssignments.filter(a => a.id !== assignment.id);
        updatedAssignments.push({
          id: `auto-fix-cpr-${block.id}-${cprStaff[0].id}`,
          segmentBlockId: block.id,
          employeeId: cprStaff[0].id,
          assignmentSource: 'template',
          startTime: block.startTime,
          endTime: block.endTime,
          status: 'scheduled'
        });
      }
    }
  }

  return updatedAssignments;
}

/**
 * Main auto-scheduler function
 */
export function autoSchedule(context: AutoSchedulerContext, _weekId: string): AutoSchedulerResult {
  const engine = createRulesEngine();

  // Generate initial assignments and segment blocks
  const initialResult = generateInitialAssignments(context);
  let currentAssignments = initialResult.assignments;
  const allSegmentBlocks = [...context.segmentBlocks, ...initialResult.segmentBlocks];
  let iterations = 0;
  let violations: RuleViolation[] = [];

  // Iteratively try to resolve violations
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
      return {
        success: true,
        staffAssignments: currentAssignments,
        segmentBlocks: allSegmentBlocks,
        violations: [],
        iterations,
        message: `Successfully auto-scheduled staff with no violations in ${iterations} iteration(s).`
      };
    }

    // Try to fix violations
    const previousAssignmentCount = currentAssignments.length;
    currentAssignments = attemptViolationFixes(
      { ...context, segmentBlocks: allSegmentBlocks },
      currentAssignments,
      violations
    );

    // If no changes were made, we can't fix any more violations
    if (currentAssignments.length === previousAssignmentCount) {
      break;
    }
  }

  // Reached max iterations or couldn't fix violations
  return {
    success: false,
    staffAssignments: currentAssignments,
    segmentBlocks: allSegmentBlocks,
    violations,
    iterations,
    message: violations.length > 0
      ? `Auto-scheduling completed with ${violations.length} remaining violation(s) after ${iterations} iteration(s).`
      : `Auto-scheduling completed successfully in ${iterations} iteration(s).`
  };
}
