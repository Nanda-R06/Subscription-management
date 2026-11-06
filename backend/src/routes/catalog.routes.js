import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as catalogService from '../services/catalog.service.js';

const router = express.Router();

/**
 * GET /api/v1/catalog/products
 * Public / Authenticated: View available products with variants and plans
 */
router.get('/products', async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const products = await catalogService.listProducts({ includeInactive });
    res.json({ success: true, data: products });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/catalog/products
 * ADMIN ONLY: Create a product
 */
router.post('/products', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const product = await catalogService.createProduct({
      name,
      description,
      adminUserId: req.user.id,
      ipAddress,
    });

    res.status(201).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/catalog/products/:id/variants
 * ADMIN ONLY: Create a variant
 */
router.post('/products/:id/variants', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const productId = req.params.id;
    const { name, sku, description } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const variant = await catalogService.createVariant({
      productId,
      name,
      sku,
      description,
      adminUserId: req.user.id,
      ipAddress,
    });

    res.status(201).json({ success: true, data: variant });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/catalog/variants/:id/plans
 * ADMIN ONLY: Create a billing plan
 */
router.post('/variants/:id/plans', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const variantId = req.params.id;
    const { name, code, billingInterval, intervalCount, priceCents, currency, trialDays } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const plan = await catalogService.createPlan({
      variantId,
      name,
      code,
      billingInterval,
      intervalCount,
      priceCents,
      currency,
      trialDays,
      adminUserId: req.user.id,
      ipAddress,
    });

    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/catalog/addons
 * Authenticated: List add-ons
 */
router.get('/addons', requireAuth, async (req, res, next) => {
  try {
    const addons = await catalogService.listAddons();
    res.json({ success: true, data: addons });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/catalog/addons
 * ADMIN ONLY: Create add-on
 */
router.post('/addons', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { productId, name, code, priceCents, billingInterval } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const addon = await catalogService.createAddon({
      productId,
      name,
      code,
      priceCents,
      billingInterval,
      adminUserId: req.user.id,
      ipAddress,
    });

    res.status(201).json({ success: true, data: addon });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/catalog/taxes
 * Staff & Admin: View taxes
 */
router.get('/taxes', requireAuth, requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const taxes = await catalogService.listTaxes();
    res.json({ success: true, data: taxes });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/catalog/taxes
 * ADMIN ONLY: Create tax rate
 */
router.post('/taxes', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, ratePercent, country, region } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const tax = await catalogService.createTax({
      name,
      ratePercent,
      country,
      region,
      adminUserId: req.user.id,
      ipAddress,
    });

    res.status(201).json({ success: true, data: tax });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/catalog/discounts
 * Staff & Admin: View discount codes
 */
router.get('/discounts', requireAuth, requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    const discounts = await catalogService.listDiscounts();
    res.json({ success: true, data: discounts });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/catalog/discounts
 * ADMIN ONLY: Create discount coupon
 */
router.post('/discounts', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { code, discountType, discountValue, currency, maxRedemptions, validFrom, validTo } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const discount = await catalogService.createDiscount({
      code,
      discountType,
      discountValue,
      currency,
      maxRedemptions,
      validFrom,
      validTo,
      adminUserId: req.user.id,
      ipAddress,
    });

    res.status(201).json({ success: true, data: discount });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/catalog/discounts/validate
 * Customer / Staff / Admin: Validate coupon code for checkout
 */
router.post('/discounts/validate', requireAuth, async (req, res, next) => {
  try {
    const { code } = req.body;
    const discount = await catalogService.validateDiscountCode(code);
    res.json({ success: true, data: discount });
  } catch (err) {
    next(err);
  }
});

export default router;
