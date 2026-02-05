import { expect, test } from "@playwright/test";

test.describe("Scheduling workspace interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Day metadata" })).toBeVisible();
  });

  test("auto-balance suggestions focus a violation block while validation stays in progress", async ({ page }) => {
    const timeline = page.locator("section", {
      has: page.getByRole("heading", { name: "Clock block timeline" })
    });
    await expect(timeline.locator("button[aria-pressed='true']")).toHaveCount(0);
    await timeline.getByRole("button", { name: "Auto-balance suggestions" }).click();
    await expect(timeline.locator("button[aria-pressed='true']")).toHaveCount(1);

    const validationStep = page.locator("article", { hasText: "Validation" });
    await expect(validationStep.getByText("In progress")).toBeVisible();
    await expect(validationStep.getByRole("button", { name: "Review violations" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Publish blocked" })).toBeDisabled();
  });

  test("auto-select highlights the first staff card", async ({ page }) => {
    const staffPalette = page.locator("div", { has: page.getByRole("heading", { name: "Staff palette" }) });
    const staffCard = staffPalette.getByRole("button", { name: "Aisha Patel" }).first();
    const autoSelectButton = staffPalette.getByRole("button", { name: "Auto-select" });
    await autoSelectButton.click();
    await expect(staffCard).toHaveCSS("border-width", "2px");
    await expect(staffCard).toHaveCSS("border-color", "rgb(37, 99, 235)");
    await expect(staffCard).toHaveCSS("background-color", "rgb(238, 242, 255)");
  });
});
