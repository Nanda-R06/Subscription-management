import { v4 as uuidv4 } from 'uuid';
import { query, getClient } from '../db/index.js';
import { ConflictError, NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';
import { logAudit } from './audit.service.js';

/**
 * Generate sequential invoice number (e.g. INV-2026-0001)
 */
export async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const countRes = await query(
    `SELECT COUNT(*) as count FROM invoices WHERE invoice_number LIKE $1`,
    [`INV-${year}-%`]
  );
  const nextNum = parseInt(countRes.rows[0].count || '0', 10) + 1;
  return `INV-${year}-${String(nextNum).padStart(4, '0')}`;
}

/**
 * 1. SUBSCRIPTIONS: Create Subscription
 */
export async function createSubscription({
  customerId,
  planId,
  addonIds = [], // array of { addonId, quantity }
  discountCode = null,
  taxId = null,
  adminUserId = null,
  ipAddress = null,
}) {
  if (!customerId) throw new ValidationError('Customer ID is required.');
  if (!planId) throw new ValidationError('Plan ID is required.');

  // Validate customer
  const customerRes = await query('SELECT * FROM customers WHERE id = $1', [customerId]);
  if (customerRes.rows.length === 0) throw new NotFoundError('Customer not found.');
  const customer = customerRes.rows[0];

  // Validate plan
  const planRes = await query('SELECT * FROM plans WHERE id = $1 AND is_active = 1', [planId]);
  if (planRes.rows.length === 0) throw new NotFoundError('Plan not found or inactive.');
  const plan = planRes.rows[0];

  // Validate discount if provided
  let discount = null;
  if (discountCode) {
    const discRes = await query('SELECT * FROM discounts WHERE code = $1 AND is_active = 1', [discountCode.toUpperCase()]);
    if (discRes.rows.length > 0) discount = discRes.rows[0];
  }

  // Validate tax if provided
  let tax = null;
  if (taxId) {
    const taxRes = await query('SELECT * FROM taxes WHERE id = $1 AND is_active = 1', [taxId]);
    if (taxRes.rows.length > 0) tax = taxRes.rows[0];
  }

  const now = new Date();
  const subId = uuidv4();
  const isTrial = plan.trial_days > 0;
  const status = isTrial ? 'trial' : 'active';

  let periodStart = now;
  let periodEnd = new Date(now);

  if (isTrial) {
    periodEnd.setDate(periodEnd.getDate() + plan.trial_days);
  } else {
    if (plan.billing_interval === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + (plan.interval_count || 1));
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + (plan.interval_count || 1));
    }
  }

  const periodStartIso = periodStart.toISOString();
  const periodEndIso = periodEnd.toISOString();
  const trialStartIso = isTrial ? periodStartIso : null;
  const trialEndIso = isTrial ? periodEndIso : null;

  // Insert subscription
  await query(
    `INSERT INTO subscriptions (
      id, customer_id, plan_id, discount_id, tax_id, status,
      current_period_start, current_period_end, trial_start, trial_end,
      cancel_at_period_end, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, $12)`,
    [
      subId,
      customerId,
      planId,
      discount ? discount.id : null,
      tax ? tax.id : null,
      status,
      periodStartIso,
      periodEndIso,
      trialStartIso,
      trialEndIso,
      now.toISOString(),
      now.toISOString(),
    ]
  );

  // Attach add-ons
  const attachedAddons = [];
  let addonsSubtotalCents = 0;

  for (const item of addonIds) {
    const addonId = typeof item === 'string' ? item : item.addonId;
    const qty = (typeof item === 'object' && item.quantity) ? parseInt(item.quantity, 10) : 1;

    const addonRes = await query('SELECT * FROM addons WHERE id = $1 AND is_active = 1', [addonId]);
    if (addonRes.rows.length > 0) {
      const addon = addonRes.rows[0];
      const unitPrice = addon.price_cents;
      const subAddonId = uuidv4();

      await query(
        `INSERT INTO subscription_addons (id, subscription_id, addon_id, quantity, unit_price_cents, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [subAddonId, subId, addonId, qty, unitPrice, now.toISOString()]
      );

      addonsSubtotalCents += unitPrice * qty;
      attachedAddons.push({ ...addon, quantity: qty });
    }
  }

  // Generate initial Invoice (if not pure trial)
  let invoice = null;
  if (!isTrial) {
    invoice = await generateInvoiceForSubscription({
      subscriptionId: subId,
      periodStart: periodStartIso,
      periodEnd: periodEndIso,
      isInitial: true,
    });
  }

  await logAudit({
    userId: adminUserId || customer.user_id,
    action: 'SUBSCRIPTION_CREATED',
    entityType: 'subscriptions',
    entityId: subId,
    details: { planCode: plan.code, status, isTrial },
    ipAddress,
  });

  return {
    id: subId,
    customerId,
    plan,
    status,
    currentPeriodStart: periodStartIso,
    currentPeriodEnd: periodEndIso,
    trialDays: plan.trial_days,
    addons: attachedAddons,
    invoice,
  };
}

/**
 * 2. INVOICE GENERATOR FOR SUBSCRIPTION
 */
export async function generateInvoiceForSubscription({
  subscriptionId,
  periodStart,
  periodEnd,
  isInitial = false,
  adjustmentCents = 0,
  adjustmentDescription = null,
}) {
  const subRes = await query(
    `SELECT s.*, p.name as plan_name, p.price_cents as plan_price_cents, p.billing_interval,
            c.billing_email, c.company_name, c.currency as customer_currency
     FROM subscriptions s
     JOIN plans p ON s.plan_id = p.id
     JOIN customers c ON s.customer_id = c.id
     WHERE s.id = $1`,
    [subscriptionId]
  );

  if (subRes.rows.length === 0) throw new NotFoundError('Subscription not found.');
  const sub = subRes.rows[0];

  const invoiceId = uuidv4();
  const invoiceNumber = await generateInvoiceNumber();
  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 7); // 7-day payment terms

  const lineItems = [];
  let subtotalCents = 0;

  // 1. Plan Line Item
  lineItems.push({
    id: uuidv4(),
    description: `${sub.plan_name} (${sub.billing_interval} subscription)`,
    item_type: 'plan',
    quantity: 1,
    unit_price_cents: sub.plan_price_cents,
    total_cents: sub.plan_price_cents,
    period_start: periodStart,
    period_end: periodEnd,
  });
  subtotalCents += sub.plan_price_cents;

  // 2. Add-on Line Items
  const addonsRes = await query(
    `SELECT sa.*, a.name as addon_name
     FROM subscription_addons sa
     JOIN addons a ON sa.addon_id = a.id
     WHERE sa.subscription_id = $1`,
    [subscriptionId]
  );

  for (const addon of addonsRes.rows) {
    const itemTotal = addon.unit_price_cents * addon.quantity;
    lineItems.push({
      id: uuidv4(),
      description: `Add-on: ${addon.addon_name} (x${addon.quantity})`,
      item_type: 'addon',
      quantity: addon.quantity,
      unit_price_cents: addon.unit_price_cents,
      total_cents: itemTotal,
      period_start: periodStart,
      period_end: periodEnd,
    });
    subtotalCents += itemTotal;
  }

  // 3. Proration or adjustment line item if present
  if (adjustmentCents !== 0) {
    lineItems.push({
      id: uuidv4(),
      description: adjustmentDescription || 'Proration Adjustment',
      item_type: 'proration',
      quantity: 1,
      unit_price_cents: adjustmentCents,
      total_cents: adjustmentCents,
      period_start: periodStart,
      period_end: periodEnd,
    });
    subtotalCents += adjustmentCents;
  }

  // 4. Discounts calculation
  let discountCents = 0;
  if (sub.discount_id) {
    const discRes = await query('SELECT * FROM discounts WHERE id = $1', [sub.discount_id]);
    if (discRes.rows.length > 0) {
      const disc = discRes.rows[0];
      if (disc.discount_type === 'percent') {
        discountCents = Math.round((subtotalCents * disc.discount_value) / 100);
      } else {
        discountCents = Math.min(subtotalCents, disc.discount_value);
      }
    }
  }

  // 5. Taxes calculation
  let taxCents = 0;
  const taxableSubtotal = Math.max(0, subtotalCents - discountCents);
  if (sub.tax_id) {
    const taxRes = await query('SELECT * FROM taxes WHERE id = $1', [sub.tax_id]);
    if (taxRes.rows.length > 0) {
      const taxRate = parseFloat(taxRes.rows[0].rate_percent);
      taxCents = Math.round((taxableSubtotal * taxRate) / 100);
    }
  }

  const totalCents = Math.max(0, taxableSubtotal + taxCents);

  // Insert Invoice
  await query(
    `INSERT INTO invoices (
      id, invoice_number, customer_id, subscription_id, status,
      currency, subtotal_cents, discount_cents, tax_cents, total_cents,
      amount_paid_cents, amount_due_cents, issue_date, due_date,
      period_start, period_end, notes, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, 'open', $5, $6, $7, $8, $9, 0, $10, $11, $12, $13, $14, $15, $16, $17)`,
    [
      invoiceId,
      invoiceNumber,
      sub.customer_id,
      subscriptionId,
      sub.customer_currency || 'USD',
      subtotalCents,
      discountCents,
      taxCents,
      totalCents,
      totalCents, // amount due initially equals total
      now.toISOString(),
      dueDate.toISOString(),
      periodStart,
      periodEnd,
      isInitial ? 'Initial subscription invoice' : 'Renewal invoice',
      now.toISOString(),
      now.toISOString(),
    ]
  );

  // Insert Line Items
  for (const item of lineItems) {
    await query(
      `INSERT INTO invoice_items (id, invoice_id, description, item_type, quantity, unit_price_cents, total_cents, period_start, period_end, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        item.id,
        invoiceId,
        item.description,
        item.item_type,
        item.quantity,
        item.unit_price_cents,
        item.total_cents,
        item.period_start,
        item.period_end,
        now.toISOString(),
      ]
    );
  }

  return {
    id: invoiceId,
    invoiceNumber,
    customerId: sub.customer_id,
    subscriptionId,
    status: 'open',
    subtotalCents,
    discountCents,
    taxCents,
    totalCents,
    amountDueCents: totalCents,
    dueDate: dueDate.toISOString(),
    lineItems,
  };
}

/**
 * 3. UPGRADE / DOWNGRADE WITH MID-CYCLE PRORATION
 * Mathematical proration:
 * Computes exact unused days on current plan and prorated charge on new plan
 */
export async function changeSubscriptionPlan({
  subscriptionId,
  newPlanId,
  userId = null,
  ipAddress = null,
}) {
  const subRes = await query(
    `SELECT s.*, p.price_cents as old_price, p.name as old_name, p.billing_interval
     FROM subscriptions s
     JOIN plans p ON s.plan_id = p.id
     WHERE s.id = $1`,
    [subscriptionId]
  );

  if (subRes.rows.length === 0) throw new NotFoundError('Subscription not found.');
  const sub = subRes.rows[0];

  const newPlanRes = await query('SELECT * FROM plans WHERE id = $1 AND is_active = 1', [newPlanId]);
  if (newPlanRes.rows.length === 0) throw new NotFoundError('Target plan not found.');
  const newPlan = newPlanRes.rows[0];

  if (sub.plan_id === newPlanId) {
    throw new ValidationError('Subscription is already on this plan.');
  }

  const now = new Date();
  const periodStart = new Date(sub.current_period_start);
  const periodEnd = new Date(sub.current_period_end);

  const totalPeriodMs = periodEnd.getTime() - periodStart.getTime();
  const remainingMs = Math.max(0, periodEnd.getTime() - now.getTime());

  let netAdjustmentCents = 0;
  let prorationDesc = '';

  if (totalPeriodMs > 0 && remainingMs > 0) {
    const fractionRemaining = remainingMs / totalPeriodMs;
    const unusedCreditCents = Math.round(sub.old_price * fractionRemaining);
    const newPlanChargeCents = Math.round(newPlan.price_cents * fractionRemaining);

    netAdjustmentCents = newPlanChargeCents - unusedCreditCents;
    prorationDesc = `Plan change proration: Upgraded from ${sub.old_name} to ${newPlan.name} (${Math.round(fractionRemaining * 100)}% cycle remaining)`;
  }

  const nowIso = now.toISOString();

  // 1. Update Subscription plan_id
  await query(
    `UPDATE subscriptions SET plan_id = $1, updated_at = $2 WHERE id = $3`,
    [newPlanId, nowIso, subscriptionId]
  );

  // 2. If net positive adjustment (upgrade), generate immediate proration invoice!
  let prorationInvoice = null;
  if (netAdjustmentCents > 0) {
    const invoiceNumber = await generateInvoiceNumber();
    const invId = uuidv4();
    const dueDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

    await query(
      `INSERT INTO invoices (
        id, invoice_number, customer_id, subscription_id, status,
        currency, subtotal_cents, discount_cents, tax_cents, total_cents,
        amount_paid_cents, amount_due_cents, issue_date, due_date, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'open', 'USD', $5, 0, 0, $6, 0, $7, $8, $9, $10, $11, $12)`,
      [
        invId,
        invoiceNumber,
        sub.customer_id,
        subscriptionId,
        netAdjustmentCents,
        netAdjustmentCents,
        netAdjustmentCents,
        nowIso,
        dueDate,
        prorationDesc,
        nowIso,
        nowIso,
      ]
    );

    await query(
      `INSERT INTO invoice_items (id, invoice_id, description, item_type, quantity, unit_price_cents, total_cents, period_start, period_end, created_at)
       VALUES ($1, $2, $3, 'proration', 1, $4, $5, $6, $7, $8)`,
      [uuidv4(), invId, prorationDesc, netAdjustmentCents, netAdjustmentCents, nowIso, sub.current_period_end, nowIso]
    );

    prorationInvoice = { id: invId, invoiceNumber, amountDueCents: netAdjustmentCents };
  }

  await logAudit({
    userId,
    action: 'SUBSCRIPTION_PLAN_CHANGED',
    entityType: 'subscriptions',
    entityId: subscriptionId,
    details: {
      oldPlan: sub.old_name,
      newPlan: newPlan.name,
      netAdjustmentCents,
    },
    ipAddress,
  });

  return {
    subscriptionId,
    newPlan,
    netAdjustmentCents,
    prorationInvoice,
  };
}

/**
 * 4. PAUSE / RESUME / CANCEL
 */
export async function pauseSubscription(subscriptionId, { userId = null, ipAddress = null } = {}) {
  const now = new Date().toISOString();
  await query(
    `UPDATE subscriptions SET status = 'paused', paused_at = $1, updated_at = $2 WHERE id = $3`,
    [now, now, subscriptionId]
  );
  await logAudit({ userId, action: 'SUBSCRIPTION_PAUSED', entityType: 'subscriptions', entityId: subscriptionId, ipAddress });
  return { id: subscriptionId, status: 'paused' };
}

export async function resumeSubscription(subscriptionId, { userId = null, ipAddress = null } = {}) {
  const now = new Date().toISOString();
  await query(
    `UPDATE subscriptions SET status = 'active', paused_at = NULL, updated_at = $1 WHERE id = $2`,
    [now, subscriptionId]
  );
  await logAudit({ userId, action: 'SUBSCRIPTION_RESUMED', entityType: 'subscriptions', entityId: subscriptionId, ipAddress });
  return { id: subscriptionId, status: 'active' };
}

export async function cancelSubscription(subscriptionId, { immediate = false, userId = null, ipAddress = null } = {}) {
  const now = new Date().toISOString();
  if (immediate) {
    await query(
      `UPDATE subscriptions SET status = 'cancelled', cancelled_at = $1, cancel_at_period_end = 0, updated_at = $2 WHERE id = $3`,
      [now, now, subscriptionId]
    );
  } else {
    await query(
      `UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = $1 WHERE id = $2`,
      [now, subscriptionId]
    );
  }

  await logAudit({
    userId,
    action: immediate ? 'SUBSCRIPTION_CANCELLED_IMMEDIATE' : 'SUBSCRIPTION_CANCEL_SCHEDULED',
    entityType: 'subscriptions',
    entityId: subscriptionId,
    ipAddress,
  });

  return { id: subscriptionId, status: immediate ? 'cancelled' : 'active', cancelAtPeriodEnd: !immediate };
}

/**
 * 5. PAYMENTS & RECONCILIATION ENGINE
 */
export async function processPayment({
  invoiceId,
  paymentMethod = 'credit_card',
  amountCents = null,
  simulateFail = false,
  userId = null,
  ipAddress = null,
}) {
  const invRes = await query('SELECT * FROM invoices WHERE id = $1', [invoiceId]);
  if (invRes.rows.length === 0) throw new NotFoundError('Invoice not found.');
  const invoice = invRes.rows[0];

  if (invoice.status === 'paid') {
    throw new ValidationError('This invoice is already fully paid.');
  }

  const chargeAmount = amountCents !== null ? Math.round(amountCents) : invoice.amount_due_cents;
  if (chargeAmount <= 0) throw new ValidationError('Payment amount must be greater than 0.');

  const paymentId = uuidv4();
  const now = new Date().toISOString();

  if (simulateFail) {
    // Record failed payment
    const failTxId = `ch_fail_${uuidv4().slice(0, 8)}`;
    const failureReason = 'Card declined: Insufficient funds simulation';
    await query(
      `INSERT INTO payments (id, invoice_id, customer_id, amount_cents, currency, status, gateway_transaction_id, payment_method, failure_reason, created_at)
       VALUES ($1, $2, $3, $4, $5, 'failed', $6, $7, $8, $9)`,
      [paymentId, invoiceId, invoice.customer_id, chargeAmount, invoice.currency, failTxId, paymentMethod, failureReason, now]
    );

    // Update subscription to past_due if linked
    if (invoice.subscription_id) {
      await query(`UPDATE subscriptions SET status = 'past_due', updated_at = $1 WHERE id = $2`, [now, invoice.subscription_id]);
    }

    return { success: false, status: 'failed', reason: failureReason };
  }

  // Succeeded Payment
  const gatewayTxId = `ch_mock_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  await query(
    `INSERT INTO payments (id, invoice_id, customer_id, amount_cents, currency, status, gateway_transaction_id, payment_method, paid_at, created_at)
     VALUES ($1, $2, $3, $4, $5, 'succeeded', $6, $7, $8, $9)`,
    [paymentId, invoiceId, invoice.customer_id, chargeAmount, invoice.currency, gatewayTxId, paymentMethod, now, now]
  );

  const newAmountPaid = invoice.amount_paid_cents + chargeAmount;
  const newAmountDue = Math.max(0, invoice.total_cents - newAmountPaid);
  const isFullyPaid = newAmountDue === 0;

  await query(
    `UPDATE invoices SET
      amount_paid_cents = $1,
      amount_due_cents = $2,
      status = $3,
      paid_at = $4,
      updated_at = $5
     WHERE id = $6`,
    [
      newAmountPaid,
      newAmountDue,
      isFullyPaid ? 'paid' : 'open',
      isFullyPaid ? now : invoice.paid_at,
      now,
      invoiceId,
    ]
  );

  // If subscription was past_due, restore to active
  if (isFullyPaid && invoice.subscription_id) {
    await query(
      `UPDATE subscriptions SET status = 'active', updated_at = $1 WHERE id = $2 AND status = 'past_due'`,
      [now, invoice.subscription_id]
    );
  }

  await logAudit({
    userId,
    action: 'PAYMENT_PROCESSED',
    entityType: 'payments',
    entityId: paymentId,
    details: { invoiceId, amountCents: chargeAmount, gatewayTxId },
    ipAddress,
  });

  return {
    success: true,
    paymentId,
    gatewayTransactionId: gatewayTxId,
    amountCents: chargeAmount,
    invoiceStatus: isFullyPaid ? 'paid' : 'open',
    amountDueCents: newAmountDue,
  };
}

/**
 * Refund Payment (Admin ONLY)
 */
export async function refundPayment({ paymentId, amountCents = null, reason = 'Customer requested refund', adminUserId, ipAddress }) {
  const payRes = await query('SELECT * FROM payments WHERE id = $1', [paymentId]);
  if (payRes.rows.length === 0) throw new NotFoundError('Payment record not found.');
  const payment = payRes.rows[0];

  if (payment.status !== 'succeeded') {
    throw new ValidationError('Only successful payments can be refunded.');
  }

  const availableToRefund = payment.amount_cents - payment.refunded_amount_cents;
  const refundAmount = amountCents ? Math.round(amountCents) : availableToRefund;

  if (refundAmount <= 0 || refundAmount > availableToRefund) {
    throw new ValidationError(`Refund amount must be between 1 and ${availableToRefund} cents.`);
  }

  const now = new Date().toISOString();
  const totalRefunded = payment.refunded_amount_cents + refundAmount;
  const newStatus = totalRefunded >= payment.amount_cents ? 'refunded' : 'succeeded';

  await query(
    `UPDATE payments SET refunded_amount_cents = $1, status = $2 WHERE id = $3`,
    [totalRefunded, newStatus, paymentId]
  );

  // Adjust invoice amounts
  const invRes = await query('SELECT * FROM invoices WHERE id = $1', [payment.invoice_id]);
  if (invRes.rows.length > 0) {
    const inv = invRes.rows[0];
    const newPaid = Math.max(0, inv.amount_paid_cents - refundAmount);
    const newDue = inv.total_cents - newPaid;
    await query(
      `UPDATE invoices SET amount_paid_cents = $1, amount_due_cents = $2, status = 'open', updated_at = $3 WHERE id = $4`,
      [newPaid, newDue, now, inv.id]
    );
  }

  await logAudit({
    userId: adminUserId,
    action: 'PAYMENT_REFUNDED',
    entityType: 'payments',
    entityId: paymentId,
    details: { refundAmountCents: refundAmount, reason },
    ipAddress,
  });

  return {
    paymentId,
    refundedAmountCents: refundAmount,
    totalRefundedCents: totalRefunded,
    status: newStatus,
  };
}

/**
 * 6. REVENUE REPORTING & METRICS ENGINE
 */
export async function getRevenueMetrics() {
  // 1. Calculate MRR & ARR from active subscriptions
  const activeSubs = await query(
    `SELECT s.id, p.price_cents, p.billing_interval, p.interval_count
     FROM subscriptions s
     JOIN plans p ON s.plan_id = p.id
     WHERE s.status IN ('active', 'past_due')`
  );

  let totalMrrCents = 0;
  for (const sub of activeSubs.rows) {
    let subMrr = sub.price_cents;
    if (sub.billing_interval === 'yearly') {
      subMrr = Math.round(sub.price_cents / (12 * (sub.interval_count || 1)));
    }

    // Add addons MRR
    const addonsRes = await query(
      `SELECT sa.quantity, sa.unit_price_cents, a.billing_interval
       FROM subscription_addons sa
       JOIN addons a ON sa.addon_id = a.id
       WHERE sa.subscription_id = $1`,
      [sub.id]
    );

    for (const addon of addonsRes.rows) {
      const addonTotal = addon.unit_price_cents * addon.quantity;
      if (addon.billing_interval === 'yearly') {
        subMrr += Math.round(addonTotal / 12);
      } else if (addon.billing_interval === 'monthly') {
        subMrr += addonTotal;
      }
    }

    totalMrrCents += subMrr;
  }

  const arrCents = totalMrrCents * 12;

  // 2. Active Customers count
  const custCountRes = await query(
    `SELECT COUNT(DISTINCT customer_id) as count FROM subscriptions WHERE status = 'active'`
  );
  const activeCustomers = parseInt(custCountRes.rows[0].count || '0', 10);

  // 3. Churn calculation (last 30 days)
  const churnRes = await query(
    `SELECT COUNT(*) as count FROM subscriptions WHERE status = 'cancelled'`
  );
  const cancelledCount = parseInt(churnRes.rows[0].count || '0', 10);
  const totalAllSubs = activeSubs.rows.length + cancelledCount;
  const churnRate = totalAllSubs > 0 ? ((cancelledCount / totalAllSubs) * 100).toFixed(1) : 0;

  // 4. Accounts Receivable Aging
  const now = new Date().toISOString();
  const arAgingRes = await query(
    `SELECT
      SUM(CASE WHEN due_date >= $1 THEN amount_due_cents ELSE 0 END) as current_due,
      SUM(CASE WHEN due_date < $1 THEN amount_due_cents ELSE 0 END) as overdue
     FROM invoices
     WHERE status = 'open'`,
    [now]
  );

  const currentDueCents = parseInt(arAgingRes.rows[0].current_due || '0', 10);
  const overdueCents = parseInt(arAgingRes.rows[0].overdue || '0', 10);

  // 5. Revenue by Plan breakdown
  const planBreakdownRes = await query(
    `SELECT p.name, p.code, COUNT(s.id) as subscriber_count, SUM(p.price_cents) as total_nominal_cents
     FROM subscriptions s
     JOIN plans p ON s.plan_id = p.id
     WHERE s.status = 'active'
     GROUP BY p.id, p.name, p.code`
  );

  return {
    mrrCents: totalMrrCents,
    arrCents,
    activeSubscribers: activeSubs.rows.length,
    activeCustomers,
    churnRate: parseFloat(churnRate),
    accountsReceivable: {
      currentDueCents,
      overdueCents,
      totalOutstandingCents: currentDueCents + overdueCents,
    },
    revenueByPlan: planBreakdownRes.rows.map((r) => ({
      name: r.name,
      code: r.code,
      subscribers: parseInt(r.subscriber_count, 10),
      totalNominalCents: parseInt(r.total_nominal_cents || '0', 10),
    })),
  };
}
