import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as apiClient from "../../apps/ui/data/apiClient";
import { daySequence, weekMeta } from "../../apps/ui/data/runtimeDefaults";
import type { ScheduleWeekResponse } from "../../apps/ui/data/generated";

jest.mock("../../apps/ui/data/apiClient");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const App = require("../../apps/ui/App").default as typeof import("../../apps/ui/App").default;

const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};

const addDays = (isoDate: string, offset: number) => {
  const base = parseIsoDate(isoDate);
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
  const fetchAuthMeMock = apiClient.fetchAuthMe as jest.MockedFunction<typeof apiClient.fetchAuthMe>;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchAuthMeMock.mockResolvedValue({
      user: {
        id: "user-1",
        email: "scheduler@example.com",
        displayName: "Scheduler",
        isSuperUser: false
      },
      memberships: [{ schoolId: "school-evergreen", role: "school_user" }],
      schoolMemberships: [{ schoolId: "school-evergreen", role: "school_user" }],
      districtMemberships: []
    });
    fetchSettingsMock.mockResolvedValue({
      school: {
        id: "school-evergreen",
        name: "School",
        closedDays: [],
        openerCount: 2,
        closerCount: 2,
        fieldTripStartTime: "09:00",
        fieldTripEndTime: "15:00",
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
    fetchScheduleMock.mockImplementation(async (weekId: string) => {
      if (weekId === weekMeta.id) {
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

    saveScheduleMock.mockClear();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /→/i }));
    });

    await waitFor(
      () => {
        expect(saveScheduleMock).not.toHaveBeenCalled();
      },
      { timeout: 700 }
    );
  });

  it("renders Monday as Feb 16 for week of Feb 15", async () => {
    render(<App />);

    await screen.findByText(/Week of/i);

    const mondayHeader = screen.getByText("Mon").closest("th");
    expect(mondayHeader).not.toBeNull();
    expect(within(mondayHeader as HTMLElement).getByText(/Feb\s+16/i)).toBeInTheDocument();
  });
});
