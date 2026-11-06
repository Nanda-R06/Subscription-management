import React, { useEffect, useState } from 'react';
import { Repeat, Plus, Pause, Play, XCircle, ArrowUpRight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export function Subscriptions() {
  const { user, isAdmin, isStaff, isCustomer } = useAuth();
  const [subscriptions, setSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  // Change Plan Modal
  const [showPlanChangeModal, setShowPlanChangeModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState(null);
  const [targetPlanId, setTargetPlanId] = useState('');
  const [prorationPreview, setProrationPreview] = useState(null);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchSubscriptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = isCustomer ? '/subscriptions/my' : '/subscriptions';
      const res = await apiRequest(endpoint);
      if (res.success) setSubscriptions(res.data);

      const prodRes = await apiRequest('/catalog/products');
      if (prodRes.success) {
        const allPlans = prodRes.data.flatMap((p) => p.variants.flatMap((v) => v.plans));
        setPlans(allPlans);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch subscriptions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handlePlanChange = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await apiRequest(`/subscriptions/${selectedSub.id}/change-plan`, {
        method: 'POST',
        body: { newPlanId: targetPlanId },
      });

      setSuccess('Subscription plan changed successfully! Proration calculated.');
      setShowPlanChangeModal(false);
      fetchSubscriptions();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePause = async (subId) => {
    try {
      await apiRequest(`/subscriptions/${subId}/pause`, { method: 'POST' });
      fetchSubscriptions();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResume = async (subId) => {
    try {
      await apiRequest(`/subscriptions/${subId}/resume`, { method: 'POST' });
      fetchSubscriptions();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = async (subId) => {
    if (!confirm('Are you sure you want to cancel this subscription at period end?')) return;
    try {
      await apiRequest(`/subscriptions/${subId}/cancel`, {
        method: 'POST',
        body: { immediate: false },
      });
      fetchSubscriptions();
    } catch (err) {
      setError(err.message);
    }
  };

  const getStatusBadge = (status, cancelAtPeriodEnd) => {
    if (cancelAtPeriodEnd) {
      return (
        <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-xs font-semibold">
          Cancels at period end
        </span>
      );
    }
    switch (status) {
      case 'active':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-xs font-semibold">Active</span>;
      case 'trial':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-xs font-semibold">Free Trial</span>;
      case 'past_due':
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full text-xs font-semibold">Past Due</span>;
      case 'paused':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-xs font-semibold">Paused</span>;
      case 'cancelled':
        return <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full text-xs font-semibold">Cancelled</span>;
      default:
        return <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{status}</span>;
    }
  };

  const filteredSubs = subscriptions.filter((s) => {
    if (filterStatus === 'all') return true;
    return s.status === filterStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
              <Repeat className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isCustomer ? 'My Subscriptions' : 'Customer Subscriptions'}
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage recurring lifecycle, mid-cycle proration upgrades, renewals, and pause/cancel states.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="past_due">Past Due</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button
            onClick={fetchSubscriptions}
            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Subscriptions Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                {!isCustomer && <th className="px-6 py-3.5">Customer / Company</th>}
                <th className="px-6 py-3.5">Plan</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Current Period End</th>
                <th className="px-6 py-3.5">Amount</th>
                <th className="px-6 py-3.5 text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    No subscriptions found matching the filter.
                  </td>
                </tr>
              ) : (
                filteredSubs.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                    {!isCustomer && (
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{sub.company_name || 'Customer'}</div>
                        <div className="text-xs text-slate-400">{sub.billing_email}</div>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{sub.plan_name}</div>
                      <div className="text-xs text-slate-400 uppercase font-mono">{sub.plan_code}</div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(sub.status, sub.cancel_at_period_end)}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {new Date(sub.current_period_end).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      ${(sub.plan_price / 100).toFixed(2)}
                      <span className="text-xs font-normal text-slate-500"> / {sub.billing_interval || 'mo'}</span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                      {sub.status !== 'cancelled' && (
                        <button
                          onClick={() => {
                            setSelectedSub(sub);
                            setShowPlanChangeModal(true);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                        >
                          Change Plan
                        </button>
                      )}

                      {sub.status === 'active' && (
                        <button
                          onClick={() => handlePause(sub.id)}
                          className="px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors"
                        >
                          Pause
                        </button>
                      )}

                      {sub.status === 'paused' && (
                        <button
                          onClick={() => handleResume(sub.id)}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                        >
                          Resume
                        </button>
                      )}

                      {sub.status !== 'cancelled' && !sub.cancel_at_period_end && (
                        <button
                          onClick={() => handleCancel(sub.id)}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-50 text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plan Change Modal (Upgrade/Downgrade with Proration) */}
      {showPlanChangeModal && selectedSub && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Upgrade or Downgrade Plan</h3>
            <p className="text-xs text-slate-500">
              Current Plan: <span className="font-bold text-slate-800">{selectedSub.plan_name}</span> ($
              {(selectedSub.plan_price / 100).toFixed(2)})
            </p>

            <form onSubmit={handlePlanChange} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Select New Target Plan</label>
                <select
                  required
                  value={targetPlanId}
                  onChange={(e) => setTargetPlanId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="">-- Choose a plan --</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ${(p.price_cents / 100).toFixed(2)} / {p.billing_interval}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1">
                <p className="font-bold">⚡ Mid-Cycle Mathematical Proration:</p>
                <p>
                  Unused days on your current plan will be credited against the remaining cycle on the new plan. An instant proration invoice will be generated for any positive delta.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPlanChangeModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!targetPlanId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                >
                  Confirm Plan Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
