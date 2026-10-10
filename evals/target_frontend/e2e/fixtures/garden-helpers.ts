import { Page, expect } from '@playwright/test';
import { getApiUrl } from '../config';

/**
 * Test helper utilities for Garden E2E tests
 */

export interface TestGarden {
  name: string;
  width: number;
  height: number;
  zone?: string;
  notes?: string;
}

export interface TestPlot {
  x: number;
  y: number;
  width: number;
  height: number;
  plant_profile_id?: string;
  notes?: string;
  compass_direction?: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
}

/**
 * Generate test garden data
 */
export function generateTestGarden(overrides?: Partial<TestGarden>): TestGarden {
  const timestamp = Date.now();
  const defaults: TestGarden = {
    name: `Test Garden ${timestamp}`,
    width: 10,
    height: 10,
    zone: '5a',
  };
  return { ...defaults, ...overrides };
}

/**
 * Navigate to garden planner page
 */
export async function navigateToGardenPlanner(page: Page): Promise<void> {
  await page.goto('/garden-planner');
  await page.waitForLoadState('networkidle');
}

/**
 * Create a garden via the UI
 */
export async function createGardenViaUI(page: Page, garden: TestGarden): Promise<void> {
  // Navigate to garden planner if not already there
  if (!page.url().includes('/garden-planner')) {
    await navigateToGardenPlanner(page);
  }

  // Look for "Create Garden" button
  const createButton = page.locator('button:has-text("Create Garden"), button:has-text("Add Garden")').first();
  await createButton.waitFor({ state: 'visible', timeout: 10000 });
  await createButton.click();

  // Wait for modal/form to be visible
  await page.waitForSelector('input[name="name"], input[placeholder*="Garden name" i]', {
    state: 'visible',
    timeout: 5000
  });

  // Fill in the form
  await page.fill('input[name="name"], input[placeholder*="Garden name" i]', garden.name);

  // Fill width - try different possible selectors
  const widthInput = page.locator('input[name="width"], input[placeholder*="width" i]').first();
  await widthInput.fill(garden.width.toString());

  // Fill height
  const heightInput = page.locator('input[name="height"], input[placeholder*="height" i]').first();
  await heightInput.fill(garden.height.toString());

  // Fill zone if provided
  if (garden.zone) {
    const zoneInput = page.locator('input[name="zone"], input[placeholder*="zone" i], select[name="zone"]').first();
    if (await zoneInput.count() > 0) {
      await zoneInput.fill(garden.zone);
    }
  }

  // Fill notes if provided
  if (garden.notes) {
    const notesInput = page.locator('textarea[name="notes"], textarea[placeholder*="notes" i]').first();
    if (await notesInput.count() > 0) {
      await notesInput.fill(garden.notes);
    }
  }

  // Submit the form - click the submit button
  const submitButton = page.locator('button[type="submit"]:has-text("Create Garden"), button[type="submit"]').first();
  await submitButton.waitFor({ state: 'visible', timeout: 5000 });

  // Wait for API response when clicking submit
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/gardens') && response.request().method() === 'POST',
    { timeout: 10000 }
  );

  await submitButton.click();

  // Wait for the API response to complete
  try {
    await responsePromise;
  } catch (error) {
    console.error('Failed to wait for garden creation API response:', error);
  }

  // Wait for modal to close (wait for dialog to disappear)
  await page.waitForSelector('[role="dialog"], [data-scope="dialog"]', { state: 'detached', timeout: 10000 }).catch(() => {
    // Dialog might close too fast, that's OK
  });

  // Wait for the garden list to update (React Query cache invalidation and re-render)
  // This needs to be longer to allow React Query to refetch and re-render the list
  await page.waitForTimeout(3000);
}

/**
 * Delete a garden via the UI
 */
export async function deleteGarden(page: Page, gardenName: string): Promise<void> {
  // Navigate to garden planner if not already there
  if (!page.url().includes('/garden-planner')) {
    await navigateToGardenPlanner(page);
  }

  // Find the garden card/item
  const gardenCard = page.locator(`text="${gardenName}"`).first();
  await gardenCard.waitFor({ state: 'visible', timeout: 10000 });

  // Find and click delete button by aria-label (more reliable)
  const deleteButton = page.getByRole('button', { name: /delete garden/i }).first();

  await deleteButton.waitFor({ state: 'visible', timeout: 5000 });
  await deleteButton.click();

  // Handle confirmation modal if it exists
  try {
    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes")').first();
    await confirmButton.waitFor({ state: 'visible', timeout: 2000 });
    await confirmButton.click();
  } catch {
    // No confirmation modal, deletion was immediate
  }

  // Wait for garden to be removed from list
  await page.waitForTimeout(1000);
}

/**
 * Open a garden in canvas view
 */
export async function openGarden(page: Page, gardenName: string, waitForPlots: boolean = false): Promise<void> {
  // Navigate to garden planner if not already there
  if (!page.url().includes('/garden-planner')) {
    await navigateToGardenPlanner(page);
  }

  // Find and click on the garden card
  const gardenCard = page.locator(`text="${gardenName}"`).first();
  await gardenCard.waitFor({ state: 'visible', timeout: 10000 });

  // Wait for the API request to fetch garden details to complete
  const navigationPromise = page.waitForResponse(
    response => response.url().includes('/api/gardens/') && response.status() === 200,
    { timeout: 10000 }
  ).catch(() => {
    console.warn('Did not detect garden API response');
  });

  await gardenCard.click();

  // Wait for the API response to complete
  await navigationPromise;

  // Wait for canvas to load
  await page.waitForTimeout(1000);

  // If waitForPlots is true, wait for the garden data with plots to load
  // This ensures the suggestions panel will render if there are plots
  if (waitForPlots) {
    // Wait for either plots to appear OR suggestions panel (which only shows when plots exist)
    await Promise.race([
      page.locator('[data-testid^="plot-"]').first().waitFor({ state: 'visible', timeout: 10000 }),
      page.locator('[data-testid="suggestions-panel"]').waitFor({ state: 'visible', timeout: 10000 })
    ]).catch(() => {
      console.warn('Plots did not render in expected time - may be a timing issue');
    });

    // Additional small wait to ensure React Query has finished updating
    await page.waitForTimeout(500);
  }
}

/**
 * Select a plant from the palette
 */
export async function selectPlantFromPalette(page: Page, plantName: string): Promise<void> {
  // Wait for plant palette to be visible
  await page.waitForSelector('[data-testid="plant-palette"], [class*="plant-palette" i]', {
    timeout: 10000
  });

  // Find and click on the plant
  const plantItem = page.locator(`[data-testid="plant-palette"] >> text="${plantName}", [class*="plant-palette" i] >> text="${plantName}"`).first();
  await plantItem.waitFor({ state: 'visible', timeout: 10000 });
  await plantItem.click();
}

/**
 * Place a plot on canvas at coordinates
 */
export async function placePlotOnCanvas(page: Page, x: number, y: number): Promise<void> {
  // Find the canvas element
  const canvas = page.locator('canvas, [data-testid="garden-canvas"], [class*="garden-canvas" i]').first();
  await canvas.waitFor({ state: 'visible', timeout: 10000 });

  // Click at the specified coordinates
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Canvas element not found or has no bounding box');
  }

  await page.mouse.click(box.x + x, box.y + y);
  await page.waitForTimeout(500); // Wait for plot to be created
}

/**
 * Get the number of plots on canvas
 */
export async function getPlotCount(page: Page): Promise<number> {
  // Try different possible selectors for plots
  const plotSelectors = [
    '[data-testid="plot"]',
    '[class*="plot"]',
    'canvas ~ div >> [class*="plot"]',
  ];

  for (const selector of plotSelectors) {
    const plots = page.locator(selector);
    const count = await plots.count();
    if (count > 0) {
      return count;
    }
  }

  // If no plots found with any selector, return 0
  return 0;
}

/**
 * Extract auth token from page cookies
 */
async function getAuthToken(page: Page): Promise<string | null> {
  const cookies = await page.context().cookies();
  const accessTokenCookie = cookies.find((cookie) => cookie.name === 'accessToken');
  return accessTokenCookie ? accessTokenCookie.value : null;
}

/**
 * Create a garden via API (faster for test setup)
 */
export async function createGardenViaAPI(
  page: Page,
  garden: TestGarden
): Promise<{ id: string; name: string; width: number; height: number }> {
  // Extract the access token from cookies
  const token = await getAuthToken(page);

  if (!token) {
    throw new Error('Failed to create garden via API: No access token found in cookies');
  }

  // Make the API request with the Bearer token
  const response = await page.context().request.post(getApiUrl('gardens'), {
    data: garden,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // Provide better error message if request fails
  if (!response.ok()) {
    const contentType = response.headers()['content-type'];
    let errorMessage = `Failed to create garden via API. Status: ${response.status()}`;

    if (contentType && contentType.includes('text/html')) {
      errorMessage += ' - Received HTML instead of JSON (likely authentication redirect)';
    } else {
      try {
        const errorData = await response.json();
        errorMessage += ` - ${JSON.stringify(errorData)}`;
      } catch {
        const text = await response.text();
        errorMessage += ` - ${text}`;
      }
    }

    throw new Error(errorMessage);
  }

  return await response.json();
}

/**
 * Create a plot via API (faster for test setup)
 */
export async function createPlotViaAPI(
  page: Page,
  gardenId: string,
  plot: TestPlot
): Promise<{ id: string }> {
  const token = await getAuthToken(page);

  if (!token) {
    throw new Error('Failed to create plot via API: No access token found in cookies');
  }

  const response = await page.context().request.post(
    getApiUrl(`gardens/${gardenId}/plots`),
    {
      data: plot,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to create plot via API. Status: ${response.status()} - ${text}`);
  }

  return await response.json();
}

/**
 * Get gardens count from the page
 */
export async function getGardensCount(page: Page): Promise<number> {
  // Wait for gardens list or empty state
  await page.waitForTimeout(1000);

  // Try to find garden cards
  const gardenCards = page.locator('[data-testid="garden-card"], [class*="garden-card" i], [class*="garden-item" i]');
  return await gardenCards.count();
}

/**
 * Wait for garden to appear in list
 */
export async function waitForGardenInList(page: Page, gardenName: string, timeout = 10000): Promise<void> {
  const gardenCard = page.locator(`text="${gardenName}"`).first();
  await gardenCard.waitFor({ state: 'visible', timeout });
}

/**
 * Check if garden exists in list
 */
export async function gardenExistsInList(page: Page, gardenName: string): Promise<boolean> {
  const gardenCard = page.locator(`text="${gardenName}"`).first();
  return await gardenCard.isVisible().catch(() => false);
}

/**
 * Get a garden via API (includes plots)
 */
export async function getGardenViaAPI(
  page: Page,
  gardenId: string
): Promise<any> {
  const token = await getAuthToken(page);

  if (!token) {
    throw new Error('Failed to get garden via API: No access token found in cookies');
  }

  const response = await page.context().request.get(
    getApiUrl(`gardens/${gardenId}`),
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to get garden via API. Status: ${response.status()} - ${text}`);
  }

  return await response.json();
}

/**
 * Update a plot via API
 */
export async function updatePlotViaAPI(
  page: Page,
  gardenId: string,
  plotId: string,
  updates: Partial<TestPlot>
): Promise<any> {
  const token = await getAuthToken(page);

  if (!token) {
    throw new Error('Failed to update plot via API: No access token found in cookies');
  }

  const response = await page.context().request.put(
    getApiUrl(`gardens/${gardenId}/plots/${plotId}`),
    {
      data: updates,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Failed to update plot via API. Status: ${response.status()} - ${text}`);
  }

  return await response.json();
}

/**
 * Mock garden analysis data for E2E tests
 * Intercepts the GET /api/gardens/:id/analysis endpoint and returns mock data
 */
export async function mockGardenAnalysis(page: Page, gardenId: string): Promise<void> {
  await page.route(`**/api/gardens/${gardenId}/analysis`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        suggestions: [
          {
            type: 'optimization',
            category: 'layout',
            title: 'Optimal Plant Selection for Planned Plots',
            description: 'Consider companion planting strategies and optimal spacing before planting.',
            affectedIds: [],
            priority: 'medium',
            actionable: true,
          },
          {
            type: 'warning',
            category: 'companion_planting',
            title: 'Harmful Companion Pairings Detected',
            description: 'Some plants may inhibit each other\'s growth.',
            affectedIds: [],
            priority: 'high',
            actionable: true,
          },
          {
            type: 'improvement',
            category: 'spacing',
            title: 'Spacing Optimization',
            description: 'Consider optimizing plant spacing based on mature plant sizes.',
            affectedIds: [],
            priority: 'low',
            actionable: true,
          },
        ],
        overallScore: 75,
        summary: 'Mock analysis: Your garden has good potential with a few areas for improvement.',
        analyzedAt: new Date().toISOString(),
      }),
    });
  });
}
