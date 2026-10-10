import { test, expect } from "@playwright/test";
import {
  generateTestUser,
  signUpUser,
  generateTestPlant,
  createPlantViaUI,
  waitForAPIResponse,
} from "./fixtures/test-helpers";

test.describe("Plant Management", () => {
  test.beforeEach(async ({ page }) => {
    // Sign up a new user for each test
    const user = generateTestUser();
    await signUpUser(page, user);
  });

  test("should allow user to create a new plant", async ({ page }) => {
    const plant = generateTestPlant({
      name: "My New Plant",
      type: "indoor",
      water_interval_days: 7,
      fert_interval_days: 14,
      species: "Monstera deliciosa",
    });

    // Navigate to plants page
    await page.goto("/plants");
    await page.waitForLoadState("networkidle");

    // Click add plant button (could be "Add Plant" or "Add Your First Plant")
    const addPlantButton = page
      .locator(
        'button:has-text("Add Plant"), button:has-text("Add Your First Plant")'
      )
      .first();
    await addPlantButton.waitFor({ state: "visible", timeout: 15000 });
    await addPlantButton.click();

    // Wait for navigation to add-plant page
    await page.waitForURL("**/add-plant", { timeout: 10000 });

    // Click "Manual Entry" tab to access the form fields
    await page.click('button:has-text("Manual Entry")');

    // Wait for form to be visible
    await page.waitForSelector('input[name="name"]', {
      state: "visible",
      timeout: 5000,
    });

    // Fill in the form
    await page.fill('input[name="name"]', plant.name);
    await page.selectOption('select[name="type"]', plant.type);
    await page.fill(
      'input[name="water_interval_days"]',
      plant.water_interval_days.toString()
    );

    if (plant.fert_interval_days !== undefined) {
      await page.fill(
        'input[name="fert_interval_days"]',
        plant.fert_interval_days.toString()
      );
    }

    if (plant.species) {
      await page.fill('input[name="species"]', plant.species);
    }

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for success
    await waitForAPIResponse(page, "/api/plants");

    // Should see the new plant in the list
    await expect(page.locator(`text=/${plant.name}/i`)).toBeVisible({
      timeout: 5000,
    });
  });

  test("should render PlantCard correctly after adding a plant (Chakra UI v3 Card fix)", async ({
    page,
  }) => {
    const plant = generateTestPlant({
      name: "Card Test Plant",
      type: "indoor",
      water_interval_days: 7,
      fert_interval_days: 14,
      species: "Test Species",
    });

    // Navigate to plants page
    await page.goto("/plants");
    await page.waitForLoadState("networkidle");

    // Take screenshot of empty state
    await page.screenshot({
      path: "test-results/plant-card-empty-state.png",
      fullPage: true,
    });

    // Click add plant button
    const addPlantButton = page
      .locator(
        'button:has-text("Add Plant"), button:has-text("Add Your First Plant")'
      )
      .first();
    await addPlantButton.waitFor({ state: "visible", timeout: 15000 });
    await addPlantButton.click();

    // Wait for navigation to add-plant page
    await page.waitForURL("**/add-plant", { timeout: 10000 });

    // Click "Manual Entry" tab to access the form fields
    await page.click('button:has-text("Manual Entry")');

    // Wait for form to be visible
    await page.waitForSelector('input[name="name"]', {
      state: "visible",
      timeout: 5000,
    });

    // Take screenshot of the form
    await page.screenshot({
      path: "test-results/plant-card-add-form.png",
      fullPage: true,
    });

    // Fill in the form
    await page.fill('input[name="name"]', plant.name);
    await page.selectOption('select[name="type"]', plant.type);
    await page.fill(
      'input[name="water_interval_days"]',
      plant.water_interval_days.toString()
    );
    if (plant.fert_interval_days !== undefined) {
      await page.fill(
        'input[name="fert_interval_days"]',
        plant.fert_interval_days.toString()
      );
    }
    if (plant.species) {
      await page.fill('input[name="species"]', plant.species);
    }

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for success
    await waitForAPIResponse(page, "/api/plants");

    // Wait for navigation back to plants page
    await page.waitForURL("**/plants", { timeout: 10000 });
    await page.waitForLoadState("networkidle");

    // Verify no React errors occurred - check console for errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Verify the plant card is rendered without errors
    await expect(page.locator(`h3:has-text("${plant.name}")`)).toBeVisible({
      timeout: 10000,
    });

    // Take screenshot showing the rendered plant card
    await page.screenshot({
      path: "test-results/plant-card-rendered.png",
      fullPage: true,
    });

    // Verify all expected plant card elements are present
    // Navigate from h3 up to Card.Root: h3 -> Box -> Flex -> Card.Body -> Card.Root (4 levels)
    const plantCard = page
      .locator(`h3:has-text("${plant.name}")`)
      .locator("../../../..");

    // Check that the card displays the plant name
    await expect(plantCard.locator(`text=${plant.name}`)).toBeVisible();

    // Check that the card displays the species
    await expect(plantCard.locator(`text=${plant.species}`)).toBeVisible();

    // Check that the card displays the plant type (indoor/outdoor)
    // The plant type is capitalized via CSS, so match "Indoor" or "Outdoor" case-insensitively
    await expect(plantCard.locator('text=/indoor|outdoor/i')).toBeVisible();

    // Check that the card displays the water interval
    await expect(
      plantCard.locator(`text=/Water every ${plant.water_interval_days} days/i`)
    ).toBeVisible();

    // Check that the card displays the fertilize interval
    await expect(
      plantCard.locator(
        `text=/Fertilize every ${plant.fert_interval_days} days/i`
      )
    ).toBeVisible();

    // Check that the three-dot menu button is visible
    const menuButton = plantCard.locator('button[aria-label="Options"]');
    await expect(menuButton).toBeVisible();

    // Check that the menu button is clickable
    await menuButton.click();

    // Wait for menu to open and be visible (Chakra UI v3 renders in portal)
    await page.waitForTimeout(300);
    await page.locator('[role="menu"]').waitFor({ state: 'visible', timeout: 5000 });

    // Take screenshot with menu open
    await page.screenshot({
      path: "test-results/plant-card-menu-open.png",
      fullPage: true,
    });

    // Verify menu options are visible
    await expect(page.locator('[role="menuitem"]:has-text("Edit")')).toBeVisible();
    await expect(page.locator('[role="menuitem"]:has-text("Delete")')).toBeVisible();

    // Close menu by clicking elsewhere
    await page.click("body");
    await page.waitForTimeout(500);

    // Check that the "View Details" button is visible and clickable
    const viewDetailsButton = plantCard.locator(
      'button:has-text("View Details")'
    );
    await expect(viewDetailsButton).toBeVisible();
    await viewDetailsButton.click();

    // Should navigate to journal page
    await page.waitForURL("**/journal", { timeout: 10000 });

    // Take screenshot of journal page
    await page.screenshot({
      path: "test-results/plant-card-view-details.png",
      fullPage: true,
    });

    // Verify no console errors related to Card components
    const cardErrors = consoleErrors.filter(
      (err) =>
        err.includes("Card") ||
        err.includes("Element type is invalid") ||
        err.includes("expected a string")
    );
    expect(cardErrors.length).toBe(0);
  });

  test("should display list of user plants", async ({ page }) => {
    // Create a couple of plants
    const plant1 = generateTestPlant({ name: "Plant One" });
    const plant2 = generateTestPlant({ name: "Plant Two" });

    await createPlantViaUI(page, plant1);
    await createPlantViaUI(page, plant2);

    // Go to plants page
    await page.goto("/plants");
    await page.waitForLoadState("networkidle");

    // Both plants should be visible with increased timeout
    // React Query should auto-fetch and display plants
    await expect(page.locator(`text=/${plant1.name}/i`)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator(`text=/${plant2.name}/i`)).toBeVisible({
      timeout: 10000,
    });
  });

  // TODO: Edit functionality not yet implemented in AddPlantForm component
  // The form needs to accept a plant prop and use updatePlant mutation instead of createPlant
  test.skip("should allow user to edit existing plant", async ({ page }) => {
    const plant = generateTestPlant({ name: "Original Name" });

    // Create plant
    await createPlantViaUI(page, plant);

    // Go to plants page
    await page.goto("/plants");
    await page.waitForLoadState("networkidle");

    // Find the plant card and click the dropdown menu button (MoreVertical icon)
    const plantCard = page
      .locator(`h3:has-text("${plant.name}")`)
      .locator("..")
      .locator("..");
    const menuButton = plantCard
      .locator("button")
      .filter({ has: page.locator("svg") })
      .first();
    await menuButton.click();

    // Click the Edit option in the dropdown
    await page.locator('button:has-text("Edit")').click();

    // Wait for navigation to add-plant page
    await page.waitForURL("**/add-plant", { timeout: 10000 });

    // Update the name
    const newName = "Updated Plant Name";
    await page.fill('input[name="name"]', newName);

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for update
    await waitForAPIResponse(page, "/api/plants");

    // Should see updated name
    await expect(page.locator(`text=/${newName}/i`)).toBeVisible({
      timeout: 5000,
    });

    // Old name should not be visible
    await expect(page.locator(`text=/${plant.name}/i`)).not.toBeVisible();
  });

  test("should allow user to delete a plant", async ({ page }) => {
    const plant = generateTestPlant({ name: "Plant To Delete" });

    // Create plant
    await createPlantViaUI(page, plant);

    // Go to plants page
    await page.goto("/plants");
    await page.waitForLoadState("networkidle");

    // Verify plant exists
    await expect(page.locator(`text=/${plant.name}/i`)).toBeVisible();

    // Find the plant card and click the dropdown menu button
    const plantCard = page
      .locator(`h3:has-text("${plant.name}")`)
      .locator("../..");
    const menuButton = plantCard.locator('button[aria-label="Options"]');
    await menuButton.click();

    // Wait for menu to open and be visible (Chakra UI v3 renders in portal)
    await page.waitForTimeout(300);
    await page.locator('[role="menu"]').waitFor({ state: 'visible', timeout: 5000 });

    // Click the Delete option in the dropdown
    page.on("dialog", (dialog) => dialog.accept()); // Auto-accept the confirm dialog
    await page.locator('[role="menuitem"]:has-text("Delete")').click();

    // Wait for deletion
    await waitForAPIResponse(page, "/api/plants");

    // Plant should no longer be visible
    await expect(page.locator(`text=/${plant.name}/i`)).not.toBeVisible({
      timeout: 5000,
    });
  });

  test("should validate required fields in plant form", async ({ page }) => {
    // Navigate to plants page
    await page.goto("/plants");
    await page.waitForLoadState("networkidle");

    // Click add plant button
    const addPlantButton = page
      .locator(
        'button:has-text("Add Plant"), button:has-text("Add Your First Plant")'
      )
      .first();
    await addPlantButton.waitFor({ state: "visible", timeout: 15000 });
    await addPlantButton.click();

    // Wait for navigation to add-plant page
    await page.waitForURL("**/add-plant", { timeout: 10000 });

    // Click "Manual Entry" tab to access the form fields
    await page.click('button:has-text("Manual Entry")');

    // Wait for form to be visible
    await page.waitForSelector('input[name="name"]', {
      state: "visible",
      timeout: 5000,
    });

    // Clear the name field (it might have a default value)
    await page.fill('input[name="name"]', "");

    // Try to submit without filling required fields
    await page.click('button[type="submit"]');

    // The form should not submit - check we're still on add-plant page
    await expect(page).toHaveURL(/add-plant/, { timeout: 2000 });

    // Verify the name input shows HTML5 validation state
    const nameInput = page.locator('input[name="name"]');
    const isInvalid = await nameInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    );
    expect(isInvalid).toBeTruthy();
  });

  test("should validate numeric fields accept only numbers", async ({
    page,
  }) => {
    // Navigate to plants page
    await page.goto("/plants");
    await page.waitForLoadState("networkidle");

    // Click add plant button
    const addPlantButton = page
      .locator(
        'button:has-text("Add Plant"), button:has-text("Add Your First Plant")'
      )
      .first();
    await addPlantButton.waitFor({ state: "visible", timeout: 15000 });
    await addPlantButton.click();

    // Wait for navigation to add-plant page
    await page.waitForURL("**/add-plant", { timeout: 10000 });

    // Click "Manual Entry" tab to access the form fields
    await page.click('button:has-text("Manual Entry")');

    // Wait for form to be visible
    await page.waitForSelector('input[name="water_interval_days"]', {
      state: "visible",
      timeout: 5000,
    });

    // Verify that the water_interval_days field is type="number"
    const waterIntervalInput = page.locator(
      'input[name="water_interval_days"]'
    );
    const inputType = await waterIntervalInput.getAttribute("type");
    expect(inputType).toBe("number");

    // Verify the field has min and max constraints
    const minValue = await waterIntervalInput.getAttribute("min");
    const maxValue = await waterIntervalInput.getAttribute("max");
    expect(minValue).toBe("1");
    expect(maxValue).toBe("365");
  });

  test("should show plant details when clicking on a plant", async ({
    page,
  }) => {
    const plant = generateTestPlant({
      name: "Detailed Plant",
      species: "Special Species",
      water_interval_days: 5,
    });

    // Create plant
    await createPlantViaUI(page, plant);

    // Go to plants page
    await page.goto("/plants");
    await page.waitForLoadState("networkidle");

    // Wait for the plant name to be visible first
    await expect(page.locator(`h3:has-text("${plant.name}")`)).toBeVisible({
      timeout: 10000,
    });

    // Click on the "View Details" button for the plant
    // Navigate from h3 up to Card.Root (4 levels) to find the View Details button
    const plantCard = page.locator(`h3:has-text("${plant.name}")`).locator("../../../..");
    await plantCard.locator('button:has-text("View Details")').click();

    // Should navigate to journal page (based on PlantsPage.tsx handleViewPlant)
    await page.waitForURL("**/journal", { timeout: 10000 });

    // The journal page should show plant information
    await expect(page.locator(`text=/${plant.name}/i`)).toBeVisible({
      timeout: 5000,
    });
  });

  test("should update plant list after CRUD operations", async ({ page }) => {
    // Create first plant
    const plant1 = generateTestPlant({ name: "Plant Alpha" });
    await createPlantViaUI(page, plant1);

    // Go to plants page
    await page.goto("/plants");
    await page.waitForLoadState("networkidle");

    // Should see one plant
    await expect(page.locator(`text=/${plant1.name}/i`)).toBeVisible();

    // Add another plant
    const plant2 = generateTestPlant({ name: "Plant Beta" });
    await createPlantViaUI(page, plant2);

    // Reload plants page
    await page.goto("/plants");
    await page.waitForLoadState("networkidle");

    // Should see both plants
    await expect(page.locator(`text=/${plant1.name}/i`)).toBeVisible();
    await expect(page.locator(`text=/${plant2.name}/i`)).toBeVisible();

    // Delete first plant
    const plantCard = page
      .locator(`h3:has-text("${plant1.name}")`)
      .locator("../..");
    const menuButton = plantCard.locator('button[aria-label="Options"]');
    await menuButton.click();

    // Wait for menu to open (Chakra UI v3 renders in portal)
    await page.waitForTimeout(300);
    await page.locator('[role="menu"]').waitFor({ state: 'visible', timeout: 5000 });

    // Click the Delete option in the dropdown
    page.on("dialog", (dialog) => dialog.accept()); // Auto-accept the confirm dialog
    await page.locator('[role="menuitem"]:has-text("Delete")').click();

    await waitForAPIResponse(page, "/api/plants");

    // Should only see second plant
    await expect(page.locator(`text=/${plant1.name}/i`)).not.toBeVisible();
    await expect(page.locator(`text=/${plant2.name}/i`)).toBeVisible();
  });

  test("should handle empty plant list gracefully", async ({ page }) => {
    // New user has no plants
    await page.goto("/plants");
    await page.waitForLoadState("networkidle");

    // Should show empty state heading
    await expect(page.locator('h3:has-text("No plants yet")')).toBeVisible({
      timeout: 5000,
    });

    // Should still show "Add Your First Plant" button
    await expect(
      page.locator('button:has-text("Add Your First Plant")')
    ).toBeVisible();
  });

  test("should support both indoor and outdoor plant types", async ({
    page,
  }) => {
    const indoorPlant = generateTestPlant({
      name: "Indoor Plant",
      type: "indoor",
    });
    const outdoorPlant = generateTestPlant({
      name: "Outdoor Plant",
      type: "outdoor",
    });

    // Create both types
    await createPlantViaUI(page, indoorPlant);
    await createPlantViaUI(page, outdoorPlant);

    // Go to plants page
    await page.goto("/plants");
    await page.waitForLoadState("networkidle");

    // Both should be visible
    await expect(page.locator(`text=/${indoorPlant.name}/i`)).toBeVisible();
    await expect(page.locator(`text=/${outdoorPlant.name}/i`)).toBeVisible();

    // Should show type indicators
    // Chakra UI v3 Text renders as <p>, not <span>, and text is capitalized
    await expect(page.locator('text=Indoor').first()).toBeVisible();
    await expect(page.locator('text=Outdoor').first()).toBeVisible();
  });
});
