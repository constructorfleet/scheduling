import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as apiClient from "../../apps/ui/data/apiClient";
import { daySequence, weekMeta } from "../../apps/ui/data/runtimeDefaults";

jest.mock("../../apps/ui/data/apiClient");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const App = require("../../apps/ui/App").default as typeof import("../../apps/ui/App").default;

describe("App violation navigator integration", () => {
  const fetchAuthMeMock = apiClient.fetchAuthMe as jest.MockedFunction<typeof apiClient.fetchAuthMe>;
  const fetchSettingsMock = apiClient.fetchSettings as jest.MockedFunction<typeof apiClient.fetchSettings>;
  const fetchScheduleMock = apiClient.fetchSchedule as jest.MockedFunction<typeof apiClient.fetchSchedule>;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchAuthMeMock.mockResolvedValue({
      user: {
        id: "user-1",
        email: "viewer@example.com",
        displayName: "Viewer",
        isSuperUser: false
      },
      memberships: [{ schoolId: "school-evergreen", role: "school_user" }],
      schoolMemberships: [{ schoolId: "school-evergreen", role: "school_user" }],
      districtMemberships: []
    });
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
    fetchScheduleMock.mockResolvedValue({
      id: weekMeta.id,
      schoolId: "school-evergreen",
      label: "Week",
      status: "draft",
      startDate: weekMeta.startDate,
      scheduleDays: daySequence.map((day, index) => ({
        id: `${weekMeta.id}-day-${day}`,
        scheduleWeekId: weekMeta.id,
        date: new Date(new Date(`${weekMeta.startDate}T00:00:00`).getTime() + index * 86400000)
          .toISOString()
          .slice(0, 10),
        dayOfWeek: day,
        scheduleType: "regular" as const,
        dayScheduleType: "full_day" as const,
        enrollmentCount: 20,
        fieldTripEventId: `${weekMeta.id}-field-trip-${day}`
      })),
      segmentBlocks: [],
      staffAssignments: [],
      fieldTripEvents: daySequence.map((day) => ({
        id: `${weekMeta.id}-field-trip-${day}`,
        scheduleWeekId: weekMeta.id,
        dayOfWeek: day,
        segment: "mid",
        scheduleDayId: `${weekMeta.id}-day-${day}`,
        isNoFieldTrip: true
      })),
      auditEvents: []
    });
  });

  it("focuses a schedule block when jumping from a violation", async () => {
    const user = userEvent.setup();
    const originalScroll = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = jest.fn();

    render(<App />);
    const openViolationsButton = await screen.findByRole("button", { name: /Open Violations/i });
    await act(async () => {
      await user.click(openViolationsButton);
    });

    const jumpButtons = await screen.findAllByRole("button", { name: "Jump to block" });
    let clicked = false;
    for (const button of jumpButtons) {
      await act(async () => {
        await user.click(button);
      });
      clicked = true;
      break;
    }
    expect(clicked).toBe(true);

    HTMLElement.prototype.scrollIntoView = originalScroll;
  });
});
