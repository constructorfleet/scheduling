import type {
  DayOfWeek,
  FieldTripEvent,
  FieldTripType,
  OperatingHours,
  PolicyCitation,
  ScheduleDay,
  ScheduleStatus,
  SegmentBlock,
  SegmentRequirementTemplate,
  StaffAssignment,
  Employee,
  ScheduleType
} from "@core/domain/types";
import type { AuditEvent } from "../types";
import type { ScheduleTypeOption } from "../components/DayMetadataStrip";

export const policyCitations: Record<string, PolicyCitation> = {
  ratio: {
    id: "cit-rtb-1",
    name: "Segment ratio requirements",
    document: "District Staff Ratio Handbook",
    section: "4.1"
  },
  leaderCoverage: {
    id: "cit-leader-2",
    name: "Leader coverage policy",
    document: "Leadership Coverage Policy",
    section: "5.2"
  },
  breakPolicy: {
    id: "cit-break-3",
    name: "Break and coverage",
    document: "Break Standards",
    section: "6.4"
  },
  fieldTrip: {
    id: "cit-field-4",
    name: "Field trip governance",
    document: "Field Trip Governance",
    section: "2.8"
  }
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
  label: "Week schedule",
  startDate: "2026-02-16",
  endDate: "2026-02-22",
  status: "draft" as ScheduleStatus
};

export const schools = [{ id: "school-evergreen", name: "Evergreen Daycare" }];

export const scheduleTypeOptions: ScheduleTypeOption[] = [
  {
    value: "regular",
    label: "Regular day",
    ratio: { adults: 1, students: 15 },
    description: "Default staffing coverage."
  },
  {
    value: "extended",
    label: "Extended care",
    ratio: { adults: 1, students: 20 },
    description: "Early arrival and late pickup."
  },
  {
    value: "enrichment",
    label: "Enrichment focus",
    ratio: { adults: 1, students: 4 },
    description: "Smaller cohort programming."
  },
  {
    value: "closed",
    label: "Closed",
    ratio: { adults: 1, students: 1 },
    description: "School closed for the day."
  }
];

const defaultScheduleTypeForDay = (day: DayOfWeek): ScheduleType =>
  day === "wed" ? "enrichment" : day === "thu" ? "extended" : "regular";

export const scheduleDays: ScheduleDay[] = daySequence.map((day, index) => ({
  id: `schedule-day-${day}`,
  scheduleWeekId: weekMeta.id,
  date: `2026-02-${(16 + index).toString().padStart(2, "0")}`,
  dayOfWeek: day,
  scheduleType: defaultScheduleTypeForDay(day),
  dayScheduleType: "full_day",
  enrollmentCount: 0,
  fieldTripEventId: `field-trip-${day}`
}));

export const fieldTripEvents: FieldTripEvent[] = daySequence.map((day) => ({
  id: `field-trip-${day}`,
  scheduleWeekId: weekMeta.id,
  dayOfWeek: day,
  segment: "mid",
  scheduleDayId: `schedule-day-${day}`,
  isNoFieldTrip: true,
  notes: "No field trip selected"
}));

export const defaultRequirementTemplate: SegmentRequirementTemplate = {
  id: "template-default",
  ratioProfile: {
    id: "ratio-default",
    childrenPerStaff: 15,
    leaderRequired: false,
    policyCitationId: policyCitations.ratio.id
  },
  minStaff: 0,
  requiresCpr: false,
  requiresMedicalDelegation: false,
  requiresLeader: false,
  policyCitationId: policyCitations.ratio.id
};

export const segmentBlocks: SegmentBlock[] = [];
export const staffAssignments: StaffAssignment[] = [];
export const operatingHours: OperatingHours[] = [];
export const fieldTripTypes: FieldTripType[] = [];
export const employees: Employee[] = [];
export const auditTimeline: AuditEvent[] = [];
