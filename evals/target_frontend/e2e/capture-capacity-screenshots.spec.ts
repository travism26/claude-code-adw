import { test, expect, chromium, Browser, Page } from '@playwright/test';
import * as path from 'path';
import { generateTestUser, signUpUser } from './fixtures/test-helpers';

/**
 * E2E test to capture screenshots of the capacity warnings feature
 * Run with: npm run test:e2e -- e2e/capture-capacity-screenshots.spec.ts --headed
 */

const REVIEW_IMG_DIR = process.env.REVIEW_IMG_DIR ?? path.join(__dirname, '..', 'review_img');

test.describe('Capacity Warnings Feature Screenshots', () => {
  test('capture capacity warnings screenshots', async ({ page }) => {
    console.log('=== GrowBuddy Capacity Warnings Screenshot Capture ===\n');

    // Generate test user and sign up
    const user = generateTestUser();
    console.log('Signing up test user...');
    await signUpUser(page, user);

    // Wait for dashboard to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Screenshot 1: Environment Manager with capacity indicators
    console.log('\n--- Screenshot 1: Environment Cards with Capacity Indicators ---');

    // Try to navigate to environments page - check multiple possible navigation patterns
    try {
      // First try clicking a navigation link
      const navLinks = [
        'a[href*="environment"]',
        'button:has-text("Environment")',
        'a:has-text("Environment")',
        '[data-testid*="environment"]'
      ];

      let navigated = false;
      for (const selector of navLinks) {
        const link = page.locator(selector).first();
        if (await link.count() > 0 && await link.isVisible()) {
          console.log(`Found navigation element: ${selector}`);
          await link.click();
          await page.waitForLoadState('networkidle');
          navigated = true;
          break;
        }
      }

      if (!navigated) {
        // Try direct navigation to common environment URLs
        const possibleUrls = [
          '/environments',
          '/environment',
          '/grow-environments'
        ];

        for (const url of possibleUrls) {
          try {
            console.log(`Trying to navigate to: ${url}`);
            await page.goto(url, { timeout: 5000 });
            await page.waitForLoadState('networkidle');
            const title = await page.title();
            if (!title.toLowerCase().includes('404') && !title.toLowerCase().includes('not found')) {
              console.log(`Successfully navigated to: ${url}`);
              navigated = true;
              break;
            }
          } catch (e) {
            console.log(`Failed to navigate to: ${url}`);
          }
        }
      }

      if (navigated) {
        await page.waitForTimeout(2000);
        console.log('Taking screenshot of environment cards...');
        await page.screenshot({
          path: path.join(REVIEW_IMG_DIR, '01_environment_cards_capacity_indicators.png'),
          fullPage: true
        });
        console.log('Screenshot 1 saved successfully');
      } else {
        console.log('Could not navigate to environments page - skipping screenshot 1');
      }
    } catch (error) {
      console.error('Error capturing screenshot 1:', error);
    }

    // Screenshot 2: GrowForm - Environment Selector
    console.log('\n--- Screenshot 2: Environment Selector with Capacity ---');

    try {
      // Navigate to create grow page
      const growButtons = [
        'button:has-text("Add Grow")',
        'button:has-text("Create Grow")',
        'a[href*="grow/new"]',
        'a[href*="add-grow"]',
        'a:has-text("Add Grow")',
        'a:has-text("New Grow")'
      ];

      let navigatedToGrow = false;
      for (const selector of growButtons) {
        const button = page.locator(selector).first();
        if (await button.count() > 0 && await button.isVisible()) {
          console.log(`Found grow button: ${selector}`);
          await button.click();
          await page.waitForLoadState('networkidle');
          navigatedToGrow = true;
          break;
        }
      }

      if (!navigatedToGrow) {
        // Try direct navigation
        const possibleGrowUrls = [
          '/grows/new',
          '/add-grow',
          '/grow/new',
          '/grows/create',
          '/create-grow'
        ];

        for (const url of possibleGrowUrls) {
          try {
            console.log(`Trying to navigate to: ${url}`);
            await page.goto(url, { timeout: 5000 });
            await page.waitForLoadState('networkidle');
            const title = await page.title();
            if (!title.toLowerCase().includes('404') && !title.toLowerCase().includes('not found')) {
              console.log(`Successfully navigated to: ${url}`);
              navigatedToGrow = true;
              break;
            }
          } catch (e) {
            console.log(`Failed to navigate to: ${url}`);
          }
        }
      }

      if (navigatedToGrow) {
        await page.waitForTimeout(2000);

        // Look for environment selector and try to open it
        const selectorElements = [
          'select[name*="environment"]',
          'button:has-text("Select Environment")',
          '[data-testid*="environment-select"]',
          '[id*="environment"]',
          'select[id*="environment"]'
        ];

        for (const selector of selectorElements) {
          const element = page.locator(selector).first();
          if (await element.count() > 0 && await element.isVisible()) {
            console.log(`Found environment selector: ${selector}`);
            try {
              await element.click();
              await page.waitForTimeout(1000);
            } catch (e) {
              console.log('Could not click selector (may already be open)');
            }
            break;
          }
        }

        console.log('Taking screenshot of environment selector...');
        await page.screenshot({
          path: path.join(REVIEW_IMG_DIR, '02_environment_selector_capacity.png'),
          fullPage: true
        });
        console.log('Screenshot 2 saved successfully');
      } else {
        console.log('Could not navigate to grow form - skipping screenshot 2');
      }
    } catch (error) {
      console.error('Error capturing screenshot 2:', error);
    }

    // Screenshot 3: Capacity Warning Banner (if visible)
    console.log('\n--- Screenshot 3: Capacity Warning Banner ---');

    try {
      const warningSelectors = [
        '[role="alert"]',
        '.capacity-warning',
        '[data-testid*="capacity-warning"]',
        '[data-testid*="warning"]',
        '.alert:has-text("capacity")',
        'div:has-text("This is a warning only")'
      ];

      let warningFound = false;
      for (const selector of warningSelectors) {
        const warning = page.locator(selector).first();
        if (await warning.count() > 0 && await warning.isVisible()) {
          console.log(`Found warning banner: ${selector}`);
          warningFound = true;
          break;
        }
      }

      if (warningFound) {
        console.log('Taking screenshot of capacity warning banner...');
        await page.screenshot({
          path: path.join(REVIEW_IMG_DIR, '03_capacity_warning_banner.png'),
          fullPage: true
        });
        console.log('Screenshot 3 saved successfully');
      } else {
        console.log('No capacity warning banner found - this is expected if environments are not at capacity');
        console.log('Skipping screenshot 3');
      }
    } catch (error) {
      console.error('Error capturing screenshot 3:', error);
    }

    console.log('\n=== Screenshot capture completed! ===');
    console.log('\nScreenshots saved to:');
    console.log(REVIEW_IMG_DIR + '/');
  });
});
