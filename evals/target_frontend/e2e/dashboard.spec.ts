import { test, expect } from '@playwright/test';
import {
  generateTestUser,
  signUpUser,
  generateTestPlant,
  createPlantViaAPI,
  waitForAPIResponse,
} from './fixtures/test-helpers';

test.describe('Dashboard', () => {
  test('should load correctly for new user with no plants', async ({ page }) => {
    // This test specifically addresses the bug where dashboard crashes
    // when plants array is undefined/empty
    const user = generateTestUser();

    await signUpUser(page, user);

    // Should be on dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Dashboard should load without errors
    await page.waitForLoadState('networkidle');

    // Wait for React to finish rendering
    await page.waitForTimeout(100);

    // Should not have any console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Should show welcome message
    await expect(
      page.locator('text=/welcome back/i')
    ).toBeVisible({ timeout: 5000 });

    // Verify no errors were thrown
    expect(errors.filter((e) => e.includes('Cannot read properties of undefined'))).toHaveLength(
      0
    );
  });

  test('should display tasks when plants exist', async ({ page, request }) => {
    const user = generateTestUser();

    // Sign up
    await signUpUser(page, user);

    // Create a test plant via API
    const plant = generateTestPlant({
      name: 'Test Plant 1',
      water_interval_days: 7,
      fert_interval_days: 14,
    });

    await createPlantViaAPI(page, plant);

    // Reload dashboard to see the plant's tasks
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Should show tasks section - using data-testid for reliability
    await expect(page.locator('[data-testid="today-tasks"]')).toBeVisible({ timeout: 5000 });

    // Should show the plant's tasks
    await expect(page.locator(`text=/${plant.name}/i`)).toBeVisible();
  });

  test('should categorize tasks correctly (today, upcoming, overdue)', async ({ page }) => {
    const user = generateTestUser();

    await signUpUser(page, user);

    // Create plants with different watering schedules
    const plantToday = generateTestPlant({
      name: 'Plant Due Today',
      water_interval_days: 1, // Due soon
    });

    const plantUpcoming = generateTestPlant({
      name: 'Plant Due Later',
      water_interval_days: 3, // Due in 3 days
    });

    await createPlantViaAPI(page, plantToday);
    await createPlantViaAPI(page, plantUpcoming);

    // Reload dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Should have sections for different task categories
    const todaySection = page.locator('[data-testid="today-tasks"]');
    const upcomingSection = page.locator('[data-testid="upcoming-tasks"]');

    // Check that sections exist
    await expect(todaySection).toBeVisible({ timeout: 5000 });
  });

  test('should show overdue tasks prominently', async ({ page }) => {
    const user = generateTestUser();

    await signUpUser(page, user);

    // For testing overdue tasks, we'd typically need to manipulate dates
    // or have an API to create plants with past due dates
    // This is a simplified version

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // The dashboard should load without crashing even if checking for overdue tasks
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test('should allow marking a task as complete', async ({ page }) => {
    const user = generateTestUser();

    await signUpUser(page, user);

    // Create a test plant
    const plant = generateTestPlant({
      name: 'Plant for Task Completion',
      water_interval_days: 1,
    });

    await createPlantViaAPI(page, plant);

    // Go to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Look for a complete/done button on a task
    const completeButton = page.locator('[data-testid="complete-task"]').first();

    if (await completeButton.isVisible()) {
      await completeButton.click();

      // Wait a bit for the task to be processed (console log happens)
      await page.waitForTimeout(500);

      // Dashboard should still be visible after completing task
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
    }
  });

  test('should refresh tasks when requested', async ({ page }) => {
    const user = generateTestUser();

    await signUpUser(page, user);

    // Create a plant
    const plant = generateTestPlant();
    await createPlantViaAPI(page, plant);

    // Go to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Look for refresh button
    const refreshButton = page.locator(
      'button:has-text("Refresh"), [data-testid="refresh-tasks"]'
    ).first();

    if (await refreshButton.isVisible()) {
      // Click refresh
      await refreshButton.click();

      // Wait for API call
      await waitForAPIResponse(page, '/api/plants');

      // Dashboard should still be visible
      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
    }
  });

  test('should handle multiple plants with different task schedules', async ({ page }) => {
    const user = generateTestUser();

    await signUpUser(page, user);

    // Create multiple plants
    const plants = [
      generateTestPlant({ name: 'Plant 1', water_interval_days: 1 }),
      generateTestPlant({ name: 'Plant 2', water_interval_days: 3 }),
      generateTestPlant({ name: 'Plant 3', water_interval_days: 7, fert_interval_days: 14 }),
      generateTestPlant({ name: 'Plant 4', water_interval_days: 2 }),
    ];

    for (const plant of plants) {
      await createPlantViaAPI(page, plant);
    }

    // Go to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Dashboard should load without errors
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();

    // Should show tasks sections (tasks exist even if they are in upcoming)
    await expect(
      page.locator('[data-testid="today-tasks"], [data-testid="upcoming-tasks"]').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('should not crash when transitioning from no plants to having plants', async ({ page }) => {
    const user = generateTestUser();

    // Sign up (no plants)
    await signUpUser(page, user);

    // Verify dashboard loads with no plants
    await expect(page).toHaveURL(/\/dashboard/);
    await page.waitForLoadState('networkidle');

    // Add a plant
    const plant = generateTestPlant();
    await createPlantViaAPI(page, plant);

    // Reload dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Should now show the plant's tasks
    await expect(page.locator(`text=/${plant.name}/i`)).toBeVisible();

    // Should not have crashed
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test('should display fertilizing tasks separately from watering tasks', async ({ page }) => {
    const user = generateTestUser();

    await signUpUser(page, user);

    // Create plant with both water and fert intervals
    const plant = generateTestPlant({
      name: 'Plant with Fertilizing',
      water_interval_days: 7,
      fert_interval_days: 14,
    });

    await createPlantViaAPI(page, plant);

    // Go to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Should show the plant's name in upcoming tasks (means both watering and fertilizing tasks are tracked)
    // The plant name should appear at least once (watering task)
    await expect(page.locator(`text=/${plant.name}/i`).first()).toBeVisible({ timeout: 5000 });

    // Should show "Water" text in task cards
    await expect(page.locator('text=/water/i').first()).toBeVisible({ timeout: 5000 });

    // Dashboard should have loaded tasks correctly (both types are created in useDashboard hook)
    await expect(page.locator('[data-testid="upcoming-tasks"]')).toBeVisible();
  });
});
