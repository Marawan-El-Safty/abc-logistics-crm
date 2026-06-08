import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import {
  PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon,
  TruckIcon, ArrowRightIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useAuth } from '../store/AuthContext';
import { formatDistanceToNow, differenceInDays } from 'date-fns';

const CURRENCIES    = ['USD', 'EUR', 'EGP'];
const SERVICE_TYPES = ['FCL', 'LCL'];
const SHIPPING_LINES = [
  'MSC', 'Maersk', 'CMA CGM', 'COSCO', 'ONE', 'Hapag-Lloyd',
  'Evergreen', 'Yang Ming', 'ZIM', 'PIL', 'HMM', 'Wan Hai',
  'KMTC', 'Arkas', 'Gold Star Line', 'Unifeeder', 'EFS',
];

// ── helpers ───────────────────────────────────────────────────────────────────
function rateStatus(validTo) {
  const days = differenceInDays(new Date(validTo), new Date());
  if (days < 0)  return 'expired';
  if (days <= 7) return 'expiring';
  return 'active';
}

const STATUS_STYLE = {
  active:   'bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/25',
  expiring: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/25',
  expired:  'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-gray-500 border border-slate-300 dark:border-navy-600',
};

const STATUS_LABEL = { active: 'Active', expiring: 'Expiring Soon', expired: 'Expired' };

const CARD_BORDER = {
  active:   'border-slate-200 dark:border-navy-700 hover:border-gold-500/40',
  expiring: 'border-yellow-400/40 hover:border-yellow-400/70',
  expired:  'border-slate-200 dark:border-navy-700 opacity-70 hover:opacity-90',
};

// ── Rate Form (create + edit) ─────────────────────────────────────────────────
function RateForm({ rate, onSave, onClose }) {
  const isEdit = !!rate;
  const [form, setForm] = useState({
    shippingLine: rate?.shipping_line || '',
    pol:          rate?.pol           || '',
    pod:          rate?.pod           || '',
    serviceType:  rate?.service_type  || 'FCL',
    rate20dc:     rate?.rate_20dc     || '',
    rate40dc:     rate?.rate_40dc     || '',
    rate40hc:     rate?.rate_40hc     || '',
    rateLcl:      rate?.rate_lcl      || '',
    currency:     rate?.currency      || 'USD',
    transitTime:  rate?.transit_time  || '',
    freeDays:     rate?.free_days     || '',
    validFrom:    rate?.valid_from?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    validTo:      rate?.valid_to?.slice(0, 10)   || '',
    notes:        rate?.notes         || '',
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/shipping-rates/${rate.id}`, form);
        toast.success('Rate updated');
      } else {
        await api.post('/shipping-rates', form);
        toast.success('Rate added');
      }
      onSave();
    } catch (err) { toast.error(err.response?.data?.error || 'Error saving rate'); }
    finally { setLoading(false); }
  };

  const isFCL = form.serviceType === 'FCL';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Carrier + Route */}
      <div className="grid grid-cols-2 gap-4">
        <div className="form-group col-span-2">
          <label className="label">Shipping Line *</label>
          <input
            className="input" required
            list="shipping-lines-list"
            value={form.shippingLine}
            onChange={e => set('shippingLine', e.target.value)}
            placeholder="e.g. MSC, Maersk, CMA CGM..."
          />
          <datalist id="shipping-lines-list">
            {SHIPPING_LINES.map(l => <option key={l} value={l} />)}
          </datalist>
        </div>
        <div className="form-group">
          <label className="label">POL — Port of Loading *</label>
          <input className="input" required value={form.pol}
            onChange={e => set('pol', e.target.value.toUpperCase())}
            placeholder="e.g. EGPSD, EGADK, CNSHA" />
        </div>
        <div className="form-group">
          <label className="label">POD — Port of Discharge *</label>
          <input className="input" required value={form.pod}
            onChange={e => set('pod', e.target.value.toUpperCase())}
            placeholder="e.g. NLRTM, ITGOA, DEHAM" />
        </div>
        <div className="form-group">
          <label className="label">Service Type</label>
          <select className="select" value={form.serviceType} onChange={e => set('serviceType', e.target.value)}>
            {SERVICE_TYPES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="label">Currency</label>
          <select className="select" value={form.currency} onChange={e => set('currency', e.target.value)}>
            {CURRENCIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Rates */}
      <div>
        <p className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-3">
          Rates ({form.currency})
        </p>
        {isFCL ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="form-group">
              <label className="label">20DC</label>
              <input className="input" type="number" step="0.01" min="0"
                placeholder="0.00" value={form.rate20dc}
                onChange={e => set('rate20dc', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">40DC</label>
              <input className="input" type="number" step="0.01" min="0"
                placeholder="0.00" value={form.rate40dc}
                onChange={e => set('rate40dc', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">40HC</label>
              <input className="input" type="number" step="0.01" min="0"
                placeholder="0.00" value={form.rate40hc}
                onChange={e => set('rate40hc', e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="form-group">
            <label className="label">LCL Rate <span className="text-slate-400 dark:text-gray-500 font-normal">(per CBM)</span></label>
            <input className="input" type="number" step="0.01" min="0"
              placeholder="0.00" value={form.rateLcl}
              onChange={e => set('rateLcl', e.target.value)} />
          </div>
        )}
      </div>

      {/* T/T + Free Days */}
      <div className="grid grid-cols-2 gap-4">
        <div className="form-group">
          <label className="label">T/T — Transit Time <span className="text-slate-400 dark:text-gray-500 font-normal">(optional)</span></label>
          <input className="input" value={form.transitTime}
            onChange={e => set('transitTime', e.target.value)}
            placeholder="e.g. 14 days, 10-12 days" />
        </div>
        <div className="form-group">
          <label className="label">Free Days <span className="text-slate-400 dark:text-gray-500 font-normal">(optional)</span></label>
          <input className="input" type="number" min="0" value={form.freeDays}
            onChange={e => set('freeDays', e.target.value)}
            placeholder="e.g. 14" />
        </div>
      </div>

      {/* Validity */}
      <div>
        <p className="text-xs text-slate-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-3">Validity Period</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label">Valid From</label>
            <input className="input" type="date" value={form.validFrom}
              onChange={e => set('validFrom', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="label">Valid To *</label>
            <input className="input" type="date" required value={form.validTo}
              onChange={e => set('validTo', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="form-group">
        <label className="label">Notes <span className="text-slate-400 dark:text-gray-500 font-normal">(optional)</span></label>
        <textarea className="input" rows={2} value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="e.g. Includes BAF, direct service, etc." />
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : (isEdit ? 'Save Changes' : 'Add Rate')}
        </button>
      </div>
    </form>
  );
}

// ── Rate Card ─────────────────────────────────────────────────────────────────
function RateCard({ rate, onEdit, onDelete, canDelete }) {
  const st    = rateStatus(rate.valid_to);
  const isFCL = rate.service_type === 'FCL';
  const hasRates = rate.rate_20dc || rate.rate_40dc || rate.rate_40hc || rate.rate_lcl;

  const fmt = (v) => v ? parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : null;

  const daysLeft = differenceInDays(new Date(rate.valid_to), new Date());

  return (
    <div className={`card flex flex-col gap-3 transition-all ${CARD_BORDER[st]}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
            <TruckIcon className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 dark:text-white text-sm truncate">{rate.shipping_line}</div>
            <div className="text-xs text-slate-500 dark:text-gray-400">{rate.service_type}</div>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_STYLE[st]}`}>
          {STATUS_LABEL[st]}
        </span>
      </div>

      {/* Route */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-navy-800 rounded-lg">
        <span className="font-mono text-sm font-bold text-gold-600 dark:text-gold-400 flex-shrink-0">{rate.pol}</span>
        <ArrowRightIcon className="w-3.5 h-3.5 text-slate-400 dark:text-gray-500 flex-shrink-0" />
        <span className="font-mono text-sm font-bold text-gold-600 dark:text-gold-400 flex-shrink-0">{rate.pod}</span>
        {rate.transit_time && (
          <span className="ml-auto text-xs text-slate-500 dark:text-gray-400 flex-shrink-0">
            T/T: <span className="font-medium text-slate-700 dark:text-gray-300">{rate.transit_time}</span>
          </span>
        )}
      </div>

      {/* Rates */}
      {hasRates && (
        <div className={`grid gap-2 ${isFCL ? 'grid-cols-3' : 'grid-cols-1'}`}>
          {isFCL ? (
            <>
              {[['20DC', fmt(rate.rate_20dc)], ['40DC', fmt(rate.rate_40dc)], ['40HC', fmt(rate.rate_40hc)]].map(([label, val]) => (
                <div key={label} className="text-center">
                  <div className="text-xs text-slate-500 dark:text-gray-400">{label}</div>
                  <div className={`text-sm font-bold ${val ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-navy-600'}`}>
                    {val ? `${rate.currency} ${val}` : '—'}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="text-center">
              <div className="text-xs text-slate-500 dark:text-gray-400">LCL / CBM</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {fmt(rate.rate_lcl) ? `${rate.currency} ${fmt(rate.rate_lcl)}` : '—'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Free days */}
      {rate.free_days && (
        <div className="text-xs text-slate-500 dark:text-gray-400">
          Free Days: <span className="font-medium text-slate-700 dark:text-gray-300">{rate.free_days} days</span>
        </div>
      )}

      {/* Notes */}
      {rate.notes && (
        <p className="text-xs text-slate-500 dark:text-gray-400 italic line-clamp-2">{rate.notes}</p>
      )}

      {/* Footer */}
      <div className="flex items-end justify-between pt-2 border-t border-slate-100 dark:border-navy-700 mt-auto">
        <div className="text-xs text-slate-400 dark:text-gray-600 space-y-0.5">
          <div>
            {new Date(rate.valid_from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            {' – '}
            <span className={daysLeft < 0 ? 'text-red-500 dark:text-red-400' : daysLeft <= 7 ? 'text-yellow-600 dark:text-yellow-400' : ''}>
              {new Date(rate.valid_to).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {daysLeft >= 0 && daysLeft <= 30 && (
              <span className={`ml-1 font-medium ${daysLeft <= 7 ? 'text-yellow-600 dark:text-yellow-400' : 'text-slate-500'}`}>
                ({daysLeft}d left)
              </span>
            )}
          </div>
          {rate.created_by_name && (
            <div>By {rate.created_by_name}</div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(rate)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
            title="Edit rate"
          >
            <PencilIcon className="w-3.5 h-3.5" />
          </button>
          {canDelete && (
            <button
              onClick={() => onDelete(rate)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
              title="Delete rate"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ShippingRatesPage() {
  const [rates, setRates]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editRate, setEditRate]   = useState(null);
  const [deleteTarget, setDelete] = useState(null);

  // Filters (all client-side for snappy UX)
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { canManage } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/shipping-rates');
      setRates(res.data.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Client-side filtering
  const filtered = useMemo(() => {
    let list = rates;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.shipping_line.toLowerCase().includes(q) ||
        r.pol.toLowerCase().includes(q) ||
        r.pod.toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== 'all') {
      list = list.filter(r => rateStatus(r.valid_to) === statusFilter);
    }
    return list;
  }, [rates, search, statusFilter]);

  // Stats
  const stats = useMemo(() => ({
    active:   rates.filter(r => rateStatus(r.valid_to) === 'active').length,
    expiring: rates.filter(r => rateStatus(r.valid_to) === 'expiring').length,
    expired:  rates.filter(r => rateStatus(r.valid_to) === 'expired').length,
    routes:   new Set(rates.map(r => `${r.pol}-${r.pod}`)).size,
  }), [rates]);

  const handleDelete = async () => {
    try {
      await api.delete(`/shipping-rates/${deleteTarget.id}`);
      toast.success('Rate deleted');
      setDelete(null);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error deleting rate'); }
  };

  const STATUS_FILTERS = [
    { key: 'all',      label: 'All Rates',      count: rates.length },
    { key: 'active',   label: 'Active',          count: stats.active   },
    { key: 'expiring', label: 'Expiring Soon',   count: stats.expiring },
    { key: 'expired',  label: 'Expired',         count: stats.expired  },
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Shipping Line Rates</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm mt-0.5">
            {stats.active} active rates · {stats.routes} unique routes · {stats.expiring > 0 && (
              <span className="text-yellow-600 dark:text-yellow-400 font-medium">{stats.expiring} expiring soon</span>
            )}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <PlusIcon className="w-4 h-4 inline mr-1.5" />Add Rate
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" />
          <input
            className="input pl-9"
            placeholder="Search carrier, POL, POD…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status toggle */}
        <div className="flex gap-1 bg-slate-100 dark:bg-navy-800 rounded-lg p-1 flex-wrap">
          {STATUS_FILTERS.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap
                ${statusFilter === key
                  ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              {label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs
                ${statusFilter === key ? 'bg-gold-500/20 text-gold-600 dark:text-gold-400' : 'bg-slate-200 dark:bg-navy-600 text-slate-500 dark:text-gray-500'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 dark:text-gray-500">Loading rates...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <TruckIcon className="w-12 h-12 text-slate-300 dark:text-navy-700 mb-3" />
          <p className="text-slate-900 dark:text-white font-medium">
            {rates.length === 0 ? 'No rates added yet' : 'No rates match your search'}
          </p>
          <p className="text-slate-500 dark:text-gray-500 text-sm mt-1">
            {rates.length === 0
              ? 'Add your first shipping rate using the button above'
              : 'Try adjusting your search or filters'}
          </p>
          {rates.length === 0 && (
            <button className="btn-primary mt-4 text-sm" onClick={() => setShowForm(true)}>
              <PlusIcon className="w-4 h-4 inline mr-1.5" />Add First Rate
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(rate => (
            <RateCard
              key={rate.id}
              rate={rate}
              onEdit={setEditRate}
              onDelete={setDelete}
              canDelete={canManage}
            />
          ))}
        </div>
      )}

      {/* Result count when filtering */}
      {!loading && search && filtered.length > 0 && (
        <p className="text-xs text-slate-400 dark:text-gray-600 mt-4 text-center">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{search}"
        </p>
      )}

      {/* Add Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Add Shipping Rate" size="lg">
        <RateForm onSave={() => { setShowForm(false); load(); }} onClose={() => setShowForm(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editRate} onClose={() => setEditRate(null)} title="Edit Shipping Rate" size="lg">
        {editRate && (
          <RateForm
            rate={editRate}
            onSave={() => { setEditRate(null); load(); }}
            onClose={() => setEditRate(null)}
          />
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDelete(null)}
        onConfirm={handleDelete}
        title="Delete Rate"
        message={`Delete the ${deleteTarget?.shipping_line} rate from ${deleteTarget?.pol} → ${deleteTarget?.pod}? This cannot be undone.`}
        danger
      />
    </div>
  );
}
