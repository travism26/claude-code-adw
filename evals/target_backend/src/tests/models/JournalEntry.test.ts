import { JournalEntry, Plant } from '../../models';
import { describe, it } from 'mocha';
import { testHelper } from '../mocha.setup';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('JournalEntry Model', () => {
  let testPlant: Plant;

  describe('Creation', () => {
    before(async () => {
      await testHelper.createTestUser();
      testPlant = await testHelper.createTestPlant();
    });

    it('should create a journal entry with required fields', async () => {
      const entryData = {
        plant_id: testPlant.id,
        note: 'Test journal entry',
      };

      const entry = await JournalEntry.create(entryData);

      expect(entry).to.exist;
      expect(entry.plant_id).to.equal(testPlant.id);
      expect(entry.note).to.equal(entryData.note);
      expect(entry.entry_ts).to.exist;
    });

    it('should create a journal entry with all fields', async () => {
      const now = new Date();
      const entryData = {
        plant_id: testPlant.id,
        note: 'Test journal entry',
        photo_url: 'https://example.com/photo.jpg',
        entry_ts: now,
      };

      const entry = await JournalEntry.create(entryData);

      expect(entry).to.exist;
      expect(entry.plant_id).to.equal(testPlant.id);
      expect(entry.note).to.equal(entryData.note);
      expect(entry.photo_url).to.equal(entryData.photo_url);
      expect(entry.entry_ts.getTime()).to.equal(now.getTime());
    });
  });

  describe('Validation', () => {
    it('should require a plant ID', async () => {
      const entryData = {
        note: 'Test journal entry',
      };

      await expect(JournalEntry.create(entryData)).rejected;
    });

    it('should validate note length', async () => {
      const entryData = {
        plant_id: testPlant.id,
        note: 'a'.repeat(1001), // Exceeds 1000 character limit
      };

      await expect(JournalEntry.create(entryData)).rejected;
    });

    it('should validate photo URL format if provided', async () => {
      const entryData = {
        plant_id: testPlant.id,
        note: 'Test journal entry',
        photo_url: 'invalid-url',
      };

      await expect(JournalEntry.create(entryData)).rejected;
    });

    it('should not create entry for non-existent plant', async () => {
      const entryData = {
        plant_id: '00000000-0000-0000-0000-000000000000',
        note: 'Test journal entry',
      };

      await expect(JournalEntry.create(entryData)).rejected;
    });
  });

  describe('Associations', () => {
    it('should associate with a plant', async () => {
      const entry = await JournalEntry.create({
        plant_id: testPlant.id,
        note: 'Test journal entry',
      });

      const entryWithPlant = await JournalEntry.findOne({
        where: { id: entry.id },
        include: [{ model: Plant, as: 'plant' }],
      });

      expect(entryWithPlant).to.exist;
      expect(entryWithPlant?.plant).to.exist;
      expect(entryWithPlant?.plant?.id).to.equal(testPlant.id);
    });
  });

  describe('Timestamps', () => {
    it('should set entry_ts to current time by default', async () => {
      const before = new Date();
      const entry = await JournalEntry.create({
        plant_id: testPlant.id,
        note: 'Test journal entry',
      });
      const after = new Date();

      expect(entry.entry_ts).to.exist;
      expect(entry.entry_ts.getTime()).to.be.greaterThanOrEqual(
        before.getTime()
      );
      expect(entry.entry_ts.getTime()).to.be.lessThanOrEqual(after.getTime());
    });

    it('should allow custom entry_ts', async () => {
      const customDate = new Date('2023-01-01T12:00:00Z');
      const entry = await JournalEntry.create({
        plant_id: testPlant.id,
        note: 'Test journal entry',
        entry_ts: customDate,
      });

      expect(entry.entry_ts.getTime()).to.equal(customDate.getTime());
    });
  });
});
