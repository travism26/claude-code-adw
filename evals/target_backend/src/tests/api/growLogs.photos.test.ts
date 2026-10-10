import { testHelper } from '../mocha.setup';
import { Grow, GrowLog, GrowLogPhoto } from '../../models';
import { expect } from 'chai';
import fs from 'fs/promises';
import path from 'path';

let authToken: string;
let testUser: any;
let testGrow: Grow;
let testLog: GrowLog;

// Helper to create a test image buffer
function createTestImageBuffer(): Buffer {
  // Create a minimal valid PNG (1x1 pixel transparent)
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);
  return png;
}

// Helper to create a test JPEG buffer
function createTestJpegBuffer(): Buffer {
  // Minimal valid JPEG (1x1 pixel)
  const jpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
    0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c,
    0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d,
    0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34,
    0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4,
    0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x03, 0xff, 0xc4, 0x00, 0x14,
    0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
    0x00, 0x00, 0x3f, 0x00, 0x37, 0xff, 0xd9,
  ]);
  return jpeg;
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

  testGrow = await Grow.create({
    user_id: testUser.id,
    strain_name: 'Test Strain',
    started_at: new Date(),
  });

  testLog = await GrowLog.create({
    grow_id: testGrow.id,
    logged_at: new Date(),
    day_number: 10,
  });
});

describe('Upload Photos to Grow Log', () => {
  it('should upload a single photo', async () => {
    const imageBuffer = createTestImageBuffer();

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/grow-logs/${testLog.id}/photos`,
      headers: { Authorization: `Bearer ${authToken}` },
      files: [
        {
          fieldname: 'photos',
          originalname: 'test-photo.png',
          mimetype: 'image/png',
          buffer: imageBuffer,
        },
      ],
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body).to.be.an('array');
    expect(response.body.length).to.equal(1);
    expect(response.body[0]).to.have.property('id');
    expect(response.body[0]).to.have.property('file_path');
    expect(response.body[0]).to.have.property('thumbnail_path');
    expect(response.body[0].original_filename).to.equal('test-photo.png');
    expect(response.body[0].mime_type).to.equal('image/png');
    expect(response.body[0].grow_log_id).to.equal(testLog.id);
  });

  it('should upload multiple photos', async () => {
    const pngBuffer = createTestImageBuffer();
    const jpegBuffer = createTestJpegBuffer();

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/grow-logs/${testLog.id}/photos`,
      headers: { Authorization: `Bearer ${authToken}` },
      files: [
        {
          fieldname: 'photos',
          originalname: 'photo1.png',
          mimetype: 'image/png',
          buffer: pngBuffer,
        },
        {
          fieldname: 'photos',
          originalname: 'photo2.jpg',
          mimetype: 'image/jpeg',
          buffer: jpegBuffer,
        },
      ],
    });

    expect(response.statusCode).to.equal(201);
    expect(response.body).to.be.an('array');
    expect(response.body.length).to.equal(2);
    expect(response.body[0].original_filename).to.equal('photo1.png');
    expect(response.body[1].original_filename).to.equal('photo2.jpg');
  });

  it('should reject upload with no files', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/grow-logs/${testLog.id}/photos`,
      headers: { Authorization: `Bearer ${authToken}` },
      files: [],
    });

    expect(response.statusCode).to.equal(400);
    expect(response.body.error).to.include('No files uploaded');
  });

  it('should reject upload to non-existent log', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const imageBuffer = createTestImageBuffer();

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/grow-logs/${fakeId}/photos`,
      headers: { Authorization: `Bearer ${authToken}` },
      files: [
        {
          fieldname: 'photos',
          originalname: 'test.png',
          mimetype: 'image/png',
          buffer: imageBuffer,
        },
      ],
    });

    expect(response.statusCode).to.equal(404);
  });

  it('should reject upload to another users log', async () => {
    const anotherUser = await testHelper.createTestUser({ email: `another-${Date.now()}@example.com` });
    const anotherLogin = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/auth/login',
      body: { email: anotherUser.email, password: 'test-password' },
      headers: {},
    });
    const anotherToken = anotherLogin.body.accessToken;

    const imageBuffer = createTestImageBuffer();

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/grow-logs/${testLog.id}/photos`,
      headers: { Authorization: `Bearer ${anotherToken}` },
      files: [
        {
          fieldname: 'photos',
          originalname: 'test.png',
          mimetype: 'image/png',
          buffer: imageBuffer,
        },
      ],
    });

    expect(response.statusCode).to.equal(403);
  });

  it('should store photo files on disk', async () => {
    const imageBuffer = createTestImageBuffer();

    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: `/api/grow-logs/${testLog.id}/photos`,
      headers: { Authorization: `Bearer ${authToken}` },
      files: [
        {
          fieldname: 'photos',
          originalname: 'test.png',
          mimetype: 'image/png',
          buffer: imageBuffer,
        },
      ],
    });

    expect(response.statusCode).to.equal(201);
    const photo = response.body[0];

    // Verify file exists on disk
    const filePath = path.join(process.cwd(), photo.file_path);
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
    expect(fileExists).to.be.true;

    // Verify thumbnail exists
    if (photo.thumbnail_path) {
      const thumbPath = path.join(process.cwd(), photo.thumbnail_path);
      const thumbExists = await fs.access(thumbPath).then(() => true).catch(() => false);
      expect(thumbExists).to.be.true;
    }
  });
});

describe('Get Photos for Grow Log', () => {
  let testPhoto: GrowLogPhoto;

  beforeEach(async () => {
    testPhoto = await GrowLogPhoto.create({
      grow_log_id: testLog.id,
      file_path: 'uploads/grows/test/photo.png',
      thumbnail_path: 'uploads/grows/test/photo_thumb.png',
      original_filename: 'photo.png',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      width: 100,
      height: 100,
      is_cover: false,
    });
  });

  it('should retrieve photos for a log', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/grow-logs/${testLog.id}/photos`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body).to.be.an('array');
    expect(response.body.length).to.equal(1);
    expect(response.body[0].id).to.equal(testPhoto.id);
  });

  it('should return empty array for log without photos', async () => {
    await GrowLogPhoto.destroy({ where: { id: testPhoto.id } });

    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/grow-logs/${testLog.id}/photos`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body).to.be.an('array');
    expect(response.body.length).to.equal(0);
  });

  it('should reject retrieval for another users log', async () => {
    const anotherUser = await testHelper.createTestUser({ email: `another-${Date.now()}@example.com` });
    const anotherLogin = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/auth/login',
      body: { email: anotherUser.email, password: 'test-password' },
      headers: {},
    });
    const anotherToken = anotherLogin.body.accessToken;

    const response = await testHelper.executeRequest({
      httpMethod: 'GET',
      path: `/api/grow-logs/${testLog.id}/photos`,
      headers: { Authorization: `Bearer ${anotherToken}` },
    });

    expect(response.statusCode).to.equal(403);
  });
});

describe('Delete Photo', () => {
  let testPhoto: GrowLogPhoto;

  beforeEach(async () => {
    testPhoto = await GrowLogPhoto.create({
      grow_log_id: testLog.id,
      file_path: 'uploads/grows/test/photo.png',
      thumbnail_path: 'uploads/grows/test/photo_thumb.png',
      original_filename: 'photo.png',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      width: 100,
      height: 100,
      is_cover: false,
    });
  });

  it('should delete a photo', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/grow-logs/photos/${testPhoto.id}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);

    const deletedPhoto = await GrowLogPhoto.findByPk(testPhoto.id);
    expect(deletedPhoto).to.be.null;
  });

  it('should return 404 for non-existent photo', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/grow-logs/photos/${fakeId}`,
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it('should reject deletion by another user', async () => {
    const anotherUser = await testHelper.createTestUser({ email: `another-${Date.now()}@example.com` });
    const anotherLogin = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/auth/login',
      body: { email: anotherUser.email, password: 'test-password' },
      headers: {},
    });
    const anotherToken = anotherLogin.body.accessToken;

    const response = await testHelper.executeRequest({
      httpMethod: 'DELETE',
      path: `/api/grow-logs/photos/${testPhoto.id}`,
      headers: { Authorization: `Bearer ${anotherToken}` },
    });

    expect(response.statusCode).to.equal(403);
  });
});

describe('Set Cover Photo', () => {
  let photo1: GrowLogPhoto;
  let photo2: GrowLogPhoto;

  beforeEach(async () => {
    photo1 = await GrowLogPhoto.create({
      grow_log_id: testLog.id,
      file_path: 'uploads/grows/test/photo1.png',
      original_filename: 'photo1.png',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      is_cover: false,
    });

    photo2 = await GrowLogPhoto.create({
      grow_log_id: testLog.id,
      file_path: 'uploads/grows/test/photo2.png',
      original_filename: 'photo2.png',
      mime_type: 'image/png',
      file_size_bytes: 1024,
      is_cover: false,
    });
  });

  it('should set a photo as cover', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grow-logs/photos/${photo1.id}/cover`,
      body: { grow_log_id: testLog.id },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.is_cover).to.be.true;

    // Verify only one cover photo
    const coverPhotos = await GrowLogPhoto.findAll({
      where: { grow_log_id: testLog.id, is_cover: true },
    });
    expect(coverPhotos.length).to.equal(1);
    expect(coverPhotos[0].id).to.equal(photo1.id);
  });

  it('should move cover to another photo', async () => {
    // Set photo1 as cover
    await photo1.update({ is_cover: true });

    // Set photo2 as cover
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grow-logs/photos/${photo2.id}/cover`,
      body: { grow_log_id: testLog.id },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(200);

    // Verify only photo2 is cover
    await photo1.reload();
    await photo2.reload();
    expect(photo1.is_cover).to.be.false;
    expect(photo2.is_cover).to.be.true;
  });

  it('should reject setting cover for non-existent photo', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grow-logs/photos/${fakeId}/cover`,
      body: { grow_log_id: testLog.id },
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.statusCode).to.equal(404);
  });

  it('should reject setting cover by another user', async () => {
    const anotherUser = await testHelper.createTestUser({ email: `another-${Date.now()}@example.com` });
    const anotherLogin = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/auth/login',
      body: { email: anotherUser.email, password: 'test-password' },
      headers: {},
    });
    const anotherToken = anotherLogin.body.accessToken;

    const response = await testHelper.executeRequest({
      httpMethod: 'PUT',
      path: `/api/grow-logs/photos/${photo1.id}/cover`,
      body: { grow_log_id: testLog.id },
      headers: { Authorization: `Bearer ${anotherToken}` },
    });

    expect(response.statusCode).to.equal(403);
  });
});
