import { PolicyCitation } from "@core/domain/types";

export type StepStatus = "complete" | "in_progress" | "blocked";

export interface GuidedStep {
  id: string;
  label: string;
  status: StepStatus;
  detail: string;
  actionLabel?: string;
  blockingReason?: string;
  actionDisabled?: boolean;
}

export interface RuleViolation {
  id: string;
  title: string;
  severity: "critical" | "warning" | "info";
  description: string;
  segmentBlockId: string;
  policyCitation: PolicyCitation;
  recommendedAction: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  policyCitation: PolicyCitation;
  notes?: string;
}
