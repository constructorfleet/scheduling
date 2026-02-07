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
 * Generates initial staff assignments based on violations
 * This creates basic segment blocks for each day and then lets violation fixing handle staffing
 */
function generateInitialAssignments(
  context: AutoSchedulerContext
): { assignments: StaffAssignment[]; segmentBlocks: SegmentBlock[] } {
  const createdSegmentBlocks: SegmentBlock[] = [];

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
    const totalMinutes = closeMinutes - openMinutes;
    const segmentDuration = Math.floor(totalMinutes / 3);
    
    const segments: Array<{ start: number; end: number; segment: 'open' | 'mid' | 'close' }> = [
      { start: openMinutes, end: openMinutes + segmentDuration, segment: 'open' },
      { start: openMinutes + segmentDuration, end: openMinutes + (2 * segmentDuration), segment: 'mid' },
      { start: openMinutes + (2 * segmentDuration), end: closeMinutes, segment: 'close' }
    ];

    for (const seg of segments) {
      const blockId = `auto-block-${day.dayOfWeek}-${seg.segment}-${minutesToTime(seg.start)}`;
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
  }

  // Return empty assignments - let violation fixing populate them
  return { assignments: [], segmentBlocks: createdSegmentBlocks };
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
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
function determineSegment(timeMinutes: number, openMinutes: number, closeMinutes: number): 'open' | 'mid' | 'close' {
  const totalMinutes = closeMinutes - openMinutes;
  const minutesFromOpen = timeMinutes - openMinutes;

  if (minutesFromOpen < totalMinutes / 3) {
    return 'open';
  } else if (minutesFromOpen < (2 * totalMinutes) / 3) {
    return 'mid';
  } else {
    return 'close';
  }
}

/**
 * Check if employee is available for the given day and time window
 */
function isEmployeeAvailable(
  employee: Employee,
  dayOfWeek: DayOfWeek,
  startTime: string,
  endTime: string
): boolean {
  // Check employment status
  if (employee.employmentStatus !== 'active') {
    return false;
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

/**
 * Attempt to fix violations by working through them one by one
 * This is the new violation-based approach
 */
function attemptViolationFixes(
  context: AutoSchedulerContext,
  assignments: StaffAssignment[],
  violations: RuleViolation[]
): StaffAssignment[] {
  let updatedAssignments = [...assignments];

  // Process ratio violations first as they're most critical
  const ratioViolations = violations.filter(v => v.ruleId === 'ratio-segment');
  
  for (const violation of ratioViolations) {
    if (violation.target.entity !== 'ScheduleDay') continue;
    
    const metadata = violation.target.metadata;
    if (!metadata) continue;
    
    const dayOfWeek = metadata.dayOfWeek as DayOfWeek;
    const startTime = metadata.startTime as string;
    const endTime = metadata.endTime as string;
    const required = metadata.required as number;
    const actual = metadata.actual as number;
    
    const needed = required - actual;
    if (needed <= 0) continue;

    // Find employees who could work this time slot
    const availableEmployees = context.employees
      .filter(emp => emp.employmentStatus === 'active')
      .filter(emp => isEmployeeAvailable(emp, dayOfWeek, startTime, endTime))
      .filter(emp => {
        const hoursOnDay = getEmployeeHoursOnDay(updatedAssignments, emp.id, dayOfWeek, context.segmentBlocks);
        const shiftDuration = (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60;
        return hoursOnDay + shiftDuration <= emp.maxHoursPerDay;
      })
      .filter(emp => {
        // Don't double-assign the same employee to overlapping time
        return !updatedAssignments.some(a => {
          const block = context.segmentBlocks.find(b => b.id === a.segmentBlockId);
          if (!block || block.dayOfWeek !== dayOfWeek || a.employeeId !== emp.id) return false;
          
          const aStart = timeToMinutes(a.startTime);
          const aEnd = timeToMinutes(a.endTime);
          const vStart = timeToMinutes(startTime);
          const vEnd = timeToMinutes(endTime);
          
          // Check for overlap
          return aStart < vEnd && aEnd > vStart;
        });
      });

    // Sort by qualifications (prefer leaders and medically delegated)
    availableEmployees.sort((a, b) => {
      const aScore = (a.leaderQualified ? 2 : 0) + (a.medicallyDelegated ? 1 : 0) + (a.cprCurrent ? 1 : 0);
      const bScore = (b.leaderQualified ? 2 : 0) + (b.medicallyDelegated ? 1 : 0) + (b.cprCurrent ? 1 : 0);
      return bScore - aScore;
    });

    // Add as many staff as needed
    let added = 0;
    for (const employee of availableEmployees) {
      if (added >= needed) break;

      // Find or create a segment block for this time period
      let segmentBlock = context.segmentBlocks.find(b => 
        b.dayOfWeek === dayOfWeek &&
        b.startTime === startTime &&
        b.endTime === endTime
      );

      if (!segmentBlock) {
        // Create a new segment block
        const openMinutes = timeToMinutes(startTime);
        const closeMinutes = timeToMinutes(endTime);
        const opHours = context.operatingHours.find(oh => oh.dayOfWeek === dayOfWeek);
        const dayOpenMinutes = opHours ? timeToMinutes(opHours.open) : openMinutes;
        const dayCloseMinutes = opHours ? timeToMinutes(opHours.close) : closeMinutes;
        
        const segment = determineSegment(openMinutes, dayOpenMinutes, dayCloseMinutes);
        const scheduleDay = context.scheduleDays.find(d => d.dayOfWeek === dayOfWeek);
        
        const blockId = `auto-fix-${dayOfWeek}-${startTime}-${endTime}-${Date.now()}`;
        segmentBlock = {
          id: blockId,
          scheduleWeekId: scheduleDay?.scheduleWeekId || 'unknown',
          scheduleDayId: scheduleDay?.id,
          dayOfWeek: dayOfWeek,
          segment: segment,
          startTime: startTime,
          endTime: endTime,
          childCount: scheduleDay?.enrollmentCount || 0,
          status: 'draft'
        };
        
        context.segmentBlocks.push(segmentBlock);
      }

      // Create assignment
      const assignmentId = `auto-assign-${segmentBlock.id}-${employee.id}`;
      updatedAssignments.push({
        id: assignmentId,
        segmentBlockId: segmentBlock.id,
        employeeId: employee.id,
        assignmentSource: 'template',
        startTime: startTime,
        endTime: endTime,
        status: 'scheduled'
      });
      
      added++;
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
      // Find a leader who can work this block
      const availableLeaders = context.employees
        .filter(emp => emp.leaderQualified && emp.employmentStatus === 'active')
        .filter(emp => isEmployeeAvailable(emp, block.dayOfWeek, block.startTime, block.endTime))
        .filter(emp => {
          const hoursOnDay = getEmployeeHoursOnDay(updatedAssignments, emp.id, block.dayOfWeek, context.segmentBlocks);
          const shiftDuration = (timeToMinutes(block.endTime) - timeToMinutes(block.startTime)) / 60;
          return hoursOnDay + shiftDuration <= emp.maxHoursPerDay;
        })
        .filter(emp => !blockAssignments.some(a => a.employeeId === emp.id));

      if (availableLeaders.length > 0) {
        const leader = availableLeaders[0];
        const assignmentId = `auto-leader-${block.id}-${leader.id}`;
        updatedAssignments.push({
          id: assignmentId,
          segmentBlockId: block.id,
          employeeId: leader.id,
          assignmentSource: 'template',
          startTime: block.startTime,
          endTime: block.endTime,
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
      const availableMedical = context.employees
        .filter(emp => emp.medicallyDelegated && emp.employmentStatus === 'active')
        .filter(emp => isEmployeeAvailable(emp, block.dayOfWeek, block.startTime, block.endTime))
        .filter(emp => {
          const hoursOnDay = getEmployeeHoursOnDay(updatedAssignments, emp.id, block.dayOfWeek, context.segmentBlocks);
          const shiftDuration = (timeToMinutes(block.endTime) - timeToMinutes(block.startTime)) / 60;
          return hoursOnDay + shiftDuration <= emp.maxHoursPerDay;
        })
        .filter(emp => !blockAssignments.some(a => a.employeeId === emp.id));

      let added = 0;
      for (const emp of availableMedical) {
        if (added >= needed) break;
        
        const assignmentId = `auto-medical-${block.id}-${emp.id}`;
        updatedAssignments.push({
          id: assignmentId,
          segmentBlockId: block.id,
          employeeId: emp.id,
          assignmentSource: 'template',
          startTime: block.startTime,
          endTime: block.endTime,
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
      .filter(emp => isEmployeeAvailable(emp, block.dayOfWeek, block.startTime, block.endTime))
      .filter(emp => {
        const hoursOnDay = getEmployeeHoursOnDay(updatedAssignments, emp.id, block.dayOfWeek, context.segmentBlocks);
        const shiftDuration = (timeToMinutes(block.endTime) - timeToMinutes(block.startTime)) / 60;
        return hoursOnDay + shiftDuration <= emp.maxHoursPerDay;
      })
      .filter(emp => !updatedAssignments.some(a => 
        a.segmentBlockId === block.id && a.employeeId === emp.id
      ));

    if (cprStaff.length > 0) {
      // Remove the non-CPR assignment
      updatedAssignments = updatedAssignments.filter(a => a.id !== assignment.id);
      
      // Add the CPR-current replacement
      const replacement = cprStaff[0];
      const assignmentId = `auto-cpr-${block.id}-${replacement.id}`;
      updatedAssignments.push({
        id: assignmentId,
        segmentBlockId: block.id,
        employeeId: replacement.id,
        assignmentSource: 'template',
        startTime: block.startTime,
        endTime: block.endTime,
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
    // Start fresh - generate initial segment blocks
    const initialResult = generateInitialAssignments(context);
    currentAssignments = initialResult.assignments;
    allSegmentBlocks = [...context.segmentBlocks, ...initialResult.segmentBlocks];
  } else {
    // Start with existing schedule and work through violations
    currentAssignments = [...context.staffAssignments];
    allSegmentBlocks = [...context.segmentBlocks];
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
      return {
        success: true,
        staffAssignments: currentAssignments,
        segmentBlocks: allSegmentBlocks,
        violations: [],
        iterations,
        message: startFromEmpty 
          ? `Successfully auto-scheduled staff with no violations in ${iterations} iteration(s).`
          : `Successfully resolved all violations in ${iterations} iteration(s).`
      };
    }

    // Try to fix violations one by one
    const previousAssignmentCount = currentAssignments.length;
    const previousBlockCount = allSegmentBlocks.length;
    
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

    // If no changes were made, we can't fix any more violations
    if (currentAssignments.length === previousAssignmentCount && 
        allSegmentBlocks.length === previousBlockCount) {
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
      ? `Auto-scheduling incomplete: ${violations.length} violation(s) remain after ${iterations} iteration(s).`
      : `Auto-scheduling completed successfully in ${iterations} iteration(s).`
  };
}
