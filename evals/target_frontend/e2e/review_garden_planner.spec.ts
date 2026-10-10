import { test, expect } from "@playwright/test";
import * as path from "path";
import { generateTestUser, signUpUser } from "./fixtures/test-helpers";
import {
  generateTestGarden,
  navigateToGardenPlanner,
  createGardenViaAPI,
  openGarden,
  createPlotViaAPI,
} from "./fixtures/garden-helpers";

const REVIEW_IMG_DIR = process.env.REVIEW_IMG_DIR ?? path.join(__dirname, "..", "review_img");

test.describe("Garden Planner Visual Validation and Plot Resizing Review", () => {
  test.skip("Review visual validation and plot resizing features", async ({
    page,
  }) => {
    // Sign up a new user
    const user = generateTestUser();
    await signUpUser(page, user);

    // Create garden via API
    const testGarden = generateTestGarden({
      name: "Review Test Garden",
      width: 20,
      height: 20,
    });
    const createdGarden = await createGardenViaAPI(page, testGarden);

    // Create a plot at position (8, 8) with size 2x2
    const plotData = {
      x: 8,
      y: 8,
      width: 2,
      height: 2,
    };
    await createPlotViaAPI(page, createdGarden.id, plotData);

    // Navigate to garden planner
    await navigateToGardenPlanner(page);
    await openGarden(page, createdGarden.name);
    await page.waitForTimeout(2000);

    // Screenshot 1: Initial garden planner state with plot
    await page.screenshot({
      path: path.join(REVIEW_IMG_DIR, "01_garden_planner_initial.png"),
      fullPage: true,
    });

    // Screenshot 2: Test plot resizing - click on plot and open edit modal
    const plotRect = page.locator('svg rect[fill="#48bb78"]').first();
    await plotRect.waitFor({ state: "visible", timeout: 10000 });
    await plotRect.click();
    await page.waitForTimeout(1000);

    const editButton = page.locator('button:has-text("Edit Plot")');
    await editButton.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(REVIEW_IMG_DIR, "02_edit_plot_modal_with_dimensions.png"),
      fullPage: true,
    });

    // Test resizing: change width to 4 and height to 6
    const widthInput = page.locator('input[name="width"]');
    await widthInput.clear();
    await widthInput.fill("4");

    const heightInput = page.locator('input[name="height"]');
    await heightInput.clear();
    await heightInput.fill("6");

    await page.screenshot({
      path: path.join(REVIEW_IMG_DIR, "03_edit_modal_new_dimensions.png"),
      fullPage: true,
    });

    // Save changes
    const saveButton = page.locator('button:has-text("Save Changes")');
    await saveButton.click();
    await page.waitForTimeout(2000);

    // Screenshot 3: Verify plot is resized
    await page.screenshot({
      path: path.join(REVIEW_IMG_DIR, "04_plot_resized_on_canvas.png"),
      fullPage: true,
    });

    // Screenshot 4: Test visual validation - drag plot out of bounds
    // First, need to get the plot position
    const plotRect2 = page.locator('svg rect[fill="#48bb78"]').first();
    const plotBox = await plotRect2.boundingBox();

    if (plotBox) {
      const centerX = plotBox.x + plotBox.width / 2;
      const centerY = plotBox.y + plotBox.height / 2;

      // Start drag
      await page.mouse.move(centerX, centerY);
      await page.mouse.down();

      // Drag beyond the right boundary (try to move 400px to the right)
      await page.mouse.move(centerX + 400, centerY, { steps: 10 });
      await page.waitForTimeout(500);

      // Screenshot during invalid drag (should show red color)
      await page.screenshot({
        path: path.join(REVIEW_IMG_DIR, "05_visual_feedback_red_invalid.png"),
        fullPage: true,
      });

      // Release mouse
      await page.mouse.up();
      await page.waitForTimeout(1000);
    }

    console.log("Review complete - screenshots captured");
  });
});
