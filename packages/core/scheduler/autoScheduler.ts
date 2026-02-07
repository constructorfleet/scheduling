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
  context: AutoSchedulerContext,
  weekId: string
): StaffAssignment[] {
  const assignments: StaffAssignment[] = [];
  const availableEmployees = context.employees.filter(emp => emp.employmentStatus === 'active');

  // Sort employees by leader qualification (leaders first for better coverage)
  const sortedEmployees = [...availableEmployees].sort((a, b) => {
    if (a.leaderQualified && !b.leaderQualified) return -1;
    if (!a.leaderQualified && b.leaderQualified) return 1;
    return 0;
  });

  // Group segment blocks by day
  const blocksByDay = context.segmentBlocks.reduce<Record<DayOfWeek, SegmentBlock[]>>((acc, block) => {
    if (!acc[block.dayOfWeek]) {
      acc[block.dayOfWeek] = [];
    }
    acc[block.dayOfWeek].push(block);
    return acc;
  }, {} as Record<DayOfWeek, SegmentBlock[]>);

  // For each day, assign staff to segment blocks
  for (const [dayOfWeek, blocks] of Object.entries(blocksByDay)) {
    const day = context.scheduleDays.find(d => d.dayOfWeek === dayOfWeek);
    if (!day || !day.scheduleType || day.enrollmentCount === undefined) {
      continue; // Skip days without metadata
    }

    // Calculate needed staff based on ratio
    const ratio = context.scheduleTypeRatios?.[day.scheduleType] ?? 0.2; // Default 1:5 ratio
    const neededStaff = Math.max(2, Math.ceil(day.enrollmentCount * ratio));

    // For each segment block, try to assign staff
    for (const block of blocks.sort((a, b) => a.startTime.localeCompare(b.startTime))) {
      let assignedCount = 0;

      for (const employee of sortedEmployees) {
        if (assignedCount >= neededStaff) {
          break;
        }

        // Check if employee is available for this day/time
        if (!isEmployeeAvailable(employee, dayOfWeek as DayOfWeek, block.startTime, block.endTime)) {
          continue;
        }

        // Check if employee would exceed max hours
        const currentHours = calculateEmployeeHours(assignments, employee.id, dayOfWeek as DayOfWeek);
        const blockHours = calculateHoursBetween(block.startTime, block.endTime);
        
        if (currentHours + blockHours > employee.maxHoursPerDay) {
          continue;
        }

        // Create assignment
        assignments.push({
          id: `auto-${block.id}-${employee.id}`,
          segmentBlockId: block.id,
          employeeId: employee.id,
          assignmentSource: 'manual_adjustment',
          startTime: block.startTime,
          endTime: block.endTime,
          status: 'scheduled'
        });

        assignedCount++;
      }
    }
  }

  return assignments;
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
 * Calculate total hours already assigned to an employee for a specific day
 */
function calculateEmployeeHours(
  assignments: StaffAssignment[],
  employeeId: string,
  dayOfWeek: DayOfWeek
): number {
  let totalHours = 0;
  
  for (const assignment of assignments) {
    if (assignment.employeeId === employeeId) {
      totalHours += calculateHoursBetween(assignment.startTime, assignment.endTime);
    }
  }

  return totalHours;
}

/**
 * Calculate hours between two time strings (HH:MM format)
 */
function calculateHoursBetween(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return Math.max(0, (end - start) / 60);
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
            assignmentSource: 'manual_adjustment',
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
              assignmentSource: 'manual_adjustment',
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
          assignmentSource: 'manual_adjustment',
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
export function autoSchedule(context: AutoSchedulerContext, weekId: string): AutoSchedulerResult {
  const engine = createRulesEngine();

  // Generate initial assignments
  let currentAssignments = generateInitialAssignments(context, weekId);
  let iterations = 0;
  let violations: RuleViolation[] = [];

  // Iteratively try to resolve violations
  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // Evaluate current state
    const rulesContext: RulesContext = {
      scheduleDays: context.scheduleDays,
      segmentBlocks: context.segmentBlocks,
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
        violations: [],
        iterations,
        message: `Successfully auto-scheduled staff with no violations in ${iterations} iteration(s).`
      };
    }

    // Try to fix violations
    const previousAssignmentCount = currentAssignments.length;
    currentAssignments = attemptViolationFixes(context, currentAssignments, violations);

    // If no changes were made, we can't fix any more violations
    if (currentAssignments.length === previousAssignmentCount) {
      break;
    }
  }

  // Reached max iterations or couldn't fix violations
  return {
    success: false,
    staffAssignments: currentAssignments,
    violations,
    iterations,
    message: violations.length > 0
      ? `Auto-scheduling completed with ${violations.length} remaining violation(s) after ${iterations} iteration(s).`
      : `Auto-scheduling completed successfully in ${iterations} iteration(s).`
  };
}
