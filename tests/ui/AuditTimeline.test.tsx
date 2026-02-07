import { act, fireEvent, render, screen } from "@testing-library/react";
import AuditTimeline from "../../apps/ui/components/AuditTimeline";
import type { AuditEvent } from "../../apps/ui/types";

const events: AuditEvent[] = [
  {
    id: "audit-1",
    timestamp: new Date("2026-02-01T10:00:00Z").toISOString(),
    user: "Alex",
    action: "Updated enrollment",
    policyCitation: { id: "cit-1", name: "User action", document: "UI" },
    notes: "Mon: 22"
  }
];

describe("AuditTimeline", () => {
  it("renders empty state when no events exist", () => {
    render(
      <AuditTimeline
        events={[]}
        onUndo={jest.fn()}
        onRedo={jest.fn()}
        canUndo={false}
        canRedo={false}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText("No audit events recorded yet.")).toBeInTheDocument();
  });

  it("renders events and fires undo/redo handlers", async () => {
    const onUndo = jest.fn();
    const onRedo = jest.fn();
    const onClose = jest.fn();

    render(
      <AuditTimeline
        events={events}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={true}
        canRedo={true}
        isOpen={true}
        onClose={onClose}
      />
    );

    expect(screen.getByText("Updated enrollment")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
      fireEvent.click(screen.getByRole("button", { name: "Redo" }));
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
    });

    expect(onUndo).toHaveBeenCalled();
    expect(onRedo).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
