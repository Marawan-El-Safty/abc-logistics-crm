import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import {
  ArrowLeftIcon, PlusIcon, PhoneIcon, EnvelopeIcon, UserIcon,
  DocumentTextIcon, BuildingOfficeIcon, ClipboardDocumentListIcon,
  DocumentArrowUpIcon, TrashIcon, ArrowDownTrayIcon, PaperClipIcon, PencilIcon
} from '@heroicons/react/24/outline';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import ActivityForm from '../components/activities/ActivityForm';
import ContactForm from '../components/contacts/ContactForm';
import { useAuth } from '../store/AuthContext';

const ACTIVITY_TYPES = ['Call', 'Meeting', 'Email', 'Site Visit', 'WhatsApp', 'Note'];

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canManage } = useAuth();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [editActivity, setEditActivity] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [users, setUsers] = useState([]);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ fullName: '', title: '', phone: '', email: '', whatsapp: '', isPrimary: false });
  const [editSubContact, setEditSubContact] = useState(null);
  const [deleteSubContact, setDeleteSubContact] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [showContractForm, setShowContractForm] = useState(false);
  const [contractForm, setContractForm] = useState({ title: '', startDate: '', endDate: '', notes: '' });
  const [contractFile, setContractFile] = useState(null);
  const [contractUploading, setContractUploading] = useState(false);
  const fileInputRef = useRef(null);

  const load = async () => {
    try {
      const res = await api.get(`/clients/${id}`);
      setClient(res.data.data);
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (canManage) api.get('/users').then(r => setUsers(r.data.data || [])).catch(() => {});
  }, [canManage]);

  const loadContracts = async () => {
    try {
      const res = await api.get(`/clients/${id}/contracts`);
      setContracts(res.data.data || []);
    } catch (_) {}
  };

  useEffect(() => { if (activeTab === 'contracts') loadContracts(); }, [activeTab, id]);

  const uploadContract = async (e) => {
    e.preventDefault();
    if (!contractFile) return toast.error('Please select a file');
    setContractUploading(true);
    const fd = new FormData();
    fd.append('file', contractFile);
    fd.append('title', contractForm.title);
    if (contractForm.startDate) fd.append('startDate', contractForm.startDate);
    if (contractForm.endDate) fd.append('endDate', contractForm.endDate);
    if (contractForm.notes) fd.append('notes', contractForm.notes);
    try {
      await api.post(`/clients/${id}/contracts`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Contract uploaded');
      setShowContractForm(false);
      setContractForm({ title: '', startDate: '', endDate: '', notes: '' });
      setContractFile(null);
      loadContracts();
    } catch (err) { toast.error(err.response?.data?.error || 'Upload failed'); }
    finally { setContractUploading(false); }
  };

  const deleteContract = async (contractId) => {
    try {
      await api.delete(`/clients/${id}/contracts/${contractId}`);
      toast.success('Contract deleted');
      loadContracts();
    } catch { toast.error('Delete failed'); }
  };

  const deleteActivity = async (activityId) => {
    if (!window.confirm('Delete this activity? This cannot be undone.')) return;
    try {
      await api.delete(`/activities/${activityId}`);
      toast.success('Activity deleted');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Delete failed'); }
  };

  const addContact = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/clients/${id}/contacts`, contactForm);
      setShowContactForm(false);
      setContactForm({ fullName: '', title: '', phone: '', email: '', whatsapp: '', isPrimary: false });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error adding contact');
    }
  };

  const updateSubContact = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/clients/${id}/contacts/${editSubContact.id}`, {
        fullName:  editSubContact.full_name,
        title:     editSubContact.title,
        phone:     editSubContact.phone,
        email:     editSubContact.email,
        whatsapp:  editSubContact.whatsapp,
        isPrimary: editSubContact.isPrimary,
      });
      setEditSubContact(null);
      load();
      toast.success('Contact updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error updating contact');
    }
  };

  const deleteSubContactConfirmed = async () => {
    try {
      await api.delete(`/clients/${id}/contacts/${deleteSubContact.id}`);
      setDeleteSubContact(null);
      load();
      toast.success('Contact deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error deleting contact');
    }
  };

  if (loading) return <div className="text-center py-16 text-slate-500 dark:text-gray-500">Loading...</div>;
  if (!client) return <div className="text-center py-16 text-slate-500 dark:text-gray-500">Client not found</div>;

  const TABS = ['overview', 'contacts', 'activities', 'quotations', 'contracts'];

  return (
    <div>
      {/* Back + Header */}
      <div className="flex items-start gap-4 mb-6">
        <button onClick={() => navigate('/clients')} className="btn-ghost mt-0.5">
          <ArrowLeftIcon className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{client.company_name}</h2>
            <Badge label={client.industry} />
            {!client.is_active && <Badge label="Inactive" />}
          </div>
          <div className="flex items-center gap-4 mt-1 text-slate-500 dark:text-gray-400 text-sm flex-wrap">
            {client.country && <span><BuildingOfficeIcon className="w-3.5 h-3.5 inline mr-1" />{client.country}</span>}
            {client.assigned_to_name && <span>Assigned: {client.assigned_to_name}</span>}
          </div>
        </div>
        <button className="btn-ghost" onClick={() => setShowEditForm(true)} title="Edit contact">
          <PencilIcon className="w-4 h-4 inline mr-1.5" />Edit
        </button>
        <button className="btn-primary" onClick={() => { setEditActivity(null); setShowActivityForm(true); }}>
          <PlusIcon className="w-4 h-4 inline mr-1.5" />Log Activity
        </button>
        <button className="btn-secondary" onClick={() => navigate(`/quotations/new?clientId=${id}`)}>
          <DocumentTextIcon className="w-4 h-4 inline mr-1.5" />Request Quotation
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-navy-900 p-1 rounded-lg mb-6 w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded text-sm font-medium capitalize transition-all ${activeTab === tab ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="card">
            <h3 className="section-title">Company Info</h3>
            <div className="space-y-3 text-sm">
              {client.address && (
                <div>
                  <span className="text-slate-500 dark:text-gray-500">Address:</span>
                  <span className="text-slate-800 dark:text-gray-200 ml-2">{client.address}</span>
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-2">
                  <EnvelopeIcon className="w-3.5 h-3.5 text-slate-400 dark:text-gray-500 flex-shrink-0" />
                  <a href={`mailto:${client.email}`} className="link">{client.email}</a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2">
                  <PhoneIcon className="w-3.5 h-3.5 text-slate-400 dark:text-gray-500 flex-shrink-0" />
                  <a href={`tel:${client.phone}`} className="text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white">{client.phone}</a>
                </div>
              )}
              {client.website && (
                <div>
                  <span className="text-slate-500 dark:text-gray-500">Website:</span>
                  <a href={client.website} target="_blank" rel="noreferrer" className="link ml-2">{client.website}</a>
                </div>
              )}
              {client.contact_type === 'Supplier' && client.product_type && (
                <div>
                  <span className="text-slate-500 dark:text-gray-500">Product Type:</span>
                  <span className="text-slate-800 dark:text-gray-200 ml-2">{client.product_type}</span>
                </div>
              )}
              {client.notes && (
                <div>
                  <span className="label">Notes</span>
                  <p className="text-slate-700 dark:text-gray-300">{client.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Primary Contact</h3>
            {client.contacts?.filter(c => c.is_primary)[0] ? (
              <div className="space-y-2 text-sm">
                {(() => {
                  const pc = client.contacts.find(c => c.is_primary);
                  return (
                    <>
                      <div className="font-medium text-slate-900 dark:text-white">{pc.full_name}</div>
                      {pc.title && <div className="text-slate-500 dark:text-gray-400">{pc.title}</div>}
                      {pc.phone && <div className="flex items-center gap-2 text-slate-700 dark:text-gray-300"><PhoneIcon className="w-3.5 h-3.5" />{pc.phone}</div>}
                      {pc.email && <div className="flex items-center gap-2 text-slate-700 dark:text-gray-300"><EnvelopeIcon className="w-3.5 h-3.5" />{pc.email}</div>}
                    </>
                  );
                })()}
              </div>
            ) : <p className="text-slate-500 dark:text-gray-500 text-sm">No contacts added</p>}
          </div>

          <div className="card">
            <h3 className="section-title">Quick Stats</h3>
            <div className="space-y-3">
              {[
                { label: 'Total Activities', value: client.recentActivities?.length || 0 },
                { label: 'Quotations', value: client.quotations?.length || 0 },
                { label: 'Contacts', value: client.contacts?.length || 0 },
                { label: 'Branches', value: client.branches?.length || 0 },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-gray-400">{label}</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'contacts' && (
        <div>
          <div className="flex justify-between mb-4">
            <h3 className="section-title">Contacts ({client.contacts?.length || 0})</h3>
            <button className="btn-primary text-xs" onClick={() => setShowContactForm(true)}>
              <PlusIcon className="w-3.5 h-3.5 inline mr-1" />Add Contact
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {client.contacts?.map(c => (
              <div key={c.id} className="card">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center text-slate-700 dark:text-white font-bold flex-shrink-0">
                    {c.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                      {c.full_name}
                      {c.is_primary && <span className="badge-gold text-xs">Primary</span>}
                    </div>
                    {c.title && <div className="text-slate-500 dark:text-gray-400 text-sm">{c.title}</div>}
                    {c.phone && <div className="text-slate-700 dark:text-gray-300 text-sm flex items-center gap-1 mt-1"><PhoneIcon className="w-3.5 h-3.5" />{c.phone}</div>}
                    {c.email && <div className="text-slate-700 dark:text-gray-300 text-sm flex items-center gap-1"><EnvelopeIcon className="w-3.5 h-3.5" />{c.email}</div>}
                    {c.whatsapp && <div className="text-green-600 dark:text-green-400 text-sm">WhatsApp: {c.whatsapp}</div>}
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-navy-700">
                  <button
                    className="flex-1 btn-ghost text-xs py-1 flex items-center justify-center gap-1"
                    onClick={() => setEditSubContact({ ...c, isPrimary: c.is_primary })}
                  >
                    <PencilIcon className="w-3.5 h-3.5" />Edit
                  </button>
                  <button
                    className="flex-1 btn-ghost text-xs py-1 flex items-center justify-center gap-1 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => setDeleteSubContact(c)}
                  >
                    <TrashIcon className="w-3.5 h-3.5" />Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'activities' && (
        <div>
          <div className="flex justify-between mb-4">
            <h3 className="section-title">Activity History</h3>
            <button className="btn-primary text-xs" onClick={() => { setEditActivity(null); setShowActivityForm(true); }}>
              <PlusIcon className="w-3.5 h-3.5 inline mr-1" />Log Activity
            </button>
          </div>
          {client.recentActivities?.length > 0 ? (
            <div className="space-y-3">
              {client.recentActivities.map(act => (
                <div key={act.id} className="card flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gold-500/15 flex items-center justify-center text-gold-500 dark:text-gold-400 flex-shrink-0">
                    <ClipboardDocumentListIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge label={act.activity_type} />
                      <span className="text-slate-500 dark:text-gray-400 text-sm">by {act.performed_by_name}</span>
                      <span className="text-slate-400 dark:text-gray-600 text-xs">{new Date(act.activity_date).toLocaleDateString()}</span>
                    </div>
                    {act.notes && <p className="text-slate-700 dark:text-gray-300 text-sm mt-1">{act.notes}</p>}
                    {act.outcome && <p className="text-slate-500 dark:text-gray-400 text-xs mt-1">Outcome: {act.outcome}</p>}
                    {act.next_follow_up && (
                      <p className="text-gold-600 dark:text-gold-400 text-xs mt-1">
                        Follow-up: {new Date(act.next_follow_up).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-start gap-1 flex-shrink-0">
                    <button
                      title="Edit activity"
                      onClick={() => { setEditActivity(act); setShowActivityForm(true); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      title="Delete activity"
                      onClick={() => deleteActivity(act.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 dark:text-gray-500">No activities logged yet</div>
          )}
        </div>
      )}

      {activeTab === 'quotations' && (
        <div>
          <div className="flex justify-between mb-4">
            <h3 className="section-title">Quotations</h3>
            <button className="btn-primary text-xs" onClick={() => navigate(`/quotations/new?clientId=${id}`)}>
              <PlusIcon className="w-3.5 h-3.5 inline mr-1" />New Quotation
            </button>
          </div>
          {client.quotations?.length > 0 ? (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr><th>Reference</th><th>Service</th><th>Route</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {client.quotations.map(q => (
                    <tr key={q.id} className="cursor-pointer" onClick={() => navigate(`/quotations/${q.id}/edit`)}>
                      <td className="font-mono text-gold-600 dark:text-gold-400">{q.reference_no}</td>
                      <td className="text-slate-600 dark:text-gray-300 text-xs">{q.service_type}</td>
                      <td className="text-slate-500 dark:text-gray-400 text-xs">{q.origin} → {q.destination}</td>
                      <td className="font-semibold text-slate-900 dark:text-white">{q.currency} {parseFloat(q.total_amount || 0).toLocaleString()}</td>
                      <td><Badge label={q.status} type="status" /></td>
                      <td className="text-slate-500 dark:text-gray-500 text-xs">{new Date(q.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 dark:text-gray-500">No quotations yet</div>
          )}
        </div>
      )}

      {activeTab === 'contracts' && (
        <div>
          <div className="flex justify-between mb-4">
            <h3 className="section-title">Contracts & Documents ({contracts.length})</h3>
            <button className="btn-primary text-xs" onClick={() => setShowContractForm(true)}>
              <DocumentArrowUpIcon className="w-3.5 h-3.5 inline mr-1" />Upload Contract
            </button>
          </div>

          {showContractForm && (
            <form onSubmit={uploadContract} className="card mb-4 space-y-3">
              <h4 className="font-medium text-slate-900 dark:text-white text-sm">New Contract</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 form-group">
                  <label className="label">Title *</label>
                  <input className="input" required value={contractForm.title} onChange={e => setContractForm({...contractForm, title: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="label">Start Date</label>
                  <input className="input" type="date" value={contractForm.startDate} onChange={e => setContractForm({...contractForm, startDate: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="label">End Date</label>
                  <input className="input" type="date" value={contractForm.endDate} onChange={e => setContractForm({...contractForm, endDate: e.target.value})} />
                </div>
                <div className="col-span-2 form-group">
                  <label className="label">Notes</label>
                  <input className="input" value={contractForm.notes} onChange={e => setContractForm({...contractForm, notes: e.target.value})} />
                </div>
                <div className="col-span-2 form-group">
                  <label className="label">File * (PDF or DOCX)</label>
                  <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" className="input py-1.5 cursor-pointer"
                    onChange={e => setContractFile(e.target.files[0])} required />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" className="btn-secondary text-xs" onClick={() => setShowContractForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary text-xs" disabled={contractUploading}>
                  {contractUploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          )}

          {contracts.length === 0 ? (
            <div className="empty-state">
              <PaperClipIcon className="w-12 h-12 text-slate-300 dark:text-navy-700 mb-3" />
              <p className="text-slate-900 dark:text-white font-medium">No contracts uploaded</p>
            </div>
          ) : (
            <div className="space-y-2">
              {contracts.map(c => (
                <div key={c.id} className="card flex items-center gap-4">
                  <PaperClipIcon className="w-8 h-8 text-gold-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 dark:text-white text-sm">{c.title}</div>
                    <div className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                      {c.file_name} · {c.file_size ? `${(c.file_size / 1024).toFixed(0)} KB` : ''}
                      {c.start_date && ` · ${new Date(c.start_date).toLocaleDateString()}`}
                      {c.end_date && ` → ${new Date(c.end_date).toLocaleDateString()}`}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-gray-500">Uploaded by {c.uploaded_by_name} · {new Date(c.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <a href={`${process.env.REACT_APP_BACKEND_URL || ''}${c.file_url}`} target="_blank" rel="noreferrer"
                       className="btn-secondary text-xs px-2 py-1.5">
                      <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                    </a>
                    <button className="btn-danger text-xs px-2 py-1.5" onClick={() => deleteContract(c.id)}>
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Contact Modal */}
      <Modal isOpen={showEditForm} onClose={() => setShowEditForm(false)} title="Edit Contact" size="lg">
        {client && (
          <ContactForm
            initial={{
              id: client.id,
              companyName:  client.company_name,
              contactType:  client.contact_type  || 'Client',
              industry:     client.industry,
              country:      client.country       || '',
              address:      client.address       || '',
              website:      client.website       || '',
              email:        client.email         || '',
              phone:        client.phone         || '',
              notes:        client.notes         || '',
              assignedTo:   client.assigned_to   || '',
              productType:  client.product_type  || '',
            }}
            users={users}
            onSave={() => { setShowEditForm(false); load(); toast.success('Contact updated'); }}
            onClose={() => setShowEditForm(false)}
          />
        )}
      </Modal>

      {/* Activity Form Modal (create + edit) */}
      <Modal
        isOpen={showActivityForm}
        onClose={() => { setShowActivityForm(false); setEditActivity(null); }}
        title={editActivity ? 'Edit Activity' : 'Log Activity'}
        size="md"
      >
        <ActivityForm
          clientId={id}
          activity={editActivity}
          onSave={() => { setShowActivityForm(false); setEditActivity(null); load(); }}
          onClose={() => { setShowActivityForm(false); setEditActivity(null); }}
        />
      </Modal>

      {/* Add Contact Modal */}
      <Modal isOpen={showContactForm} onClose={() => setShowContactForm(false)} title="Add Contact" size="md">
        <form onSubmit={addContact}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 form-group">
              <label className="label">Full Name *</label>
              <input className="input" required value={contactForm.fullName} onChange={e => setContactForm({...contactForm, fullName: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="label">Title</label>
              <input className="input" value={contactForm.title} onChange={e => setContactForm({...contactForm, title: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="label">Phone</label>
              <input className="input" value={contactForm.phone} onChange={e => setContactForm({...contactForm, phone: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="label">Email</label>
              <input className="input" type="email" value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="label">WhatsApp</label>
              <input className="input" value={contactForm.whatsapp} onChange={e => setContactForm({...contactForm, whatsapp: e.target.value})} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="isPrimary" checked={contactForm.isPrimary} onChange={e => setContactForm({...contactForm, isPrimary: e.target.checked})} />
              <label htmlFor="isPrimary" className="text-slate-700 dark:text-gray-300 text-sm">Set as primary contact</label>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" className="btn-secondary" onClick={() => setShowContactForm(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Add Contact</button>
          </div>
        </form>
      </Modal>

      {/* Edit Sub-Contact Modal */}
      <Modal isOpen={!!editSubContact} onClose={() => setEditSubContact(null)} title="Edit Contact Person" size="md">
        {editSubContact && (
          <form onSubmit={updateSubContact}>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 form-group">
                <label className="label">Full Name *</label>
                <input className="input" required value={editSubContact.full_name || ''} onChange={e => setEditSubContact({...editSubContact, full_name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">Title</label>
                <input className="input" value={editSubContact.title || ''} onChange={e => setEditSubContact({...editSubContact, title: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">Phone</label>
                <input className="input" value={editSubContact.phone || ''} onChange={e => setEditSubContact({...editSubContact, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">Email</label>
                <input className="input" type="email" value={editSubContact.email || ''} onChange={e => setEditSubContact({...editSubContact, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="label">WhatsApp</label>
                <input className="input" value={editSubContact.whatsapp || ''} onChange={e => setEditSubContact({...editSubContact, whatsapp: e.target.value})} />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="editIsPrimary" checked={!!editSubContact.isPrimary} onChange={e => setEditSubContact({...editSubContact, isPrimary: e.target.checked})} />
                <label htmlFor="editIsPrimary" className="text-slate-700 dark:text-gray-300 text-sm">Set as primary contact</label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button type="button" className="btn-secondary" onClick={() => setEditSubContact(null)}>Cancel</button>
              <button type="submit" className="btn-primary">Save Changes</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Sub-Contact Confirm */}
      {deleteSubContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-navy-800 rounded-xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-navy-700">
            <h3 className="text-slate-900 dark:text-white font-semibold text-lg mb-2">Delete Contact</h3>
            <p className="text-slate-600 dark:text-gray-400 text-sm mb-5">
              Delete <span className="text-slate-900 dark:text-white font-medium">{deleteSubContact.full_name}</span>? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setDeleteSubContact(null)}>Cancel</button>
              <button className="btn-primary bg-red-600 hover:bg-red-700 border-red-600" onClick={deleteSubContactConfirmed}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
