import { expect, test } from "@playwright/test";

test.describe("Day metadata workflows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Day metadata" })).toBeVisible();
  });

  test("schedule-type and field-trip inputs surface hints and required markers", async ({ page }) => {
    const dayMetadataSection = page.locator("section", {
      has: page.getByRole("heading", { name: "Day metadata" })
    });
    const mondayCard = dayMetadataSection.locator("article", { hasText: "Mon" }).first();

    const scheduleTypeSelect = mondayCard.locator("select").first();
    await scheduleTypeSelect.selectOption("enrichment");
    await expect(mondayCard.getByText("Leader-led pods (1 leader per 4 children)")).toBeVisible();

    const fieldTripSelect = mondayCard.locator("select").nth(1);
    await fieldTripSelect.selectOption("ft-forest");
    await expect(mondayCard.getByText("Forest STEAM outing")).toBeVisible();

    await scheduleTypeSelect.selectOption("");
    await expect(mondayCard.getByText("Required")).toBeVisible();
  });

  test("choosing a new trip re-blocks approval until the director signs off again", async ({ page }) => {
    const fieldTripPanel = page.locator("section", {
      has: page.getByRole("heading", { name: "Field trip approval" })
    });

    const addSignOffButton = fieldTripPanel.getByRole("button", { name: "Add director sign-off" });
    await addSignOffButton.click();
    await expect(fieldTripPanel.getByText("Approved")).toBeVisible();
    await expect(fieldTripPanel.getByRole("button", { name: "Signed off" })).toBeDisabled();

    const dayMetadataSection = page.locator("section", {
      has: page.getByRole("heading", { name: "Day metadata" })
    });
    const fridayCard = dayMetadataSection.locator("article", { hasText: "Fri" }).first();
    const fieldTripSelect = fridayCard.locator("select").nth(1);
    await fieldTripSelect.selectOption("ft-forest");
    await expect(fridayCard.getByText("Forest STEAM outing")).toBeVisible();

    await expect(fieldTripPanel.getByText("Sign-off required")).toBeVisible();
    await expect(fieldTripPanel.getByText("Approver: Pending")).toBeVisible();
    await expect(fieldTripPanel.getByText("Signed at: Not recorded")).toBeVisible();
    await expect(fieldTripPanel.getByRole("button", { name: "Add director sign-off" })).toBeEnabled();
  });
});
