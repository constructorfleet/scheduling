import { expect, test } from "@playwright/test";

test.describe("Scheduling workspace guided flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Schedule grid" })).toBeVisible();
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

  test("resolving violations and field-trip approvals allows publishing", async ({ page }) => {
    const markResolvedButton = page.getByRole("button", { name: "Mark resolved" });
    const totalViolations = await markResolvedButton.count();
    for (let i = 0; i < totalViolations; i += 1) {
      await markResolvedButton.first().click();
    }
    await expect(page.getByText("0 violations outstanding")).toBeVisible();
    const validationStep = page.locator("article", { hasText: "Validation" });
    await expect(validationStep.getByText("Complete")).toBeVisible();

    const signOffButton = page.getByRole("button", { name: "Add director sign-off" });
    await signOffButton.click();
    await expect(page.getByText("Field trip approved")).toBeVisible();
    const signedOffButton = page.getByRole("button", { name: "Signed off" });
    await expect(signedOffButton).toBeDisabled();

    const publishButton = page.getByRole("button", { name: "Publish schedule" });
    await expect(publishButton).toBeEnabled();
    await publishButton.click();
    await expect(page.getByText(/^Schedule published/)).toBeVisible();
  });

  test("substitute parity resolution and audit controls stay in sync", async ({ page }) => {
    const resolveParity = page.getByRole("button", { name: "Resolve parity" });
    await resolveParity.click();
    const substitutePanel = page.locator("section", {
      has: page.getByRole("heading", { name: "Substitute coverage" })
    });
    await expect(substitutePanel.getByText("ready")).toBeVisible();
    await expect(substitutePanel.getByText("Approver: Aisha Patel")).toBeVisible();
    await expect(substitutePanel.getByText("Signed")).toBeVisible();
    await expect(substitutePanel.getByRole("button", { name: "Resolve parity" })).toHaveCount(0);

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
