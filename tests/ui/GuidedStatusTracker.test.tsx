import { fireEvent, render, screen } from "@testing-library/react";
import GuidedStatusTracker from "../../src/ui/components/GuidedStatusTracker";
import type { GuidedStep } from "../../src/ui/types";

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
      actionLabel: "Mark validations addressed"
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

    expect(screen.getByText("1. Draft workspace")).toBeVisible();
    expect(screen.getByText("Field trip needs a director signature")).toBeVisible();
  });

  it("calls onStepAction when an actionable button is clicked", () => {
    const onStepAction = jest.fn();
    render(<GuidedStatusTracker steps={baseSteps} onStepAction={onStepAction} />);

    fireEvent.click(screen.getByRole("button", { name: "Mark validations addressed" }));
    expect(onStepAction).toHaveBeenCalledWith("validation");
  });
});
