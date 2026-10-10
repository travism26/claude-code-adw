import { User } from '../../models';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { testHelper } from '../mocha.setup';

describe('Login API', () => {
  beforeEach(async () => {
    // Clear any existing test user between tests
    testHelper.clearTestUser();
  });

  it('should not signup with email already registered', async () => {
    const uniqueEmail = `test-${Date.now()}@example.com`;
    const user = await testHelper.createTestUser({ email: uniqueEmail });
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/auth/signup',
      body: { email: user.email, password: 'test-password' },
    });
    // login response { error: 'Invalid credentials' }
    expect(response.body.error).to.equal('Email already registered');
  });

  it('should signup with valid credentials', async () => {
    // Generate a unique email for this test
    const email = `test-${Date.now()}@example.com`;
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/auth/signup',
      body: { email, password: 'test-password' },
    });
    expect(response.body.error).to.be.undefined;
    expect(response.body.accessToken).to.exist;
  });

  it('should login with valid credentials', async () => {
    // Create a user with a known password
    const email = `test-${Date.now()}@example.com`;
    const password = 'test-password';

    // Create the user directly with the password
    await User.create({
      email,
      password_hash: password, // Will be hashed by model hook
      tz: 'UTC',
    });

    // Now try to login with those credentials
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/auth/login',
      body: { email, password },
    });

    expect(response.statusCode).to.equal(200);
    expect(response.body.accessToken).to.exist;
    expect(response.body.user).to.exist;
    expect(response.body.user.email).to.equal(email);
  });

  it('should error with short password', async () => {
    const uniqueEmail = `test-${Date.now()}@example.com`;
    const user = await testHelper.createTestUser({ email: uniqueEmail });
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/auth/login',
      body: { email: user.email, password: 'short' },
    });
    expect(response.body.error).to.equal('Invalid credentials');
  });

  it('should error with invalid email', async () => {
    const response = await testHelper.executeRequest({
      httpMethod: 'POST',
      path: '/api/auth/login',
      body: { email: 'invalid-email', password: 'test-password' },
    });
    expect(response.body.errors[0].msg).to.equal('Invalid value');
  });
});
