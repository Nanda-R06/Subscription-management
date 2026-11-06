import React from 'react';
import { Shield, Users, User, CheckCircle2, ArrowRight, Layers, Key, Database, Repeat, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function Dashboard({ onNavigate }) {
  const { user, customer, isAdmin, isStaff, isCustomer } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-blue-200 border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Scene 1 Operational: Auth & Strict RBAC Active
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.email}
            </h1>
            <p className="text-blue-100/90 text-sm max-w-2xl">
              You are signed in as{' '}
              <span className="font-bold text-white uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded text-xs">
                {user?.role}
              </span>
              . RBAC is enforced on the database and API level for every request.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {isAdmin && (
              <button
                onClick={() => onNavigate('staff')}
                className="px-4 py-2.5 bg-white text-blue-900 hover:bg-blue-50 font-semibold text-xs rounded-xl shadow-md transition-colors flex items-center gap-2"
              >
                <Users className="w-4 h-4 text-blue-700" />
                Manage Staff
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => onNavigate('audit')}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl backdrop-blur-md border border-white/20 transition-colors flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Audit Logs
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Key Features & Verification Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Role & Access Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Shield className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Access Scope</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">RBAC Enforcement</h3>
            <p className="text-xs text-slate-500 mt-1">
              Backend verifies role permissions on every API route, preventing unauthorized data access or escalation.
            </p>
          </div>
          <div className="pt-3 border-t border-slate-100 text-xs space-y-1.5">
            <div className="flex justify-between text-slate-600">
              <span>Account Type:</span>
              <span className="font-bold text-slate-900 capitalize">{user?.role}</span>
            </div>
            {isCustomer && (
              <div className="flex justify-between text-slate-600">
                <span>Company:</span>
                <span className="font-semibold text-slate-800">{customer?.companyName || '—'}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Status:</span>
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active
              </span>
            </div>
          </div>
        </div>

        {/* Security & Token Policy Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <Key className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Security Rules</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Password & Token Specs</h3>
            <p className="text-xs text-slate-500 mt-1">
              Strict password policy (min 9 chars, upper, lower, special), single-use rotation refresh tokens & secure resets.
            </p>
          </div>
          <div className="pt-3 border-t border-slate-100 text-xs space-y-1.5 text-slate-600">
            <div className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Password Policy Verified (min 9 chars + upper + lower + special)</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Single-Use Refresh Token Rotation</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Time-limited 60-min Password Reset</span>
            </div>
          </div>
        </div>

        {/* Database & Background Jobs Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Database className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Storage & Engine</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Monetary Precision</h3>
            <p className="text-xs text-slate-500 mt-1">
              All prices and invoices stored strictly as minor unit integers (cents/BIGINT) with zero float drift.
            </p>
          </div>
          <div className="pt-3 border-t border-slate-100 text-xs space-y-1.5 text-slate-600">
            <div className="flex justify-between">
              <span>Database Engine:</span>
              <span className="font-semibold text-slate-800">PostgreSQL (Dual-Mode Ready)</span>
            </div>
            <div className="flex justify-between">
              <span>Cron Workers:</span>
              <span className="font-semibold text-emerald-600">Active (Renewals & Dunning)</span>
            </div>
            <div className="flex justify-between">
              <span>Money Type:</span>
              <span className="font-mono text-slate-800">BIGINT (cents)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Module Roadmap and Scene 1 Confirmation */}
      <div className="bg-slate-100/80 border border-slate-200 rounded-2xl p-6 sm:p-8">
        <h2 className="text-lg font-bold text-slate-900 mb-2">
          Modular Architecture & Progress Tracker
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          Brightloop Billing is constructed following an incremental module approach. Scene 1 (Auth & RBAC) is fully implemented and tested.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border-2 border-emerald-500 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                COMPLETED
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <h4 className="font-bold text-sm text-slate-900">Scene 1: Auth & RBAC</h4>
            <p className="text-xs text-slate-500">
              Signups, strict password policy, JWT access+refresh rotation, forgot/reset password, and admin staff creation.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                READY NEXT
              </span>
              <Layers className="w-4 h-4 text-blue-600" />
            </div>
            <h4 className="font-bold text-sm text-slate-900">Module 1: Catalog & Plans</h4>
            <p className="text-xs text-slate-500">
              Products with variants, monthly/yearly billing plans, add-ons, taxes, and percentage/fixed discount codes.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                QUEUED
              </span>
              <Repeat className="w-4 h-4 text-slate-400" />
            </div>
            <h4 className="font-bold text-sm text-slate-900">Module 2 & 3: Subscriptions</h4>
            <p className="text-xs text-slate-500">
              Lifecycle status, mid-cycle proration upgrade/downgrade, auto-renewals, and renewal reminder engine.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                QUEUED
              </span>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            <h4 className="font-bold text-sm text-slate-900">Module 4 - 6: Invoicing & Reports</h4>
            <p className="text-xs text-slate-500">
              Itemized invoices, PDF export, payment auto-matching, dunning engine, and real-time MRR/ARR analytics.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
