import React, { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { TableSkeleton } from '../components/common/Skeleton';
import Modal from '../components/common/Modal';
import ClientSelect from '../components/common/ClientSelect';
import {
  PlusIcon, TrashIcon, PencilIcon, ArrowDownTrayIcon, EyeIcon,
} from '@heroicons/react/24/outline';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'EGP'];
const STATUSES   = ['Draft', 'Sent', 'Confirmed', 'Cancelled'];

const EMPTY_ITEM = { name: '', qty: '', unitPrice: '', total: '' };

const CONTAINER_TYPES = ['20 DRY', '40 DRY', '40 HC', '20 RF', '40 RF', 'LCL', 'Air'];

const EMPTY_FORM = {
  clientId: '', clientName: '', clientAddress: '', vesselValidity: '',
  shipmentDetails: '', pol: '', pod: '', containerType: '',
  customInvoiceNo: '', currency: 'USD', notes: '',
  items: [{ ...EMPTY_ITEM }],
};

function calcTotal(items) {
  return items.reduce((s, it) => {
    const t = parseFloat(it.qty || 0) * parseFloat(it.unitPrice || 0);
    return s + (isNaN(t) ? 0 : t);
  }, 0);
}

function ItemsTable({ items, onChange }) {
  const set = (idx, field, val) => {
    const next = items.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: val };
      updated.total = (parseFloat(updated.qty || 0) * parseFloat(updated.unitPrice || 0)).toFixed(2);
      return updated;
    });
    onChange(next);
  };
  const add    = () => onChange([...items, { ...EMPTY_ITEM }]);
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide px-1">
        <span className="col-span-5">Product Name</span>
        <span className="col-span-2 text-center">QTY</span>
        <span className="col-span-2 text-right">Unit Price</span>
        <span className="col-span-2 text-right">Total</span>
        <span className="col-span-1" />
      </div>
      {items.map((it, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
          <input className="col-span-5 input text-sm" placeholder="Product name" value={it.name}
            onChange={e => set(idx, 'name', e.target.value)} />
          <input className="col-span-2 input text-sm text-center" placeholder="Qty" type="number" value={it.qty}
            onChange={e => set(idx, 'qty', e.target.value)} />
          <input className="col-span-2 input text-sm text-right" placeholder="0.00" type="number" value={it.unitPrice}
            onChange={e => set(idx, 'unitPrice', e.target.value)} />
          <div className="col-span-2 text-right text-sm font-semibold text-slate-700 dark:text-gray-200 pr-2">
            {parseFloat(it.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <button onClick={() => remove(idx)} className="col-span-1 p-1 text-slate-400 hover:text-red-500 transition-colors">
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button onClick={add} className="text-xs text-gold-600 dark:text-gold-400 hover:underline mt-1">
        + Add product
      </button>
      <div className="flex justify-end border-t border-slate-200 dark:border-navy-700 pt-2 mt-2">
        <span className="text-sm font-bold text-slate-800 dark:text-white mr-4">TOTAL</span>
        <span className="text-sm font-bold text-slate-800 dark:text-white w-28 text-right">
          {calcTotal(items).toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

export default function SalesInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const PAGE_SIZE = 20;
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [clients, setClients]   = useState([]);
  const [previewUrl, setPreviewUrl]   = useState(null);
  const [previewNo, setPreviewNo]     = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    api.get('/clients', { params: { limit: 500 } })
       .then(r => setClients(r.data.data || []))
       .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/sales-invoices', { params: { page, limit: PAGE_SIZE } });
      setInvoices(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (_) {}
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); };

  const handleClientSelect = (id) => {
    const client = clients.find(c => String(c.id) === String(id));
    setForm(f => ({
      ...f,
      clientId: id,
      clientName: client ? client.company_name : '',
      clientAddress: client ? [client.address, client.country].filter(Boolean).join(', ') : '',
    }));
  };

  const openEdit = (inv) => {
    setEditing(inv.id);
    setForm({
      clientId: inv.client_id || '',
      clientName: inv.client_name || '',
      clientAddress: inv.client_address || '',
      vesselValidity: inv.vessel_validity ? inv.vessel_validity.slice(0, 10) : '',
      shipmentDetails: inv.shipment_details || '',
      currency: inv.currency || 'USD',
      status: inv.status || 'Draft',
      pol: inv.pol || '',
      pod: inv.pod || '',
      containerType: inv.container_type || '',
      customInvoiceNo: inv.custom_invoice_no || '',
      notes: inv.notes || '',
      items: Array.isArray(inv.items) ? inv.items
        : (typeof inv.items === 'string' ? JSON.parse(inv.items) : [{ ...EMPTY_ITEM }]),
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.clientName) { toast.error('Client name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        items: form.items.map(it => ({
          name: it.name,
          qty: parseFloat(it.qty) || 0,
          unitPrice: parseFloat(it.unitPrice) || 0,
          total: parseFloat(it.total) || 0,
        })),
      };
      if (editing) {
        await api.put(`/sales-invoices/${editing}`, payload);
        toast.success('Sales invoice updated');
      } else {
        await api.post('/sales-invoices', payload);
        toast.success('Sales invoice created');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const preview = async (inv) => {
    setPreviewLoading(true);
    setPreviewNo(inv.invoice_no);
    setPreviewUrl(null);
    try {
      const res = await api.get(`/sales-invoices/${inv.id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      setPreviewUrl(url);
    } catch (_) { toast.error('Error generating preview'); setPreviewLoading(false); }
    finally { setPreviewLoading(false); }
  };

  const closePreview = () => {
    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewNo('');
  };

  const download = async (inv) => {
    try {
      const res = await api.get(`/sales-invoices/${inv.id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `sales-invoice-${inv.invoice_no}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (_) { toast.error('Error generating PDF'); }
  };

  const remove = async (inv) => {
    if (!window.confirm(`Delete ${inv.invoice_no}?`)) return;
    try {
      await api.delete(`/sales-invoices/${inv.id}`);
      toast.success('Deleted');
      load();
    } catch (_) { toast.error('Failed to delete'); }
  };

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Invoices</h1>
          <p className="page-subtitle">
            Product-based proforma invoices · {total} total
            {total > PAGE_SIZE && ` · page ${page} of ${Math.ceil(total / PAGE_SIZE)}`}
          </p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <PlusIcon className="w-4 h-4 inline mr-1.5" />New Sales Invoice
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? <TableSkeleton rows={6} cols={5} /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-navy-800 border-b border-slate-200 dark:border-navy-700">
                {['Invoice No.', 'Client', 'Vessel Validity', 'Currency', 'Total', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, idx) => (
                <tr key={inv.id}
                  className={`border-b border-slate-100 dark:border-navy-800 hover:bg-amber-50 dark:hover:bg-navy-800/60 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-navy-900/40'}`}>
                  <td className="px-4 py-3 font-mono font-semibold text-gold-600 dark:text-gold-400">
                    {inv.custom_invoice_no || inv.invoice_no}
                    {inv.custom_invoice_no && (
                      <div className="text-[10px] text-slate-400 dark:text-gray-500 font-normal">{inv.invoice_no}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-800 dark:text-gray-200">{inv.client_name || inv.client_display || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-gray-400">
                    {inv.vessel_validity ? new Date(inv.vessel_validity).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-gray-400">{inv.currency}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-gray-200">
                    {inv.currency} {parseFloat(inv.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      inv.status === 'Confirmed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      inv.status === 'Sent'      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      inv.status === 'Cancelled' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                                                   'bg-slate-100 text-slate-500 dark:bg-navy-700 dark:text-gray-400'
                    }`}>{inv.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => preview(inv)} aria-label="Preview PDF" title="Preview PDF"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors">
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => download(inv)} aria-label="Download PDF" title="Download PDF"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                        <ArrowDownTrayIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEdit(inv)} aria-label="Edit"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-gold-500 hover:bg-gold-50 dark:hover:bg-gold-900/20 transition-colors">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => remove(inv)} aria-label="Delete"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!invoices.length && (
                <tr><td colSpan={7} className="text-center py-16 text-slate-400 dark:text-gray-600">
                  No sales invoices yet. Click "New Sales Invoice" to create one.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-navy-700">
            <span className="text-xs text-slate-500 dark:text-gray-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-gray-300 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
              >← Prev</button>
              {Array.from({ length: Math.ceil(total / PAGE_SIZE) }, (_, i) => i + 1)
                .filter(p => Math.abs(p - page) <= 2)
                .map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${p === page
                      ? 'bg-gold-500 text-navy-950 font-semibold'
                      : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-navy-700'}`}
                  >{p}</button>
                ))}
              <button
                disabled={page >= Math.ceil(total / PAGE_SIZE)}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-gray-300 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
              >Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* PDF Preview Modal */}
      <Modal isOpen={previewLoading || !!previewUrl} onClose={closePreview}
        title={`Preview — ${previewNo}`} size="xl">
        {previewLoading ? (
          <div className="flex items-center justify-center h-[70vh] gap-2 text-slate-500 dark:text-gray-400">
            <div className="w-2 h-2 bg-gold-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-2 h-2 bg-gold-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
            <div className="w-2 h-2 bg-gold-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
          </div>
        ) : previewUrl ? (
          <div className="flex flex-col gap-3">
            <iframe src={previewUrl} title={`Sales Invoice ${previewNo}`}
              className="w-full rounded-xl border border-slate-200 dark:border-navy-700"
              style={{ height: '70vh' }} />
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={closePreview}>Close</button>
              <a href={previewUrl} download={`sales-invoice-${previewNo}.pdf`} className="btn-primary">
                <ArrowDownTrayIcon className="w-4 h-4 inline mr-1.5" />Download
              </a>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)}
        title={editing ? 'Edit Sales Invoice' : 'New Sales Invoice'} size="xl">
        <div className="space-y-4">
          {/* Client */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Client *</label>
              <ClientSelect
                clients={clients}
                value={form.clientId}
                onChange={handleClientSelect}
                placeholder="Select client..."
              />
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="select" value={form.currency} onChange={e => setF('currency', e.target.value)}>
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Client name override + address (auto-filled, editable) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Client Name (on PDF)</label>
              <input className="input" value={form.clientName} onChange={e => setF('clientName', e.target.value)}
                placeholder="Auto-filled from client" />
            </div>
            <div>
              <label className="label">Client Address (on PDF)</label>
              <textarea className="input min-h-[56px]" value={form.clientAddress}
                onChange={e => setF('clientAddress', e.target.value)}
                placeholder="Auto-filled from client" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Vessel Validity</label>
              <input type="date" className="input" value={form.vesselValidity} onChange={e => setF('vesselValidity', e.target.value)} />
            </div>
            {editing && (
              <div>
                <label className="label">Status</label>
                <select className="select" value={form.status || 'Draft'} onChange={e => setF('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="label">Address</label>
            <textarea className="input min-h-[56px]" value={form.shipmentDetails}
              onChange={e => setF('shipmentDetails', e.target.value)}
              placeholder="e.g. 6 Abdelfattah Yahia St, Alexandria, Egypt" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">POL</label>
              <input className="input" value={form.pol} onChange={e => setF('pol', e.target.value)}
                placeholder="Port of Loading" />
            </div>
            <div>
              <label className="label">POD</label>
              <input className="input" value={form.pod} onChange={e => setF('pod', e.target.value)}
                placeholder="Port of Discharge" />
            </div>
            <div>
              <label className="label">Container Type</label>
              <select className="select" value={form.containerType} onChange={e => setF('containerType', e.target.value)}>
                <option value="">— Select —</option>
                {CONTAINER_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Products */}
          <div className="border border-slate-200 dark:border-navy-700 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-600 dark:text-gray-300 uppercase tracking-wide mb-3">Products</p>
            <ItemsTable items={form.items} onChange={items => setF('items', items)} />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input min-h-[56px]" value={form.notes} onChange={e => setF('notes', e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-navy-800">
            <button className="btn-ghost" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update' : 'Create Invoice'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
