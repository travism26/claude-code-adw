import { test, expect } from "@playwright/test";
import * as path from "path";
import {
  generateTestUser,
  signUpUser,
} from "./fixtures/test-helpers";
import {
  generateTestGarden,
  navigateToGardenPlanner,
  createGardenViaUI,
  selectPlantFromPalette,
  placePlotOnCanvas,
} from "./fixtures/garden-helpers";

const REVIEW_IMG_DIR = process.env.REVIEW_IMG_DIR ?? path.join(__dirname, "..", "review_img");

test.describe("Plant Icons Review", () => {
  test("should display plant icons in garden plots", async ({ page }) => {
    // Sign up a new user
    const user = generateTestUser();
    await signUpUser(page, user);

    // Create a garden via UI
    const garden = generateTestGarden({
      name: "Icon Test Garden",
      width: 20,
      height: 15,
      zone: "6b",
    });

    await navigateToGardenPlanner(page);
    await createGardenViaUI(page, garden);

    // Wait for garden canvas to be visible
    await page.waitForSelector("svg", { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Add plots with different plants using the palette
    // Try to select a plant from the palette
    await selectPlantFromPalette(page, "Tomato");
    await page.waitForTimeout(500);

    // Place small plot (click once for default size)
    await placePlotOnCanvas(page, 2, 2);
    await page.waitForTimeout(1000);

    // Select another plant
    await selectPlantFromPalette(page, "Basil");
    await page.waitForTimeout(500);

    // Place medium plot
    await placePlotOnCanvas(page, 5, 5);
    await page.waitForTimeout(1000);

    // Select another plant
    await selectPlantFromPalette(page, "Pepper");
    await page.waitForTimeout(500);

    // Place large plot
    await placePlotOnCanvas(page, 10, 8);
    await page.waitForTimeout(2000);

    // Take screenshot of the garden with plant icons
    await page.screenshot({
      path: path.join(REVIEW_IMG_DIR, "01_garden-with-plant-icons.png"),
      fullPage: true,
    });

    // Verify plot icons are visible
    const icons = await page.locator('[data-testid="plot-icon"]').count();
    console.log(`Found ${icons} plot icons`);

    // Zoom in to see icons more clearly
    const zoomInButton = page.locator('button').filter({ hasText: '+' }).first();
    if (await zoomInButton.count() > 0) {
      await zoomInButton.click();
      await zoomInButton.click();
      await page.waitForTimeout(500);

      // Take zoomed screenshot
      await page.screenshot({
        path: path.join(REVIEW_IMG_DIR, "02_garden-zoomed-with-icons.png"),
        fullPage: true,
      });
    }

    // Click on a plot to select it
    const plots = await page.locator('[data-testid^="plot-"]').all();
    if (plots.length > 0) {
      await plots[0].click();
      await page.waitForTimeout(500);

      // Take screenshot of selected plot
      await page.screenshot({
        path: path.join(REVIEW_IMG_DIR, "03_selected-plot-with-icon.png"),
        fullPage: true,
      });
    }
  });
});
