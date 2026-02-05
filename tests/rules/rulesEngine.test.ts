import { RulesEngine } from "../../src/rules";
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
  SegmentRequirementTemplate,
  StaffAssignment,
  SubstituteRequest
} from "../../src/domain/types";
import type { RulesContext } from "../../src/rules/types";

const createRequirementTemplate = (
  overrides: Partial<SegmentRequirementTemplate> = {}
): SegmentRequirementTemplate => ({
  id: overrides.id ?? "req-base",
  ratioProfile: {
    id: "ratio-base",
    childrenPerStaff: 8,
    leaderRequired: false,
    policyCitationId: "policy-ratio"
  },
  minStaff: 0,
  requiresCpr: false,
  requiresMedicalDelegation: false,
  requiresLeader: false,
  policyCitationId: "policy-ratio",
  ...overrides
});

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
  requirementTemplate: createRequirementTemplate(),
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
  isSubstitute: false,
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
  ...overrides
});

const defaultFieldTripEvent = createFieldTripEvent("ft-default", {
  isNoFieldTrip: true,
  scheduleDayId: "day-default"
});
const defaultScheduleDay = createScheduleDay("day-default", {
  fieldTripEventId: defaultFieldTripEvent.id
});

const withDefaultScheduleInfo = (context: Partial<RulesContext>): RulesContext => {
  const mergedFieldTripEvents = [
    defaultFieldTripEvent,
    ...(context.fieldTripEvents ?? []).filter((event) => event.id !== defaultFieldTripEvent.id)
  ];
  return {
    segmentBlocks: context.segmentBlocks ?? [],
    staffAssignments: context.staffAssignments ?? [],
    employees: context.employees ?? [],
    substituteRequests: context.substituteRequests ?? [],
    fieldTripEvents: mergedFieldTripEvents,
    fieldTripTypes: context.fieldTripTypes ?? [],
    scheduleDays: context.scheduleDays ?? [defaultScheduleDay],
    policyCitations: context.policyCitations,
    rulePolicyCitations: context.rulePolicyCitations
  };
};

const engine = new RulesEngine();

describe("RulesEngine", () => {
  test("flags ratio violations when assigned staff < required", () => {
    const block = createSegmentBlock("block-ratio", {
      childCount: 18,
      requirementTemplate: createRequirementTemplate({ minStaff: 0 })
    });
    const assignment = createAssignment("assign-ratio", block.id, "emp-ratio");
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: [assignment],
      employees: [createEmployee("emp-ratio")],
      substituteRequests: [],
      fieldTripEvents: [],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const ratioViolations = violations.filter((violation) => violation.ruleId === "ratio-segment");
    expect(ratioViolations).toHaveLength(1);
    expect(ratioViolations[0].target.id).toBe(block.id);
  });

  test("allows ratio compliance when ratio and minimums are met", () => {
    const block = createSegmentBlock("block-ratio-clean", {
      childCount: 24,
      requirementTemplate: createRequirementTemplate({ minStaff: 3 })
    });
    const employees = [
      createEmployee("emp-ratio-clean-1"),
      createEmployee("emp-ratio-clean-2"),
      createEmployee("emp-ratio-clean-3")
    ];
    const assignments = employees.map((employee, index) =>
      createAssignment(`assign-ratio-clean-${index + 1}`, block.id, employee.id)
    );
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: assignments,
      employees,
      substituteRequests: [],
      fieldTripEvents: [],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const ratioViolations = violations.filter((violation) => violation.ruleId === "ratio-segment");
    expect(ratioViolations).toHaveLength(0);
  });

  test("skips segment ratio checks for field-trip overrides", () => {
    const fieldTripType: FieldTripType = {
      id: "trip-type-skip",
      name: "Museum Express",
      minAdultStudentRatio: 0.2,
      minLeaderStudentRatio: 0.1,
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
      substituteRequests: [],
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: [fieldTripType]
    });

    const violations = engine.evaluate(context);
    const ratioViolations = violations.filter((violation) => violation.ruleId === "ratio-segment");
    expect(ratioViolations).toHaveLength(0);
    const tripViolations = violations.filter((violation) => violation.ruleId === "field-trip-ratios");
    expect(tripViolations.length).toBeGreaterThan(0);
    expect(tripViolations.every((v) => v.target.id === block.id)).toBe(true);
  });

  test("detects missing certifications when multiple flags are required", () => {
    const block = createSegmentBlock("block-cert", {
      requirementTemplate: createRequirementTemplate({
        requiresCpr: true,
        requiresMedicalDelegation: true,
        requiresLeader: true
      })
    });
    const assignment = createAssignment("assign-cert", block.id, "emp-cert");
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: [assignment],
      employees: [createEmployee("emp-cert", { cprCurrent: false })],
      substituteRequests: [],
      fieldTripEvents: [],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const certViolations = violations.filter((violation) => violation.ruleId === "certification-per-segment");
    expect(certViolations).toHaveLength(3);
    expect(certViolations.some((v) => v.message.includes("CPR"))).toBe(true);
    expect(certViolations.some((v) => v.message.includes("medically delegated"))).toBe(true);
    expect(certViolations.some((v) => v.message.includes("leader-qualified"))).toBe(true);
  });

  test("clears certification requirements when qualified staff are assigned", () => {
    const block = createSegmentBlock("block-cert-clean", {
      requirementTemplate: createRequirementTemplate({
        requiresCpr: true,
        requiresMedicalDelegation: true,
        requiresLeader: true
      })
    });
    const assignment = createAssignment("assign-cert-clean", block.id, "emp-cert-clean");
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: [assignment],
      employees: [
        createEmployee("emp-cert-clean", {
          cprCurrent: true,
          medicallyDelegated: true,
          leaderQualified: true
        })
      ],
      substituteRequests: [],
      fieldTripEvents: [],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const certViolations = violations.filter((violation) => violation.ruleId === "certification-per-segment");
    expect(certViolations).toHaveLength(0);
  });

  test("flags segment coverage violations when required roles are absent", () => {
    const block = createSegmentBlock("block-coverage", {
      requirementTemplate: createRequirementTemplate({
        requiresLeader: true,
        requiresMedicalDelegation: true
      })
    });
    const assignment = createAssignment("assign-coverage", block.id, "emp-coverage");
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: [assignment],
      employees: [createEmployee("emp-coverage")],
      substituteRequests: [],
      fieldTripEvents: [],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const coverageViolations = violations.filter((violation) => violation.ruleId === "segment-coverage");
    expect(coverageViolations).toHaveLength(2);
    expect(coverageViolations.some((v) => v.message.includes("leader-qualified"))).toBe(true);
    expect(coverageViolations.some((v) => v.message.includes("medically delegated"))).toBe(true);
  });

  test("passes segment coverage when leader and medical staff are assigned", () => {
    const block = createSegmentBlock("block-coverage-clean", {
      requirementTemplate: createRequirementTemplate({
        requiresLeader: true,
        requiresMedicalDelegation: true
      })
    });
    const assignment = createAssignment("assign-coverage-clean", block.id, "emp-coverage-clean");
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: [assignment],
      employees: [
        createEmployee("emp-coverage-clean", {
          leaderQualified: true,
          medicallyDelegated: true
        })
      ],
      substituteRequests: [],
      fieldTripEvents: [],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const coverageViolations = violations.filter((violation) => violation.ruleId === "segment-coverage");
    expect(coverageViolations).toHaveLength(0);
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
      substituteRequests: [],
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
      substituteRequests: [],
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
      substituteRequests: [],
      fieldTripEvents: [],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const shiftViolations = violations.filter((violation) => violation.ruleId === "shift-break-limits");
    expect(shiftViolations).toHaveLength(1);
    expect(shiftViolations[0].message).toContain("weekly limit");
  });

  test("flags substitute assignments missing requests", () => {
    const block = createSegmentBlock("block-sub");
    const assignment = createAssignment("assign-sub", block.id, "emp-sub", {
      isSubstitute: true,
      substituteRequestId: "req-missing"
    });
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: [assignment],
      employees: [createEmployee("emp-sub")],
      substituteRequests: [],
      fieldTripEvents: [],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const substituteViolations = violations.filter((violation) => violation.ruleId === "substitute-parity");
    expect(substituteViolations).toHaveLength(1);
    expect(substituteViolations[0].target.metadata).toEqual({ missing: ["substituteRequest"] });
  });

  test("passes substitute parity when approved metadata is present", () => {
    const block = createSegmentBlock("block-sub-clean");
    const substituteRequest: SubstituteRequest = {
      id: "req-approved",
      originalAssignmentId: "assign-sub-clean",
      segmentBlockId: block.id,
      replacementEmployeeId: "emp-sub-clean",
      requestedBy: "director",
      requestedAt: "2026-02-01T09:00:00Z",
      state: "approved",
      reason: "fill coverage gap",
      approverId: "approver-1",
      approvedAt: "2026-02-01T10:00:00Z",
      policyCitationId: "policy-substitute"
    };
    const assignment = createAssignment("assign-sub-clean", block.id, substituteRequest.replacementEmployeeId, {
      isSubstitute: true,
      substituteRequestId: substituteRequest.id
    });
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: [assignment],
      employees: [createEmployee(substituteRequest.replacementEmployeeId)],
      substituteRequests: [substituteRequest],
      fieldTripEvents: [],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const substituteViolations = violations.filter((violation) => violation.ruleId === "substitute-parity");
    expect(substituteViolations).toHaveLength(0);
  });

  test("reports substitute parity violations when approval metadata is incomplete", () => {
    const block = createSegmentBlock("block-sub-incomplete");
    const substituteRequest: SubstituteRequest = {
      id: "req-pending",
      originalAssignmentId: "assign-sub-incomplete",
      segmentBlockId: block.id,
      replacementEmployeeId: "emp-sub-incomplete",
      requestedBy: "director",
      requestedAt: "2026-02-01T09:00:00Z",
      state: "pending",
      reason: "fill coverage gap",
      policyCitationId: "policy-substitute"
    };
    const assignment = createAssignment("assign-sub-incomplete", block.id, substituteRequest.replacementEmployeeId, {
      isSubstitute: true,
      substituteRequestId: substituteRequest.id
    });
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: [assignment],
      employees: [createEmployee(substituteRequest.replacementEmployeeId)],
      substituteRequests: [substituteRequest],
      fieldTripEvents: [],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const substituteViolations = violations.filter((violation) => violation.ruleId === "substitute-parity");
    expect(substituteViolations).toHaveLength(1);
    expect(substituteViolations[0].target.metadata).toEqual({
      missing: ["state", "approverId", "approvedAt"]
    });
  });

  test("enforces field trip ratio minima", () => {
    const fieldTripType: FieldTripType = {
      id: "trip-type-1",
      name: "Museum",
      minAdultStudentRatio: 0.2,
      minLeaderStudentRatio: 0.1,
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
      isSubstitute: false
    });
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: [assignment],
      employees: [createEmployee("emp-trip", { leaderQualified: true })],
      substituteRequests: [],
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: [fieldTripType]
    });

    const violations = engine.evaluate(context);
    const tripViolations = violations.filter((violation) => violation.ruleId === "field-trip-ratios");
    expect(tripViolations.length).toBe(2);
    expect(tripViolations.every((v) => v.target.id === block.id)).toBe(true);
  });

  test("passes field trip ratios when adult and leader counts meet minima", () => {
    const fieldTripType: FieldTripType = {
      id: "trip-type-2",
      name: "Zoo",
      minAdultStudentRatio: 0.2,
      minLeaderStudentRatio: 0.1,
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
      createAssignment(`assign-trip-clean-${index + 1}`, block.id, employee.id, { isSubstitute: false })
    );
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: assignments,
      employees,
      substituteRequests: [],
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
      minAdultStudentRatio: 0.2,
      minLeaderStudentRatio: 0.1,
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
      createAssignment(`assign-trip-leader-${index + 1}`, block.id, employee.id, { isSubstitute: false })
    );
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [block],
      staffAssignments: assignments,
      employees,
      substituteRequests: [],
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: [fieldTripType]
    });

    const violations = engine.evaluate(context);
    const tripViolations = violations.filter((violation) => violation.ruleId === "field-trip-ratios");
    expect(tripViolations).toHaveLength(1);
    expect(tripViolations[0].message).toContain("leaders");
  });

  test("flags field trips missing sign-off metadata", () => {
    const fieldTripType: FieldTripType = {
      id: "trip-type-1",
      name: "Field Trip Base",
      minAdultStudentRatio: 0.2,
      minLeaderStudentRatio: 0.1,
      policyCitationId: "policy-field-trip",
      notes: undefined
    };
    const fieldTripEvent: FieldTripEvent = {
      id: "ft-event-2",
      scheduleWeekId: "week-1",
      dayOfWeek: "wed" as DayOfWeek,
      segment: "mid" as DaySegment,
      fieldTripTypeId: "trip-type-1"
    };
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [],
      staffAssignments: [],
      employees: [],
      substituteRequests: [],
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: [fieldTripType]
    });

    const violations = engine.evaluate(context);
    const signOff = violations.find((violation) => violation.ruleId === "field-trip-signoff");
    expect(signOff).toBeDefined();
    expect(signOff?.target.metadata).toEqual({ missing: ["approverId", "signedOffAt"] });
  });

  test("allows field trips with sign-off metadata to pass", () => {
    const fieldTripType: FieldTripType = {
      id: "trip-type-1",
      name: "Field Trip Base",
      minAdultStudentRatio: 0.2,
      minLeaderStudentRatio: 0.1,
      policyCitationId: "policy-field-trip",
      notes: undefined
    };
    const fieldTripEvent: FieldTripEvent = {
      id: "ft-event-4",
      scheduleWeekId: "week-1",
      dayOfWeek: "fri" as DayOfWeek,
      segment: "close" as DaySegment,
      fieldTripTypeId: "trip-type-1",
      approverId: "director",
      signedOffAt: "2026-02-04T10:00:00Z"
    };
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [],
      staffAssignments: [],
      employees: [],
      substituteRequests: [],
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: [fieldTripType]
    });

    const violations = engine.evaluate(context);
    const signOff = violations.find((violation) => violation.ruleId === "field-trip-signoff");
    expect(signOff).toBeUndefined();
  });

  test("reports sign-off violations when approver metadata alone is missing", () => {
    const fieldTripType: FieldTripType = {
      id: "trip-type-1",
      name: "Field Trip Base",
      minAdultStudentRatio: 0.2,
      minLeaderStudentRatio: 0.1,
      policyCitationId: "policy-field-trip",
      notes: undefined
    };
    const fieldTripEvent: FieldTripEvent = {
      id: "ft-event-6",
      scheduleWeekId: "week-1",
      dayOfWeek: "fri" as DayOfWeek,
      segment: "open" as DaySegment,
      fieldTripTypeId: "trip-type-1",
      signedOffAt: "2026-02-04T12:00:00Z"
    };
    const context: RulesContext = withDefaultScheduleInfo({
      segmentBlocks: [],
      staffAssignments: [],
      employees: [],
      substituteRequests: [],
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: [fieldTripType]
    });

    const violations = engine.evaluate(context);
    const signOff = violations.find((violation) => violation.ruleId === "field-trip-signoff");
    expect(signOff).toBeDefined();
    expect(signOff?.target.metadata).toEqual({ missing: ["approverId"] });
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
      substituteRequests: [],
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
      substituteRequests: [],
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const dayViolations = violations.filter((violation) => violation.ruleId === "schedule-day-metadata");
    expect(dayViolations).toHaveLength(0);
  });

  test("flags field trip events that neither declare no-trip nor point to a type", () => {
    const fieldTripEvent = createFieldTripEvent("ft-event-missing-meta", {
      scheduleDayId: "day-ft-missing"
    });
    const day = createScheduleDay("day-ft-missing", {
      fieldTripEventId: fieldTripEvent.id
    });
    const context: RulesContext = withDefaultScheduleInfo({
      scheduleDays: [day],
      segmentBlocks: [],
      staffAssignments: [],
      employees: [],
      substituteRequests: [],
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: []
    });

    const violations = engine.evaluate(context);
    const eventViolation = violations.find((violation) => violation.ruleId === "field-trip-event");
    expect(eventViolation).toBeDefined();
    expect(eventViolation?.target.metadata).toEqual({ missing: ["fieldTripTypeId", "isNoFieldTrip"] });
  });

  test("allows field trip events that point to configured types", () => {
    const fieldTripType: FieldTripType = {
      id: "trip-type-guard",
      name: "Guarded Trip",
      minAdultStudentRatio: 0.2,
      minLeaderStudentRatio: 0.1,
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
      substituteRequests: [],
      fieldTripEvents: [fieldTripEvent],
      fieldTripTypes: [fieldTripType]
    });

    const violations = engine.evaluate(context);
    const eventViolation = violations.find((violation) => violation.ruleId === "field-trip-event");
    expect(eventViolation).toBeUndefined();
  });
});
