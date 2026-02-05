import { expect, test } from "@playwright/test";

test.describe("Scheduling workspace interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Schedule grid" })).toBeVisible();
  });

  test("guided tracker action clears violations while publish stays blocked until field-trip sign-off", async ({
    page
  }) => {
    const validationStep = page.locator("article", { has: page.getByText("Validation") });
    const violationHighlight = page.getByText(/violations outstanding/);
    await expect(violationHighlight).toHaveText(/^\d+ violations outstanding$/);
    const markValidationsButton = validationStep.getByRole("button", { name: "Mark validations addressed" });
    await markValidationsButton.click();
    await expect(validationStep.getByText("Complete")).toBeVisible();
    await expect(page.getByText("0 violations outstanding")).toBeVisible();

    const publishButton = page.getByRole("button", { name: "Publish blocked" });
    await expect(publishButton).toBeDisabled();

    const fieldTripStep = page.locator("article", { has: page.getByText("Field trip sign-off") });
    await expect(fieldTripStep.getByText("Field trip needs a director signature")).toBeVisible();
  });

  test("auto-select highlights the first staff card in the palette", async ({ page }) => {
    const staffPalette = page.locator("div", { has: page.getByRole("heading", { name: "Staff palette" }) });
    const staffCard = staffPalette.getByRole("button", { name: "Aisha Patel" }).first();
    const autoSelectButton = staffPalette.getByRole("button", { name: "Auto-select" });
    await autoSelectButton.click();
    await expect(staffCard).toHaveCSS("border-width", "2px");
    await expect(staffCard).toHaveCSS("border-color", "rgb(37, 99, 235)");
    await expect(staffCard).toHaveCSS("background-color", "rgb(238, 242, 255)");
  });
});
