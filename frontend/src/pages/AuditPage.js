import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import {
  ClipboardDocumentListIcon, TrashIcon, ArrowUturnLeftIcon, ClockIcon,
  UserCircleIcon, FunnelIcon,
} from '@heroicons/react/24/outline';

// Human-readable action labels
const ACTION_LABEL = {
  CREATE:                  'Created',
  UPDATE:                  'Updated',
  DELETE:                  'Deleted',
  RESTORE:                 'Restored',
  APPROVE:                 'Approved',
  SUBMIT:                  'Submitted for Review',
  RETURN:                  'Returned for Revision',
  CONFIRM:                 'Client Confirmed',
  MARK_PAID:               'Marked Paid',
  STATUS_SENT:             'Marked Sent',
  STATUS_REJECTED:         'Rejected',
  STATUS_APPROVED:         'Approved',
  STATUS_CONFIRMED:        'Client Confirmed',
  STATUS_PENDING_REVIEW:   'Submitted for Review',
};

const ACTION_STYLE = {
  CREATE:                'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  UPDATE:                'bg-slate-400/15 text-slate-500 dark:text-gray-400',
  DELETE:                'bg-red-500/15 text-red-600 dark:text-red-400',
  RESTORE:               'bg-green-500/15 text-green-600 dark:text-green-400',
  APPROVE:               'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  STATUS_APPROVED:       'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  SUBMIT:                'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  STATUS_PENDING_REVIEW: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  RETURN:                'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  CONFIRM:               'bg-green-500/15 text-green-600 dark:text-green-400',
  STATUS_CONFIRMED:      'bg-green-500/15 text-green-600 dark:text-green-400',
  MARK_PAID:             'bg-green-500/15 text-green-600 dark:text-green-400',
  STATUS_SENT:           'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  STATUS_REJECTED:       'bg-red-500/15 text-red-600 dark:text-red-400',
};

const ENTITY_LABEL = {
  quotation: 'Quotation', invoice: 'Invoice', client: 'Contact',
  lead: 'Lead', shipping_rate: 'Shipping Rate', request: 'Request',
  shipment: 'Shipment',
};

const ENTITY_COLOR = {
  quotation: 'bg-gold-500/15 text-gold-600 dark:text-gold-400',
  invoice:   'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  client:    'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  lead:      'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  shipment:  'bg-teal-500/15 text-teal-600 dark:text-teal-400',
};

export default function AuditPage() {
  const [tab, setTab]         = useState('log');
  const [log, setLog]         = useState([]);
  const [trash, setTrash]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser]   = useState('');
  const [filterEntity, setFilterEntity] = useState('');

  const loadLog = useCallback(async () => {
    setLoading(true);
    try { setLog((await api.get('/audit', { params: { limit: 500 } })).data.data || []); }
    catch (_) {} finally { setLoading(false); }
  }, []);

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try { setTrash((await api.get('/audit/trash')).data.data || []); }
    catch (_) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { tab === 'log' ? loadLog() : loadTrash(); }, [tab, loadLog, loadTrash]);

  const restore = async (item) => {
    try {
      await api.post(`/audit/trash/${item.entity_type}/${item.id}/restore`);
      toast.success(`${ENTITY_LABEL[item.entity_type] || 'Record'} restored`);
      loadTrash();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to restore');
    }
  };

  // Unique users + entity types for filters
  const users   = [...new Set(log.map(e => e.user_name).filter(Boolean))].sort();
  const entities = [...new Set(log.map(e => e.entity_type).filter(Boolean))].sort();

  const filtered = log.filter(e =>
    (!filterUser   || e.user_name   === filterUser) &&
    (!filterEntity || e.entity_type === filterEntity)
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Audit &amp; Trash</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm">Track who did what, and recover deleted records</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 bg-slate-100 dark:bg-navy-900 rounded-xl w-fit">
        {[['log', 'Activity Log', ClipboardDocumentListIcon], ['trash', 'Trash', TrashIcon]].map(([val, label, Icon]) => (
          <button key={val} onClick={() => setTab(val)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === val
                ? 'bg-white dark:bg-navy-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500 dark:text-gray-500">Loading...</div>
      ) : tab === 'log' ? (
        <>
          {/* Filters */}
          {log.length > 0 && (
            <div className="flex gap-3 mb-4 flex-wrap items-center">
              <FunnelIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <select className="select text-sm w-auto" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
                <option value="">All Users</option>
                {users.map(u => <option key={u}>{u}</option>)}
              </select>
              <select className="select text-sm w-auto" value={filterEntity} onChange={e => setFilterEntity(e.target.value)}>
                <option value="">All Types</option>
                {entities.map(t => <option key={t} value={t}>{ENTITY_LABEL[t] || t}</option>)}
              </select>
              {(filterUser || filterEntity) && (
                <button onClick={() => { setFilterUser(''); setFilterEntity(''); }}
                  className="text-xs text-slate-400 hover:text-gold-500 underline">Clear</button>
              )}
              <span className="text-xs text-slate-400 dark:text-gray-600 ml-auto">{filtered.length} entries</span>
            </div>
          )}

          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Type</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id}>
                    <td className="text-slate-500 dark:text-gray-400 text-xs whitespace-nowrap">
                      <div title={new Date(e.created_at).toLocaleString('en-GB')}>
                        {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                      </div>
                      <div className="text-slate-400 dark:text-gray-600 text-[10px]">
                        {new Date(e.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                        {' '}
                        {new Date(e.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <div className="w-7 h-7 rounded-full bg-gold-500 flex items-center justify-center text-navy-950 font-bold text-xs flex-shrink-0">
                          {e.user_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{e.user_name || '—'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border border-transparent ${ACTION_STYLE[e.action] || 'bg-slate-400/15 text-slate-500'}`}>
                        {ACTION_LABEL[e.action] || e.action}
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ENTITY_COLOR[e.entity_type] || 'bg-slate-500/15 text-slate-500'}`}>
                        {ENTITY_LABEL[e.entity_type] || e.entity_type}
                      </span>
                    </td>
                    <td className="text-slate-700 dark:text-gray-300 text-sm font-mono font-medium">{e.entity_label || '—'}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={5} className="text-center py-12 text-slate-500 dark:text-gray-500">
                    {log.length === 0 ? 'No activity recorded yet. Actions taken in the CRM will appear here.' : 'No entries match the current filter.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          {trash.map(item => (
            <div key={`${item.entity_type}-${item.id}`}
              className="card flex items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <TrashIcon className="w-4 h-4 text-red-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.label || '(no label)'}</p>
                  <p className="text-xs text-slate-500 dark:text-gray-400 flex items-center gap-1.5">
                    <span className={`inline-flex items-center px-1.5 py-0 rounded text-[10px] font-medium ${ENTITY_COLOR[item.entity_type] || 'bg-slate-500/15 text-slate-500'}`}>
                      {ENTITY_LABEL[item.entity_type] || item.entity_type}
                    </span>
                    <ClockIcon className="w-3 h-3" />
                    deleted {formatDistanceToNow(new Date(item.deleted_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <button onClick={() => restore(item)}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 flex-shrink-0">
                <ArrowUturnLeftIcon className="w-3.5 h-3.5" />Restore
              </button>
            </div>
          ))}
          {!trash.length && (
            <div className="empty-state">
              <TrashIcon className="w-12 h-12 text-slate-300 dark:text-navy-700 mb-3" />
              <p className="text-slate-900 dark:text-white font-medium">Trash is empty</p>
              <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">Deleted records appear here and can be restored.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
