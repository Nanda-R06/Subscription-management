import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { closeDb, initDb, query } from '../src/db/index.js';
import * as billingService from '../src/services/billing.service.js';
import * as catalogService from '../src/services/catalog.service.js';

let app;
let server;
let baseUrl;

describe('Modules 1-6: Billing Engine, Proration Math & Invoicing Test Suite', () => {
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

  // 1. Catalog & Minor Units
  describe('Catalog & Price Storage in Minor Units (Cents)', () => {
    it('should store prices strictly as integers in cents', async () => {
      const prod = await catalogService.createProduct({
        name: 'Enterprise Cloud Backup',
        description: 'Automated encrypted snapshot backups',
        adminUserId: null,
      });

      const variant = await catalogService.createVariant({
        productId: prod.id,
        name: 'Cloud Edition',
        sku: `SKU-BACKUP-${Date.now()}`,
        adminUserId: null,
      });

      const plan = await catalogService.createPlan({
        variantId: variant.id,
        name: 'Standard Backup Monthly',
        code: `backup_std_${Date.now()}`,
        billingInterval: 'monthly',
        priceCents: 4999, // $49.99
        adminUserId: null,
      });

      assert.equal(plan.priceCents, 4999);
      assert.equal(Number.isInteger(plan.priceCents), true);
    });
  });

  // 2. Subscription & Invoicing Math
  describe('Subscription Creation & Invoicing Calculation', () => {
    it('should calculate itemized invoice correctly with tax and discount', async () => {
      // Find Acme customer
      const custRes = await query('SELECT id FROM customers WHERE billing_email = $1', ['alex@acmecorp.com']);
      const customerId = custRes.rows[0].id;

      // Find Pro Monthly plan ($149.00 = 14900 cents)
      const planRes = await query('SELECT id FROM plans WHERE code = $1', ['pro_monthly']);
      const planId = planRes.rows[0].id;

      // Find CA tax (8.25%)
      const taxRes = await query('SELECT id FROM taxes WHERE rate_percent = 8.25');
      const taxId = taxRes.rows.length > 0 ? taxRes.rows[0].id : null;

      const sub = await billingService.createSubscription({
        customerId,
        planId,
        taxId,
        discountCode: 'LAUNCH20', // 20% off
      });

      assert.ok(sub.id);
      assert.equal(sub.status, 'active');
      assert.ok(sub.invoice);

      // Verify Math:
      // Subtotal = 14900 cents ($149.00)
      // Discount (20%) = round(14900 * 0.20) = 2980 cents ($29.80)
      // Taxable = 14900 - 2980 = 11920 cents
      // Tax (8.25%) = round(11920 * 0.0825) = 983 cents ($9.83)
      // Total = 11920 + 983 = 12903 cents ($129.03)
      assert.equal(sub.invoice.subtotalCents, 14900);
      assert.equal(sub.invoice.discountCents, 2980);
      assert.equal(sub.invoice.taxCents, 983);
      assert.equal(sub.invoice.totalCents, 12903);
      assert.equal(sub.invoice.amountDueCents, 12903);
    });
  });

  // 3. Mid-Cycle Proration Upgrade
  describe('Mid-Cycle Proration Calculation', () => {
    it('should accurately calculate unused credit and charge delta for upgrade', async () => {
      const custRes = await query('SELECT id FROM customers WHERE billing_email = $1', ['alex@acmecorp.com']);
      const customerId = custRes.rows[0].id;

      const starterRes = await query('SELECT id FROM plans WHERE code = $1', ['starter_monthly']);
      const proRes = await query('SELECT id FROM plans WHERE code = $1', ['pro_monthly']);

      // Create subscription on Starter ($49.00 = 4900 cents)
      const sub = await billingService.createSubscription({
        customerId,
        planId: starterRes.rows[0].id,
      });

      // Execute plan change to Pro ($149.00 = 14900 cents)
      const upgrade = await billingService.changeSubscriptionPlan({
        subscriptionId: sub.id,
        newPlanId: proRes.rows[0].id,
      });

      // Positive proration adjustment should be generated
      assert.ok(upgrade.netAdjustmentCents > 0);
      assert.ok(upgrade.prorationInvoice);
      assert.equal(upgrade.prorationInvoice.amountDueCents, upgrade.netAdjustmentCents);
    });
  });

  // 4. Payment Processing & Dunning
  describe('Payments & Dunning Lifecycle', () => {
    it('should successfully record payment and transition invoice to paid', async () => {
      const custRes = await query('SELECT id FROM customers WHERE billing_email = $1', ['alex@acmecorp.com']);
      const planRes = await query('SELECT id FROM plans LIMIT 1');

      // Create a fresh subscription with open invoice
      const sub = await billingService.createSubscription({
        customerId: custRes.rows[0].id,
        planId: planRes.rows[0].id,
      });

      assert.ok(sub.invoice);
      const payment = await billingService.processPayment({
        invoiceId: sub.invoice.id,
        amountCents: sub.invoice.amountDueCents,
      });

      assert.equal(payment.success, true);
      assert.equal(payment.invoiceStatus, 'paid');
      assert.equal(payment.amountDueCents, 0);
    });

    it('should handle simulated payment decline and mark subscription past_due', async () => {
      const custRes = await query('SELECT id FROM customers WHERE billing_email = $1', ['alex@acmecorp.com']);
      const planRes = await query('SELECT id FROM plans LIMIT 1');

      // Create a fresh subscription
      const sub = await billingService.createSubscription({
        customerId: custRes.rows[0].id,
        planId: planRes.rows[0].id,
      });

      assert.ok(sub.invoice);
      const result = await billingService.processPayment({
        invoiceId: sub.invoice.id,
        simulateFail: true,
      });

      assert.equal(result.success, false);
      assert.equal(result.status, 'failed');

      // Check subscription is now past_due
      const subCheck = await query('SELECT status FROM subscriptions WHERE id = $1', [sub.id]);
      assert.equal(subCheck.rows[0].status, 'past_due');
    });
  });

  // 5. Revenue Metrics
  describe('Revenue Reporting Engine', () => {
    it('should compute MRR, ARR, and Accounts Receivable accurately', async () => {
      const metrics = await billingService.getRevenueMetrics();
      assert.ok(typeof metrics.mrrCents === 'number');
      assert.ok(typeof metrics.arrCents === 'number');
      assert.equal(metrics.arrCents, metrics.mrrCents * 12);
      assert.ok(metrics.accountsReceivable);
      assert.ok(Array.isArray(metrics.revenueByPlan));
    });
  });
});
