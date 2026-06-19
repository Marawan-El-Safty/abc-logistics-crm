import React from 'react';
import { useRoles } from '../../hooks/useRoles';

export default function RoleSelect({ value, onChange, disabled, className = '' }) {
  const { roles, loading } = useRoles();

  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled || loading}
      className={`border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {loading && <option value="">Loading…</option>}
      {roles.map(r => (
        <option key={r.id} value={r.id}>{r.name}</option>
      ))}
    </select>
  );
}
