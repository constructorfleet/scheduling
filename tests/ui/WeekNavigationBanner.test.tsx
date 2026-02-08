import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WeekNavigationBanner from "../../apps/ui/components/WeekNavigationBanner";

describe("WeekNavigationBanner", () => {
  const baseProps = {
    schoolOptions: [
      { id: "school-1", name: "Cedar Ridge" },
      { id: "school-2", name: "Oak Hill" }
    ],
    selectedSchoolId: "school-1",
    onSchoolChange: jest.fn(),
    weekLabel: "Feb 2–Feb 8",
    status: "draft" as const,
    onShiftWeek: jest.fn(),
    onOpenViolations: jest.fn(),
    onOpenAuditTimeline: jest.fn(),
    hasViolations: true,
    isViolationsOpen: false,
    isAuditOpen: false,
    onOpenSettings: jest.fn(),
    isSettingsOpen: false,
    onOpenUserManagement: jest.fn(),
    isUserManagementOpen: false,
    canManageUsers: true,
    onAutoSchedule: jest.fn(),
    canManageSettings: true,
    canEditSchedule: true,
    userDisplayName: "Test User",
    userRoleLabel: "DIRECTOR",
    onLogout: jest.fn(),
    apiStatus: {
      state: "idle" as const,
      message: "Idle"
    }
  };

  it("disables the violations button when there are no violations", () => {
    render(<WeekNavigationBanner {...baseProps} violationCount={0} hasViolations={false} />);
    const button = screen.getByRole("button", { name: "Open Violations" });
    expect(button).toBeDisabled();
  });

  it("toggles labels for violations and audit buttons based on open state", async () => {
    const user = userEvent.setup();
    render(<WeekNavigationBanner {...baseProps} violationCount={1} isViolationsOpen={true} isAuditOpen={true} />);

    const violationsButton = screen.getByRole("button", { name: "Close Violations" });
    const auditButton = screen.getByRole("button", { name: "Close Audit Log" });
    await user.click(violationsButton);
    await user.click(auditButton);

    expect(baseProps.onOpenViolations).toHaveBeenCalledTimes(1);
    expect(baseProps.onOpenAuditTimeline).toHaveBeenCalledTimes(1);
  });
});
