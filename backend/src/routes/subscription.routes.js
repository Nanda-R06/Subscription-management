import express from 'express';
import { query } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';
import * as billingService from '../services/billing.service.js';

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/v1/subscriptions
 * Staff & Admin: List all subscriptions
 */
router.get('/', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const status = req.query.status;
    let sql = `
      SELECT s.*, p.name as plan_name, p.code as plan_code, p.price_cents as plan_price,
             c.company_name, c.billing_email
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      JOIN customers c ON s.customer_id = c.id
    `;
    const params = [];
    if (status) {
      sql += ' WHERE s.status = $1';
      params.push(status);
    }
    sql += ' ORDER BY s.created_at DESC';

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/subscriptions/my
 * Customer: List own subscriptions
 */
router.get('/my', async (req, res, next) => {
  try {
    const custRes = await query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);
    if (custRes.rows.length === 0) {
      return res.json({ success: true, data: [] });
    }
    const customerId = custRes.rows[0].id;

    const result = await query(
      `SELECT s.*, p.name as plan_name, p.code as plan_code, p.price_cents as plan_price, p.billing_interval
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.customer_id = $1
       ORDER BY s.created_at DESC`,
      [customerId]
    );

    // Attach addons
    const subs = [];
    for (const sub of result.rows) {
      const addonsRes = await query(
        `SELECT sa.*, a.name as addon_name, a.code as addon_code
         FROM subscription_addons sa
         JOIN addons a ON sa.addon_id = a.id
         WHERE sa.subscription_id = $1`,
        [sub.id]
      );
      subs.push({ ...sub, addons: addonsRes.rows });
    }

    res.json({ success: true, data: subs });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/subscriptions
 * Create a new subscription
 */
router.post('/', async (req, res, next) => {
  try {
    let customerId = req.body.customerId;

    // If customer role, ensure customerId belongs to them
    if (req.user.role === 'customer') {
      const custRes = await query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);
      if (custRes.rows.length === 0) throw new NotFoundError('Customer profile not found.');
      customerId = custRes.rows[0].id;
    }

    const { planId, addonIds, discountCode, taxId } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const sub = await billingService.createSubscription({
      customerId,
      planId,
      addonIds,
      discountCode,
      taxId,
      adminUserId: req.user.id,
      ipAddress,
    });

    res.status(201).json({ success: true, data: sub });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/subscriptions/:id/change-plan
 * Upgrade / Downgrade with proration
 */
router.post('/:id/change-plan', async (req, res, next) => {
  try {
    const subscriptionId = req.params.id;
    const { newPlanId } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    // If customer, verify ownership
    if (req.user.role === 'customer') {
      const check = await query(
        `SELECT s.id FROM subscriptions s JOIN customers c ON s.customer_id = c.id WHERE s.id = $1 AND c.user_id = $2`,
        [subscriptionId, req.user.id]
      );
      if (check.rows.length === 0) throw new ForbiddenError('Unauthorized subscription access.');
    }

    const result = await billingService.changeSubscriptionPlan({
      subscriptionId,
      newPlanId,
      userId: req.user.id,
      ipAddress,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/subscriptions/:id/pause
 */
router.post('/:id/pause', async (req, res, next) => {
  try {
    const subscriptionId = req.params.id;
    const ipAddress = req.ip || req.connection.remoteAddress;

    if (req.user.role === 'customer') {
      const check = await query(
        `SELECT s.id FROM subscriptions s JOIN customers c ON s.customer_id = c.id WHERE s.id = $1 AND c.user_id = $2`,
        [subscriptionId, req.user.id]
      );
      if (check.rows.length === 0) throw new ForbiddenError('Unauthorized subscription access.');
    }

    const result = await billingService.pauseSubscription(subscriptionId, { userId: req.user.id, ipAddress });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/subscriptions/:id/resume
 */
router.post('/:id/resume', async (req, res, next) => {
  try {
    const subscriptionId = req.params.id;
    const ipAddress = req.ip || req.connection.remoteAddress;

    if (req.user.role === 'customer') {
      const check = await query(
        `SELECT s.id FROM subscriptions s JOIN customers c ON s.customer_id = c.id WHERE s.id = $1 AND c.user_id = $2`,
        [subscriptionId, req.user.id]
      );
      if (check.rows.length === 0) throw new ForbiddenError('Unauthorized subscription access.');
    }

    const result = await billingService.resumeSubscription(subscriptionId, { userId: req.user.id, ipAddress });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/subscriptions/:id/cancel
 */
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const subscriptionId = req.params.id;
    const { immediate = false } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    if (req.user.role === 'customer') {
      const check = await query(
        `SELECT s.id FROM subscriptions s JOIN customers c ON s.customer_id = c.id WHERE s.id = $1 AND c.user_id = $2`,
        [subscriptionId, req.user.id]
      );
      if (check.rows.length === 0) throw new ForbiddenError('Unauthorized subscription access.');
    }

    const result = await billingService.cancelSubscription(subscriptionId, { immediate, userId: req.user.id, ipAddress });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
