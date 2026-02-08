import {
  SegmentBlock,
  FieldTripEvent,
  FieldTripType,
  StaffAssignment,
  Employee,
  PolicyCitation,
  ScheduleDay,
  OperatingHours
} from "../domain/types";

export interface RulesContext {
  scheduleDays: ScheduleDay[];
  segmentBlocks: SegmentBlock[];
  staffAssignments: StaffAssignment[];
  employees: Employee[];
  fieldTripEvents: FieldTripEvent[];
  fieldTripTypes: FieldTripType[];
  operatingHours: OperatingHours[];
  scheduleTypeRatios?: Record<string, number>;
  schoolRules?: SchoolRules;
  jobTitleRules?: Record<string, JobTitleRule>;
  policyCitations?: PolicyCitation[];
  rulePolicyCitations?: Record<string, string>;
}

export interface SchoolRules {
  openerCount: number;
  closerCount: number;
  fieldTripStartTime?: string;
  fieldTripEndTime?: string;
  minimumMedicalDelegated: number;
  requireCurrentCpr: boolean;
  openerWindowMinutes?: number;
  closerWindowMinutes?: number;
}

export interface JobTitleRule {
  requiresLeaderForOpenClose: boolean;
}

export interface RuleTarget {
  entity: string;
  id: string;
  metadata?: Record<string, unknown>;
}

export interface RuleViolation {
  id: string;
  ruleId: string;
  message: string;
  severity: "error" | "warning";
  target: RuleTarget;
  citationId?: string;
}

export interface RuleDefinition {
  id: string;
  description: string;
  evaluate(context: RulesContext): RuleViolation[];
}
