import { test, expect } from "@playwright/test";
import {
  generateTestUser,
  signUpUser,
  clearAuthState,
} from "./fixtures/test-helpers";

test.describe("Admin Panel", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a proper page first, then clear authentication state
    await page.goto("/");
    await clearAuthState(page);
  });

  test("should load admin page without authentication", async ({ page }) => {
    // Navigate directly to admin page
    await page.goto("/admin");

    // Should see admin page content - use more specific selectors
    await expect(
      page.getByRole("heading", { name: "GrowBuddy Admin" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Admin Panel" })
    ).toBeVisible();
    await expect(page.getByText("Development & Testing Panel")).toBeVisible();
  });

  test("should display all three tabs", async ({ page }) => {
    await page.goto("/admin");

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Check for all three tabs using role selector
    await expect(page.getByRole("tab", { name: "Users" })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Notifications" })
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Statistics" })).toBeVisible();
  });

  test("should navigate between tabs", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Click on Notifications tab
    await page.getByRole("tab", { name: "Notifications" }).click();
    await expect(
      page.getByRole("heading", { name: "Send Test Notification" })
    ).toBeVisible();

    // Click on Statistics tab
    await page.getByRole("tab", { name: "Statistics" }).click();
    await expect(
      page.getByText("Total Users", { exact: true }).first()
    ).toBeVisible();

    // Click back to Users tab
    await page.getByRole("tab", { name: "Users" }).click();
    await expect(page.getByPlaceholder("Search by email")).toBeVisible();
  });

  test("should navigate back to main app", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Click "Back to App" button
    await page.click("text=Back to App");

    // Should redirect to login (since not authenticated)
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Admin Panel - User Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearAuthState(page);

    // Create some test users for the admin panel to display
    const user1 = generateTestUser();
    await signUpUser(page, user1);
    await clearAuthState(page);
  });

  test("should display user list", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Should be on Users tab by default
    await expect(page.getByText(/Total Users:/)).toBeVisible();

    // Should have a table with user data
    await expect(page.locator("table")).toBeVisible();
  });

  test("should allow searching users by email", async ({ page }) => {
    const user = generateTestUser();
    await signUpUser(page, user);
    await clearAuthState(page);

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Enter search term
    const searchInput = page.getByPlaceholder("Search by email");
    await searchInput.fill(user.email.substring(0, 10));

    // Click search button
    await page.getByRole("button", { name: "Search" }).click();

    // Wait for results
    await page.waitForTimeout(1000);

    // Should display the searched user in the table
    await expect(
      page.getByRole("tabpanel").getByText(user.email).first()
    ).toBeVisible();
  });

  test("should open edit modal when clicking edit button", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Wait for table to load
    await page.waitForSelector("table", { timeout: 5000 });

    // Click first edit button if available
    const editButton = page.locator('button[aria-label="Edit user"]').first();
    if (await editButton.isVisible()) {
      await editButton.click();

      // Modal should be visible
      await expect(page.locator("text=Edit User")).toBeVisible();
      await expect(page.locator('label:has-text("Email")')).toBeVisible();
      await expect(
        page.locator('label:has-text("Growing Zone")')
      ).toBeVisible();
    }
  });

  test("should have pagination controls", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Check for pagination controls
    await expect(page.locator("button:has-text('Previous')")).toBeVisible();
    await expect(page.locator("button:has-text('Next')")).toBeVisible();
    await expect(page.locator("text=/Page \\d+ of \\d+/")).toBeVisible();
  });
});

test.describe("Admin Panel - Notification Testing", () => {
  let testUser: any;

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearAuthState(page);

    // Create a test user
    testUser = generateTestUser();
    await signUpUser(page, testUser);
    await clearAuthState(page);
  });

  test("should display notification form", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Navigate to Notifications tab
    await page.getByRole("tab", { name: "Notifications" }).click();

    // Check form elements
    await expect(
      page.getByRole("heading", { name: "Send Test Notification" })
    ).toBeVisible();
    await expect(page.getByText("Send To")).toBeVisible();
    await expect(page.getByText("Specific User")).toBeVisible();
    await expect(page.getByText("All Users")).toBeVisible();
    await expect(page.getByText("Message", { exact: true })).toBeVisible();
    await expect(page.getByText("Link (Optional)")).toBeVisible();
    await expect(page.getByText("Notification Type")).toBeVisible();
  });

  test("should send notification to specific user", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Navigate to Notifications tab
    await page.getByRole("tab", { name: "Notifications" }).click();

    // "Specific User" is selected by default, just fill in message
    // Fill in message
    const message = "Test notification for E2E test";
    await page.getByPlaceholder("Enter notification message...").fill(message);

    // Send notification
    await page.getByRole("button", { name: "Send Notification" }).click();

    // Should see success toast
    await expect(page.getByText(/Notification sent successfully/i)).toBeVisible(
      {
        timeout: 10000,
      }
    );
  });

  test.skip("should send notification to all users", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Navigate to Notifications tab
    await page.getByRole("tab", { name: "Notifications" }).click();

    // Wait for tab content to load
    await expect(
      page.getByRole("heading", { name: "Send Test Notification" })
    ).toBeVisible();

    // Find the radio button for "all" using Chakra UI data attributes
    // RadioGroup.Item with value="all" should have data-value="all"
    const allUsersRadio = page.locator('[data-part="item"][data-value="all"]');
    await allUsersRadio.click();

    // Wait and verify button text changed
    await expect(
      page.getByRole("button", { name: "Send to All Users" })
    ).toBeVisible({ timeout: 5000 });

    // Fill in message
    const message = "Broadcast test notification";
    await page.getByPlaceholder("Enter notification message...").fill(message);

    // Send notification
    await page.getByRole("button", { name: "Send to All Users" }).click();

    // Should see success toast
    await expect(
      page.getByText(/Notifications sent successfully/i)
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test("should display notification history after sending", async ({
    page,
  }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Navigate to Notifications tab
    await page.getByRole("tab", { name: "Notifications" }).click();

    // Send a notification (specific user is default)
    const message = "History test notification";
    await page.getByPlaceholder("Enter notification message...").fill(message);
    await page.getByRole("button", { name: "Send Notification" }).click();

    // Wait for success
    await page.waitForTimeout(2000);

    // Check history section
    await expect(
      page.getByRole("heading", { name: "Recent Notifications" })
    ).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();
  });

  test("should validate required message field", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Navigate to Notifications tab
    await page.getByRole("tab", { name: "Notifications" }).click();

    // Try to send without message
    await page.getByRole("button", { name: "Send Notification" }).click();

    // Should see warning toast
    await expect(page.getByText(/Message required/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("should support different notification types", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Navigate to Notifications tab
    await page.getByRole("tab", { name: "Notifications" }).click();

    // Check all notification type options are available (they are badges)
    await expect(page.getByText("Info").first()).toBeVisible();
    await expect(page.getByText("Success").first()).toBeVisible();
    await expect(page.getByText("Warning").first()).toBeVisible();
    await expect(page.getByText("Error").first()).toBeVisible();

    // Select Warning type by clicking on its text
    await page.getByText("Warning").first().click();

    // Fill and send
    await page
      .getByPlaceholder("Enter notification message...")
      .fill("Warning notification test");
    await page.getByRole("button", { name: "Send Notification" }).click();

    // Should succeed
    await expect(page.getByText(/Notification sent successfully/i)).toBeVisible(
      {
        timeout: 10000,
      }
    );
  });
});

test.describe("Admin Panel - Statistics", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearAuthState(page);

    // Create a test user
    const user = generateTestUser();
    await signUpUser(page, user);
    await clearAuthState(page);
  });

  test("should display statistics dashboard", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Navigate to Statistics tab
    await page.getByRole("tab", { name: "Statistics" }).click();

    // Check for key statistics
    await expect(
      page.getByText("Total Users", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("Last 7 Days", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("Last 30 Days", { exact: true }).first()
    ).toBeVisible();
    await expect(page.getByText("No Zone Set")).toBeVisible();
  });

  test("should display users by zone section", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Navigate to Statistics tab
    await page.getByRole("tab", { name: "Statistics" }).click();

    // Check for zone breakdown
    await expect(
      page.getByRole("heading", { name: "Users by Growing Zone" })
    ).toBeVisible();
  });

  test("should display growth insights", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Navigate to Statistics tab
    await page.getByRole("tab", { name: "Statistics" }).click();

    // Check for insights section
    await expect(
      page.getByRole("heading", { name: "Growth Insights" })
    ).toBeVisible();
    await expect(page.getByText("User Growth Rate")).toBeVisible();
    await expect(page.getByText("Zone Completion Rate")).toBeVisible();
  });

  test("should have refresh button", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Navigate to Statistics tab
    await page.getByRole("tab", { name: "Statistics" }).click();

    // Check for refresh button
    const refreshButton = page.getByRole("button", { name: "Refresh" });
    await expect(refreshButton).toBeVisible();

    // Click refresh
    await refreshButton.click();

    // Should reload stats (we can verify by checking spinner or content)
    await page.waitForTimeout(1000);
  });
});

test.describe("Admin Panel - Responsive Design", () => {
  test("should be responsive on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Should still display main elements
    await expect(
      page.getByRole("heading", { name: "GrowBuddy Admin" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Admin Panel" })
    ).toBeVisible();

    // Tabs should be visible
    await expect(page.getByRole("tab", { name: "Users" })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Notifications" })
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Statistics" })).toBeVisible();
  });
});
