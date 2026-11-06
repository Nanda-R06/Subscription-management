# Brightloop Billing — Unified Subscription & Revenue Platform

Brightloop Billing is an end-to-end subscription-billing platform built for recurring-revenue SaaS businesses. It manages the complete lifecycle: product/plan setup → customer onboarding → recurring billing & proration → renewals → invoicing & PDF generation → payment matching → revenue reporting (MRR, ARR, churn).

---

## 1. Key Highlights & Architectural Guarantees

- **Integer Monetary Storage**: All prices, line items, discounts, taxes, and totals are strictly stored as **minor units (cents/integers)** to eliminate floating-point drift and rounding anomalies.
- **Strict Role-Based Access Control (RBAC)**: Backend endpoints strictly check roles on every request (`admin`, `staff`, `customer`).
- **Scene 1 Authentication Implementation**:
  - Customer self-service signup with unique email verification.
  - Strict password policy enforced on **both client and server**:
    - More than 8 characters (minimum 9 characters)
    - At least 1 uppercase letter (`A-Z`)
    - At least 1 lowercase letter (`a-z`)
    - At least 1 special character (`!@#$%^&*`)
  - Real-time password criteria checklist in UI.
  - JWT Access Token (short-lived 15m) + Single-use rotated Refresh Token (7 days).
  - Time-limited, single-use password reset links (60-minute expiry) with anti-enumeration response timing.
  - Admin-only staff account creation & management.
  - Immutable audit logs for sensitive operations.
- **Dual-Mode Database Layer**:
  - Production-ready for **PostgreSQL** with full SQL migration scripts (`migrations/001_initial_schema.sql`).
  - Zero-config automatic fallback to **SQLite** (`./data/brightloop.sqlite`) for instant local development and testing without needing external services running.
- **Automated Background Scheduler**: Built-in cron jobs for daily renewal cycles, upcoming renewal notifications, and overdue dunning engine.

---

## 2. Demo Credentials

The database seeder pre-populates three ready-to-test accounts representing each RBAC role:

| Role | Email | Password | Scope & Permissions |
| :--- | :--- | :--- | :--- |
| **👑 Admin** | `admin@brightloop.io` | `Password123!` | Full control. Only user permitted to create/manage staff, alter catalog config, and view audit logs. |
| **💼 Internal Staff** | `staff@brightloop.io` | `Password123!` | Day-to-day customer work (customers, subscriptions, invoices, payments). No staff management or system configuration. |
| **🏢 Customer** | `alex@acmecorp.com` | `Password123!` | Portal access restricted strictly to their own company subscriptions, invoices, and payments. |

---

## 3. Tech Stack

- **Frontend**: React 19 + Tailwind CSS + Lucide Icons + Vite
- **Backend**: Node.js (v26+ ES Modules) + Express REST API
- **Security**: Helmet, CORS, Express-Rate-Limit, bcryptjs (10 salt rounds), jsonwebtoken
- **Database**: PostgreSQL with parameterized queries + SQLite embedded dev fallback
- **Background Jobs**: `node-cron`
- **Testing**: Native Node.js test runner (`node:test`, `node:assert`)

---

## 4. Project Structure

```
brightloop-billing/
├── backend/
│   ├── src/
│   │   ├── config/             # Environment & secret configuration
│   │   ├── db/                 # Dual-mode database layer & SQLite schema
│   │   ├── jobs/               # Scheduled cron jobs (renewals, dunning, alerts)
│   │   ├── middleware/         # Auth, RBAC, error handling, rate limiting
│   │   ├── routes/             # Express API routes (auth, admin, etc.)
│   │   ├── services/           # Business logic & audit logging
│   │   ├── utils/              # Password rules, JWT tokens, AppErrors
│   │   ├── app.js              # Express app configuration
│   │   └── server.js           # Server bootstrap & graceful shutdown
│   ├── scripts/
│   │   └── seed.js             # Seeder with demo users, catalog, invoices
│   ├── tests/
│   │   └── auth.test.js        # 17 automated tests for Scene 1 & RBAC
│   ├── .env.example            # Environment template
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/                # API client with token refresh interceptor
│   │   ├── components/         # Navbar, PasswordRequirements checklist
│   │   ├── context/            # AuthContext (state, roles, login, signup)
│   │   ├── pages/              # Login, Signup, Forgot/Reset Password, Staff, Audit, Dashboard
│   │   ├── App.jsx             # Role-aware routing & guards
│   │   └── index.css           # Tailwind styling
│   ├── vite.config.js          # Vite config with backend API proxy
│   └── package.json
├── migrations/
│   └── 001_initial_schema.sql  # Complete PostgreSQL DDL migration
└── README.md
```

---

## 5. Getting Started & Running Locally

### Step 1: Install Dependencies
```bash
# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install
```

### Step 2: Seed the Database
```bash
cd backend
npm run seed
```

### Step 3: Run the Automated Test Suite
To verify password rules, RBAC enforcement, token rotation, and reset links:
```bash
cd backend
npm test
```
All 17 tests verify:
- Password length (>8), uppercase, lowercase, and special character enforcement
- Customer signup uniqueness & validation error payloads
- Login authentication & 401 handling
- Refresh token single-use rotation & token reuse detection
- Single-use 60-min password reset flow & rejection of used links
- RBAC boundary checks: Customer (403), Staff (403), Admin (200/201)

### Step 4: Start the Backend & Frontend Servers
In terminal 1 (Backend):
```bash
cd backend
npm run dev
# Running on http://localhost:5000
```

In terminal 2 (Frontend):
```bash
cd frontend
npm run dev
# Running on http://localhost:3000
```

Open `http://localhost:3000` in your browser. Use the **One-Click Demo Roles** on the login page to immediately test as Admin, Staff, or Customer!

---

## 6. Architecture & API Specifications

- **Architecture & ER Diagram**: Located at `.gemini/antigravity/brain/<id>/architecture.md`
- **REST API Specification**: Located at `.gemini/antigravity/brain/<id>/api-spec.md`
- **PostgreSQL Migrations**: Located at `migrations/001_initial_schema.sql`
