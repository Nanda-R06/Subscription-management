import express from 'express';
import { query } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as billingService from '../services/billing.service.js';

const router = express.Router();
router.use(requireAuth);

/**
 * POST /api/v1/payments/charge
 * Process a payment for an invoice
 */
router.post('/charge', async (req, res, next) => {
  try {
    const { invoiceId, paymentMethod, amountCents, simulateFail } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await billingService.processPayment({
      invoiceId,
      paymentMethod,
      amountCents,
      simulateFail,
      userId: req.user.id,
      ipAddress,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/payments/:id/refund
 * ADMIN ONLY: Refund a payment
 */
router.post('/:id/refund', requireRole('admin'), async (req, res, next) => {
  try {
    const paymentId = req.params.id;
    const { amountCents, reason } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await billingService.refundPayment({
      paymentId,
      amountCents,
      reason,
      adminUserId: req.user.id,
      ipAddress,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/payments
 * Staff & Admin: List payment logs
 */
router.get('/', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const result = await query(
      `SELECT p.*, i.invoice_number, c.company_name, c.billing_email
       FROM payments p
       JOIN invoices i ON p.invoice_id = i.id
       JOIN customers c ON p.customer_id = c.id
       ORDER BY p.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

export default router;
