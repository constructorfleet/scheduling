import { DayOfWeek, PolicyCitation } from "../domain/types";

export type StepStatus = "complete" | "in_progress" | "blocked";

export interface GuidedStep {
  id: string;
  label: string;
  status: StepStatus;
  detail: string;
  actionLabel?: string;
  blockingReason?: string;
}

export interface RuleViolation {
  id: string;
  title: string;
  severity: "critical" | "warning" | "info";
  description: string;
  segmentBlockId: string;
  policyCitation: PolicyCitation;
  recommendedAction: string;
  resolved: boolean;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  policyCitation: PolicyCitation;
  notes?: string;
}

export interface SubstituteAssignmentCard {
  requestId: string;
  replacementName: string;
  originalDay: DayOfWeek;
  segmentLabel: string;
  approver?: string;
  approvedAt?: string;
  parityCheck: boolean;
  issues: string[];
  state: "ready" | "pending" | "blocked";
}
