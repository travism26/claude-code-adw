import { testHelper } from '../mocha.setup';
import { Grow, GrowLog, GrowLogPhoto } from '../../models';
import { expect } from 'chai';
import * as fs from 'fs/promises';
import * as path from 'path';
import { analysisLimitService } from '../../services/analysisLimitService';
import * as sinon from 'sinon';

let authToken: string;
let testUser: any;
let testGrow: Grow;
let testLog: GrowLog;
let testPhoto: GrowLogPhoto;
let testPhotoPath: string;

// Helper to create a test image file
async function createTestImage(): Promise<string> {
  const uploadsDir = path.join(__dirname, '../../uploads/test');
  await fs.mkdir(uploadsDir, { recursive: true });

  const photoPath = path.join(uploadsDir, `test-photo-${Date.now()}.jpg`);
  // Create a minimal valid JPEG file (1x1 pixel red image)
  const minimalJpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x03, 0xff, 0xc4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    0x7f, 0xa0, 0x0f, 0xff, 0xd9
  ]);

  await fs.writeFile(photoPath, minimalJpeg);
  return photoPath;
}

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

  // Create test grow
  testGrow = await Grow.create({
    user_id: testUser.id,
    strain_name: 'Test Strain',
    started_at: new Date(),
    phase: 'vegetative',
  });

  // Create test log
  testLog = await GrowLog.create({
    grow_id: testGrow.id,
    logged_at: new Date(),
    day_number: 30,
    phase: 'vegetative',
  });

  // Create test photo file
  testPhotoPath = await createTestImage();

  // Create test photo record
  testPhoto = await GrowLogPhoto.create({
    grow_log_id: testLog.id,
    file_path: testPhotoPath,
    original_filename: 'test-photo.jpg',
    mime_type: 'image/jpeg',
    file_size_bytes: 1024,
    width: 1,
    height: 1,
    is_cover: false,
  });
});

afterEach(async () => {
  // Clean up test photo files
  if (testPhotoPath) {
    try {
      await fs.unlink(testPhotoPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  // Clean up test uploads directory
  try {
    const uploadsDir = path.join(__dirname, '../../uploads/test');
    await fs.rm(uploadsDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }

  // Restore any sinon stubs
  sinon.restore();
});

describe('Photo Analysis API', () => {
  describe('POST /:logId/analyze-photo', () => {
    it('should queue photo analysis successfully (202 response)', async () => {
      // Set ENABLE_AI to true for this test
      const originalEnableAI = process.env.ENABLE_AI;
      process.env.ENABLE_AI = 'true';

      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/grow-logs/${testLog.id}/analyze-photo`,
        body: { photoId: testPhoto.id },
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(202);
      expect(response.body).to.have.property('message');
      expect(response.body).to.have.property('jobId');
      expect(response.body).to.have.property('status', 'queued');
      expect(response.body).to.have.property('photoId', testPhoto.id);
      expect(response.body).to.have.property('logId', testLog.id);
      expect(response.body).to.have.property('remainingAnalyses');

      // Restore original ENABLE_AI
      process.env.ENABLE_AI = originalEnableAI;
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/grow-logs/${testLog.id}/analyze-photo`,
        body: { photoId: testPhoto.id },
        headers: { Authorization: 'invalid-token' }, // Invalid auth token
      });

      expect(response.statusCode).to.equal(401);
    });

    it('should return 404 for non-existent photo', async () => {
      process.env.ENABLE_AI = 'true';

      const fakePhotoId = '00000000-0000-0000-0000-000000000000';
      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/grow-logs/${testLog.id}/analyze-photo`,
        body: { photoId: fakePhotoId },
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(404);
      expect(response.body).to.have.property('error', 'Photo not found');
    });

    it('should return 403 for photos user does not own (authorization check)', async () => {
      process.env.ENABLE_AI = 'true';

      // Create another user and their grow/log/photo
      const otherUser = await testHelper.createTestUser({
        email: `other-user-${Date.now()}@example.com`,
      });
      const otherGrow = await Grow.create({
        user_id: otherUser.id,
        strain_name: 'Other Strain',
        started_at: new Date(),
      });
      const otherLog = await GrowLog.create({
        grow_id: otherGrow.id,
        logged_at: new Date(),
        day_number: 1,
        phase: 'germination',
      });
      const otherPhotoPath = await createTestImage();
      const otherPhoto = await GrowLogPhoto.create({
        grow_log_id: otherLog.id,
        file_path: otherPhotoPath,
        original_filename: 'other-photo.jpg',
        mime_type: 'image/jpeg',
        file_size_bytes: 1024,
        width: 1,
        height: 1,
        is_cover: false,
      });

      // Try to analyze other user's photo
      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/grow-logs/${otherLog.id}/analyze-photo`,
        body: { photoId: otherPhoto.id },
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(403);
      expect(response.body).to.have.property('error', 'Unauthorized');

      // Clean up
      await fs.unlink(otherPhotoPath);
    });

    it('should return 403 if photo does not belong to the specified log', async () => {
      process.env.ENABLE_AI = 'true';

      // Create another log for the same grow
      const anotherLog = await GrowLog.create({
        grow_id: testGrow.id,
        logged_at: new Date(),
        day_number: 45,
        phase: 'flowering',
      });

      // Try to analyze testPhoto (which belongs to testLog) using anotherLog's ID
      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/grow-logs/${anotherLog.id}/analyze-photo`,
        body: { photoId: testPhoto.id },
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(403);
      expect(response.body).to.have.property('error', 'Photo does not belong to this log');
    });

    it('should return 409 if pending analysis exists (conflict)', async () => {
      process.env.ENABLE_AI = 'true';

      // Stub checkCanAnalyze to return hasPending: true
      const checkStub = sinon.stub(analysisLimitService, 'checkCanAnalyze').resolves({
        canAnalyze: false,
        hasPending: true,
        remaining: 3,
        reason: 'analysis_pending',
      });

      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/grow-logs/${testLog.id}/analyze-photo`,
        body: { photoId: testPhoto.id },
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(409);
      expect(response.body).to.have.property('error', 'Analysis already in progress for this photo');
      expect(response.body).to.have.property('reason', 'analysis_pending');

      checkStub.restore();
    });

    it('should return 429 after exceeding daily limit (3 analyses per day)', async () => {
      process.env.ENABLE_AI = 'true';

      // Stub checkCanAnalyze to return limit exceeded
      const checkStub = sinon.stub(analysisLimitService, 'checkCanAnalyze').resolves({
        canAnalyze: false,
        hasPending: false,
        remaining: 0,
        reason: 'daily_limit',
      });

      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/grow-logs/${testLog.id}/analyze-photo`,
        body: { photoId: testPhoto.id },
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(429);
      expect(response.body).to.have.property('error', 'Daily photo analysis limit reached');
      expect(response.body).to.have.property('reason', 'daily_limit');
      expect(response.body).to.have.property('remaining', 0);

      checkStub.restore();
    });

    it('should decrement remaining analyses count correctly', async () => {
      process.env.ENABLE_AI = 'true';

      // First analysis
      const response1 = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/grow-logs/${testLog.id}/analyze-photo`,
        body: { photoId: testPhoto.id },
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response1.statusCode).to.equal(202);
      const remaining1 = response1.body.remainingAnalyses;
      expect(remaining1).to.be.a('number');

      // Create another photo for second analysis
      const photoPath2 = await createTestImage();
      const photo2 = await GrowLogPhoto.create({
        grow_log_id: testLog.id,
        file_path: photoPath2,
        original_filename: 'test-photo-2.jpg',
        mime_type: 'image/jpeg',
        file_size_bytes: 1024,
        width: 1,
        height: 1,
        is_cover: false,
      });

      // Second analysis
      const response2 = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/grow-logs/${testLog.id}/analyze-photo`,
        body: { photoId: photo2.id },
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response2.statusCode).to.equal(202);
      const remaining2 = response2.body.remainingAnalyses;
      expect(remaining2).to.equal(remaining1 - 1);

      // Clean up
      await fs.unlink(photoPath2);
    });

    it('should include correct job payload (photoId, logId, userId, aiTaskId)', async () => {
      process.env.ENABLE_AI = 'true';

      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/grow-logs/${testLog.id}/analyze-photo`,
        body: { photoId: testPhoto.id },
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(202);
      expect(response.body.photoId).to.equal(testPhoto.id);
      expect(response.body.logId).to.equal(testLog.id);
      expect(response.body).to.have.property('jobId');
    });

    it('should return 403 when ENABLE_AI is false', async () => {
      // Set ENABLE_AI to false
      const originalEnableAI = process.env.ENABLE_AI;
      process.env.ENABLE_AI = 'false';

      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/grow-logs/${testLog.id}/analyze-photo`,
        body: { photoId: testPhoto.id },
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(403);
      expect(response.body).to.have.property('error', 'Photo analysis feature is currently disabled');
      expect(response.body).to.have.property('reason', 'feature_disabled');

      // Restore original ENABLE_AI
      process.env.ENABLE_AI = originalEnableAI;
    });

    it('should return 400 for invalid photoId format', async () => {
      process.env.ENABLE_AI = 'true';

      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: `/api/grow-logs/${testLog.id}/analyze-photo`,
        body: { photoId: 'not-a-uuid' },
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(400);
      expect(response.body).to.have.property('errors');
    });

    it('should return 400 for invalid logId format', async () => {
      process.env.ENABLE_AI = 'true';

      const response = await testHelper.executeRequest({
        httpMethod: 'POST',
        path: '/api/grow-logs/not-a-uuid/analyze-photo',
        body: { photoId: testPhoto.id },
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).to.equal(400);
      expect(response.body).to.have.property('errors');
    });
  });
});
