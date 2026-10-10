/**
 * MR02 held-out frontend oracle — "days in current phase" badge.
 *
 * This spec is NOT part of the vendored frontend target. run_multirepo_eval.py
 * copies it into the graded worktree's e2e/ directory at grade time, runs it
 * against a `next start` server (FRONTEND_PORT) with the backend API STUBBED,
 * then removes it. The agent never sees it — it is a behavioral oracle, not a
 * contract the agent can over-fit to. The contract the agent builds to lives in
 * the ticket text (data-testid="grow-phase-age", text "Day N").
 *
 * Decoupled: no live backend, no DB. We mint a fake (unsigned) JWT cookie — the
 * frontend's decodeJwt only base64-decodes the payload, and every /api call is
 * fulfilled from a fixture — and assert the grow detail page renders a phase-age
 * badge computed from phase_started_at.
 */
import { test, expect } from "@playwright/test";

const GROW_ID = "11111111-1111-4111-8111-111111111111";

// Fixed ~30 days into the vegetative phase so the badge shows a positive integer.
// We assert the /Day N/ shape, not an exact N, so this stays stable across days.
const PHASE_STARTED_AT = "2026-01-01T00:00:00.000Z";

function fakeJwt(): string {
  const b64url = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  const header = b64url({ alg: "none", typ: "JWT" });
  const payload = b64url({
    id: "22222222-2222-4222-8222-222222222222",
    email: "eval@adw.local",
    exp: 4102444800, // year 2100
  });
  return `${header}.${payload}.sig`;
}

const GROW_FIXTURE = {
  id: GROW_ID,
  user_id: "22222222-2222-4222-8222-222222222222",
  strain_name: "Eval OG",
  strain_type: "hybrid",
  grow_method: "soil",
  grow_medium: "soil",
  light_type: "led",
  light_wattage: 300,
  grow_space_sqft: 4,
  pot_size_gallons: 5,
  plant_count: 2,
  phase: "vegetative",
  phase_started_at: PHASE_STARTED_AT,
  started_at: PHASE_STARTED_AT,
  harvested_at: null,
  notes: "eval fixture",
  environment_id: null,
  is_public: false,
  created_at: PHASE_STARTED_AT,
  updated_at: PHASE_STARTED_AT,
};

test("grow detail shows days-in-current-phase badge", async ({ page, context }) => {
  // 1. Authenticate the frontend (no backend involved — token is never verified).
  await context.addCookies([
    { name: "accessToken", value: fakeJwt(), url: "http://localhost" },
  ]);

  // 2. Stub the API. Broad catch-all first (returns empty), specific grow last so
  //    it wins (Playwright prefers the most-recently-registered matching route).
  await page.route("**/api/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
  await page.route("**/api/grows/**", async (route) => {
    const url = route.request().url();
    // Sub-resources (logs, nutrients, harvest, ...) -> empty; the grow itself -> fixture.
    const isDetail = new RegExp(`/grows/${GROW_ID}(?:\\?.*)?$`).test(url);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(isDetail ? GROW_FIXTURE : []),
    });
  });

  // 3. Visit the grow detail page and assert the phase-age badge.
  await page.goto(`/grows/${GROW_ID}`, { waitUntil: "domcontentloaded" });

  const badge = page.getByTestId("grow-phase-age");
  await expect(badge).toBeVisible({ timeout: 30000 });
  await expect(badge).toHaveText(/day\s*\d+/i);
});
