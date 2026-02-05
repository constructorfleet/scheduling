import {
  DayOfWeek,
  DaySegment,
  FieldTripEvent,
  FieldTripType,
  PolicyCitation,
  RatioProfile,
  SegmentBlock,
  SegmentRequirementTemplate,
  StaffAssignment,
  SubstituteRequest,
  Employee,
  ScheduleStatus
} from "../../domain/types";
import { RuleViolation, AuditEvent } from "../types";

export const policyCitations: Record<string, PolicyCitation> = {
  ratio: {
    id: "cit-rtb-1",
    name: "Segment ratio requirements",
    document: "District Staff Ratio Handbook",
    section: "4.1",
    notes: "Defines child-to-staff ratios per time segment."
  },
  leaderCoverage: {
    id: "cit-leader-2",
    name: "Leader coverage policy",
    document: "Leadership Coverage Policy",
    section: "5.2",
    notes: "Every open segment needs at least one leader-qualified staff member."
  },
  breakPolicy: {
    id: "cit-break-3",
    name: "Break and coverage",
    document: "Break Standards",
    section: "6.4",
    notes: "Staff must log breaks so coverage is maintained."
  },
  fieldTrip: {
    id: "cit-field-4",
    name: "Field trip approval",
    document: "Field Trip Governance",
    section: "2.8",
    notes: "Director sign-off is required before any field trip is published."
  },
  auditTrail: {
    id: "cit-audit-5",
    name: "Audit trail requirements",
    document: "Compliance Audit Appendix",
    section: "3.1",
    notes: "Every publish action must emit an audit-ready event."
  }
};

const ratioProfile: RatioProfile = {
  id: "ratio-preschool",
  childrenPerStaff: 6,
  leaderRequired: true,
  policyCitationId: policyCitations.ratio.id,
  notes: "1 staff per 6 children and one leader per segment"
};

const requirementTemplate: SegmentRequirementTemplate = {
  id: "template-all-day",
  ratioProfile,
  minStaff: 3,
  requiresCpr: true,
  requiresMedicalDelegation: true,
  requiresLeader: true,
  policyCitationId: policyCitations.ratio.id,
  notes: "Standard preschool segment requirements"
};

export const segmentSlotDefinitions: Record<
  DaySegment,
  { label: string; start: string; end: string; baseChildCount: number }
> = {
  open: { label: "Morning", start: "07:00", end: "11:00", baseChildCount: 18 },
  mid: { label: "Midday", start: "11:15", end: "15:00", baseChildCount: 15 },
  close: { label: "Afternoon", start: "15:30", end: "18:00", baseChildCount: 10 }
};

export const daySequence: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const dayDisplayNames: Record<DayOfWeek, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun"
};

export const weekMeta = {
  id: "week-2026-02-16",
  label: "Feb 16 - Feb 22, 2026",
  startDate: "2026-02-16",
  endDate: "2026-02-22",
  status: "draft" as ScheduleStatus
};

export const schools = [
  { id: "school-evergreen", name: "Evergreen Elementary Daycare" },
  { id: "school-maple", name: "Maple Creek Childcare" }
];

export const employees: Employee[] = [
  {
    id: "emp-aisha",
    name: "Aisha Patel",
    jobTitle: "Director",
    maxHoursPerDay: 8,
    maxHoursPerWeek: 40,
    employmentStatus: "active",
    leaderQualified: true,
    medicallyDelegated: true,
    cprCurrent: true,
    notes: "Oversees schedule publishing"
  },
  {
    id: "emp-rae",
    name: "Rae Morales",
    jobTitle: "Lead Teacher",
    maxHoursPerDay: 8,
    maxHoursPerWeek: 38,
    employmentStatus: "active",
    leaderQualified: true,
    medicallyDelegated: true,
    cprCurrent: true,
    notes: "CPR trainer"
  },
  {
    id: "emp-marcus",
    name: "Marcus Reed",
    jobTitle: "Assistant",
    maxHoursPerDay: 8,
    maxHoursPerWeek: 36,
    employmentStatus: "active",
    leaderQualified: false,
    medicallyDelegated: false,
    cprCurrent: true
  },
  {
    id: "emp-kai",
    name: "Kai Benson",
    jobTitle: "Support Lead",
    maxHoursPerDay: 7,
    maxHoursPerWeek: 30,
    employmentStatus: "active",
    leaderQualified: true,
    medicallyDelegated: false,
    cprCurrent: true
  },
  {
    id: "emp-jordan",
    name: "Jordan Lee",
    jobTitle: "Floater",
    maxHoursPerDay: 6,
    maxHoursPerWeek: 28,
    employmentStatus: "active",
    leaderQualified: false,
    medicallyDelegated: true,
    cprCurrent: true
  },
  {
    id: "emp-zoe",
    name: "Zoe Martinez",
    jobTitle: "Substitute",
    maxHoursPerDay: 8,
    maxHoursPerWeek: 20,
    employmentStatus: "active",
    leaderQualified: true,
    medicallyDelegated: true,
    cprCurrent: true,
    notes: "Substitute on approved request"
  }
];

const createSegmentBlocks = (): SegmentBlock[] => {
  const blocks: SegmentBlock[] = [];

  for (const day of daySequence) {
    for (const segmentKey of Object.keys(segmentSlotDefinitions) as DaySegment[]) {
      const slot = segmentSlotDefinitions[segmentKey];
      const id = `segment-${day}-${segmentKey}`;
      const isFieldTrip = day === "fri" && segmentKey === "mid";
      const childCount = slot.baseChildCount + (isFieldTrip ? 3 : 0);
      blocks.push({
        id,
        scheduleWeekId: weekMeta.id,
        dayOfWeek: day,
        segment: segmentKey,
        startTime: slot.start,
        endTime: slot.end,
        childCount,
        requirementTemplate,
        status: day === "mon" && segmentKey === "open" ? "draft" : "draft",
        fieldTripEventId: isFieldTrip ? "field-trip-1" : undefined,
        operatingCapacityOverride: isFieldTrip ? 22 : undefined
      });
    }
  }

  return blocks;
};

export const segmentBlocks = createSegmentBlocks();

export const staffAssignments: StaffAssignment[] = [
  {
    id: "assign-mon-open-aisha",
    segmentBlockId: "segment-mon-open",
    employeeId: "emp-aisha",
    assignmentSource: "manual_adjustment",
    startTime: "07:00",
    endTime: "11:00",
    isSubstitute: false,
    status: "active"
  },
  {
    id: "assign-mon-open-marcus",
    segmentBlockId: "segment-mon-open",
    employeeId: "emp-marcus",
    assignmentSource: "template",
    startTime: "07:00",
    endTime: "11:00",
    isSubstitute: false,
    status: "active"
  },
  {
    id: "assign-mon-mid-rae",
    segmentBlockId: "segment-mon-mid",
    employeeId: "emp-rae",
    assignmentSource: "manual_adjustment",
    startTime: "11:15",
    endTime: "15:00",
    isSubstitute: false,
    status: "active"
  },
  {
    id: "assign-tue-open-kai",
    segmentBlockId: "segment-tue-open",
    employeeId: "emp-kai",
    assignmentSource: "template",
    startTime: "07:00",
    endTime: "11:00",
    isSubstitute: false,
    status: "active"
  },
  {
    id: "assign-wed-mid-jordan",
    segmentBlockId: "segment-wed-mid",
    employeeId: "emp-jordan",
    assignmentSource: "manual_adjustment",
    startTime: "11:15",
    endTime: "15:00",
    isSubstitute: false,
    status: "active"
  },
  {
    id: "assign-fri-mid-rae",
    segmentBlockId: "segment-fri-mid",
    employeeId: "emp-rae",
    assignmentSource: "field_trip_override",
    startTime: "11:15",
    endTime: "15:00",
    isSubstitute: false,
    status: "active"
  }
];

export const fieldTripTypes: FieldTripType[] = [
  {
    id: "ft-zoo",
    name: "Museum Explorers",
    minAdultStudentRatio: 8,
    minLeaderStudentRatio: 12,
    policyCitationId: policyCitations.fieldTrip.id,
    notes: "Requires two leaders for any outdoor trips"
  }
];

export const fieldTripEvents: FieldTripEvent[] = [
  {
    id: "field-trip-1",
    scheduleWeekId: weekMeta.id,
    dayOfWeek: "fri",
    segment: "mid",
    fieldTripTypeId: "ft-zoo"
  }
];

export const substituteRequests: SubstituteRequest[] = [
  {
    id: "sub-1",
    originalAssignmentId: "assign-wed-mid-jordan",
    segmentBlockId: "segment-wed-mid",
    replacementEmployeeId: "emp-zoe",
    requestedBy: "Rae Morales",
    requestedAt: "2026-02-02T08:05:00Z",
    state: "pending",
    reason: "Need leader-qualified coverage for midday",
    policyCitationId: policyCitations.leaderCoverage.id
  }
];

export const ruleViolations: RuleViolation[] = [
  {
    id: "viol-1",
    title: "Leader coverage missing",
    severity: "critical",
    description: "Monday morning has two assistants and no leader-qualified staff.",
    segmentBlockId: "segment-mon-open",
    policyCitation: policyCitations.leaderCoverage,
    recommendedAction: "Add a leader-qualified staff member (e.g., Aisha or Kai)",
    resolved: false
  },
  {
    id: "viol-2",
    title: "Break not logged",
    severity: "warning",
    description: "Jordan is assigned to Wednesday midday without a recorded break; coverage could dip below the minimum threshold.",
    segmentBlockId: "segment-wed-mid",
    policyCitation: policyCitations.breakPolicy,
    recommendedAction: "Log the scheduled break or add another staff member for the 12:30–1:00 slot",
    resolved: false
  },
  {
    id: "viol-3",
    title: "Field trip sign-off pending",
    severity: "critical",
    description: "Friday midday field trip lacks director signature and timestamp, so adjustments cannot reach Ready for Sign-off.",
    segmentBlockId: "segment-fri-mid",
    policyCitation: policyCitations.fieldTrip,
    recommendedAction: "Capture the director name and approval time in the Field Trip panel",
    resolved: false
  }
];

export const auditTimeline: AuditEvent[] = [
  {
    id: "audit-1",
    timestamp: "2026-02-01T10:22:00Z",
    user: "Aisha Patel",
    action: "Added Marcus Reed to Monday morning",
    policyCitation: policyCitations.auditTrail,
    notes: "Ratio boost requested"
  },
  {
    id: "audit-2",
    timestamp: "2026-02-02T09:05:00Z",
    user: "Rae Morales",
    action: "Marked Wednesday midpoint for substitute review",
    policyCitation: policyCitations.leaderCoverage
  },
  {
    id: "audit-3",
    timestamp: "2026-02-03T14:50:00Z",
    user: "Kai Benson",
    action: "Opened field trip panel to review ratio overrides",
    policyCitation: policyCitations.fieldTrip
  }
];
