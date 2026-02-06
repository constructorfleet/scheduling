import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClockBlockTimeline from "../../apps/ui/components/ClockBlockTimeline";
import { segmentSlotDefinitions } from "../../apps/ui/data/mockScheduleData";
import type {
  DayOfWeek,
  Employee,
  SegmentBlock,
  StaffAssignment,
  OperatingHours
} from "../../src/domain/types";
import type { RuleViolation } from "../../apps/ui/types";

const dayDisplayNames: Record<DayOfWeek, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday"
};

const daySequence: DayOfWeek[] = ["mon"];

const operatingHours: OperatingHours = {
  id: "ops-mon",
  schoolId: "school-1",
  dayOfWeek: "mon",
  dayScheduleType: "full_day",
  open: "06:30",
  close: "18:30"
};

const operatingHoursByDay: Record<DayOfWeek, OperatingHours | undefined> = {
  mon: operatingHours,
  tue: undefined,
  wed: undefined,
  thu: undefined,
  fri: undefined,
  sat: undefined,
  sun: undefined
};

const requirementTemplate: SegmentBlock["requirementTemplate"] = {
  id: "req-timeline",
  ratioProfile: {
    id: "ratio-timeline",
    childrenPerStaff: 9,
    policyCitationId: "policy-ratio"
  },
  minStaff: 1,
  requiresCpr: false,
  requiresMedicalDelegation: false,
  requiresLeader: true,
  policyCitationId: "policy-ratio"
};

const segment: SegmentBlock = {
  id: "block-mon-1",
  scheduleWeekId: "week-1",
  dayOfWeek: "mon",
  segment: "open",
  startTime: "08:00",
  endTime: "12:00",
  childCount: 18,
  requirementTemplate,
  status: "draft"
};

const employees: Employee[] = [
  {
    id: "emp-lead",
    name: "Jamie Leader",
    jobTitle: "Lead Teacher",
    maxHoursPerDay: 10,
    maxHoursPerWeek: 40,
    employmentStatus: "active",
    leaderQualified: true,
    medicallyDelegated: false,
    cprCurrent: true
  },
  {
    id: "emp-assistant",
    name: "Casey Assistant",
    jobTitle: "Assistant Teacher",
    maxHoursPerDay: 10,
    maxHoursPerWeek: 40,
    employmentStatus: "active",
    leaderQualified: false,
    medicallyDelegated: false,
    cprCurrent: true
  }
];

const assignments: StaffAssignment[] = [
  {
    id: "assign-lead",
    segmentBlockId: segment.id,
    employeeId: employees[0].id,
    assignmentSource: "manual_adjustment",
    startTime: "08:00",
    endTime: "12:00",
    status: "scheduled"
  },
  {
    id: "assign-assistant",
    segmentBlockId: segment.id,
    employeeId: employees[1].id,
    assignmentSource: "manual_adjustment",
    startTime: "08:00",
    endTime: "12:00",
    status: "scheduled"
  }
];

const policyCitation = {
  id: "policy-coverage",
  name: "Coverage policy",
  document: "Coverage guide"
};

const violations: RuleViolation[] = [
  {
    id: "viol-timeline",
    title: "Overlapping block",
    severity: "critical",
    description: "Overlap detected on Monday open",
    segmentBlockId: segment.id,
    policyCitation,
    recommendedAction: "Adjust the clock window.",
    metadata: {
      operatingHoursId: "ops-mon"
    }
  }
];

describe("ClockBlockTimeline", () => {
  it("renders staff, violation badges, and drives focus/auto-balance callbacks", async () => {
    const focusSegment = jest.fn();
    const autoBalance = jest.fn();
    const addClockBlock = jest.fn();

    render(
      <ClockBlockTimeline
        segments={[segment]}
        assignments={assignments}
        employees={employees}
        violations={violations}
        focusedSegmentId={segment.id}
        onFocusSegment={focusSegment}
        daySequence={daySequence}
        dayDisplayNames={dayDisplayNames}
        onAutoBalance={autoBalance}
        operatingHoursByDay={operatingHoursByDay}
        segmentSlotDefinitions={segmentSlotDefinitions}
        onAddClockBlock={addClockBlock}
      />
    );

    const blockButton = screen.getByRole("button", {
      name: "Monday 08:00 – 12:00 open"
    });
    expect(blockButton).toHaveAttribute("aria-pressed", "true");
    expect(within(blockButton).getByText("Children: 18")).toBeVisible();
    expect(within(blockButton).getByText("Req staff: 2")).toBeVisible();
    expect(within(blockButton).getByText("Ratio 1:9")).toBeVisible();
    expect(within(blockButton).getByText("Jamie Leader")).toBeVisible();
    expect(within(blockButton).getByText("Casey Assistant")).toBeVisible();
    expect(within(blockButton).getByText("1 violation(s)")).toBeVisible();

    await userEvent.click(blockButton);
    expect(focusSegment).toHaveBeenCalledWith(segment.id);

    const autoBalanceButton = screen.getByRole("button", { name: /Auto-balance suggestions/ });
    await userEvent.click(autoBalanceButton);
    expect(autoBalance).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Add clock block")).toBeVisible();
    expect(screen.getByText("6:30a – 6:30p operating window")).toBeVisible();
    expect(screen.getByText("Operating hours guardrail")).toBeVisible();
  });

  it("allows adding a new block via the guardrail form", async () => {
    const focusSegment = jest.fn();
    const autoBalance = jest.fn();
    const addClockBlock = jest.fn();

    render(
      <ClockBlockTimeline
        segments={[segment]}
        assignments={assignments}
        employees={employees}
        violations={violations}
        focusedSegmentId={segment.id}
        onFocusSegment={focusSegment}
        daySequence={daySequence}
        dayDisplayNames={dayDisplayNames}
        onAutoBalance={autoBalance}
        operatingHoursByDay={operatingHoursByDay}
        segmentSlotDefinitions={segmentSlotDefinitions}
        onAddClockBlock={addClockBlock}
      />
    );

    fireEvent.change(screen.getByLabelText("Start time (HH:MM)"), { target: { value: "09:00" } });
    fireEvent.change(screen.getByLabelText("End time (HH:MM)"), { target: { value: "12:15" } });
    fireEvent.change(screen.getByLabelText("Child count"), { target: { value: "22" } });

    await userEvent.selectOptions(screen.getByLabelText("Staff member (optional)"), "emp-assistant");
    await userEvent.click(screen.getByRole("button", { name: "Save clock block" }));

    expect(addClockBlock).toHaveBeenCalledWith({
      dayOfWeek: "mon",
      segment: "open",
      startTime: "09:00",
      endTime: "12:15",
      childCount: 22,
      employeeId: "emp-assistant"
    });
  });
});
