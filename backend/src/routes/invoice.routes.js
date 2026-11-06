import express from 'express';
import { query } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/v1/invoices
 * Staff & Admin: List all invoices
 */
router.get('/', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const status = req.query.status;
    let sql = `
      SELECT i.*, c.company_name, c.billing_email
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
    `;
    const params = [];
    if (status) {
      sql += ' WHERE i.status = $1';
      params.push(status);
    }
    sql += ' ORDER BY i.created_at DESC';

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/invoices/my
 * Customer: List own invoices
 */
router.get('/my', async (req, res, next) => {
  try {
    const custRes = await query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);
    if (custRes.rows.length === 0) {
      return res.json({ success: true, data: [] });
    }
    const customerId = custRes.rows[0].id;

    const result = await query(
      `SELECT * FROM invoices WHERE customer_id = $1 ORDER BY created_at DESC`,
      [customerId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/invoices/:id
 * In-depth invoice details with itemized breakdown
 */
router.get('/:id', async (req, res, next) => {
  try {
    const invId = req.params.id;
    const invRes = await query(
      `SELECT i.*, c.company_name, c.billing_email, c.billing_address_line1, c.billing_city, c.billing_country, c.tax_identifier
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       WHERE i.id = $1`,
      [invId]
    );

    if (invRes.rows.length === 0) throw new NotFoundError('Invoice not found.');
    const invoice = invRes.rows[0];

    // Customer RBAC check
    if (req.user.role === 'customer') {
      const custRes = await query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);
      if (custRes.rows.length === 0 || custRes.rows[0].id !== invoice.customer_id) {
        throw new ForbiddenError('Unauthorized invoice access.');
      }
    }

    const itemsRes = await query(
      `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY created_at ASC`,
      [invId]
    );

    const paymentsRes = await query(
      `SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC`,
      [invId]
    );

    res.json({
      success: true,
      data: {
        ...invoice,
        lineItems: itemsRes.rows,
        payments: paymentsRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/invoices/:id/pdf
 * Clean printable/downloadable HTML/PDF invoice export
 */
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const invId = req.params.id;
    const invRes = await query(
      `SELECT i.*, c.company_name, c.billing_email, c.billing_address_line1, c.billing_city, c.billing_country
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       WHERE i.id = $1`,
      [invId]
    );

    if (invRes.rows.length === 0) throw new NotFoundError('Invoice not found.');
    const inv = invRes.rows[0];

    const itemsRes = await query(`SELECT * FROM invoice_items WHERE invoice_id = $1`, [invId]);

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${inv.invoice_number}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #1e293b; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
        .title { font-size: 28px; font-weight: 800; color: #2563eb; }
        .inv-num { font-size: 20px; font-weight: 700; color: #0f172a; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
        .paid { background: #dcfce7; color: #15803d; }
        .open { background: #fee2e2; color: #b91c1c; }
        table { width: 100%; border-collapse: collapse; margin-top: 30px; }
        th { text-align: left; background: #f8fafc; padding: 10px; border-bottom: 1px solid #cbd5e1; font-size: 12px; text-transform: uppercase; }
        td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .totals { margin-top: 30px; float: right; width: 300px; }
        .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
        .totals-final { border-top: 2px solid #0f172a; font-weight: 800; font-size: 18px; margin-top: 10px; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="title">BRIGHTLOOP BILLING</div>
          <p>Brightloop Software, Inc.<br>500 Howard Street, San Francisco, CA</p>
        </div>
        <div style="text-align: right;">
          <div class="inv-num">${inv.invoice_number}</div>
          <p>Status: <span class="badge ${inv.status}">${inv.status}</span></p>
          <p>Date: ${new Date(inv.issue_date).toLocaleDateString()}<br>Due Date: ${new Date(inv.due_date).toLocaleDateString()}</p>
        </div>
      </div>

      <div style="margin-top: 25px;">
        <strong>Billed To:</strong><br>
        ${inv.company_name}<br>
        ${inv.billing_email}<br>
        ${inv.billing_city ? `${inv.billing_city}, ${inv.billing_country || ''}` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Unit Price</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRes.rows.map((it) => `
            <tr>
              <td>${it.description}</td>
              <td style="text-align: center;">${it.quantity}</td>
              <td style="text-align: right;">$${(it.unit_price_cents / 100).toFixed(2)}</td>
              <td style="text-align: right; font-weight: 600;">$${(it.total_cents / 100).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row"><span>Subtotal:</span><span>$${(inv.subtotal_cents / 100).toFixed(2)}</span></div>
        ${inv.discount_cents > 0 ? `<div class="totals-row" style="color: #16a34a;"><span>Discount:</span><span>-$${(inv.discount_cents / 100).toFixed(2)}</span></div>` : ''}
        ${inv.tax_cents > 0 ? `<div class="totals-row"><span>Tax:</span><span>+$${(inv.tax_cents / 100).toFixed(2)}</span></div>` : ''}
        <div class="totals-row totals-final"><span>Total Due:</span><span>$${(inv.amount_due_cents / 100).toFixed(2)}</span></div>
      </div>
    </body>
    </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename="${inv.invoice_number}.html"`);
    res.send(html);
  } catch (err) {
    next(err);
  }
});

export default router;
