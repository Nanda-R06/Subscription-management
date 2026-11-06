import React, { useState } from 'react';
import { ArrowRight, Lock, Mail, Repeat, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function Login({ onNavigate }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Icon */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-xl text-white">
          <Repeat className="w-8 h-8 stroke-[2.2]" />
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold text-white tracking-tight">
          Brightloop <span className="text-blue-400">Billing</span>
        </h2>
        <p className="mt-1 text-center text-sm text-slate-400">
          Unified Subscription & Revenue Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-100">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email address
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
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm text-slate-900 placeholder-slate-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => onNavigate('forgot-password')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm text-slate-900 placeholder-slate-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in to platform'}
              {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
            </button>
          </form>

          {/* Quick Demo Credentials Fillers */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-center mb-3">
              One-Click Demo Roles
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoFill('admin@brightloop.io', 'Password123!')}
                className="px-2 py-2 text-xs font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg border border-purple-200 transition-colors text-center"
              >
                👑 Admin
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('staff@brightloop.io', 'Password123!')}
                className="px-2 py-2 text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition-colors text-center"
              >
                💼 Staff
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('alex@acmecorp.com', 'Password123!')}
                className="px-2 py-2 text-xs font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition-colors text-center"
              >
                🏢 Customer
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              New to Brightloop?{' '}
              <button
                type="button"
                onClick={() => onNavigate('signup')}
                className="font-semibold text-blue-600 hover:text-blue-800"
              >
                Create a customer account
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
