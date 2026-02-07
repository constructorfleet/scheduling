import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../apps/ui/App";
import * as apiClient from "../../apps/ui/data/apiClient";
import { daySequence, weekMeta } from "../../apps/ui/data/runtimeDefaults";
import type { ScheduleWeekResponse } from "../../apps/ui/data/generated";

jest.mock("../../apps/ui/data/apiClient");

const buildSchedule = (weekId: string, startDate: string): ScheduleWeekResponse => {
  const scheduleDays = daySequence.map((day, index) => ({
    id: `${weekId}-day-${day}`,
    scheduleWeekId: weekId,
    date: new Date(new Date(`${startDate}T00:00:00`).getTime() + index * 86400000)
      .toISOString()
      .slice(0, 10),
    dayOfWeek: day,
    scheduleType: "regular" as const,
    dayScheduleType: "full_day" as const,
    enrollmentCount: 20,
    fieldTripEventId: `${weekId}-field-trip-${day}`
  }));
  return {
    id: weekId,
    schoolId: "school-evergreen",
    label: "Week",
    status: "draft",
    startDate,
    scheduleDays,
    segmentBlocks: [],
    staffAssignments: [],
    fieldTripEvents: daySequence.map((day) => ({
      id: `${weekId}-field-trip-${day}`,
      scheduleWeekId: weekId,
      dayOfWeek: day,
      segment: "mid",
      scheduleDayId: `${weekId}-day-${day}`,
      isNoFieldTrip: true
    })),
    auditEvents: []
  };
};

describe("App settings flow", () => {
  const fetchSettingsMock = apiClient.fetchSettings as jest.MockedFunction<typeof apiClient.fetchSettings>;
  const fetchScheduleMock = apiClient.fetchSchedule as jest.MockedFunction<typeof apiClient.fetchSchedule>;
  const saveSettingsMock = apiClient.saveSettings as jest.MockedFunction<typeof apiClient.saveSettings>;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchSettingsMock.mockResolvedValue({
      school: {
        id: "school-evergreen",
        name: "Evergreen",
        closedDays: [],
        openerCount: 1,
        closerCount: 1,
        minimumMedicalDelegated: 0,
        requireCurrentCpr: false
      },
      scheduleTypes: [
        {
          id: "regular",
          schoolId: "school-evergreen",
          value: "regular",
          label: "Regular",
          ratioAdults: 1,
          ratioStudents: 15,
          description: ""
        }
      ],
      jobTitles: [],
      employees: [],
      operatingHours: [],
      fieldTripTypes: []
    });
    fetchScheduleMock.mockResolvedValue(buildSchedule(weekMeta.id, weekMeta.startDate));
    saveSettingsMock.mockResolvedValue({
      school: {
        id: "school-evergreen",
        name: "Evergreen",
        closedDays: [],
        openerCount: 1,
        closerCount: 1,
        minimumMedicalDelegated: 0,
        requireCurrentCpr: false
      }
    });
  });

  it("warns on closing settings with unsaved changes and saves when requested", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(/Week of/i);

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Open Settings" }));
    });

    const nameInput = await screen.findByPlaceholderText("School name");
    await act(async () => {
      await user.clear(nameInput);
      await user.type(nameInput, "Evergreen Prep");
    });

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Close" }));
    });
    expect(screen.getByText("Save or discard changes before closing settings.")).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Save school settings" }));
    });
    expect(saveSettingsMock).toHaveBeenCalled();
  });
});
