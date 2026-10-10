import { expect } from 'chai';
import { CareHistory } from '../../models/CareHistory';
import { Plant } from '../../models/Plant';
import { User } from '../../models/User';

describe('CareHistory Model', () => {
  let testUser: any;
  let testPlant: any;

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password_hash: 'test-hash',
    });

    // Create test plant
    testPlant = await Plant.create({
      name: 'Test Plant',
      type: 'indoor',
      water_interval_days: 7,
      user_id: testUser.id,
    });
  });

  afterEach(async () => {
    // Clean up test data
    await CareHistory.destroy({ where: { user_id: testUser.id } });
    await Plant.destroy({ where: { user_id: testUser.id } });
    await User.destroy({ where: { id: testUser.id } });
  });

  it('should create care history with valid data', async () => {
    const careHistory = await CareHistory.create({
      plant_id: testPlant.id,
      user_id: testUser.id,
      action_type: 'water',
      notes: 'Watered the plant',
    });

    expect(careHistory).to.exist;
    expect(careHistory.action_type).to.equal('water');
    expect(careHistory.notes).to.equal('Watered the plant');
  });

  it('should require plant_id', async () => {
    try {
      await CareHistory.create({
        user_id: testUser.id,
        action_type: 'water',
      } as any);
      expect.fail('Should have thrown validation error');
    } catch (error: any) {
      expect(error.name).to.equal('SequelizeValidationError');
    }
  });

  it('should require user_id', async () => {
    try {
      await CareHistory.create({
        plant_id: testPlant.id,
        action_type: 'water',
      } as any);
      expect.fail('Should have thrown validation error');
    } catch (error: any) {
      expect(error.name).to.equal('SequelizeValidationError');
    }
  });

  it('should require action_type', async () => {
    try {
      await CareHistory.create({
        plant_id: testPlant.id,
        user_id: testUser.id,
      } as any);
      expect.fail('Should have thrown validation error');
    } catch (error: any) {
      expect(error.name).to.equal('SequelizeValidationError');
    }
  });

  it('should validate action_type values', async () => {
    try {
      await CareHistory.create({
        plant_id: testPlant.id,
        user_id: testUser.id,
        action_type: 'invalid-action',
      } as any);
      expect.fail('Should have thrown validation error');
    } catch (error: any) {
      expect(error.name).to.equal('SequelizeValidationError');
    }
  });

  it('should accept all valid action types', async () => {
    const validActions = ['water', 'fertilize', 'prune', 'harvest', 'transplant', 'pest_control', 'other'];

    for (const action of validActions) {
      const careHistory = await CareHistory.create({
        plant_id: testPlant.id,
        user_id: testUser.id,
        action_type: action,
      });
      expect(careHistory.action_type).to.equal(action);
    }
  });

  it('should set action_date to current date by default', async () => {
    const careHistory = await CareHistory.create({
      plant_id: testPlant.id,
      user_id: testUser.id,
      action_type: 'water',
    });

    expect(careHistory.action_date).to.exist;
    const timeDiff = Math.abs(new Date().getTime() - careHistory.action_date.getTime());
    expect(timeDiff).to.be.lessThan(5000); // Within 5 seconds
  });

  it('should accept custom action_date', async () => {
    const customDate = new Date('2024-01-15');
    const careHistory = await CareHistory.create({
      plant_id: testPlant.id,
      user_id: testUser.id,
      action_type: 'water',
      action_date: customDate,
    });

    expect(careHistory.action_date.toISOString().split('T')[0]).to.equal('2024-01-15');
  });

  it('should have association with Plant', async () => {
    const careHistory = await CareHistory.create({
      plant_id: testPlant.id,
      user_id: testUser.id,
      action_type: 'water',
    });

    const careWithPlant = await CareHistory.findByPk(careHistory.id, {
      include: [{ model: Plant, as: 'plant' }],
    });

    expect(careWithPlant).to.exist;
    expect(careWithPlant!.plant).to.exist;
    expect(careWithPlant!.plant!.name).to.equal('Test Plant');
  });

  it('should have association with User', async () => {
    const careHistory = await CareHistory.create({
      plant_id: testPlant.id,
      user_id: testUser.id,
      action_type: 'water',
    });

    const careWithUser = await CareHistory.findByPk(careHistory.id, {
      include: [{ model: User, as: 'user' }],
    });

    expect(careWithUser).to.exist;
    expect(careWithUser!.user).to.exist;
    expect(careWithUser!.user!.email).to.equal(testUser.email);
  });
});
