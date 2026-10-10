import { test, expect } from '@playwright/test';
import * as path from 'path';
import { generateTestUser, signUpUser } from './fixtures/test-helpers';
import { navigateToGardenPlanner, openGarden, generateTestGarden, createGardenViaAPI, createPlotViaAPI } from './fixtures/garden-helpers';

const REVIEW_IMG_DIR = process.env.REVIEW_IMG_DIR ?? path.join(__dirname, '..', 'review_img');

test.describe('Plot Drag with Snap-to-Grid Review', () => {
  test.beforeEach(async ({ page }) => {
    // Sign up a new user for testing
    const user = generateTestUser();
    await signUpUser(page, user);
  });

  test('review plot drag snap-to-grid functionality', async ({ page }) => {
    // CREATE A GARDEN WITH PLOT FIRST
    const garden = generateTestGarden({
      name: "Snap Test Garden",
      width: 20,
      height: 20
    });
    const createdGarden = await createGardenViaAPI(page, garden);

    // Create a plot to drag
    await createPlotViaAPI(page, createdGarden.id, {
      x: 5,
      y: 5,
      width: 3,
      height: 3,
    });

    // Navigate to garden planner and open the specific garden
    await navigateToGardenPlanner(page);
    await openGarden(page, garden.name, true);

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Screenshot 1: Initial state
    await page.screenshot({ 
      path: path.join(REVIEW_IMG_DIR, '01_garden_planner_initial.png'),
      fullPage: false 
    });

    // Find the snap toggle
    const snapToggle = page.locator('button').filter({ hasText: /Snap/ }).first();
    
    // Make sure snap is off first
    const snapText = await snapToggle.textContent();
    if (snapText?.includes('On')) {
      await snapToggle.click();
      await page.waitForTimeout(500);
    }

    // Test drag without snap
    const plotElement = page.locator('[data-testid^="plot-"]').first();
    const plotBox = await plotElement.boundingBox();

    if (plotBox) {
      await page.mouse.move(plotBox.x + plotBox.width / 2, plotBox.y + plotBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(plotBox.x + 100, plotBox.y + 100, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(1000);
    }

    // Screenshot 2: After drag without snap
    await page.screenshot({ 
      path: path.join(REVIEW_IMG_DIR, '02_drag_without_snap.png'),
      fullPage: false 
    });

    // Enable snap
    await snapToggle.click();
    await page.waitForTimeout(500);

    // Screenshot 3: Snap enabled
    await page.screenshot({ 
      path: path.join(REVIEW_IMG_DIR, '03_snap_enabled.png'),
      fullPage: false 
    });

    // Test drag WITH snap-to-grid
    const updatedPlotBox = await plotElement.boundingBox();
    if (updatedPlotBox) {
      await page.mouse.move(updatedPlotBox.x + updatedPlotBox.width / 2, updatedPlotBox.y + updatedPlotBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(updatedPlotBox.x - 150, updatedPlotBox.y - 150, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(1500);
    }

    // Screenshot 4: After drag with snap (CRITICAL)
    await page.screenshot({ 
      path: path.join(REVIEW_IMG_DIR, '04_drag_with_snap.png'),
      fullPage: false 
    });

    // Check for errors
    const errorToasts = page.locator('[role="alert"]').filter({ hasText: /error/i });
    const errorCount = await errorToasts.count();

    // Screenshot 5: Final state
    await page.screenshot({ 
      path: path.join(REVIEW_IMG_DIR, '05_final_state.png'),
      fullPage: false 
    });

    // Verify no errors
    expect(errorCount).toBe(0);
  });
});
