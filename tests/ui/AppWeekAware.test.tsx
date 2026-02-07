import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../apps/ui/App";
import * as apiClient from "../../apps/ui/data/apiClient";
import { daySequence, weekMeta } from "../../apps/ui/data/runtimeDefaults";
import type { ScheduleWeekResponse } from "../../apps/ui/data/generated";

jest.mock("../../apps/ui/data/apiClient");

const addDays = (isoDate: string, offset: number) => {
  const base = new Date(`${isoDate}T00:00:00`);
  base.setDate(base.getDate() + offset);
  return base.toISOString().slice(0, 10);
};

const buildSchedule = (weekId: string, startDate: string): ScheduleWeekResponse => {
  const scheduleDays: ScheduleWeekResponse["scheduleDays"] = daySequence.map((day, index) => ({
    id: `${weekId}-day-${day}`,
    scheduleWeekId: weekId,
    date: addDays(startDate, index),
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

describe("App week-aware navigation", () => {
  const fetchSettingsMock = apiClient.fetchSettings as jest.MockedFunction<typeof apiClient.fetchSettings>;
  const fetchScheduleMock = apiClient.fetchSchedule as jest.MockedFunction<typeof apiClient.fetchSchedule>;
  const saveScheduleMock = apiClient.saveSchedule as jest.MockedFunction<typeof apiClient.saveSchedule>;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchSettingsMock.mockResolvedValue({
      school: {
        id: "school-evergreen",
        name: "School",
        closedDays: [],
        openerCount: 2,
        closerCount: 2,
        minimumMedicalDelegated: 1,
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
    let servedInitialWeek = false;
    fetchScheduleMock.mockImplementation(async (weekId: string) => {
      if (!servedInitialWeek) {
        servedInitialWeek = true;
        return buildSchedule(weekId, weekMeta.startDate);
      }
      return null;
    });
    saveScheduleMock.mockResolvedValue({ ok: true } as Awaited<ReturnType<typeof apiClient.saveSchedule>>);
  });

  it("does not autosave into a new week before the week is initialized", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(/Week of/i);
    await waitFor(() => expect(fetchScheduleMock).toHaveBeenCalledTimes(1));

    saveScheduleMock.mockClear();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /Next/i }));
    });

    await screen.findByText(/No schedule exists for/i);
    await waitFor(
      () => {
        expect(saveScheduleMock).not.toHaveBeenCalled();
      },
      { timeout: 700 }
    );

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /Create blank schedule/i }));
    });

    await waitFor(() => expect(saveScheduleMock).toHaveBeenCalledTimes(1));
  });
});
