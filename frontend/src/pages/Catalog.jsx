import React, { useEffect, useState } from 'react';
import { Plus, Tag, Layers, Percent, DollarSign, ShieldAlert, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export function Catalog() {
  const { isAdmin, isStaff } = useAuth();
  const [products, setProducts] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('products'); // products | taxes | discounts

  // Create Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState(null);

  // Form States
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [variantName, setVariantName] = useState('');
  const [planName, setPlanName] = useState('');
  const [planCode, setPlanCode] = useState('');
  const [planInterval, setPlanInterval] = useState('monthly');
  const [planPriceDollars, setPlanPriceDollars] = useState('');
  const [planTrialDays, setPlanTrialDays] = useState('0');

  // Discount Form
  const [discCode, setDiscCode] = useState('');
  const [discType, setDiscType] = useState('percent');
  const [discValue, setDiscValue] = useState('');

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const prodRes = await apiRequest('/catalog/products');
      if (prodRes.success) setProducts(prodRes.data);

      if (isAdmin || isStaff) {
        const taxRes = await apiRequest('/catalog/taxes').catch(() => ({ data: [] }));
        if (taxRes.success) setTaxes(taxRes.data);

        const discRes = await apiRequest('/catalog/discounts').catch(() => ({ data: [] }));
        if (discRes.success) setDiscounts(discRes.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load catalog data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateProductWithVariant = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      // 1. Create product
      const pRes = await apiRequest('/catalog/products', {
        method: 'POST',
        body: { name: prodName, description: prodDesc },
      });
      // 2. Create default variant
      await apiRequest(`/catalog/products/${pRes.data.id}/variants`, {
        method: 'POST',
        body: {
          name: variantName || 'Standard Cloud',
          sku: `SKU-${Date.now().toString().slice(-6)}`,
        },
      });

      setSuccess('Product & Variant successfully created!');
      setShowProductModal(false);
      setProdName('');
      setProdDesc('');
      setVariantName('');
      fetchData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const priceCents = Math.round(parseFloat(planPriceDollars) * 100);
      await apiRequest(`/catalog/variants/${selectedVariantId}/plans`, {
        method: 'POST',
        body: {
          name: planName,
          code: planCode,
          billingInterval: planInterval,
          priceCents,
          trialDays: parseInt(planTrialDays, 10) || 0,
        },
      });

      setSuccess('Billing Plan created!');
      setShowPlanModal(false);
      setPlanName('');
      setPlanCode('');
      setPlanPriceDollars('');
      fetchData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateDiscount = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const val = discType === 'percent' ? parseInt(discValue, 10) : Math.round(parseFloat(discValue) * 100);
      await apiRequest('/catalog/discounts', {
        method: 'POST',
        body: {
          code: discCode,
          discountType: discType,
          discountValue: val,
        },
      });

      setSuccess(`Discount coupon ${discCode.toUpperCase()} created!`);
      setShowDiscountModal(false);
      setDiscCode('');
      setDiscValue('');
      fetchData();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Product & Pricing Catalog</h1>
            {isAdmin ? (
              <span className="text-xs bg-purple-100 text-purple-800 border border-purple-200 px-2.5 py-0.5 rounded-full font-semibold">
                Admin Full Access
              </span>
            ) : (
              <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-full font-semibold">
                Read-Only
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Products, variants, monthly/yearly billing intervals, add-on features, taxes, and promotional coupons.
          </p>
        </div>

        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowDiscountModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs"
            >
              <Percent className="w-4 h-4 text-emerald-600" />
              Add Discount
            </button>
            <button
              onClick={() => setShowProductModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              <Plus className="w-4 h-4" />
              New Product
            </button>
          </div>
        )}
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

      {/* Navigation Sub-Tabs */}
      {(isAdmin || isStaff) && (
        <div className="flex border-b border-slate-200 space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveSubTab('products')}
            className={`pb-3 border-b-2 transition-colors ${
              activeSubTab === 'products'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Products & Plans ({products.length})
          </button>
          <button
            onClick={() => setActiveSubTab('taxes')}
            className={`pb-3 border-b-2 transition-colors ${
              activeSubTab === 'taxes'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Taxes ({taxes.length})
          </button>
          <button
            onClick={() => setActiveSubTab('discounts')}
            className={`pb-3 border-b-2 transition-colors ${
              activeSubTab === 'discounts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Discounts & Coupons ({discounts.length})
          </button>
        </div>
      )}

      {/* 1. Products Tab */}
      {activeSubTab === 'products' && (
        <div className="space-y-6">
          {products.map((product) => (
            <div key={product.id} className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{product.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{product.description || 'No description provided.'}</p>
                </div>
                {isAdmin && product.variants.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedVariantId(product.variants[0].id);
                      setShowPlanModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Billing Plan
                  </button>
                )}
              </div>

              {/* Plans Grid */}
              <div className="p-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Available Billing Plans</h4>
                {product.variants.flatMap((v) => v.plans).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No pricing plans configured yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {product.variants.flatMap((v) => v.plans).map((plan) => (
                      <div key={plan.id} className="border border-slate-200 rounded-xl p-4 bg-white hover:border-blue-300 transition-colors space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-bold text-slate-900 text-sm">{plan.name}</h5>
                            <span className="font-mono text-[10px] text-slate-400 uppercase">{plan.code}</span>
                          </div>
                          <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full capitalize">
                            {plan.billing_interval}
                          </span>
                        </div>
                        <div className="pt-2">
                          <span className="text-2xl font-extrabold text-slate-900">
                            ${(plan.price_cents / 100).toFixed(2)}
                          </span>
                          <span className="text-xs text-slate-500"> / {plan.billing_interval}</span>
                        </div>
                        {plan.trial_days > 0 && (
                          <p className="text-xs text-emerald-600 font-medium">Includes {plan.trial_days}-day free trial</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add-ons List */}
                {product.addons && product.addons.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Modular Add-ons</h4>
                    <div className="flex flex-wrap gap-3">
                      {product.addons.map((a) => (
                        <div key={a.id} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-blue-600" />
                          <span className="font-medium text-slate-800">{a.name}:</span>
                          <span className="font-bold text-slate-900">${(a.price_cents / 100).toFixed(2)}</span>
                          <span className="text-slate-400">/{a.billing_interval}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Taxes Tab */}
      {activeSubTab === 'taxes' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Tax Name</th>
                <th className="px-6 py-3.5">Rate</th>
                <th className="px-6 py-3.5">Country / Region</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {taxes.map((t) => (
                <tr key={t.id}>
                  <td className="px-6 py-4 font-semibold text-slate-900">{t.name}</td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-900">{t.rate_percent}%</td>
                  <td className="px-6 py-4">{t.region ? `${t.region}, ${t.country}` : t.country}</td>
                  <td className="px-6 py-4 text-emerald-600 font-medium">Active</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. Discounts Tab */}
      {activeSubTab === 'discounts' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Coupon Code</th>
                <th className="px-6 py-3.5">Discount Type</th>
                <th className="px-6 py-3.5">Value</th>
                <th className="px-6 py-3.5">Redemptions</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {discounts.map((d) => (
                <tr key={d.id}>
                  <td className="px-6 py-4 font-mono font-bold text-blue-600">{d.code}</td>
                  <td className="px-6 py-4 capitalize">{d.discount_type}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">
                    {d.discount_type === 'percent' ? `${d.discount_value}%` : `$${(d.discount_value / 100).toFixed(2)}`}
                  </td>
                  <td className="px-6 py-4">{d.times_redeemed} {d.max_redemptions ? `/ ${d.max_redemptions}` : ''}</td>
                  <td className="px-6 py-4 text-emerald-600 font-medium">Active</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: New Product */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Create Product & Variant</h3>
            <form onSubmit={handleCreateProductWithVariant} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g. Brightloop CRM"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  placeholder="Subscription details..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Variant Name</label>
                <input
                  type="text"
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  placeholder="Standard Cloud / Enterprise"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Plan */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Add Plan to Variant</h3>
            <form onSubmit={handleCreatePlan} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Plan Name</label>
                <input
                  type="text"
                  required
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="e.g. Pro Monthly"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Code</label>
                <input
                  type="text"
                  required
                  value={planCode}
                  onChange={(e) => setPlanCode(e.target.value)}
                  placeholder="pro_monthly"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Interval</label>
                  <select
                    value={planInterval}
                    onChange={(e) => setPlanInterval(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Price ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={planPriceDollars}
                    onChange={(e) => setPlanPriceDollars(e.target.value)}
                    placeholder="99.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Discount */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Create Discount Coupon</h3>
            <form onSubmit={handleCreateDiscount} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Code</label>
                <input
                  type="text"
                  required
                  value={discCode}
                  onChange={(e) => setDiscCode(e.target.value)}
                  placeholder="e.g. SUMMER25"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={discType}
                    onChange={(e) => setDiscType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="percent">Percent (%)</option>
                    <option value="fixed">Fixed ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Value {discType === 'percent' ? '(%)' : '($)'}
                  </label>
                  <input
                    type="number"
                    step={discType === 'percent' ? '1' : '0.01'}
                    required
                    value={discValue}
                    onChange={(e) => setDiscValue(e.target.value)}
                    placeholder={discType === 'percent' ? '20' : '15.00'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDiscountModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold">
                  Create Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
