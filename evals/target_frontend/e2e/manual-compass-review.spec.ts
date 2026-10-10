import { test, expect } from "@playwright/test";
import * as path from "path";
import { generateTestUser, signUpUser } from "./fixtures/test-helpers";
import {
  generateTestGarden,
  navigateToGardenPlanner,
  createGardenViaAPI,
  openGarden,
} from "./fixtures/garden-helpers";

const SCREENSHOT_DIR =
  (process.env.REVIEW_IMG_DIR ?? path.join(__dirname, "..", "review_img")) + "/";

test.describe("Manual Compass Direction Review", () => {
  // skip this test
  test.skip("comprehensive compass direction feature review", async ({
    page,
  }) => {
    // Step 1: Sign up and authenticate
    const user = generateTestUser();
    await signUpUser(page, user);

    // Step 2: Create a garden via API
    const testGarden = generateTestGarden({ name: "Compass Review Garden" });
    const createdGarden = await createGardenViaAPI(page, testGarden);

    // Step 3: Create a plot via API with compass direction to test display
    const token = await page
      .context()
      .cookies()
      .then((cookies) => {
        const accessToken = cookies.find((c) => c.name === "accessToken");
        return accessToken?.value || null;
      });

    if (!token) {
      throw new Error("No access token found");
    }

    // Create plot with API
    const plotResponse = await page
      .context()
      .request.post(
        `http://localhost:3000/api/gardens/${createdGarden.id}/plots`,
        {
          data: {
            x: 2,
            y: 2,
            width: 2,
            height: 2,
            compass_direction: "N",
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

    if (!plotResponse.ok()) {
      console.error("Failed to create plot:", await plotResponse.text());
    }

    const createdPlot = await plotResponse.json();
    console.log("Created plot:", createdPlot);

    // Step 4: Navigate to garden planner and open the garden
    await navigateToGardenPlanner(page);
    await openGarden(page, createdGarden.name);

    // Wait for canvas to load
    await page.waitForTimeout(3000);

    // Step 5: Try to click on the plot to select it
    // First take a screenshot to see what we have
    await page.screenshot({
      path: SCREENSHOT_DIR + "00_initial_garden_view.png",
      fullPage: true,
    });

    const plotRect = page.locator('svg rect[fill="#48bb78"]').first();
    const plotRectCount = await plotRect.count();
    console.log("Found plot rects:", plotRectCount);

    if (plotRectCount > 0) {
      await plotRect.click();
      await page.waitForTimeout(500);
    } else {
      // If no plot rect, try clicking the SVG canvas to see what's rendered
      console.log("No plot rects found, garden may have rendering issues");
    }

    // Step 6: Take screenshot showing selected plot info panel with Edit Plot button
    await page.screenshot({
      path: SCREENSHOT_DIR + "01_selected_plot_with_edit_button.png",
      fullPage: true,
    });

    // Verify the Edit Plot button exists
    const editButton = page.locator('button:has-text("Edit Plot")');
    await expect(editButton).toBeVisible({ timeout: 5000 });

    // Step 7: Click Edit Plot button to open modal
    await editButton.click();
    await page.waitForTimeout(500);

    // Verify modal is open
    await expect(page.locator('text="Edit Plot"').first()).toBeVisible({
      timeout: 5000,
    });

    // Step 8: Take screenshot of EditPlotModal showing compass direction dropdown
    await page.screenshot({
      path: SCREENSHOT_DIR + "02_edit_plot_modal_compass_dropdown.png",
      fullPage: true,
    });

    // Verify compass direction select exists
    const selectElement = page.locator('select[name="compass_direction"]');
    await expect(selectElement).toBeVisible({ timeout: 5000 });

    // Step 9: Select a compass direction (North)
    await selectElement.selectOption("N");
    await page.waitForTimeout(300);

    // Step 10: Save the changes
    const saveButton = page.locator('button:has-text("Save Changes")');
    await saveButton.click();

    // Wait for modal to close
    await page.waitForTimeout(1500);

    // Verify modal is closed
    await expect(page.locator('text="Edit Plot"').first()).not.toBeVisible();

    // Step 11: Take screenshot showing compass direction with arrow indicator
    await page.screenshot({
      path: SCREENSHOT_DIR + "03_compass_direction_displayed_with_arrow.png",
      fullPage: true,
    });

    // Verify the compass direction is displayed with arrow
    await expect(page.locator("text=/↑.*Facing North/i")).toBeVisible({
      timeout: 5000,
    });

    // Step 12: Edit the plot again to change compass direction
    await editButton.click();
    await page.waitForTimeout(500);

    // Change direction to East
    await selectElement.selectOption("E");
    await page.waitForTimeout(300);

    // Save changes
    await saveButton.click();
    await page.waitForTimeout(1500);

    // Step 13: Take final screenshot showing updated compass direction
    await page.screenshot({
      path: SCREENSHOT_DIR + "04_updated_compass_direction.png",
      fullPage: true,
    });

    // Verify the updated compass direction is displayed
    await expect(page.locator("text=/→.*Facing East/i")).toBeVisible({
      timeout: 5000,
    });

    // Additional verification: Test clearing the compass direction
    await editButton.click();
    await page.waitForTimeout(500);

    // Select "Not specified"
    await selectElement.selectOption("");
    await saveButton.click();
    await page.waitForTimeout(1500);

    // Take screenshot of cleared compass direction
    await page.screenshot({
      path: SCREENSHOT_DIR + "05_cleared_compass_direction.png",
      fullPage: true,
    });

    // Verify compass direction is not displayed
    await expect(page.locator("text=/Facing/i")).not.toBeVisible();

    // Test all 8 compass directions
    const directions = [
      { dir: "N", arrow: "↑", name: "North" },
      { dir: "NE", arrow: "↗", name: "Northeast" },
      { dir: "E", arrow: "→", name: "East" },
      { dir: "SE", arrow: "↘", name: "Southeast" },
      { dir: "S", arrow: "↓", name: "South" },
      { dir: "SW", arrow: "↙", name: "Southwest" },
      { dir: "W", arrow: "←", name: "West" },
      { dir: "NW", arrow: "↖", name: "Northwest" },
    ];

    for (const { dir, arrow, name } of directions) {
      // Open edit modal
      await editButton.click();
      await page.waitForTimeout(300);

      // Select direction
      await selectElement.selectOption(dir);
      await saveButton.click();
      await page.waitForTimeout(1000);

      // Verify direction displays with correct arrow
      await expect(page.locator(`text=/Facing ${name}/i`)).toBeVisible({
        timeout: 5000,
      });

      // Take screenshot of each direction
      await page.screenshot({
        path:
          SCREENSHOT_DIR +
          `06_direction_${dir.toLowerCase()}_${name.toLowerCase()}.png`,
        fullPage: true,
      });
    }

    // Test notes functionality
    await editButton.click();
    await page.waitForTimeout(300);

    const notesTextarea = page.locator('textarea[name="notes"]');
    await notesTextarea.fill(
      "This is a test note for the plot with compass direction"
    );
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Take screenshot with notes
    await page.screenshot({
      path: SCREENSHOT_DIR + "07_plot_with_notes.png",
      fullPage: true,
    });

    // Verify notes are displayed
    await expect(
      page.locator("text=/Notes:.*This is a test note/i")
    ).toBeVisible({ timeout: 5000 });

    console.log("✅ All screenshots saved to:", SCREENSHOT_DIR);
  });
});
