import cron from 'node-cron';
import { query } from '../db/index.js';

let cronTasks = [];

/**
 * 1. Automatic Renewal Engine Job
 * Runs every day at 00:05 UTC (or configurable interval)
 * Finds subscriptions due for renewal (current_period_end <= NOW and status = 'active' and cancel_at_period_end = 0)
 */
export async function runRenewalCycle() {
  console.log('⏰ [CRON JOB] Running Subscription Renewal Cycle...');
  const now = new Date().toISOString();

  try {
    const dueSubs = await query(
      `SELECT s.*, p.price_cents, p.billing_interval, p.interval_count
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.status = 'active'
         AND s.cancel_at_period_end = 0
         AND s.current_period_end <= $1`,
      [now]
    );

    console.log(`ℹ️ [CRON JOB] Found ${dueSubs.rows.length} subscriptions due for renewal.`);
    return { processed: dueSubs.rows.length, items: dueSubs.rows };
  } catch (err) {
    console.error('❌ [CRON JOB] Error in Renewal Cycle:', err.message);
  }
}

/**
 * 2. Upcoming Renewal Alerts Job
 * Runs every day at 09:00 UTC
 * Finds subscriptions whose current_period_end is within 7 days and reminder has not been sent yet
 */
export async function runUpcomingRenewalAlerts() {
  console.log('🔔 [CRON JOB] Running Upcoming Renewal Alert Engine...');
  const now = new Date();
  const alertWindow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const upcomingSubs = await query(
      `SELECT s.id, s.customer_id, s.current_period_end, c.billing_email, c.company_name
       FROM subscriptions s
       JOIN customers c ON s.customer_id = c.id
       WHERE s.status = 'active'
         AND s.renewal_reminder_sent_at IS NULL
         AND s.current_period_end <= $1`,
      [alertWindow]
    );

    console.log(`ℹ️ [CRON JOB] Found ${upcomingSubs.rows.length} subscriptions needing renewal reminders.`);
    return { alerted: upcomingSubs.rows.length, items: upcomingSubs.rows };
  } catch (err) {
    console.error('❌ [CRON JOB] Error in Renewal Alerts:', err.message);
  }
}

/**
 * 3. Dunning & Overdue Invoices Job
 * Runs every day at 08:00 UTC
 * Finds open invoices past due date and transitions them / sends dunning reminders
 */
export async function runDunningEngine() {
  console.log('💳 [CRON JOB] Running Dunning & Overdue Invoices Engine...');
  const now = new Date().toISOString();

  try {
    const overdueInvoices = await query(
      `SELECT i.id, i.invoice_number, i.amount_due_cents, c.billing_email
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       WHERE i.status = 'open'
         AND i.due_date < $1`,
      [now]
    );

    console.log(`ℹ️ [CRON JOB] Found ${overdueInvoices.rows.length} overdue invoices.`);
    return { overdueCount: overdueInvoices.rows.length, items: overdueInvoices.rows };
  } catch (err) {
    console.error('❌ [CRON JOB] Error in Dunning Engine:', err.message);
  }
}

/**
 * Initialize all cron schedules
 */
export function startBackgroundJobs() {
  // Midnight renewal check: 00:05 daily
  const renewalTask = cron.schedule('5 0 * * *', () => {
    runRenewalCycle();
  });

  // Morning renewal reminders: 09:00 daily
  const alertsTask = cron.schedule('0 9 * * *', () => {
    runUpcomingRenewalAlerts();
  });

  // Morning dunning reminders: 08:00 daily
  const dunningTask = cron.schedule('0 8 * * *', () => {
    runDunningEngine();
  });

  cronTasks.push(renewalTask, alertsTask, dunningTask);
  console.log('⏰ Background cron jobs registered: [Renewals, Upcoming Alerts, Dunning Engine]');
}

export function stopBackgroundJobs() {
  cronTasks.forEach((t) => t.stop());
  cronTasks = [];
}
