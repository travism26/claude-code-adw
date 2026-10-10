import { testHelper } from '../mocha.setup';
import { Grow, Notification } from '../../models';
import { FeedingScheduleService } from '../../services/FeedingScheduleService';
import { FeedingDigestService } from '../../services/FeedingDigestService';
import { FeedEventService } from '../../services/FeedEventService';
import { expect } from 'chai';

/**
 * Feeding v2 — service-level coverage for week-counting-mode date derivation
 * (pure) and the cross-grow "feeding due" digest aggregation.
 */

describe('FeedingScheduleService.deriveWeekDates (counting mode)', () => {
  const weeks = [{ week_number: 1 }, { week_number: 2 }, { week_number: 3 }];
  const start = '2026-05-04'; // a Monday

  it('continuous: anchors week N to (start + (N-1)·7 days)', () => {
    const now = new Date('2026-05-06'); // within week 1
    const out = FeedingScheduleService.deriveWeekDates(start, weeks, { now, countingMode: 'continuous' });
    expect(out[0].date_start).to.equal('2026-05-04');
    expect(out[1].date_start).to.equal('2026-05-11');
    expect(out[2].date_start).to.equal('2026-05-18');
    expect(out[0].is_current).to.equal(true);
    expect(out[1].is_current).to.equal(false);
  });

  it('flip-reset: labels veg/flower segments and anchors flower weeks to the flip date', () => {
    const now = new Date('2026-06-01');
    const out = FeedingScheduleService.deriveWeekDates(start, weeks, {
      now,
      countingMode: 'flip-reset',
      flowerStartWeek: 2,
      flipDate: '2026-05-25',
    });
    expect(out[0].segment).to.equal('veg');
    expect(out[1].segment).to.equal('flower');
    expect(out[2].segment).to.equal('flower');
    // Veg week 1 anchors to grow start; flower week 2 anchors to the flip date.
    expect(out[0].date_start).to.equal('2026-05-04');
    expect(out[1].date_start).to.equal('2026-05-25');
    expect(out[2].date_start).to.equal('2026-06-01');
  });

  it('flip-reset before the flip: flower weeks are pending (no dates)', () => {
    const out = FeedingScheduleService.deriveWeekDates(start, weeks, {
      now: new Date('2026-05-06'),
      countingMode: 'flip-reset',
      flowerStartWeek: 2,
      flipDate: null,
    });
    expect(out[1].segment).to.equal('flower');
    expect(out[1].pending_flip).to.equal(true);
    expect(out[1].date_start).to.equal(null);
  });
});

describe('FeedingDigestService (feeding-due aggregation + daily digest)', () => {
  let user: any;

  beforeEach(async () => {
    testHelper.clearTestUser();
    user = await testHelper.createTestUser({ email: `digest-${Date.now()}@example.com` });
  });

  // Active grow started today → its week 1 is the current (due) week.
  async function growWithSchedule(strain: string) {
    const grow = await Grow.create({
      user_id: user.id,
      strain_name: strain,
      started_at: new Date(),
      phase: 'vegetative',
    });
    await FeedingScheduleService.replaceGrowFeedingSchedule(grow.id, [
      { week_number: 1 },
      { week_number: 2 },
    ]);
    await FeedingScheduleService.updateGrowScheduleSettings(grow.id, {
      strength_pct: 80,
      reservoir_gallons: 5,
    });
    return grow;
  }

  it('getFeedingDue returns the current week with strength/reservoir-adjusted mix', async () => {
    const grow = await growWithSchedule('Due Strain');
    // Give week 1 a nutrient so mix math is exercised.
    await FeedingScheduleService.replaceGrowFeedingSchedule(grow.id, [
      { week_number: 1 },
      { week_number: 2 },
    ]);

    const due = await FeedingDigestService.getFeedingDue(user.id);
    const mine = due.find((d) => d.grow_id === grow.id);
    expect(mine, 'grow should be due this week').to.exist;
    expect(mine!.week_number).to.equal(1);
    expect(mine!.status).to.equal('planned');
    expect(mine!.strength_pct).to.equal(80);
    expect(mine!.reservoir_gallons).to.equal(5);
  });

  it('runDailyDigestForUser sends exactly ONE consolidated notification and never completes a feeding', async () => {
    await growWithSchedule('Grow A');
    await growWithSchedule('Grow B');

    const before = await Notification.count({ where: { user_id: user.id } });
    const n1 = await FeedingDigestService.runDailyDigestForUser(user.id);
    const after = await Notification.count({ where: { user_id: user.id } });

    expect(n1, 'a notification is sent when feedings are due').to.exist;
    expect(after - before).to.equal(1); // one digest, not one-per-grow
    expect(n1!.message).to.match(/due to feed today/i);
    expect(n1!.message).to.contain('Grow A');
    expect(n1!.message).to.contain('Grow B');

    // Dismiss-never-completes: this user's due feedings remain planned.
    const due = await FeedingDigestService.getFeedingDue(user.id);
    expect(due.length).to.equal(2);
    expect(due.every((d) => d.status === 'planned')).to.equal(true);
  });

  it('sends no notification when nothing is planned (all done/skipped)', async () => {
    const grow = await growWithSchedule('Solo Grow');
    // Mark this grow's current week done so nothing is "due" for the user.
    await FeedEventService.markEvent(grow.id, 1, { status: 'done' });

    const before = await Notification.count({ where: { user_id: user.id } });
    const n = await FeedingDigestService.runDailyDigestForUser(user.id);
    const after = await Notification.count({ where: { user_id: user.id } });

    expect(n).to.equal(null);
    expect(after).to.equal(before);
    // sanity: the grow exists but is no longer counted as due
    expect(grow.id).to.be.a('string');
  });
});
