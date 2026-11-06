import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, DollarSign, Users, AlertTriangle, Download, RefreshCw, Layers } from 'lucide-react';
import { apiRequest } from '../api/client.js';

export function Reports() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest('/reports/metrics');
      if (res.success) setMetrics(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load revenue metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Revenue & Subscription Analytics</h1>
            <span className="text-xs bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-full font-semibold">
              Admin & Staff
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time calculation of Monthly Recurring Revenue (MRR), ARR, subscriber churn rate, and accounts receivable aging.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/api/v1/reports/export-csv"
            download
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Export Ledger (CSV)
          </a>
          <button
            onClick={fetchMetrics}
            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !metrics ? (
        <div className="py-20 text-center text-slate-400">Loading recurring metrics...</div>
      ) : metrics ? (
        <div className="space-y-6">
          {/* Key Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* MRR */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex justify-between items-center text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Monthly Recurring (MRR)</span>
                <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                ${(metrics.mrrCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-slate-400">Calculated from active monthly + normalized yearly plans</p>
            </div>

            {/* ARR */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex justify-between items-center text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Annualized Run-Rate (ARR)</span>
                <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                ${(metrics.arrCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-slate-400">MRR × 12 annualized forecast</p>
            </div>

            {/* Active Subscribers */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex justify-between items-center text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Active Subscribers</span>
                <span className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {metrics.activeSubscribers}
              </div>
              <p className="text-xs text-slate-400">{metrics.activeCustomers} distinct billing accounts</p>
            </div>

            {/* Churn Rate */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex justify-between items-center text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Subscription Churn</span>
                <span className="p-2 rounded-lg bg-rose-50 text-rose-600">
                  <AlertTriangle className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {metrics.churnRate}%
              </div>
              <p className="text-xs text-slate-400">Cancelled vs total lifetime subscriptions</p>
            </div>
          </div>

          {/* Accounts Receivable Aging */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Accounts Receivable (AR) Aging & Outstanding
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase">Current Due (Within Terms)</p>
                <p className="text-xl font-bold text-slate-900 mt-1">
                  ${(metrics.accountsReceivable.currentDueCents / 100).toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                <p className="text-xs font-semibold text-rose-700 uppercase">Past Due / Overdue (Dunning)</p>
                <p className="text-xl font-bold text-rose-700 mt-1">
                  ${(metrics.accountsReceivable.overdueCents / 100).toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs font-semibold text-blue-700 uppercase">Total Outstanding Balance</p>
                <p className="text-xl font-bold text-blue-900 mt-1">
                  ${(metrics.accountsReceivable.totalOutstandingCents / 100).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Revenue by Plan Breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                Active Revenue Breakdown by Plan
              </h3>
            </div>
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Plan Name</th>
                  <th className="px-6 py-3.5">Plan Code</th>
                  <th className="px-6 py-3.5 text-center">Active Subscribers</th>
                  <th className="px-6 py-3.5 text-right">Nominal Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.revenueByPlan.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-slate-400">
                      No active plan subscriptions yet.
                    </td>
                  </tr>
                ) : (
                  metrics.revenueByPlan.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-bold text-slate-900">{p.name}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500 uppercase">{p.code}</td>
                      <td className="px-6 py-4 text-center font-semibold text-slate-800">{p.subscribers}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                        ${(p.totalNominalCents / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
