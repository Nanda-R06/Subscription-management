import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as billingService from '../services/billing.service.js';
import { query } from '../db/index.js';

const router = express.Router();
router.use(requireAuth, requireRole('admin', 'staff'));

/**
 * GET /api/v1/reports/metrics
 * MRR, ARR, Churn, Accounts Receivable Aging
 */
router.get('/metrics', async (req, res, next) => {
  try {
    const metrics = await billingService.getRevenueMetrics();
    res.json({ success: true, data: metrics });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/reports/export-csv
 * Export revenue ledger to CSV for financial reconciliation
 */
router.get('/export-csv', async (req, res, next) => {
  try {
    const invoices = await query(
      `SELECT i.invoice_number, c.company_name, c.billing_email, i.status,
              i.subtotal_cents, i.discount_cents, i.tax_cents, i.total_cents,
              i.amount_paid_cents, i.amount_due_cents, i.issue_date, i.due_date, i.paid_at
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       ORDER BY i.created_at DESC`
    );

    let csv = 'Invoice Number,Company,Billing Email,Status,Subtotal ($),Discount ($),Tax ($),Total ($),Paid ($),Due ($),Issue Date,Due Date,Paid At\n';

    for (const inv of invoices.rows) {
      csv += [
        inv.invoice_number,
        `"${(inv.company_name || '').replace(/"/g, '""')}"`,
        inv.billing_email,
        inv.status,
        (inv.subtotal_cents / 100).toFixed(2),
        (inv.discount_cents / 100).toFixed(2),
        (inv.tax_cents / 100).toFixed(2),
        (inv.total_cents / 100).toFixed(2),
        (inv.amount_paid_cents / 100).toFixed(2),
        (inv.amount_due_cents / 100).toFixed(2),
        inv.issue_date,
        inv.due_date,
        inv.paid_at || '',
      ].join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="brightloop_revenue_ledger.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

export default router;
