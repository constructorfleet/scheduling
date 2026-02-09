import { render, screen } from "@testing-library/react";
import EmployeeScheduleView from "../../apps/ui/components/EmployeeScheduleView";
import type { DayOfWeek, Employee, SegmentBlock, StaffAssignment } from "@core/domain/types";

const daySequence: DayOfWeek[] = ["mon", "tue"];
const dayDisplayNames: Record<DayOfWeek, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun"
};

describe("EmployeeScheduleView", () => {
  it("renders shifts for the selected employee", () => {
    const employees: Employee[] = [
      {
        id: "emp-1",
        name: "Alex",
        jobTitle: "Teacher",
        maxHoursPerDay: 8,
        maxHoursPerWeek: 40,
        employmentStatus: "active",
        leaderQualified: false,
        medicallyDelegated: false,
        cprCurrent: true,
        notes: ""
      },
      {
        id: "emp-2",
        name: "Sam",
        jobTitle: "Teacher",
        maxHoursPerDay: 8,
        maxHoursPerWeek: 40,
        employmentStatus: "active",
        leaderQualified: false,
        medicallyDelegated: false,
        cprCurrent: true,
        notes: ""
      }
    ];

    const segmentBlocks: SegmentBlock[] = [
      {
        id: "seg-1",
        scheduleWeekId: "week-1",
        dayOfWeek: "mon",
        segment: "open",
        startTime: "08:00",
        endTime: "12:00",
        childCount: 10,
        status: "draft",
        scheduleDayId: "day-1"
      }
    ];

    const assignments: StaffAssignment[] = [
      {
        id: "assign-1",
        segmentBlockId: "seg-1",
        employeeId: "emp-1",
        assignmentSource: "manual_adjustment",
        startTime: "08:00",
        endTime: "12:00",
        status: "scheduled"
      }
    ];

    render(
      <EmployeeScheduleView
        employees={employees}
        assignments={assignments}
        segmentBlocks={segmentBlocks}
        daySequence={daySequence}
        dayDisplayNames={dayDisplayNames}
      />
    );

    expect(screen.getByRole("heading", { name: "Alex" })).toBeInTheDocument();
    expect(screen.getByText("8:00 AM - 12:00 PM")).toBeInTheDocument();
    expect(screen.getByText("No shifts")).toBeInTheDocument();
  });
});
