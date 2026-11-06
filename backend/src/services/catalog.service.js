import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import { logAudit } from './audit.service.js';

/**
 * 1. PRODUCTS
 */
export async function listProducts({ includeInactive = false } = {}) {
  const sql = includeInactive
    ? `SELECT * FROM products ORDER BY created_at DESC`
    : `SELECT * FROM products WHERE is_active = 1 ORDER BY created_at DESC`;

  const result = await query(sql);

  // Fetch variants and plans for each product
  const products = [];
  for (const p of result.rows) {
    const variantsRes = await query(
      `SELECT * FROM product_variants WHERE product_id = $1 ${includeInactive ? '' : 'AND is_active = 1'}`,
      [p.id]
    );

    const variants = [];
    for (const v of variantsRes.rows) {
      const plansRes = await query(
        `SELECT * FROM plans WHERE variant_id = $1 ${includeInactive ? '' : 'AND is_active = 1'}`,
        [v.id]
      );
      variants.push({
        ...v,
        plans: plansRes.rows,
      });
    }

    const addonsRes = await query(
      `SELECT * FROM addons WHERE product_id = $1 ${includeInactive ? '' : 'AND is_active = 1'}`,
      [p.id]
    );

    products.push({
      ...p,
      variants,
      addons: addonsRes.rows,
    });
  }

  return products;
}

export async function createProduct({ name, description, adminUserId, ipAddress }) {
  if (!name || !name.trim()) {
    throw new ValidationError('Product name is required.');
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  await query(
    `INSERT INTO products (id, name, description, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, 1, $4, $5)`,
    [id, name.trim(), description || null, now, now]
  );

  await logAudit({
    userId: adminUserId,
    action: 'PRODUCT_CREATED',
    entityType: 'products',
    entityId: id,
    details: { name },
    ipAddress,
  });

  return { id, name: name.trim(), description, isActive: true, createdAt: now };
}

/**
 * 2. PRODUCT VARIANTS
 */
export async function createVariant({ productId, name, sku, description, adminUserId, ipAddress }) {
  if (!productId) throw new ValidationError('Product ID is required.');
  if (!name || !name.trim()) throw new ValidationError('Variant name is required.');

  const product = await query('SELECT id FROM products WHERE id = $1', [productId]);
  if (product.rows.length === 0) throw new NotFoundError('Product not found.');

  if (sku) {
    const existing = await query('SELECT id FROM product_variants WHERE sku = $1', [sku.trim()]);
    if (existing.rows.length > 0) throw new ConflictError('Variant with this SKU already exists.');
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  await query(
    `INSERT INTO product_variants (id, product_id, name, sku, description, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 1, $6, $7)`,
    [id, productId, name.trim(), sku ? sku.trim() : null, description || null, now, now]
  );

  await logAudit({
    userId: adminUserId,
    action: 'VARIANT_CREATED',
    entityType: 'product_variants',
    entityId: id,
    details: { productId, name, sku },
    ipAddress,
  });

  return { id, productId, name: name.trim(), sku, description, isActive: true };
}

/**
 * 3. PLANS (Pricing in minor units / cents)
 */
export async function createPlan({
  variantId,
  name,
  code,
  billingInterval = 'monthly',
  intervalCount = 1,
  priceCents,
  currency = 'USD',
  trialDays = 0,
  adminUserId,
  ipAddress,
}) {
  if (!variantId) throw new ValidationError('Variant ID is required.');
  if (!name || !name.trim()) throw new ValidationError('Plan name is required.');
  if (!code || !code.trim()) throw new ValidationError('Plan code is required.');
  if (priceCents === undefined || priceCents === null || isNaN(priceCents) || priceCents < 0) {
    throw new ValidationError('Price in cents must be a non-negative integer.');
  }
  if (!['monthly', 'yearly'].includes(billingInterval)) {
    throw new ValidationError('Billing interval must be either "monthly" or "yearly".');
  }

  const cleanCode = code.trim().toLowerCase();
  const existing = await query('SELECT id FROM plans WHERE code = $1', [cleanCode]);
  if (existing.rows.length > 0) {
    throw new ConflictError('A plan with this code already exists.');
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  await query(
    `INSERT INTO plans (id, variant_id, name, code, billing_interval, interval_count, price_cents, currency, trial_days, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, $11)`,
    [
      id,
      variantId,
      name.trim(),
      cleanCode,
      billingInterval,
      parseInt(intervalCount, 10) || 1,
      Math.round(priceCents),
      currency.toUpperCase(),
      parseInt(trialDays, 10) || 0,
      now,
      now,
    ]
  );

  await logAudit({
    userId: adminUserId,
    action: 'PLAN_CREATED',
    entityType: 'plans',
    entityId: id,
    details: { code: cleanCode, priceCents: Math.round(priceCents), billingInterval },
    ipAddress,
  });

  return {
    id,
    variantId,
    name: name.trim(),
    code: cleanCode,
    billingInterval,
    intervalCount,
    priceCents: Math.round(priceCents),
    currency: currency.toUpperCase(),
    trialDays,
    isActive: true,
  };
}

/**
 * 4. ADD-ONS
 */
export async function createAddon({
  productId,
  name,
  code,
  priceCents,
  billingInterval = 'monthly',
  adminUserId,
  ipAddress,
}) {
  if (!productId) throw new ValidationError('Product ID is required.');
  if (!name || !name.trim()) throw new ValidationError('Addon name is required.');
  if (!code || !code.trim()) throw new ValidationError('Addon code is required.');
  if (priceCents === undefined || isNaN(priceCents) || priceCents < 0) {
    throw new ValidationError('Price in cents must be a non-negative integer.');
  }

  const cleanCode = code.trim().toLowerCase();
  const existing = await query('SELECT id FROM addons WHERE code = $1', [cleanCode]);
  if (existing.rows.length > 0) {
    throw new ConflictError('An addon with this code already exists.');
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  await query(
    `INSERT INTO addons (id, product_id, name, code, price_cents, billing_interval, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8)`,
    [id, productId, name.trim(), cleanCode, Math.round(priceCents), billingInterval, now, now]
  );

  await logAudit({
    userId: adminUserId,
    action: 'ADDON_CREATED',
    entityType: 'addons',
    entityId: id,
    details: { code: cleanCode, priceCents: Math.round(priceCents) },
    ipAddress,
  });

  return { id, productId, name: name.trim(), code: cleanCode, priceCents: Math.round(priceCents), billingInterval, isActive: true };
}

export async function listAddons() {
  const result = await query('SELECT * FROM addons WHERE is_active = 1 ORDER BY name ASC');
  return result.rows;
}

/**
 * 5. TAXES
 */
export async function createTax({ name, ratePercent, country = 'US', region = null, adminUserId, ipAddress }) {
  if (!name || !name.trim()) throw new ValidationError('Tax name is required.');
  if (ratePercent === undefined || isNaN(ratePercent) || ratePercent < 0 || ratePercent > 100) {
    throw new ValidationError('Tax rate must be between 0 and 100 percent.');
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  await query(
    `INSERT INTO taxes (id, name, rate_percent, country, region, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 1, $6, $7)`,
    [id, name.trim(), parseFloat(ratePercent), country, region, now, now]
  );

  await logAudit({
    userId: adminUserId,
    action: 'TAX_RATE_CREATED',
    entityType: 'taxes',
    entityId: id,
    details: { name, ratePercent: parseFloat(ratePercent) },
    ipAddress,
  });

  return { id, name: name.trim(), ratePercent: parseFloat(ratePercent), country, region, isActive: true };
}

export async function listTaxes() {
  const result = await query('SELECT * FROM taxes WHERE is_active = 1 ORDER BY name ASC');
  return result.rows;
}

/**
 * 6. DISCOUNTS (Percentage or Fixed amount in cents)
 */
export async function createDiscount({
  code,
  discountType,
  discountValue,
  currency = 'USD',
  maxRedemptions = null,
  validFrom = null,
  validTo = null,
  adminUserId,
  ipAddress,
}) {
  if (!code || !code.trim()) throw new ValidationError('Discount code is required.');
  if (!['percent', 'fixed'].includes(discountType)) {
    throw new ValidationError('Discount type must be "percent" or "fixed".');
  }
  if (discountValue === undefined || isNaN(discountValue) || discountValue <= 0) {
    throw new ValidationError('Discount value must be greater than 0.');
  }
  if (discountType === 'percent' && discountValue > 100) {
    throw new ValidationError('Percentage discount cannot exceed 100%.');
  }

  const cleanCode = code.trim().toUpperCase();
  const existing = await query('SELECT id FROM discounts WHERE code = $1', [cleanCode]);
  if (existing.rows.length > 0) {
    throw new ConflictError('A discount with this coupon code already exists.');
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  await query(
    `INSERT INTO discounts (id, code, discount_type, discount_value, currency, max_redemptions, times_redeemed, valid_from, valid_to, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, 1, $9, $10)`,
    [
      id,
      cleanCode,
      discountType,
      Math.round(discountValue),
      currency.toUpperCase(),
      maxRedemptions ? parseInt(maxRedemptions, 10) : null,
      validFrom || null,
      validTo || null,
      now,
      now,
    ]
  );

  await logAudit({
    userId: adminUserId,
    action: 'DISCOUNT_CREATED',
    entityType: 'discounts',
    entityId: id,
    details: { code: cleanCode, discountType, discountValue },
    ipAddress,
  });

  return {
    id,
    code: cleanCode,
    discountType,
    discountValue: Math.round(discountValue),
    currency: currency.toUpperCase(),
    maxRedemptions,
    isActive: true,
  };
}

export async function listDiscounts() {
  const result = await query('SELECT * FROM discounts WHERE is_active = 1 ORDER BY created_at DESC');
  return result.rows;
}

export async function validateDiscountCode(code) {
  if (!code) throw new ValidationError('Discount code is required.');

  const result = await query(
    `SELECT * FROM discounts WHERE code = $1 AND is_active = 1`,
    [code.trim().toUpperCase()]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('Invalid discount coupon code.');
  }

  const discount = result.rows[0];
  const now = new Date();

  if (discount.valid_from && new Date(discount.valid_from) > now) {
    throw new ValidationError('This discount code is not yet active.');
  }
  if (discount.valid_to && new Date(discount.valid_to) < now) {
    throw new ValidationError('This discount code has expired.');
  }
  if (discount.max_redemptions && discount.times_redeemed >= discount.max_redemptions) {
    throw new ValidationError('This discount code has reached its maximum redemption limit.');
  }

  return discount;
}
