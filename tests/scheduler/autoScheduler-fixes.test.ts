import { autoSchedule } from "@core/scheduler";
import type { AutoSchedulerContext } from "@core/scheduler/autoScheduler";
import type {
  DayOfWeek,
  Employee,
  FieldTripEvent,
  OperatingHours,
  ScheduleDay
} from "@core/domain/types";

const createScheduleDay = (
  id: string,
  dayOfWeek: DayOfWeek,
  date: string,
  overrides: Partial<ScheduleDay> = {}
): ScheduleDay => ({
  id,
  scheduleWeekId: "week-test-2026-02-16",
  date,
  dayOfWeek,
  scheduleType: "full_day",
  enrollmentCount: 20,
  enrollmentSource: "manual_adjustment",
  dayScheduleType: "full_day",
  ...overrides
});

const createEmployee = (
  id: string,
  name: string,
  overrides: Partial<Employee> = {}
): Employee => ({
  id,
  name,
  jobTitle: "Teacher",
  maxHoursPerDay: 8,
  maxHoursPerWeek: 40,
  employmentStatus: "active",
  leaderQualified: false,
  medicallyDelegated: false,
  cprCurrent: true,
  availability: [],
  requestedDaysOff: [],
  ...overrides
});

const createOperatingHours = (
  id: string,
  dayOfWeek: DayOfWeek,
  open: string,
  close: string,
  overrides: Partial<OperatingHours> = {}
): OperatingHours => ({
  id,
  schoolId: "school-test",
  dayOfWeek,
  dayScheduleType: "full_day",
  open,
  close,
  ...overrides
});

const createFieldTripEvent = (
  id: string,
  dayOfWeek: DayOfWeek,
  overrides: Partial<FieldTripEvent> = {}
): FieldTripEvent => ({
  id,
  scheduleWeekId: "week-test-2026-02-16",
  dayOfWeek,
  segment: "mid",
  isNoFieldTrip: true,
  ...overrides
});

describe("autoSchedule - Time Off Fixes", () => {
  it("should NOT schedule an employee who has requested time off", () => {
    // Employee has requested Monday off
    const context: AutoSchedulerContext = {
      scheduleDays: [
        createScheduleDay("day-mon", "mon", "2026-02-16", {
          scheduleType: "full_day",
          enrollmentCount: 10
        })
      ],
      segmentBlocks: [],
      staffAssignments: [],
      employees: [
        createEmployee("emp-alice", "Alice", {
          leaderQualified: true,
          cprCurrent: true,
          requestedDaysOff: [
            {
              id: "time-off-1",
              startDate: "2026-02-16",
              endDate: "2026-02-16",
              note: "Personal day"
            }
          ]
        }),
        createEmployee("emp-bob", "Bob", {
          leaderQualified: true,
          cprCurrent: true
        })
      ],
      fieldTripEvents: [createFieldTripEvent("ft-mon", "mon")],
      operatingHours: [
        createOperatingHours("op-mon", "mon", "07:00", "18:00")
      ],
      scheduleTypeRatios: { full_day: 10 } // 1:10 ratio
    };

    const result = autoSchedule(context, "week-test-2026-02-16");

    // Alice should NOT be scheduled (she requested the day off)
    const aliceAssignments = result.staffAssignments.filter(
      a => a.employeeId === "emp-alice"
    );
    expect(aliceAssignments.length).toBe(0);

    // Bob should be scheduled instead
    const bobAssignments = result.staffAssignments.filter(
      a => a.employeeId === "emp-bob"
    );
    expect(bobAssignments.length).toBeGreaterThan(0);
  });

  it("should merge consecutive assignments for the same employee", () => {
    const context: AutoSchedulerContext = {
      scheduleDays: [
        createScheduleDay("day-mon", "mon", "2026-02-16", {
          scheduleType: "full_day",
          enrollmentCount: 5
        })
      ],
      segmentBlocks: [],
      staffAssignments: [],
      employees: [
        createEmployee("emp-alice", "Alice", {
          leaderQualified: true,
          cprCurrent: true,
          maxHoursPerDay: 12 // Can work all day
        })
      ],
      fieldTripEvents: [createFieldTripEvent("ft-mon", "mon")],
      operatingHours: [
        createOperatingHours("op-mon", "mon", "07:00", "18:00")
      ],
      scheduleTypeRatios: { full_day: 10 } // 1:10 ratio, only need 1 person
    };

    const result = autoSchedule(context, "week-test-2026-02-16");

    // Alice should have assignments
    const aliceAssignments = result.staffAssignments.filter(
      a => a.employeeId === "emp-alice"
    );
    
    // Should ideally be 1 merged assignment covering the whole day
    // (or at least fewer than 3 separate segment blocks)
    expect(aliceAssignments.length).toBeLessThanOrEqual(3);
    
    // If there are multiple assignments, they should not be consecutive
    if (aliceAssignments.length > 1) {
      for (let i = 0; i < aliceAssignments.length - 1; i++) {
        const current = aliceAssignments[i];
        const next = aliceAssignments[i + 1];
        // They should NOT end/start at the same time (would have been merged)
        expect(current.endTime).not.toBe(next.startTime);
      }
    }
  });

  it("should start from scratch and ignore existing assignments when startFromEmpty=true", () => {
    // Create existing assignments and blocks
    const existingBlock = {
      id: "existing-block-1",
      scheduleWeekId: "week-test-2026-02-16",
      scheduleDayId: "day-mon",
      dayOfWeek: "mon" as DayOfWeek,
      segment: "mid" as const,
      startTime: "10:00",
      endTime: "14:00",
      childCount: 10,
      status: "draft" as const
    };

    const existingAssignment = {
      id: "existing-assignment-1",
      segmentBlockId: "existing-block-1",
      employeeId: "emp-alice",
      assignmentSource: "manual_adjustment" as const,
      startTime: "10:00",
      endTime: "14:00",
      status: "scheduled" as const
    };

    const context: AutoSchedulerContext = {
      scheduleDays: [
        createScheduleDay("day-mon", "mon", "2026-02-16", {
          scheduleType: "full_day",
          enrollmentCount: 10
        })
      ],
      segmentBlocks: [existingBlock], // Existing blocks
      staffAssignments: [existingAssignment], // Existing assignments
      employees: [
        createEmployee("emp-alice", "Alice", {
          leaderQualified: true,
          cprCurrent: true
        }),
        createEmployee("emp-bob", "Bob", {
          leaderQualified: true,
          cprCurrent: true
        })
      ],
      fieldTripEvents: [createFieldTripEvent("ft-mon", "mon")],
      operatingHours: [
        createOperatingHours("op-mon", "mon", "07:00", "18:00")
      ],
      scheduleTypeRatios: { full_day: 10 }
    };

    // Call with startFromEmpty=true (default)
    const result = autoSchedule(context, "week-test-2026-02-16", true);

    // Should NOT include the existing block or assignment
    const hasExistingBlock = result.segmentBlocks.some(b => b.id === "existing-block-1");
    expect(hasExistingBlock).toBe(false);

    const hasExistingAssignment = result.staffAssignments.some(a => a.id === "existing-assignment-1");
    expect(hasExistingAssignment).toBe(false);

    // Should have generated new blocks and assignments
    expect(result.segmentBlocks.length).toBeGreaterThan(0);
    expect(result.staffAssignments.length).toBeGreaterThan(0);
  });

  it("should keep existing assignments when startFromEmpty=false", () => {
    // Create existing assignments and blocks
    const existingBlock = {
      id: "existing-block-1",
      scheduleWeekId: "week-test-2026-02-16",
      scheduleDayId: "day-mon",
      dayOfWeek: "mon" as DayOfWeek,
      segment: "mid" as const,
      startTime: "10:00",
      endTime: "14:00",
      childCount: 10,
      status: "draft" as const
    };

    const existingAssignment = {
      id: "existing-assignment-1",
      segmentBlockId: "existing-block-1",
      employeeId: "emp-alice",
      assignmentSource: "manual_adjustment" as const,
      startTime: "10:00",
      endTime: "14:00",
      status: "scheduled" as const
    };

    const context: AutoSchedulerContext = {
      scheduleDays: [
        createScheduleDay("day-mon", "mon", "2026-02-16", {
          scheduleType: "full_day",
          enrollmentCount: 10
        })
      ],
      segmentBlocks: [existingBlock],
      staffAssignments: [existingAssignment],
      employees: [
        createEmployee("emp-alice", "Alice", {
          leaderQualified: true,
          cprCurrent: true
        })
      ],
      fieldTripEvents: [createFieldTripEvent("ft-mon", "mon")],
      operatingHours: [
        createOperatingHours("op-mon", "mon", "07:00", "18:00")
      ],
      scheduleTypeRatios: { full_day: 10 }
    };

    // Call with startFromEmpty=false
    const result = autoSchedule(context, "week-test-2026-02-16", false);

    // Should keep the existing block and assignment
    const hasExistingBlock = result.segmentBlocks.some(b => b.id === "existing-block-1");
    expect(hasExistingBlock).toBe(true);

    const hasExistingAssignment = result.staffAssignments.some(a => a.id === "existing-assignment-1");
    expect(hasExistingAssignment).toBe(true);
  });
});
