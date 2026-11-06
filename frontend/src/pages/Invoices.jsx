import React, { useEffect, useState } from 'react';
import { FileText, Download, CreditCard, CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export function Invoices() {
  const { isCustomer } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceDetails, setInvoiceDetails] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [simulateFail, setSimulateFail] = useState(false);
  const [paying, setPaying] = useState(false);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = isCustomer ? '/invoices/my' : '/invoices';
      const res = await apiRequest(endpoint);
      if (res.success) setInvoices(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const openInvoiceDetails = async (inv) => {
    setSelectedInvoice(inv);
    try {
      const res = await apiRequest(`/invoices/${inv.id}`);
      if (res.success) {
        setInvoiceDetails(res.data);
        setShowPayModal(true);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePayInvoice = async () => {
    setPaying(true);
    setError(null);
    try {
      const res = await apiRequest('/payments/charge', {
        method: 'POST',
        body: {
          invoiceId: selectedInvoice.id,
          simulateFail,
        },
      });

      if (res.success) {
        setSuccess(`Payment successful! Transaction ID: ${res.data.gatewayTransactionId}`);
        setShowPayModal(false);
        fetchInvoices();
        setTimeout(() => setSuccess(null), 5000);
      }
    } catch (err) {
      setError(err.message || 'Payment simulation failed.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <FileText className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isCustomer ? 'My Billing Invoices' : 'Invoices & Billing'}
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Itemized invoices, automatic proration calculations, tax rates, and payment settlement.
          </p>
        </div>

        <button
          onClick={fetchInvoices}
          className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
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

      {/* Invoices Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Invoice #</th>
                {!isCustomer && <th className="px-6 py-3.5">Customer</th>}
                <th className="px-6 py-3.5">Issue Date</th>
                <th className="px-6 py-3.5">Due Date</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Amount</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    No invoices generated yet.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-blue-600">
                      {inv.invoice_number}
                    </td>
                    {!isCustomer && (
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{inv.company_name}</div>
                        <div className="text-xs text-slate-400">{inv.billing_email}</div>
                      </td>
                    )}
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {new Date(inv.issue_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {new Date(inv.due_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      {inv.status === 'paid' ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          Paid
                        </span>
                      ) : (
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                          Open (${(inv.amount_due_cents / 100).toFixed(2)} due)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      ${(inv.total_cents / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      <a
                        href={`/api/v1/invoices/${inv.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </a>

                      <button
                        onClick={() => openInvoiceDetails(inv)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                          inv.status === 'paid'
                            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {inv.status === 'paid' ? 'View Receipt' : 'Pay Now'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Details & Payment Modal */}
      {showPayModal && invoiceDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono text-xs text-blue-600 font-bold">{invoiceDetails.invoice_number}</span>
                <h3 className="text-lg font-bold text-slate-900">Invoice Details</h3>
              </div>
              <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Itemized Line Items */}
            <div className="space-y-2 border-b border-slate-100 pb-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Line Items</p>
              {invoiceDetails.lineItems && invoiceDetails.lineItems.map((item) => (
                <div key={item.id} className="flex justify-between text-xs py-1 text-slate-700">
                  <span>{item.description} (x{item.quantity})</span>
                  <span className="font-semibold">${(item.total_cents / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Math Breakdown */}
            <div className="space-y-1 text-xs text-slate-600 pt-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${(invoiceDetails.subtotal_cents / 100).toFixed(2)}</span>
              </div>
              {invoiceDetails.discount_cents > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount Applied:</span>
                  <span>-${(invoiceDetails.discount_cents / 100).toFixed(2)}</span>
                </div>
              )}
              {invoiceDetails.tax_cents > 0 && (
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>+${(invoiceDetails.tax_cents / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-900 text-sm pt-2 border-t border-slate-200">
                <span>Total Due:</span>
                <span>${(invoiceDetails.amount_due_cents / 100).toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Section */}
            {invoiceDetails.status !== 'paid' ? (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <CreditCard className="w-4 h-4 text-blue-600" /> Mock Payment Gateway (Visa •••• 4242)
                  </div>
                  <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simulateFail}
                      onChange={(e) => setSimulateFail(e.target.checked)}
                      className="rounded text-rose-600"
                    />
                    <span>Simulate Card Decline / Dunning Trigger</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowPayModal(false)}
                    className="px-4 py-2 border rounded-lg text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePayInvoice}
                    disabled={paying}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {paying ? 'Processing Charge...' : `Pay $${(invoiceDetails.amount_due_cents / 100).toFixed(2)}`}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Invoice fully paid on {new Date(invoiceDetails.paid_at).toLocaleDateString()}.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
