import { testHelper } from '../mocha.setup';
import { Grow, GrowLog } from '../../models';
import { FeedingScheduleService } from '../../services/FeedingScheduleService';
import { expect } from 'chai';

/**
 * Feeding v2 — route-level coverage for per-week targets/units round-trip and
 * the plan↔log feed-event lifecycle (materialize, done→timeline, skip-not-missed,
 * back-date, reconcile-by-week-number).
 */

let authToken: string;
let testUser: any;
let grow: Grow;

const auth = () => ({ Authorization: `Bearer ${authToken}` });

beforeEach(async () => {
  testHelper.clearTestUser();
  testUser = await testHelper.createTestUser({ email: `feed-${Date.now()}@example.com` });
  const login = await testHelper.executeRequest({
    httpMethod: 'POST',
    path: '/api/auth/login',
    body: { email: testUser.email, password: 'test-password' },
    headers: {},
  });
  authToken = login.body.accessToken;

  grow = await Grow.create({
    user_id: testUser.id,
    strain_name: 'Feeding Strain',
    started_at: new Date(),
  });
});

describe('Feeding schedule — per-week targets + units', () => {
  it('round-trips EC/PPM/pH targets and ppm scale / display unit', async () => {
    await FeedingScheduleService.replaceGrowFeedingSchedule(grow.id, [
      { week_number: 1, ec_min: 1.2, ec_max: 1.8, ppm_min: 600, ppm_max: 900, ph_min: 5.8, ph_max: 6.2 },
      { week_number: 2 },
    ]);
    await FeedingScheduleService.updateGrowScheduleSettings(grow.id, {
      ppm_scale: 700,
      display_unit: 'ml/L',
    });

    const res = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/grows/${grow.id}/feeding-schedule`,
      headers: auth(),
    });

    expect(res.statusCode).to.equal(200);
    const sched = res.body.feedingSchedule;
    expect(sched.ppm_scale).to.equal(700);
    expect(sched.display_unit).to.equal('ml/L');
    const wk1 = sched.weeks.find((w: any) => w.week_number === 1);
    // DECIMAL targets come back as numbers, not strings.
    expect(wk1.ec_min).to.equal(1.2);
    expect(wk1.ec_max).to.equal(1.8);
    expect(wk1.ppm_min).to.equal(600);
    expect(wk1.ph_min).to.equal(5.8);
    expect(wk1.ph_max).to.equal(6.2);
  });

  it('rejects ph targets outside 0–14', async () => {
    await FeedingScheduleService.replaceGrowFeedingSchedule(grow.id, [{ week_number: 1 }]);
    const res = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grows/${grow.id}/feeding-schedule`,
      headers: auth(),
      body: { weeks: [{ week_number: 1, ph_min: 99 }] },
    });
    expect(res.statusCode).to.equal(400);
  });
});

describe('Feed events — materialize + plan↔log', () => {
  beforeEach(async () => {
    await FeedingScheduleService.replaceGrowFeedingSchedule(grow.id, [
      { week_number: 1 },
      { week_number: 2, is_water_only: true },
    ]);
  });

  it('materializes one planned event per schedule week', async () => {
    const res = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/grows/${grow.id}/feed-events`,
      headers: auth(),
    });
    expect(res.statusCode).to.equal(200);
    expect(res.body.feedEvents).to.have.length(2);
    expect(res.body.feedEvents.every((e: any) => e.status === 'planned')).to.equal(true);
  });

  it('marks a week done, logs it once in the timeline, and stores measured readings', async () => {
    const res = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grows/${grow.id}/feed-events/1`,
      headers: auth(),
      body: { status: 'done', measured_ec: 1.8, measured_ph: 6.1 },
    });
    expect(res.statusCode).to.equal(200);
    expect(res.body.feedEvent.status).to.equal('done');
    expect(res.body.feedEvent.grow_log_id).to.be.a('string');
    expect(res.body.feedEvent.measured_ec).to.equal(1.8);

    const logs = await GrowLog.findAll({ where: { grow_id: grow.id } });
    expect(logs).to.have.length(1);
    expect(logs[0].notes).to.match(/feeding week 1/i);

    // Re-marking done updates the same log — no double-logging.
    await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grows/${grow.id}/feed-events/1`,
      headers: auth(),
      body: { status: 'done', measured_ph: 6.3 },
    });
    expect(await GrowLog.count({ where: { grow_id: grow.id } })).to.equal(1);
  });

  it('skips a week without creating a timeline log (not a missed feeding)', async () => {
    const res = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grows/${grow.id}/feed-events/2`,
      headers: auth(),
      body: { status: 'skipped' },
    });
    expect(res.statusCode).to.equal(200);
    expect(res.body.feedEvent.status).to.equal('skipped');
    expect(res.body.feedEvent.grow_log_id).to.equal(null);
    expect(await GrowLog.count({ where: { grow_id: grow.id } })).to.equal(0);
  });

  it('back-dates a feeding and removes the timeline log when un-done', async () => {
    const done = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grows/${grow.id}/feed-events/1`,
      headers: auth(),
      body: { status: 'done', performed_at: '2026-05-18' },
    });
    expect(done.statusCode).to.equal(200);
    expect(new Date(done.body.feedEvent.performed_at).toISOString().slice(0, 10)).to.equal(
      '2026-05-18'
    );
    expect(await GrowLog.count({ where: { grow_id: grow.id } })).to.equal(1);

    // Back to planned → timeline entry is removed.
    await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grows/${grow.id}/feed-events/1`,
      headers: auth(),
      body: { status: 'planned' },
    });
    expect(await GrowLog.count({ where: { grow_id: grow.id } })).to.equal(0);
  });

  it('preserves event status by week_number across a schedule edit', async () => {
    // Mark week 1 done, then rewrite the schedule (which rebuilds week rows).
    await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grows/${grow.id}/feed-events/1`,
      headers: auth(),
      body: { status: 'done' },
    });
    await FeedingScheduleService.replaceGrowFeedingSchedule(grow.id, [
      { week_number: 1, notes: 'edited' },
      { week_number: 2 },
      { week_number: 3 },
    ]);

    const res = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/grows/${grow.id}/feed-events`,
      headers: auth(),
    });
    const wk1 = res.body.feedEvents.find((e: any) => e.week_number === 1);
    expect(wk1.status).to.equal('done'); // status survived the rebuild
    expect(res.body.feedEvents).to.have.length(3); // new week materialized
  });
});
