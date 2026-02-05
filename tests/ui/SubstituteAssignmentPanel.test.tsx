import { fireEvent, render, screen } from "@testing-library/react";
import SubstituteAssignmentPanel from "../../src/ui/components/SubstituteAssignmentPanel";
import type { SubstituteAssignmentCard } from "../../src/ui/types";
import type { DayOfWeek } from "../../src/domain/types";

describe("SubstituteAssignmentPanel", () => {
  const requests: SubstituteAssignmentCard[] = [
    {
      requestId: "req-blocked",
      replacementName: "Zoe Martinez",
      originalDay: "wed" as DayOfWeek,
      segmentLabel: "Midday",
      approver: undefined,
      approvedAt: undefined,
      parityCheck: false,
      issues: ["Approver metadata missing", "Approval timestamp missing"],
      state: "blocked"
    },
    {
      requestId: "req-ready",
      replacementName: "Aisha Patel",
      originalDay: "fri" as DayOfWeek,
      segmentLabel: "Morning",
      approver: "Aisha Patel",
      approvedAt: "2026-02-04T10:00:00Z",
      parityCheck: true,
      issues: [],
      state: "ready"
    }
  ];

  it("lists issues for blocked requests and exposes the resolve button", () => {
    const onRequestAction = jest.fn();
    render(<SubstituteAssignmentPanel requests={requests} onRequestAction={onRequestAction} />);

    expect(screen.getByText("Approver metadata missing")).toBeVisible();
    expect(screen.getByText("Approval timestamp missing")).toBeVisible();
    const actionButtons = screen.getAllByRole("button", { name: "Resolve parity" });
    expect(actionButtons).toHaveLength(1);
    fireEvent.click(actionButtons[0]);
    expect(onRequestAction).toHaveBeenCalledWith("req-blocked", "resolve");
  });

  it("does not show a resolve button when every request is ready", () => {
    const readyOnly = requests.filter((request) => request.state === "ready");
    render(<SubstituteAssignmentPanel requests={readyOnly} />);

    expect(screen.queryByRole("button", { name: "Resolve parity" })).toBeNull();
  });
});
