import React, { useEffect, useState } from 'react';
import { Shield, RefreshCw, AlertCircle, FileCode } from 'lucide-react';
import { apiRequest } from '../api/client.js';

export function AdminAudit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest('/admin/audit-logs');
      if (res.success && Array.isArray(res.data)) {
        setLogs(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-purple-100 text-purple-700">
              <Shield className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Security & Audit Logs</h1>
            <span className="text-xs bg-purple-100 text-purple-800 border border-purple-200 px-2.5 py-0.5 rounded-full font-semibold uppercase">
              Admin Only
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Immutable audit trail of authentication events, staff creations, and sensitive administrative actions.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold transition-colors shadow-2xs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">Action</th>
                <th className="px-6 py-3.5">Actor</th>
                <th className="px-6 py-3.5">Entity</th>
                <th className="px-6 py-3.5">Details</th>
                <th className="px-6 py-3.5">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center font-sans text-slate-400">
                    Loading security audit logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center font-sans text-slate-400">
                    No audit records recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 font-semibold text-slate-900">
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-700 font-sans">
                      {log.actor_email ? (
                        <span>
                          {log.actor_email}{' '}
                          <span className="text-[10px] text-purple-600 uppercase font-semibold">
                            ({log.actor_role})
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">System</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {log.entity_type}:{log.entity_id ? log.entity_id.slice(0, 8) + '...' : '—'}
                    </td>
                    <td className="px-6 py-3 text-slate-600 max-w-xs truncate">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                    <td className="px-6 py-3 text-slate-500">{log.ip_address || '127.0.0.1'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
