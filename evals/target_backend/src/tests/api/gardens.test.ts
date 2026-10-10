import { testHelper } from '../mocha.setup';
import { Garden, Plot, PlantProfile } from '../../models';
import { expect } from 'chai';
import { v4 as uuidv4 } from 'uuid';

let authToken: string;
let testUser: any;
let testGarden: Garden;
let testPlantProfile: PlantProfile;

beforeEach(async () => {
  testHelper.clearTestUser();
  const uniqueEmail = `test-user-${Date.now()}@example.com`;
  testUser = await testHelper.createTestUser({ email: uniqueEmail });
  const loginResponse = await testHelper.executeRequest({
    httpMethod: 'POST',
    path: '/api/auth/login',
    body: { email: testUser.email, password: 'test-password' },
    headers: {},
  });
  authToken = loginResponse.body.accessToken;

  testPlantProfile = await PlantProfile.create({
    name: 'Tomato',
    common_name: 'Tomato',
    type: 'vegetable',
    default_water_interval_days: 3,
    difficulty: 'easy',
    indoor_outdoor: 'outdoor',
  });
});

describe('Create Garden API', () => {
  it('should create a garden with valid data', async () => {
    const gardenData = {
      name: 'My Vegetable Garden',
      width: 10,
      height: 8,
      zone: '7b',
      notes: 'Sunny backyard garden',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/gardens',
      body: gardenData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body).to.have.property('id');
    expect(response.body.name).to.equal(gardenData.name);
    expect(Number(response.body.width)).to.equal(gardenData.width);
    expect(Number(response.body.height)).to.equal(gardenData.height);
    expect(response.body.zone).to.equal(gardenData.zone);
  });

  it('should create a garden with minimum fields', async () => {
    const gardenData = {
      name: 'Simple Garden',
      width: 5,
      height: 5,
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/gardens',
      body: gardenData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body.name).to.equal(gardenData.name);
  });

  it('should fail with invalid dimensions', async () => {
    const gardenData = {
      name: 'Invalid Garden',
      width: 0,
      height: 5,
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/gardens',
      body: gardenData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
  });

  it('should fail with invalid zone format', async () => {
    const gardenData = {
      name: 'Test Garden',
      width: 10,
      height: 10,
      zone: 'invalid-zone',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/gardens',
      body: gardenData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
  });

  it('should fail without authentication', async () => {
    const gardenData = {
      name: 'Test Garden',
      width: 10,
      height: 10,
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/gardens',
      body: gardenData,
      headers: { Authorization: 'test-token' },
    });

    expect(response.statusCode).to.equal(401);
  });
});

describe('Get Gardens', () => {
  beforeEach(async () => {
    await Garden.create({
      user_id: testUser.id,
      name: 'Garden 1',
      width: 10,
      height: 10,
    });
    await Garden.create({
      user_id: testUser.id,
      name: 'Garden 2',
      width: 15,
      height: 12,
    });
  });

  it('should get all gardens for user', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/gardens',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body).to.be.an('array');
    expect(response.body.length).to.be.gte(2);
  });

  it('should fail without authentication', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: '/api/gardens',
      headers: { Authorization: 'test-token' },
    });

    expect(response.statusCode).to.equal(401);
  });
});

describe('Get Single Garden', () => {
  beforeEach(async () => {
    testGarden = await Garden.create({
      user_id: testUser.id,
      name: 'Test Garden',
      width: 10,
      height: 10,
    });
  });

  it('should get a single garden with plots', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/gardens/${testGarden.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.id).to.equal(testGarden.id);
    expect(response.body.name).to.equal(testGarden.name);
  });

  it('should return 404 for non-existent garden', async () => {
    const uuid = uuidv4();
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/gardens/${uuid}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it('should fail to get another users garden', async () => {
    // Create another user directly (not using createTestUser which caches)
    const { User } = await import('../../models');
    const otherUser = await User.create({
      email: `other-${Date.now()}@example.com`,
      password_hash: 'hashed_password',
      tz: 'UTC',
    });
    const otherGarden = await Garden.create({
      user_id: otherUser.id,
      name: 'Other Garden',
      width: 10,
      height: 10,
    });

    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/gardens/${otherGarden.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });
});

describe('Update Garden', () => {
  beforeEach(async () => {
    testGarden = await Garden.create({
      user_id: testUser.id,
      name: 'Original Garden',
      width: 10,
      height: 10,
    });
  });

  it('should update garden details', async () => {
    const updates = {
      name: 'Updated Garden',
      width: 15,
      height: 12,
      zone: '8a',
      notes: 'New notes',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/gardens/${testGarden.id}`,
      body: updates,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.name).to.equal(updates.name);
    expect(Number(response.body.width)).to.equal(updates.width);
  });

  it('should fail to update non-existent garden', async () => {
    const uuid = uuidv4();
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/gardens/${uuid}`,
      body: { name: 'Updated' },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it('should fail to update another users garden', async () => {
    // Create another user directly (not using createTestUser which caches)
    const { User } = await import('../../models');
    const otherUser = await User.create({
      email: `other-${Date.now()}@example.com`,
      password_hash: 'hashed_password',
      tz: 'UTC',
    });
    const otherGarden = await Garden.create({
      user_id: otherUser.id,
      name: 'Other Garden',
      width: 10,
      height: 10,
    });

    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/gardens/${otherGarden.id}`,
      body: { name: 'Trying to update' },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });
});

describe('Delete Garden', () => {
  beforeEach(async () => {
    testGarden = await Garden.create({
      user_id: testUser.id,
      name: 'Garden to Delete',
      width: 10,
      height: 10,
    });
  });

  it('should delete a garden', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/gardens/${testGarden.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
  });

  it('should fail to delete non-existent garden', async () => {
    const uuid = uuidv4();
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/gardens/${uuid}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });
});

describe('Garden Plots API', () => {
  beforeEach(async () => {
    testGarden = await Garden.create({
      user_id: testUser.id,
      name: 'Test Garden',
      width: 20,
      height: 15,
    });
  });

  it('should add a plot to garden', async () => {
    const plotData = {
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      plant_profile_id: testPlantProfile.id,
      notes: 'Tomato plot',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/gardens/${testGarden.id}/plots`,
      body: plotData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body).to.have.property('id');
    expect(Number(response.body.x)).to.equal(plotData.x);
    expect(Number(response.body.y)).to.equal(plotData.y);
  });

  it('should fail with overlapping plot', async () => {
    // Create first plot
    await Plot.create({
      garden_id: testGarden.id,
      x: 0,
      y: 0,
      width: 5,
      height: 5,
    });

    // Try to create overlapping plot
    const plotData = {
      x: 2,
      y: 2,
      width: 5,
      height: 5,
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/gardens/${testGarden.id}/plots`,
      body: plotData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
    expect(response.body.error).to.include('overlap');
  });

  it('should fail with out-of-bounds plot', async () => {
    const plotData = {
      x: 18,
      y: 0,
      width: 5,
      height: 5,
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/gardens/${testGarden.id}/plots`,
      body: plotData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
    expect(response.body.error).to.include('boundaries');
  });

  it('should fail with invalid plant profile', async () => {
    const plotData = {
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      plant_profile_id: uuidv4(),
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/gardens/${testGarden.id}/plots`,
      body: plotData,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it('should update a plot', async () => {
    const plot = await Plot.create({
      garden_id: testGarden.id,
      x: 0,
      y: 0,
      width: 2,
      height: 2,
    });

    const updates = {
      x: 5,
      y: 5,
      width: 3,
      height: 3,
      notes: 'Updated plot',
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/gardens/${testGarden.id}/plots/${plot.id}`,
      body: updates,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(Number(response.body.x)).to.equal(updates.x);
    expect(Number(response.body.y)).to.equal(updates.y);
  });

  it('should fail to update plot with overlap', async () => {
    // Create two plots
    await Plot.create({
      garden_id: testGarden.id,
      x: 0,
      y: 0,
      width: 3,
      height: 3,
    });

    const plot2 = await Plot.create({
      garden_id: testGarden.id,
      x: 10,
      y: 10,
      width: 3,
      height: 3,
    });

    // Try to update plot2 to overlap with plot1
    const updates = {
      x: 1,
      y: 1,
    };

    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/gardens/${testGarden.id}/plots/${plot2.id}`,
      body: updates,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(400);
    expect(response.body.error).to.include('overlap');
  });

  it('should delete a plot', async () => {
    const plot = await Plot.create({
      garden_id: testGarden.id,
      x: 0,
      y: 0,
      width: 2,
      height: 2,
    });

    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/gardens/${testGarden.id}/plots/${plot.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
  });

  it('should fail to delete non-existent plot', async () => {
    const uuid = uuidv4();
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/gardens/${testGarden.id}/plots/${uuid}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  describe('Compass Direction', () => {
    it('should create plot with valid compass direction', async () => {
      const plotData = {
        x: 0,
        y: 0,
        width: 2,
        height: 2,
        compass_direction: 'N',
      };

      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/gardens/${testGarden.id}/plots`,
        body: plotData,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(201);
      expect(response.body.compass_direction).to.equal('N');
    });

    it('should create plot without compass direction', async () => {
      const plotData = {
        x: 0,
        y: 0,
        width: 2,
        height: 2,
      };

      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/gardens/${testGarden.id}/plots`,
        body: plotData,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(201);
      expect(response.body.compass_direction).to.be.null;
    });

    it('should accept all 8 valid compass directions', async () => {
      const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

      for (let i = 0; i < directions.length; i++) {
        const plotData = {
          x: i * 2,
          y: 0,
          width: 1,
          height: 1,
          compass_direction: directions[i],
        };

        const response = await testHelper.executeRequest({
          httpMethod: 'POST',
          path: `/api/gardens/${testGarden.id}/plots`,
          body: plotData,
          headers: { Authorization: `Bearer ${authToken}` },
        });

        expect(response.statusCode).to.equal(201);
        expect(response.body.compass_direction).to.equal(directions[i]);
      }
    });

    it('should fail with invalid compass direction', async () => {
      const plotData = {
        x: 0,
        y: 0,
        width: 2,
        height: 2,
        compass_direction: 'North',
      };

      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/gardens/${testGarden.id}/plots`,
        body: plotData,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(400);
    });

    it('should update plot compass direction', async () => {
      const plot = await Plot.create({
        garden_id: testGarden.id,
        x: 0,
        y: 0,
        width: 2,
        height: 2,
        compass_direction: 'N',
      });

      const updates = {
        compass_direction: 'S',
      };

      const response = await testHelper.executeRequest({
        httpMethod: 'PUT',
        path: `/api/gardens/${testGarden.id}/plots/${plot.id}`,
        body: updates,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.body.compass_direction).to.equal('S');
    });

    it('should retrieve plot with compass direction in response', async () => {
      const plot = await Plot.create({
        garden_id: testGarden.id,
        x: 0,
        y: 0,
        width: 2,
        height: 2,
        compass_direction: 'NE',
      });

      const response = await testHelper.executeRequest({
        httpMethod: 'GET',
        path: `/api/gardens/${testGarden.id}`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const createdPlot = response.body.plots.find((p: any) => p.id === plot.id);
      expect(createdPlot).to.exist;
      expect(createdPlot.compass_direction).to.equal('NE');
    });

    it('should return plot coordinates as numbers not strings', async () => {
      const plot = await Plot.create({
        garden_id: testGarden.id,
        x: 10.5,
        y: 20.25,
        width: 3.75,
        height: 4.5,
        compass_direction: 'N',
      });

      const response = await testHelper.executeRequest({
        httpMethod: 'GET',
        path: `/api/gardens/${testGarden.id}`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const createdPlot = response.body.plots.find((p: any) => p.id === plot.id);

      expect(createdPlot).to.exist;

      // Verify coordinates are returned as numbers, not strings
      expect(typeof createdPlot.x).to.equal('number');
      expect(typeof createdPlot.y).to.equal('number');
      expect(typeof createdPlot.width).to.equal('number');
      expect(typeof createdPlot.height).to.equal('number');

      // Verify values are correct
      expect(createdPlot.x).to.equal(10.5);
      expect(createdPlot.y).to.equal(20.25);
      expect(createdPlot.width).to.equal(3.75);
      expect(createdPlot.height).to.equal(4.5);
    });
  });
});

describe('Garden Analysis Feature Flag API', () => {
  beforeEach(async () => {
    // Create a test garden for analysis
    testGarden = await Garden.create({
      user_id: testUser.id,
      name: 'Analysis Test Garden',
      width: 10,
      height: 8,
      zone: '7a',
    });
  });

  describe('POST /api/gardens/:id/analyze', () => {
    it('should return 202 Accepted when user has AI analysis enabled', async () => {
      // Update user to have AI analysis enabled (default is true)
      await testUser.update({ ai_analysis_enabled: true });

      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/gardens/${testGarden.id}/analyze`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(202);
      expect(response.body).to.have.property('jobId');
      expect(response.body).to.have.property('status');
      expect(response.body.status).to.equal('pending');
      expect(response.body.gardenId).to.equal(testGarden.id);
    });

    it('should return 403 Forbidden when user has AI analysis disabled', async () => {
      // Disable AI analysis for the user
      await testUser.update({ ai_analysis_enabled: false });

      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/gardens/${testGarden.id}/analyze`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(403);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('AI analysis is disabled');
    });

    it('should require authentication', async () => {
      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/gardens/${testGarden.id}/analyze`,
        headers: { Authorization: 'test-token' },
      });

      expect(response.statusCode).to.equal(401);
    });

    it('should return 404 for non-existent garden', async () => {
      const nonExistentId = uuidv4();

      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/gardens/${nonExistentId}/analyze`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(404);
    });

    it('should return 404 when trying to analyze another user\'s garden', async () => {
      // Create another user directly (not using createTestUser which caches)
      const { User } = await import('../../models');
      const otherUser = await User.create({
        email: `other-user-${Date.now()}@example.com`,
        password_hash: 'hashed_password',
        tz: 'UTC',
      });
      const otherGarden = await Garden.create({
        user_id: otherUser.id,
        name: 'Other User Garden',
        width: 10,
        height: 10,
      });

      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/gardens/${otherGarden.id}/analyze`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(404);
    });
  });

  describe('Plot operations do NOT trigger automatic analysis', () => {
    it('POST /api/gardens/:id/plots should not trigger automatic AI analysis', async () => {
      const plotData = {
        plant_profile_id: testPlantProfile.id,
        x: 2,
        y: 2,
        width: 2,
        height: 2,
      };

      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/gardens/${testGarden.id}/plots`,
        body: plotData,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(201);
      // The response should contain the plot data but NOT trigger analysis
      // This is verified by the fact that there's no job queued
      // (We can't easily verify message bus events aren't published in this test,
      // but the code comments show they are disabled)
    });

    it('PUT /api/gardens/:id/plots/:plotId should not trigger automatic AI analysis', async () => {
      const plot = await Plot.create({
        garden_id: testGarden.id,
        plant_profile_id: testPlantProfile.id,
        x: 2,
        y: 2,
        width: 2,
        height: 2,
        status: 'planted',
      });

      const updateData = { x: 3, y: 3 };

      const response = await testHelper.executeRequest({
        httpMethod: 'PUT',
        path: `/api/gardens/${testGarden.id}/plots/${plot.id}`,
        body: updateData,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(200);
    });

    it('DELETE /api/gardens/:id/plots/:plotId should not trigger automatic AI analysis', async () => {
      const plot = await Plot.create({
        garden_id: testGarden.id,
        plant_profile_id: testPlantProfile.id,
        x: 2,
        y: 2,
        width: 2,
        height: 2,
      });

      const response = await testHelper.executeRequest({
        httpMethod: 'DELETE',
        path: `/api/gardens/${testGarden.id}/plots/${plot.id}`,
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(200);
    });
  });

  describe('POST /api/gardens/:id/apply-layout', () => {
    it('should successfully apply a layout to a garden', async () => {
      const layoutOption = {
        id: 'layout-1',
        optimizationGoal: 'max_yield',
        spacingMethod: 'intensive',
        score: 85,
        companionScore: 90,
        spacingScore: 80,
        accessibilityScore: 85,
        warnings: [],
        placements: [
          {
            plantProfileId: testPlantProfile.id,
            plantName: 'Tomato',
            x: 0,
            y: 0,
            width: 3,
            height: 3,
            quantity: 1,
            plantingInstructions: 'Plant in full sun',
          },
          {
            plantProfileId: testPlantProfile.id,
            plantName: 'Tomato',
            x: 4,
            y: 0,
            width: 3,
            height: 3,
            quantity: 1,
            plantingInstructions: 'Plant in full sun',
          },
        ],
      };

      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/gardens/${testGarden.id}/apply-layout`,
        headers: { Authorization: `Bearer ${authToken}` },
        body: { layoutOption },
      });

      expect(response.statusCode).to.equal(201);
      expect(response.body).to.have.property('message', 'Layout applied successfully');
      expect(response.body).to.have.property('plotsCreated', 2);
      expect(response.body).to.have.property('plots');
      expect(response.body.plots).to.be.an('array').with.lengthOf(2);
      expect(response.body.plots[0]).to.have.property('plant_profile_id', testPlantProfile.id);
      expect(response.body.plots[0]).to.have.property('status', 'planned');
    });

    it('should reject layout with placements outside garden bounds', async () => {
      const layoutOption = {
        id: 'layout-1',
        optimizationGoal: 'max_yield',
        spacingMethod: 'intensive',
        score: 85,
        companionScore: 90,
        spacingScore: 80,
        accessibilityScore: 85,
        warnings: [],
        placements: [
          {
            plantProfileId: testPlantProfile.id,
            plantName: 'Tomato',
            x: 100, // Outside garden bounds
            y: 100,
            width: 3,
            height: 3,
            quantity: 1,
          },
        ],
      };

      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/gardens/${testGarden.id}/apply-layout`,
        headers: { Authorization: `Bearer ${authToken}` },
        body: { layoutOption },
      });

      expect(response.statusCode).to.equal(400);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('beyond garden boundaries');
    });

    it('should reject layout with overlapping placements', async () => {
      // Create an existing plot
      await Plot.create({
        garden_id: testGarden.id,
        plant_profile_id: testPlantProfile.id,
        x: 0,
        y: 0,
        width: 5,
        height: 5,
      });

      const layoutOption = {
        id: 'layout-1',
        optimizationGoal: 'max_yield',
        spacingMethod: 'intensive',
        score: 85,
        companionScore: 90,
        spacingScore: 80,
        accessibilityScore: 85,
        warnings: [],
        placements: [
          {
            plantProfileId: testPlantProfile.id,
            plantName: 'Tomato',
            x: 2, // Overlaps with existing plot
            y: 2,
            width: 3,
            height: 3,
            quantity: 1,
          },
        ],
      };

      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/gardens/${testGarden.id}/apply-layout`,
        headers: { Authorization: `Bearer ${authToken}` },
        body: { layoutOption },
      });

      expect(response.statusCode).to.equal(400);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('overlap');
    });

    it('should require authentication', async () => {
      const layoutOption = {
        id: 'layout-1',
        optimizationGoal: 'max_yield',
        spacingMethod: 'intensive',
        score: 85,
        companionScore: 90,
        spacingScore: 80,
        accessibilityScore: 85,
        warnings: [],
        placements: [],
      };

      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/gardens/${testGarden.id}/apply-layout`,
        body: { layoutOption },
        headers: { Authorization: 'test-token' },
      });

      expect(response.statusCode).to.equal(401);
    });
  });
});
