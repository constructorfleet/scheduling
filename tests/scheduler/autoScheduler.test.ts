import { autoSchedule, validateDayMetadata } from "@core/scheduler";
import type { AutoSchedulerContext } from "@core/scheduler/autoScheduler";
import type {
  DayOfWeek,
  Employee,
  FieldTripEvent,
  OperatingHours,
  ScheduleDay
} from "@core/domain/types";

/**
 * Helper functions to create test data
 */
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

describe("autoSchedule", () => {
  describe("validateDayMetadata", () => {
    it("should return empty array when all days have required metadata", () => {
      const scheduleDays: ScheduleDay[] = [
        createScheduleDay("day-mon", "mon", "2026-02-16", {
          scheduleType: "full_day",
          enrollmentCount: 20
        }),
        createScheduleDay("day-tue", "tue", "2026-02-17", {
          scheduleType: "full_day",
          enrollmentCount: 18
        })
      ];

      const missing = validateDayMetadata(scheduleDays);
      expect(missing).toEqual([]);
    });

    it("should identify days with missing schedule type", () => {
      const scheduleDays: ScheduleDay[] = [
        createScheduleDay("day-mon", "mon", "2026-02-16", {
          scheduleType: undefined,
          enrollmentCount: 20
        })
      ];

      const missing = validateDayMetadata(scheduleDays);
      expect(missing).toHaveLength(1);
      expect(missing[0].dayOfWeek).toBe("mon");
      expect(missing[0].missingFields).toContain("Schedule Type");
    });

    it("should identify days with missing enrollment count", () => {
      const scheduleDays: ScheduleDay[] = [
        createScheduleDay("day-mon", "mon", "2026-02-16", {
          scheduleType: "full_day",
          enrollmentCount: undefined
        })
      ];

      const missing = validateDayMetadata(scheduleDays);
      expect(missing).toHaveLength(1);
      expect(missing[0].dayOfWeek).toBe("mon");
      expect(missing[0].missingFields).toContain("Enrollment Count");
    });

    it("should identify multiple missing fields", () => {
      const scheduleDays: ScheduleDay[] = [
        createScheduleDay("day-mon", "mon", "2026-02-16", {
          scheduleType: undefined,
          enrollmentCount: undefined
        })
      ];

      const missing = validateDayMetadata(scheduleDays);
      expect(missing).toHaveLength(1);
      expect(missing[0].missingFields).toContain("Schedule Type");
      expect(missing[0].missingFields).toContain("Enrollment Count");
    });
  });

  describe("Solvable scenarios", () => {
    it("should schedule a simple single-day scenario with one employee", () => {
      // Realistic scenario: Monday only, 1 employee, 20 children, 6AM-6PM
      const context: AutoSchedulerContext = {
        scheduleDays: [
          createScheduleDay("day-mon", "mon", "2026-02-16", {
            scheduleType: "full_day",
            enrollmentCount: 20
          })
        ],
        segmentBlocks: [],
        employees: [
          createEmployee("emp-1", "Sarah Johnson", {
            leaderQualified: true,
            maxHoursPerDay: 8,
            cprCurrent: true
          })
        ],
        fieldTripEvents: [createFieldTripEvent("ft-mon", "mon")],
        operatingHours: [
          createOperatingHours("op-mon", "mon", "06:00", "18:00")
        ],
        scheduleTypeRatios: { full_day: 0.2 }, // 1:5 ratio
        schoolRules: {
          openerCount: 1,
          closerCount: 1,
          minimumMedicalDelegated: 0,
          requireCurrentCpr: true
        }
      };

      const result = autoSchedule(context, "week-test-2026-02-16");

      expect(result.success).toBeDefined();
      expect(result.staffAssignments.length).toBeGreaterThan(0);
      expect(result.segmentBlocks.length).toBeGreaterThan(0);
      expect(result.iterations).toBeGreaterThan(0);
      
      // Should have created segment block for Monday
      const mondayBlocks = result.segmentBlocks.filter(b => b.dayOfWeek === "mon");
      expect(mondayBlocks.length).toBeGreaterThan(0);
      
      // Employee should be scheduled
      const empAssignments = result.staffAssignments.filter(a => a.employeeId === "emp-1");
      expect(empAssignments.length).toBeGreaterThan(0);
      
      // Assignment should start at 6AM
      expect(empAssignments[0].startTime).toBe("06:00");
      
      // Should be scheduled for up to 8 hours
      const totalHours = empAssignments.reduce((sum, a) => {
        const start = parseInt(a.startTime.split(':')[0]);
        const end = parseInt(a.endTime.split(':')[0]);
        return sum + (end - start);
      }, 0);
      expect(totalHours).toBeLessThanOrEqual(8);
    });

    it("should schedule multiple employees across full week", () => {
      // Realistic scenario: Full week Mon-Fri, 3 employees, 25 children, 6:30AM-6:30PM
      const scheduleDays: ScheduleDay[] = ["mon", "tue", "wed", "thu", "fri"].map((day, index) =>
        createScheduleDay(`day-${day}`, day as DayOfWeek, `2026-02-${16 + index}`, {
          scheduleType: "full_day",
          enrollmentCount: 25
        })
      );

      const operatingHours: OperatingHours[] = ["mon", "tue", "wed", "thu", "fri"].map(day =>
        createOperatingHours(`op-${day}`, day as DayOfWeek, "06:30", "18:30")
      );

      const fieldTripEvents: FieldTripEvent[] = ["mon", "tue", "wed", "thu", "fri"].map(day =>
        createFieldTripEvent(`ft-${day}`, day as DayOfWeek)
      );

      const context: AutoSchedulerContext = {
        scheduleDays,
        segmentBlocks: [],
        employees: [
          createEmployee("emp-1", "Sarah Johnson", {
            leaderQualified: true,
            maxHoursPerDay: 8,
            cprCurrent: true,
            medicallyDelegated: true
          }),
          createEmployee("emp-2", "Mike Thompson", {
            leaderQualified: true,
            maxHoursPerDay: 10,
            cprCurrent: true
          }),
          createEmployee("emp-3", "Lisa Davis", {
            leaderQualified: false,
            maxHoursPerDay: 6,
            cprCurrent: true
          })
        ],
        fieldTripEvents,
        operatingHours,
        scheduleTypeRatios: { full_day: 0.2 }, // 1:5 ratio = 5 staff needed for 25 kids
        schoolRules: {
          openerCount: 1,
          closerCount: 1,
          minimumMedicalDelegated: 1,
          requireCurrentCpr: true
        }
      };

      const result = autoSchedule(context, "week-test-2026-02-16");

      expect(result.staffAssignments.length).toBeGreaterThan(0);
      expect(result.segmentBlocks.length).toBeGreaterThan(0);

      // All weekdays should have at least one segment block
      ["mon", "tue", "wed", "thu", "fri"].forEach(day => {
        const dayBlocks = result.segmentBlocks.filter(b => b.dayOfWeek === day);
        expect(dayBlocks.length).toBeGreaterThan(0);
      });

      // All employees should be scheduled on at least one day
      context.employees.forEach(emp => {
        const empAssignments = result.staffAssignments.filter(a => a.employeeId === emp.id);
        expect(empAssignments.length).toBeGreaterThan(0);
      });

      // Verify assignments start at opening time for each day
      ["mon", "tue", "wed", "thu", "fri"].forEach(day => {
        const dayAssignments = result.staffAssignments.filter(a => {
          const block = result.segmentBlocks.find(b => b.id === a.segmentBlockId);
          return block?.dayOfWeek === day;
        });
        
        if (dayAssignments.length > 0) {
          // At least one assignment should start at or near opening time
          const earliestStart = dayAssignments.reduce((earliest, a) => {
            return a.startTime < earliest ? a.startTime : earliest;
          }, "23:59");
          expect(earliestStart).toBe("06:30");
        }
      });
    });

    it("should respect employee availability windows", () => {
      // Realistic scenario: Employee only available afternoons
      const context: AutoSchedulerContext = {
        scheduleDays: [
          createScheduleDay("day-mon", "mon", "2026-02-16", {
            scheduleType: "full_day",
            enrollmentCount: 15
          })
        ],
        segmentBlocks: [],
        employees: [
          createEmployee("emp-1", "John Afternoon", {
            leaderQualified: true,
            maxHoursPerDay: 6,
            cprCurrent: true,
            availability: [
              {
                dayOfWeek: "mon",
                blocks: [
                  { startTime: "12:00", endTime: "18:00" }
                ]
              }
            ]
          }),
          createEmployee("emp-2", "Mary Morning", {
            leaderQualified: true,
            maxHoursPerDay: 6,
            cprCurrent: true,
            availability: [
              {
                dayOfWeek: "mon",
                blocks: [
                  { startTime: "06:00", endTime: "12:00" }
                ]
              }
            ]
          })
        ],
        fieldTripEvents: [createFieldTripEvent("ft-mon", "mon")],
        operatingHours: [
          createOperatingHours("op-mon", "mon", "06:00", "18:00")
        ],
        scheduleTypeRatios: { full_day: 0.2 }
      };

      const result = autoSchedule(context, "week-test-2026-02-16");

      // Find assignments for afternoon employee
      const afternoonAssignments = result.staffAssignments.filter(
        a => a.employeeId === "emp-1"
      );
      
      // All assignments should be in the afternoon (12:00 or later)
      afternoonAssignments.forEach(assignment => {
        expect(assignment.startTime >= "12:00").toBe(true);
        expect(assignment.endTime <= "18:00").toBe(true);
      });

      // Find assignments for morning employee
      const morningAssignments = result.staffAssignments.filter(
        a => a.employeeId === "emp-2"
      );
      
      // All assignments should be in the morning (before 12:00)
      morningAssignments.forEach(assignment => {
        expect(assignment.startTime >= "06:00").toBe(true);
        expect(assignment.endTime <= "12:00").toBe(true);
      });
    });

    it("should schedule employees for their maximum hours per day", () => {
      // Realistic scenario: Part-time employee with 4-hour limit
      const context: AutoSchedulerContext = {
        scheduleDays: [
          createScheduleDay("day-mon", "mon", "2026-02-16", {
            scheduleType: "full_day",
            enrollmentCount: 10
          })
        ],
        segmentBlocks: [],
        employees: [
          createEmployee("emp-1", "Part-time Paula", {
            leaderQualified: true,
            maxHoursPerDay: 4,
            cprCurrent: true
          }),
          createEmployee("emp-2", "Full-time Frank", {
            leaderQualified: true,
            maxHoursPerDay: 10,
            cprCurrent: true
          })
        ],
        fieldTripEvents: [createFieldTripEvent("ft-mon", "mon")],
        operatingHours: [
          createOperatingHours("op-mon", "mon", "07:00", "18:00")
        ],
        scheduleTypeRatios: { full_day: 0.25 } // 1:4 ratio
      };

      const result = autoSchedule(context, "week-test-2026-02-16");

      // Calculate total hours for part-time employee
      const partTimeAssignments = result.staffAssignments.filter(
        a => a.employeeId === "emp-1"
      );
      
      const partTimeHours = partTimeAssignments.reduce((sum, a) => {
        const [startHour, startMin] = a.startTime.split(':').map(Number);
        const [endHour, endMin] = a.endTime.split(':').map(Number);
        const hours = (endHour * 60 + endMin - startHour * 60 - startMin) / 60;
        return sum + hours;
      }, 0);
      
      // Should not exceed max hours per day
      expect(partTimeHours).toBeLessThanOrEqual(4);

      // Calculate total hours for full-time employee
      const fullTimeAssignments = result.staffAssignments.filter(
        a => a.employeeId === "emp-2"
      );
      
      const fullTimeHours = fullTimeAssignments.reduce((sum, a) => {
        const [startHour, startMin] = a.startTime.split(':').map(Number);
        const [endHour, endMin] = a.endTime.split(':').map(Number);
        const hours = (endHour * 60 + endMin - startHour * 60 - startMin) / 60;
        return sum + hours;
      }, 0);
      
      // Should not exceed max hours per day
      expect(fullTimeHours).toBeLessThanOrEqual(10);
    });

    it("should prioritize leader-qualified employees", () => {
      // Realistic scenario: Mix of leaders and assistants
      const context: AutoSchedulerContext = {
        scheduleDays: [
          createScheduleDay("day-mon", "mon", "2026-02-16", {
            scheduleType: "full_day",
            enrollmentCount: 20
          })
        ],
        segmentBlocks: [],
        employees: [
          createEmployee("emp-1", "Leader Lisa", {
            leaderQualified: true,
            maxHoursPerDay: 8,
            cprCurrent: true
          }),
          createEmployee("emp-2", "Assistant Amy", {
            leaderQualified: false,
            maxHoursPerDay: 8,
            cprCurrent: true
          }),
          createEmployee("emp-3", "Leader Larry", {
            leaderQualified: true,
            maxHoursPerDay: 8,
            cprCurrent: true
          })
        ],
        fieldTripEvents: [createFieldTripEvent("ft-mon", "mon")],
        operatingHours: [
          createOperatingHours("op-mon", "mon", "06:00", "18:00")
        ],
        scheduleTypeRatios: { full_day: 0.2 }
      };

      const result = autoSchedule(context, "week-test-2026-02-16");

      // Leaders should be scheduled
      const leaderAssignments = result.staffAssignments.filter(
        a => a.employeeId === "emp-1" || a.employeeId === "emp-3"
      );
      expect(leaderAssignments.length).toBeGreaterThan(0);
    });
  });

  describe("Unsolvable scenarios", () => {
    it("should handle scenario with no employees", () => {
      // Realistic scenario: No staff available
      const context: AutoSchedulerContext = {
        scheduleDays: [
          createScheduleDay("day-mon", "mon", "2026-02-16", {
            scheduleType: "full_day",
            enrollmentCount: 20
          })
        ],
        segmentBlocks: [],
        employees: [],
        fieldTripEvents: [createFieldTripEvent("ft-mon", "mon")],
        operatingHours: [
          createOperatingHours("op-mon", "mon", "06:00", "18:00")
        ],
        scheduleTypeRatios: { full_day: 0.2 }
      };

      const result = autoSchedule(context, "week-test-2026-02-16");

      expect(result.staffAssignments.length).toBe(0);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.success).toBe(false);
    });

    it("should handle scenario with insufficient employee hours", () => {
      // Realistic scenario: 12-hour day but only 1 employee with 4-hour limit
      const context: AutoSchedulerContext = {
        scheduleDays: [
          createScheduleDay("day-mon", "mon", "2026-02-16", {
            scheduleType: "full_day",
            enrollmentCount: 25
          })
        ],
        segmentBlocks: [],
        employees: [
          createEmployee("emp-1", "Part-timer Pete", {
            leaderQualified: true,
            maxHoursPerDay: 4,
            cprCurrent: true
          })
        ],
        fieldTripEvents: [createFieldTripEvent("ft-mon", "mon")],
        operatingHours: [
          createOperatingHours("op-mon", "mon", "06:00", "18:00")
        ],
        scheduleTypeRatios: { full_day: 0.2 } // Needs 5 staff for 25 kids
      };

      const result = autoSchedule(context, "week-test-2026-02-16");

      // Should have some assignments but violations due to insufficient coverage
      expect(result.staffAssignments.length).toBeGreaterThan(0);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.success).toBe(false);
    });

    it("should handle scenario with no employee availability on required days", () => {
      // Realistic scenario: All employees off on Monday
      const context: AutoSchedulerContext = {
        scheduleDays: [
          createScheduleDay("day-mon", "mon", "2026-02-16", {
            scheduleType: "full_day",
            enrollmentCount: 20
          })
        ],
        segmentBlocks: [],
        employees: [
          createEmployee("emp-1", "Tuesday Tom", {
            leaderQualified: true,
            maxHoursPerDay: 8,
            cprCurrent: true,
            availability: [
              {
                dayOfWeek: "tue",
                blocks: [{ startTime: "06:00", endTime: "18:00" }]
              }
            ]
          }),
          createEmployee("emp-2", "Wednesday Wendy", {
            leaderQualified: true,
            maxHoursPerDay: 8,
            cprCurrent: true,
            availability: [
              {
                dayOfWeek: "wed",
                blocks: [{ startTime: "06:00", endTime: "18:00" }]
              }
            ]
          })
        ],
        fieldTripEvents: [createFieldTripEvent("ft-mon", "mon")],
        operatingHours: [
          createOperatingHours("op-mon", "mon", "06:00", "18:00")
        ],
        scheduleTypeRatios: { full_day: 0.2 }
      };

      const result = autoSchedule(context, "week-test-2026-02-16");

      // No Monday assignments should be created
      const mondayAssignments = result.staffAssignments.filter(a => {
        const block = result.segmentBlocks.find(b => b.id === a.segmentBlockId);
        return block?.dayOfWeek === "mon";
      });
      expect(mondayAssignments.length).toBe(0);
      expect(result.success).toBe(false);
    });

    it("should handle scenario with operating hours but no schedule metadata", () => {
      // Realistic scenario: Operating hours defined but days not configured
      const context: AutoSchedulerContext = {
        scheduleDays: [
          createScheduleDay("day-mon", "mon", "2026-02-16", {
            scheduleType: undefined, // Missing!
            enrollmentCount: undefined // Missing!
          })
        ],
        segmentBlocks: [],
        employees: [
          createEmployee("emp-1", "Ready Rachel", {
            leaderQualified: true,
            maxHoursPerDay: 8,
            cprCurrent: true
          })
        ],
        fieldTripEvents: [createFieldTripEvent("ft-mon", "mon")],
        operatingHours: [
          createOperatingHours("op-mon", "mon", "06:00", "18:00")
        ],
        scheduleTypeRatios: { full_day: 0.2 }
      };

      const result = autoSchedule(context, "week-test-2026-02-16");

      // Should not create any assignments for days without metadata
      expect(result.staffAssignments.length).toBe(0);
      expect(result.segmentBlocks.length).toBe(0);
    });

    it("should handle scenario with high child-to-staff ratio requirements", () => {
      // Realistic scenario: Infant room with 1:3 ratio but not enough staff
      const context: AutoSchedulerContext = {
        scheduleDays: [
          createScheduleDay("day-mon", "mon", "2026-02-16", {
            scheduleType: "infant",
            enrollmentCount: 12 // Need 4 staff members
          })
        ],
        segmentBlocks: [],
        employees: [
          createEmployee("emp-1", "Solo Sally", {
            leaderQualified: true,
            maxHoursPerDay: 12,
            cprCurrent: true
          })
        ],
        fieldTripEvents: [createFieldTripEvent("ft-mon", "mon")],
        operatingHours: [
          createOperatingHours("op-mon", "mon", "06:00", "18:00")
        ],
        scheduleTypeRatios: { infant: 0.33 } // 1:3 ratio
      };

      const result = autoSchedule(context, "week-test-2026-02-16");

      // Should schedule the one employee but have ratio violations
      expect(result.staffAssignments.length).toBeGreaterThan(0);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.success).toBe(false);
      
      // Should have ratio violations
      const ratioViolations = result.violations.filter(v => v.ruleId === "ratio-segment");
      expect(ratioViolations.length).toBeGreaterThan(0);
    });

    it("should handle mixed solvable and unsolvable days", () => {
      // Realistic scenario: Can schedule Mon-Wed but not Thu-Fri (staff on leave)
      const scheduleDays: ScheduleDay[] = [
        createScheduleDay("day-mon", "mon", "2026-02-16", {
          scheduleType: "full_day",
          enrollmentCount: 15
        }),
        createScheduleDay("day-tue", "tue", "2026-02-17", {
          scheduleType: "full_day",
          enrollmentCount: 15
        }),
        createScheduleDay("day-wed", "wed", "2026-02-18", {
          scheduleType: "full_day",
          enrollmentCount: 15
        }),
        createScheduleDay("day-thu", "thu", "2026-02-19", {
          scheduleType: "full_day",
          enrollmentCount: 15
        }),
        createScheduleDay("day-fri", "fri", "2026-02-20", {
          scheduleType: "full_day",
          enrollmentCount: 15
        })
      ];

      const operatingHours: OperatingHours[] = ["mon", "tue", "wed", "thu", "fri"].map(day =>
        createOperatingHours(`op-${day}`, day as DayOfWeek, "07:00", "17:00")
      );

      const fieldTripEvents: FieldTripEvent[] = ["mon", "tue", "wed", "thu", "fri"].map(day =>
        createFieldTripEvent(`ft-${day}`, day as DayOfWeek)
      );

      const context: AutoSchedulerContext = {
        scheduleDays,
        segmentBlocks: [],
        employees: [
          createEmployee("emp-1", "Early Week Worker", {
            leaderQualified: true,
            maxHoursPerDay: 10,
            cprCurrent: true,
            availability: [
              { dayOfWeek: "mon", blocks: [{ startTime: "07:00", endTime: "17:00" }] },
              { dayOfWeek: "tue", blocks: [{ startTime: "07:00", endTime: "17:00" }] },
              { dayOfWeek: "wed", blocks: [{ startTime: "07:00", endTime: "17:00" }] }
            ]
          })
        ],
        fieldTripEvents,
        operatingHours,
        scheduleTypeRatios: { full_day: 0.2 }
      };

      const result = autoSchedule(context, "week-test-2026-02-16");

      // Should have assignments for Mon-Wed
      ["mon", "tue", "wed"].forEach(day => {
        const dayAssignments = result.staffAssignments.filter(a => {
          const block = result.segmentBlocks.find(b => b.id === a.segmentBlockId);
          return block?.dayOfWeek === day;
        });
        expect(dayAssignments.length).toBeGreaterThan(0);
      });

      // Should NOT have assignments for Thu-Fri
      ["thu", "fri"].forEach(day => {
        const dayAssignments = result.staffAssignments.filter(a => {
          const block = result.segmentBlocks.find(b => b.id === a.segmentBlockId);
          return block?.dayOfWeek === day;
        });
        expect(dayAssignments.length).toBe(0);
      });

      expect(result.success).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle employee with multiple non-contiguous availability blocks", () => {
      // Realistic scenario: Employee available mornings and evenings but not midday
      const context: AutoSchedulerContext = {
        scheduleDays: [
          createScheduleDay("day-mon", "mon", "2026-02-16", {
            scheduleType: "full_day",
            enrollmentCount: 15
          })
        ],
        segmentBlocks: [],
        employees: [
          createEmployee("emp-1", "Split-shift Steve", {
            leaderQualified: true,
            maxHoursPerDay: 8,
            cprCurrent: true,
            availability: [
              {
                dayOfWeek: "mon",
                blocks: [
                  { startTime: "06:00", endTime: "10:00" },
                  { startTime: "14:00", endTime: "18:00" }
                ]
              }
            ]
          })
        ],
        fieldTripEvents: [createFieldTripEvent("ft-mon", "mon")],
        operatingHours: [
          createOperatingHours("op-mon", "mon", "06:00", "18:00")
        ],
        scheduleTypeRatios: { full_day: 0.2 }
      };

      const result = autoSchedule(context, "week-test-2026-02-16");

      const assignments = result.staffAssignments.filter(a => a.employeeId === "emp-1");
      
      // Should have assignments in both time windows
      expect(assignments.length).toBeGreaterThan(0);
      
      // All assignments should be within the availability windows
      assignments.forEach(assignment => {
        const inMorning = assignment.startTime >= "06:00" && assignment.endTime <= "10:00";
        const inEvening = assignment.startTime >= "14:00" && assignment.endTime <= "18:00";
        expect(inMorning || inEvening).toBe(true);
      });
    });

    it("should handle very short operating hours", () => {
      // Realistic scenario: Half-day program (3 hours)
      const context: AutoSchedulerContext = {
        scheduleDays: [
          createScheduleDay("day-mon", "mon", "2026-02-16", {
            scheduleType: "half_day",
            enrollmentCount: 10
          })
        ],
        segmentBlocks: [],
        employees: [
          createEmployee("emp-1", "Half-day Helen", {
            leaderQualified: true,
            maxHoursPerDay: 8,
            cprCurrent: true
          })
        ],
        fieldTripEvents: [createFieldTripEvent("ft-mon", "mon")],
        operatingHours: [
          createOperatingHours("op-mon", "mon", "09:00", "12:00")
        ],
        scheduleTypeRatios: { half_day: 0.25 }
      };

      const result = autoSchedule(context, "week-test-2026-02-16");

      expect(result.staffAssignments.length).toBeGreaterThan(0);
      
      // All assignments should be within the 3-hour window
      result.staffAssignments.forEach(assignment => {
        expect(assignment.startTime >= "09:00").toBe(true);
        expect(assignment.endTime <= "12:00").toBe(true);
      });
    });

    it("should handle zero enrollment scenario", () => {
      // Realistic scenario: Professional development day (no children)
      const context: AutoSchedulerContext = {
        scheduleDays: [
          createScheduleDay("day-mon", "mon", "2026-02-16", {
            scheduleType: "pd_day",
            enrollmentCount: 0
          })
        ],
        segmentBlocks: [],
        employees: [
          createEmployee("emp-1", "Teacher Terry", {
            leaderQualified: true,
            maxHoursPerDay: 8,
            cprCurrent: true
          })
        ],
        fieldTripEvents: [createFieldTripEvent("ft-mon", "mon")],
        operatingHours: [
          createOperatingHours("op-mon", "mon", "08:00", "16:00")
        ],
        scheduleTypeRatios: { pd_day: 1.0 } // Different ratio for PD days
      };

      const result = autoSchedule(context, "week-test-2026-02-16");

      // With 0 enrollment and 1.0 ratio, we'd calculate neededStaff = max(2, ceil(0 * 1.0)) = 2
      // So there might still be assignments, but the logic should handle it gracefully
      expect(result).toBeDefined();
      expect(result.iterations).toBeGreaterThan(0);
    });
  });
});
