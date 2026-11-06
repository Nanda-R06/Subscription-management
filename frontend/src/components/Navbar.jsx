import React from 'react';
import { LogOut, Shield, Users, Layers, Repeat, FileText, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function Navbar({ activeTab, onTabChange }) {
  const { user, customer, logout, isAdmin, isStaff, isCustomer } = useAuth();

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return <span className="bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wider border border-purple-200">Admin</span>;
      case 'staff':
        return <span className="bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wider border border-blue-200">Staff</span>;
      default:
        return <span className="bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wider border border-emerald-200">Customer</span>;
    }
  };

  const navItemClass = (tabName) =>
    `px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
      activeTab === tabName
        ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer shrink-0" onClick={() => onTabChange('dashboard')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 flex items-center justify-center shadow-md text-white">
              <Repeat className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <span className="font-bold text-base text-slate-900 tracking-tight flex items-center gap-1">
                Brightloop <span className="text-blue-600 font-extrabold">Billing</span>
              </span>
              <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                Subscription Engine
              </span>
            </div>
          </div>

          {/* Navigation Links based on role */}
          <nav className="hidden lg:flex items-center space-x-1">
            <button onClick={() => onTabChange('dashboard')} className={navItemClass('dashboard')}>
              Dashboard
            </button>

            <button onClick={() => onTabChange('catalog')} className={navItemClass('catalog')}>
              <Layers className="w-3.5 h-3.5" /> Catalog
            </button>

            <button onClick={() => onTabChange('subscriptions')} className={navItemClass('subscriptions')}>
              <Repeat className="w-3.5 h-3.5" /> Subscriptions
            </button>

            <button onClick={() => onTabChange('invoices')} className={navItemClass('invoices')}>
              <FileText className="w-3.5 h-3.5" /> Invoices
            </button>

            {(isAdmin || isStaff) && (
              <button onClick={() => onTabChange('reports')} className={navItemClass('reports')}>
                <BarChart3 className="w-3.5 h-3.5" /> Reports
              </button>
            )}

            {isAdmin && (
              <button onClick={() => onTabChange('staff')} className={navItemClass('staff')}>
                <Users className="w-3.5 h-3.5" /> Staff
              </button>
            )}

            {isAdmin && (
              <button onClick={() => onTabChange('audit')} className={navItemClass('audit')}>
                <Shield className="w-3.5 h-3.5" /> Audit
              </button>
            )}
          </nav>

          {/* User Profile & Logout */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="text-right hidden sm:block">
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-xs font-bold text-slate-800">
                  {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.email}
                </span>
                {getRoleBadge(user?.role)}
              </div>
              <p className="text-[11px] text-slate-400">
                {isCustomer && customer?.companyName ? customer.companyName : user?.email}
              </p>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
