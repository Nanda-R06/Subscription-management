# Brightloop Billing — Architecture & ER Diagram

## 1. System Architecture Overview

Brightloop Billing is a unified subscription-billing platform built for modern B2B SaaS operations. It manages the complete lifecycle of customer subscriptions: product catalogs with variants, recurring billing, automated renewals, invoice generation with proration, payments & reconciliation, revenue reporting, and role-based access.

```mermaid
flowchart TD
    subgraph Client Layer
        WebCustomer["Customer Portal (React + Tailwind)"]
        WebAdmin["Admin / Staff Dashboard (React + Tailwind)"]
    end

    subgraph API Gateway & Security
        RateLimiter["Rate Limiter (Express Rate Limit)"]
        Helmet["Security Headers (Helmet)"]
        CORS["CORS Protection"]
        AuthMiddleware["JWT Auth & Role Enforcement (RBAC)"]
    end

    subgraph Application Modules
        AuthModule["Scene 1: Auth & User Management"]
        CatalogModule["Catalog (Products, Variants, Plans, Addons, Taxes, Discounts)"]
        SubModule["Subscription & Proration Engine"]
        RenewalEngine["Renewal & Lifecycle Engine"]
        InvoiceModule["Invoicing Engine (PDF + Tax + Math)"]
        PaymentModule["Payment & Dunning Engine (Mock/Stripe)"]
        ReportModule["Revenue Reporting (MRR, ARR, Churn)"]
        AuditModule["Audit Logging Subsystem"]
    end

    subgraph Background Scheduler
        CronWorker["Background Jobs (node-cron / workers)"]
        RenewalJob["Daily Renewal Check"]
        AlertJob["Upcoming Renewal Alerts"]
        DunningJob["Payment Overdue / Dunning"]
    end

    subgraph Data Layer
        DB[("PostgreSQL Database\n(with SQLite Dev/Test Dual-Mode)")]
        FileStorage[("Invoice PDF Storage")]
    end

    WebCustomer --> RateLimiter
    WebAdmin --> RateLimiter
    RateLimiter --> Helmet --> CORS --> AuthMiddleware

    AuthMiddleware --> AuthModule
    AuthMiddleware --> CatalogModule
    AuthMiddleware --> SubModule
    AuthMiddleware --> InvoiceModule
    AuthMiddleware --> PaymentModule
    AuthMiddleware --> ReportModule

    CronWorker --> RenewalJob
    CronWorker --> AlertJob
    CronWorker --> DunningJob

    RenewalJob --> SubModule
    RenewalJob --> InvoiceModule
    AlertJob --> SubModule
    DunningJob --> PaymentModule

    AuthModule --> DB
    CatalogModule --> DB
    SubModule --> DB
    InvoiceModule --> DB
    InvoiceModule --> FileStorage
    PaymentModule --> DB
    ReportModule --> DB
    AuditModule --> DB
```

---

## 2. Role-Based Access Control (RBAC) Matrix

| Resource / Endpoint | Admin | Internal Staff | Customer |
| :--- | :---: | :---: | :---: |
| **Catalog: Create/Edit Products & Variants** | Full | Read-Only | Read-Only |
| **Catalog: Create/Edit Plans & Addons** | Full | Read-Only | Read-Only |
| **Catalog: Taxes & Discounts Management** | Full | Read-Only | Apply Only |
| **Staff Accounts Management** | Full (Create/List) | None | None |
| **Customer Accounts** | Full | View & Edit | View/Edit Own |
| **Subscriptions** | Full | View & Manage | View & Self-Service Own |
| **Invoices** | Full | View, Create, Issue | View & Download Own |
| **Payments & Refunds** | Full (incl. Refunds) | Record / View | Pay Own Invoices |
| **Revenue Analytics (MRR, ARR, Churn)** | Full | Read-Only | None |
| **Audit Logs** | Full | None | None |

---

## 3. Financial & Precision Policy
- **Minor Units (Integers)**: All monetary figures (`price_cents`, `subtotal_cents`, `tax_cents`, `discount_cents`, `total_cents`, `amount_paid_cents`, `amount_due_cents`) are strictly stored as **64-bit integers (`BIGINT`)** representing cents (or minor currency units).
- **No Floating-Point Arithmetic**: Decimal arithmetic and proration calculate day-fraction ratios using integer rounding (`Math.round()` / fixed integer arithmetic) to prevent floating-point drift or cent-rounding errors.
- **Proration Formula**: Mid-cycle changes calculate the remaining days of the current period:
  $$\text{Unused Credit} = \text{round}\left(\text{Plan Price} \times \frac{\text{Days Remaining}}{\text{Total Days in Period}}\right)$$
  $$\text{New Charge} = \text{round}\left(\text{New Plan Price} \times \frac{\text{Days Remaining}}{\text{Total Days in Period}}\right)$$
  $$\text{Net Proration Adjustment} = \text{New Charge} - \text{Unused Credit}$$

---

## 4. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--o{ REFRESH_TOKENS : "issues"
    USERS ||--o{ PASSWORD_RESET_TOKENS : "requests"
    USERS ||--o| CUSTOMERS : "belongs to"
    USERS ||--o{ AUDIT_LOGS : "triggers"

    PRODUCTS ||--|{ PRODUCT_VARIANTS : "has"
    PRODUCTS ||--o{ ADDONS : "offers"
    PRODUCT_VARIANTS ||--|{ PLANS : "offers"

    CUSTOMERS ||--o{ SUBSCRIPTIONS : "holds"
    CUSTOMERS ||--o{ INVOICES : "billed by"
    CUSTOMERS ||--o{ PAYMENTS : "makes"

    PLANS ||--o{ SUBSCRIPTIONS : "subscribed to"
    SUBSCRIPTIONS ||--o{ SUBSCRIPTION_ADDONS : "includes"
    ADDONS ||--o{ SUBSCRIPTION_ADDONS : "instantiated as"

    SUBSCRIPTIONS ||--o{ INVOICES : "generates"
    INVOICES ||--|{ INVOICE_ITEMS : "contains"
    INVOICES ||--o{ PAYMENTS : "receives"

    USERS {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar role "admin | staff | customer"
        varchar first_name
        varchar last_name
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    REFRESH_TOKENS {
        uuid id PK
        uuid user_id FK
        varchar token_hash UK
        timestamp expires_at
        timestamp revoked_at
        timestamp created_at
    }

    PASSWORD_RESET_TOKENS {
        uuid id PK
        uuid user_id FK
        varchar token_hash UK
        timestamp expires_at
        timestamp used_at
        timestamp created_at
    }

    CUSTOMERS {
        uuid id PK
        uuid user_id FK
        varchar company_name
        varchar billing_email
        varchar phone
        varchar tax_identifier
        varchar billing_address_line1
        varchar billing_city
        varchar billing_state
        varchar billing_postal_code
        varchar billing_country
        varchar currency
        timestamp created_at
        timestamp updated_at
    }

    PRODUCTS {
        uuid id PK
        varchar name
        text description
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    PRODUCT_VARIANTS {
        uuid id PK
        uuid product_id FK
        varchar name
        varchar sku UK
        text description
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    PLANS {
        uuid id PK
        uuid variant_id FK
        varchar name
        varchar code UK
        varchar billing_interval "monthly | yearly"
        integer interval_count
        bigint price_cents
        varchar currency
        integer trial_days
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    ADDONS {
        uuid id PK
        uuid product_id FK
        varchar name
        varchar code UK
        bigint price_cents
        varchar billing_interval "monthly | yearly | one_time"
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    TAXES {
        uuid id PK
        varchar name
        decimal rate_percent
        varchar country
        varchar region
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    DISCOUNTS {
        uuid id PK
        varchar code UK
        varchar discount_type "percent | fixed"
        bigint discount_value
        varchar currency
        integer max_redemptions
        integer times_redeemed
        timestamp valid_from
        timestamp valid_to
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    SUBSCRIPTIONS {
        uuid id PK
        uuid customer_id FK
        uuid plan_id FK
        varchar status "trial | active | past_due | paused | cancelled"
        timestamp current_period_start
        timestamp current_period_end
        timestamp trial_start
        timestamp trial_end
        boolean cancel_at_period_end
        timestamp cancelled_at
        timestamp paused_at
        timestamp renewal_reminder_sent_at
        timestamp created_at
        timestamp updated_at
    }

    SUBSCRIPTION_ADDONS {
        uuid id PK
        uuid subscription_id FK
        uuid addon_id FK
        integer quantity
        bigint unit_price_cents
        timestamp created_at
    }

    INVOICES {
        uuid id PK
        varchar invoice_number UK
        uuid customer_id FK
        uuid subscription_id FK
        varchar status "draft | open | paid | uncollectible | void"
        varchar currency
        bigint subtotal_cents
        bigint discount_cents
        bigint tax_cents
        bigint total_cents
        bigint amount_paid_cents
        bigint amount_due_cents
        timestamp issue_date
        timestamp due_date
        timestamp paid_at
        timestamp period_start
        timestamp period_end
        varchar pdf_path
        text notes
        timestamp created_at
        timestamp updated_at
    }

    INVOICE_ITEMS {
        uuid id PK
        uuid invoice_id FK
        varchar description
        varchar item_type "plan | addon | proration | adjustment"
        integer quantity
        bigint unit_price_cents
        bigint total_cents
        timestamp period_start
        timestamp period_end
        timestamp created_at
    }

    PAYMENTS {
        uuid id PK
        uuid invoice_id FK
        uuid customer_id FK
        bigint amount_cents
        varchar currency
        varchar status "succeeded | failed | refunded | pending"
        varchar gateway_transaction_id
        varchar payment_method
        text failure_reason
        timestamp paid_at
        bigint refunded_amount_cents
        timestamp created_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid user_id FK
        varchar action
        varchar entity_type
        varchar entity_id
        jsonb details
        varchar ip_address
        timestamp created_at
    }
```
