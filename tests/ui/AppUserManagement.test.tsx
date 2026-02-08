import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as apiClient from "../../apps/ui/data/apiClient";
import { daySequence, weekMeta } from "../../apps/ui/data/runtimeDefaults";

jest.mock("../../apps/ui/data/apiClient");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const App = require("../../apps/ui/App").default as typeof import("../../apps/ui/App").default;

describe("App user management", () => {
  const fetchAuthMeMock = apiClient.fetchAuthMe as jest.MockedFunction<typeof apiClient.fetchAuthMe>;
  const fetchSettingsMock = apiClient.fetchSettings as jest.MockedFunction<typeof apiClient.fetchSettings>;
  const fetchScheduleMock = apiClient.fetchSchedule as jest.MockedFunction<typeof apiClient.fetchSchedule>;
  const fetchSchoolUsersMock = apiClient.fetchSchoolUsers as jest.MockedFunction<typeof apiClient.fetchSchoolUsers>;
  const fetchSchoolInvitesMock = apiClient.fetchSchoolInvites as jest.MockedFunction<typeof apiClient.fetchSchoolInvites>;
  const inviteSchoolUserMock = apiClient.inviteSchoolUser as jest.MockedFunction<typeof apiClient.inviteSchoolUser>;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchAuthMeMock.mockResolvedValue({
      user: {
        id: "user-1",
        email: "admin@example.com",
        displayName: "Admin",
        isSuperUser: false
      },
      memberships: [{ schoolId: "school-evergreen", role: "school_admin" }],
      schoolMemberships: [{ schoolId: "school-evergreen", role: "school_admin" }],
      districtMemberships: [{ districtId: "district-1", role: "district_admin" }]
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
    fetchSchoolUsersMock.mockResolvedValue({
      users: [
        {
          id: "user-2",
          email: "teacher@example.com",
          displayName: "Teacher",
          status: "active"
        }
      ]
    });
    fetchSchoolInvitesMock.mockResolvedValue({
      invites: [
        {
          id: "invite-1",
          email: "newuser@example.com",
          displayName: "New User",
          role: "school_user",
          schoolId: "school-evergreen",
          schoolName: "Evergreen",
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          acceptedAt: null,
          revokedAt: null,
          inviteUrl: "http://localhost:5173/invite?token=invite-1"
        }
      ]
    });
    inviteSchoolUserMock.mockResolvedValue({
      invite: {
        id: "invite-2",
        email: "parent@example.com",
        displayName: "Parent",
        role: "school_user",
        schoolId: "school-evergreen",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        acceptedAt: null,
        revokedAt: null,
        inviteUrl: "http://localhost:5173/invite?token=invite-2"
      },
      delivery: {
        queued: true,
        provider: "console",
        simulated: true
      }
    });
  });

  it("opens user management and sends an invite", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(/Week of/i);
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Manage Users" }));
    });

    expect(await screen.findByText("User management")).toBeInTheDocument();
    expect(await screen.findByText("teacher@example.com")).toBeInTheDocument();
    expect(fetchSchoolUsersMock).toHaveBeenCalled();
    expect(fetchSchoolInvitesMock).toHaveBeenCalled();

    await act(async () => {
      await user.type(screen.getByPlaceholderText("name@school.org"), "parent@example.com");
      await user.click(screen.getByRole("button", { name: "Send invite" }));
    });

    expect(inviteSchoolUserMock).toHaveBeenCalledWith("school-evergreen", {
      email: "parent@example.com",
      displayName: undefined,
      role: "school_user"
    });
    expect(await screen.findByText(/Invite ready\. Share this link if needed:/i)).toBeInTheDocument();
  });
});
