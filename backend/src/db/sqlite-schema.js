export const SQLITE_INIT_SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'customer')),
    first_name TEXT,
    last_name TEXT,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token_hash);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE,
    company_name TEXT NOT NULL,
    billing_email TEXT NOT NULL,
    phone TEXT,
    tax_identifier TEXT,
    billing_address_line1 TEXT,
    billing_address_line2 TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_postal_code TEXT,
    billing_country TEXT DEFAULT 'US',
    currency TEXT DEFAULT 'USD' NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_billing_email ON customers(billing_email);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    description TEXT,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    variant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'yearly')),
    interval_count INTEGER DEFAULT 1 NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    currency TEXT DEFAULT 'USD' NOT NULL,
    trial_days INTEGER DEFAULT 0 NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_plans_variant_id ON plans(variant_id);
CREATE INDEX IF NOT EXISTS idx_plans_code ON plans(code);

CREATE TABLE IF NOT EXISTS addons (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    billing_interval TEXT DEFAULT 'monthly' NOT NULL CHECK (billing_interval IN ('monthly', 'yearly', 'one_time')),
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS taxes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rate_percent REAL NOT NULL CHECK (rate_percent >= 0 AND rate_percent <= 100),
    country TEXT,
    region TEXT,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS discounts (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
    discount_value INTEGER NOT NULL CHECK (discount_value > 0),
    currency TEXT DEFAULT 'USD' NOT NULL,
    max_redemptions INTEGER,
    times_redeemed INTEGER DEFAULT 0 NOT NULL,
    valid_from TEXT,
    valid_to TEXT,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    discount_id TEXT,
    tax_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('trial', 'active', 'past_due', 'paused', 'cancelled')),
    current_period_start TEXT NOT NULL,
    current_period_end TEXT NOT NULL,
    trial_start TEXT,
    trial_end TEXT,
    cancel_at_period_end INTEGER DEFAULT 0 NOT NULL,
    cancelled_at TEXT,
    paused_at TEXT,
    renewal_reminder_sent_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (plan_id) REFERENCES plans(id),
    FOREIGN KEY (discount_id) REFERENCES discounts(id),
    FOREIGN KEY (tax_id) REFERENCES taxes(id)
);

CREATE INDEX IF NOT EXISTS idx_subs_customer_id ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status);

CREATE TABLE IF NOT EXISTS subscription_addons (
    id TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL,
    addon_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1 NOT NULL CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
    created_at TEXT NOT NULL,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (addon_id) REFERENCES addons(id)
);

CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    customer_id TEXT NOT NULL,
    subscription_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'uncollectible', 'void')),
    currency TEXT DEFAULT 'USD' NOT NULL,
    subtotal_cents INTEGER NOT NULL,
    discount_cents INTEGER DEFAULT 0 NOT NULL,
    tax_cents INTEGER DEFAULT 0 NOT NULL,
    total_cents INTEGER NOT NULL,
    amount_paid_cents INTEGER DEFAULT 0 NOT NULL,
    amount_due_cents INTEGER NOT NULL,
    issue_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    paid_at TEXT,
    period_start TEXT,
    period_end TEXT,
    pdf_path TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    description TEXT NOT NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('plan', 'addon', 'proration', 'tax', 'discount', 'adjustment')),
    quantity INTEGER DEFAULT 1 NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    total_cents INTEGER NOT NULL,
    period_start TEXT,
    period_end TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT DEFAULT 'USD' NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed', 'refunded', 'pending')),
    gateway_transaction_id TEXT,
    payment_method TEXT DEFAULT 'credit_card',
    failure_reason TEXT,
    paid_at TEXT,
    refunded_amount_cents INTEGER DEFAULT 0 NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
`;
