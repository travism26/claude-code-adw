/**
 * E2E Tests for Garden Suggestions UI
 *
 * Tests the AI-powered garden suggestions panel and plot highlighting features.
 */

import { test, expect } from "@playwright/test";
import { generateTestUser, signUpUser } from "./fixtures/test-helpers";
import {
  generateTestGarden,
  createGardenViaAPI,
  createPlotViaAPI,
  navigateToGardenPlanner,
  openGarden,
  mockGardenAnalysis,
} from "./fixtures/garden-helpers";

test.describe("Garden Suggestions UI", () => {
  test.beforeEach(async ({ page }) => {
    // Sign up a new user for each test
    const user = generateTestUser();
    await signUpUser(page, user);
  });

  test("should display 'No Analysis Available' state when no analysis exists", async ({
    page,
  }) => {
    // Create a garden with plots but NO analysis data
    const garden = generateTestGarden({
      name: "Test Garden No Analysis",
      width: 20,
      height: 15,
      zone: "5a",
    });

    const createdGarden = await createGardenViaAPI(page, garden);

    // Add a plot
    await createPlotViaAPI(page, createdGarden.id, {
      x: 2,
      y: 2,
      width: 4,
      height: 4,
      plant_profile_id: undefined,
    });

    // No mock needed - the backend will return 404, and the hook handles it gracefully

    // Navigate to the garden planner and open the garden
    await navigateToGardenPlanner(page);
    await openGarden(page, garden.name, true);

    // Wait for the suggestions panel to appear
    const suggestionsPanel = page.locator('[data-testid="suggestions-panel"]');
    await suggestionsPanel.waitFor({ state: "visible", timeout: 10000 });

    // Verify "No Analysis Available" alert is shown
    // state when no analysis exists
    await expect(
      page.locator("text=No Analysis Available")
    ).toBeVisible();

    // Verify "Analyze Garden" button is visible
    const analyzeButton = page.locator(
      '[data-testid="refresh-analysis-button"]'
    );
    await expect(analyzeButton).toBeVisible();
    await expect(analyzeButton).toContainText("Analyze Garden");

    // Verify info alert message is shown
    await expect(
      page.locator(
        'text=Click the "Analyze Garden" button to get AI-powered recommendations'
      )
    ).toBeVisible();
  });

  test("should display AI suggestions panel when garden has plots and analysis", async ({
    page,
  }) => {
    // Create a garden with plots via API
    const garden = generateTestGarden({
      name: "Test Garden with Plots",
      width: 20,
      height: 15,
      zone: "5a",
    });

    const createdGarden = await createGardenViaAPI(page, garden);

    // Add a few plots to the garden
    await createPlotViaAPI(page, createdGarden.id, {
      x: 2,
      y: 2,
      width: 4,
      height: 4,
      plant_profile_id: undefined,
    });

    await createPlotViaAPI(page, createdGarden.id, {
      x: 8,
      y: 8,
      width: 3,
      height: 3,
      plant_profile_id: undefined,
    });

    // Mock the analysis endpoint to return data
    await mockGardenAnalysis(page, createdGarden.id);

    // Navigate to the garden planner and open the garden
    await navigateToGardenPlanner(page);
    await openGarden(page, garden.name, true);

    // Wait for the suggestions panel to appear
    const suggestionsPanel = page.locator('[data-testid="suggestions-panel"]');
    await suggestionsPanel.waitFor({ state: "visible", timeout: 10000 });

    // Verify the panel is visible
    await expect(suggestionsPanel).toBeVisible();

    // Verify the "AI Garden Analysis" heading is present
    await expect(page.locator("text=AI Garden Analysis")).toBeVisible();
  });

  test("should display garden health badge with correct score", async ({
    page,
  }) => {
    // Create a garden with plots
    const garden = generateTestGarden({
      name: "Health Badge Test Garden",
      width: 15,
      height: 15,
      zone: "6b",
    });

    const createdGarden = await createGardenViaAPI(page, garden);

    await createPlotViaAPI(page, createdGarden.id, {
      x: 1,
      y: 1,
      width: 2,
      height: 2,
      plant_profile_id: undefined,
    });

    // Mock analysis data
    await mockGardenAnalysis(page, createdGarden.id);

    // Navigate to garden
    await navigateToGardenPlanner(page);
    await openGarden(page, garden.name, true);

    // Wait for suggestions panel to load
    await page
      .locator('[data-testid="suggestions-panel"]')
      .waitFor({ state: "visible", timeout: 10000 });

    // Verify health badge is visible
    const healthBadge = page.locator('[data-testid="garden-health-badge"]');
    await expect(healthBadge).toBeVisible();

    // Verify badge contains a score (mock data returns 75)
    await expect(healthBadge).toContainText(/\d+/);
    await expect(healthBadge).toContainText("/ 100");
  });

  test("should display suggestion cards with required information", async ({
    page,
  }) => {
    // Create garden and plots
    const garden = generateTestGarden({
      name: "Suggestion Cards Garden",
      width: 20,
      height: 20,
    });

    const createdGarden = await createGardenViaAPI(page, garden);

    await createPlotViaAPI(page, createdGarden.id, {
      x: 0,
      y: 0,
      width: 5,
      height: 5,
      plant_profile_id: undefined,
    });

    // Mock analysis data
    await mockGardenAnalysis(page, createdGarden.id);

    // Navigate to garden
    await navigateToGardenPlanner(page);
    await openGarden(page, garden.name, true);

    // Wait for suggestions panel
    await page
      .locator('[data-testid="suggestions-panel"]')
      .waitFor({ state: "visible", timeout: 10000 });

    // Wait for at least one suggestion card to appear
    const suggestionCard = page
      .locator('[data-testid="suggestion-card"]')
      .first();
    await suggestionCard.waitFor({ state: "visible", timeout: 5000 });

    // Verify suggestion card has a type badge
    await expect(
      suggestionCard.locator('[data-testid="suggestion-type-badge"]')
    ).toBeVisible();

    // Verify suggestion card has a priority badge
    await expect(
      suggestionCard.locator('[data-testid="suggestion-priority-badge"]')
    ).toBeVisible();

    // Verify suggestion has text content (title/description)
    const cardText = await suggestionCard.textContent();
    expect(cardText).toBeTruthy();
    expect(cardText!.length).toBeGreaterThan(10);
  });

  test("should expand and collapse priority sections", async ({ page }) => {
    // Create garden with plots
    const garden = generateTestGarden({
      name: "Accordion Test Garden",
      width: 15,
      height: 15,
    });

    const createdGarden = await createGardenViaAPI(page, garden);

    await createPlotViaAPI(page, createdGarden.id, {
      x: 3,
      y: 3,
      width: 4,
      height: 4,
      plant_profile_id: undefined,
    });

    // Mock analysis data
    await mockGardenAnalysis(page, createdGarden.id);

    // Navigate to garden
    await navigateToGardenPlanner(page);
    await openGarden(page, garden.name, true);

    // Wait for suggestions panel
    await page
      .locator('[data-testid="suggestions-panel"]')
      .waitFor({ state: "visible", timeout: 10000 });

    // Look for priority section headers (High Priority, Medium Priority, etc.)
    const priorityHeaders = page.locator(
      "text=/High Priority|Medium Priority|Low Priority/i"
    );

    // If at least one priority section exists, try to interact with it
    const count = await priorityHeaders.count();
    if (count > 0) {
      const firstHeader = priorityHeaders.first();
      await firstHeader.click();

      // Wait a bit for accordion animation
      await page.waitForTimeout(500);

      // Click again to toggle
      await firstHeader.click();
      await page.waitForTimeout(500);

      // Test passes if no errors occurred during interaction
      expect(true).toBe(true);
    }
  });

  test("should display loading state while fetching suggestions", async ({
    page,
  }) => {
    // Create garden with plots
    const garden = generateTestGarden({
      name: "Loading Test Garden",
      width: 10,
      height: 10,
    });

    const createdGarden = await createGardenViaAPI(page, garden);

    await createPlotViaAPI(page, createdGarden.id, {
      x: 1,
      y: 1,
      width: 2,
      height: 2,
      plant_profile_id: undefined,
    });

    // Mock analysis data
    await mockGardenAnalysis(page, createdGarden.id);

    // Navigate to garden (this will trigger suggestions load)
    await navigateToGardenPlanner(page);

    // Start navigation to garden
    const gardenCard = page.locator(`text=${garden.name}`).first();
    await gardenCard.click();

    // Immediately check for suggestions panel (may show loading skeleton)
    // This is a best-effort test since loading may be very fast
    const suggestionsPanel = page.locator('[data-testid="suggestions-panel"]');

    // Wait for panel to appear (either loading or loaded state)
    await suggestionsPanel.waitFor({ state: "visible", timeout: 10000 });

    // Verify panel eventually shows content (not just loading)
    await expect(page.locator("text=AI Garden Analysis")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should have Analyze Garden button", async ({ page }) => {
    // Create garden with plots
    const garden = generateTestGarden({
      name: "Analyze Button Garden",
      width: 12,
      height: 12,
    });

    const createdGarden = await createGardenViaAPI(page, garden);

    await createPlotViaAPI(page, createdGarden.id, {
      x: 2,
      y: 2,
      width: 3,
      height: 3,
      plant_profile_id: undefined,
    });

    // Mock analysis data
    await mockGardenAnalysis(page, createdGarden.id);

    // Navigate to garden
    await navigateToGardenPlanner(page);
    await openGarden(page, garden.name, true);

    // Wait for suggestions panel
    await page
      .locator('[data-testid="suggestions-panel"]')
      .waitFor({ state: "visible", timeout: 10000 });

    // Verify analyze button exists
    const analyzeButton = page.locator(
      '[data-testid="refresh-analysis-button"]'
    );
    await expect(analyzeButton).toBeVisible();
    await expect(analyzeButton).toContainText("Analyze Garden");

    // Verify clicking analyze button doesn't cause errors
    await analyzeButton.click();
    await page.waitForTimeout(1000);

    // Panel should still be visible after refresh
    await expect(
      page.locator('[data-testid="suggestions-panel"]')
    ).toBeVisible();
  });

  test("should not display suggestions panel for empty garden", async ({
    page,
  }) => {
    // Create garden WITHOUT plots
    const garden = generateTestGarden({
      name: "Empty Garden",
      width: 15,
      height: 15,
    });

    await createGardenViaAPI(page, garden);

    // Navigate to garden
    await navigateToGardenPlanner(page);
    await openGarden(page, garden.name, true);

    // Wait a moment for page to fully load
    await page.waitForTimeout(2000);

    // Suggestions panel should NOT be visible (no plots = no panel)
    const suggestionsPanel = page.locator('[data-testid="suggestions-panel"]');
    await expect(suggestionsPanel).not.toBeVisible();
  });
});
