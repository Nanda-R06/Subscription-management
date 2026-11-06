import React from 'react';
import { Check, X } from 'lucide-react';

const SPECIAL_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/;

export function checkPasswordCriteria(password = '') {
  return {
    length: password.length > 8, // More than 8 characters (min 9)
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    special: SPECIAL_REGEX.test(password),
  };
}

export function PasswordRequirements({ password = '', showOnlyIfDirty = false }) {
  if (showOnlyIfDirty && (!password || password.length === 0)) {
    return null;
  }

  const criteria = checkPasswordCriteria(password);

  const items = [
    { key: 'length', label: 'More than 8 characters (min 9)', valid: criteria.length },
    { key: 'uppercase', label: 'At least one uppercase letter (A-Z)', valid: criteria.uppercase },
    { key: 'lowercase', label: 'At least one lowercase letter (a-z)', valid: criteria.lowercase },
    { key: 'special', label: 'At least one special character (!@#$%^&*)', valid: criteria.special },
  ];

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1.5 mt-2">
      <p className="font-semibold text-slate-700 mb-1">Password Requirements:</p>
      {items.map((item) => (
        <div key={item.key} className="flex items-center space-x-2">
          {item.valid ? (
            <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <Check className="w-3 h-3 stroke-[2.5]" />
            </span>
          ) : (
            <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center shrink-0">
              <X className="w-3 h-3 stroke-[2]" />
            </span>
          )}
          <span className={item.valid ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
