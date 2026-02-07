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
 * This is a placeholder for the new violation-based approach
 */
function generateInitialAssignments(
  _context: AutoSchedulerContext
): { assignments: StaffAssignment[]; segmentBlocks: SegmentBlock[] } {
  // TODO: Implement violation-based scheduling approach
  // For now, return empty arrays
  return { assignments: [], segmentBlocks: [] };
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Attempt to fix violations by working through them one by one
 * This is the new violation-based approach
 */
function attemptViolationFixes(
  _context: AutoSchedulerContext,
  assignments: StaffAssignment[],
  _violations: RuleViolation[]
): StaffAssignment[] {
  // TODO: Implement new violation-based fixing approach
  // For now, just return assignments unchanged
  return assignments;
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
    // Start fresh - for now returns empty until new implementation is ready
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
      iterations: 0,
      message: startFromEmpty 
        ? "No schedule to generate - starting from empty is not yet implemented."
        : "Existing schedule has no violations."
    };
  }

  // Work through violations one by one (new approach - to be implemented)
  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // Try to fix violations one by one
    const previousAssignmentCount = currentAssignments.length;
    currentAssignments = attemptViolationFixes(
      { ...context, segmentBlocks: allSegmentBlocks },
      currentAssignments,
      violations
    );

    // Re-evaluate after attempting fixes
    const updatedContext: RulesContext = {
      ...rulesContext,
      staffAssignments: currentAssignments,
      segmentBlocks: allSegmentBlocks
    };
    violations = engine.evaluate(updatedContext);

    // If no violations, we're done
    if (violations.length === 0) {
      return {
        success: true,
        staffAssignments: currentAssignments,
        segmentBlocks: allSegmentBlocks,
        violations: [],
        iterations,
        message: `Successfully resolved all violations in ${iterations} iteration(s).`
      };
    }

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
      ? `Auto-scheduling incomplete: ${violations.length} violation(s) remain after ${iterations} iteration(s). Violation-based fixing is not yet fully implemented.`
      : `Auto-scheduling completed successfully in ${iterations} iteration(s).`
  };
}
