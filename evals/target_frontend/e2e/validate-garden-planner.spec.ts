/**
 * Manual Validation Test for Garden Planner Functionality
 * This test validates the fixes made for Phase 3:
 * 1. API response handling in gardenApi.ts
 * 2. ChakraProvider Toaster component
 * 3. useGarden hook retry handling
 * 4. Error handling for invalid garden IDs
 */

import { test, expect, Page } from "@playwright/test";
import { signUpUser, generateTestUser, type TestUser } from "./fixtures/test-helpers";
import * as path from "path";

const SCREENSHOT_DIR =
  process.env.REVIEW_IMG_DIR ?? path.join(__dirname, "..", "review_img");

// Configure test to use serial mode so tests run in order and share auth state
test.describe.serial("Garden Planner Validation", () => {
  let testUser: TestUser;

  // Helper function to ensure user is logged in
  async function ensureLoggedIn(page: Page) {
    await page.goto('/login');
    await page.waitForLoadState("networkidle");

    // Check if already on dashboard (logged in) or need to login
    if (page.url().includes('/login')) {
      const emailInput = page.locator('input[name="email"]').first();
      const passwordInput = page.locator('input[name="password"]').first();
      const submitButton = page.locator('button[type="submit"]').first();

      await emailInput.fill(testUser.email);
      await passwordInput.fill(testUser.password);
      await submitButton.click();
      await page.waitForURL('**/dashboard', { timeout: 20000 });
    }
  }

  test.beforeAll(async () => {
    // Generate unique test user
    testUser = generateTestUser();
  });

  test("Step 1: Sign up a new test user", async ({ page }) => {
    console.log("Signing up test user:", testUser.email);

    // Use the helper function which properly handles all required fields
    await signUpUser(page, testUser);

    console.log("✓ User signed up successfully");
  });

  test("Step 2: Navigate to garden planner and capture screenshot", async ({
    page,
  }) => {
    // Login if not already authenticated (each test gets a fresh context)
    await ensureLoggedIn(page);

    // Navigate to garden planner
    await page.goto('/garden-planner');
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Take screenshot
    const screenshotPath = path.join(
      SCREENSHOT_DIR,
      "01_garden_planner_page.png"
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log("✓ Garden planner page screenshot saved:", screenshotPath);

    // Verify we're on the garden planner page
    expect(page.url()).toContain("garden-planner");
  });

  test("Step 3: Test invalid garden ID error handling", async ({ page }) => {
    // Ensure logged in
    await ensureLoggedIn(page);

    // Navigate to invalid garden ID
    await page.goto('/garden-planner/invalid-id-999');
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Take screenshot
    const screenshotPath = path.join(
      SCREENSHOT_DIR,
      "02_invalid_garden_error.png"
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log("✓ Invalid garden ID screenshot saved:", screenshotPath);

    // Check for error message
    const bodyText = await page.textContent("body");
    const hasErrorMessage =
      bodyText?.toLowerCase().includes("garden not found") ||
      bodyText?.toLowerCase().includes("not found") ||
      bodyText?.toLowerCase().includes("error");

    console.log("  Error message present:", hasErrorMessage ? "YES" : "NO");
    console.log("  Page content includes:", bodyText?.substring(0, 200));

    // This should show some kind of error handling
    expect(hasErrorMessage).toBeTruthy();
  });

  test("Step 4: Create a new garden through UI", async ({ page }) => {
    // Ensure logged in
    await ensureLoggedIn(page);

    // Go back to garden planner
    await page.goto('/garden-planner');
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    console.log("Looking for Create Garden button...");

    // Try multiple selectors to find the create button
    const createButtonSelectors = [
      'button:has-text("Create Garden")',
      'button:has-text("New Garden")',
      'button:has-text("Add Garden")',
      '[data-testid="create-garden-button"]',
      'button:has-text("Create")',
    ];

    let createButton;
    for (const selector of createButtonSelectors) {
      createButton = page.locator(selector).first();
      if ((await createButton.count()) > 0) {
        console.log("  Found create button with selector:", selector);
        break;
      }
    }

    // Click create button
    await createButton?.click();
    await page.waitForTimeout(1500);

    // Fill in garden details
    const gardenName = `Test Garden ${Date.now()}`;
    const gardenNotes = "Automated validation test garden";

    console.log("Filling garden form with name:", gardenName);

    await page.fill('input[name="name"]', gardenName);

    // Fill in optional fields (width, height are pre-filled with defaults)
    const notesField = page.locator('textarea[name="notes"]').first();
    if (await notesField.count() > 0) {
      await notesField.fill(gardenNotes);
    }

    // Wait for API response when submitting
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/gardens') && response.request().method() === 'POST',
      { timeout: 10000 }
    );

    // Submit the form
    const submitButton = page.locator('button[type="submit"]:has-text("Create Garden"), button[type="submit"]').first();
    await submitButton.click();

    // Wait for the API response to complete
    try {
      await responsePromise;
    } catch (error) {
      console.error('Failed to wait for garden creation API response:', error);
    }

    // Wait for modal to close
    await page.waitForSelector('[role="dialog"], [data-scope="dialog"]', { state: 'detached', timeout: 10000 }).catch(() => {});

    // Wait for garden to be created and list to update
    await page.waitForTimeout(2000);

    // Take screenshot
    const screenshotPath = path.join(
      SCREENSHOT_DIR,
      "03_create_garden_success.png"
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log("✓ Garden creation screenshot saved:", screenshotPath);

    // Verify garden appears in list
    const pageContent = await page.textContent("body");
    const gardenExists = pageContent?.includes(gardenName);

    console.log("  Garden appears in list:", gardenExists ? "YES" : "NO");

    expect(gardenExists).toBeTruthy();
  });

  test("Step 5: Verify data persistence after page refresh", async ({
    page,
  }) => {
    // Ensure logged in
    await ensureLoggedIn(page);

    // Go to garden planner page
    await page.goto('/garden-planner');
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Get gardens before refresh
    const beforeRefresh = await page.textContent("body");
    const hadGardensBefore = beforeRefresh?.includes("Test Garden");

    console.log("Gardens before refresh:", hadGardensBefore ? "YES" : "NO");

    // Refresh the page
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Take screenshot
    const screenshotPath = path.join(
      SCREENSHOT_DIR,
      "04_data_persistence_after_refresh.png"
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log("✓ Data persistence screenshot saved:", screenshotPath);

    // Get gardens after refresh
    const afterRefresh = await page.textContent("body");
    const hasGardensAfter = afterRefresh?.includes("Test Garden");

    console.log("Gardens after refresh:", hasGardensAfter ? "YES" : "NO");

    // If we had gardens before, they should persist
    if (hadGardensBefore) {
      expect(hasGardensAfter).toBeTruthy();
    }
  });
});
