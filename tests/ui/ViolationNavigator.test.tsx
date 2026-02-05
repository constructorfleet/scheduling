import { fireEvent, render, screen } from "@testing-library/react";
import ViolationNavigator from "../../src/ui/components/ViolationNavigator";
import type { RuleViolation } from "../../src/ui/types";

const policyCitation = {
  id: "policy-leader",
  name: "Leader coverage policy",
  document: "Leadership Coverage Guide",
  section: "3.4"
};

const violations: RuleViolation[] = [
  {
    id: "viol-1",
    title: "Leader coverage missing",
    severity: "critical",
    description: "Missing leader for Monday open segment.",
    segmentBlockId: "segment-mon-open",
    policyCitation,
    recommendedAction: "Add a leader-qualified staff member."
  },
  {
    id: "viol-2",
    title: "Break not logged",
    severity: "warning",
    description: "Jordan needs a break on Wednesday mid.",
    segmentBlockId: "segment-wed-mid",
    policyCitation,
    recommendedAction: "Log the break or add support coverage."
  }
] as const;

describe("ViolationNavigator", () => {
  it("renders violation cards with severity badges and action buttons", () => {
    render(<ViolationNavigator violations={violations} onFocusSegment={jest.fn()} />);

    expect(screen.getByText("Critical")).toBeVisible();
    expect(
      screen.getAllByText("Live violation — edit the timeline to clear it.")[0]
    ).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Jump to block" })).toHaveLength(2);
  });

  it("calls handlers when action buttons are used", () => {
    const focus = jest.fn();

    render(<ViolationNavigator violations={violations} onFocusSegment={focus} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Jump to block" })[0]);
    expect(focus).toHaveBeenCalledWith("segment-mon-open");
  });
});
