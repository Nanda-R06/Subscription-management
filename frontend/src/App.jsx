import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { Navbar } from './components/Navbar.jsx';
import { Login } from './pages/Login.jsx';
import { Signup } from './pages/Signup.jsx';
import { ForgotPassword } from './pages/ForgotPassword.jsx';
import { ResetPassword } from './pages/ResetPassword.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Catalog } from './pages/Catalog.jsx';
import { Subscriptions } from './pages/Subscriptions.jsx';
import { Invoices } from './pages/Invoices.jsx';
import { Reports } from './pages/Reports.jsx';
import { AdminStaff } from './pages/AdminStaff.jsx';
import { AdminAudit } from './pages/AdminAudit.jsx';

function AppContent() {
  const { user, isAuthenticated, isLoading, isAdmin, isStaff } = useAuth();
  const [currentPage, setCurrentPage] = useState('login');
  const [resetToken, setResetToken] = useState('');

  // Check URL query parameters for reset token or path on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setResetToken(token);
      setCurrentPage('reset-password');
    }
  }, []);

  // Update navigation when auth state changes
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        if (currentPage === 'login' || currentPage === 'signup' || currentPage === 'forgot-password' || currentPage === 'reset-password') {
          setCurrentPage('dashboard');
        }
      } else {
        if (currentPage !== 'signup' && currentPage !== 'forgot-password' && currentPage !== 'reset-password') {
          setCurrentPage('login');
        }
      }
    }
  }, [isAuthenticated, isLoading]);

  const handleNavigate = (page, data = {}) => {
    if (data.token) {
      setResetToken(data.token);
    }
    // RBAC check for frontend routes
    if ((page === 'staff' || page === 'audit') && !isAdmin) {
      alert('Access restricted to Administrators only.');
      return;
    }
    if (page === 'reports' && !isAdmin && !isStaff) {
      alert('Access restricted to internal staff and administrators.');
      return;
    }
    setCurrentPage(page);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-300">Loading Brightloop Billing...</span>
        </div>
      </div>
    );
  }

  // Unauthenticated Public Routes
  if (!isAuthenticated) {
    switch (currentPage) {
      case 'signup':
        return <Signup onNavigate={handleNavigate} />;
      case 'forgot-password':
        return <ForgotPassword onNavigate={handleNavigate} />;
      case 'reset-password':
        return <ResetPassword initialToken={resetToken} onNavigate={handleNavigate} />;
      case 'login':
      default:
        return <Login onNavigate={handleNavigate} />;
    }
  }

  // Authenticated Protected Views
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar activeTab={currentPage} onTabChange={handleNavigate} />

      <main className="flex-1 pb-12">
        {currentPage === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
        {currentPage === 'catalog' && <Catalog />}
        {currentPage === 'subscriptions' && <Subscriptions />}
        {currentPage === 'invoices' && <Invoices />}
        {currentPage === 'reports' && (isAdmin || isStaff) && <Reports />}
        {currentPage === 'staff' && isAdmin && <AdminStaff />}
        {currentPage === 'audit' && isAdmin && <AdminAudit />}
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        Brightloop Billing Platform © 2026. Unified B2B Subscription Billing & Revenue Intelligence.
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
