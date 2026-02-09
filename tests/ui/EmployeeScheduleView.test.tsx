import { render, screen } from "@testing-library/react";
import EmployeeScheduleView, {
  type EmployeeScheduleAssignment,
  type EmployeeScheduleEmployee,
  type EmployeeScheduleSegmentBlock
} from "../../apps/ui/components/EmployeeScheduleView";
import type { DayOfWeek } from "@core/domain/types";

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
    const employees: EmployeeScheduleEmployee[] = [
      {
        id: "emp-1",
        name: "Alex"
      },
      {
        id: "emp-2",
        name: "Sam"
      }
    ];

    const segmentBlocks: EmployeeScheduleSegmentBlock[] = [
      {
        id: "seg-1",
        dayOfWeek: "mon",
        segment: "open",
        startTime: "08:00",
        endTime: "12:00"
      }
    ];

    const assignments: EmployeeScheduleAssignment[] = [
      {
        id: "assign-1",
        segmentBlockId: "seg-1",
        employeeId: "emp-1",
        startTime: "08:00",
        endTime: "12:00"
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

  it("hides the employee selector when configured", () => {
    render(
      <EmployeeScheduleView
        employees={[{ id: "emp-1", name: "Alex" }]}
        assignments={[]}
        segmentBlocks={[]}
        daySequence={daySequence}
        dayDisplayNames={dayDisplayNames}
        hideEmployeeSelector
        forcedEmployeeId="emp-1"
      />
    );

    expect(screen.getByText("Your schedule")).toBeInTheDocument();
    expect(screen.queryByLabelText("Employee")).toBeNull();
  });
});
