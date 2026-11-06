import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

/**
 * Generate short-lived JWT Access Token
 */
export function generateAccessToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
}

/**
 * Generate cryptographically secure Refresh Token and its hash
 */
export function generateRefreshToken() {
  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(rawToken);

  // 7 days expiration from now
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
}

/**
 * Generate single-use password reset token (60 min expiry)
 */
export function generatePasswordResetToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  // 1 hour expiration from now
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
}

/**
 * SHA-256 hash helper for tokens
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify JWT Access Token
 */
export function verifyAccessToken(token) {
  try {
    return {
      valid: true,
      payload: jwt.verify(token, config.jwt.accessSecret),
    };
  } catch (err) {
    return {
      valid: false,
      error: err.name,
      message: err.message,
    };
  }
}
