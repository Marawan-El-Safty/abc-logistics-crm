import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { PlusIcon, MagnifyingGlassIcon, BuildingOfficeIcon, ArrowUpTrayIcon, TrashIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import Badge from '../components/common/Badge';
import { TableSkeleton } from '../components/common/Skeleton';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useAuth } from '../store/AuthContext';
import ContactForm, { INDUSTRIES, CONTACT_TYPES } from '../components/contacts/ContactForm';

const TYPE_TABS = [
  { label: 'All', value: '' },
  { label: 'Clients', value: 'Client' },
  { label: 'Freight Forwarders', value: 'Freight Forwarder' },
  { label: 'Carriers', value: 'Carrier' },
  { label: 'Suppliers', value: 'Supplier' },
  { label: 'Traders', value: 'Trader' },
];

const TYPE_LABEL = {
  Client: 'Client',
  'Freight Forwarder': 'Freight Forwarder',
  Carrier: 'Carrier',
  Supplier: 'Supplier',
  Trader: 'Trader',
  '': 'Contact',
};


function CsvImportModal({ onClose, onDone }) {
  const fileRef = useRef();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!file) return toast.error('Please select a CSV file');
    const fd = new FormData();
    fd.append('file', file);
    setLoading(true);
    try {
      const res = await api.post('/clients/import-csv', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { imported, skipped } = res.data.data;
      toast.success(`${imported} contacts imported${skipped ? `, ${skipped} skipped` : ''}`);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    } finally { setLoading(false); }
  };

  return (
    <div>
      <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
        Upload a CSV file with columns: <code className="text-xs bg-slate-100 dark:bg-navy-800 px-1 rounded">company_name, contact_type, industry, country, address, website, notes</code>
      </p>
      <div
        className="border-2 border-dashed border-slate-300 dark:border-navy-600 rounded-xl p-8 text-center cursor-pointer hover:border-gold-500 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <ArrowUpTrayIcon className="w-8 h-8 mx-auto mb-2 text-slate-400 dark:text-gray-500" />
        {file ? (
          <p className="text-sm font-medium text-slate-900 dark:text-white">{file.name}</p>
        ) : (
          <p className="text-sm text-slate-500 dark:text-gray-400">Click to select a CSV file</p>
        )}
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => setFile(e.target.files[0] || null)} />
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={handleImport} disabled={loading || !file}>
          {loading ? 'Importing...' : 'Import'}
        </button>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();
  const { canManage, isAdmin } = useAuth();

  const handleDelete = async () => {
    try {
      await api.delete(`/clients/${deleteTarget.id}`);
      toast.success('Contact deleted');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error deleting contact'); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20, search, industry, country, contactType: activeTab };
      const res = await api.get('/clients', { params });
      setClients(res.data.data);
      setTotal(res.data.total);
    } catch (_) {}
    finally { setLoading(false); }
  }, [page, search, industry, country, activeTab]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);
  useEffect(() => {
    if (canManage) {
      api.get('/users').then(r => setUsers(r.data.data || [])).catch(() => {});
    }
  }, [canManage]);

  const handleTabChange = (val) => { setActiveTab(val); setPage(1); };
  const handleSave = () => { setShowForm(false); setEditClient(null); load(); };

  const addLabel = activeTab ? `Add ${TYPE_LABEL[activeTab]}` : 'Add Contact';

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Contacts</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm">{total} total {activeTab ? TYPE_LABEL[activeTab].toLowerCase() + 's' : 'contacts'}</p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <button className="btn-secondary" onClick={() => setShowImport(true)}>
              <ArrowUpTrayIcon className="w-4 h-4 inline mr-1.5" />Import CSV
            </button>
          )}
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <PlusIcon className="w-4 h-4 inline mr-1.5" />{addLabel}
          </button>
        </div>
      </div>

      {/* Type Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 dark:bg-navy-900 rounded-lg p-1 w-fit">
        {TYPE_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.value
                ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500" />
          <input
            className="input pl-9"
            placeholder="Search contacts..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="relative min-w-[160px]">
          <GlobeAltIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-gray-500 pointer-events-none" />
          <input
            className="input pl-9 w-full"
            placeholder="Filter by country..."
            value={country}
            onChange={e => { setCountry(e.target.value.toUpperCase()); setPage(1); }}
          />
          {country && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 transition-colors"
              onClick={() => { setCountry(''); setPage(1); }}
            >
              ✕
            </button>
          )}
        </div>
        <select className="select w-48" value={industry} onChange={e => { setIndustry(e.target.value); setPage(1); }}>
          <option value="">All Industries</option>
          {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : clients.length === 0 ? (
        <div className="empty-state">
          <BuildingOfficeIcon className="w-12 h-12 text-navy-700 mb-3" />
          <p className="text-slate-900 dark:text-white font-medium">No contacts found</p>
          <p className="text-slate-500 dark:text-gray-500 text-sm">Add your first contact to get started</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Type</th>
                <th>Industry</th>
                <th>Country</th>
                <th>Assigned To</th>
                <th>Activities</th>
                <th>Last Activity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id} className="cursor-pointer" onClick={() => navigate(`/clients/${c.id}`)}>
                  <td>
                    <div className="font-medium text-slate-900 dark:text-white">{c.company_name}</div>
                    {c.address && <div className="text-xs text-slate-400 dark:text-gray-500">{c.address}</div>}
                  </td>
                  <td>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      c.contact_type === 'Carrier'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : c.contact_type === 'Freight Forwarder'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                        : c.contact_type === 'Supplier'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : c.contact_type === 'Trader'
                        ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                        : 'bg-amber-100 dark:bg-gold-900/30 text-amber-700 dark:text-gold-400'
                    }`}>
                      {c.contact_type || 'Client'}
                    </span>
                  </td>
                  <td><Badge label={c.industry} /></td>
                  <td className="text-slate-600 dark:text-gray-300">{c.country || '—'}</td>
                  <td className="text-slate-600 dark:text-gray-300">{c.assigned_to_name || '—'}</td>
                  <td className="text-slate-600 dark:text-gray-300">{c.activity_count || 0}</td>
                  <td className="text-slate-400 dark:text-gray-500 text-xs">
                    {c.last_activity_at ? new Date(c.last_activity_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button className="btn-ghost text-xs" onClick={() => setEditClient(c)}>Edit</button>
                      {isAdmin && (
                        <button className="btn-ghost text-xs text-red-400 hover:text-red-500 p-1" onClick={() => setDeleteTarget(c)}>
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500 dark:text-gray-400">
          <span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</span>
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <button className="btn-secondary" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Import Contacts from CSV">
        <CsvImportModal onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); load(); }} />
      </Modal>
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={addLabel} size="lg">
        <ContactForm onSave={handleSave} onClose={() => setShowForm(false)} users={users} defaultType={activeTab || 'Client'} />
      </Modal>
      <Modal isOpen={!!editClient} onClose={() => setEditClient(null)} title="Edit Contact" size="lg">
        {editClient && (
          <ContactForm
            initial={{
              companyName: editClient.company_name,
              contactType: editClient.contact_type || 'Client',
              industry: editClient.industry,
              country: editClient.country,
              address: editClient.address,
              website: editClient.website,
              email: editClient.email || '',
              phone: editClient.phone || '',
              notes: editClient.notes,
              assignedTo: editClient.assigned_to,
              productType: editClient.product_type || '',
              id: editClient.id,
            }}
            onSave={handleSave}
            onClose={() => setEditClient(null)}
            users={users}
          />
        )}
      </Modal>
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Contact"
        message={`Delete "${deleteTarget?.company_name}"? This cannot be undone.`}
        danger
      />
    </div>
  );
}
