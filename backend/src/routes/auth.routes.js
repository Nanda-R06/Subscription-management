import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import * as authService from '../services/auth.service.js';

const router = express.Router();

/**
 * POST /api/v1/auth/signup
 * Customer signup
 */
router.post('/signup', authLimiter, async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, companyName } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await authService.signupCustomer({
      email,
      password,
      firstName,
      lastName,
      companyName,
      ipAddress,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/login
 * User login
 */
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await authService.login({
      email,
      password,
      ipAddress,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/refresh-token
 * Rotate refresh token & issue new access token
 */
router.post('/refresh-token', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await authService.refreshAccessToken({
      refreshToken,
      ipAddress,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/logout
 * Revoke refresh token
 */
router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    await authService.logout({ refreshToken });

    res.json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/forgot-password
 * Issue single-use 60-minute password reset link
 */
router.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await authService.forgotPassword({
      email,
      ipAddress,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/reset-password
 * Reset password using single-use token
 */
router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await authService.resetPassword({
      token,
      newPassword,
      ipAddress,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/auth/me
 * Profile of the authenticated user
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
