import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { query } from '../db/index.js';
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors.js';
import {
  generateAccessToken,
  generatePasswordResetToken,
  generateRefreshToken,
  hashToken,
} from '../utils/jwt.js';
import {
  comparePassword,
  hashPassword,
  validateEmail,
  validatePassword,
} from '../utils/password.js';
import { logAudit } from './audit.service.js';

export async function signupCustomer({
  email,
  password,
  firstName,
  lastName,
  companyName,
  ipAddress,
}) {
  if (!email || !validateEmail(email)) {
    throw new ValidationError('A valid email address is required.');
  }

  const passCheck = validatePassword(password);
  if (!passCheck.isValid) {
    throw new ValidationError('Password does not meet security requirements.', passCheck.errors);
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check uniqueness
  const existingUser = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existingUser.rows.length > 0) {
    throw new ConflictError('An account with this email address already exists.');
  }

  const userId = uuidv4();
  const customerId = uuidv4();
  const hashedPassword = await hashPassword(password);
  const now = new Date().toISOString();

  // 1. Create User
  await query(
    `INSERT INTO users (id, email, password_hash, role, first_name, last_name, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, 'customer', $4, $5, 1, $6, $7)`,
    [userId, normalizedEmail, hashedPassword, firstName || null, lastName || null, now, now]
  );

  // 2. Create Customer Profile
  const company = companyName ? companyName.trim() : `${firstName || 'Customer'}'s Company`;
  await query(
    `INSERT INTO customers (id, user_id, company_name, billing_email, currency, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'USD', $5, $6)`,
    [customerId, userId, company, normalizedEmail, now, now]
  );

  // 3. Issue Tokens
  const user = { id: userId, email: normalizedEmail, role: 'customer', first_name: firstName, last_name: lastName };
  const accessToken = generateAccessToken(user);
  const refresh = generateRefreshToken();

  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [uuidv4(), userId, refresh.tokenHash, refresh.expiresAt, now]
  );

  await logAudit({
    userId,
    action: 'USER_SIGNUP',
    entityType: 'users',
    entityId: userId,
    details: { email: normalizedEmail, role: 'customer' },
    ipAddress,
  });

  return {
    user: {
      id: userId,
      email: normalizedEmail,
      role: 'customer',
      firstName,
      lastName,
    },
    customer: {
      id: customerId,
      companyName: company,
      billingEmail: normalizedEmail,
    },
    tokens: {
      accessToken,
      refreshToken: refresh.rawToken,
    },
  };
}

export async function login({ email, password, ipAddress }) {
  if (!email || !password) {
    throw new ValidationError('Email and password are required.');
  }

  const normalizedEmail = email.trim().toLowerCase();

  const userResult = await query(
    `SELECT id, email, password_hash, role, first_name, last_name, is_active
     FROM users WHERE email = $1`,
    [normalizedEmail]
  );

  if (userResult.rows.length === 0) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  const user = userResult.rows[0];

  if (!user.is_active || user.is_active === 0 || user.is_active === '0') {
    throw new UnauthorizedError('Account is deactivated. Please contact support.');
  }

  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  // Fetch customer profile if customer
  let customer = null;
  if (user.role === 'customer') {
    const custResult = await query(
      `SELECT id, company_name, billing_email, currency FROM customers WHERE user_id = $1`,
      [user.id]
    );
    if (custResult.rows.length > 0) {
      customer = {
        id: custResult.rows[0].id,
        companyName: custResult.rows[0].company_name,
        billingEmail: custResult.rows[0].billing_email,
        currency: custResult.rows[0].currency,
      };
    }
  }

  const accessToken = generateAccessToken(user);
  const refresh = generateRefreshToken();
  const now = new Date().toISOString();

  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [uuidv4(), user.id, refresh.tokenHash, refresh.expiresAt, now]
  );

  await logAudit({
    userId: user.id,
    action: 'USER_LOGIN',
    entityType: 'users',
    entityId: user.id,
    details: { email: user.email },
    ipAddress,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
    },
    customer,
    tokens: {
      accessToken,
      refreshToken: refresh.rawToken,
    },
  };
}

export async function refreshAccessToken({ refreshToken, ipAddress }) {
  if (!refreshToken) {
    throw new ValidationError('Refresh token is required.');
  }

  const tokenHash = hashToken(refreshToken);
  const tokenResult = await query(
    `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1`,
    [tokenHash]
  );

  if (tokenResult.rows.length === 0) {
    throw new UnauthorizedError('Invalid refresh token.');
  }

  const storedToken = tokenResult.rows[0];

  // Token reuse detection: if revoked token is used, revoke all tokens for this user
  if (storedToken.revoked_at) {
    await query(`UPDATE refresh_tokens SET revoked_at = $1 WHERE user_id = $2`, [
      new Date().toISOString(),
      storedToken.user_id,
    ]);
    throw new UnauthorizedError('Invalid refresh token. Token reuse detected. Please log in again.');
  }

  // Expiration check
  if (new Date(storedToken.expires_at) < new Date()) {
    throw new UnauthorizedError('Refresh token has expired. Please log in again.');
  }

  // Revoke current refresh token (single-use rotation)
  const now = new Date().toISOString();
  await query(`UPDATE refresh_tokens SET revoked_at = $1 WHERE id = $2`, [now, storedToken.id]);

  // Load user
  const userResult = await query(
    `SELECT id, email, role, first_name, last_name, is_active FROM users WHERE id = $1`,
    [storedToken.user_id]
  );

  if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
    throw new UnauthorizedError('User account not found or deactivated.');
  }

  const user = userResult.rows[0];

  // Generate new token pair
  const newAccessToken = generateAccessToken(user);
  const newRefresh = generateRefreshToken();

  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [uuidv4(), user.id, newRefresh.tokenHash, newRefresh.expiresAt, now]
  );

  return {
    accessToken: newAccessToken,
    refreshToken: newRefresh.rawToken,
  };
}

export async function logout({ refreshToken }) {
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await query(`UPDATE refresh_tokens SET revoked_at = $1 WHERE token_hash = $2`, [
      new Date().toISOString(),
      tokenHash,
    ]);
  }
  return { success: true };
}

export async function forgotPassword({ email, ipAddress }) {
  if (!email || !validateEmail(email)) {
    throw new ValidationError('A valid email address is required.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const userResult = await query(
    `SELECT id, email, is_active FROM users WHERE email = $1`,
    [normalizedEmail]
  );

  let resetUrl = null;

  if (userResult.rows.length > 0 && userResult.rows[0].is_active) {
    const user = userResult.rows[0];
    const reset = generatePasswordResetToken();
    const now = new Date().toISOString();

    await query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [uuidv4(), user.id, reset.tokenHash, reset.expiresAt, now]
    );

    resetUrl = `${config.frontendUrl}/reset-password?token=${reset.rawToken}`;
    console.log(`\n🔗 [PASSWORD RESET LINK for ${normalizedEmail}]:\n${resetUrl}\n`);

    await logAudit({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'users',
      entityId: user.id,
      details: { email: normalizedEmail },
      ipAddress,
    });
  }

  // Consistent response to prevent user enumeration
  return {
    success: true,
    message: 'If that email is registered, instructions to reset your password have been sent.',
    // Expose devResetUrl in development to facilitate testing
    ...(config.env !== 'production' && resetUrl ? { devResetUrl: resetUrl } : {}),
  };
}

export async function resetPassword({ token, newPassword, ipAddress }) {
  if (!token) {
    throw new ValidationError('Reset token is required.');
  }

  const passCheck = validatePassword(newPassword);
  if (!passCheck.isValid) {
    throw new ValidationError('New password does not meet security requirements.', passCheck.errors);
  }

  const tokenHash = hashToken(token);
  const tokenResult = await query(
    `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = $1`,
    [tokenHash]
  );

  if (tokenResult.rows.length === 0) {
    throw new ValidationError('Invalid or expired password reset link.');
  }

  const resetToken = tokenResult.rows[0];

  if (resetToken.used_at) {
    throw new ValidationError('This password reset link has already been used.');
  }

  if (new Date(resetToken.expires_at) < new Date()) {
    throw new ValidationError('This password reset link has expired.');
  }

  const now = new Date().toISOString();
  const hashedPassword = await hashPassword(newPassword);

  // 1. Update user password
  await query(
    `UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3`,
    [hashedPassword, now, resetToken.user_id]
  );

  // 2. Mark reset token as used
  await query(`UPDATE password_reset_tokens SET used_at = $1 WHERE id = $2`, [now, resetToken.id]);

  // 3. Revoke all refresh tokens for security
  await query(`UPDATE refresh_tokens SET revoked_at = $1 WHERE user_id = $2`, [
    now,
    resetToken.user_id,
  ]);

  await logAudit({
    userId: resetToken.user_id,
    action: 'PASSWORD_RESET_COMPLETED',
    entityType: 'users',
    entityId: resetToken.user_id,
    ipAddress,
  });

  return {
    success: true,
    message: 'Password has been successfully updated. You can now log in.',
  };
}

/**
 * Admin-only: Create internal staff account
 */
export async function createStaff({
  email,
  password,
  firstName,
  lastName,
  adminUserId,
  ipAddress,
}) {
  if (!email || !validateEmail(email)) {
    throw new ValidationError('A valid email address is required.');
  }

  const passCheck = validatePassword(password);
  if (!passCheck.isValid) {
    throw new ValidationError('Password does not meet security requirements.', passCheck.errors);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existing.rows.length > 0) {
    throw new ConflictError('An account with this email address already exists.');
  }

  const staffId = uuidv4();
  const hashedPassword = await hashPassword(password);
  const now = new Date().toISOString();

  await query(
    `INSERT INTO users (id, email, password_hash, role, first_name, last_name, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, 'staff', $4, $5, 1, $6, $7)`,
    [staffId, normalizedEmail, hashedPassword, firstName || null, lastName || null, now, now]
  );

  await logAudit({
    userId: adminUserId,
    action: 'STAFF_CREATED',
    entityType: 'users',
    entityId: staffId,
    details: { email: normalizedEmail, firstName, lastName },
    ipAddress,
  });

  return {
    id: staffId,
    email: normalizedEmail,
    role: 'staff',
    firstName,
    lastName,
    isActive: true,
    createdAt: now,
  };
}

/**
 * Admin-only: List all staff accounts
 */
export async function listStaff({ page = 1, limit = 20 }) {
  const offset = (Math.max(1, page) - 1) * limit;

  const countResult = await query(`SELECT COUNT(*) as count FROM users WHERE role = 'staff'`);
  const total = parseInt(countResult.rows[0].count || '0', 10);

  const staffResult = await query(
    `SELECT id, email, role, first_name, last_name, is_active, created_at, updated_at
     FROM users
     WHERE role = 'staff'
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return {
    staff: staffResult.rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      firstName: row.first_name,
      lastName: row.last_name,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    meta: {
      page: Math.max(1, page),
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Admin-only: Update staff active status
 */
export async function updateStaffStatus({ staffId, isActive, adminUserId, ipAddress }) {
  const staff = await query(`SELECT id, email, role FROM users WHERE id = $1 AND role = 'staff'`, [
    staffId,
  ]);

  if (staff.rows.length === 0) {
    throw new NotFoundError('Staff member not found.');
  }

  const activeValue = isActive ? 1 : 0;
  const now = new Date().toISOString();

  await query(`UPDATE users SET is_active = $1, updated_at = $2 WHERE id = $3`, [
    activeValue,
    now,
    staffId,
  ]);

  // If deactivating, revoke all active refresh tokens immediately
  if (!isActive) {
    await query(`UPDATE refresh_tokens SET revoked_at = $1 WHERE user_id = $2`, [now, staffId]);
  }

  await logAudit({
    userId: adminUserId,
    action: isActive ? 'STAFF_ACTIVATED' : 'STAFF_DEACTIVATED',
    entityType: 'users',
    entityId: staffId,
    details: { email: staff.rows[0].email, isActive },
    ipAddress,
  });

  return { id: staffId, isActive: Boolean(isActive) };
}
