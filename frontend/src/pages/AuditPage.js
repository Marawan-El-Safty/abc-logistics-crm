import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import { TrashIcon, ArrowUturnLeftIcon, ClockIcon } from '@heroicons/react/24/outline';

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
  const [trash, setTrash]     = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try { setTrash((await api.get('/audit/trash')).data.data || []); }
    catch (_) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadTrash(); }, [loadTrash]);

  const restore = async (item) => {
    try {
      await api.post(`/audit/trash/${item.entity_type}/${item.id}/restore`);
      toast.success(`${ENTITY_LABEL[item.entity_type] || 'Record'} restored`);
      loadTrash();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to restore');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Trash</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm">Recover deleted records</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500 dark:text-gray-500">Loading...</div>
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
