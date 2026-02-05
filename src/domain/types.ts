export type DaySegment = "open" | "mid" | "close";
export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type ScheduleStatus = "draft" | "ready_for_review" | "submitted" | "approved" | "archived";
export type AssignmentSource = "template" | "manual_adjustment" | "field_trip_override" | "substitute" | "import";
export type ApprovalState = "pending" | "approved" | "rejected";
export type ScheduleType = "regular" | "extended" | "enrichment";
export type EnrollmentSource = "roster" | "manual_adjustment" | "override";

export interface PolicyCitation {
  id: string;
  name: string;
  document: string;
  section?: string;
  url?: string;
  notes?: string;
}

export interface RatioProfile {
  id: string;
  childrenPerStaff: number;
  leaderRequired?: boolean;
  policyCitationId: string;
  notes?: string;
}

export interface FieldTripType {
  id: string;
  name: string;
  minAdultStudentRatio: number;
  minLeaderStudentRatio: number;
  policyCitationId: string;
  notes?: string;
}

export interface SegmentRequirementTemplate {
  id: string;
  ratioProfile: RatioProfile;
  minStaff: number;
  requiresCpr: boolean;
  requiresMedicalDelegation: boolean;
  requiresLeader: boolean;
  policyCitationId: string;
  notes?: string;
}

export interface SegmentBlock {
  id: string;
  scheduleWeekId: string;
  scheduleDayId?: string;
  dayOfWeek: DayOfWeek;
  segment: DaySegment;
  startTime: string;
  endTime: string;
  childCount: number;
  requirementTemplate: SegmentRequirementTemplate;
  fieldTripEventId?: string;
  status: ScheduleStatus;
  operatingCapacityOverride?: number;
  closedReason?: string;
}

export interface FieldTripEvent {
  id: string;
  scheduleWeekId: string;
  dayOfWeek: DayOfWeek;
  segment: DaySegment;
  scheduleDayId?: string;
  fieldTripTypeId?: string;
  isNoFieldTrip?: boolean;
  approverId?: string;
  signedOffAt?: string;
  policyCitationId?: string;
  notes?: string;
}

export interface Employee {
  id: string;
  name: string;
  jobTitle: string;
  maxHoursPerDay: number;
  maxHoursPerWeek: number;
  employmentStatus: "active" | "on_leave" | "archived";
  leaderQualified: boolean;
  medicallyDelegated: boolean;
  cprCurrent: boolean;
  notes?: string;
}

export interface SubstituteRequest {
  id: string;
  originalAssignmentId: string;
  segmentBlockId: string;
  replacementEmployeeId: string;
  requestedBy: string;
  requestedAt: string;
  state: ApprovalState;
  reason?: string;
  approverId?: string;
  approvedAt?: string;
  policyCitationId?: string;
  notes?: string;
}

export interface StaffAssignment {
  id: string;
  segmentBlockId: string;
  employeeId: string;
  assignmentSource: AssignmentSource;
  startTime: string;
  endTime: string;
  isSubstitute: boolean;
  substituteRequestId?: string;
  status: "scheduled" | "active" | "on_break" | "completed";
  notes?: string;
}

export interface ScheduleDay {
  id: string;
  scheduleWeekId: string;
  date: string;
  dayOfWeek: DayOfWeek;
  scheduleType?: ScheduleType;
  enrollmentCount?: number;
  enrollmentSource?: EnrollmentSource;
  fieldTripEventId?: string;
  operatingCapacityOverride?: number;
  notes?: string;
}

export interface ShiftBreak {
  id: string;
  assignmentId: string;
  startTime: string;
  endTime: string;
  breakType: "meal" | "rest" | "coverage" | "other";
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
}
