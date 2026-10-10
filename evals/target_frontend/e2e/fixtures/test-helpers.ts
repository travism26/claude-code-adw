import { Page, expect } from '@playwright/test';
import { getApiUrl } from '../config';

/**
 * Test helper utilities for E2E tests
 */

export interface TestUser {
  email: string;
  password: string;
  timezone?: string;
}

export interface TestPlant {
  name: string;
  type: 'indoor' | 'outdoor';
  water_interval_days: number;
  fert_interval_days?: number;
  species?: string;
}

/**
 * Generate a unique test user email
 */
export function generateTestUser(): TestUser {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return {
    email: `test-user-${timestamp}-${random}@example.com`,
    password: 'TestPassword123!',
    timezone: 'America/New_York',
  };
}

/**
 * Generate test plant data
 */
export function generateTestPlant(overrides?: Partial<TestPlant>): TestPlant {
  const defaults: TestPlant = {
    name: `Test Plant ${Date.now()}`,
    type: 'indoor',
    water_interval_days: 7,
    fert_interval_days: 14,
    species: 'Test Species',
  };
  return { ...defaults, ...overrides };
}

/**
 * Sign up a new user via the UI
 */
export async function signUpUser(page: Page, user: TestUser): Promise<void> {
  await page.goto('/signup');
  await page.waitForLoadState('networkidle');

  // Fill the signup form (no username field)
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.fill('input[name="confirmPassword"]', user.password);
  if (user.timezone) {
    // The timezone field uses a native select element with id="timezone"
    const timezoneSelect = page.locator('select[name="timezone"], #timezone').first();
    await timezoneSelect.selectOption(user.timezone);
  }
  await page.click('button[type="submit"]');

  // Wait for navigation to complete - increased timeout for slow signup flows
  try {
    await page.waitForURL('**/dashboard', { timeout: 20000 });
  } catch (error) {
    // Provide better error message on timeout
    throw new Error(
      `Signup failed: timeout waiting for navigation to dashboard. Current URL: ${page.url()}. Original error: ${error}`
    );
  }
}

/**
 * Log in an existing user via the UI
 */
export async function loginUser(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for navigation to complete - increased timeout for slow login flows
  try {
    await page.waitForURL('**/dashboard', { timeout: 20000 });
  } catch (error) {
    // Provide better error message on timeout
    throw new Error(
      `Login failed: timeout waiting for navigation to dashboard. Current URL: ${page.url()}. Original error: ${error}`
    );
  }
}

/**
 * Log out the current user
 */
export async function logoutUser(page: Page): Promise<void> {
  // Navigate to profile page where the logout button is located
  await page.goto('/profile', { waitUntil: 'networkidle' });

  // Wait for the logout button to be visible and click it
  await page.waitForSelector('[data-testid="logout-button"]', { timeout: 10000 });
  await page.click('[data-testid="logout-button"]');

  // Wait for navigation to login or home
  await page.waitForURL(/\/(login|$)/, { timeout: 5000 });

  // Wait for the bottom-nav to be removed (ensures logout is complete)
  await page.waitForSelector('[data-testid="bottom-nav"]', { state: 'detached', timeout: 5000 });
}

/**
 * Create a plant via the UI
 */
export async function createPlantViaUI(page: Page, plant: TestPlant): Promise<void> {
  // Navigate to plants page or click add plant button
  await page.goto('/plants');

  // Wait for the page to load
  await page.waitForLoadState('networkidle');

  // Look for "Add Plant" or "Add Your First Plant" button
  const addPlantButton = page.locator('button:has-text("Add Plant"), button:has-text("Add Your First Plant")').first();
  await addPlantButton.waitFor({ state: 'visible', timeout: 15000 });
  await addPlantButton.click();

  // Wait for navigation to add-plant page
  await page.waitForURL('**/add-plant', { timeout: 10000 });

  // Click "Manual Entry" tab to access the form fields
  await page.click('button:has-text("Manual Entry")');

  // Wait for form to be visible
  await page.waitForSelector('input[name="name"]', { state: 'visible', timeout: 5000 });

  // Fill in the form
  await page.fill('input[name="name"]', plant.name);
  await page.selectOption('select[name="type"]', plant.type);
  await page.fill('input[name="water_interval_days"]', plant.water_interval_days.toString());

  if (plant.fert_interval_days !== undefined) {
    await page.fill('input[name="fert_interval_days"]', plant.fert_interval_days.toString());
  }

  if (plant.species) {
    await page.fill('input[name="species"]', plant.species);
  }

  // Submit the form
  await page.click('button[type="submit"]');

  // Wait for navigation back to plants page
  await page.waitForURL('**/plants', { timeout: 10000 });
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
 * Create a plant via API (faster for test setup)
 */
export async function createPlantViaAPI(
  page: Page,
  plant: TestPlant
): Promise<{ id: string }> {
  // Extract the access token from cookies
  const token = await getAuthToken(page);

  if (!token) {
    throw new Error('Failed to create plant via API: No access token found in cookies');
  }

  // Make the API request with the Bearer token
  const response = await page.context().request.post(getApiUrl('plants'), {
    data: plant,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // Provide better error message if authentication fails
  if (!response.ok()) {
    const contentType = response.headers()['content-type'];
    let errorMessage = `Failed to create plant via API. Status: ${response.status()}`;

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

  const data = await response.json();
  return data.plant;
}

/**
 * Clear all cookies and local storage
 */
export async function clearAuthState(page: Page): Promise<void> {
  await page.context().clearCookies();

  // Try to clear storage, but handle SecurityError gracefully
  // This can fail in WebKit if the page hasn't navigated to a proper origin yet
  try {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  } catch (error) {
    // Ignore SecurityError - storage will be cleared on next navigation
    if (!(error instanceof Error && error.message.includes('SecurityError'))) {
      throw error; // Re-throw if it's not a SecurityError
    }
  }
}

/**
 * Wait for API response
 */
export async function waitForAPIResponse(
  page: Page,
  urlPattern: string | RegExp,
  timeout = 5000
): Promise<void> {
  await page.waitForResponse(
    (response) => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout }
  );
}

/**
 * Check if user is authenticated by checking for auth-required element
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // Check for elements that only appear when logged in
    // The bottom navigation bar is present on all authenticated pages
    await page.waitForSelector('[data-testid="bottom-nav"], [data-testid="dashboard"]', {
      timeout: 2000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
}

/**
 * Retry an action with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delay = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }
  throw new Error('Max retry attempts reached');
}
