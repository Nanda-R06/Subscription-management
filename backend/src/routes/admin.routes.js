import express from 'express';
import { query } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as authService from '../services/auth.service.js';

const router = express.Router();

// Enforce admin-only access on all routes in this router
router.use(requireAuth, requireRole('admin'));

/**
 * POST /api/v1/admin/staff
 * Admin-only: Create internal staff account
 */
router.post('/staff', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await authService.createStaff({
      email,
      password,
      firstName,
      lastName,
      adminUserId: req.user.id,
      ipAddress,
    });

    res.status(201).json({
      success: true,
      data: {
        staff: result,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/staff
 * Admin-only: List all internal staff accounts
 */
router.get('/staff', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);

    const result = await authService.listStaff({ page, limit });

    res.json({
      success: true,
      data: result.staff,
      meta: result.meta,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/admin/staff/:id/status
 * Admin-only: Toggle staff active / deactivated
 */
router.patch('/staff/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await authService.updateStaffStatus({
      staffId: id,
      isActive,
      adminUserId: req.user.id,
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
 * GET /api/v1/admin/audit-logs
 * Admin-only: View audit logs
 */
router.get('/audit-logs', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const offset = (Math.max(1, page) - 1) * limit;

    const countRes = await query('SELECT COUNT(*) as count FROM audit_logs');
    const total = parseInt(countRes.rows[0].count || '0', 10);

    const logsRes = await query(
      `SELECT a.*, u.email as actor_email, u.role as actor_role
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const logs = logsRes.rows.map((row) => ({
      ...row,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
    }));

    res.json({
      success: true,
      data: logs,
      meta: {
        page: Math.max(1, page),
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
