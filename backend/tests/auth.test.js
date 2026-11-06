import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { closeDb, initDb, query } from '../src/db/index.js';
import { validatePassword } from '../src/utils/password.js';

let app;
let server;
let baseUrl;

describe('Scene 1: Authentication & RBAC Test Suite', () => {
  before(async () => {
    await initDb();
    app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closeDb();
  });

  // 1. Password Policy Validation
  describe('Password Rules Unit Tests', () => {
    it('should reject passwords with 8 or fewer characters', () => {
      const res = validatePassword('Pass123!');
      assert.equal(res.isValid, false);
      assert.ok(res.errors.some((e) => e.includes('more than 8 characters')));
    });

    it('should reject passwords without an uppercase character', () => {
      const res = validatePassword('password123!');
      assert.equal(res.isValid, false);
      assert.ok(res.errors.some((e) => e.includes('uppercase')));
    });

    it('should reject passwords without a lowercase character', () => {
      const res = validatePassword('PASSWORD123!');
      assert.equal(res.isValid, false);
      assert.ok(res.errors.some((e) => e.includes('lowercase')));
    });

    it('should reject passwords without a special character', () => {
      const res = validatePassword('Password123');
      assert.equal(res.isValid, false);
      assert.ok(res.errors.some((e) => e.includes('special character')));
    });

    it('should accept valid passwords meeting all criteria (>8 chars, upper, lower, special)', () => {
      const res = validatePassword('SecurePass2026!');
      assert.equal(res.isValid, true);
      assert.equal(res.errors.length, 0);
    });
  });

  // 2. Signup & Uniqueness
  describe('POST /api/v1/auth/signup', () => {
    const testEmail = `newcustomer_${Date.now()}@company.test`;

    it('should successfully register a customer account with compliant password', async () => {
      const response = await fetch(`${baseUrl}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'ValidPassword123!',
          firstName: 'Jonathan',
          lastName: 'Miller',
          companyName: 'Miller Tech Labs',
        }),
      });

      const body = await response.json();
      assert.equal(response.status, 201);
      assert.equal(body.success, true);
      assert.equal(body.data.user.email, testEmail);
      assert.equal(body.data.user.role, 'customer');
      assert.equal(body.data.customer.companyName, 'Miller Tech Labs');
      assert.ok(body.data.tokens.accessToken);
      assert.ok(body.data.tokens.refreshToken);
    });

    it('should prevent duplicate registration with the same email', async () => {
      const response = await fetch(`${baseUrl}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'ValidPassword123!',
          firstName: 'Jonathan',
          lastName: 'Miller',
        }),
      });

      const body = await response.json();
      assert.equal(response.status, 409);
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'CONFLICT');
    });

    it('should reject signup when password violates policy', async () => {
      const response = await fetch(`${baseUrl}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'shortpass@example.com',
          password: 'pass',
        }),
      });

      const body = await response.json();
      assert.equal(response.status, 400);
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'VALIDATION_ERROR');
      assert.ok(Array.isArray(body.error.details));
    });
  });

  // 3. Login & Session
  describe('POST /api/v1/auth/login', () => {
    it('should successfully authenticate registered user and return tokens', async () => {
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@brightloop.io',
          password: 'Password123!',
        }),
      });

      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.user.role, 'admin');
      assert.ok(body.data.tokens.accessToken);
      assert.ok(body.data.tokens.refreshToken);
    });

    it('should reject invalid credentials with 401 without revealing password state', async () => {
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@brightloop.io',
          password: 'WrongPassword!',
        }),
      });

      const body = await response.json();
      assert.equal(response.status, 401);
      assert.equal(body.success, false);
      assert.equal(body.error.code, 'UNAUTHORIZED');
    });
  });

  // 4. Token Refresh & Rotation
  describe('POST /api/v1/auth/refresh-token', () => {
    it('should rotate refresh token and issue a fresh access token', async () => {
      // Login first
      const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'staff@brightloop.io',
          password: 'Password123!',
        }),
      });
      const loginData = await loginRes.json();
      const initialRefreshToken = loginData.data.tokens.refreshToken;

      // Refresh
      const refreshRes = await fetch(`${baseUrl}/api/v1/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: initialRefreshToken }),
      });
      const refreshData = await refreshRes.json();

      assert.equal(refreshRes.status, 200);
      assert.equal(refreshData.success, true);
      assert.ok(refreshData.data.accessToken);
      assert.ok(refreshData.data.refreshToken);
      assert.notEqual(refreshData.data.refreshToken, initialRefreshToken);

      // Re-using the old refresh token should be rejected (single-use rotation)
      const reuseRes = await fetch(`${baseUrl}/api/v1/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: initialRefreshToken }),
      });
      assert.equal(reuseRes.status, 401);
    });
  });

  // 5. Password Reset Flow
  describe('Forgot and Reset Password Flow', () => {
    it('should generate a reset token and allow resetting password once', async () => {
      // 1. Forgot password request
      const forgotRes = await fetch(`${baseUrl}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'alex@acmecorp.com' }),
      });
      const forgotData = await forgotRes.json();
      assert.equal(forgotRes.status, 200);
      assert.equal(forgotData.success, true);
      assert.ok(forgotData.devResetUrl);

      // Extract raw token from url
      const url = new URL(forgotData.devResetUrl);
      const rawToken = url.searchParams.get('token');
      assert.ok(rawToken);

      // 2. Perform Reset
      const resetRes = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rawToken,
          newPassword: 'BrandNewSecurePassword2026!',
        }),
      });
      const resetData = await resetRes.json();
      assert.equal(resetRes.status, 200);
      assert.equal(resetData.success, true);

      // 3. Re-using the same token must fail (single-use link)
      const reuseResetRes = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rawToken,
          newPassword: 'AnotherPassword2026!',
        }),
      });
      assert.equal(reuseResetRes.status, 400);

      // 4. Login with newly reset password
      const newLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'alex@acmecorp.com',
          password: 'BrandNewSecurePassword2026!',
        }),
      });
      assert.equal(newLoginRes.status, 200);
    });
  });

  // 6. RBAC & Staff Management
  describe('RBAC & Admin-Only Staff Management', () => {
    let adminToken;
    let staffToken;
    let customerToken;

    before(async () => {
      // Admin token
      const adm = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@brightloop.io', password: 'Password123!' }),
      });
      adminToken = (await adm.json()).data.tokens.accessToken;

      // Staff token
      const stf = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'staff@brightloop.io', password: 'Password123!' }),
      });
      staffToken = (await stf.json()).data.tokens.accessToken;

      // Customer token
      const cst = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'alex@acmecorp.com', password: 'BrandNewSecurePassword2026!' }),
      });
      customerToken = (await cst.json()).data.tokens.accessToken;
    });

    it('should forbid unauthenticated access to /api/v1/admin/staff', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/staff`);
      assert.equal(res.status, 401);
    });

    it('should forbid customer access to /api/v1/admin/staff (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/staff`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      assert.equal(res.status, 403);
    });

    it('should forbid internal staff from creating or listing staff (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/staff`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      assert.equal(res.status, 403);
    });

    it('should allow ADMIN to list staff members', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/staff`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.success, true);
      assert.ok(Array.isArray(data.data));
    });

    it('should allow ADMIN ONLY to create a new staff account', async () => {
      const newStaffEmail = `agent_${Date.now()}@brightloop.io`;
      const res = await fetch(`${baseUrl}/api/v1/admin/staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          email: newStaffEmail,
          password: 'StaffMemberPass2026!',
          firstName: 'Alice',
          lastName: 'Support',
        }),
      });

      const data = await res.json();
      assert.equal(res.status, 201);
      assert.equal(data.success, true);
      assert.equal(data.data.staff.role, 'staff');
      assert.equal(data.data.staff.email, newStaffEmail);
    });
  });
});
