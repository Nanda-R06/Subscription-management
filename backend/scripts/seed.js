import { v4 as uuidv4 } from 'uuid';
import { closeDb, initDb, query } from '../src/db/index.js';
import { hashPassword } from '../src/utils/password.js';

async function seed() {
  console.log('🌱 Starting Brightloop Billing Database Seeder...');
  await initDb();

  const now = new Date().toISOString();
  const passwordHash = await hashPassword('Password123!');

  try {
    // Check if admin user already exists
    const existingAdmin = await query("SELECT id FROM users WHERE email = 'admin@brightloop.io'");
    if (existingAdmin.rows.length > 0) {
      console.log('ℹ️ Default seed users and catalog already present.');
      console.log('\n=========================================');
      console.log('✅ Brightloop Billing Ready!');
      console.log('=========================================');
      console.log('Demo Credentials:');
      console.log('  👑 Admin:     admin@brightloop.io / Password123!');
      console.log('  💼 Staff:     staff@brightloop.io / Password123!');
      console.log('  🏢 Customer:  alex@acmecorp.com / Password123!');
      console.log('=========================================\n');
      return;
    }

    // 1. Seed Users (Admin, Staff, Customer)
    console.log('👤 Seeding default users...');

    // Admin
    const adminId = uuidv4();
    await query(
      `INSERT INTO users (id, email, password_hash, role, first_name, last_name, is_active, created_at, updated_at)
       VALUES ($1, 'admin@brightloop.io', $2, 'admin', 'Sarah', 'Connor', 1, $3, $4)`,
      [adminId, passwordHash, now, now]
    );

    // Staff
    const staffId = uuidv4();
    await query(
      `INSERT INTO users (id, email, password_hash, role, first_name, last_name, is_active, created_at, updated_at)
       VALUES ($1, 'staff@brightloop.io', $2, 'staff', 'John', 'Stafford', 1, $3, $4)`,
      [staffId, passwordHash, now, now]
    );

    // Customer User
    const customerUserId = uuidv4();
    await query(
      `INSERT INTO users (id, email, password_hash, role, first_name, last_name, is_active, created_at, updated_at)
       VALUES ($1, 'alex@acmecorp.com', $2, 'customer', 'Alex', 'Vance', 1, $3, $4)`,
      [customerUserId, passwordHash, now, now]
    );

    // 2. Seed Customer Record
    console.log('🏢 Seeding customer profile...');
    const customerId = uuidv4();
    await query(
      `INSERT INTO customers (id, user_id, company_name, billing_email, phone, tax_identifier, billing_city, billing_country, currency, created_at, updated_at)
       VALUES ($1, $2, 'Acme Corporation', 'alex@acmecorp.com', '+1-555-0199', 'US-TAX-88991', 'San Francisco', 'US', 'USD', $3, $4)`,
      [customerId, customerUserId, now, now]
    );

    // 3. Seed Catalog: Product, Variant, Plans, Addons, Taxes, Discounts
    console.log('📦 Seeding product catalog...');
    const productId = uuidv4();
    await query(
      `INSERT INTO products (id, name, description, is_active, created_at, updated_at)
       VALUES ($1, 'Brightloop Analytics Suite', 'All-in-one recurring revenue analytics and subscription intelligence.', 1, $2, $3)`,
      [productId, now, now]
    );

    const variantId = uuidv4();
    await query(
      `INSERT INTO product_variants (id, product_id, name, sku, description, is_active, created_at, updated_at)
       VALUES ($1, $2, 'Cloud Hosted (Multi-Tenant)', 'BL-ANALYTICS-CLOUD', 'Fully managed cloud edition with automated failover.', 1, $3, $4)`,
      [variantId, productId, now, now]
    );

    // Plans
    const starterPlanId = uuidv4();
    await query(
      `INSERT INTO plans (id, variant_id, name, code, billing_interval, interval_count, price_cents, currency, trial_days, is_active, created_at, updated_at)
       VALUES ($1, $2, 'Starter Monthly', 'starter_monthly', 'monthly', 1, 4900, 'USD', 0, 1, $3, $4)`,
      [starterPlanId, variantId, now, now]
    );

    const proPlanId = uuidv4();
    await query(
      `INSERT INTO plans (id, variant_id, name, code, billing_interval, interval_count, price_cents, currency, trial_days, is_active, created_at, updated_at)
       VALUES ($1, $2, 'Pro Monthly', 'pro_monthly', 'monthly', 1, 14900, 'USD', 0, 1, $3, $4)`,
      [proPlanId, variantId, now, now]
    );

    const entPlanId = uuidv4();
    await query(
      `INSERT INTO plans (id, variant_id, name, code, billing_interval, interval_count, price_cents, currency, trial_days, is_active, created_at, updated_at)
       VALUES ($1, $2, 'Enterprise Yearly', 'ent_yearly', 'yearly', 1, 118800, 'USD', 14, 1, $3, $4)`,
      [entPlanId, variantId, now, now]
    );

    // Addons
    const addonSlaId = uuidv4();
    await query(
      `INSERT INTO addons (id, product_id, name, code, price_cents, billing_interval, is_active, created_at, updated_at)
       VALUES ($1, $2, 'Priority 24/7 SLA Support', 'addon_sla', 9900, 'monthly', 1, $3, $4)`,
      [addonSlaId, productId, now, now]
    );

    const addonApiId = uuidv4();
    await query(
      `INSERT INTO addons (id, product_id, name, code, price_cents, billing_interval, is_active, created_at, updated_at)
       VALUES ($1, $2, 'Extra 50,000 API Calls', 'addon_api_50k', 2900, 'monthly', 1, $3, $4)`,
      [addonApiId, productId, now, now]
    );

    // Taxes
    const taxId = uuidv4();
    await query(
      `INSERT INTO taxes (id, name, rate_percent, country, region, is_active, created_at, updated_at)
       VALUES ($1, 'California Sales Tax', 8.25, 'US', 'CA', 1, $2, $3)`,
      [taxId, now, now]
    );

    // Discounts
    const discountId = uuidv4();
    await query(
      `INSERT INTO discounts (id, code, discount_type, discount_value, currency, max_redemptions, times_redeemed, is_active, created_at, updated_at)
       VALUES ($1, 'LAUNCH20', 'percent', 20, 'USD', 100, 1, 1, $2, $3)`,
      [discountId, now, now]
    );

    // 4. Seed Active Subscription for Alex / Acme Corp
    console.log('🔄 Seeding subscription...');
    const periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const subId = uuidv4();

    await query(
      `INSERT INTO subscriptions (id, customer_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at)
       VALUES ($1, $2, $3, 'active', $4, $5, $6, $7)`,
      [subId, customerId, proPlanId, periodStart, periodEnd, now, now]
    );

    // 5. Seed Invoices & Payments
    console.log('🧾 Seeding sample invoices and payment history...');
    const invoice1Id = uuidv4();
    await query(
      `INSERT INTO invoices (id, invoice_number, customer_id, subscription_id, status, currency, subtotal_cents, discount_cents, tax_cents, total_cents, amount_paid_cents, amount_due_cents, issue_date, due_date, paid_at, period_start, period_end, notes, created_at, updated_at)
       VALUES ($1, 'INV-2026-0001', $2, $3, 'paid', 'USD', 14900, 0, 1229, 16129, 16129, 0, $4, $5, $6, $7, $8, 'Monthly Pro Subscription', $9, $10)`,
      [invoice1Id, customerId, subId, periodStart, periodStart, periodStart, periodStart, periodEnd, now, now]
    );

    // Invoice Item
    await query(
      `INSERT INTO invoice_items (id, invoice_id, description, item_type, quantity, unit_price_cents, total_cents, created_at)
       VALUES ($1, $2, 'Pro Monthly Subscription (Initial Cycle)', 'plan', 1, 14900, 14900, $3)`,
      [uuidv4(), invoice1Id, now]
    );

    // Payment for Invoice 1
    await query(
      `INSERT INTO payments (id, invoice_id, customer_id, amount_cents, currency, status, gateway_transaction_id, payment_method, paid_at, created_at)
       VALUES ($1, $2, $3, 16129, 'USD', 'succeeded', 'ch_mock_99182312', 'credit_card', $4, $5)`,
      [uuidv4(), invoice1Id, customerId, periodStart, now]
    );

    // Invoice 2 (Open / upcoming)
    const invoice2Id = uuidv4();
    const nextDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await query(
      `INSERT INTO invoices (id, invoice_number, customer_id, subscription_id, status, currency, subtotal_cents, discount_cents, tax_cents, total_cents, amount_paid_cents, amount_due_cents, issue_date, due_date, notes, created_at, updated_at)
       VALUES ($1, 'INV-2026-0002', $2, $3, 'open', 'USD', 14900, 0, 1229, 16129, 0, 16129, $4, $5, 'Monthly Pro Subscription Renewal', $6, $7)`,
      [invoice2Id, customerId, subId, now, nextDueDate, now, now]
    );

    console.log('\n=========================================');
    console.log('✅ Brightloop Billing Seed Complete!');
    console.log('=========================================');
    console.log('Demo Credentials:');
    console.log('  👑 Admin:     admin@brightloop.io / Password123!');
    console.log('  💼 Staff:     staff@brightloop.io / Password123!');
    console.log('  🏢 Customer:  alex@acmecorp.com / Password123!');
    console.log('=========================================\n');
  } catch (err) {
    console.error('❌ Seeding error:', err);
  } finally {
    await closeDb();
  }
}

seed();
