import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GuidedStatusTracker from "../../apps/ui/components/GuidedStatusTracker";
import type { GuidedStep } from "../../apps/ui/types";

describe("GuidedStatusTracker", () => {
  const baseSteps: GuidedStep[] = [
    {
      id: "draft",
      label: "Draft workspace",
      detail: "Add staff and break coverage before running validation.",
      status: "complete"
    },
    {
      id: "validation",
      label: "Validation",
      detail: "Violations link directly to the grid; clear them so the tracker turns green.",
      status: "in_progress",
      actionLabel: "Review violations"
    },
    {
      id: "field-trip",
      label: "Field trip sign-off",
      detail: "Director approval metadata gates any trip overrides.",
      status: "blocked",
      actionLabel: "Add director sign-off",
      blockingReason: "Field trip needs a director signature"
    }
  ];

  it("renders steps with statuses and blocking details", () => {
    render(<GuidedStatusTracker steps={baseSteps} />);

    expect(screen.getByText("1. Draft workspace")).toBeInTheDocument();
    expect(screen.getByText("Field trip needs a director signature")).toBeInTheDocument();
  });

  it("calls onStepAction when an actionable button is clicked", () => {
    const onStepAction = jest.fn();
    render(<GuidedStatusTracker steps={baseSteps} onStepAction={onStepAction} />);

    fireEvent.click(screen.getByRole("button", { name: "Review violations" }));
    expect(onStepAction).toHaveBeenCalledWith("validation");
  });

  it("collapses to show active step summary and hides step cards", async () => {
    const user = userEvent.setup();
    render(<GuidedStatusTracker steps={baseSteps} />);

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Collapse" }));
    });
    expect(screen.getByText("Active: Validation · In progress")).toBeInTheDocument();
    expect(screen.queryByText("1. Draft workspace")).not.toBeInTheDocument();
  });
});
