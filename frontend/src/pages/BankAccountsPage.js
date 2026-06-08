import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { PlusIcon, PencilIcon, TrashIcon, BuildingLibraryIcon } from '@heroicons/react/24/outline';
import Modal from '../components/common/Modal';
import { useAuth } from '../store/AuthContext';

const CURRENCIES = ['USD', 'EUR', 'EGP'];

const CURRENCY_BADGE = {
  USD: 'bg-green-500/15 text-green-400 border border-green-500/30',
  EUR: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  EGP: 'bg-gold-500/15 text-gold-400 border border-gold-500/30',
};

const emptyForm = () => ({
  accountName: '', accountNumber: '', currency: 'USD',
  iban: '', bankName: '', bankAddress: '', swiftCode: '', notes: '',
});

function BankAccountForm({ account, onSave, onClose }) {
  const isEdit = !!account;
  const [form, setForm] = useState(
    account ? {
      accountName:   account.account_name   || '',
      accountNumber: account.account_number || '',
      currency:      account.currency       || 'USD',
      iban:          account.iban           || '',
      bankName:      account.bank_name      || '',
      bankAddress:   account.bank_address   || '',
      swiftCode:     account.swift_code     || '',
      notes:         account.notes          || '',
    } : emptyForm()
  );
  const [loading, setLoading] = useState(false);
  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/bank-accounts/${account.id}`, form);
        toast.success('Bank account updated');
      } else {
        await api.post('/bank-accounts', form);
        toast.success('Bank account created');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error saving bank account');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="form-group col-span-2">
          <label className="label">Account Name *</label>
          <input className="input" required value={form.accountName}
            placeholder="e.g. EL ABC Logistics."
            onChange={e => set('accountName', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="label">Account Number</label>
          <input className="input" value={form.accountNumber}
            placeholder="e.g. 1033338610010301"
            onChange={e => set('accountNumber', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="label">Currency *</label>
          <select className="select" value={form.currency} onChange={e => set('currency', e.target.value)}>
            {CURRENCIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group col-span-2">
          <label className="label">IBAN</label>
          <input className="input" value={form.iban}
            placeholder="e.g. EG550057000201033338610010301"
            onChange={e => set('iban', e.target.value)} />
        </div>
        <div className="form-group col-span-2">
          <label className="label">Bank Name</label>
          <input className="input" value={form.bankName}
            placeholder="e.g. ARAB AFRICAN INTERNATIONAL BANK"
            onChange={e => set('bankName', e.target.value)} />
        </div>
        <div className="form-group col-span-2">
          <label className="label">Bank Address</label>
          <input className="input" value={form.bankAddress}
            placeholder="e.g. HORREYA ROAD BRANCH - ALEXANDRIA - EGYPT"
            onChange={e => set('bankAddress', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="label">SWIFT Code</label>
          <input className="input" value={form.swiftCode}
            placeholder="e.g. ARAIEGCX"
            onChange={e => set('swiftCode', e.target.value.toUpperCase())} />
        </div>
        <div className="form-group">
          <label className="label">Notes <span className="text-gray-500 font-normal">(internal)</span></label>
          <input className="input" value={form.notes}
            placeholder="Optional internal note"
            onChange={e => set('notes', e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Account')}
        </button>
      </div>
    </form>
  );
}

export default function BankAccountsPage() {
  const { isAdmin } = useAuth();
  const [accounts, setAccounts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editAccount, setEdit]    = useState(null);
  const [deleteTarget, setDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/bank-accounts');
      setAccounts(res.data.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    try {
      await api.delete(`/bank-accounts/${deleteTarget.id}`);
      toast.success('Bank account deleted');
      setDelete(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error deleting bank account');
      setDelete(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Bank Accounts</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
            Manage company bank accounts shown on invoice PDFs
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <PlusIcon className="w-4 h-4 inline mr-1.5" />Add Account
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500 dark:text-gray-500">Loading...</div>
      ) : accounts.length === 0 ? (
        <div className="empty-state">
          <BuildingLibraryIcon className="w-12 h-12 text-slate-300 dark:text-navy-700 mb-3" />
          <p className="text-slate-900 dark:text-white font-medium">No bank accounts yet</p>
          <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">Add a bank account to use on invoice PDFs</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map(acc => (
            <div key={acc.id} className="card flex flex-col gap-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-gold-500/15 flex items-center justify-center flex-shrink-0">
                    <BuildingLibraryIcon className="w-5 h-5 text-gold-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {acc.account_name}
                    </div>
                    {acc.bank_name && (
                      <div className="text-xs text-slate-500 dark:text-gray-400 truncate">{acc.bank_name}</div>
                    )}
                  </div>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${CURRENCY_BADGE[acc.currency] || 'bg-slate-100 dark:bg-navy-700 text-slate-500'}`}>
                  {acc.currency}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-1 text-xs">
                {acc.account_number && (
                  <div className="flex gap-2">
                    <span className="text-slate-400 w-20 flex-shrink-0">Account No.</span>
                    <span className="font-mono text-slate-700 dark:text-gray-300">{acc.account_number}</span>
                  </div>
                )}
                {acc.iban && (
                  <div className="flex gap-2">
                    <span className="text-slate-400 w-20 flex-shrink-0">IBAN</span>
                    <span className="font-mono text-slate-700 dark:text-gray-300 break-all">{acc.iban}</span>
                  </div>
                )}
                {acc.swift_code && (
                  <div className="flex gap-2">
                    <span className="text-slate-400 w-20 flex-shrink-0">SWIFT</span>
                    <span className="font-mono text-slate-700 dark:text-gray-300">{acc.swift_code}</span>
                  </div>
                )}
                {acc.bank_address && (
                  <div className="flex gap-2">
                    <span className="text-slate-400 w-20 flex-shrink-0">Address</span>
                    <span className="text-slate-600 dark:text-gray-400">{acc.bank_address}</span>
                  </div>
                )}
                {acc.notes && (
                  <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-navy-700">
                    <span className="text-slate-400 w-20 flex-shrink-0">Notes</span>
                    <span className="text-slate-500 dark:text-gray-500 italic">{acc.notes}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-navy-700 mt-auto">
                <button
                  onClick={() => setEdit(acc)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg
                    text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                >
                  <PencilIcon className="w-3.5 h-3.5" /> Edit
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setDelete(acc)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg
                      text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <TrashIcon className="w-3.5 h-3.5" /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Add Bank Account" size="md">
        <BankAccountForm onSave={() => { setShowForm(false); load(); }} onClose={() => setShowForm(false)} />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editAccount} onClose={() => setEdit(null)} title="Edit Bank Account" size="md">
        {editAccount && (
          <BankAccountForm
            account={editAccount}
            onSave={() => { setEdit(null); load(); }}
            onClose={() => setEdit(null)}
          />
        )}
      </Modal>

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="text-slate-900 dark:text-white font-semibold text-lg mb-2">Delete Bank Account</h3>
            <p className="text-slate-500 dark:text-gray-400 text-sm mb-5">
              Delete <span className="text-gold-400 font-medium">{deleteTarget.account_name}</span>?
              This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setDelete(null)}>Cancel</button>
              <button className="btn-primary bg-red-600 hover:bg-red-700 border-red-600" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
