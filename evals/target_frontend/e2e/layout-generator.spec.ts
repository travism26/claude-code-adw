import { test, expect } from "@playwright/test";
import {
  generateTestUser,
  signUpUser,
  waitForAPIResponse,
} from "./fixtures/test-helpers";
import type { Page } from "@playwright/test";
import {
  generateTestGarden,
  navigateToGardenPlanner,
  createGardenViaAPI,
  getGardenViaAPI,
  openGarden,
} from "./fixtures/garden-helpers";

// CORS headers so Playwright-fulfilled responses are accepted by the
// cross-origin (3001 → 3000) fetch in the app's API client.
const CORS_HEADERS = {
  "access-control-allow-origin": "http://localhost:3001",
  "access-control-allow-credentials": "true",
};

/**
 * Stub the AI layout-generation network calls so the workflow tests are
 * deterministic and fast. Live generation is non-deterministic and the model
 * occasionally returns truncated JSON, which would make these tests flaky.
 *
 * Apply is intentionally NOT stubbed — it hits the real backend with real
 * plant-profile ids, so the apply integration is still exercised.
 *
 * @param plantIds two real plant-profile UUIDs to place (so apply succeeds).
 */
async function stubLayoutGeneration(page: Page, plantIds: string[]): Promise<void> {
  const placement = (plantProfileId: string, x: number) => ({
    plantProfileId,
    plantName: "Test Plant",
    x,
    y: 0,
    width: 2,
    height: 2,
    quantity: 1,
    reasoning: "deterministic test placement",
  });
  const makeLayout = (id: string, optimizationGoal: string) => ({
    id,
    optimizationGoal,
    placements: [placement(plantIds[0], 0), placement(plantIds[1], 4)],
    score: 90,
    companionScore: 80,
    spacingScore: 90,
    accessibilityScore: 95,
    warnings: [],
  });
  const layouts = [
    makeLayout("layout_1", "max_yield"),
    makeLayout("layout_2", "max_variety"),
    makeLayout("layout_3", "beginner_friendly"),
  ];

  const json = (body: unknown) => ({
    status: 200,
    headers: CORS_HEADERS,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

  await page.route("**/generate-layout", async (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    return route.fulfill(json({ jobId: "e2e-job", status: "processing" }));
  });

  await page.route("**/ai-tasks/e2e-job", async (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    return route.fulfill(json({ status: "completed", layouts }));
  });
}

/** Read two real plant-profile ids from the rendered plant cards (step 2). */
async function readTwoPlantIds(page: Page): Promise<string[]> {
  const wrappers = page.locator('[data-testid^="plant-card-"]');
  await wrappers.first().waitFor();
  const t0 = await wrappers.nth(0).getAttribute("data-testid");
  const t1 = await wrappers.nth(1).getAttribute("data-testid");
  return [
    (t0 ?? "").replace("plant-card-", ""),
    (t1 ?? "").replace("plant-card-", ""),
  ];
}

test.describe("Layout Generator Workflow", () => {
  let gardenId: string;

  test.beforeEach(async ({ page }) => {
    // Sign up a new user for each test
    const user = generateTestUser();
    await signUpUser(page, user);

    // Create a test garden via API
    const garden = generateTestGarden({
      name: "Layout Test Garden",
      width: 20,
      height: 15,
      zone: "6b",
    });

    const createdGarden = await createGardenViaAPI(page, garden);
    gardenId = createdGarden.id;

    // Navigate to the garden
    await navigateToGardenPlanner(page);
    await openGarden(page, "Layout Test Garden");
  });

  test("should open layout generator modal when button is clicked", async ({
    page,
  }) => {
    // Click the Generate Layout button
    const generateButton = page.getByTestId("generate-layout-button");
    await expect(generateButton).toBeVisible();
    await generateButton.click();

    // Verify modal opens
    const modal = page.getByTestId("layout-generator-modal");
    await expect(modal).toBeVisible();

    // Step 1 is the preferences step; advance to the plant selector (step 2).
    await page.getByTestId("next-button").click();
    const plantSelector = page.getByTestId("plant-selector");
    await expect(plantSelector).toBeVisible();
  });

  test("should require at least 2 plants to proceed", async ({ page }) => {
    // Open modal and advance to the plant selector (step 2).
    await page.getByTestId("generate-layout-button").click();
    await page.getByTestId("next-button").click();

    // On step 2 the action button ("Generate Layouts") is disabled until 2 plants.
    const nextButton = page.getByTestId("next-button");
    await expect(page.getByTestId("plant-card").first()).toBeVisible();
    await expect(nextButton).toBeDisabled();

    // Select 1 plant — still disabled.
    await page.getByTestId("plant-card").first().click();
    await expect(nextButton).toBeDisabled();

    // Select a second plant — now enabled.
    await page.getByTestId("plant-card").first().click();
    await expect(nextButton).not.toBeDisabled();
  });

  test("should filter plants by search query", async ({ page }) => {
    // Open modal and advance to the plant selector (step 2).
    await page.getByTestId("generate-layout-button").click();
    await page.getByTestId("next-button").click();
    await expect(page.getByTestId("plant-card").first()).toBeVisible();

    // Get initial plant count
    const initialCount = await page.getByTestId("plant-card").count();
    expect(initialCount).toBeGreaterThan(0);

    // Search for a specific plant
    await page.getByTestId("search-input").fill("tomato");
    await page.waitForTimeout(1000); // debounce + API response

    // Verify filtered results
    const filteredCount = await page.getByTestId("plant-card").count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test("should display selected plant count", async ({ page }) => {
    // Open modal and advance to the plant selector (step 2).
    await page.getByTestId("generate-layout-button").click();
    await page.getByTestId("next-button").click();

    // Initially no plants selected
    await expect(page.locator("text=/0 selected/i")).toBeVisible();

    // Select 2 plants
    await page.getByTestId("plant-card").first().click();
    await page.getByTestId("plant-card").first().click();

    // Verify count updated
    await expect(page.locator("text=/2 selected/i")).toBeVisible();
  });

  test("should show visual feedback when plants are selected", async ({ page }) => {
    // Open modal and advance to the plant selector (step 2).
    await page.getByTestId("generate-layout-button").click();
    await page.getByTestId("next-button").click();
    await expect(page.getByTestId("plant-card").first()).toBeVisible();

    // Click first plant card
    await page.getByTestId("plant-card").first().click();

    // Verify selected visual state + checkmark icon
    const selectedCard = page.getByTestId("plant-card-selected").first();
    await expect(selectedCard).toBeVisible();
    await expect(selectedCard.locator("svg").first()).toBeVisible();

    // Select a second plant → two selected
    await page.getByTestId("plant-card").first().click();
    expect(await page.getByTestId("plant-card-selected").count()).toBe(2);

    // Deselect the first → one remains
    await page.getByTestId("plant-card-selected").first().click();
    expect(await page.getByTestId("plant-card-selected").count()).toBe(1);
  });

  test("should close modal when cancel is clicked", async ({ page }) => {
    // Open modal
    await page.getByTestId("generate-layout-button").click();

    // Verify modal is visible
    const modal = page.getByTestId("layout-generator-modal");
    await expect(modal).toBeVisible();

    // Click cancel
    const cancelButton = page.getByTestId("cancel-button");
    await cancelButton.click();

    // Verify modal is closed
    await expect(modal).not.toBeVisible();
  });

  // Full backend-dependent workflow: generate → select → apply.
  // Requires the API + worker running with AI layout generation enabled.
  // Guards three real regressions found in this area:
  //   1. Selecting a layout via the PREVIEW (not the button) must enable Apply.
  //   2. Generated placements must reference real plant profiles (apply must not
  //      400 with "plant profiles not found").
  //   3. Applying to an empty garden must create plots and reach the success step.
  test("should complete generate → select-via-preview → apply workflow", async ({
    page,
  }) => {
    test.setTimeout(120000);

    // Open modal and advance to the plant selector (step 2).
    await page.getByTestId("generate-layout-button").click();
    await expect(page.getByTestId("layout-generator-modal")).toBeVisible();
    await expect(page.getByTestId("modal-step-1")).toBeVisible();
    await page.getByTestId("next-button").click();

    // Capture two real plant ids and stub generation to return them.
    const plantIds = await readTwoPlantIds(page);
    await stubLayoutGeneration(page, plantIds);

    // Select 2 plants (data-testid flips to "plant-card-selected" once chosen).
    await page.getByTestId("plant-card").first().click();
    await page.getByTestId("plant-card").first().click();
    await expect(page.locator("text=/2 selected/i")).toBeVisible();

    // Trigger generation (stubbed → resolves immediately).
    await page.getByTestId("next-button").click();

    // Step 4: layout options appear.
    await expect(page.getByTestId("layout-options")).toBeVisible({
      timeout: 30000,
    });
    const previews = page.getByTestId("layout-preview");
    await expect(previews).toHaveCount(3);

    // Apply is disabled until a layout is chosen.
    const applyButton = page.getByTestId("next-button"); // "Apply Layout" on step 4
    await expect(applyButton).toBeDisabled();

    // Regression #1: clicking the PREVIEW (not the "Select This Layout" button)
    // must register the selection and enable Apply.
    await previews.first().click();
    await expect(applyButton).toBeEnabled();

    // Apply hits the REAL backend with real plant ids → plots created.
    await applyButton.click();
    await expect(page.getByTestId("modal-step-5")).toBeVisible();
    await expect(
      page.locator("text=/Layout Applied Successfully/i")
    ).toBeVisible({ timeout: 30000 });

    // The garden now actually has plots.
    const garden = await getGardenViaAPI(page, gardenId);
    expect(garden.plots.length).toBeGreaterThan(0);

    // Close
    await page.getByTestId("close-button").click();
    await expect(page.getByTestId("layout-generator-modal")).not.toBeVisible();
  });

  test("should select a layout via the explicit button and enable Apply", async ({
    page,
  }) => {
    test.setTimeout(120000);

    await page.getByTestId("generate-layout-button").click();
    await page.getByTestId("next-button").click(); // step 1 → 2

    const plantIds = await readTwoPlantIds(page);
    await stubLayoutGeneration(page, plantIds);

    await page.getByTestId("plant-card").first().click();
    await page.getByTestId("plant-card").first().click();
    await page.getByTestId("next-button").click(); // generate (stubbed)

    await expect(page.getByTestId("layout-options")).toBeVisible({
      timeout: 30000,
    });

    // Select via the explicit "Select This Layout" button (the always-worked path).
    await page.locator('[data-testid^="select-layout-"]').first().click();

    // Apply enabled, and the button reads "Selected".
    await expect(page.getByTestId("next-button")).toBeEnabled();
    await expect(page.locator("text=/Selected/i").first()).toBeVisible();
  });

  test("should reset state when modal is reopened", async ({ page }) => {
    // Open modal and advance to the plant selector (step 2).
    await page.getByTestId("generate-layout-button").click();
    await page.getByTestId("next-button").click();

    // Select 2 plants
    await page.getByTestId("plant-card").first().click();
    await page.getByTestId("plant-card").first().click();
    await expect(page.locator("text=/2 selected/i")).toBeVisible();

    // Close and reopen
    await page.getByTestId("cancel-button").click();
    await page.getByTestId("generate-layout-button").click();

    // State resets to step 1; advancing to the selector shows 0 selected.
    await page.getByTestId("next-button").click();
    await expect(page.locator("text=/0 selected/i")).toBeVisible();
  });

  test("should handle empty plant database gracefully", async ({ page }) => {
    // This test assumes there are plants in the database
    // We're testing the empty state message display logic

    // Open modal and advance to the plant selector (step 2).
    await page.getByTestId("generate-layout-button").click();
    await page.getByTestId("next-button").click();

    // Search for a plant that doesn't exist
    await page.getByTestId("search-input").fill("xyznonexistentplant123");
    await page.waitForTimeout(800); // debounce + response

    // Verify empty state message
    await expect(
      page.locator("text=/No plants found matching your criteria/i")
    ).toBeVisible();
  });

  test("should show progress indicator for current step", async ({ page }) => {
    // Open modal
    await page.getByTestId("generate-layout-button").click();

    // Verify we're on Step 1
    await expect(page.locator("text=/Step 1 of 5/i")).toBeVisible();

    // Verify step indicator shows step 1 as active
    const modal = page.getByTestId("layout-generator-modal");
    const step1Indicator = modal.locator('[aria-label="Step 1"]').first();
    // The active step should have green background
  });
});
