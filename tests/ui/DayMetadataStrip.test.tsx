import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DayMetadataStrip, { ScheduleTypeOption } from "../../apps/ui/components/DayMetadataStrip";
import type {
  DayOfWeek,
  FieldTripEvent,
  FieldTripType,
  ScheduleDay,
  ScheduleType
} from "@core/domain/types";

const daySequence: DayOfWeek[] = ["mon", "tue"];

const dayDisplayNames: Record<DayOfWeek, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday"
};

const scheduleTypeOptions: ScheduleTypeOption[] = [
  {
    value: "regular",
    label: "Regular day",
    ratio: { adults: 1, students: 8 },
    description: "Standard hours with the baseline ratio rules."
  },
  {
    value: "extended",
    label: "Extended day",
    ratio: { adults: 1, students: 10 },
    description: "Long-day coverage with an alternate ratio."
  }
];

const fieldTripTypes: FieldTripType[] = [
  {
    id: "ft-zoo",
    name: "Zoo visit",
    adultRatioAdults: 1,
    adultRatioStudents: 5,
    leaderRatioAdults: 1,
    leaderRatioStudents: 10,
    policyCitationId: "policy-field-trip"
  }
];

const baseFieldTripEvents: Record<DayOfWeek, FieldTripEvent | undefined> = {
  mon: {
    id: "ft-mon",
    scheduleWeekId: "week-1",
    dayOfWeek: "mon",
    segment: "open",
    scheduleDayId: "day-mon",
    isNoFieldTrip: true
  },
  tue: {
    id: "ft-tue",
    scheduleWeekId: "week-1",
    dayOfWeek: "tue",
    segment: "open",
    scheduleDayId: "day-tue",
    fieldTripTypeId: fieldTripTypes[0].id
  },
  wed: undefined,
  thu: undefined,
  fri: undefined,
  sat: undefined,
  sun: undefined
};

const metadataDays: ScheduleDay[] = [
  {
    id: "day-mon",
    scheduleWeekId: "week-1",
    date: "2026-02-10",
    dayOfWeek: "mon",
    fieldTripEventId: baseFieldTripEvents.mon?.id
  },
  {
    id: "day-tue",
    scheduleWeekId: "week-1",
    date: "2026-02-11",
    dayOfWeek: "tue",
    enrollmentCount: 22,
    scheduleType: "regular",
    fieldTripEventId: baseFieldTripEvents.tue?.id
  }
];

const renderStrip = (overrides?: Partial<{
  fieldTripEventsByDay: Record<DayOfWeek, FieldTripEvent | undefined>;
  days: ScheduleDay[];
  scheduleTypeOptions: ScheduleTypeOption[];
}>) => {
  const props = {
    days: overrides?.days ?? metadataDays,
    dayDisplayNames,
    daySequence,
    scheduleTypeOptions: overrides?.scheduleTypeOptions ?? scheduleTypeOptions,
    fieldTripTypes,
    fieldTripEventsByDay: overrides?.fieldTripEventsByDay ?? baseFieldTripEvents,
    onEnrollmentChange: jest.fn(),
    onScheduleTypeChange: jest.fn(),
    onFieldTripSelection: jest.fn()
  };
  return render(<DayMetadataStrip {...props} />);
};

describe("DayMetadataStrip", () => {
  it("highlights days missing metadata and surfaces the ratio hint once a type is selected", () => {
    renderStrip();

    const mondayCard = screen.getByText("Monday").closest("article");
    expect(mondayCard).not.toBeNull();
    expect(within(mondayCard as HTMLElement).getByText("Required")).toBeVisible();
    expect(within(mondayCard as HTMLElement).getByText("Enter the enrolled child count to trigger ratio math.")).toBeVisible();

    const tuesdayCard = screen.getByText("Tuesday").closest("article");
    expect(tuesdayCard).not.toBeNull();
    expect(within(tuesdayCard as HTMLElement).getByText("Adult:Student 1:8")).toBeInTheDocument();
    expect(within(tuesdayCard as HTMLElement).getAllByText("Zoo visit").length).toBeGreaterThan(0);
  });

  it("invokes callbacks with the expected payloads as the user edits each control", async () => {
    const onEnrollmentChange = jest.fn();
    const onScheduleTypeChange = jest.fn();
    const onFieldTripSelection = jest.fn();
    const editableDays: ScheduleDay[] = [
      {
        ...metadataDays[0],
        enrollmentCount: 12
      },
      metadataDays[1]
    ];

    render(
      <DayMetadataStrip
        days={editableDays}
        dayDisplayNames={dayDisplayNames}
        daySequence={daySequence}
        scheduleTypeOptions={scheduleTypeOptions}
        fieldTripTypes={fieldTripTypes}
        fieldTripEventsByDay={baseFieldTripEvents}
        onEnrollmentChange={onEnrollmentChange}
        onScheduleTypeChange={onScheduleTypeChange}
        onFieldTripSelection={onFieldTripSelection}
      />
    );

    const mondayCard = screen.getByText("Monday").closest("article");
    expect(mondayCard).not.toBeNull();
    const monday = mondayCard as HTMLElement;

    const enrollmentInput = within(monday).getByPlaceholderText("e.g. 22");
    fireEvent.change(enrollmentInput, { target: { value: "" } });
    expect(onEnrollmentChange).toHaveBeenLastCalledWith("day-mon", undefined);
    onEnrollmentChange.mockClear();
    fireEvent.change(enrollmentInput, { target: { value: "17" } });
    expect(onEnrollmentChange).toHaveBeenLastCalledWith("day-mon", 17);

    const selects = within(monday).getAllByRole("combobox");
    expect(selects).toHaveLength(2);
    const [scheduleSelect, fieldTripSelect] = selects;

    await userEvent.selectOptions(scheduleSelect, "extended" as ScheduleType);
    expect(onScheduleTypeChange).toHaveBeenLastCalledWith("day-mon", "extended");
    await userEvent.selectOptions(scheduleSelect, "");
    expect(onScheduleTypeChange).toHaveBeenLastCalledWith("day-mon", undefined);

    await userEvent.selectOptions(fieldTripSelect, fieldTripTypes[0].id);
    expect(onFieldTripSelection).toHaveBeenNthCalledWith(1, "day-mon", {
      type: "trip",
      fieldTripTypeId: fieldTripTypes[0].id
    });
    await userEvent.selectOptions(fieldTripSelect, "no-field-trip");
    expect(onFieldTripSelection).toHaveBeenNthCalledWith(2, "day-mon", {
      type: "none"
    });
  });
});
