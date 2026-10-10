import { test, expect, Page } from '@playwright/test';
import { loginUser } from './fixtures/test-helpers';
import { getApiUrl } from './config';

/** Reliably set a datetime-local / date input so react-hook-form picks it up.
 *  Playwright's .fill() on datetime-local doesn't always fire the change event RHF needs. */
async function setDateInput(page: Page, testId: string, value: string) {
  await page.getByTestId(testId).evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )!.set!;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function authToken(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === 'accessToken')?.value ?? '';
}

/** First nutrient id from the seeded catalog. */
async function firstNutrientId(page: Page): Promise<string> {
  const res = await page.context().request.get(getApiUrl('nutrients'), {
    headers: { Authorization: `Bearer ${await authToken(page)}` },
  });
  const json = await res.json();
  return json.nutrients[0].id;
}

/** Create a 2-week feeding template via API; returns the template. */
async function createTemplate(page: Page, name: string, nutrientId: string) {
  const res = await page.context().request.post(getApiUrl('feeding-schedule-templates'), {
    data: {
      name,
      weeks: [
        { week_number: 1, nutrients: [{ nutrient_id: nutrientId, dosage_ml_per_gallon: 2 }] },
        { week_number: 2, nutrients: [{ nutrient_id: nutrientId, dosage_ml_per_gallon: 2.5 }] },
      ],
    },
    headers: { Authorization: `Bearer ${await authToken(page)}` },
  });
  if (!res.ok()) throw new Error(`createTemplate failed: ${res.status()} ${await res.text()}`);
  return (await res.json()).template;
}

/** Create a grow via API (post-login) and return it, for a stable id. */
async function createGrow(page: Page, strainName: string, startedAt = '2026-05-15') {
  const cookies = await page.context().cookies();
  const token = cookies.find((c) => c.name === 'accessToken')?.value;
  const res = await page.context().request.post(getApiUrl('grows'), {
    data: { strain_name: strainName, plant_count: 1, started_at: startedAt },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) throw new Error(`createGrow failed: ${res.status()} ${await res.text()}`);
  return res.json();
}

/** Apply a template to a grow via API (skips the apply UI in setup-heavy tests). */
async function applyTemplate(page: Page, growId: string, templateId: string) {
  const res = await page.context().request.post(
    getApiUrl(`grows/${growId}/feeding-schedule/apply`),
    { data: { template_id: templateId }, headers: { Authorization: `Bearer ${await authToken(page)}` } }
  );
  if (!res.ok()) throw new Error(`applyTemplate failed: ${res.status()} ${await res.text()}`);
  return res.json();
}

/**
 * E2E tests for the cannabis "Grows" area.
 *
 * Account: dev@example.com / password (local seed user - create it in your dev database before running; the backend has no seed script for it).
 *
 * NOTE: `grows new form shows seeded nutrients` is intentionally written to
 * fail against the current backend (BUG-005: GET /api/nutrients returns a bare
 * array but the frontend expects { nutrients: [...] }). It should pass once the
 * response shape is fixed.
 */

const EMAIL = 'dev@example.com';
const PASSWORD = 'password';

test.describe('Grows (cannabis) area', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, EMAIL, PASSWORD);
  });

  test('grows list renders existing grows', async ({ page }) => {
    await page.goto('/grows');

    await expect(page.getByRole('heading', { name: 'My Grows' })).toBeVisible();
    // Seeded dev data has at least one grow.
    await expect(page.getByTestId('grow-card').first()).toBeVisible({ timeout: 15000 });
  });

  test('new grow form shows seeded nutrients (BUG-005)', async ({ page }) => {
    await page.goto('/grows/new');

    // The nutrient picker section should load.
    await expect(page.getByRole('heading', { name: 'Available Nutrients' })).toBeVisible();

    // With 48 seeded nutrients and default filters, at least one nutrient card
    // must render. Currently fails because the API returns a bare array.
    await expect(page.locator('[data-testid^="nutrient-card-"]').first()).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByText('No nutrients found matching your filters.')
    ).toBeHidden();
  });

  test('shows a validation error when a required field is empty (BUG-009)', async ({ page }) => {
    await page.goto('/grows/new');

    // Fill strain name but leave the required Start Date empty.
    await page.getByTestId('strain-name-input').fill('No Date Strain');
    await page.getByTestId('submit-button').click();

    // Must NOT navigate away...
    await expect(page).toHaveURL(/\/grows\/new$/);
    // ...and must tell the user why (currently fails silently).
    await expect(page.getByText('Start date is required')).toBeVisible({ timeout: 5000 });
  });

  test('can add a log entry to a grow', async ({ page }) => {
    const grow = await createGrow(page, `Log Test ${Date.now()}`);
    await page.goto(`/grows/${grow.id}/log`);

    await setDateInput(page, 'log-date-input', '2026-05-20T10:00');
    await page.getByTestId('log-notes-input').fill('Looking healthy, lots of new growth.');
    await page.getByRole('button', { name: 'Save Log Entry' }).click();

    // Redirects back to the grow detail; the new entry should be visible.
    await page.waitForURL(`**/grows/${grow.id}`, { timeout: 20000 });
    await expect(page.getByText('Looking healthy, lots of new growth.')).toBeVisible({
      timeout: 15000,
    });
  });

  test('log form shows a validation error when date is missing', async ({ page }) => {
    const grow = await createGrow(page, `Log Validation ${Date.now()}`);
    await page.goto(`/grows/${grow.id}/log`);

    // Leave the required Date & Time empty.
    await page.getByTestId('log-notes-input').fill('note without a date');
    await page.getByRole('button', { name: 'Save Log Entry' }).click();

    await expect(page).toHaveURL(new RegExp(`/grows/${grow.id}/log$`));
    await expect(page.getByText('Date and time are required')).toBeVisible({ timeout: 5000 });
  });

  test('can create a new grow', async ({ page }) => {
    const strain = `E2E Strain ${Date.now()}`;

    await page.goto('/grows/new');

    await page.getByTestId('strain-name-input').fill(strain);
    await page.getByTestId('strain-type-select').selectOption({ label: 'Hybrid' });
    await page.getByTestId('grow-method-select').selectOption({ label: 'Soil' });
    await page.getByTestId('plant-count-input').fill('2');
    // Start Date is required by the form schema.
    await page.getByTestId('started-at-input').fill('2026-05-15');

    await page.getByTestId('submit-button').click();

    // The new-grow page redirects to /grows on success.
    await page.waitForURL('**/grows', { timeout: 20000 });
    await expect(page.getByText(strain)).toBeVisible({ timeout: 15000 });
  });

  test('feeding: apply a template and render the weekly grid mapped to dates', async ({ page }) => {
    const nutrientId = await firstNutrientId(page);
    const tplName = `E2E Feed ${Date.now()}`;
    await createTemplate(page, tplName, nutrientId);
    const grow = await createGrow(page, `Feed Grow ${Date.now()}`); // started_at 2026-05-15

    await page.goto(`/grows/${grow.id}`);
    await page.getByTestId('feeding-tab').click();

    // Empty state → apply the template.
    await expect(page.getByTestId('feeding-empty')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('apply-template-select').selectOption({ label: `${tplName} (2 wks)` });
    await page.getByTestId('apply-template-btn').click();

    // Grid renders both weeks; week 1 maps to the grow's start week.
    await expect(page.getByTestId('feeding-week-1')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('feeding-week-2')).toBeVisible();
    await expect(page.getByTestId('feeding-week-1')).toContainText('2026-05-15');
  });

  test('feeding: author a template via the manager UI', async ({ page }) => {
    const name = `UI Template ${Date.now()}`;
    await page.goto('/grows/feeding-templates');
    await page.getByTestId('new-template-btn').click();
    await page.getByTestId('template-name-input').fill(name);
    // Editor starts with Week 1 — add a nutrient + dosage.
    await page.getByTestId('add-nutrient-1').click();
    await page.getByTestId('nutrient-select-1').selectOption({ index: 1 });
    await page.getByTestId('dosage-input-1').fill('2');
    await page.getByTestId('save-schedule-btn').click();
    // Returns to the list with the new template visible.
    await expect(page.getByText(name)).toBeVisible({ timeout: 15000 });
  });

  test('feeding: build a per-grow schedule from scratch', async ({ page }) => {
    const grow = await createGrow(page, `Build Grow ${Date.now()}`);
    await page.goto(`/grows/${grow.id}`);
    await page.getByTestId('feeding-tab').click();
    await expect(page.getByTestId('feeding-empty')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('build-schedule-btn').click();
    await page.getByTestId('add-nutrient-1').click();
    await page.getByTestId('nutrient-select-1').selectOption({ index: 1 });
    await page.getByTestId('dosage-input-1').fill('1.5');
    await page.getByTestId('save-schedule-btn').click();

    await expect(page.getByTestId('feeding-week-1')).toBeVisible({ timeout: 15000 });
  });

  test('feeding: strength multiplier and reservoir adjust displayed doses', async ({ page }) => {
    const nutrientId = await firstNutrientId(page);
    const tplName = `Strength Tpl ${Date.now()}`;
    await createTemplate(page, tplName, nutrientId); // week 1 = 2 ml/gal
    const grow = await createGrow(page, `Strength Grow ${Date.now()}`);

    await page.goto(`/grows/${grow.id}`);
    await page.getByTestId('feeding-tab').click();
    await page.getByTestId('apply-template-select').selectOption({ label: `${tplName} (2 wks)` });
    await page.getByTestId('apply-template-btn').click();

    const week1 = page.getByTestId('feeding-week-1');
    await expect(week1).toBeVisible({ timeout: 15000 });
    // Default strength is 75% → 2 ml/gal baseline shows as 1.5 ml/gal.
    await expect(week1.getByTestId('nutrient-dose')).toContainText('1.5 ml/gal');

    // Reservoir 4 gal → mix 1.5 × 4 = 6 ml.
    await page.getByTestId('reservoir-input').fill('4');
    await page.getByTestId('reservoir-input').blur();
    await expect(week1.getByTestId('mix-amount')).toContainText('mix 6 ml');

    // Strength 100% → dose back to 2 ml/gal.
    await page.getByTestId('strength-input').fill('100');
    await page.getByTestId('strength-input').blur();
    await expect(week1.getByTestId('nutrient-dose')).toContainText('2 ml/gal');
  });

  test('feeding: flip-reset labels veg vs flower weeks', async ({ page }) => {
    const nutrientId = await firstNutrientId(page);
    const tplName = `Flip Tpl ${Date.now()}`;
    await createTemplate(page, tplName, nutrientId); // 2 weeks
    const grow = await createGrow(page, `Flip Grow ${Date.now()}`);

    await page.goto(`/grows/${grow.id}`);
    await page.getByTestId('feeding-tab').click();
    await page.getByTestId('apply-template-select').selectOption({ label: `${tplName} (2 wks)` });
    await page.getByTestId('apply-template-btn').click();
    await expect(page.getByTestId('feeding-week-1')).toBeVisible({ timeout: 15000 });

    // Switch to flip-reset counting with flowering starting at week 2.
    await page.getByTestId('counting-mode-select').selectOption('flip-reset');
    await page.getByTestId('flower-start-input').fill('2');
    await page.getByTestId('flower-start-input').blur();

    await expect(
      page.getByTestId('feeding-week-1').getByTestId('week-segment')
    ).toContainText('Veg', { timeout: 15000 });
    await expect(
      page.getByTestId('feeding-week-2').getByTestId('week-segment')
    ).toContainText('Flower');
  });

  test('feeding: per-week pH target shows in grid + unit toggle converts dose', async ({ page }) => {
    const grow = await createGrow(page, `Targets Grow ${Date.now()}`);
    await page.goto(`/grows/${grow.id}`);
    await page.getByTestId('feeding-tab').click();
    await page.getByTestId('build-schedule-btn').click();

    await page.getByTestId('add-nutrient-1').click();
    await page.getByTestId('nutrient-select-1').selectOption({ index: 1 });
    await page.getByTestId('dosage-input-1').fill('4');
    await page.getByTestId('ph-min-1').fill('5.8');
    await page.getByTestId('ph-max-1').fill('6.2');
    await page.getByTestId('save-schedule-btn').click();

    // Grid shows the pH target range.
    await expect(
      page.getByTestId('feeding-week-1').getByTestId('week-targets')
    ).toContainText('pH 5.8', { timeout: 15000 });

    // Switching the display unit re-labels the dose.
    await page.getByTestId('display-unit-select').selectOption('ml/L');
    await expect(
      page.getByTestId('feeding-week-1').getByTestId('nutrient-dose')
    ).toContainText('ml/L');
  });

  test('harvest: record a harvest and see efficiency metrics', async ({ page }) => {
    const grow = await createGrow(page, `Harvest Grow ${Date.now()}`);
    await page.goto(`/grows/${grow.id}`);
    await page.getByTestId('harvest-tab').click();

    await expect(page.getByTestId('harvest-panel-empty')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('record-harvest-btn').click();

    await page.getByTestId('harvest-date-input').fill('2026-05-20');
    await page.getByTestId('wet-weight-input').fill('1000');
    await page.getByTestId('dry-weight-input').fill('250');
    await page.getByTestId('quality-rating-input').fill('4');
    await page.getByTestId('save-harvest-btn').click();

    // Panel shows the recorded harvest + derived drying efficiency (250/1000 = 25%).
    await expect(page.getByTestId('harvest-panel')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('dry-weight')).toContainText('250g');
    await expect(page.getByTestId('efficiency-metrics')).toContainText('25%');
  });

  test('feeding: clone a seeded system template into an editable copy', async ({ page }) => {
    await page.goto('/grows/feeding-templates');
    // Seeded system templates show a System badge + Clone button.
    await expect(page.getByTestId('system-badge').first()).toBeVisible({ timeout: 15000 });
    await page.locator('[data-testid^="clone-template-"]').first().click();
    // An editable "(copy)" appears in the user's templates.
    await expect(page.getByText(/\(copy\)/).first()).toBeVisible({ timeout: 15000 });
  });

  test('feeding: mark a flush week and see the badge', async ({ page }) => {
    const grow = await createGrow(page, `Flush Grow ${Date.now()}`);
    await page.goto(`/grows/${grow.id}`);
    await page.getByTestId('feeding-tab').click();
    await page.getByTestId('build-schedule-btn').click();

    await page.getByTestId('flush-toggle-1').check();
    await page.getByTestId('save-schedule-btn').click();

    await expect(
      page.getByTestId('feeding-week-1').getByTestId('flush-badge')
    ).toBeVisible({ timeout: 15000 });
  });

  test('feed event: mark a week done and see it logged in the timeline', async ({ page }) => {
    const nutrientId = await firstNutrientId(page);
    const tplName = `Feed Done Tpl ${Date.now()}`;
    await createTemplate(page, tplName, nutrientId);
    const grow = await createGrow(page, `Feed Done Grow ${Date.now()}`);

    await page.goto(`/grows/${grow.id}`);
    await page.getByTestId('feeding-tab').click();
    await page.getByTestId('apply-template-select').selectOption({ label: `${tplName} (2 wks)` });
    await page.getByTestId('apply-template-btn').click();
    await expect(page.getByTestId('feeding-week-1')).toBeVisible({ timeout: 15000 });

    // A fresh week is planned; mark it done.
    await expect(page.getByTestId('feed-event-status-1')).toContainText('Planned');
    await page.getByTestId('mark-done-1').click();
    await expect(page.getByTestId('feed-event-status-1')).toContainText('Done', { timeout: 15000 });

    // The done feeding is logged exactly once in the grow timeline.
    await page.getByTestId('timeline-tab').click();
    await expect(page.getByTestId('grow-timeline')).toContainText('feeding week 1', { timeout: 15000 });
  });

  test('feed event: skip a week without a false missed feeding', async ({ page }) => {
    const nutrientId = await firstNutrientId(page);
    const tplName = `Feed Skip Tpl ${Date.now()}`;
    await createTemplate(page, tplName, nutrientId);
    const grow = await createGrow(page, `Feed Skip Grow ${Date.now()}`);

    await page.goto(`/grows/${grow.id}`);
    await page.getByTestId('feeding-tab').click();
    await page.getByTestId('apply-template-select').selectOption({ label: `${tplName} (2 wks)` });
    await page.getByTestId('apply-template-btn').click();
    await expect(page.getByTestId('feeding-week-1')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('mark-skip-1').click();
    await expect(page.getByTestId('feed-event-status-1')).toContainText('Skipped', { timeout: 15000 });
    // Skipped week stays visible (not hidden) and writes NO timeline entry.
    await expect(page.getByTestId('feeding-week-1')).toBeVisible();
    await page.getByTestId('timeline-tab').click();
    await expect(page.getByTestId('grow-timeline-empty')).toBeVisible({ timeout: 15000 });
  });

  test('feed event: back-date a feeding with measured readings', async ({ page }) => {
    const nutrientId = await firstNutrientId(page);
    const tplName = `Feed Backdate Tpl ${Date.now()}`;
    await createTemplate(page, tplName, nutrientId);
    const grow = await createGrow(page, `Feed Backdate Grow ${Date.now()}`);

    await page.goto(`/grows/${grow.id}`);
    await page.getByTestId('feeding-tab').click();
    await page.getByTestId('apply-template-select').selectOption({ label: `${tplName} (2 wks)` });
    await page.getByTestId('apply-template-btn').click();
    await expect(page.getByTestId('feeding-week-1')).toBeVisible({ timeout: 15000 });

    await page.getByTestId('toggle-readings-1').click();
    await setDateInput(page, 'performed-at-1', '2026-05-18');
    await page.getByTestId('measured-ec-1').fill('1.8');
    await page.getByTestId('measured-ph-1').fill('6.1');
    await page.getByTestId('save-readings-1').click();

    // Saving a reading marks the week done and records the back-dated performed-at.
    await expect(page.getByTestId('feed-event-status-1')).toContainText('Done', { timeout: 15000 });
    await expect(page.getByTestId('feed-event-date-1')).toContainText('2026-05-18');
  });

  test("today view: lists a due feeding with mix amount and one-tap done", async ({ page }) => {
    const nutrientId = await firstNutrientId(page);
    const tplName = `Today Tpl ${Date.now()}`;
    const tpl = await createTemplate(page, tplName, nutrientId); // 2 weeks, 2 ml/gal wk1
    // Grow started TODAY → its week 1 is the current (due) week.
    const today = new Date().toISOString().slice(0, 10);
    const grow = await createGrow(page, `Today Grow ${Date.now()}`, today);
    await applyTemplate(page, grow.id, tpl.id);

    await page.goto('/grows/feeding-today');

    const card = page.getByTestId(`due-grow-${grow.id}`);
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card.getByTestId(`due-status-${grow.id}`)).toContainText('Due');
    // 2 ml/gal at default 75% strength → 1.5 ml/gal shown.
    await expect(card.getByTestId('due-dose').first()).toContainText('1.5 ml/gal');

    // One-tap done — item stays visible, now marked Done.
    await card.getByTestId(`due-done-${grow.id}`).click();
    await expect(card.getByTestId(`due-status-${grow.id}`)).toContainText('Done', { timeout: 15000 });
    await expect(card).toBeVisible();
  });

  test('can transition a grow to the next phase', async ({ page }) => {
    const grow = await createGrow(page, `Phase Test ${Date.now()}`); // starts in germination
    await page.goto(`/grows/${grow.id}`);

    await page.getByRole('button', { name: 'Transition to next phase' }).click();
    await page.getByTestId('phase-select').getByRole('button', { name: 'Vegetative' }).click();
    await page.getByTestId('confirm-transition-btn').click();

    // Header reflects the new phase.
    await expect(page.getByText('Vegetative')).toBeVisible({ timeout: 15000 });
  });
});
