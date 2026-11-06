# Brightloop Billing — REST API Specification

All API endpoints follow a unified base URL convention: `/api/v1`.
Authentication is passed via the standard `Authorization: Bearer <access_token>` header.
Standard JSON responses follow a uniform shape:
```json
// Successful response:
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 100 } // on paginated responses
}

// Error response:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT",
    "message": "Human readable explanation",
    "details": [ ... ]
  }
}
```

---

## 1. Authentication & User Management (Scene 1)

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/signup` | Public | Customer signup with email & password (enforces min 9 chars, upper, lower, special). |
| `POST` | `/api/v1/auth/login` | Public | Authenticates credentials, returns short-lived JWT access token and sets/returns refresh token. |
| `POST` | `/api/v1/auth/refresh-token` | Public | Rotates refresh token and issues a new access token. Single-use token hash. |
| `POST` | `/api/v1/auth/logout` | Authenticated | Revokes refresh token and clears session. |
| `POST` | `/api/v1/auth/forgot-password` | Public | Issues single-use, 60-minute password reset token. Always returns 200 (prevents email enumeration). |
| `POST` | `/api/v1/auth/reset-password` | Public | Validates reset token and updates password. Revokes all active refresh tokens for the user. |
| `GET` | `/api/v1/auth/me` | Authenticated | Returns profile of the logged-in user. |
| `POST` | `/api/v1/admin/staff` | **Admin ONLY** | Creates an internal staff account with predefined role `staff`. Logs action in audit log. |
| `GET` | `/api/v1/admin/staff` | **Admin ONLY** | Lists all internal staff users with pagination. |
| `PATCH`| `/api/v1/admin/staff/:id/status`| **Admin ONLY** | Deactivates or activates a staff user. |

---

## 2. Catalog & Pricing Engine

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/catalog/products` | All (Customer/Staff/Admin) | Lists active products, variants, and plans (public/customer view filters active only). |
| `POST` | `/api/v1/catalog/products` | **Admin ONLY** | Creates product. |
| `PUT` | `/api/v1/catalog/products/:id` | **Admin ONLY** | Updates product details. |
| `POST` | `/api/v1/catalog/products/:id/variants` | **Admin ONLY** | Adds a variant to a product. |
| `POST` | `/api/v1/catalog/variants/:id/plans` | **Admin ONLY** | Adds a billing plan (monthly/yearly, cents price, trial days). |
| `POST` | `/api/v1/catalog/addons` | **Admin ONLY** | Creates add-on for a product. |
| `GET` | `/api/v1/catalog/taxes` | Staff / Admin | Lists configured tax rates. |
| `POST` | `/api/v1/catalog/taxes` | **Admin ONLY** | Creates/updates tax rules. |
| `GET` | `/api/v1/catalog/discounts` | Staff / Admin | Lists discount coupons. |
| `POST` | `/api/v1/catalog/discounts` | **Admin ONLY** | Creates discount coupons (percent or fixed cents). |

---

## 3. Customers & Subscriptions

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/customers` | Staff / Admin | Paginated list of customers with search & filter. |
| `GET` | `/api/v1/customers/:id` | Staff / Admin / Customer (own) | Customer profile & active subscription details. |
| `POST` | `/api/v1/customers` | Staff / Admin | Manually onboard a customer. |
| `PUT` | `/api/v1/customers/:id` | Staff / Admin / Customer (own) | Updates billing details and company information. |
| `GET` | `/api/v1/subscriptions` | Staff / Admin | Filter by status (`active`, `past_due`, `trial`, etc.). |
| `GET` | `/api/v1/subscriptions/my` | Customer | Customer's own active and past subscriptions. |
| `POST` | `/api/v1/subscriptions` | Staff / Admin / Customer | Creates new subscription (with plan, addons, discount). |
| `POST` | `/api/v1/subscriptions/:id/upgrade-downgrade` | Staff / Admin / Customer (own) | Computes proration and changes plan immediately. |
| `POST` | `/api/v1/subscriptions/:id/addons` | Staff / Admin / Customer (own) | Adds or removes add-ons. |
| `POST` | `/api/v1/subscriptions/:id/pause` | Staff / Admin / Customer (own) | Pauses billing at end of period or immediately. |
| `POST` | `/api/v1/subscriptions/:id/cancel` | Staff / Admin / Customer (own) | Cancels subscription (at period end or immediate). |

---

## 4. Invoices & Invoicing Engine

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/invoices` | Staff / Admin | Lists all invoices with filters (`status`, `customer_id`, date range). |
| `GET` | `/api/v1/invoices/my` | Customer | Lists customer's own invoices. |
| `GET` | `/api/v1/invoices/:id` | Staff / Admin / Customer (own) | In-depth invoice details with itemized line items. |
| `GET` | `/api/v1/invoices/:id/pdf` | Staff / Admin / Customer (own) | Streams downloadable generated PDF invoice. |
| `POST` | `/api/v1/invoices/generate-renewal` | Staff / Admin | Manual trigger or test trigger for renewal invoicing. |
| `POST` | `/api/v1/invoices/:id/void` | **Admin ONLY** | Voids an unpaid invoice (audit logged). |

---

## 5. Payments & Dunning

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/payments/charge` | Staff / Admin / Customer (own) | Processes payment (mock gateway / Stripe test card). |
| `POST` | `/api/v1/payments/record-offline` | Staff / Admin | Records manual bank transfer or wire payment. |
| `POST` | `/api/v1/payments/:id/refund` | **Admin ONLY** | Refunds a payment partially or fully (audit logged). |
| `GET` | `/api/v1/payments` | Staff / Admin | List payment attempts, logs, and reconciliation status. |

---

## 6. Revenue Reporting & Audit Logs

| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/reports/metrics` | Staff / Admin | MRR, ARR, active subscriber count, churn rate, ARPU. |
| `GET` | `/api/v1/reports/revenue-breakdown`| Staff / Admin | New vs expansion vs churned MRR; by product & plan. |
| `GET` | `/api/v1/reports/aging-ar` | Staff / Admin | Accounts receivable aging (outstanding and overdue buckets). |
| `GET` | `/api/v1/reports/export-csv` | Staff / Admin | Generates CSV export for accounting reconciliation. |
| `GET` | `/api/v1/admin/audit-logs` | **Admin ONLY** | Paginated audit log of sensitive system operations. |
