/**
 * Manual Validation for Garden Planner - Phase 3 Fixes
 * Run with: FRONTEND_PORT=9209 npx playwright test e2e/manual-validation.spec.ts --headed
 */

import { test, expect } from "@playwright/test";
import { signUpUser, generateTestUser } from "./fixtures/test-helpers";
import * as path from "path";

const SCREENSHOT_DIR =
  process.env.REVIEW_IMG_DIR ?? path.join(__dirname, "..", "review_img");

test.describe.serial("Garden Planner Manual Validation", () => {
  const testUser = generateTestUser();

  test("Complete validation flow", async ({ page }) => {
    console.log("\n=== Step 1: Sign up a new test user ===");
    console.log("Test user email:", testUser.email);

    // Sign up new user
    await signUpUser(page, testUser);
    console.log("✓ User signed up successfully");

    // Step 2: Navigate to garden planner
    console.log("\n=== Step 2: Navigate to garden planner page ===");
    await page.goto("/garden-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const screenshotPath1 = path.join(
      SCREENSHOT_DIR,
      "01_garden_planner_page.png"
    );
    await page.screenshot({ path: screenshotPath1, fullPage: true });
    console.log("✓ Screenshot saved:", screenshotPath1);

    // Verify we're on the garden planner page
    expect(page.url()).toContain("garden-planner");
    console.log("✓ On garden planner page");

    // Step 3: Test invalid garden ID
    console.log("\n=== Step 3: Test invalid garden ID error handling ===");
    await page.goto("/garden-planner/invalid-id-999");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const screenshotPath2 = path.join(
      SCREENSHOT_DIR,
      "02_invalid_garden_error.png"
    );
    await page.screenshot({ path: screenshotPath2, fullPage: true });
    console.log("✓ Screenshot saved:", screenshotPath2);

    // Check for error message
    const bodyText = await page.textContent("body");
    const hasErrorMessage =
      bodyText?.toLowerCase().includes("garden not found") ||
      bodyText?.toLowerCase().includes("not found") ||
      bodyText?.toLowerCase().includes("error");

    console.log("  Error message present:", hasErrorMessage ? "YES" : "NO");

    // Look for specific error indicators
    const errorHeading = await page.$(
      'h1:has-text("Garden not found"), h2:has-text("Garden not found"), h1:has-text("Not Found"), h2:has-text("Not Found")'
    );
    const backButton = await page.$(
      'button:has-text("Back"), a:has-text("Back to Gardens")'
    );

    console.log("  Error heading found:", errorHeading ? "YES" : "NO");
    console.log("  Back button found:", backButton ? "YES" : "NO");

    // Step 4: Create a new garden
    console.log("\n=== Step 4: Create a new garden through UI ===");
    await page.goto("/garden-planner");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Find and click create garden button
    const createButtonSelectors = [
      'button:has-text("Create Garden")',
      'button:has-text("New Garden")',
      'button:has-text("Add Garden")',
      '[data-testid="create-garden-button"]',
    ];

    let createButtonFound = false;
    for (const selector of createButtonSelectors) {
      const button = page.locator(selector).first();
      if ((await button.count()) > 0 && (await button.isVisible())) {
        console.log("  Found create button with selector:", selector);
        await button.click();
        createButtonFound = true;
        break;
      }
    }

    if (!createButtonFound) {
      console.log(
        "  WARNING: Create button not found, checking for empty state..."
      );
      const emptyStateButton = page
        .locator("button")
        .filter({ hasText: /create|add|new/i })
        .first();
      if ((await emptyStateButton.count()) > 0) {
        await emptyStateButton.click();
        console.log("  Clicked empty state button");
      }
    }

    // Wait for modal to open
    await page.waitForTimeout(1500);

    // Fill in garden details
    const gardenName = `Test Garden ${Date.now()}`;
    const gardenNotes = "Automated validation test garden for Phase 3";

    console.log("  Creating garden with name:", gardenName);

    // Fill required fields: name, width, height
    await page.fill('input[name="name"]', gardenName);
    await page.fill('input[name="width"]', "20");
    await page.fill('input[name="height"]', "15");

    // Fill optional notes field
    await page.fill('textarea[name="notes"]', gardenNotes);

    // Submit the form - use keyboard to avoid click interception issues
    await page.keyboard.press("Tab"); // Move focus away from textarea
    const submitButton = page
      .locator('button:has-text("Create Garden")')
      .last();
    await submitButton.click({ force: true });

    // Wait for garden to be created
    await page.waitForTimeout(3000);

    const screenshotPath3 = path.join(
      SCREENSHOT_DIR,
      "03_create_garden_success.png"
    );
    await page.screenshot({ path: screenshotPath3, fullPage: true });
    console.log("✓ Screenshot saved:", screenshotPath3);

    // Check if garden appears in list
    const pageContent = await page.textContent("body");
    const gardenExists = pageContent?.includes(gardenName);
    console.log("  Garden appears in list:", gardenExists ? "YES" : "NO");

    if (gardenExists) {
      console.log("✓ Garden created successfully");
    } else {
      console.log(
        "  WARNING: Garden may not have been created or is not visible"
      );
    }

    // Step 5: Test data persistence
    console.log("\n=== Step 5: Test data persistence after page refresh ===");

    // Reload the page
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const screenshotPath4 = path.join(
      SCREENSHOT_DIR,
      "04_data_persistence_after_refresh.png"
    );
    await page.screenshot({ path: screenshotPath4, fullPage: true });
    console.log("✓ Screenshot saved:", screenshotPath4);

    // Check if garden still exists
    const afterRefreshContent = await page.textContent("body");
    const gardenPersists = afterRefreshContent?.includes(gardenName);
    console.log(
      "  Garden persists after refresh:",
      gardenPersists ? "YES" : "NO"
    );

    if (gardenPersists) {
      console.log("✓ Data persistence works correctly");
    } else {
      console.log("  WARNING: Garden data may not persist after refresh");
    }

    // Summary
    console.log("\n=== VALIDATION SUMMARY ===");
    console.log("1. User signup: SUCCESS");
    console.log("2. Garden planner page: SUCCESS");
    console.log(
      "3. Invalid garden ID error handling:",
      hasErrorMessage ? "SUCCESS" : "NEEDS REVIEW"
    );
    console.log(
      "4. Garden creation:",
      gardenExists ? "SUCCESS" : "NEEDS REVIEW"
    );
    console.log(
      "5. Data persistence:",
      gardenPersists ? "SUCCESS" : "NEEDS REVIEW"
    );
    console.log("\nAll screenshots saved to:", SCREENSHOT_DIR);
  });
});
