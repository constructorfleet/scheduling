import { expect, test } from "@playwright/test";

test.describe("Violation-driven workflows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Day metadata" })).toBeVisible();
  });

  test("guided validation action focuses the highlighted block", async ({ page }) => {
    const guidedSection = page.locator("section", {
      has: page.getByRole("heading", { name: "Guided status tracker" })
    });
    const validationStep = guidedSection.locator("article", { hasText: "Validation" });
    const reviewButton = validationStep.getByRole("button", { name: "Review violations" });
    await reviewButton.click();

    const timeline = page.locator("section", {
      has: page.getByRole("heading", { name: "Clock block timeline" })
    });
    await expect(timeline.locator("button[aria-pressed='true']")).toHaveCount(1);

    const publishButton = page.getByRole("button", { name: "Publish blocked" });
    await expect(publishButton).toBeDisabled();
  });

  test("violation navigator jump targets the corresponding timeline block", async ({ page }) => {
    const navigatorSection = page.locator("section", {
      has: page.getByRole("heading", { name: "Violation navigator" })
    });
    const timeline = page.locator("section", {
      has: page.getByRole("heading", { name: "Clock block timeline" })
    });
    await expect(timeline.locator("button[aria-pressed='true']")).toHaveCount(0);

    const jumpButton = navigatorSection.getByRole("button", { name: "Jump to block" }).first();
    await jumpButton.click();

    await expect(timeline.locator("button[aria-pressed='true']")).toHaveCount(1);
    await expect(navigatorSection.getByText("Live violation — edit the timeline to clear it.")).toBeVisible();
  });
});
