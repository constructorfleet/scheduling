import {
  SegmentBlock,
  FieldTripEvent,
  FieldTripType,
  StaffAssignment,
  Employee,
  SubstituteRequest,
  PolicyCitation,
  ScheduleDay
} from "../domain/types";

export interface RulesContext {
  scheduleDays: ScheduleDay[];
  segmentBlocks: SegmentBlock[];
  staffAssignments: StaffAssignment[];
  employees: Employee[];
  substituteRequests: SubstituteRequest[];
  fieldTripEvents: FieldTripEvent[];
  fieldTripTypes: FieldTripType[];
  policyCitations?: PolicyCitation[];
  rulePolicyCitations?: Record<string, string>;
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
