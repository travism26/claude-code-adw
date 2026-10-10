# E2E Testing Guide

This guide provides comprehensive instructions for creating and maintaining End-to-End (E2E) tests for GrowBuddy using Playwright.

## Table of Contents

- [Quick Start](#quick-start)
- [Test Configuration](#test-configuration)
- [Available Helpers](#available-helpers)
- [Common Patterns](#common-patterns)
- [Best Practices](#best-practices)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Running Tests

```bash
cd frontend

# Run all E2E tests
npm run test:e2e

# Run in UI mode (with browser visible)
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test e2e/auth.spec.ts

# View test report
npm run test:e2e:report
```

### Basic Test Structure

```typescript
import { test, expect } from "@playwright/test";
import { generateTestUser, signUpUser } from "./fixtures/test-helpers";

test.describe("Feature Name", () => {
  test("should do something", async ({ page }) => {
    const user = generateTestUser();
    await signUpUser(page, user);

    // Your test assertions here
    await expect(page.locator("text=Welcome")).toBeVisible();
  });
});
```

## Test Configuration

### Centralized API Configuration

**IMPORTANT**: Always use the centralized config for API requests!

```typescript
import { getApiUrl } from "./config";

// Good - uses centralized config
const response = await page.context().request.post(getApiUrl("plants"), {
  data: plantData,
  headers: { Authorization: `Bearer ${token}` },
});

// Bad - hardcoded URL will break in different environments
const response = await page
  .context()
  .request.post("http://localhost:3001/api/plants", {
    data: plantData,
  });
```

The `config.ts` file provides:

- `getApiUrl(endpoint)` - Get full API URL for any endpoint
- `getApiBaseUrl()` - Get the base API URL
- `getFrontendBaseUrl()` - Get the frontend URL
- `API_CONFIG` - Configuration object with all endpoints

### Environment Variables

Tests respect these environment variables:

```bash
NEXT_PUBLIC_API_BASE_URL="http://localhost:3000/api"  # Backend API URL
FRONTEND_PORT=3001                                     # Frontend port
BACKEND_PORT=3000                                      # Backend port
```

## Available Helpers

### Test Helpers (`fixtures/test-helpers.ts`)

#### User Management

```typescript
import {
  generateTestUser,
  signUpUser,
  loginUser,
  logoutUser,
  isAuthenticated,
  clearAuthState,
} from "./fixtures/test-helpers";

// Generate unique test user
const user = generateTestUser();
// Returns: { email: 'test-user-123456-789@example.com', password: 'TestPassword123!', timezone: 'America/New_York' }

// Sign up via UI
await signUpUser(page, user);

// Login via UI
await loginUser(page, user.email, user.password);

// Logout
await logoutUser(page);

// Check if user is authenticated
const authenticated = await isAuthenticated(page);

// Clear all auth state (cookies, localStorage)
await clearAuthState(page);
```

#### Plant Management

```typescript
import {
  generateTestPlant,
  createPlantViaUI,
  createPlantViaAPI,
} from "./fixtures/test-helpers";

// Generate test plant data
const plant = generateTestPlant({
  name: "My Tomato",
  type: "outdoor",
  water_interval_days: 3,
});

// Create plant via UI (slower, tests UI)
await createPlantViaUI(page, plant);

// Create plant via API (faster, for test setup)
const createdPlant = await createPlantViaAPI(page, plant);
// Returns: { id: 'uuid', name: 'My Tomato', ... }
```

#### Utility Functions

```typescript
import {
  waitForAPIResponse,
  takeScreenshot,
  retry,
} from "./fixtures/test-helpers";

// Wait for specific API response
await waitForAPIResponse(page, "/api/plants");

// Take a screenshot
await takeScreenshot(page, "my-test-state");

// Retry an action with exponential backoff
await retry(
  async () => {
    await page.click('button:has-text("Submit")');
  },
  3,
  1000
);
```

### Garden Helpers (`fixtures/garden-helpers.ts`)

#### Garden Management

```typescript
import {
  generateTestGarden,
  createGardenViaUI,
  createGardenViaAPI,
  deleteGarden,
  openGarden,
  navigateToGardenPlanner,
} from "./fixtures/garden-helpers";

// Generate test garden
const garden = generateTestGarden({
  name: "Backyard Garden",
  width: 20,
  height: 15,
  zone: "5a",
});

// Create garden via UI
await createGardenViaUI(page, garden);

// Create garden via API (faster)
const createdGarden = await createGardenViaAPI(page, garden);

// Delete garden
await deleteGarden(page, garden.name);

// Open garden in canvas view
await openGarden(page, garden.name);

// Navigate to garden planner
await navigateToGardenPlanner(page);
```

#### Garden Canvas Interaction

```typescript
import {
  selectPlantFromPalette,
  placePlotOnCanvas,
  getPlotCount,
  getGardensCount,
  waitForGardenInList,
  gardenExistsInList,
} from "./fixtures/garden-helpers";

// Select plant from palette
await selectPlantFromPalette(page, "Tomato");

// Place plot on canvas
await placePlotOnCanvas(page, 100, 150);

// Get plot count
const plotCount = await getPlotCount(page);

// Check if garden exists
const exists = await gardenExistsInList(page, "My Garden");
```

#### Plot Management

```typescript
import { createPlotViaAPI } from "./fixtures/garden-helpers";

// Create plot via API
const plot = await createPlotViaAPI(page, gardenId, {
  x: 0,
  y: 0,
  width: 2,
  height: 2,
  plant_profile_id: "some-uuid",
});
```

## Common Patterns

### Pattern 1: Authenticated User Test

```typescript
test("should perform authenticated action", async ({ page }) => {
  // 1. Setup: Create and login user
  const user = generateTestUser();
  await signUpUser(page, user);

  // 2. Navigate to feature
  await page.goto("/plants");

  // 3. Perform action
  await page.click('button:has-text("Add Plant")');

  // 4. Assert result
  await expect(page).toHaveURL(/.*add-plant/);
});
```

### Pattern 2: API Setup + UI Validation

```typescript
test("should display created data", async ({ page }) => {
  // 1. Setup: Create user and login
  const user = generateTestUser();
  await signUpUser(page, user);

  // 2. Setup: Create data via API (faster)
  const plant = generateTestPlant({ name: "Test Plant" });
  await createPlantViaAPI(page, plant);

  // 3. Navigate to page
  await page.goto("/plants");

  // 4. Verify UI displays the data
  await expect(page.locator("text=Test Plant")).toBeVisible();
});
```

### Pattern 3: Test Isolation with beforeEach

```typescript
test.describe("Plants Page", () => {
  let user: TestUser;

  test.beforeEach(async ({ page }) => {
    // Setup that runs before each test
    user = generateTestUser();
    await signUpUser(page, user);
  });

  test("should add plant", async ({ page }) => {
    // User is already logged in
    await page.goto("/plants");
    // ... test logic
  });

  test("should edit plant", async ({ page }) => {
    // User is already logged in
    await page.goto("/plants");
    // ... test logic
  });
});
```

### Pattern 4: Waiting for Asynchronous Operations

```typescript
test("should handle async operations", async ({ page }) => {
  const user = generateTestUser();
  await signUpUser(page, user);

  // Wait for API response
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/plants") && response.status() === 200
  );

  await page.click('button:has-text("Load Plants")');
  await responsePromise;

  // Now safe to assert
  await expect(page.locator(".plant-card")).toBeVisible();
});
```

### Pattern 5: Testing Error States

```typescript
test("should handle API errors gracefully", async ({ page }) => {
  const user = generateTestUser();
  await signUpUser(page, user);

  // Intercept API request to force error
  await page.route("**/api/plants", (route) => {
    route.fulfill({ status: 500, body: "Server Error" });
  });

  await page.goto("/plants");

  // Verify error message is displayed
  await expect(page.locator("text=Error loading plants")).toBeVisible();
});
```

## Best Practices

### 1. Use Helpers for Common Operations

✅ **Good**: Use provided helpers

```typescript
const user = generateTestUser();
await signUpUser(page, user);
```

❌ **Bad**: Manually repeat code

```typescript
const email = `test-${Date.now()}@example.com`;
await page.goto("/signup");
await page.fill('input[name="email"]', email);
// ... lots of repetitive code
```

### 2. Use API for Test Setup, UI for Validation

✅ **Good**: Fast test setup

```typescript
// Setup data via API (fast)
const plant = await createPlantViaAPI(page, generateTestPlant());

// Test UI interaction
await page.goto("/plants");
await expect(page.locator(`text=${plant.name}`)).toBeVisible();
```

❌ **Bad**: Slow UI setup for everything

```typescript
// Slow - goes through entire UI flow just for setup
await createPlantViaUI(page, generateTestPlant());
```

### 3. Use Data Test IDs for Stable Selectors

✅ **Good**: Stable, semantic selectors

```typescript
await page.click('[data-testid="add-plant-button"]');
await page.locator('[data-testid="plant-card"]').first().click();
```

❌ **Bad**: Fragile selectors

```typescript
await page.click(".css-12345 > button");
await page.locator("div > div > div > button").first().click();
```

### 4. Use Centralized API Configuration

✅ **Good**: Uses centralized config

```typescript
import { getApiUrl } from "./config";
const response = await request.post(getApiUrl("plants"), { data });
```

❌ **Bad**: Hardcoded URLs

```typescript
const response = await request.post("http://localhost:3001/api/plants", {
  data,
});
```

### 5. Clear Test Data Between Tests

✅ **Good**: Each test is independent

```typescript
test.beforeEach(async ({ page }) => {
  await clearAuthState(page);
  const user = generateTestUser(); // New user each time
  await signUpUser(page, user);
});
```

❌ **Bad**: Tests depend on each other

```typescript
let sharedUser; // Don't do this!
test('test 1', async () => { sharedUser = ... });
test('test 2', async () => { /* uses sharedUser */ });
```

### 6. Use Descriptive Test Names

✅ **Good**: Clear what is being tested

```typescript
test("should display error message when plant creation fails", async ({
  page,
}) => {
  // ...
});
```

❌ **Bad**: Vague test name

```typescript
test("plants test", async ({ page }) => {
  // ...
});
```

### 7. Assert on Meaningful Elements

✅ **Good**: Tests user-visible behavior

```typescript
await expect(page.locator("text=Plant created successfully")).toBeVisible();
await expect(page).toHaveURL(/.*plants/);
```

❌ **Bad**: Tests implementation details

```typescript
const divCount = await page.locator("div").count();
expect(divCount).toBe(47); // Fragile!
```

## Examples

### Example 1: Basic CRUD Test

```typescript
import { test, expect } from "@playwright/test";
import {
  generateTestUser,
  signUpUser,
  generateTestPlant,
  createPlantViaAPI,
} from "./fixtures/test-helpers";

test.describe("Plants CRUD", () => {
  test("should create, read, update, and delete a plant", async ({ page }) => {
    // Setup: Create user
    const user = generateTestUser();
    await signUpUser(page, user);

    // Create
    const plant = generateTestPlant({ name: "My Tomato" });
    await createPlantViaAPI(page, plant);

    // Read
    await page.goto("/plants");
    await expect(page.locator("text=My Tomato")).toBeVisible();

    // Update
    await page.locator("text=My Tomato").click();
    await page.fill('input[name="name"]', "Updated Tomato");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Updated Tomato")).toBeVisible();

    // Delete
    await page.click('[data-testid="delete-plant"]');
    await page.click('button:has-text("Confirm")');
    await expect(page.locator("text=Updated Tomato")).not.toBeVisible();
  });
});
```

### Example 2: Garden Planner Test

```typescript
import { test, expect } from "@playwright/test";
import { generateTestUser, signUpUser } from "./fixtures/test-helpers";
import {
  generateTestGarden,
  createGardenViaAPI,
  navigateToGardenPlanner,
  openGarden,
  selectPlantFromPalette,
  placePlotOnCanvas,
  getPlotCount,
} from "./fixtures/garden-helpers";

test.describe("Garden Planner", () => {
  test("should add plants to garden", async ({ page }) => {
    // Setup: User and garden
    const user = generateTestUser();
    await signUpUser(page, user);

    const garden = generateTestGarden({ name: "Test Garden" });
    await createGardenViaAPI(page, garden);

    // Navigate and open garden
    await navigateToGardenPlanner(page);
    await openGarden(page, garden.name);

    // Verify canvas is visible
    await expect(page.locator("canvas")).toBeVisible();

    // Select plant and place on canvas
    await selectPlantFromPalette(page, "Tomato");
    await placePlotOnCanvas(page, 100, 100);

    // Verify plot was created
    const plotCount = await getPlotCount(page);
    expect(plotCount).toBeGreaterThan(0);
  });
});
```

### Example 3: Form Validation Test

```typescript
import { test, expect } from "@playwright/test";
import { generateTestUser, signUpUser } from "./fixtures/test-helpers";

test.describe("Add Plant Form", () => {
  test("should validate required fields", async ({ page }) => {
    const user = generateTestUser();
    await signUpUser(page, user);

    await page.goto("/add-plant");

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Verify validation messages
    await expect(page.locator("text=Name is required")).toBeVisible();
    await expect(page.locator("text=Type is required")).toBeVisible();
  });

  test("should accept valid input", async ({ page }) => {
    const user = generateTestUser();
    await signUpUser(page, user);

    await page.goto("/add-plant");

    // Fill valid data
    await page.fill('input[name="name"]', "My Plant");
    await page.selectOption('select[name="type"]', "indoor");
    await page.fill('input[name="water_interval_days"]', "7");

    // Submit
    await page.click('button[type="submit"]');

    // Verify success
    await expect(page).toHaveURL(/.*plants/);
    await expect(page.locator("text=My Plant")).toBeVisible();
  });
});
```

## Troubleshooting

### Tests Failing with "<!DOCTYPE" Error

**Problem**: Getting HTML instead of JSON from API requests.

**Solution**: Use centralized API configuration:

```typescript
import { getApiUrl } from "./config";

// Instead of hardcoded URL
const response = await request.post(getApiUrl("plants"), { data });
```

### Tests Timing Out

**Problem**: Test exceeds timeout waiting for elements.

**Solutions**:

1. Increase specific timeout:

   ```typescript
   await expect(page.locator("text=Welcome")).toBeVisible({ timeout: 10000 });
   ```

2. Wait for network to be idle:

   ```typescript
   await page.waitForLoadState("networkidle");
   ```

3. Wait for specific API response:
   ```typescript
   await waitForAPIResponse(page, "/api/plants");
   ```

### Strict Mode Violations

**Problem**: Selector matches multiple elements.

**Solutions**:

1. Use more specific selector:

   ```typescript
   // Instead of
   await page.locator("text=Users").click();

   // Use
   await page.locator('[data-testid="users-tab"]').click();
   // Or
   await page.getByRole("tab", { name: "Users" }).click();
   // Or
   await page.locator("text=Users").first().click();
   ```

### Authentication Issues

**Problem**: User not authenticated in test.

**Solutions**:

1. Verify cookies are set:

   ```typescript
   const cookies = await page.context().cookies();
   console.log("Cookies:", cookies);
   ```

2. Check if authenticated:

   ```typescript
   const authenticated = await isAuthenticated(page);
   if (!authenticated) {
     console.log("User not authenticated!");
   }
   ```

3. Clear state between tests:
   ```typescript
   test.beforeEach(async ({ page }) => {
     await clearAuthState(page);
   });
   ```

### Test Data Leaking Between Tests

**Problem**: One test affects another test's data.

**Solutions**:

1. Use unique test data:

   ```typescript
   const user = generateTestUser(); // Generates unique email
   const plant = generateTestPlant(); // Generates unique name
   ```

2. Clean up after tests:
   ```typescript
   test.afterEach(async ({ page }) => {
     await clearAuthState(page);
   });
   ```

## Additional Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [E2E Test Configuration](./playwright.config.ts)
- [Test Helpers Source](./fixtures/test-helpers.ts)
- [Garden Helpers Source](./fixtures/garden-helpers.ts)
- [API Config Source](./config.ts)
