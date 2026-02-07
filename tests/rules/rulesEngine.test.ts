import { RulesEngine } from "@core/rules";
import type {
  AssignmentSource,
  DaySegment,
  DayOfWeek,
  Employee,
  FieldTripEvent,
  FieldTripType,
  ScheduleDay,
  ScheduleStatus,
  SegmentBlock,
  StaffAssignment,
  OperatingHours
} from "@core/domain/types";
import type { RulesContext } from "@core/rules/types";

const createSegmentBlock = (
  id: string,
  overrides: Partial<SegmentBlock> = {}
): SegmentBlock => ({
  id,
  scheduleWeekId: "week-1",
  dayOfWeek: "mon" as DayOfWeek,
  segment: "open" as DaySegment,
  startTime: "08:00",
  endTime: "12:00",
  childCount: 20,
  status: "draft" as ScheduleStatus,
  ...overrides
});

const createAssignment = (
  id: string,
  blockId: string,
  employeeId: string,
  overrides: Partial<StaffAssignment> = {}
): StaffAssignment => ({
  id,
  segmentBlockId: blockId,
  employeeId,
  assignmentSource: "manual_adjustment" as AssignmentSource,
  startTime: "08:00",
  endTime: "12:00",
  status: "scheduled",
  ...overrides
});

const createEmployee = (id: string, overrides: Partial<Employee> = {}): Employee => ({
  id,
  name: "Test Employee",
  jobTitle: "Assistant",
  maxHoursPerDay: 12,
  maxHoursPerWeek: 60,
  employmentStatus: "active",
  leaderQualified: false,
  medicallyDelegated: false,
  cprCurrent: false,
  availability: [],
  requestedDaysOff: [],
  ...overrides
});

const createFieldTripEvent = (
  id: string,
  overrides: Partial<FieldTripEvent> = {}
): FieldTripEvent => ({
  id,
  scheduleWeekId: "week-1",
  dayOfWeek: "mon" as DayOfWeek,
  segment: "open" as DaySegment,
  scheduleDayId: overrides.scheduleDayId,
  fieldTripTypeId: overrides.fieldTripTypeId,
  isNoFieldTrip: overrides.isNoFieldTrip,
  approverId: overrides.approverId,
  signedOffAt: overrides.signedOffAt,
  notes: overrides.notes,
  ...overrides
});

const createScheduleDay = (id: string, overrides: Partial<ScheduleDay> = {}): ScheduleDay => ({
  id,
  scheduleWeekId: "week-1",
  date: "2026-02-16",
  dayOfWeek: "mon" as DayOfWeek,
  scheduleType: "regular",
  enrollmentCount: 20,
  enrollmentSource: "manual_adjustment",
  fieldTripEventId: overrides.fieldTripEventId,
  dayScheduleType: overrides.dayScheduleType ?? "full_day",
  ...overrides
});

const defaultFieldTripEvent = createFieldTripEvent("ft-default", {
  isNoFieldTrip: true,
  scheduleDayId: "day-default"
});
const defaultScheduleDay = createScheduleDay("day-default", {
  fieldTripEventId: defaultFieldTripEvent.id
});

const WEEK_DAYS: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const createOperatingHours = (
  overrides: Partial<OperatingHours> & { dayOfWeek?: DayOfWeek } = {}
): OperatingHours => ({
  id: overrides.id ?? `operating-${overrides.dayOfWeek ?? "mon"}`,
  schoolId: overrides.schoolId ?? "school-default",
  dayOfWeek: overrides.dayOfWeek ?? "mon",
  dayScheduleType: overrides.dayScheduleType ?? "full_day",
  open: overrides.open ?? "06:00",
  close: overrides.close ?? "18:00",
  notes: overrides.notes
});
const defaultOperatingHours = WEEK_DAYS.map((day) =>
  createOperatingHours({ dayOfWeek: day, dayScheduleType: "full_day" })
);

const withDefaultScheduleInfo = (context: Partial<RulesContext>): RulesContext => {
  const mergedFieldTripEvents = [
    defaultFieldTripEvent,
    ...(context.fieldTripEvents ?? []).filter((event) => event.id !== defaultFieldTripEvent.id)
  ];
  const operatingHours = context.operatingHours ?? defaultOperatingHours;
  return {
    segmentBlocks: context.segmentBlocks ?? [],
    staffAssignments: context.staffAssignments ?? [],
    employees: context.employees ?? [],
    fieldTripEvents: mergedFieldTripEvents,
    fieldTripTypes: context.fieldTripTypes ?? [],
    scheduleDays: context.scheduleDays ?? [defaultScheduleDay],
    operatingHours,
    scheduleTypeRatios: context.scheduleTypeRatios ?? { regular: 8 },
    schoolRules: context.schoolRules,
    jobTitleRules: context.jobTitleRules,
    policyCitations: context.policyCitations,
    rulePolicyCitations: context.rulePolicyCitations
  };
};

const engine = new RulesEngine();

describe("RulesEngine", () => {
  test("flags ratio violations when assigned staff < required", () => {
    const block = createSegmentBlock("block-ratio", {
      childCount: 18
    });
    const assignment = createAssignment("assign-ratio", block.id, "emp-ratio");
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: [assignment],
      employees: [createEmployee("emp-ratio")],
      fieldTripEvents: [],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const ratioViolations = violations.filter((violation) => violation.ruleId === "ratio-segment");
    expect(ratioViolations.length).toBeGreaterThan(0);
    expect(ratioViolations.some((violation) => String(violation.message).includes("08:00-12:00"))).toBe(true);
  });

  test("does not count orphan assignments toward ratio coverage", () => {
    const block = createSegmentBlock("block-ratio-orphan", {
      childCount: 18
    });
    const orphanAssignment = createAssignment("assign-ratio-orphan", block.id, "emp-missing");
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: [orphanAssignment],
      employees: [],
      fieldTripEvents: [],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const ratioViolations = violations.filter((violation) => violation.ruleId === "ratio-segment");
    expect(ratioViolations).toHaveLength(1);
    expect(ratioViolations[0].message).toContain("but only 0 assigned");
  });

  test("skips ratio checks for closed schedule days", () => {
    const closedDay = createScheduleDay("day-closed", {
      dayOfWeek: "sat",
      scheduleType: "closed",
      dayScheduleType: "closed"
    });
    const closedBlock = createSegmentBlock("block-closed", {
      dayOfWeek: "sat",
      scheduleDayId: closedDay.id,
      childCount: 30
    });
    const context: RulesContext = withDefaultScheduleInfo({
      scheduleDays: [closedDay],
      segmentBlocks: [closedBlock],
      staffAssignments: [],
      employees: [],
      fieldTripEvents: [],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const ratioViolations = violations.filter((violation) => violation.ruleId === "ratio-segment");
    expect(ratioViolations).toHaveLength(0);
  });

  test("allows ratio compliance when ratio and minimums are met", () => {
    const block = createSegmentBlock("block-ratio-clean", {
      childCount: 24
    });
    const employees = [
      createEmployee("emp-ratio-clean-1"),
      createEmployee("emp-ratio-clean-2"),
      createEmployee("emp-ratio-clean-3")
    ];
    const assignments = employees.map((employee, index) =>
      createAssignment(`assign-ratio-clean-${index + 1}`, block.id, employee.id, {
        startTime: "06:00",
        endTime: "18:00"
      })
    );
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: assignments,
      employees,
      fieldTripEvents: [],
      fieldTripTypes: [],
      schoolRules: {
        openerCount: 3,
        closerCount: 0,
        minimumMedicalDelegated: 0,
        requireCurrentCpr: false
      }
    });

    const violations = engine.evaluate(context);
    const ratioViolations = violations.filter((violation) => violation.ruleId === "ratio-segment");
    expect(ratioViolations).toHaveLength(0);
  });

  test("applies field-trip ratios as overrides for segment ratio checks", () => {
    const fieldTripType: FieldTripType = {
      id: "trip-type-skip",
      name: "Museum Express",
      adultRatioAdults: 1,
      adultRatioStudents: 5, // 1:5 ratio (1 adult per 5 children)
      leaderRatioAdults: 1,
      leaderRatioStudents: 10, // 1:10 ratio (1 leader per 10 children)
      policyCitationId: "policy-field-trip",
      notes: undefined
    };
    const fieldTripEvent: FieldTripEvent = {
      id: "ft-event-skip",
      scheduleWeekId: "week-1",
      dayOfWeek: "mon" as DayOfWeek,
      segment: "open" as DaySegment,
      fieldTripTypeId: fieldTripType.id,
      approverId: "director",
      signedOffAt: "2026-02-04T08:00:00Z"
    };
    const block = createSegmentBlock("block-trip-ratio-skip", {
      childCount: 20,
      fieldTripEventId: fieldTripEvent.id
    });
    const assignment = createAssignment("assign-trip-skip", block.id, "emp-trip-skip");
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: [assignment],
      employees: [createEmployee("emp-trip-skip")],
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: [fieldTripType]
    });

    const violations = engine.evaluate(context);
    const ratioViolations = violations.filter((violation) => violation.ruleId === "ratio-segment");
    expect(ratioViolations.length).toBeGreaterThan(0);
    const tripViolations = violations.filter((violation) => violation.ruleId === "field-trip-ratios");
    expect(tripViolations.length).toBeGreaterThan(0);
    expect(tripViolations.every((v) => v.target.id === block.id)).toBe(true);
  });


  test("reports daily and weekly limit violations", () => {
    const block = createSegmentBlock("block-shift", { dayOfWeek: "tue" });
    const employee = createEmployee("emp-shift", { maxHoursPerDay: 4, maxHoursPerWeek: 8 });
    const firstAssignment = createAssignment("assign-shift-1", block.id, employee.id, {
      startTime: "08:00",
      endTime: "12:00"
    });
    const secondAssignment = createAssignment("assign-shift-2", block.id, employee.id, {
      startTime: "12:30",
      endTime: "17:30"
    });
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: [firstAssignment, secondAssignment],
      employees: [employee],
      fieldTripEvents: [],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const shiftViolations = violations.filter((violation) => violation.ruleId === "shift-break-limits");
    expect(shiftViolations.length).toBeGreaterThanOrEqual(2);
    expect(shiftViolations.some((v) => v.message.includes("daily"))).toBe(true);
    expect(shiftViolations.some((v) => v.message.includes("weekly"))).toBe(true);
  });

  test("does not flag shift limits when assignments stay under caps", () => {
    const block = createSegmentBlock("block-shift-clean", { dayOfWeek: "wed" });
    const employee = createEmployee("emp-shift-clean", { maxHoursPerDay: 8, maxHoursPerWeek: 16 });
    const firstAssignment = createAssignment("assign-shift-clean-1", block.id, employee.id, {
      startTime: "08:00",
      endTime: "12:00"
    });
    const secondAssignment = createAssignment("assign-shift-clean-2", block.id, employee.id, {
      startTime: "12:30",
      endTime: "16:30"
    });
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: [firstAssignment, secondAssignment],
      employees: [employee],
      fieldTripEvents: [],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const shiftViolations = violations.filter((violation) => violation.ruleId === "shift-break-limits");
    expect(shiftViolations).toHaveLength(0);
  });

  test("flags weekly limit violations even when daily totals stay under the cap", () => {
    const blockMon = createSegmentBlock("block-weekly-mon", { dayOfWeek: "mon" });
    const blockTue = createSegmentBlock("block-weekly-tue", { dayOfWeek: "tue" });
    const employee = createEmployee("emp-weekly", { maxHoursPerDay: 8, maxHoursPerWeek: 10 });
    const firstAssignment = createAssignment("assign-weekly-mon", blockMon.id, employee.id, {
      startTime: "08:00",
      endTime: "14:00"
    });
    const secondAssignment = createAssignment("assign-weekly-tue", blockTue.id, employee.id, {
      startTime: "08:00",
      endTime: "14:00"
    });
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [blockMon, blockTue],
      staffAssignments: [firstAssignment, secondAssignment],
      employees: [employee],
      fieldTripEvents: [],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const shiftViolations = violations.filter((violation) => violation.ruleId === "shift-break-limits");
    expect(shiftViolations).toHaveLength(1);
    expect(shiftViolations[0].message).toContain("weekly limit");
  });

  test("enforces field trip ratio minima", () => {
    const fieldTripType: FieldTripType = {
      id: "trip-type-1",
      name: "Museum",
      adultRatioAdults: 1,
      adultRatioStudents: 5, // 1:5 ratio (1 adult per 5 children)
      leaderRatioAdults: 1,
      leaderRatioStudents: 10, // 1:10 ratio (1 leader per 10 children)
      policyCitationId: "policy-field-trip",
      notes: undefined
    };
    const fieldTripEvent: FieldTripEvent = {
      id: "ft-event-1",
      scheduleWeekId: "week-1",
      dayOfWeek: "mon" as DayOfWeek,
      segment: "open" as DaySegment,
      fieldTripTypeId: fieldTripType.id,
      approverId: "director",
      signedOffAt: "2026-02-04T08:00:00Z"
    };
    const block = createSegmentBlock("block-trip", {
      childCount: 20,
      fieldTripEventId: fieldTripEvent.id
    });
    const assignment = createAssignment("assign-trip", block.id, "emp-trip", {
    });
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: [assignment],
      employees: [createEmployee("emp-trip", { leaderQualified: true })],
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: [fieldTripType]
    });

    const violations = engine.evaluate(context);
    const tripViolations = violations.filter((violation) => violation.ruleId === "field-trip-ratios");
    expect(tripViolations.length).toBe(1);
    expect(tripViolations.every((v) => v.target.id === block.id)).toBe(true);
  });

  test("passes field trip ratios when adult and leader counts meet minima", () => {
    const fieldTripType: FieldTripType = {
      id: "trip-type-2",
      name: "Zoo",
      adultRatioAdults: 1,
      adultRatioStudents: 5, // 1:5 ratio (1 adult per 5 children)
      leaderRatioAdults: 1,
      leaderRatioStudents: 10, // 1:10 ratio (1 leader per 10 children)
      policyCitationId: "policy-field-trip",
      notes: undefined
    };
    const fieldTripEvent: FieldTripEvent = {
      id: "ft-event-3",
      scheduleWeekId: "week-1",
      dayOfWeek: "thu" as DayOfWeek,
      segment: "open" as DaySegment,
      fieldTripTypeId: fieldTripType.id,
      approverId: "director",
      signedOffAt: "2026-02-04T09:00:00Z"
    };
    const block = createSegmentBlock("block-trip-clean", {
      dayOfWeek: "thu",
      childCount: 20,
      fieldTripEventId: fieldTripEvent.id
    });
    const employees = [
      createEmployee("emp-trip-clean-1"),
      createEmployee("emp-trip-clean-2", { leaderQualified: true }),
      createEmployee("emp-trip-clean-3", { leaderQualified: true }),
      createEmployee("emp-trip-clean-4")
    ];
    const assignments = employees.map((employee, index) =>
      createAssignment(`assign-trip-clean-${index + 1}`, block.id, employee.id)
    );
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: assignments,
      employees,
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: [fieldTripType]
    });

    const violations = engine.evaluate(context);
    const tripViolations = violations.filter((violation) => violation.ruleId === "field-trip-ratios");
    expect(tripViolations).toHaveLength(0);
  });

  test("reports leader shortages when adult counts satisfy field-trip minima", () => {
    const fieldTripType: FieldTripType = {
      id: "trip-type-3",
      name: "Botanical Garden",
      adultRatioAdults: 1,
      adultRatioStudents: 5, // 1:5 ratio (1 adult per 5 children)
      leaderRatioAdults: 1,
      leaderRatioStudents: 10, // 1:10 ratio (1 leader per 10 children)
      policyCitationId: "policy-field-trip",
      notes: undefined
    };
    const fieldTripEvent: FieldTripEvent = {
      id: "ft-event-5",
      scheduleWeekId: "week-1",
      dayOfWeek: "thu" as DayOfWeek,
      segment: "open" as DaySegment,
      fieldTripTypeId: fieldTripType.id,
      approverId: "director",
      signedOffAt: "2026-02-04T11:00:00Z"
    };
    const block = createSegmentBlock("block-trip-leader-shortage", {
      dayOfWeek: "thu",
      childCount: 20,
      fieldTripEventId: fieldTripEvent.id
    });
    const employees = [
      createEmployee("emp-trip-leader-1", { leaderQualified: true }),
      createEmployee("emp-trip-leader-2"),
      createEmployee("emp-trip-leader-3"),
      createEmployee("emp-trip-leader-4")
    ];
    const assignments = employees.map((employee, index) =>
      createAssignment(`assign-trip-leader-${index + 1}`, block.id, employee.id)
    );
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: assignments,
      employees,
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: [fieldTripType]
    });

    const violations = engine.evaluate(context);
    const tripViolations = violations.filter((violation) => violation.ruleId === "field-trip-ratios");
    expect(tripViolations).toHaveLength(1);
    expect(tripViolations[0].message).toContain("leaders");
  });

  test("does not require leaders when field trip leader ratio is disabled", () => {
    const fieldTripType: FieldTripType = {
      id: "trip-type-no-leader-ratio",
      name: "Community Walk",
      adultRatioAdults: 1,
      adultRatioStudents: 5, // 1:5 ratio (1 adult per 5 children)
      leaderRatioAdults: 1,
      leaderRatioStudents: 0, // disabled
      policyCitationId: "policy-field-trip",
      notes: undefined
    };
    const fieldTripEvent: FieldTripEvent = {
      id: "ft-event-no-leader-ratio",
      scheduleWeekId: "week-1",
      dayOfWeek: "thu" as DayOfWeek,
      segment: "open" as DaySegment,
      fieldTripTypeId: fieldTripType.id
    };
    const block = createSegmentBlock("block-trip-no-leader-ratio", {
      dayOfWeek: "thu",
      childCount: 20,
      fieldTripEventId: fieldTripEvent.id
    });
    const assignments = [
      createAssignment("assign-trip-no-leader-1", block.id, "emp-trip-no-leader-1"),
      createAssignment("assign-trip-no-leader-2", block.id, "emp-trip-no-leader-2"),
      createAssignment("assign-trip-no-leader-3", block.id, "emp-trip-no-leader-3"),
      createAssignment("assign-trip-no-leader-4", block.id, "emp-trip-no-leader-4")
    ];
    const employees = [
      createEmployee("emp-trip-no-leader-1"),
      createEmployee("emp-trip-no-leader-2"),
      createEmployee("emp-trip-no-leader-3"),
      createEmployee("emp-trip-no-leader-4")
    ];
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: assignments,
      employees,
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: [fieldTripType]
    });

    const violations = engine.evaluate(context);
    const tripViolations = violations.filter((violation) => violation.ruleId === "field-trip-ratios");
    expect(tripViolations).toHaveLength(0);
  });

  test("flags schedule days missing critical metadata", () => {
    const incompleteDay = createScheduleDay("day-missing", {
      scheduleType: undefined,
      enrollmentCount: undefined,
      fieldTripEventId: undefined
    });
    const context: RulesContext = withDefaultScheduleInfo({
      scheduleDays: [incompleteDay],
      segmentBlocks: [],
      staffAssignments: [],
      employees: [],
      fieldTripEvents: [],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const dayViolations = violations.filter((violation) => violation.ruleId === "schedule-day-metadata");
    expect(dayViolations).toHaveLength(3);
    expect(dayViolations.map((violation) => violation.target.metadata)).toEqual([
      { missing: ["scheduleType"] },
      { missing: ["enrollmentCount"] },
      { missing: ["fieldTripEventId"] }
    ]);
  });

  test("passes schedule days with complete metadata", () => {
    const fieldTripEvent = createFieldTripEvent("ft-day-valid", {
      isNoFieldTrip: true,
      scheduleDayId: "day-valid"
    });
    const validDay = createScheduleDay("day-valid", {
      scheduleType: "extended",
      enrollmentCount: 30,
      fieldTripEventId: fieldTripEvent.id
    });
    const context: RulesContext = withDefaultScheduleInfo({
      scheduleDays: [validDay],
      segmentBlocks: [],
      staffAssignments: [],
      employees: [],
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const dayViolations = violations.filter((violation) => violation.ruleId === "schedule-day-metadata");
    expect(dayViolations).toHaveLength(0);
  });

  test("reports schedule days referencing missing field trip events", () => {
    const day = createScheduleDay("day-missing-event", {
      fieldTripEventId: "ft-missing"
    });
    const context: RulesContext = withDefaultScheduleInfo({
      scheduleDays: [day],
      segmentBlocks: [],
      staffAssignments: [],
      employees: [],
      fieldTripEvents: [],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const dayViolation = violations.find(
      (violation) =>
        violation.ruleId === "schedule-day-metadata" && violation.target.id === day.id
    );
    expect(dayViolation).toBeDefined();
    expect(dayViolation?.target.metadata).toEqual({ fieldTripEventId: "ft-missing" });
  });

  test("treats missing field trip type as no-trip by default", () => {
    const fieldTripEvent = createFieldTripEvent("ft-event-missing-meta", {
      scheduleDayId: "day-ft-missing",
      isNoFieldTrip: false
    });
    const day = createScheduleDay("day-ft-missing", {
      fieldTripEventId: fieldTripEvent.id
    });
    const context: RulesContext = withDefaultScheduleInfo({
      scheduleDays: [day],
      segmentBlocks: [],
      staffAssignments: [],
      employees: [],
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const eventViolation = violations.find((violation) => violation.ruleId === "field-trip-event");
    expect(eventViolation).toBeUndefined();
  });

  test("allows field trip events that point to configured types", () => {
    const fieldTripType: FieldTripType = {
      id: "trip-type-guard",
      name: "Guarded Trip",
      adultRatioAdults: 1,
      adultRatioStudents: 5, // 1:5 ratio (1 adult per 5 children)
      leaderRatioAdults: 1,
      leaderRatioStudents: 10, // 1:10 ratio (1 leader per 10 children)
      policyCitationId: "policy-field-trip",
      notes: undefined
    };
    const fieldTripEvent = createFieldTripEvent("ft-event-sourced", {
      scheduleDayId: "day-ft-sourced",
      fieldTripTypeId: fieldTripType.id
    });
    const day = createScheduleDay("day-ft-sourced", {
      fieldTripEventId: fieldTripEvent.id
    });
    const context: RulesContext = withDefaultScheduleInfo({
      scheduleDays: [day],
      segmentBlocks: [],
      staffAssignments: [],
      employees: [],
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: [fieldTripType]
    });

    const violations = engine.evaluate(context);
    const eventViolation = violations.find((violation) => violation.ruleId === "field-trip-event");
    expect(eventViolation).toBeUndefined();
  });

  test("skips validation when field trip declares no trip", () => {
    const fieldTripEvent = createFieldTripEvent("ft-event-no-trip", {
      scheduleDayId: "day-ft-no-trip",
      isNoFieldTrip: true
    });
    const day = createScheduleDay("day-ft-no-trip", {
      fieldTripEventId: fieldTripEvent.id
    });
    const context: RulesContext = withDefaultScheduleInfo({
      scheduleDays: [day],
      segmentBlocks: [],
      staffAssignments: [],
      employees: [],
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const eventViolation = violations.find(
      (violation) =>
        violation.ruleId === "field-trip-event" && violation.target.id === fieldTripEvent.id
    );
    expect(eventViolation).toBeUndefined();
  });

  test("flags field trip events referencing unknown types", () => {
    const fieldTripEvent = createFieldTripEvent("ft-event-unknown", {
      scheduleDayId: "day-ft-unknown",
      fieldTripTypeId: "missing-type",
      approverId: "director",
      signedOffAt: "2026-02-05T09:00:00Z"
    });
    const day = createScheduleDay("day-ft-unknown", {
      fieldTripEventId: fieldTripEvent.id
    });
    const context: RulesContext = withDefaultScheduleInfo({
      scheduleDays: [day],
      segmentBlocks: [],
      staffAssignments: [],
      employees: [],
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const eventViolation = violations.find((violation) => violation.ruleId === "field-trip-event");
    expect(eventViolation).toBeDefined();
    expect(eventViolation?.target.metadata).toEqual({
      fieldTripTypeId: "missing-type",
      dayOfWeek: "mon"
    });
  });

  test("flags segment blocks with invalid time windows", () => {
    const invalidBlock = createSegmentBlock("block-invalid-window", {
      startTime: "12:00",
      endTime: "10:00"
    });
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [invalidBlock],
      staffAssignments: [],
      employees: [],
      fieldTripEvents: [],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const timelineViolations = violations.filter((violation) => violation.ruleId === "segment-block-timeline");
    expect(timelineViolations).toHaveLength(1);
    expect(timelineViolations[0].target.id).toBe(invalidBlock.id);
    expect(timelineViolations[0].target.metadata).toEqual({
      startTime: invalidBlock.startTime,
      endTime: invalidBlock.endTime,
      dayOfWeek: "mon"
    });
    expect(timelineViolations[0].message).toContain("invalid window");
  });

  test("flags assignments scheduled on an employee requested day off", () => {
    const day = createScheduleDay("day-timeoff", {
      date: "2026-02-16",
      dayOfWeek: "mon"
    });
    const block = createSegmentBlock("block-timeoff", {
      dayOfWeek: "mon",
      scheduleDayId: day.id
    });
    const assignment = createAssignment("assign-timeoff", block.id, "emp-timeoff");
    const employee = createEmployee("emp-timeoff", {
      requestedDaysOff: [{ id: "off-1", startDate: "2026-02-15", endDate: "2026-02-18", note: "Personal" }]
    });
    const context: RulesContext = withDefaultScheduleInfo({
      scheduleDays: [day],
      segmentBlocks: [block],
      staffAssignments: [assignment],
      employees: [employee]
    });

    const violations = engine.evaluate(context);
    const availabilityViolation = violations.find((violation) => violation.ruleId === "employee-availability");
    expect(availabilityViolation).toBeDefined();
    expect(availabilityViolation?.message).toContain("requested day off");
    expect(availabilityViolation?.target.id).toBe(assignment.id);
  });

  test("flags assignments outside configured availability windows", () => {
    const day = createScheduleDay("day-availability", {
      dayOfWeek: "mon"
    });
    const block = createSegmentBlock("block-availability", {
      dayOfWeek: "mon",
      scheduleDayId: day.id
    });
    const assignment = createAssignment("assign-availability", block.id, "emp-availability", {
      startTime: "12:00",
      endTime: "14:00"
    });
    const employee = createEmployee("emp-availability", {
      availability: [
        {
          dayOfWeek: "mon",
          blocks: [{ startTime: "08:00", endTime: "11:00" }]
        }
      ]
    });
    const context: RulesContext = withDefaultScheduleInfo({
      scheduleDays: [day],
      segmentBlocks: [block],
      staffAssignments: [assignment],
      employees: [employee]
    });

    const violations = engine.evaluate(context);
    const availabilityViolation = violations.find((violation) => violation.ruleId === "employee-availability");
    expect(availabilityViolation).toBeDefined();
    expect(availabilityViolation?.message).toContain("outside availability");
    expect(availabilityViolation?.target.id).toBe(assignment.id);
  });

  test("flags overlapping assignments for the same employee/day", () => {
    const dayId = "day-timeline-overlap";
    const fieldTripEvent = createFieldTripEvent("ft-day-timeline", {
      scheduleDayId: dayId,
      isNoFieldTrip: true
    });
    const scheduleDay = createScheduleDay(dayId, {
      scheduleType: "regular",
      enrollmentCount: 15,
      fieldTripEventId: fieldTripEvent.id
    });
    const firstBlock = createSegmentBlock("block-timeline-first", {
      scheduleDayId: dayId,
      startTime: "08:00",
      endTime: "10:00"
    });
    const overlappingBlock = createSegmentBlock("block-timeline-overlap", {
      scheduleDayId: dayId,
      startTime: "09:30",
      endTime: "11:00"
    });
    const context: RulesContext = withDefaultScheduleInfo({
      scheduleDays: [scheduleDay],
      segmentBlocks: [firstBlock, overlappingBlock],
      staffAssignments: [
        createAssignment("assign-overlap-first", firstBlock.id, "emp-overlap", {
          startTime: "08:00",
          endTime: "10:00"
        }),
        createAssignment("assign-overlap-second", overlappingBlock.id, "emp-overlap", {
          startTime: "09:30",
          endTime: "11:00"
        })
      ],
      employees: [createEmployee("emp-overlap", { name: "Taylor" })],
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const timelineViolations = violations.filter((violation) => violation.ruleId === "segment-block-timeline");
    expect(timelineViolations).toHaveLength(1);
    expect(timelineViolations[0].target.entity).toBe("StaffAssignment");
    expect(timelineViolations[0].target.metadata).toEqual({
      overlapsWithAssignmentId: "assign-overlap-first",
      relatedSegmentBlockIds: [overlappingBlock.id, firstBlock.id],
      dayOfWeek: "mon"
    });
    expect(timelineViolations[0].message).toContain("overlapping clock blocks");
  });

  test("flags segment blocks that start before operating hours", () => {
    const customHours = createOperatingHours({
      dayOfWeek: "mon",
      dayScheduleType: "full_day",
      open: "07:00",
      close: "17:00",
      id: "operating-custom-start"
    });
    const earlyBlock = createSegmentBlock("block-before-open", {
      scheduleDayId: defaultScheduleDay.id,
      startTime: "06:30",
      endTime: "09:00"
    });
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [earlyBlock],
      staffAssignments: [],
      employees: [],
      fieldTripEvents: [],
      fieldTripTypes: [],
      operatingHours: [customHours]
    });

    const violations = engine.evaluate(context);
    const timelineViolations = violations.filter((violation) => violation.ruleId === "segment-block-timeline");
    expect(timelineViolations).toHaveLength(1);
    expect(timelineViolations[0].message).toContain("starts before operating hours");
    expect(timelineViolations[0].target.metadata).toEqual({
      operatingHoursId: customHours.id,
      startTime: earlyBlock.startTime,
      boundary: customHours.open,
      dayOfWeek: "mon"
    });
  });

  test("flags segment blocks that end after operating hours", () => {
    const customHours = createOperatingHours({
      dayOfWeek: "mon",
      dayScheduleType: "full_day",
      open: "06:00",
      close: "12:00",
      id: "operating-custom-end"
    });
    const lateBlock = createSegmentBlock("block-after-close", {
      scheduleDayId: defaultScheduleDay.id,
      startTime: "10:00",
      endTime: "13:00"
    });
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [lateBlock],
      staffAssignments: [],
      employees: [],
      fieldTripEvents: [],
      fieldTripTypes: [],
      operatingHours: [customHours]
    });

    const violations = engine.evaluate(context);
    const timelineViolations = violations.filter((violation) => violation.ruleId === "segment-block-timeline");
    expect(timelineViolations).toHaveLength(1);
    expect(timelineViolations[0].message).toContain("ends after operating hours");
    expect(timelineViolations[0].target.metadata).toEqual({
      operatingHoursId: customHours.id,
      endTime: lateBlock.endTime,
      boundary: customHours.close,
      dayOfWeek: "mon"
    });
  });

  test("flags missing opener coverage when opener count is not met", () => {
    const day = createScheduleDay("day-openers", { dayOfWeek: "mon", dayScheduleType: "full_day" });
    const block = createSegmentBlock("block-openers", { dayOfWeek: "mon" });
    const employee = createEmployee("emp-open-1");
    const assignment = createAssignment("assign-open-1", block.id, employee.id, {
      startTime: "06:00",
      endTime: "09:00"
    });
    const context: RulesContext = withDefaultScheduleInfo({
      scheduleDays: [day],
      segmentBlocks: [block],
      staffAssignments: [assignment],
      employees: [employee],
      schoolRules: {
        openerCount: 2,
        closerCount: 0,
        minimumMedicalDelegated: 0,
        requireCurrentCpr: false
      }
    });

    const violations = engine.evaluate(context);
    const openers = violations.filter((violation) => violation.ruleId === "open-close-coverage");
    expect(openers.some((violation) => violation.target.metadata?.type === "opener")).toBe(true);
  });

  test("requires a leader-qualified opener when job rules demand it", () => {
    const day = createScheduleDay("day-leader-open", { dayOfWeek: "mon", dayScheduleType: "full_day" });
    const block = createSegmentBlock("block-leader-open", { dayOfWeek: "mon" });
    const employee = createEmployee("emp-assistant-open", { jobTitle: "Assistant" });
    const assignment = createAssignment("assign-assistant-open", block.id, employee.id, {
      startTime: "06:00",
      endTime: "09:00"
    });
    const context: RulesContext = withDefaultScheduleInfo({
      scheduleDays: [day],
      segmentBlocks: [block],
      staffAssignments: [assignment],
      employees: [employee],
      jobTitleRules: {
        Assistant: { requiresLeaderForOpenClose: true }
      },
      schoolRules: {
        openerCount: 1,
        closerCount: 0,
        minimumMedicalDelegated: 0,
        requireCurrentCpr: false
      }
    });

    const violations = engine.evaluate(context);
    const leaderViolation = violations.find(
      (violation) =>
        violation.ruleId === "open-close-coverage" &&
        violation.target.metadata?.type === "opener" &&
        violation.target.metadata?.requiresLeader === true
    );
    expect(leaderViolation).toBeDefined();
  });

  test("requires opener overlap, not just unique opener count in the window", () => {
    const day = createScheduleDay("day-opener-overlap", { dayOfWeek: "mon", dayScheduleType: "full_day" });
    const block = createSegmentBlock("block-opener-overlap", { dayOfWeek: "mon" });
    const first = createEmployee("emp-open-overlap-1");
    const second = createEmployee("emp-open-overlap-2");
    const firstAssignment = createAssignment("assign-open-overlap-1", block.id, first.id, {
      startTime: "06:00",
      endTime: "06:07"
    });
    const secondAssignment = createAssignment("assign-open-overlap-2", block.id, second.id, {
      startTime: "06:08",
      endTime: "06:15"
    });
    const context: RulesContext = withDefaultScheduleInfo({
      scheduleDays: [day],
      segmentBlocks: [block],
      staffAssignments: [firstAssignment, secondAssignment],
      employees: [first, second],
      schoolRules: {
        openerCount: 2,
        closerCount: 0,
        minimumMedicalDelegated: 0,
        requireCurrentCpr: false,
        openerWindowMinutes: 15
      }
    });

    const violations = engine.evaluate(context);
    const openerCoverageViolation = violations.find(
      (violation) => violation.ruleId === "open-close-coverage" && violation.target.metadata?.type === "opener"
    );
    expect(openerCoverageViolation).toBeDefined();
  });

  test("counts medically delegated coverage by overlap even when assignment is anchored to another segment block", () => {
    const day = createScheduleDay("day-medical-overlap", { dayOfWeek: "mon", dayScheduleType: "full_day" });
    const openBlock = createSegmentBlock("block-medical-open", {
      dayOfWeek: "mon",
      segment: "open",
      startTime: "06:30",
      endTime: "10:15"
    });
    const midBlock = createSegmentBlock("block-medical-mid", {
      dayOfWeek: "mon",
      segment: "mid",
      startTime: "10:15",
      endTime: "14:15"
    });
    const medEmployee = createEmployee("emp-medical-overlap", {
      medicallyDelegated: true,
      cprCurrent: true
    });
    const mergedStyleAssignment = createAssignment("assign-medical-overlap", openBlock.id, medEmployee.id, {
      startTime: "06:30",
      endTime: "14:15"
    });
    const context: RulesContext = withDefaultScheduleInfo({
      scheduleDays: [day],
      segmentBlocks: [openBlock, midBlock],
      staffAssignments: [mergedStyleAssignment],
      employees: [medEmployee],
      schoolRules: {
        openerCount: 0,
        closerCount: 0,
        minimumMedicalDelegated: 1,
        requireCurrentCpr: false
      }
    });

    const violations = engine.evaluate(context);
    const medicalViolations = violations.filter((violation) => violation.ruleId === "medical-delegated-coverage");
    expect(medicalViolations).toHaveLength(0);
  });

  test("blocks assignments when current CPR is required", () => {
    const block = createSegmentBlock("block-cpr", { dayOfWeek: "mon" });
    const employee = createEmployee("emp-cpr", { cprCurrent: false });
    const assignment = createAssignment("assign-cpr", block.id, employee.id);
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: [assignment],
      employees: [employee],
      schoolRules: {
        openerCount: 0,
        closerCount: 0,
        minimumMedicalDelegated: 0,
        requireCurrentCpr: true
      }
    });

    const violations = engine.evaluate(context);
    expect(violations.some((violation) => violation.ruleId === "cpr-current-required")).toBe(true);
  });
});
