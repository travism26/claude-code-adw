import { Nutrient, User, Grow } from '../../models';
import { describe, it, before } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  FeedingScheduleService,
  FeedingScheduleConflictError,
} from '../../services/FeedingScheduleService';
import { GrowService } from '../../services/GrowService';
use(chaiAsPromised);

describe('FeedingScheduleService', () => {
  let user: User;
  let other: User;
  let nutA: Nutrient;
  let nutB: Nutrient;
  let grow: Grow;

  before(async () => {
    user = await testHelper.createTestUser();
    other = await testHelper.createTestUser();
    nutA = await Nutrient.create({
      user_id: user.id,
      brand: 'BrandX',
      product_name: 'Base A',
      type: 'base',
    } as any);
    nutB = await Nutrient.create({
      user_id: user.id,
      brand: 'BrandX',
      product_name: 'Bloom Booster',
      type: 'supplement',
    } as any);
    grow = await GrowService.create(user.id, {
      strain_name: 'Test Strain',
      started_at: new Date('2026-05-01'),
      plant_count: 1,
    } as any);
  });

  it('creates a template with weeks and nutrients', async () => {
    const tpl = await FeedingScheduleService.createTemplate(user.id, {
      name: 'Synthetic Bloom',
      weeks: [
        { week_number: 1, nutrients: [{ nutrient_id: nutA.id, dosage_ml_per_gallon: 2 }] },
        {
          week_number: 2,
          nutrients: [
            { nutrient_id: nutA.id, dosage_ml_per_gallon: 2 },
            { nutrient_id: nutB.id, dosage_ml_per_gallon: 1 },
          ],
        },
      ],
    });
    expect(tpl.weeks).to.have.length(2);
    const w2 = tpl.weeks!.find((w) => w.week_number === 2)!;
    expect(w2.weekNutrients).to.have.length(2);
  });

  it("lists only the owner's templates", async () => {
    const mine = await FeedingScheduleService.listTemplates(user.id);
    const theirs = await FeedingScheduleService.listTemplates(other.id);
    expect(mine.length).to.be.greaterThan(0);
    expect(theirs.length).to.equal(0);
  });

  it('applies a template to a grow as an independent copy', async () => {
    const tpl = (await FeedingScheduleService.listTemplates(user.id))[0];
    const sched = await FeedingScheduleService.applyTemplateToGrow(grow.id, user.id, tpl.id, false);
    expect(sched).to.exist;
    expect(sched!.weeks).to.have.length(2);
    expect(sched!.source_template_id).to.equal(tpl.id);
  });

  it('rejects applying twice without overwrite', async () => {
    const tpl = (await FeedingScheduleService.listTemplates(user.id))[0];
    await expect(
      FeedingScheduleService.applyTemplateToGrow(grow.id, user.id, tpl.id, false)
    ).to.be.rejectedWith(FeedingScheduleConflictError);
  });

  it('editing the grow schedule does not change the template', async () => {
    await FeedingScheduleService.replaceGrowFeedingSchedule(grow.id, [
      { week_number: 1, nutrients: [{ nutrient_id: nutB.id, dosage_ml_per_gallon: 5 }] },
    ]);
    const sched = await FeedingScheduleService.getGrowFeedingSchedule(grow.id);
    expect(sched!.weeks).to.have.length(1);
    const tpl = (await FeedingScheduleService.listTemplates(user.id))[0];
    expect(tpl.weeks).to.have.length(2); // template still has its 2 weeks
  });

  it('derives week date ranges and current-week flag from grow start', () => {
    const out = FeedingScheduleService.deriveWeekDates(
      '2026-05-01',
      [{ week_number: 1 }, { week_number: 2 }],
      { now: new Date('2026-05-03') }
    );
    expect(out[0].date_start).to.equal('2026-05-01');
    expect(out[0].date_end).to.equal('2026-05-07');
    expect(out[0].is_current).to.equal(true);
    expect(out[1].date_start).to.equal('2026-05-08');
    expect(out[1].is_current).to.equal(false);
  });

  it('flip-reset anchors flower weeks to the flip date, veg weeks to the start', () => {
    // started 2026-05-01; flower starts at week 4; flip (flower wk1) on 2026-06-15
    const out = FeedingScheduleService.deriveWeekDates(
      '2026-05-01',
      [{ week_number: 1 }, { week_number: 4 }, { week_number: 5 }],
      {
        now: new Date('2026-05-03'),
        countingMode: 'flip-reset',
        flowerStartWeek: 4,
        flipDate: '2026-06-15',
      }
    );
    // Veg week 1 still anchored to start.
    expect(out[0].segment).to.equal('veg');
    expect(out[0].date_start).to.equal('2026-05-01');
    // Flower week 4 is the first flower week → anchored to the flip date.
    expect(out[1].segment).to.equal('flower');
    expect(out[1].date_start).to.equal('2026-06-15');
    // Flower week 5 → one week after the flip.
    expect(out[2].date_start).to.equal('2026-06-22');
  });

  it('flip-reset marks flower weeks pending when not yet flipped', () => {
    const out = FeedingScheduleService.deriveWeekDates(
      '2026-05-01',
      [{ week_number: 5 }],
      { countingMode: 'flip-reset', flowerStartWeek: 4, flipDate: null }
    );
    expect(out[0].segment).to.equal('flower');
    expect(out[0].date_start).to.equal(null);
    expect(out[0].pending_flip).to.equal(true);
  });
});
