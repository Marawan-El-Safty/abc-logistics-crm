import React, { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../store/AuthContext';

export const INDUSTRIES    = ['Freight Forwarder', 'Exporter', 'Importer', 'Manufacturer', 'Logistics Agent', 'Trading', 'Shipping Lines', 'Other'];
export const CONTACT_TYPES = ['Client', 'Freight Forwarder', 'Carrier', 'Supplier', 'Trader'];

const TYPE_LABEL = {
  Client: 'Client', 'Freight Forwarder': 'Freight Forwarder',
  Carrier: 'Carrier', Supplier: 'Supplier', Trader: 'Trader', '': 'Contact',
};

export default function ContactForm({ initial, onSave, onClose, users = [], defaultType }) {
  const [form, setForm] = useState(initial || {
    companyName: '', contactType: defaultType || 'Client', industry: 'Other',
    country: '', address: '', website: '', email: '', phone: '', notes: '', assignedTo: '', productType: '',
  });
  const [loading, setLoading] = useState(false);
  const { canManage } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (initial?.id) {
        await api.put(`/clients/${initial.id}`, form);
      } else {
        await api.post('/clients', form);
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error saving contact');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-4">
        <div className="form-group">
          <label className="label">Contact Type *</label>
          <select className="select" value={form.contactType} onChange={e => setForm({...form, contactType: e.target.value})}>
            {CONTACT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="label">Company Name *</label>
          <input className="input" required value={form.companyName} onChange={e => setForm({...form, companyName: e.target.value.toUpperCase()})} />
        </div>
        <div className="form-group">
          <label className="label">Industry</label>
          <select className="select" value={form.industry} onChange={e => setForm({...form, industry: e.target.value})}>
            {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="label">Country</label>
          <input className="input" value={form.country} onChange={e => setForm({...form, country: e.target.value.toUpperCase()})} />
        </div>
        <div className="col-span-2 form-group">
          <label className="label">Address</label>
          <input className="input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="label">Phone</label>
          <input className="input" type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="label">Website</label>
          <input className="input" type="text" placeholder="www.example.com" value={form.website} onChange={e => setForm({...form, website: e.target.value})} />
        </div>
        {form.contactType === 'Supplier' && (
          <div className="form-group col-span-2">
            <label className="label">Product Type <span className="text-xs text-slate-400 dark:text-gray-400 font-normal">— what they supply</span></label>
            <input className="input" placeholder="e.g. Limestone, Steel, Chemicals..." value={form.productType} onChange={e => setForm({...form, productType: e.target.value})} />
          </div>
        )}
        {canManage && (
          <div className="form-group">
            <label className="label">Assigned To</label>
            <select className="select" value={form.assignedTo} onChange={e => setForm({...form, assignedTo: e.target.value})}>
              <option value="">Select rep...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
        )}
        <div className="col-span-2 form-group">
          <label className="label">Notes</label>
          <textarea className="input" rows={3} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : (initial?.id ? 'Update Contact' : `Add ${TYPE_LABEL[form.contactType] || 'Contact'}`)}
        </button>
      </div>
    </form>
  );
}
