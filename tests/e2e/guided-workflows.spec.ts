import { expect, test } from "@playwright/test";

test.describe("Scheduling workspace guided flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Day metadata" })).toBeVisible();
  });

  test("week navigation updates the displayed range", async ({ page }) => {
    const weekLabel = page.getByText(/^Week of/);
    const initialLabel = (await weekLabel.textContent())?.trim() ?? "";
    await page.getByRole("button", { name: "Next →" }).click();
    await expect(weekLabel).not.toHaveText(initialLabel);
    await expect(weekLabel).toContainText(", 2026");
    await page.getByRole("button", { name: "← Previous" }).click();
    await expect(weekLabel).toHaveText(initialLabel);
  });

  test("signing off blocks publishing until validations are cleared", async ({ page }) => {
    const validationStep = page.locator("article", { hasText: "Validation" });
    await expect(validationStep.getByText("In progress")).toBeVisible();
    await expect(validationStep.getByRole("button", { name: "Review violations" })).toBeVisible();

    const fieldTripPanel = page.locator("section", {
      has: page.getByRole("heading", { name: "Field trip approval" })
    });
    await expect(fieldTripPanel.getByText("Sign-off required")).toBeVisible();

    const fieldTripStep = page.locator("article", { hasText: "Field trip sign-off" });
    await expect(fieldTripStep.getByText("Field trip needs a director signature")).toBeVisible();

    const addSignOffButton = fieldTripPanel.getByRole("button", { name: "Add director sign-off" });
    await addSignOffButton.click();

    await expect(fieldTripPanel.getByText("Approved")).toBeVisible();
    await expect(fieldTripPanel.getByRole("button", { name: "Signed off" })).toBeDisabled();
    await expect(fieldTripStep.getByText("Complete")).toBeVisible();
    await expect(fieldTripStep.locator("text=Field trip needs a director signature")).toHaveCount(0);
    await expect(fieldTripStep.getByRole("button", { name: "Add director sign-off" })).toHaveCount(0);

    const publishButton = page.getByRole("button", { name: "Publish schedule" });
    await expect(publishButton).toBeDisabled();
    await expect(validationStep.getByRole("button", { name: "Review violations" })).toBeVisible();
    await expect(page.getByText("Field trip approved")).toBeVisible();
  });

  test("audit controls stay in sync", async ({ page }) => {
    const undoButton = page.getByRole("button", { name: "Undo" });
    const redoButton = page.getByRole("button", { name: "Redo" });
    await expect(undoButton).toBeEnabled();
    await expect(redoButton).toBeDisabled();
    await undoButton.click();
    await expect(redoButton).toBeEnabled();
    await redoButton.click();
    await expect(redoButton).toBeDisabled();
  });
});
