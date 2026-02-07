import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPanel, { JobTitleSetting, OperatingHoursConfig, SchoolRules } from "../../apps/ui/components/SettingsPanel";
import type { Employee, FieldTripType } from "@core/domain/types";
import type { ScheduleTypeOption } from "../../apps/ui/components/DayMetadataStrip";

const scheduleTypes: ScheduleTypeOption[] = [
  {
    value: "regular",
    label: "Regular day",
    ratio: { adults: 1, students: 10 },
    description: "Standard"
  }
];

const jobTitles: JobTitleSetting[] = [
  { id: "job-1", title: "Assistant", leaderQualified: false, requiresLeaderForOpenClose: false }
];

const operatingHoursConfig: OperatingHoursConfig[] = [
  {
    id: "hours-1",
    scheduleType: "regular",
    daysOfWeek: ["mon", "tue"],
    open: "07:00",
    close: "17:00"
  }
];

const overlappingOperatingHours: OperatingHoursConfig[] = [
  {
    id: "hours-1",
    scheduleType: "regular",
    daysOfWeek: ["mon", "tue"],
    open: "07:00",
    close: "17:00"
  },
  {
    id: "hours-2",
    scheduleType: "regular",
    daysOfWeek: ["tue"],
    open: "08:00",
    close: "18:00"
  }
];

const fieldTrips: FieldTripType[] = [
  {
    id: "trip-1",
    name: "Zoo",
    adultRatioAdults: 1,
    adultRatioStudents: 10,
    leaderRatioAdults: 1,
    leaderRatioStudents: 10,
    policyCitationId: "policy-trip"
  }
];

const employees: Employee[] = [
  {
    id: "emp-1",
    name: "Jordan Lee",
    jobTitle: "Assistant",
    maxHoursPerDay: 8,
    maxHoursPerWeek: 40,
    employmentStatus: "active",
    leaderQualified: false,
    medicallyDelegated: false,
    cprCurrent: true
  }
];

const schoolRules: SchoolRules = {
  openerCount: 1,
  closerCount: 1,
  minimumMedicalDelegated: 0,
  requireCurrentCpr: false
};

const renderSettings = (overrides?: Partial<{
  operatingHoursConfig: OperatingHoursConfig[];
}>) => {
  const onDirtyChange = jest.fn();
  render(
    <SettingsPanel
      isOpen={true}
      onClose={jest.fn()}
      schoolName="Cedar Ridge"
      schoolRules={schoolRules}
      scheduleTypes={scheduleTypes}
      jobTitles={jobTitles}
      operatingHoursConfig={overrides?.operatingHoursConfig ?? operatingHoursConfig}
      closedDays={[]}
      fieldTripTypes={fieldTrips}
      employees={employees}
      onUpdateScheduleTypes={jest.fn()}
      onUpdateJobTitles={jest.fn()}
      onUpdateOperatingHoursConfig={jest.fn()}
      onUpdateClosedDays={jest.fn()}
      onUpdateSchoolName={jest.fn()}
      onUpdateSchoolRules={jest.fn()}
      onUpdateFieldTrips={jest.fn()}
      onUpdateEmployees={jest.fn()}
      onDirtyChange={onDirtyChange}
      closeAttempt={0}
    />
  );
  return { onDirtyChange };
};

describe("SettingsPanel", () => {
  it("blocks tab navigation when a section is dirty", async () => {
    const user = userEvent.setup();
    renderSettings();

    const nameInput = screen.getByPlaceholderText("School name");
    await act(async () => {
      await user.clear(nameInput);
      await user.type(nameInput, "Updated School");
      await user.click(await screen.findByRole("button", { name: "Schedule types" }));
    });

    expect(screen.getByText("Save or discard changes before leaving this section.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save school settings" })).toBeEnabled();
  });

  it("disables saving operating hours when overlapping days exist", async () => {
    const user = userEvent.setup();
    renderSettings({ operatingHoursConfig: overlappingOperatingHours });

    await act(async () => {
      await user.click(await screen.findByRole("button", { name: "Operating hours" }));
    });
    const openInput = (await screen.findAllByDisplayValue("07:00"))[0];
    await act(async () => {
      await user.clear(openInput);
      await user.type(openInput, "06:30");
    });

    expect(screen.getByText(/overlapping coverage/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save operating hours" })).toBeDisabled();
  });
});
