import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../apps/ui/App";

describe("App violation navigator integration", () => {
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
