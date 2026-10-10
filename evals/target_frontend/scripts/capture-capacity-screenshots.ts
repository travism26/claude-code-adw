import { chromium, Browser, Page } from '@playwright/test';
import * as path from 'path';

const REVIEW_IMG_DIR = process.env.REVIEW_IMG_DIR ?? path.join(__dirname, '..', 'review_img');

/**
 * Script to capture screenshots of the capacity warnings feature
 * Run with: npx ts-node scripts/capture-capacity-screenshots.ts
 */

interface TestUser {
  email: string;
  password: string;
  timezone?: string;
}

function generateTestUser(): TestUser {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return {
    email: `screenshot-user-${timestamp}-${random}@example.com`,
    password: 'TestPassword123!',
    timezone: 'America/New_York',
  };
}

async function signUpUser(page: Page, user: TestUser): Promise<void> {
  console.log('Navigating to signup page...');
  await page.goto('http://localhost:3001/signup');
  await page.waitForLoadState('networkidle');

  console.log('Filling signup form...');
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.fill('input[name="confirmPassword"]', user.password);

  if (user.timezone) {
    const timezoneSelect = page.locator('select[name="timezone"], #timezone').first();
    await timezoneSelect.selectOption(user.timezone);
  }

  console.log('Submitting signup form...');
  await page.click('button[type="submit"]');

  try {
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    console.log('Successfully signed up and navigated to dashboard');
  } catch (error) {
    throw new Error(`Signup failed: ${page.url()}`);
  }
}

async function takeScreenshot(page: Page, path: string, description: string): Promise<void> {
  console.log(`\nCapturing screenshot: ${description}`);
  console.log(`Path: ${path}`);

  // Wait for network to be idle before taking screenshot
  await page.waitForLoadState('networkidle');

  // Take the screenshot
  await page.screenshot({
    path,
    fullPage: true
  });

  console.log('Screenshot captured successfully');
}

async function main() {
  console.log('=== GrowBuddy Capacity Warnings Screenshot Capture ===\n');

  const browser: Browser = await chromium.launch({
    headless: false, // Set to false so you can see what's happening
    slowMo: 500 // Slow down actions by 500ms for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  try {
    // Generate test user and sign up
    const user = generateTestUser();
    await signUpUser(page, user);

    // Wait a bit for dashboard to fully load
    await page.waitForTimeout(2000);

    // Screenshot 1: Environment Manager with capacity indicators
    console.log('\n--- Screenshot 1: Environment Cards with Capacity Indicators ---');

    // Try to navigate to environments page
    // First, let's check if there's a navigation link
    const environmentsLink = page.locator('a[href*="environment"], button:has-text("Environment")').first();

    if (await environmentsLink.count() > 0) {
      console.log('Found environments link in navigation, clicking...');
      await environmentsLink.click();
      await page.waitForLoadState('networkidle');
    } else {
      // Try direct navigation
      console.log('Attempting direct navigation to /environments...');
      await page.goto('http://localhost:3001/environments');
      await page.waitForLoadState('networkidle');
    }

    // Wait for environment cards to be visible
    await page.waitForTimeout(2000);

    await takeScreenshot(
      page,
      path.join(REVIEW_IMG_DIR, '01_environment_cards_capacity_indicators.png'),
      'Environment Cards with Capacity Indicators'
    );

    // Screenshot 2: GrowForm - Environment Selector
    console.log('\n--- Screenshot 2: Environment Selector with Capacity ---');

    // Navigate to create grow page
    // Try to find "Add Grow" or "Create Grow" button
    const addGrowButton = page.locator('button:has-text("Add Grow"), button:has-text("Create Grow"), a[href*="grow/new"], a[href*="add-grow"]').first();

    if (await addGrowButton.count() > 0) {
      console.log('Found add grow button, clicking...');
      await addGrowButton.click();
      await page.waitForLoadState('networkidle');
    } else {
      // Try direct navigation to common grow form URLs
      console.log('Attempting direct navigation to grow form...');
      const possibleUrls = [
        'http://localhost:3001/grows/new',
        'http://localhost:3001/add-grow',
        'http://localhost:3001/grow/new',
        'http://localhost:3001/grows/create'
      ];

      for (const url of possibleUrls) {
        try {
          await page.goto(url);
          await page.waitForLoadState('networkidle', { timeout: 5000 });
          // Check if we're on a valid page (not 404)
          const title = await page.title();
          if (!title.toLowerCase().includes('404') && !title.toLowerCase().includes('not found')) {
            console.log(`Successfully navigated to: ${url}`);
            break;
          }
        } catch (e) {
          console.log(`Failed to navigate to: ${url}`);
        }
      }
    }

    await page.waitForTimeout(2000);

    // Look for environment selector and click it to open dropdown
    const environmentSelector = page.locator('select[name*="environment"], button:has-text("Select Environment"), [data-testid*="environment-select"]').first();

    if (await environmentSelector.count() > 0) {
      console.log('Found environment selector, clicking to open...');
      await environmentSelector.click();
      await page.waitForTimeout(1000);
    }

    await takeScreenshot(
      page,
      path.join(REVIEW_IMG_DIR, '02_environment_selector_capacity.png'),
      'Environment Selector with Capacity Indicators'
    );

    // Screenshot 3: Capacity Warning Banner (if visible)
    console.log('\n--- Screenshot 3: Capacity Warning Banner ---');

    // Check if warning banner is visible
    const warningBanner = page.locator('[role="alert"], .capacity-warning, [data-testid*="capacity-warning"]').first();

    if (await warningBanner.count() > 0) {
      console.log('Found capacity warning banner');
      await takeScreenshot(
        page,
        path.join(REVIEW_IMG_DIR, '03_capacity_warning_banner.png'),
        'Capacity Warning Banner'
      );
    } else {
      console.log('No capacity warning banner found - this is OK if environments are not at capacity');
      console.log('Skipping screenshot 3');
    }

    console.log('\n=== Screenshot capture completed successfully! ===');
    console.log('\nScreenshots saved to:');
    console.log('- ' + REVIEW_IMG_DIR + '/');

  } catch (error) {
    console.error('\n=== Error during screenshot capture ===');
    console.error(error);
    throw error;
  } finally {
    // Keep browser open for a moment so you can see the final state
    await page.waitForTimeout(2000);
    await browser.close();
  }
}

main().catch(console.error);
