import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ScheduleMatrix from "../../apps/ui/components/ScheduleMatrix";
import type {
  DayOfWeek,
  Employee,
  FieldTripEvent,
  OperatingHours,
  SegmentBlock,
  StaffAssignment
} from "@core/domain/types";
import type { ScheduleTypeOption } from "../../apps/ui/components/DayMetadataStrip";

const daySequence: DayOfWeek[] = ["mon"];
const allDays: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const dayDisplayNames: Record<DayOfWeek, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun"
};

const scheduleTypeOptions: ScheduleTypeOption[] = [
  {
    value: "regular",
    label: "Regular day",
    ratio: { adults: 1, students: 10 },
    description: "Standard coverage"
  }
];

const segmentBlocks: SegmentBlock[] = [
  {
    id: "segment-mon-open",
    scheduleWeekId: "week-1",
    dayOfWeek: "mon",
    segment: "open",
    startTime: "07:00",
    endTime: "09:00",
    childCount: 12,
    status: "draft"
  }
];

const assignments: StaffAssignment[] = [
  {
    id: "assign-1",
    segmentBlockId: "segment-mon-open",
    employeeId: "emp-1",
    assignmentSource: "manual_adjustment",
    startTime: "07:00",
    endTime: "09:00",
    status: "scheduled"
  }
];

const baseStaff: Employee[] = [
  {
    id: "emp-1",
    name: "Jordan Lee",
    jobTitle: "Lead",
    maxHoursPerDay: 8,
    maxHoursPerWeek: 40,
    employmentStatus: "active",
    leaderQualified: true,
    medicallyDelegated: false,
    cprCurrent: true
  }
];

const baseDays = [
  {
    id: "day-1",
    scheduleWeekId: "week-1",
    date: "2026-02-02",
    dayOfWeek: "mon" as DayOfWeek,
    scheduleType: "regular",
    enrollmentCount: 12
  }
];

const baseFieldTripEventsByDay = allDays.reduce((map, day) => {
  map[day] = undefined;
  return map;
}, {} as Record<DayOfWeek, FieldTripEvent | undefined>);

const baseOperatingHoursByDay = allDays.reduce((map, day) => {
  map[day] =
    day === "mon"
      ? {
          id: "hours-1",
          schoolId: "school-1",
          dayOfWeek: "mon",
          dayScheduleType: "in_house",
          open: "07:00",
          close: "17:00"
        }
      : undefined;
  return map;
}, {} as Record<DayOfWeek, OperatingHours | undefined>);

const renderMatrix = (overrides?: Partial<{
  staff: Employee[];
  assignments: StaffAssignment[];
  segmentBlocks: SegmentBlock[];
  operatingHoursByDay: Record<DayOfWeek, OperatingHours | undefined>;
  days: typeof baseDays;
}>) => {
  const onCreateAssignment = jest.fn();
  const onUpdateAssignmentTime = jest.fn();
  render(
    <ScheduleMatrix
      staff={overrides?.staff ?? baseStaff}
      employeeOptions={baseStaff}
      assignments={overrides?.assignments ?? assignments}
      segmentBlocks={overrides?.segmentBlocks ?? segmentBlocks}
      days={overrides?.days ?? baseDays}
      daySequence={daySequence}
      dayDisplayNames={dayDisplayNames}
      scheduleTypeOptions={scheduleTypeOptions}
      fieldTripTypes={[]}
      fieldTripEventsByDay={baseFieldTripEventsByDay}
      operatingHoursByDay={overrides?.operatingHoursByDay ?? baseOperatingHoursByDay}
      onEnrollmentChange={jest.fn()}
      onScheduleTypeChange={jest.fn()}
      onFieldTripSelection={jest.fn()}
      onUpdateAssignmentTime={onUpdateAssignmentTime}
      onDeleteAssignment={jest.fn()}
      onCreateAssignment={onCreateAssignment}
      onReassignUnlinkedStaff={jest.fn()}
    />
  );
  return { onCreateAssignment, onUpdateAssignmentTime };
};

describe("ScheduleMatrix", () => {
  it("highlights and scrolls to the focused segment block", () => {
    const scrollIntoView = jest.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    const { container } = render(
      <ScheduleMatrix
        staff={baseStaff}
        employeeOptions={baseStaff}
        assignments={assignments}
        segmentBlocks={segmentBlocks}
        days={baseDays}
        daySequence={daySequence}
        dayDisplayNames={dayDisplayNames}
        scheduleTypeOptions={scheduleTypeOptions}
        fieldTripTypes={[]}
        fieldTripEventsByDay={baseFieldTripEventsByDay}
        operatingHoursByDay={baseOperatingHoursByDay}
        onEnrollmentChange={jest.fn()}
        onScheduleTypeChange={jest.fn()}
        onFieldTripSelection={jest.fn()}
        onUpdateAssignmentTime={jest.fn()}
        onDeleteAssignment={jest.fn()}
        onCreateAssignment={jest.fn()}
        onReassignUnlinkedStaff={jest.fn()}
        focusedSegmentIds={["segment-mon-open"]}
      />
    );

    const focusedBlock = container.querySelector<HTMLElement>('[data-segment-id="segment-mon-open"]');
    expect(focusedBlock).not.toBeNull();
    expect(focusedBlock?.style.boxShadow).toContain("rgba(245, 158, 11");
    expect(scrollIntoView).toHaveBeenCalled();

    HTMLElement.prototype.scrollIntoView = original;
  });

  it("creates a new block from the add button", async () => {
    const user = userEvent.setup();
    const { onCreateAssignment } = renderMatrix();
    const row = screen.getByText("Jordan Lee").closest("tr");
    expect(row).not.toBeNull();
    const addButton = within(row as HTMLElement).getByRole("button", { name: "Add block" });
    await act(async () => {
      await user.click(addButton);
    });
    const timeInputs = within(row as HTMLElement).getAllByDisplayValue("07:00");
    const endInputs = within(row as HTMLElement).getAllByDisplayValue("09:00");
    act(() => {
      fireEvent.change(timeInputs[0], { target: { value: "09:30" } });
      fireEvent.change(endInputs[0], { target: { value: "11:00" } });
    });
    const saveButton = within(row as HTMLElement).getByRole("button", { name: "Save" });
    await act(async () => {
      await user.click(saveButton);
    });
    expect(onCreateAssignment).toHaveBeenCalledWith({
      employeeId: "emp-1",
      dayOfWeek: "mon",
      startTime: "09:30",
      endTime: "11:00"
    });
  });

  it("prevents overlapping blocks for the same employee/day", async () => {
    const user = userEvent.setup();
    const overlapSegments: SegmentBlock[] = [
      segmentBlocks[0],
      {
        ...segmentBlocks[0],
        id: "segment-mon-mid",
        startTime: "09:30",
        endTime: "11:30"
      }
    ];
    const overlapAssignments: StaffAssignment[] = [
      assignments[0],
      {
        id: "assign-2",
        segmentBlockId: "segment-mon-mid",
        employeeId: "emp-1",
        assignmentSource: "manual_adjustment",
        startTime: "09:30",
        endTime: "11:30",
        status: "scheduled"
      }
    ];
    renderMatrix({ segmentBlocks: overlapSegments, assignments: overlapAssignments });

    const row = screen.getByText("Jordan Lee").closest("tr");
    expect(row).not.toBeNull();
    const blocks = within(row as HTMLElement).getAllByText("7:00 AM");
    await act(async () => {
      await user.click(blocks[0]);
    });
    const timeInputs = within(row as HTMLElement).getAllByDisplayValue("07:00");
    const endInputs = within(row as HTMLElement).getAllByDisplayValue("09:00");
    act(() => {
      fireEvent.change(timeInputs[0], { target: { value: "10:00" } });
      fireEvent.change(endInputs[0], { target: { value: "11:00" } });
    });
    expect(within(row as HTMLElement).getByText("Overlaps another block")).toBeInTheDocument();
  });

  it("deletes an assignment from edit mode", async () => {
    const user = userEvent.setup();
    const onDeleteAssignment = jest.fn();
    render(
      <ScheduleMatrix
        staff={baseStaff}
        employeeOptions={baseStaff}
        assignments={assignments}
        segmentBlocks={segmentBlocks}
        days={baseDays}
        daySequence={daySequence}
        dayDisplayNames={dayDisplayNames}
        scheduleTypeOptions={scheduleTypeOptions}
        fieldTripTypes={[]}
        fieldTripEventsByDay={baseFieldTripEventsByDay}
        operatingHoursByDay={baseOperatingHoursByDay}
        onEnrollmentChange={jest.fn()}
        onScheduleTypeChange={jest.fn()}
        onFieldTripSelection={jest.fn()}
        onUpdateAssignmentTime={jest.fn()}
        onDeleteAssignment={onDeleteAssignment}
        onCreateAssignment={jest.fn()}
        onReassignUnlinkedStaff={jest.fn()}
      />
    );
    const block = screen.getByText("7:00 AM");
    await act(async () => {
      await user.click(block);
    });
    const deleteButton = screen.getByRole("button", { name: "Delete" });
    await act(async () => {
      await user.click(deleteButton);
    });
    expect(onDeleteAssignment).toHaveBeenCalledWith("assign-1");
  });

  it("highlights opener and closer blocks based on operating hours", () => {
    const openerCloserSegments: SegmentBlock[] = [
      {
        ...segmentBlocks[0],
        id: "segment-mon-edge",
        startTime: "07:05",
        endTime: "16:50"
      }
    ];
    const openerCloserAssignments: StaffAssignment[] = [
      {
        ...assignments[0],
        id: "assign-edge",
        segmentBlockId: "segment-mon-edge",
        startTime: "07:05",
        endTime: "16:50"
      }
    ];
    renderMatrix({ segmentBlocks: openerCloserSegments, assignments: openerCloserAssignments });

    const block = document.querySelector<HTMLElement>('[data-segment-id="segment-mon-edge"]');
    expect(block).not.toBeNull();
    expect(block?.style.background).toContain("linear-gradient");
  });

  it("shows a red border and tooltip when a day exceeds max hours", () => {
    const maxedStaff: Employee[] = [
      {
        ...baseStaff[0],
        maxHoursPerDay: 4
      }
    ];
    const longSegments: SegmentBlock[] = [
      {
        ...segmentBlocks[0],
        id: "segment-mon-long-1",
        startTime: "07:00",
        endTime: "10:30"
      },
      {
        ...segmentBlocks[0],
        id: "segment-mon-long-2",
        startTime: "11:00",
        endTime: "14:30"
      }
    ];
    const longAssignments: StaffAssignment[] = [
      {
        ...assignments[0],
        id: "assign-long-1",
        segmentBlockId: "segment-mon-long-1",
        startTime: "07:00",
        endTime: "10:30"
      },
      {
        ...assignments[0],
        id: "assign-long-2",
        segmentBlockId: "segment-mon-long-2",
        startTime: "11:00",
        endTime: "14:30"
      }
    ];
    renderMatrix({ staff: maxedStaff, segmentBlocks: longSegments, assignments: longAssignments });

    const row = screen.getByText("Jordan Lee").closest("tr");
    expect(row).not.toBeNull();
    const dayCell = (row as HTMLElement).querySelectorAll("td")[1];
    expect(dayCell?.style.border).toContain("rgb(220, 38, 38)");
    const tooltip = within(dayCell as HTMLElement).getByTitle("Over max hours");
    expect(tooltip).toBeInTheDocument();
  });

  it("disables scheduling interactions for closed schedule days", () => {
    const closedDays = [
      {
        ...baseDays[0],
        scheduleType: "closed",
        dayScheduleType: "closed",
        enrollmentCount: 0
      }
    ];
    renderMatrix({ days: closedDays });

    expect(screen.queryByRole("button", { name: "Add block" })).not.toBeInTheDocument();
    const allSelects = screen.getAllByRole("combobox");
    expect(allSelects[0]).not.toBeDisabled();
    expect(allSelects[1]).toBeDisabled();
    const enrollmentInput = screen.getByRole("spinbutton");
    expect(enrollmentInput).toBeDisabled();
  });

  it("prevents adding assignments when employee requested the day off", () => {
    const dayOffStaff: Employee[] = [
      {
        ...baseStaff[0],
        requestedDaysOff: [{ id: "off-1", startDate: "2026-02-02", endDate: "2026-02-04", note: "Vacation" }]
      }
    ];
    renderMatrix({ staff: dayOffStaff });

    expect(screen.queryByRole("button", { name: "Add block" })).not.toBeInTheDocument();
    expect(screen.getByText("Requested day off")).toBeInTheDocument();
  });

  it("marks assignments that violate availability", () => {
    const availabilityStaff: Employee[] = [
      {
        ...baseStaff[0],
        availability: [
          {
            dayOfWeek: "mon",
            blocks: [{ startTime: "10:00", endTime: "12:00" }]
          }
        ]
      }
    ];
    renderMatrix({ staff: availabilityStaff });

    const block = document.querySelector<HTMLElement>('[data-segment-id="segment-mon-open"]');
    expect(block).not.toBeNull();
    expect(block?.style.border).toContain("rgb(220, 38, 38)");
    expect(block).toHaveAttribute("title");
    expect(block?.getAttribute("title")).toContain("Outside availability");
    expect(within(block as HTMLElement).getByText("?")).toBeInTheDocument();
  });

  it("allows reassigning unlinked staff rows to an existing employee", async () => {
    const user = userEvent.setup();
    const onReassignUnlinkedStaff = jest.fn();
    const unlinkedStaff: Employee[] = [
      ...baseStaff,
      {
        id: "emp-missing",
        name: "Unlinked staff (emp-missing)",
        jobTitle: "Unknown",
        maxHoursPerDay: 24,
        maxHoursPerWeek: 168,
        employmentStatus: "active",
        leaderQualified: false,
        medicallyDelegated: false,
        cprCurrent: true
      }
    ];
    const unlinkedAssignments: StaffAssignment[] = [
      ...assignments,
      {
        id: "assign-unlinked",
        segmentBlockId: "segment-mon-open",
        employeeId: "emp-missing",
        assignmentSource: "manual_adjustment",
        startTime: "10:00",
        endTime: "12:00",
        status: "scheduled"
      }
    ];

    render(
      <ScheduleMatrix
        staff={unlinkedStaff}
        employeeOptions={baseStaff}
        assignments={unlinkedAssignments}
        segmentBlocks={segmentBlocks}
        days={baseDays}
        daySequence={daySequence}
        dayDisplayNames={dayDisplayNames}
        scheduleTypeOptions={scheduleTypeOptions}
        fieldTripTypes={[]}
        fieldTripEventsByDay={baseFieldTripEventsByDay}
        operatingHoursByDay={baseOperatingHoursByDay}
        onEnrollmentChange={jest.fn()}
        onScheduleTypeChange={jest.fn()}
        onFieldTripSelection={jest.fn()}
        onUpdateAssignmentTime={jest.fn()}
        onDeleteAssignment={jest.fn()}
        onCreateAssignment={jest.fn()}
        onReassignUnlinkedStaff={onReassignUnlinkedStaff}
      />
    );

    await act(async () => {
      await user.selectOptions(screen.getByDisplayValue("Assign to employee"), "emp-1");
    });
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Assign" }));
    });
    expect(onReassignUnlinkedStaff).toHaveBeenCalledWith("emp-missing", "emp-1");
  });

  it("shows configured availability blocks for the employee/day", () => {
    const availabilityStaff: Employee[] = [
      {
        ...baseStaff[0],
        availability: [
          {
            dayOfWeek: "mon",
            blocks: [
              { startTime: "08:00", endTime: "11:00" },
              { startTime: "12:00", endTime: "16:00" }
            ]
          }
        ]
      }
    ];

    renderMatrix({ staff: availabilityStaff });

    expect(screen.getByText("Availability")).toBeInTheDocument();
    expect(screen.getByText("8:00 AM-11:00 AM · 12:00 PM-4:00 PM")).toBeInTheDocument();
  });
});
