import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Mail, Repeat, Send, AlertCircle } from 'lucide-react';
import { apiRequest } from '../api/client.js';

export function ForgotPassword({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: { email },
      });

      setSubmitted(true);
      if (res.devResetUrl) {
        setDevResetUrl(res.devResetUrl);
      }
    } catch (err) {
      setError(err.message || 'Unable to process password reset request.');
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
          Forgot Password
        </h2>
        <p className="mt-1 text-center text-sm text-slate-400">
          We will send a secure single-use link to reset your credentials
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Check your inbox</h3>
              <p className="text-sm text-slate-600">
                If <span className="font-semibold">{email}</span> matches a registered account, you will receive a secure password reset link valid for 60 minutes.
              </p>

              {devResetUrl && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-left">
                  <p className="text-xs font-bold text-amber-800 mb-1">🛠️ Development Mode Shortcut:</p>
                  <p className="text-xs text-amber-700 break-all mb-2 font-mono">{devResetUrl}</p>
                  <button
                    type="button"
                    onClick={() => {
                      const url = new URL(devResetUrl);
                      const token = url.searchParams.get('token');
                      onNavigate('reset-password', { token });
                    }}
                    className="w-full text-center px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold transition-colors"
                  >
                    Open Reset Link Directly
                  </button>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onNavigate('login')}
                  className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800"
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to sign in
                </button>
              </div>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Registered email address
                </label>
                <div className="relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm text-slate-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending link...' : 'Send reset link'}
                {!loading && <Send className="ml-2 w-4 h-4" />}
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
