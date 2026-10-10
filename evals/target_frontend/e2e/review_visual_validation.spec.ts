import { test, expect } from '@playwright/test';
import * as path from 'path';
import {
  generateTestUser,
  signUpUser,
} from './fixtures/test-helpers';
import {
  generateTestGarden,
  navigateToGardenPlanner,
  createGardenViaAPI,
  openGarden,
  createPlotViaAPI,
} from './fixtures/garden-helpers';

const REVIEW_IMG_DIR = process.env.REVIEW_IMG_DIR ?? path.join(__dirname, '..', 'review_img');

test.describe('Visual Validation Review', () => {
  test('Capture visual validation red color', async ({ page }) => {
    // Sign up a new user
    const user = generateTestUser();
    await signUpUser(page, user);

    // Create a 10x10 garden to make it easier to go out of bounds
    const testGarden = generateTestGarden({ name: 'Small Test Garden', width: 10, height: 10 });
    const createdGarden = await createGardenViaAPI(page, testGarden);

    // Create a plot near the edge at position (8, 5)
    const plotData = {
      x: 8,
      y: 5,
      width: 2,
      height: 2,
    };
    await createPlotViaAPI(page, createdGarden.id, plotData);

    // Navigate to garden planner
    await navigateToGardenPlanner(page);
    await openGarden(page, createdGarden.name);
    await page.waitForTimeout(3000);

    // Screenshot: plot in valid position (green)
    await page.screenshot({
      path: path.join(REVIEW_IMG_DIR, '05_plot_valid_green.png'),
      fullPage: true,
    });

    // Get the plot element
    const plotRect = page.locator('svg rect[fill="#48bb78"]').first();
    await plotRect.waitFor({ state: 'visible', timeout: 10000 });

    const plotBox = await plotRect.boundingBox();

    if (plotBox) {
      const centerX = plotBox.x + plotBox.width / 2;
      const centerY = plotBox.y + plotBox.height / 2;

      // Start drag from center of plot
      await page.mouse.move(centerX, centerY);
      await page.mouse.down();
      await page.waitForTimeout(500);

      // Drag to the right to go out of bounds (150px should do it for a 10ft garden)
      await page.mouse.move(centerX + 150, centerY, { steps: 15 });
      await page.waitForTimeout(1000);

      // Screenshot during invalid drag (should show red color)
      await page.screenshot({
        path: path.join(REVIEW_IMG_DIR, '06_plot_invalid_red_during_drag.png'),
        fullPage: true,
      });

      // Release mouse
      await page.mouse.up();
      await page.waitForTimeout(2000);

      // Screenshot showing error message after invalid placement
      await page.screenshot({
        path: path.join(REVIEW_IMG_DIR, '07_error_message_after_invalid_drop.png'),
        fullPage: true,
      });
    }

    console.log('Visual validation screenshots captured');
  });
});
