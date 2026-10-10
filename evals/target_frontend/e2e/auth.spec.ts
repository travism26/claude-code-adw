import { test, expect } from "@playwright/test";
import {
  generateTestUser,
  signUpUser,
  loginUser,
  logoutUser,
  clearAuthState,
  isAuthenticated,
} from "./fixtures/test-helpers";

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a proper page first, then clear authentication state
    // This ensures we have a valid origin before trying to clear localStorage
    await page.goto("/");
    await clearAuthState(page);
  });

  test("should allow a user to sign up with valid credentials", async ({
    page,
  }) => {
    const user = generateTestUser();

    await signUpUser(page, user);

    // Verify we're on the dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Wait for page to be fully loaded
    await page.waitForLoadState("networkidle");

    // Verify user is authenticated
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBeTruthy();
  });

  test("should not allow signup with existing email", async ({ page }) => {
    const user = generateTestUser();

    // First signup should succeed
    await signUpUser(page, user);

    // Logout
    await logoutUser(page);

    // Try to sign up again with same email
    await page.goto("/signup");
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.fill('input[name="confirmPassword"]', user.password);
    await page.click('button[type="submit"]');

    // Should see error message we dont want to tell the user that the email is taken
    // this will introduce security issues like user enumeration, and email harvesting (OSINT)
    await expect(
      page.locator("text=/already exists|already registered|signup failed/i")
    ).toBeVisible({
      timeout: 5000,
    });
  });

  test("should allow user to log in with correct credentials", async ({
    page,
  }) => {
    const user = generateTestUser();

    // First sign up
    await signUpUser(page, user);

    // Logout
    await logoutUser(page);

    // Log back in
    await loginUser(page, user.email, user.password);

    // Verify we're on the dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Wait for page to be fully loaded
    await page.waitForLoadState("networkidle");

    // Verify user is authenticated
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBeTruthy();
  });

  test("should not allow login with incorrect password", async ({ page }) => {
    const user = generateTestUser();

    // First sign up
    await signUpUser(page, user);

    // Logout
    await logoutUser(page);

    // Try to log in with wrong password
    await page.goto("/login");
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', "WrongPassword123!");
    await page.click('button[type="submit"]');

    // Should see error message
    await expect(
      page.locator(
        "text=/invalid credentials|incorrect password|authentication failed|login failed/i"
      )
    ).toBeVisible({ timeout: 5000 });

    // Should still be on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test("should not allow login with non-existent email", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "nonexistent@example.com");
    await page.fill('input[name="password"]', "Password123!");
    await page.click('button[type="submit"]');

    // Should see error message
    await expect(
      page.locator(
        "text=/invalid credentials|user not found|authentication failed|login failed/i"
      )
    ).toBeVisible({ timeout: 5000 });
  });

  test("should keep user logged in after page refresh", async ({ page }) => {
    const user = generateTestUser();

    // Sign up
    await signUpUser(page, user);

    // Verify authenticated
    let authenticated = await isAuthenticated(page);
    expect(authenticated).toBeTruthy();

    // Refresh the page
    await page.reload();

    // Should still be authenticated
    authenticated = await isAuthenticated(page);
    expect(authenticated).toBeTruthy();

    // Should still be on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("should silently refresh an expired access token instead of logging out (BUG-003)", async ({
    page,
  }) => {
    const user = generateTestUser();
    await signUpUser(page, user);
    expect(await isAuthenticated(page)).toBeTruthy();

    // Simulate the 15-min-idle state: the short-lived access token cookie has
    // expired, but the 7-day refresh token cookie remains.
    await page.evaluate(() => {
      document.cookie =
        "accessToken=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;";
    });

    // Direct navigation to a protected route should silently refresh, NOT bounce
    // the user to /login.
    await page.goto("/plants");
    await expect(page).toHaveURL(/\/plants/, { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/login/);
    expect(await isAuthenticated(page)).toBeTruthy();
  });

  test("should successfully log out user", async ({ page }) => {
    const user = generateTestUser();

    // Sign up
    await signUpUser(page, user);

    // Verify authenticated
    let authenticated = await isAuthenticated(page);
    expect(authenticated).toBeTruthy();

    // Logout
    await logoutUser(page);

    // Should be redirected to login or home
    await expect(page).toHaveURL(/\/(login|$)/);

    // Should not be authenticated
    authenticated = await isAuthenticated(page);
    expect(authenticated).toBeFalsy();
  });

  test("should validate email format on signup", async ({ page }) => {
    await page.goto("/signup");

    // Try invalid email
    await page.fill('input[name="email"]', "invalid-email");
    await page.fill('input[name="password"]', "Password123!");
    await page.fill('input[name="confirmPassword"]', "Password123!");
    await page.click('button[type="submit"]');

    // Should see validation error
    await expect(
      page.locator("text=/invalid email|valid email address/i")
    ).toBeVisible({
      timeout: 3000,
    });
  });

  test("should validate password confirmation matches", async ({ page }) => {
    await page.goto("/signup");

    const user = generateTestUser();

    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', "Password123!");
    await page.fill('input[name="confirmPassword"]', "DifferentPassword123!");
    await page.click('button[type="submit"]');

    // Should see validation error
    await expect(
      page.locator("text=/passwords must match|passwords do not match/i")
    ).toBeVisible({ timeout: 3000 });
  });

  test("should redirect to login when accessing protected route while not authenticated", async ({
    page,
  }) => {
    // Try to access dashboard without being logged in
    await page.goto("/dashboard");

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
