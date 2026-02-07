import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../apps/ui/App";

describe("App violation navigator integration", () => {
  it("focuses a schedule block when jumping from a violation", async () => {
    const user = userEvent.setup();
    const originalScroll = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = jest.fn();

    const { container } = render(<App />);
    const openViolationsButton = await screen.findByRole("button", { name: /Open Violations/i });
    await act(async () => {
      await user.click(openViolationsButton);
    });

    const jumpButtons = await screen.findAllByRole("button", { name: "Jump to block" });
    await act(async () => {
      await user.click(jumpButtons[0]);
    });

    const blocks = Array.from(container.querySelectorAll<HTMLElement>('[data-segment-id]'));
    const hasFocusRing = blocks.some((block) => block.style.boxShadow.includes("rgba(37, 99, 235"));
    expect(hasFocusRing).toBe(true);

    HTMLElement.prototype.scrollIntoView = originalScroll;
  });
});
