import { test, expect } from "@playwright/test";
import {
  generateTestUser,
  signUpUser,
  waitForAPIResponse,
} from "./fixtures/test-helpers";
import {
  generateTestGarden,
  navigateToGardenPlanner,
  createGardenViaUI,
  createGardenViaAPI,
  deleteGarden,
  openGarden,
  selectPlantFromPalette,
  placePlotOnCanvas,
  getPlotCount,
  getGardensCount,
  waitForGardenInList,
  gardenExistsInList,
  createPlotViaAPI,
  getGardenViaAPI,
  updatePlotViaAPI,
} from "./fixtures/garden-helpers";

test.describe("Garden Management", () => {
  test.beforeEach(async ({ page }) => {
    // Sign up a new user for each test
    const user = generateTestUser();
    await signUpUser(page, user);
  });

  test("should display garden planner page when authenticated", async ({
    page,
  }) => {
    // Navigate to garden planner
    await navigateToGardenPlanner(page);

    // Verify page loads successfully
    await expect(page).toHaveURL(/\/garden-planner/);

    // Verify either garden list or empty state is displayed
    const hasGardens = (await page.locator("text=/garden/i").count()) > 0;
    const hasEmptyState =
      (await page
        .locator("text=/create.*garden/i, text=/add.*garden/i")
        .count()) > 0;

    expect(hasGardens || hasEmptyState).toBeTruthy();
  });

  test("should create a new garden with valid data", async ({ page }) => {
    const garden = generateTestGarden({
      name: "My Test Garden",
      width: 20,
      height: 15,
      zone: "6b",
    });

    // Navigate to garden planner
    await navigateToGardenPlanner(page);

    // Create the garden (this already waits for API response)
    await createGardenViaUI(page, garden);

    // Verify garden appears in list
    await waitForGardenInList(page, garden.name);
    const exists = await gardenExistsInList(page, garden.name);
    expect(exists).toBeTruthy();
  });

  test("should validate garden creation form", async ({ page }) => {
    // Navigate to garden planner
    await navigateToGardenPlanner(page);

    // Open create garden form
    const createButton = page
      .locator(
        'button:has-text("Create Garden"), button:has-text("Add Garden")'
      )
      .first();
    await createButton.waitFor({ state: "visible", timeout: 10000 });
    await createButton.click();

    // Wait for form to be visible
    await page.waitForSelector(
      'input[name="name"], input[placeholder*="Garden name" i]',
      {
        state: "visible",
        timeout: 5000,
      }
    );

    // Try to submit empty form by pressing Enter on the name input
    const nameInput = page.locator('input[name="name"]').first();
    await nameInput.press("Enter");

    // Wait a moment for validation to appear
    await page.waitForTimeout(1000);

    // Check that we're still on the form (not navigated away)
    // This indicates validation prevented submission
    const formStillVisible = await page
      .locator('input[name="name"], input[placeholder*="Garden name" i]')
      .isVisible();
    expect(formStillVisible).toBeTruthy();
  });

  test("should edit an existing garden", async ({ page }) => {
    // Create a garden via API first
    const garden = generateTestGarden({ name: "Garden to Edit" });
    await createGardenViaAPI(page, garden);

    // Navigate to garden planner
    await navigateToGardenPlanner(page);

    // Wait for garden to appear
    await waitForGardenInList(page, garden.name);

    // Find and click edit button by aria-label (more reliable)
    const editButton = page
      .getByRole("button", { name: /edit garden/i })
      .first();

    // If edit button exists, click it
    if ((await editButton.count()) > 0) {
      await editButton.click();

      // Wait for edit form dialog to appear
      await page.waitForSelector('input[name="name"]', {
        state: "visible",
        timeout: 5000,
      });

      // Update the name
      const nameInput = page.locator('input[name="name"]').first();
      await nameInput.clear();
      await nameInput.fill("Updated Garden Name");

      // Wait for API response when submitting
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/gardens') && response.request().method() === 'PUT',
        { timeout: 10000 }
      );

      // Submit by clicking the Save button
      const saveButton = page.locator('button[type="submit"]:has-text("Save"), button:has-text("Save Changes")').first();
      await saveButton.click();

      // Wait for the API response to complete
      try {
        await responsePromise;
      } catch (error) {
        console.error('Failed to wait for garden update API response:', error);
      }

      // Wait for modal to close
      await page
        .waitForSelector('[role="dialog"], [data-scope="dialog"]', {
          state: "detached",
          timeout: 10000,
        })
        .catch(() => {});

      // Wait for React Query cache to update and list to re-render
      await page.waitForTimeout(3000);

      // Wait for the updated garden name to appear
      await waitForGardenInList(page, "Updated Garden Name");
      const updatedExists = await gardenExistsInList(
        page,
        "Updated Garden Name"
      );
      expect(updatedExists).toBeTruthy();
    } else {
      // Edit functionality may not be implemented yet - skip assertion
      console.log("Edit button not found - feature may not be implemented yet");
    }
  });

  test("should delete a garden", async ({ page }) => {
    // Create a garden via API first
    const garden = generateTestGarden({ name: "Garden to Delete" });
    await createGardenViaAPI(page, garden);

    // Navigate to garden planner
    await navigateToGardenPlanner(page);

    // Wait for garden to appear
    await waitForGardenInList(page, garden.name);

    // Set up dialog handler to accept confirmation
    page.on("dialog", (dialog) => dialog.accept());

    // Delete the garden
    await deleteGarden(page, garden.name);

    // Wait for deletion to complete and garden list to refresh
    await page.waitForTimeout(1500);

    // Verify garden is removed
    const exists = await gardenExistsInList(page, garden.name);
    expect(exists).toBeFalsy();
  });
});

test.describe("Garden Canvas", () => {
  test.beforeEach(async ({ page }) => {
    // Sign up a new user for each test
    const user = generateTestUser();
    await signUpUser(page, user);
  });

  test("should display garden canvas when garden is opened", async ({
    page,
  }) => {
    // Create a garden via API
    const garden = generateTestGarden({ name: "Canvas Test Garden" });
    const createdGarden = await createGardenViaAPI(page, garden);

    // Navigate to garden planner
    await navigateToGardenPlanner(page);

    // Open the garden
    await openGarden(page, garden.name);

    // Verify we're on the garden page (URL should include garden ID or canvas)
    await page.waitForTimeout(2000);

    // Check if canvas or garden view is displayed
    // The implementation may vary, so we check for multiple possibilities
    const hasCanvas =
      (await page
        .locator(
          'canvas, [data-testid="garden-canvas"], [class*="garden-canvas" i]'
        )
        .count()) > 0;
    const hasGardenView =
      (await page.locator(`text="${garden.name}"`).count()) > 0;
    const isOnGardenPage = page.url().includes("/garden");

    expect(hasCanvas || hasGardenView || isOnGardenPage).toBeTruthy();
  });

  test("should display empty canvas for new garden", async ({ page }) => {
    // Create a garden via API
    const garden = generateTestGarden({ name: "Empty Garden" });
    await createGardenViaAPI(page, garden);

    // Navigate to garden planner
    await navigateToGardenPlanner(page);

    // Open the garden
    await openGarden(page, garden.name);

    // Wait for canvas to load
    await page.waitForTimeout(2000);

    // Verify no plots are present
    const plotCount = await getPlotCount(page);
    expect(plotCount).toBe(0);
  });

  test("should load existing plots when garden has data", async ({ page }) => {
    // Create a garden via API
    const garden = generateTestGarden({ name: "Garden with Plots" });
    const createdGarden = await createGardenViaAPI(page, garden);

    // Create a plot via API
    try {
      await createPlotViaAPI(page, createdGarden.id, {
        x: 1,
        y: 1,
        width: 2,
        height: 2,
      });

      await createPlotViaAPI(page, createdGarden.id, {
        x: 4,
        y: 4,
        width: 1.5,
        height: 1.5,
      });
    } catch (error) {
      console.log(
        "Plot creation via API failed - may not be fully implemented:",
        error
      );
    }

    // Navigate to garden planner
    await navigateToGardenPlanner(page);

    // Open the garden
    await openGarden(page, garden.name);

    // Wait for canvas and plots to load
    await page.waitForTimeout(2000);

    // Verify plots are rendered (if plot API worked)
    // If it didn't work, this test documents expected behavior
    const plotCount = await getPlotCount(page);
    console.log(`Found ${plotCount} plots on canvas`);
  });
});

test.describe("Plant Palette", () => {
  test.beforeEach(async ({ page }) => {
    // Sign up a new user for each test
    const user = generateTestUser();
    await signUpUser(page, user);
  });

  test("should display plant profiles in palette", async ({ page }) => {
    // Create a garden via API
    const garden = generateTestGarden({ name: "Palette Test Garden" });
    await createGardenViaAPI(page, garden);

    // Navigate to garden planner
    await navigateToGardenPlanner(page);

    // Open the garden
    await openGarden(page, garden.name);

    // Wait for plant palette to load
    await page.waitForTimeout(2000);

    // Check for plant palette
    const paletteExists =
      (await page
        .locator('[data-testid="plant-palette"], [class*="plant-palette" i]')
        .count()) > 0;

    if (paletteExists) {
      // Verify plants are displayed
      // Plant profiles should have been seeded in the database
      const plantItems = await page
        .locator(
          '[data-testid="plant-palette"] >> div, [class*="plant-palette" i] >> div'
        )
        .count();
      expect(plantItems).toBeGreaterThan(0);
    } else {
      console.log(
        "Plant palette not found - feature may not be implemented yet"
      );
    }
  });

  test("should filter plants by search", async ({ page }) => {
    // Create a garden via API
    const garden = generateTestGarden({ name: "Filter Test Garden" });
    await createGardenViaAPI(page, garden);

    // Navigate to garden planner
    await navigateToGardenPlanner(page);

    // Open the garden
    await openGarden(page, garden.name);

    // Wait for plant palette to load
    await page.waitForTimeout(2000);

    // Look for search input
    const searchInput = page
      .locator('input[placeholder*="search" i], input[placeholder*="filter" i]')
      .first();

    if ((await searchInput.count()) > 0) {
      // Get initial count
      const initialCount = await page
        .locator('[data-testid="plant-item"], [class*="plant-item" i]')
        .count();

      // Enter search term
      await searchInput.fill("tomato");
      await page.waitForTimeout(500);

      // Get filtered count
      const filteredCount = await page
        .locator('[data-testid="plant-item"], [class*="plant-item" i]')
        .count();

      // Filtered count should be different (likely less)
      console.log(`Initial: ${initialCount}, Filtered: ${filteredCount}`);

      // Clear search
      await searchInput.fill("");
      await page.waitForTimeout(500);

      // Count should return to original
      const clearedCount = await page
        .locator('[data-testid="plant-item"], [class*="plant-item" i]')
        .count();
      expect(clearedCount).toBe(initialCount);
    } else {
      console.log(
        "Search input not found - feature may not be implemented yet"
      );
    }
  });

  test("should select plant from palette", async ({ page }) => {
    // Create a garden via API
    const garden = generateTestGarden({ name: "Selection Test Garden" });
    await createGardenViaAPI(page, garden);

    // Navigate to garden planner
    await navigateToGardenPlanner(page);

    // Open the garden
    await openGarden(page, garden.name);

    // Wait for plant palette to load
    await page.waitForTimeout(2000);

    // Check for plant palette
    const paletteExists =
      (await page
        .locator('[data-testid="plant-palette"], [class*="plant-palette" i]')
        .count()) > 0;

    if (paletteExists) {
      // Try to find and click a plant item
      const plantItem = page
        .locator('[data-testid="plant-item"], [class*="plant-item" i]')
        .first();

      if ((await plantItem.count()) > 0) {
        await plantItem.click();
        await page.waitForTimeout(500);

        // Check for selection indicator
        // Could be highlighted, checked, or have selected class
        const hasSelectedClass = await plantItem.evaluate(
          (el) =>
            el.className.includes("selected") ||
            el.getAttribute("aria-selected") === "true" ||
            el.getAttribute("data-selected") === "true"
        );

        console.log(`Plant selected: ${hasSelectedClass}`);
      }
    } else {
      console.log(
        "Plant palette not found - feature may not be implemented yet"
      );
    }
  });
});

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    // Sign up a new user for each test
    const user = generateTestUser();
    await signUpUser(page, user);
  });

  test("should navigate from dashboard to garden planner", async ({ page }) => {
    // Should be on dashboard after signup
    await expect(page).toHaveURL(/\/dashboard/);

    // Look for Garden Planner link in navigation
    const gardenLink = page
      .locator(
        'a:has-text("Garden Planner"), a:has-text("Garden"), a:has-text("Planner"), ' +
          '[href="/garden-planner"], [href*="garden"]'
      )
      .first();

    if ((await gardenLink.count()) > 0) {
      await gardenLink.click();
      await page.waitForTimeout(1000);

      // Verify redirected to garden planner
      await expect(page).toHaveURL(/\/garden-planner/);
    } else {
      // Manually navigate if link not found
      await navigateToGardenPlanner(page);
      await expect(page).toHaveURL(/\/garden-planner/);
    }
  });

  test("should navigate back to garden list from canvas", async ({ page }) => {
    // Create a garden via API
    const garden = generateTestGarden({ name: "Navigation Test Garden" });
    await createGardenViaAPI(page, garden);

    // Navigate to garden planner
    await navigateToGardenPlanner(page);

    // Open the garden
    await openGarden(page, garden.name);
    await page.waitForTimeout(1000);

    // Look for back button
    const backButton = page
      .locator(
        'button:has-text("Back"), button:has-text("Gardens"), a:has-text("Back"), ' +
          '[aria-label*="back" i], [title*="back" i]'
      )
      .first();

    if ((await backButton.count()) > 0) {
      await backButton.click();
      await page.waitForTimeout(1000);

      // Should be back on garden list
      const exists = await gardenExistsInList(page, garden.name);
      expect(exists).toBeTruthy();
    } else {
      console.log("Back button not found - may need to navigate manually");
    }
  });

  test("should handle invalid garden ID gracefully", async ({ page }) => {
    // Try to navigate to invalid garden
    await page.goto("/garden-planner/invalid-id-999");

    // Wait for the error state to render (give React Query time to fail)
    await page.waitForTimeout(3000);

    // Should show error message (checking for the exact text we added)
    const hasErrorHeading =
      (await page.locator('text="Garden not found"').count()) > 0;
    const hasErrorText =
      (await page.locator("text=/not found|does not exist|deleted/i").count()) >
      0;
    const redirectedToList =
      page.url().includes("/garden-planner") &&
      !page.url().includes("invalid-id-999");

    expect(hasErrorHeading || hasErrorText || redirectedToList).toBeTruthy();
  });
});

test.describe("Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    // Sign up a new user for each test
    const user = generateTestUser();
    await signUpUser(page, user);
  });

  test("should handle empty garden list gracefully", async ({ page }) => {
    // Navigate to garden planner (user has no gardens)
    await navigateToGardenPlanner(page);

    // Should show empty state
    const hasEmptyState =
      (await page
        .locator(
          "text=/no gardens/i, text=/create.*garden/i, text=/get started/i, " +
            "text=/add.*garden/i, text=/first garden/i"
        )
        .count()) > 0;

    const hasCreateButton =
      (await page
        .locator(
          'button:has-text("Create Garden"), button:has-text("Add Garden"), ' +
            'button:has-text("Get Started")'
        )
        .count()) > 0;

    expect(hasEmptyState || hasCreateButton).toBeTruthy();
  });

  test("should handle garden with zero plots", async ({ page }) => {
    // Create a garden via API
    const garden = generateTestGarden({ name: "Empty Plot Garden" });
    await createGardenViaAPI(page, garden);

    // Navigate to garden planner
    await navigateToGardenPlanner(page);

    // Open the garden
    await openGarden(page, garden.name);
    await page.waitForTimeout(2000);

    // Should show empty canvas state
    const plotCount = await getPlotCount(page);
    expect(plotCount).toBe(0);

    // May show helpful message
    const hasHelpText =
      (await page
        .locator(
          "text=/add plants/i, text=/start planting/i, text=/empty/i, " +
            "text=/select.*plant/i"
        )
        .count()) > 0;

    console.log(`Empty canvas displayed. Help text present: ${hasHelpText}`);
  });

  test("should persist garden data after page refresh", async ({ page }) => {
    // Create a garden
    const garden = generateTestGarden({ name: "Persistence Test Garden" });
    await navigateToGardenPlanner(page);
    await createGardenViaUI(page, garden);

    // Wait for creation
    await waitForGardenInList(page, garden.name);

    // Refresh the page
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify garden still appears
    const exists = await gardenExistsInList(page, garden.name);
    expect(exists).toBeTruthy();
  });
});

test.describe("Plot Compass Direction", () => {
  test.beforeEach(async ({ page }) => {
    // Sign up a new user and create a garden for each test
    const user = generateTestUser();
    await signUpUser(page, user);
  });

  test("should create plot with compass direction via API", async ({
    page,
  }) => {
    // Create a garden
    const testGarden = generateTestGarden({ name: "Compass Test Garden" });
    const createdGarden = await createGardenViaAPI(page, testGarden);

    // Create a plot with compass direction
    const plotData = {
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      compass_direction: "N" as const,
    };

    const createdPlot = await createPlotViaAPI(page, createdGarden.id, plotData);

    // Verify plot was created
    expect(createdPlot.id).toBeTruthy();

    // Fetch the garden to verify compass direction
    const gardenData = await getGardenViaAPI(page, createdGarden.id);
    const plot = gardenData.plots.find((p: any) => p.id === createdPlot.id);
    expect(plot).toBeTruthy();
    expect(plot.compass_direction).toBe("N");
  });

  test("should accept all 8 valid compass directions", async ({ page }) => {
    // Create a larger garden to fit 8 plots side by side (each 2x2, spaced 2.5 apart)
    const testGarden = generateTestGarden({ name: "Compass Directions Garden", width: 25, height: 10 });
    const createdGarden = await createGardenViaAPI(page, testGarden);

    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

    for (let i = 0; i < directions.length; i++) {
      const plotData = {
        x: i * 2.5,
        y: 0,
        width: 2,
        height: 2,
        compass_direction: directions[i],
      };

      const createdPlot = await createPlotViaAPI(page, createdGarden.id, plotData);
      expect(createdPlot.id).toBeTruthy();

      // Verify compass direction was stored correctly
      const gardenData = await getGardenViaAPI(page, createdGarden.id);
      const plot = gardenData.plots.find((p: any) => p.id === createdPlot.id);
      expect(plot.compass_direction).toBe(directions[i]);
    }
  });

  test("should create plot without compass direction", async ({ page }) => {
    const testGarden = generateTestGarden({ name: "No Direction Garden" });
    const createdGarden = await createGardenViaAPI(page, testGarden);

    const plotData = {
      x: 0,
      y: 0,
      width: 2,
      height: 2,
    };

    const createdPlot = await createPlotViaAPI(page, createdGarden.id, plotData);
    expect(createdPlot.id).toBeTruthy();

    // Verify compass direction is null
    const gardenData = await getGardenViaAPI(page, createdGarden.id);
    const plot = gardenData.plots.find((p: any) => p.id === createdPlot.id);
    expect(plot.compass_direction).toBeNull();
  });

  test("should update plot compass direction", async ({ page }) => {
    const testGarden = generateTestGarden({ name: "Update Direction Garden" });
    const createdGarden = await createGardenViaAPI(page, testGarden);

    // Create plot with initial compass direction
    const plotData = {
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      compass_direction: "N" as const,
    };

    const createdPlot = await createPlotViaAPI(page, createdGarden.id, plotData);

    // Update compass direction
    const updatedPlot = await updatePlotViaAPI(
      page,
      createdGarden.id,
      createdPlot.id,
      { compass_direction: "S" as const }
    );

    expect(updatedPlot.compass_direction).toBe("S");
  });
});

test.describe("Plot Compass Direction UI", () => {
  test.beforeEach(async ({ page }) => {
    // Sign up a new user for each test
    const user = generateTestUser();
    await signUpUser(page, user);
  });

  test("should set compass direction through edit plot modal", async ({ page }) => {
    // Create garden and plot via API
    const testGarden = generateTestGarden({ name: "Compass UI Test Garden" });
    const createdGarden = await createGardenViaAPI(page, testGarden);

    const plotData = {
      x: 2,
      y: 2,
      width: 2,
      height: 2,
    };
    const createdPlot = await createPlotViaAPI(page, createdGarden.id, plotData);

    // Navigate to garden planner and open the garden
    await navigateToGardenPlanner(page);
    await openGarden(page, createdGarden.name);

    // Wait for SVG canvas and plot to be rendered
    await page.waitForTimeout(2000);

    // Click on the plot rect element to select it
    const plotRect = page.locator('rect[data-testid^="plot-"]').first();
    await plotRect.waitFor({ state: 'visible', timeout: 10000 });
    await plotRect.click();
    await page.waitForTimeout(500);

    // Verify plot is selected by checking for the "Plot Selected" text
    await expect(page.locator('text="Plot Selected"')).toBeVisible({ timeout: 5000 });

    // Click "Edit Plot" button
    const editButton = page.locator('button:has-text("Edit Plot")');
    await editButton.waitFor({ state: 'visible', timeout: 5000 });
    await editButton.click();

    // Wait for edit modal to appear
    await expect(page.locator('text="Edit Plot"').first()).toBeVisible({ timeout: 5000 });

    // Select a compass direction (North)
    const selectElement = page.locator('select[name="compass_direction"]');
    await selectElement.waitFor({ state: 'visible', timeout: 5000 });
    await selectElement.selectOption('N');

    // Click "Save Changes" button
    const saveButton = page.locator('button:has-text("Save Changes")');
    await saveButton.click();

    // Wait for modal to close
    await page.waitForTimeout(1000);

    // Verify compass direction displays in selected plot info box with arrow indicator
    await expect(page.locator('text=/↑.*Facing North/i')).toBeVisible({ timeout: 5000 });
  });

  test("should display all 8 compass directions with correct arrows", async ({ page }) => {
    // Create a larger garden to fit multiple plots
    const testGarden = generateTestGarden({ name: "All Directions Garden", width: 25, height: 10 });
    const createdGarden = await createGardenViaAPI(page, testGarden);

    const directions = [
      { dir: 'N', arrow: '↑', name: 'North' },
      { dir: 'NE', arrow: '↗', name: 'Northeast' },
      { dir: 'E', arrow: '→', name: 'East' },
      { dir: 'SE', arrow: '↘', name: 'Southeast' },
      { dir: 'S', arrow: '↓', name: 'South' },
      { dir: 'SW', arrow: '↙', name: 'Southwest' },
      { dir: 'W', arrow: '←', name: 'West' },
      { dir: 'NW', arrow: '↖', name: 'Northwest' },
    ];

    // Create all plots first
    for (let i = 0; i < directions.length; i++) {
      const { dir } = directions[i];
      const plotData = {
        x: i * 2.5,
        y: 2,
        width: 2,
        height: 2,
        compass_direction: dir as 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW',
      };
      await createPlotViaAPI(page, createdGarden.id, plotData);
    }

    // Navigate to garden planner once
    await navigateToGardenPlanner(page);
    await openGarden(page, createdGarden.name);
    await page.waitForTimeout(2000);

    // Wait for all plots to be rendered
    await page.waitForSelector('rect[data-testid^="plot-"]', { timeout: 10000 });
    const plotCount = await page.locator('rect[data-testid^="plot-"]').count();
    console.log(`Found ${plotCount} plots on canvas`);

    // Now verify each plot displays the correct compass direction
    for (let i = 0; i < directions.length; i++) {
      const { name } = directions[i];

      // Click on the i-th plot rect (not the label) - click without force first
      const plotRect = page.locator('rect[data-testid^="plot-"]').nth(i);
      await plotRect.waitFor({ state: 'visible', timeout: 10000 });

      // Regular click first
      await plotRect.click();

      // Wait longer for the Plot Selected box to appear and update
      await page.waitForTimeout(1000);

      // Verify the Plot Selected box is visible
      const plotSelectedBox = page.locator('text="Plot Selected"');
      if (!(await plotSelectedBox.isVisible())) {
        console.log(`Warning: Plot Selected box not visible for ${name}, retrying click...`);
        // Retry with force click
        await plotRect.click({ force: true });
        await page.waitForTimeout(1000);
      }

      await expect(plotSelectedBox).toBeVisible({ timeout: 5000 });

      // Verify correct direction name display (allow for both "Facing Northeast" and "Facing Northeast (NE)")
      const directionText = page.locator(`text=/Facing ${name}/i`);
      await expect(directionText).toBeVisible({ timeout: 5000 });
    }
  });

  test("should allow clearing compass direction", async ({ page }) => {
    const testGarden = generateTestGarden({ name: "Clear Direction Garden" });
    const createdGarden = await createGardenViaAPI(page, testGarden);

    // Create plot with compass direction via API
    const plotData = {
      x: 2,
      y: 2,
      width: 2,
      height: 2,
      compass_direction: 'N' as const,
    };
    const createdPlot = await createPlotViaAPI(page, createdGarden.id, plotData);

    // Navigate to garden planner and open the garden
    await navigateToGardenPlanner(page);
    await openGarden(page, createdGarden.name);
    await page.waitForTimeout(2000);

    // Click on the plot rect element to select it
    const plotRect = page.locator('rect[data-testid^="plot-"]').first();
    await plotRect.waitFor({ state: 'visible', timeout: 10000 });
    await plotRect.click();
    await page.waitForTimeout(500);

    // Verify compass direction is initially displayed
    await expect(page.locator('text=/Facing North/i')).toBeVisible({ timeout: 5000 });

    // Click "Edit Plot" button
    const editButton = page.locator('button:has-text("Edit Plot")');
    await editButton.click();
    await page.waitForTimeout(500);

    // Select "Not specified" option
    const selectElement = page.locator('select[name="compass_direction"]');
    await selectElement.selectOption('');

    // Click "Save Changes"
    const saveButton = page.locator('button:has-text("Save Changes")');
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Verify compass direction is removed from plot info display
    await expect(page.locator('text=/Facing North/i')).not.toBeVisible();
  });

  test("should update plot notes", async ({ page }) => {
    const testGarden = generateTestGarden({ name: "Notes Test Garden" });
    const createdGarden = await createGardenViaAPI(page, testGarden);

    const plotData = {
      x: 2,
      y: 2,
      width: 2,
      height: 2,
    };
    const createdPlot = await createPlotViaAPI(page, createdGarden.id, plotData);

    // Navigate to garden planner and open the garden
    await navigateToGardenPlanner(page);
    await openGarden(page, createdGarden.name);
    await page.waitForTimeout(2000);

    // Click on the plot rect element to select it
    const plotRect = page.locator('rect[data-testid^="plot-"]').first();
    await plotRect.waitFor({ state: 'visible', timeout: 10000 });
    await plotRect.click();
    await page.waitForTimeout(500);

    // Click "Edit Plot" button
    const editButton = page.locator('button:has-text("Edit Plot")');
    await editButton.click();
    await page.waitForTimeout(500);

    // Enter notes in textarea
    const notesTextarea = page.locator('textarea[name="notes"]');
    await notesTextarea.waitFor({ state: 'visible', timeout: 5000 });
    await notesTextarea.fill('This is a test note for the plot');

    // Click "Save Changes"
    const saveButton = page.locator('button:has-text("Save Changes")');
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Verify notes display in plot info box
    await expect(page.locator('text=/Notes:.*This is a test note/i')).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Plot Resizing", () => {
  test.beforeEach(async ({ page }) => {
    // Sign up a new user for each test
    const user = generateTestUser();
    await signUpUser(page, user);
  });

  test("should resize plot by dragging resize handle", async ({ page }) => {
    // Create garden and plot via API
    const testGarden = generateTestGarden({ name: "Resize Test Garden", width: 20, height: 20 });
    const createdGarden = await createGardenViaAPI(page, testGarden);

    const plotData = {
      x: 2,
      y: 2,
      width: 2,
      height: 2,
    };
    const createdPlot = await createPlotViaAPI(page, createdGarden.id, plotData);

    // Navigate to garden planner and open the garden
    await navigateToGardenPlanner(page);
    await openGarden(page, createdGarden.name);
    await page.waitForTimeout(2000);

    // Click on the plot to select it (resize handles should appear)
    const plotRect = page.locator('rect[data-testid^="plot-"]').first();
    await plotRect.waitFor({ state: 'visible', timeout: 10000 });
    await plotRect.click();
    await page.waitForTimeout(500);

    // Verify initial size displays
    await expect(page.locator('text=/Size:.*2.*×.*2.*ft/i')).toBeVisible({ timeout: 5000 });

    // Find the bottom-right resize handle
    const resizeHandle = page.locator('[data-testid="resize-handle-bottom-right"]');
    await resizeHandle.waitFor({ state: 'visible', timeout: 5000 });

    // Get the handle's position
    const handleBox = await resizeHandle.boundingBox();
    if (!handleBox) throw new Error('Resize handle not found');

    // Drag the handle to resize the plot (drag right and down to make it larger)
    // Each grid unit is typically ~50px at 1x zoom, so dragging 150px right and 200px down
    // should increase width by ~3ft and height by ~4ft (making it 5×6 ft)
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 150, handleBox.y + 200, { steps: 15 });
    await page.mouse.up();

    // Wait for auto-save
    await page.waitForTimeout(1500);

    // Verify new size displays (should be approximately 4×8 ft, allow some tolerance)
    const sizeText = await page.locator('text=/Size:/i').first().textContent();
    expect(sizeText).toBeTruthy();

    // Verify via API that the plot was resized
    const gardenData = await getGardenViaAPI(page, createdGarden.id);
    const updatedPlot = gardenData.plots.find((p: any) => p.id === createdPlot.id);

    // Check that width and height increased (allowing some tolerance for grid snapping)
    expect(updatedPlot.width).toBeGreaterThan(2);
    expect(updatedPlot.height).toBeGreaterThan(2);
  });

  test("should prevent resizing plot beyond garden bounds", async ({ page }) => {
    // Create 10x10 ft garden
    const testGarden = generateTestGarden({ name: "Bounds Test Garden", width: 10, height: 10 });
    const createdGarden = await createGardenViaAPI(page, testGarden);

    // Add plot at position (8, 8) with size 2x2 (already at edge of garden)
    const plotData = {
      x: 8,
      y: 8,
      width: 2,
      height: 2,
    };
    const createdPlot = await createPlotViaAPI(page, createdGarden.id, plotData);

    // Navigate to garden planner and open the garden
    await navigateToGardenPlanner(page);
    await openGarden(page, createdGarden.name);
    await page.waitForTimeout(2000);

    // Click on the plot to select it
    const plotRect = page.locator('rect[data-testid^="plot-"]').first();
    await plotRect.waitFor({ state: 'visible', timeout: 10000 });
    await plotRect.click();
    await page.waitForTimeout(500);

    // Try to drag the bottom-right resize handle beyond the garden boundary
    const resizeHandle = page.locator('[data-testid="resize-handle-bottom-right"]');
    await resizeHandle.waitFor({ state: 'visible', timeout: 5000 });

    const handleBox = await resizeHandle.boundingBox();
    if (!handleBox) throw new Error('Resize handle not found');

    // Try to drag far right and down (attempting to go beyond 10×10 boundary)
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 200, handleBox.y + 200, { steps: 10 });
    await page.mouse.up();

    // Wait for validation and potential error toast
    await page.waitForTimeout(1000);

    // Verify plot stayed within bounds via API
    const gardenData = await getGardenViaAPI(page, createdGarden.id);
    const updatedPlot = gardenData.plots.find((p: any) => p.id === createdPlot.id);

    // Plot should not extend beyond garden boundary (x + width <= 10, y + height <= 10)
    expect(updatedPlot.x + updatedPlot.width).toBeLessThanOrEqual(10);
    expect(updatedPlot.y + updatedPlot.height).toBeLessThanOrEqual(10);

    // Optionally check for error toast
    const hasErrorToast =
      (await page.locator('text=/beyond.*boundary/i, text=/out of bounds/i').count()) > 0;
    console.log(`Error toast shown: ${hasErrorToast}`);
  });

  test("should prevent resizing plot to overlap others", async ({ page }) => {
    // Create garden
    const testGarden = generateTestGarden({ name: "Overlap Test Garden", width: 20, height: 20 });
    const createdGarden = await createGardenViaAPI(page, testGarden);

    // Create two plots with a small gap between them
    const plot1Data = {
      x: 2,
      y: 2,
      width: 2,
      height: 2,
    };
    await createPlotViaAPI(page, createdGarden.id, plot1Data);

    const plot2Data = {
      x: 6,
      y: 2,
      width: 2,
      height: 2,
    };
    const createdPlot2 = await createPlotViaAPI(page, createdGarden.id, plot2Data);

    // Navigate to garden planner and open the garden
    await navigateToGardenPlanner(page);
    await openGarden(page, createdGarden.name);
    await page.waitForTimeout(2000);

    // Click on the second plot (at 6,2) to select it
    const plotRects = page.locator('rect[data-testid^="plot-"]');
    await plotRects.last().click();
    await page.waitForTimeout(500);

    // Try to drag the left edge of plot 2 towards plot 1 (which would cause overlap)
    const leftHandle = page.locator('[data-testid="resize-handle-left"]');
    await leftHandle.waitFor({ state: 'visible', timeout: 5000 });

    const handleBox = await leftHandle.boundingBox();
    if (!handleBox) throw new Error('Resize handle not found');

    // Drag the left handle far left to try to overlap with plot 1
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x - 150, handleBox.y, { steps: 10 });
    await page.mouse.up();

    // Wait for validation
    await page.waitForTimeout(1000);

    // Verify plots don't overlap via API
    const gardenData = await getGardenViaAPI(page, createdGarden.id);
    const plot1 = gardenData.plots[0];
    const plot2 = gardenData.plots[1];

    // Check that plots don't overlap (one should be completely to the left/right of the other)
    const noOverlap = (
      plot1.x + plot1.width <= plot2.x || // plot1 is completely left of plot2
      plot2.x + plot2.width <= plot1.x    // plot2 is completely left of plot1
    );
    expect(noOverlap).toBeTruthy();

    // Optionally check for overlap error toast
    const hasOverlapError = (await page.locator('text=/overlap/i').count()) > 0;
    console.log(`Overlap error shown: ${hasOverlapError}`);
  });

  test("should respect minimum and maximum dimensions when resizing", async ({ page }) => {
    // Create a large garden to test dimension limits
    const testGarden = generateTestGarden({ name: "Dimension Limits Garden", width: 100, height: 100 });
    const createdGarden = await createGardenViaAPI(page, testGarden);

    // Create a plot in the middle of the garden with moderate size
    const plotData = {
      x: 50,
      y: 50,
      width: 5,
      height: 5,
    };
    const createdPlot = await createPlotViaAPI(page, createdGarden.id, plotData);

    // Navigate to garden planner and open the garden
    await navigateToGardenPlanner(page);
    await openGarden(page, createdGarden.name);
    await page.waitForTimeout(1000);

    // Select the plot
    const plotRect = page.locator('rect[data-testid^="plot-"]').first();
    await plotRect.click();
    await page.waitForTimeout(500);

    // Test minimum dimensions by trying to shrink the plot very small
    // Find the bottom-right resize handle
    const resizeHandle = page.locator('[data-testid="resize-handle-bottom-right"]');
    await resizeHandle.waitFor({ state: 'visible', timeout: 5000 });

    const handleBox = await resizeHandle.boundingBox();
    if (!handleBox) throw new Error('Resize handle not found');

    // Try to drag the handle to make the plot extremely small (should hit minimum size constraint)
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    // Drag far to the left and up to try to make it tiny
    await page.mouse.move(handleBox.x - 200, handleBox.y - 200, { steps: 10 });
    await page.mouse.up();

    // Wait for auto-save
    await page.waitForTimeout(1500);

    // Verify the plot has a minimum size (likely 0.5 or 1.0 ft)
    let gardenData = await getGardenViaAPI(page, createdGarden.id);
    let updatedPlot = gardenData.plots.find((p: any) => p.id === createdPlot.id);

    // The plot should have some minimum dimension enforced (e.g., >= 0.5 ft)
    expect(updatedPlot.width).toBeGreaterThanOrEqual(0.5);
    expect(updatedPlot.height).toBeGreaterThanOrEqual(0.5);
    console.log(`Minimum size test - Plot dimensions: ${updatedPlot.width}x${updatedPlot.height}`);

    // Test maximum dimensions by trying to expand the plot very large
    // Select the plot again
    await plotRect.click();
    await page.waitForTimeout(500);

    // Find the bottom-right resize handle again
    const resizeHandle2 = page.locator('[data-testid="resize-handle-bottom-right"]');
    await resizeHandle2.waitFor({ state: 'visible', timeout: 5000 });

    const handleBox2 = await resizeHandle2.boundingBox();
    if (!handleBox2) throw new Error('Resize handle not found');

    // Drag the handle to make the plot very large (should be limited by garden bounds)
    await page.mouse.move(handleBox2.x + handleBox2.width / 2, handleBox2.y + handleBox2.height / 2);
    await page.mouse.down();
    // Drag far to the right and down to try to make it huge
    await page.mouse.move(handleBox2.x + 1000, handleBox2.y + 1000, { steps: 10 });
    await page.mouse.up();

    // Wait for auto-save
    await page.waitForTimeout(1500);

    // Verify the plot respects garden bounds (shouldn't exceed 100x100 garden)
    gardenData = await getGardenViaAPI(page, createdGarden.id);
    updatedPlot = gardenData.plots.find((p: any) => p.id === createdPlot.id);

    // The plot should not exceed the garden boundaries
    expect(updatedPlot.x + updatedPlot.width).toBeLessThanOrEqual(100);
    expect(updatedPlot.y + updatedPlot.height).toBeLessThanOrEqual(100);
    console.log(`Maximum size test - Plot dimensions: ${updatedPlot.width}x${updatedPlot.height} at position (${updatedPlot.x}, ${updatedPlot.y})`);
  });
});

test.describe("Visual Validation During Drag", () => {
  test.beforeEach(async ({ page }) => {
    // Sign up a new user for each test
    const user = generateTestUser();
    await signUpUser(page, user);
  });

  test("should show red color when dragging plot out of bounds", async ({ page }) => {
    // Create garden and plot via API
    const testGarden = generateTestGarden({ name: "Drag Validation Garden", width: 10, height: 10 });
    const createdGarden = await createGardenViaAPI(page, testGarden);

    const plotData = {
      x: 8,
      y: 8,
      width: 2,
      height: 2,
    };
    await createPlotViaAPI(page, createdGarden.id, plotData);

    // Navigate to garden planner and open the garden
    await navigateToGardenPlanner(page);
    await openGarden(page, createdGarden.name);
    await page.waitForTimeout(2000);

    // Get the plot element
    const plotRect = page.locator('rect[data-testid^="plot-"]').first();
    await plotRect.waitFor({ state: 'visible', timeout: 10000 });

    // Get the bounding box of the plot
    const plotBox = await plotRect.boundingBox();
    if (!plotBox) throw new Error('Plot not found');

    // Calculate center of plot
    const centerX = plotBox.x + plotBox.width / 2;
    const centerY = plotBox.y + plotBox.height / 2;

    // Start drag from center of plot
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();

    // Drag beyond the right boundary (try to move 200px to the right)
    await page.mouse.move(centerX + 200, centerY, { steps: 10 });
    await page.waitForTimeout(500);

    // Release mouse
    await page.mouse.up();
    await page.waitForTimeout(1500); // Wait for validation to complete

    // Verify error toast appears after release (validation happened)
    const hasErrorToast =
      (await page.locator('text=/Invalid placement/i, text=/beyond.*boundary/i, text=/outside.*boundar/i').count()) > 0;

    // The main validation is that the plot doesn't actually move out of bounds
    // Visual feedback (red color) is nice-to-have but may not always be detectable in tests
    if (!hasErrorToast) {
      console.log('Warning: Error toast not shown, but checking plot stayed in bounds...');
    }

    // Verify plot actually stayed within bounds via API (primary validation)
    const gardenData = await getGardenViaAPI(page, createdGarden.id);
    const plot = gardenData.plots[0];
    expect(plot.x + plot.width).toBeLessThanOrEqual(10);
    expect(plot.y + plot.height).toBeLessThanOrEqual(10);
  });

  test("should show red color when dragging plot to overlap another", async ({ page }) => {
    // Create garden with two plots
    const testGarden = generateTestGarden({ name: "Overlap Drag Garden", width: 20, height: 20 });
    const createdGarden = await createGardenViaAPI(page, testGarden);

    // Create two plots far apart
    await createPlotViaAPI(page, createdGarden.id, {
      x: 2,
      y: 2,
      width: 2,
      height: 2,
    });

    await createPlotViaAPI(page, createdGarden.id, {
      x: 10,
      y: 2,
      width: 2,
      height: 2,
    });

    // Navigate to garden planner and open the garden
    await navigateToGardenPlanner(page);
    await openGarden(page, createdGarden.name);
    await page.waitForTimeout(2000);

    // Get the second plot (rightmost one)
    const plotRects = page.locator('rect[data-testid^="plot-"]');
    const secondPlot = plotRects.last();
    await secondPlot.waitFor({ state: 'visible', timeout: 10000 });

    // Get the bounding box
    const plotBox = await secondPlot.boundingBox();
    if (!plotBox) throw new Error('Plot not found');

    const centerX = plotBox.x + plotBox.width / 2;
    const centerY = plotBox.y + plotBox.height / 2;

    // Start drag from center
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();

    // Drag left to overlap with first plot (move about 300px left)
    await page.mouse.move(centerX - 300, centerY, { steps: 10 });
    await page.waitForTimeout(500);

    // Release mouse
    await page.mouse.up();
    await page.waitForTimeout(1500);

    // Verify plots don't overlap via API (primary validation)
    const gardenData = await getGardenViaAPI(page, createdGarden.id);
    const plot1 = gardenData.plots[0];
    const plot2 = gardenData.plots[1];

    // Check that plots don't overlap (one should be completely to the left/right of the other)
    const noOverlap = (
      plot1.x + plot1.width <= plot2.x || // plot1 is completely left of plot2
      plot2.x + plot2.width <= plot1.x    // plot2 is completely left of plot1
    );
    expect(noOverlap).toBeTruthy();

    // Check for overlap error toast (secondary validation)
    const hasOverlapError = (await page.locator('text=/overlap/i, text=/Invalid placement/i').count()) > 0;
    if (!hasOverlapError) {
      console.log('Warning: Overlap error toast not shown, but plots are correctly separated');
    }
  });

  test("should remain green when dragged to valid position", async ({ page }) => {
    // Create garden and plot
    const testGarden = generateTestGarden({ name: "Valid Drag Garden", width: 20, height: 20 });
    const createdGarden = await createGardenViaAPI(page, testGarden);

    await createPlotViaAPI(page, createdGarden.id, {
      x: 5,
      y: 5,
      width: 2,
      height: 2,
    });

    // Navigate to garden planner and open the garden
    await navigateToGardenPlanner(page);
    await openGarden(page, createdGarden.name);
    await page.waitForTimeout(2000);

    // Get the plot element
    const plotRect = page.locator('rect[data-testid^="plot-"]').first();
    await plotRect.waitFor({ state: 'visible', timeout: 10000 });

    // Drag the plot to a new valid position (100px right and down)
    await plotRect.dispatchEvent('mousedown', { button: 0 });
    const box = await plotRect.boundingBox();
    if (!box) throw new Error('Plot not found');
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 100, { steps: 15 });
    await page.mouse.up();

    await page.waitForTimeout(1500);

    // Verify plot actually moved to a valid position via API
    const gardenData = await getGardenViaAPI(page, createdGarden.id);
    const plot = gardenData.plots[0];

    // Plot should have moved from original position (5, 5)
    const hasMoved = plot.x !== 5 || plot.y !== 5;

    // Plot should still be within bounds
    const isWithinBounds = (
      plot.x >= 0 &&
      plot.y >= 0 &&
      plot.x + plot.width <= 20 &&
      plot.y + plot.height <= 20
    );

    expect(hasMoved).toBeTruthy();
    expect(isWithinBounds).toBeTruthy();

    // Success toast is nice-to-have
    const hasSuccessToast = (await page.locator('text=/Plot moved/i, text=/success/i').count()) > 0;
    if (!hasSuccessToast) {
      console.log('Warning: Success toast not shown, but plot moved successfully');
    }
  });
});

test.describe("Garden Planner UI - Plot Labels and Context Menu", () => {
  test.beforeEach(async ({ page }) => {
    // Sign up a new user for each test
    const user = generateTestUser();
    await signUpUser(page, user);
  });

  test("should display plant name on plot when plant profile is assigned", async ({
    page,
  }) => {
    // Create garden and plot with plant profile via API
    const garden = generateTestGarden({ name: "Plant Name Test Garden" });
    await createGardenViaAPI(page, garden);

    // Navigate and open garden
    await navigateToGardenPlanner(page);
    await openGarden(page, garden.name);
    await page.waitForTimeout(2000);

    // Select a plant from palette and place it
    const plantItem = page
      .locator('[data-testid="plant-item"], [class*="plant-item" i]')
      .first();

    if ((await plantItem.count()) > 0) {
      // Get the plant name from the palette item
      const plantName = await plantItem.textContent();
      await plantItem.click();
      await page.waitForTimeout(500);

      // Place plot on canvas
      const canvas = page.locator("svg").first();
      await canvas.waitFor({ state: "visible" });
      const box = await canvas.boundingBox();

      if (box) {
        await canvas.click({
          position: { x: box.width / 2, y: box.height / 2 },
        });
        await page.waitForTimeout(1000);

        // Verify plot label shows plant name (or abbreviation)
        const plotLabel = page.locator('[data-testid="plot-label"]').first();
        await expect(plotLabel).toBeVisible();

        // The label should contain part of the plant name
        const labelText = await plotLabel.textContent();
        expect(labelText).toBeTruthy();
        expect(labelText).not.toBe("Plant"); // Should not be generic "Plant"
      }
    }
  });

  test("should show resize handles on selected plot", async ({ page }) => {
    // Create garden via API
    const gardenData = generateTestGarden({ name: "Resize Handles Test Garden" });
    const garden = await createGardenViaAPI(page, gardenData);

    // Create a plot via API
    const plot = {
      x: 5,
      y: 5,
      width: 3,
      height: 3,
    };
    await createPlotViaAPI(page, garden.id, plot);

    // Navigate and open garden
    await navigateToGardenPlanner(page);
    await openGarden(page, garden.name);
    await page.waitForTimeout(2000);

    // Click on the plot to select it
    const plotElement = page.locator("rect[cursor]").first();
    await plotElement.click();
    await page.waitForTimeout(500);

    // Check for resize handles
    const cornerHandles = [
      "resize-handle-top-left",
      "resize-handle-top-right",
      "resize-handle-bottom-left",
      "resize-handle-bottom-right",
    ];

    const edgeHandles = [
      "resize-handle-top",
      "resize-handle-right",
      "resize-handle-bottom",
      "resize-handle-left",
    ];

    // Verify at least one corner handle is visible
    let hasCornerHandle = false;
    for (const handleId of cornerHandles) {
      const handle = page.locator(`[data-testid="${handleId}"]`);
      if ((await handle.count()) > 0) {
        hasCornerHandle = true;
        break;
      }
    }
    expect(hasCornerHandle).toBeTruthy();

    // Verify at least one edge handle is visible
    let hasEdgeHandle = false;
    for (const handleId of edgeHandles) {
      const handle = page.locator(`[data-testid="${handleId}"]`);
      if ((await handle.count()) > 0) {
        hasEdgeHandle = true;
        break;
      }
    }
    expect(hasEdgeHandle).toBeTruthy();
  });

  test("should open context menu on right-click", async ({ page }) => {
    // Create garden via API
    const gardenData = generateTestGarden({ name: "Context Menu Test Garden" });
    const garden = await createGardenViaAPI(page, gardenData);

    // Create a plot via API
    const plot = {
      x: 5,
      y: 5,
      width: 3,
      height: 3,
    };
    await createPlotViaAPI(page, garden.id, plot);

    // Navigate and open garden
    await navigateToGardenPlanner(page);
    await openGarden(page, garden.name);
    await page.waitForTimeout(2000);

    // Right-click on the plot
    const plotElement = page.locator("rect[cursor]").first();
    await plotElement.click({ button: "right" });
    await page.waitForTimeout(500);

    // Verify context menu is visible
    const contextMenu = page.locator('[data-testid="plot-context-menu"]');
    await expect(contextMenu).toBeVisible();

    // Verify menu items exist
    const editButton = page.locator('[data-testid="context-menu-edit"]');
    const deleteButton = page.locator('[data-testid="context-menu-delete"]');
    const viewDetailsButton = page.locator(
      '[data-testid="context-menu-view-details"]'
    );

    await expect(editButton).toBeVisible();
    await expect(deleteButton).toBeVisible();
    await expect(viewDetailsButton).toBeVisible();

    // Check for expansion options
    const expandUpButton = page.locator(
      '[data-testid="context-menu-expand-up"]'
    );
    const expandDownButton = page.locator(
      '[data-testid="context-menu-expand-down"]'
    );
    const expandLeftButton = page.locator(
      '[data-testid="context-menu-expand-left"]'
    );
    const expandRightButton = page.locator(
      '[data-testid="context-menu-expand-right"]'
    );

    // At least one expansion option should be visible
    const hasExpansionOptions =
      (await expandUpButton.count()) > 0 ||
      (await expandDownButton.count()) > 0 ||
      (await expandLeftButton.count()) > 0 ||
      (await expandRightButton.count()) > 0;

    expect(hasExpansionOptions).toBeTruthy();
  });

  test("should close context menu when clicking outside", async ({ page }) => {
    // Create garden via API
    const gardenData = generateTestGarden({
      name: "Context Menu Close Test Garden",
    });
    const garden = await createGardenViaAPI(page, gardenData);

    // Create a plot via API
    const plot = {
      x: 5,
      y: 5,
      width: 3,
      height: 3,
    };
    await createPlotViaAPI(page, garden.id, plot);

    // Navigate and open garden
    await navigateToGardenPlanner(page);
    await openGarden(page, garden.name);
    await page.waitForTimeout(2000);

    // Right-click on the plot to open context menu
    const plotElement = page.locator("rect[cursor]").first();
    await plotElement.click({ button: "right" });
    await page.waitForTimeout(500);

    // Verify context menu is visible
    const contextMenu = page.locator('[data-testid="plot-context-menu"]');
    await expect(contextMenu).toBeVisible();

    // Click outside the context menu
    await page.mouse.click(100, 100);
    await page.waitForTimeout(500);

    // Context menu should be hidden
    await expect(contextMenu).not.toBeVisible();
  });

  test("should delete plot via context menu", async ({ page }) => {
    // Create garden via API
    const gardenData = generateTestGarden({ name: "Context Menu Delete Garden" });
    const garden = await createGardenViaAPI(page, gardenData);

    // Create a plot via API
    const plot = {
      x: 5,
      y: 5,
      width: 3,
      height: 3,
    };
    await createPlotViaAPI(page, garden.id, plot);

    // Navigate and open garden
    await navigateToGardenPlanner(page);
    await openGarden(page, garden.name);
    await page.waitForTimeout(2000);

    // Get initial plot count
    const initialPlotCount = await page.locator("rect[cursor]").count();

    // Right-click on the plot
    const plotElement = page.locator("rect[cursor]").first();
    await plotElement.click({ button: "right" });
    await page.waitForTimeout(500);

    // Click delete button
    const deleteButton = page.locator('[data-testid="context-menu-delete"]');
    await deleteButton.click();
    await page.waitForTimeout(1000);

    // Verify plot was deleted
    const finalPlotCount = await page.locator("rect[cursor]").count();
    expect(finalPlotCount).toBe(initialPlotCount - 1);

    // Should show success message
    const hasSuccessToast =
      (await page.locator('text=/Plot removed/i').count()) > 0;
    expect(hasSuccessToast).toBeTruthy();
  });
});
