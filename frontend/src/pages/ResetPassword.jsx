import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Lock, Repeat, KeyRound, AlertCircle } from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { PasswordRequirements, checkPasswordCriteria } from '../components/PasswordRequirements.jsx';

export function ResetPassword({ initialToken = '', onNavigate }) {
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [details, setDetails] = useState([]);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setDetails([]);

    if (!token) {
      setError('Password reset token is missing.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const criteria = checkPasswordCriteria(newPassword);
    if (!criteria.length || !criteria.uppercase || !criteria.lowercase || !criteria.special) {
      setError('New password does not fulfill all security requirements.');
      return;
    }

    setLoading(true);

    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: { token, newPassword },
      });

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to reset password. The link may have expired.');
      if (err.details && Array.isArray(err.details)) {
        setDetails(err.details);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-xl text-white">
          <Repeat className="w-8 h-8 stroke-[2.2]" />
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold text-white tracking-tight">
          Set New Password
        </h2>
        <p className="mt-1 text-center text-sm text-slate-400">
          Enter your single-use reset token and choose a secure password
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Password Updated!</h3>
              <p className="text-sm text-slate-600">
                Your password has been successfully reset and existing sessions were securely revoked.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
              >
                Sign in with new password
              </button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{error}</p>
                    {details.length > 0 && (
                      <ul className="list-disc pl-5 mt-1 text-xs space-y-0.5 text-rose-600">
                        {details.map((d, idx) => (
                          <li key={idx}>{d}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reset Token
                </label>
                <div className="relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Enter reset token from link"
                    className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  New Password
                </label>
                <div className="relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm text-slate-900"
                  />
                </div>
                <PasswordRequirements password={newPassword} />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm text-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 mt-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
              >
                {loading ? 'Updating password...' : 'Update Password'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('login')}
                  className="inline-flex items-center text-sm font-semibold text-slate-600 hover:text-slate-900"
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
