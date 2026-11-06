import React, { useEffect, useState } from 'react';
import { Plus, Shield, Users, Mail, Lock, User, Check, X, AlertCircle, RefreshCw } from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { PasswordRequirements, checkPasswordCriteria } from '../components/PasswordRequirements.jsx';

export function AdminStaff() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [formError, setFormError] = useState(null);
  const [formDetails, setFormDetails] = useState([]);
  const [creating, setCreating] = useState(false);

  const fetchStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest('/admin/staff');
      if (res.success && Array.isArray(res.data)) {
        setStaffList(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch staff accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormDetails([]);

    const criteria = checkPasswordCriteria(password);
    if (!criteria.length || !criteria.uppercase || !criteria.lowercase || !criteria.special) {
      setFormError('Staff password does not meet the security criteria.');
      return;
    }

    setCreating(true);

    try {
      const res = await apiRequest('/admin/staff', {
        method: 'POST',
        body: { email, password, firstName, lastName },
      });

      if (res.success) {
        setSuccessMsg(`Staff member ${email} successfully created!`);
        setShowAddModal(false);
        setEmail('');
        setPassword('');
        setFirstName('');
        setLastName('');
        fetchStaff();
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } catch (err) {
      setFormError(err.message || 'Failed to create staff account.');
      if (err.details && Array.isArray(err.details)) {
        setFormDetails(err.details);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (staffId, currentStatus) => {
    try {
      await apiRequest(`/admin/staff/${staffId}/status`, {
        method: 'PATCH',
        body: { isActive: !currentStatus },
      });
      fetchStaff();
    } catch (err) {
      alert(`Error updating staff status: ${err.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-purple-100 text-purple-700">
              <Shield className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Staff Management</h1>
            <span className="text-xs bg-purple-100 text-purple-800 border border-purple-200 px-2.5 py-0.5 rounded-full font-semibold uppercase">
              Admin Only
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Create and manage internal operational staff accounts with restricted administrative access.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Add Staff Member
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Staff Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            Internal Staff Accounts ({staffList.length})
          </h2>
          <button
            onClick={fetchStaff}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Name</th>
                <th className="px-6 py-3.5">Email</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Created</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && staffList.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-slate-400">
                    Loading staff members...
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-slate-400">
                    No internal staff accounts found. Click "Add Staff Member" to create one.
                  </td>
                </tr>
              ) : (
                staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {staff.firstName ? `${staff.firstName} ${staff.lastName || ''}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-mono text-xs">{staff.email}</td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-xs font-semibold">
                        staff
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {staff.isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(staff.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(staff.id, staff.isActive)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                          staff.isActive
                            ? 'text-rose-600 border-rose-200 hover:bg-rose-50'
                            : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                        }`}
                      >
                        {staff.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-100 text-blue-600">
                  <User className="w-4 h-4" />
                </span>
                <h3 className="text-lg font-bold text-slate-900">Add Internal Staff Member</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3.5">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-xs">
                  <p className="font-semibold">{formError}</p>
                  {formDetails.length > 0 && (
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      {formDetails.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Alice"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alice.staff@brightloop.io"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Temporary Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                />
                <PasswordRequirements password={password} />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs disabled:opacity-50"
                >
                  {creating ? 'Creating Account...' : 'Create Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
