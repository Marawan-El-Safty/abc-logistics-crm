import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import {
  PlusIcon, CurrencyDollarIcon, PencilIcon, TrashIcon,
  DocumentArrowDownIcon, BuildingLibraryIcon, DocumentTextIcon, EyeIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import Badge from '../components/common/Badge';
import { TableSkeleton } from '../components/common/Skeleton';
import Modal from '../components/common/Modal';
import ClientSelect from '../components/common/ClientSelect';
import SearchSelect from '../components/common/SearchSelect';
import { useAuth } from '../store/AuthContext';

const PAYMENT_STATUSES = ['Pending', 'Paid', 'Overdue'];
const CURRENCIES       = ['USD', 'EGP', 'EUR'];
const CHARGE_CATEGORIES = [
  'Freight', 'THC', 'Documentation', 'Custom Clearance',
  'Inland Charges', 'Official Receipts', 'Other',
];

const mkCharge = () => ({ description: '', category: 'Freight', qty: '1', unitRate: '', amount: '' });

// Map a server charge row (invoice_charges or quotation_charges) into form shape
const mapServerCharge = (c) => ({
  description: c.description    || '',
  category:    c.category       || 'Freight',
  qty:         String(c.qty     ?? 1),
  unitRate:    String(c.unit_rate ?? ''),
  amount:      String(c.amount  ?? ''),
});

// Ensure a charge's own category is selectable even if it came from a
// quotation with a category not in the invoice list (e.g. "Local Charges")
const catOptions = (current) =>
  (!current || CHARGE_CATEGORIES.includes(current))
    ? CHARGE_CATEGORIES
    : [current, ...CHARGE_CATEGORIES];

// ── Invoice Form (create + edit) ─────────────────────────────────────────────
function InvoiceForm({ invoice, onSave, onClose, onGoToBankAccounts }) {
  const isEdit = !!invoice;
  const { settings } = useAuth();
  const defaultCurrency = settings?.defaultCurrency || 'USD';

  // Determine mode: standalone (no quotation) or linked to quotation
  const [invoiceMode, setInvoiceMode] = useState(
    isEdit ? (invoice?.quotation_id ? 'quotation' : 'standalone') : 'standalone'
  );
  const fromQuotation = invoiceMode === 'quotation';

  const [form, setForm] = useState({
    quotationId:   invoice?.quotation_id    || '',
    clientId:        invoice?.client_id         || '',
    customInvoiceNo: invoice?.custom_invoice_no || '',
    description:     invoice?.description       || '',
    amount:        invoice?.amount          || '',
    buyingTotal:   invoice?.buying_total    || '',
    currency:      invoice?.currency        || defaultCurrency,
    dueDate:       invoice?.due_date?.slice(0, 10) || '',
    notes:         invoice?.notes           || '',
    paymentStatus: invoice?.payment_status  || '',
    blNumber:      invoice?.bl_number       || '',
    vessel:        invoice?.vessel          || '',
    shippingLine:  invoice?.shipping_line   || '',
    clientVat:     invoice?.client_vat      || '',
    pol:           invoice?.pol             || '',
    pod:           invoice?.pod             || '',
    containerType: invoice?.container_type  || '',
    containerQty:  invoice?.container_qty   || '',
    cargoType:     invoice?.cargo_type      || '',
    shipmentType:  invoice?.shipment_type   || '',
    bankAccountId: invoice?.bank_account_id || '',
  });

  const [charges,      setCharges]      = useState([mkCharge()]);
  const [clients,      setClients]      = useState([]);
  const [quotations,   setQuotations]   = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading,      setLoading]      = useState(false);

  // ── Load supporting data ──────────────────────────────────────────────────
  useEffect(() => {
    api.get('/clients',      { params: { limit: 200 } }).then(r => setClients(r.data.data      || [])).catch(() => {});
    api.get('/bank-accounts')                           .then(r => setBankAccounts(r.data.data  || [])).catch(() => {});
    api.get('/quotations',   { params: { limit: 200 } }).then(r => setQuotations(r.data.data   || [])).catch(() => {});

    // Load existing line-item charges when editing.
    // Prefer the invoice's own charges; for older quotation-linked invoices
    // that have none, fall back to the linked quotation's charges.
    if (isEdit && invoice?.id) {
      api.get(`/invoices/${invoice.id}`)
        .then(async (r) => {
          const full = r.data.data;
          if (full.invoice_charges?.length) {
            setCharges(full.invoice_charges.map(mapServerCharge));
          } else if (invoice.quotation_id) {
            const qr = await api.get(`/quotations/${invoice.quotation_id}`);
            const qCharges = qr.data.data?.charges || [];
            if (qCharges.length) setCharges(qCharges.map(mapServerCharge));
          }
        })
        .catch(() => {});
    }
  }, [isEdit, invoice?.id, invoice?.quotation_id]);

  // ── Auto-sum line items → selling amount (both modes) ────────────────────
  useEffect(() => {
    const total = charges.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
    if (total > 0) setForm(f => ({ ...f, amount: total.toFixed(2) }));
  }, [charges]);

  // ── Quotation auto-fill: header details + line-item charges ──────────────
  const handleQuotationChange = async (qId) => {
    if (!qId) { setForm(f => ({ ...f, quotationId: '' })); return; }
    const q = quotations.find(q => String(q.id) === String(qId));
    if (q) {
      setForm(f => ({
        ...f,
        quotationId: qId,
        clientId:    q.client_id    || '',
        description: `${q.origin} → ${q.destination} | ${q.service_type}`,
        amount:      q.total_amount || '',
        currency:    q.currency     || 'USD',
        buyingTotal: q.buying_total || '',
      }));
    }
    // Pull the quotation's individual charges into the line-items editor
    try {
      const res = await api.get(`/quotations/${qId}`);
      const qCharges = res.data.data?.charges || [];
      setCharges(qCharges.length ? qCharges.map(mapServerCharge) : [mkCharge()]);
    } catch (_) {}
  };

  // ── Charges helpers ───────────────────────────────────────────────────────
  const updateCharge = (idx, field, val) => {
    setCharges(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      // Auto-calc amount when qty or unit rate changes
      if (field === 'qty' || field === 'unitRate') {
        const qty  = parseFloat(field === 'qty'      ? val : next[idx].qty)      || 0;
        const rate = parseFloat(field === 'unitRate'  ? val : next[idx].unitRate) || 0;
        if (qty > 0 && rate > 0) next[idx].amount = (qty * rate).toFixed(2);
      }
      return next;
    });
  };

  const addCharge    = () => setCharges(p => [...p, mkCharge()]);
  const removeCharge = (idx) => setCharges(p => p.filter((_, i) => i !== idx));

  const chargesTotal = charges.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
  const validCharges = charges.filter(c => c.description.trim() && parseFloat(c.amount) > 0);

  // ── Profit preview ────────────────────────────────────────────────────────
  const profit = parseFloat(form.amount || 0) - parseFloat(form.buyingTotal || 0);
  const margin = parseFloat(form.amount) > 0 && parseFloat(form.buyingTotal) > 0
    ? (profit / parseFloat(form.amount)) * 100 : null;

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const sharedFields = {
        description:   form.description,
        amount:        form.amount,
        buyingTotal:   form.buyingTotal   ? parseFloat(form.buyingTotal) : undefined,
        currency:      form.currency,
        dueDate:       form.dueDate,
        notes:         form.notes,
        customInvoiceNo: form.customInvoiceNo || undefined,
        blNumber:        form.blNumber      || undefined,
        vessel:        form.vessel        || undefined,
        shippingLine:  form.shippingLine  || undefined,
        clientVat:     form.clientVat     || undefined,
        pol:           form.pol           || undefined,
        pod:           form.pod           || undefined,
        containerType: form.containerType || undefined,
        containerQty:  form.containerQty  ? parseInt(form.containerQty) : undefined,
        cargoType:     form.cargoType     || undefined,
        shipmentType:  form.shipmentType  || undefined,
        bankAccountId: form.bankAccountId || undefined,
        // Persist line items for both standalone and quotation-linked invoices.
        // An empty array clears existing charges when editing.
        charges: validCharges.map(c => ({
          description: c.description,
          category:    c.category,
          qty:         parseFloat(c.qty) || 1,
          unitRate:    parseFloat(c.unitRate) || null,
          amount:      parseFloat(c.amount),
          currency:    form.currency,
        })),
      };

      if (isEdit) {
        await api.put(`/invoices/${invoice.id}`, {
          ...sharedFields,
          paymentStatus: form.paymentStatus || undefined,
        });
        toast.success('Invoice updated');
      } else {
        await api.post('/invoices', {
          ...sharedFields,
          quotationId: fromQuotation ? (form.quotationId || undefined) : undefined,
          clientId:    form.clientId,
        });
        toast.success('Invoice created');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error saving invoice');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── Mode toggle (create only) ── */}
      {!isEdit && (
        <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-navy-700 mb-1">
          <button type="button" onClick={() => setInvoiceMode('standalone')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              invoiceMode === 'standalone'
                ? 'bg-gold-500 text-navy-950'
                : 'bg-white dark:bg-navy-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
            }`}>
            ✏️&nbsp; Standalone Invoice
          </button>
          <button type="button" onClick={() => setInvoiceMode('quotation')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors border-l border-slate-200 dark:border-navy-700 ${
              invoiceMode === 'quotation'
                ? 'bg-gold-500 text-navy-950'
                : 'bg-white dark:bg-navy-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
            }`}>
            🔗&nbsp; From Quotation
          </button>
        </div>
      )}

      {/* ── Linked-quotation badge (edit mode) ── */}
      {isEdit && invoice?.quotation_id && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gold-500/10 border border-gold-500/20 text-sm">
          <DocumentTextIcon className="w-4 h-4 text-gold-500 flex-shrink-0" />
          <span className="text-slate-600 dark:text-gray-400">Linked to quotation:</span>
          <span className="text-gold-500 font-mono font-medium">{invoice.invoice_no}</span>
        </div>
      )}

      {/* ── Quotation selector (quotation mode, create only) ── */}
      {fromQuotation && !isEdit && (
        <div className="form-group">
          <label className="label">
            Select Quotation
            <span className="text-slate-400 dark:text-gray-500 font-normal"> (auto-fills details)</span>
          </label>
          <SearchSelect
            items={quotations}
            value={form.quotationId}
            onChange={handleQuotationChange}
            placeholder="— Search quotations —"
            noneLabel="— Search quotations —"
            getLabel={(q) => `${q.reference_no}  ·  ${q.client_name || '?'}`}
            getSearch={(q) => [q.reference_no, q.client_name, q.origin, q.destination, q.service_type].filter(Boolean).join(' ')}
            renderOption={(q, isActive) => (
              <div>
                <div className={`font-medium text-sm ${isActive ? 'text-gold-500' : 'text-slate-900 dark:text-white'}`}>
                  {q.reference_no}
                </div>
                <div className="text-xs text-slate-500 dark:text-gray-400 truncate">
                  {q.client_name || '?'}  ·  {q.origin} → {q.destination}
                  {q.service_type ? `  ·  ${q.service_type}` : ''}
                </div>
              </div>
            )}
          />
          {form.quotationId && (
            <p className="text-xs text-gold-500 mt-1">Invoice number will match the quotation reference</p>
          )}
        </div>
      )}

      {/* ── Client ── */}
      {!fromQuotation && (
        <div className="form-group">
          <label className="label">Client *</label>
          <ClientSelect
            clients={clients}
            value={form.clientId}
            onChange={id => setForm({ ...form, clientId: id })}
            required
          />
        </div>
      )}
      {fromQuotation && form.clientId && (
        <div className="form-group">
          <label className="label">Client</label>
          <p className="text-sm text-slate-900 dark:text-white font-medium px-3 py-2 bg-slate-100 dark:bg-navy-800 rounded-lg">
            {clients.find(c => String(c.id) === String(form.clientId))?.company_name || invoice?.client_name || '—'}
          </p>
        </div>
      )}

      {/* ── Custom Invoice No ── */}
      <div className="form-group">
        <label className="label">Invoice No. <span className="text-slate-400 font-normal">(printed on PDF — leave blank to use auto-generated)</span></label>
        <input className="input font-mono" value={form.customInvoiceNo}
          onChange={e => setForm({ ...form, customInvoiceNo: e.target.value })}
          placeholder="e.g. INV-001 · auto-generated if empty" />
      </div>

      {/* ── Description ── */}
      <div className="form-group">
        <label className="label">Description *</label>
        <textarea className="input" rows={2} required value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })} />
      </div>

      {/* ── Line items (both modes) ── */}
      {(
        <div className="border-t border-slate-200 dark:border-navy-700 pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-500 dark:text-gray-500 uppercase tracking-wider font-medium">
              Line Items / Charges
              <span className="normal-case font-normal ml-1 text-slate-400 dark:text-gray-600">
                {fromQuotation ? '— pulled from quotation, editable' : '— optional, totals auto-fill amount below'}
              </span>
            </p>
            <button type="button" onClick={addCharge}
              className="text-xs text-gold-500 hover:text-gold-400 flex items-center gap-1 transition-colors font-medium">
              <PlusIcon className="w-3.5 h-3.5" /> Add Line
            </button>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-12 gap-2 mb-1.5 px-0.5 hidden sm:grid">
            <span className="col-span-3 text-xs text-slate-400 dark:text-gray-600">Description</span>
            <span className="col-span-2 text-xs text-slate-400 dark:text-gray-600">Category</span>
            <span className="col-span-2 text-xs text-slate-400 dark:text-gray-600 text-center">Qty</span>
            <span className="col-span-2 text-xs text-slate-400 dark:text-gray-600">Unit Rate</span>
            <span className="col-span-2 text-xs text-slate-400 dark:text-gray-600">Amount</span>
            <span className="col-span-1" />
          </div>

          <div className="space-y-2">
            {charges.map((ch, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <input
                  className="input col-span-3 text-sm"
                  placeholder="e.g. Ocean Freight"
                  value={ch.description}
                  onChange={e => updateCharge(idx, 'description', e.target.value)}
                />
                <select
                  className="select col-span-2 text-sm"
                  value={ch.category}
                  onChange={e => updateCharge(idx, 'category', e.target.value)}>
                  {catOptions(ch.category).map(c => <option key={c}>{c}</option>)}
                </select>
                <input
                  className="input col-span-2 text-sm text-center"
                  type="number" min="0.001" step="any"
                  placeholder="1"
                  value={ch.qty}
                  onChange={e => updateCharge(idx, 'qty', e.target.value)}
                />
                <input
                  className="input col-span-2 text-sm"
                  type="number" min="0" step="0.01"
                  placeholder="Rate"
                  value={ch.unitRate}
                  onChange={e => updateCharge(idx, 'unitRate', e.target.value)}
                />
                <input
                  className="input col-span-2 text-sm font-medium"
                  type="number" min="0" step="0.01"
                  placeholder="Amount"
                  value={ch.amount}
                  onChange={e => updateCharge(idx, 'amount', e.target.value)}
                />
                <button type="button" onClick={() => removeCharge(idx)}
                  className="col-span-1 flex justify-center p-1.5 text-slate-400 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {chargesTotal > 0 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 dark:border-navy-700">
              <span className="text-xs text-slate-400 dark:text-gray-500">Charges subtotal (auto-fills Selling Amount)</span>
              <span className="text-sm font-bold text-gold-500">
                {form.currency} {chargesTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Amounts ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="form-group col-span-2">
          <label className="label">
            Selling Amount *
            {!fromQuotation && chargesTotal > 0 && (
              <span className="text-gold-500 font-normal text-xs ml-1">(auto-filled from charges)</span>
            )}
          </label>
          <input className="input" type="number" step="0.01" required
            value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="label">Currency</label>
          <select className="select" value={form.currency}
            onChange={e => setForm({ ...form, currency: e.target.value })}>
            {CURRENCIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="form-group col-span-2">
          <label className="label">Buying Price / Cost</label>
          <input className="input" type="number" step="0.01"
            placeholder="Internal cost (optional)"
            value={form.buyingTotal}
            onChange={e => setForm({ ...form, buyingTotal: e.target.value })} />
        </div>
        {margin !== null && (
          <div className="form-group flex flex-col justify-end pb-1">
            <span className="text-xs text-slate-500 dark:text-gray-400">Est. Profit</span>
            <span className={`font-bold text-sm ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {form.currency} {profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              <span className="ml-1 text-xs font-normal opacity-70">({margin.toFixed(1)}%)</span>
            </span>
          </div>
        )}

        <div className="form-group col-span-3">
          <label className="label">Due Date *</label>
          <input className="input" type="date" required value={form.dueDate}
            onChange={e => setForm({ ...form, dueDate: e.target.value })} />
        </div>
      </div>

      {/* ── Payment status (edit only) ── */}
      {isEdit && (
        <div className="form-group">
          <label className="label">Payment Status</label>
          <select className="select" value={form.paymentStatus}
            onChange={e => setForm({ ...form, paymentStatus: e.target.value })}>
            <option value="">— No change —</option>
            {PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      )}

      {/* ── Shipment Info ── */}
      <div className="border-t border-slate-200 dark:border-navy-700 pt-4">
        <p className="text-xs text-slate-500 dark:text-gray-500 uppercase tracking-wider mb-3 font-medium">
          Shipment Info (shown on invoice PDF)
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label">B/L # <span className="text-slate-400 dark:text-gray-500 font-normal">(Bill of Lading)</span></label>
            <input className="input" placeholder="e.g. EFS2603153" value={form.blNumber}
              onChange={e => setForm({ ...form, blNumber: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Client VAT</label>
            <input className="input" placeholder="e.g. IT06984900727" value={form.clientVat}
              onChange={e => setForm({ ...form, clientVat: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Vessel</label>
            <input className="input" placeholder="e.g. JUDITH BORCHARD" value={form.vessel}
              onChange={e => setForm({ ...form, vessel: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Shipping Line</label>
            <input className="input" placeholder="e.g. EFS, MSC, Maersk" value={form.shippingLine}
              onChange={e => setForm({ ...form, shippingLine: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">POL <span className="text-slate-400 font-normal">(Port of Loading)</span></label>
            <input className="input" placeholder="e.g. ALEXANDRIA" value={form.pol}
              onChange={e => setForm({ ...form, pol: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">POD <span className="text-slate-400 font-normal">(Port of Discharge)</span></label>
            <input className="input" placeholder="e.g. BARCELONA" value={form.pod}
              onChange={e => setForm({ ...form, pod: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Container Qty</label>
            <input className="input" type="number" min="1" placeholder="e.g. 2"
              value={form.containerQty}
              onChange={e => setForm({ ...form, containerQty: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Container Type</label>
            <select className="select" value={form.containerType}
              onChange={e => setForm({ ...form, containerType: e.target.value })}>
              <option value="">— Select —</option>
              {['20 DRY','40 DRY','40 HC','20 RF','40 RF','LCL','Air'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Cargo Type <span className="text-slate-400 font-normal">(optional)</span></label>
            <input className="input" placeholder="e.g. General Cargo, Hazardous, Perishable…"
              value={form.cargoType}
              onChange={e => setForm({ ...form, cargoType: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Shipment Type <span className="text-slate-400 font-normal">(shown on PDF)</span></label>
            <select className="select" value={form.shipmentType}
              onChange={e => setForm({ ...form, shipmentType: e.target.value })}>
              <option value="">— Select —</option>
              {['Export','Import','Domestic','Transit','Cross Trade'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Bank Account ── */}
      <div className="form-group">
        <label className="label">
          Bank Account
          <span className="text-slate-400 dark:text-gray-500 font-normal"> (shown on PDF)</span>
        </label>
        {bankAccounts.length > 0 ? (
          <select className="select" value={form.bankAccountId}
            onChange={e => setForm({ ...form, bankAccountId: e.target.value })}>
            <option value="">— Select a bank account —</option>
            {bankAccounts.map(ba => (
              <option key={ba.id} value={ba.id}>
                {ba.account_name}  ·  {ba.currency}{ba.bank_name ? `  ·  ${ba.bank_name}` : ''}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-dashed border-slate-200 dark:border-navy-700">
            <BuildingLibraryIcon className="w-4 h-4 text-slate-400 dark:text-gray-500 flex-shrink-0" />
            <span className="text-sm text-slate-500 dark:text-gray-400">No bank accounts configured.</span>
            <button type="button" onClick={onGoToBankAccounts}
              className="ml-auto text-xs text-gold-600 dark:text-gold-400 hover:text-gold-500 font-medium flex-shrink-0 transition-colors">
              Add one →
            </button>
          </div>
        )}
      </div>

      {/* ── Notes ── */}
      <div className="form-group">
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })} />
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Invoice')}
        </button>
      </div>
    </form>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function InvoicesPage() {
  const navigate = useNavigate();
  const [invoices,      setInvoices]      = useState([]);
  const [statusFilter,  setStatusFilter]  = useState('');
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [editInvoice,   setEditInvoice]   = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/invoices', { params: { paymentStatus: statusFilter || undefined } });
      setInvoices(res.data.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const markPaid = async (id) => {
    try { await api.put(`/invoices/${id}`, { paymentStatus: 'Paid' }); load(); } catch (_) {}
  };

  const downloadPdf = async (inv) => {
    try {
      const res = await api.get(`/invoices/${inv.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href     = url;
      a.download = `invoice-${inv.custom_invoice_no || inv.invoice_no}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (_) { toast.error('Failed to download PDF'); }
  };

  const [pdfPreview, setPdfPreview] = useState(null); // { url, name }

  const previewPdf = async (inv) => {
    try {
      const res = await api.get(`/invoices/${inv.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      setPdfPreview({ url, name: `invoice-${inv.custom_invoice_no || inv.invoice_no}.pdf` });
    } catch (_) { toast.error('Failed to load PDF'); }
  };

  const closePdfPreview = () => {
    if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url);
    setPdfPreview(null);
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/invoices/${deleteTarget.id}`);
      toast.success('Invoice deleted');
      setDeleteTarget(null);
      load();
    } catch (_) { toast.error('Error deleting invoice'); }
  };

  // Group a status's invoice amounts per currency (USD/EUR/EGP can't be summed)
  const totalByStatus = (status) => {
    const map = {};
    invoices.filter(i => i.payment_status === status).forEach(i => {
      const c = i.currency || 'USD';
      map[c] = (map[c] || 0) + parseFloat(i.amount || 0);
    });
    const entries = Object.entries(map).filter(([, v]) => v > 0);
    if (!entries.length) return '0.00';
    return entries.map(([c, v]) => `${c} ${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`).join(' · ');
  };

  const hasCostData = invoices.some(i => parseFloat(i.buying_total || 0) > 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Invoices</h2>
          <div className="flex gap-4 mt-1 text-xs text-slate-500 dark:text-gray-400">
            <span>Pending: <span className="text-yellow-600 dark:text-yellow-400 font-medium">{totalByStatus('Pending')}</span></span>
            <span>Overdue: <span className="text-red-500 dark:text-red-400 font-medium">{totalByStatus('Overdue')}</span></span>
            <span>Paid: <span className="text-green-600 dark:text-green-400 font-medium">{totalByStatus('Paid')}</span></span>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <PlusIcon className="w-4 h-4 inline mr-1.5" />New Invoice
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-5">
        {['', ...PAYMENT_STATUSES].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${statusFilter === s
              ? 'bg-gold-500 text-navy-950 font-medium'
              : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : invoices.length === 0 ? (
        <div className="empty-state">
          <CurrencyDollarIcon className="w-12 h-12 text-slate-300 dark:text-navy-700 mb-3" />
          <p className="text-slate-900 dark:text-white font-medium">No invoices yet</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Description</th>
                <th className="text-right">Selling</th>
                {hasCostData && <th className="text-right">Cost</th>}
                {hasCostData && <th className="text-right">Profit</th>}
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const selling = parseFloat(inv.amount     || 0);
                const buying  = parseFloat(inv.buying_total || 0);
                const profit  = selling - buying;
                const hasCost = buying > 0;
                const isLinked = !!inv.quotation_id;
                return (
                  <tr key={inv.id}>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-gold-400 text-sm">{inv.custom_invoice_no || inv.invoice_no}</span>
                        {inv.custom_invoice_no && <div className="text-[10px] text-slate-400 dark:text-gray-500">{inv.invoice_no}</div>}
                        {isLinked && (
                          <span title="Linked to quotation"
                            className="text-[10px] px-1 py-0.5 rounded bg-gold-500/10 text-gold-500 font-medium leading-none">
                            Q
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-slate-900 dark:text-white font-medium">{inv.client_name}</td>
                    <td className="text-slate-700 dark:text-gray-300 text-sm max-w-xs truncate">{inv.description}</td>
                    <td className="text-right font-semibold text-slate-900 dark:text-white text-sm">
                      {inv.currency} {selling.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    {hasCostData && (
                      <td className="text-right text-sm">
                        {hasCost
                          ? <span className="text-orange-400">{inv.currency} {buying.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          : <span className="text-slate-400 dark:text-gray-600 text-xs">—</span>}
                      </td>
                    )}
                    {hasCostData && (
                      <td className="text-right text-sm">
                        {hasCost
                          ? <span className={`font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {inv.currency} {profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          : <span className="text-slate-400 dark:text-gray-600">—</span>}
                      </td>
                    )}
                    <td className={`text-sm ${inv.payment_status === 'Overdue' ? 'text-red-500 dark:text-red-400' : 'text-slate-600 dark:text-gray-300'}`}>
                      {new Date(inv.due_date).toLocaleDateString()}
                    </td>
                    <td><Badge label={inv.payment_status} type="status" /></td>
                    <td>
                      <div className="flex items-center gap-1">
                        {inv.payment_status !== 'Paid' && (
                          <button className="btn-primary text-xs px-2 py-1" onClick={() => markPaid(inv.id)}>
                            Mark Paid
                          </button>
                        )}
                        {inv.paid_at && (
                          <span className="text-green-400 text-xs mr-1">
                            {new Date(inv.paid_at).toLocaleDateString()}
                          </span>
                        )}
                        <button
                          className="p-1.5 rounded-lg text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
                          title="Preview invoice PDF"
                          aria-label={`Preview PDF for invoice ${inv.invoice_no}`}
                          onClick={() => previewPdf(inv)}>
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 rounded-lg text-slate-400 hover:text-gold-400 hover:bg-gold-500/10 transition-colors"
                          title="Download invoice PDF"
                          aria-label={`Download PDF for invoice ${inv.invoice_no}`}
                          onClick={() => downloadPdf(inv)}>
                          <DocumentArrowDownIcon className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                          title="Edit invoice"
                          aria-label={`Edit invoice ${inv.invoice_no}`}
                          onClick={() => setEditInvoice(inv)}>
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete invoice"
                          aria-label={`Delete invoice ${inv.invoice_no}`}
                          onClick={() => setDeleteTarget(inv)}>
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="New Invoice" size="xl">
        <InvoiceForm
          onSave={() => { setShowForm(false); load(); }}
          onClose={() => setShowForm(false)}
          onGoToBankAccounts={() => { setShowForm(false); navigate('/bank-accounts'); }}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editInvoice} onClose={() => setEditInvoice(null)} title="Edit Invoice" size="xl">
        {editInvoice && (
          <InvoiceForm
            invoice={editInvoice}
            onSave={() => { setEditInvoice(null); load(); }}
            onClose={() => setEditInvoice(null)}
            onGoToBankAccounts={() => { setEditInvoice(null); navigate('/bank-accounts'); }}
          />
        )}
      </Modal>

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="text-slate-900 dark:text-white font-semibold text-lg mb-2">Delete Invoice</h3>
            <p className="text-slate-600 dark:text-gray-400 text-sm mb-5">
              Delete <span className="text-gold-400 font-mono">{deleteTarget.invoice_no}</span>?
              This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn-primary bg-red-600 hover:bg-red-700 border-red-600" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* PDF Preview Modal */}
      {pdfPreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
            <span className="text-sm font-medium text-slate-900 dark:text-white">{pdfPreview.name}</span>
            <div className="flex items-center gap-2">
              <a
                href={pdfPreview.url}
                download={pdfPreview.name}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gold-500 hover:bg-gold-600 text-navy-950 rounded-lg transition-colors"
              >
                <DocumentArrowDownIcon className="w-4 h-4" />
                Download
              </a>
              <button onClick={closePdfPreview} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          <iframe src={pdfPreview.url} className="flex-1 w-full" title="Invoice PDF Preview" />
        </div>
      )}
    </div>
  );
}
