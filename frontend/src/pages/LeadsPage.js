import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { PlusIcon, FunnelIcon, Squares2X2Icon, ListBulletIcon, ArrowUpTrayIcon, TrashIcon } from '@heroicons/react/24/outline';
import Badge from '../components/common/Badge';
import { TableSkeleton } from '../components/common/Skeleton';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useAuth } from '../store/AuthContext';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const STAGES = ['New Lead', 'Contacted', 'Proposal Sent', 'Negotiating', 'Won', 'Lost'];
const SHIPMENT_TYPES = ['Sea Freight FCL', 'Sea Freight LCL', 'Air Freight', 'Inland Trucking', 'Customs Clearance', 'Storage & Warehousing', 'Mixed'];
const SOURCES = ['Website Form', 'Manual Entry', 'Referral', 'Email', 'Phone', 'Other'];

function LeadForm({ onSave, onClose, users }) {
  const { user, canManage } = useAuth();
  const [form, setForm] = useState({
    contactName: '', companyName: '', email: '', phone: '',
    shipmentType: '', origin: '', destination: '', cargoDetails: '',
    weight: '', volume: '', notes: '', assignedTo: '', source: 'Manual Entry'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/leads', form);
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error creating lead');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-4">
        <div className="form-group">
          <label className="label">Contact Name *</label>
          <input className="input" required value={form.contactName} onChange={e => setForm({...form, contactName: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="label">Company Name</label>
          <input className="input" value={form.companyName} onChange={e => setForm({...form, companyName: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="label">Shipment Type</label>
          <select className="select" value={form.shipmentType} onChange={e => setForm({...form, shipmentType: e.target.value})}>
            <option value="">Select...</option>
            {SHIPMENT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="label">Source</label>
          <select className="select" value={form.source} onChange={e => setForm({...form, source: e.target.value})}>
            {SOURCES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="label">Origin</label>
          <input className="input" value={form.origin} onChange={e => setForm({...form, origin: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="label">Destination</label>
          <input className="input" value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="label">Weight (kg) <span className="text-xs text-slate-400 dark:text-gray-400 font-normal">— optional</span></label>
          <input className="input" type="number" min="0" placeholder="e.g. 1200" value={form.weight} onChange={e => setForm({...form, weight: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="label">Volume (CBM) <span className="text-xs text-slate-400 dark:text-gray-400 font-normal">— optional</span></label>
          <input className="input" type="number" min="0" placeholder="e.g. 4.5" value={form.volume} onChange={e => setForm({...form, volume: e.target.value})} />
        </div>
        {canManage && (
          <div className="form-group">
            <label className="label">Assign To</label>
            <select className="select" value={form.assignedTo} onChange={e => setForm({...form, assignedTo: e.target.value})}>
              <option value="">Select rep...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
        )}
        <div className="col-span-2 form-group">
          <label className="label">Cargo Details</label>
          <textarea className="input" rows={2} value={form.cargoDetails} onChange={e => setForm({...form, cargoDetails: e.target.value})} />
        </div>
        <div className="col-span-2 form-group">
          <label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create Lead'}</button>
      </div>
    </form>
  );
}

function KanbanCard({ lead, onClick, onDelete }) {
  return (
    <div
      className="card p-3 cursor-pointer hover:border-gold-500/40 transition-all text-sm"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="font-medium text-slate-900 dark:text-white mb-1 truncate">{lead.contact_name}</div>
        {onDelete && (
          <button className="text-red-400 hover:text-red-500 p-0.5 flex-shrink-0" onClick={e => { e.stopPropagation(); onDelete(lead); }}>
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {lead.company_name && <div className="text-slate-500 dark:text-gray-400 text-xs mb-2 truncate">{lead.company_name}</div>}
      {lead.shipment_type && <Badge label={lead.shipment_type} />}
      {lead.origin && lead.destination && (
        <div className="text-slate-500 dark:text-gray-500 text-xs mt-2 truncate">{lead.origin} → {lead.destination}</div>
      )}
      <div className="text-slate-400 dark:text-gray-600 text-xs mt-2">{lead.assigned_to_name || 'Unassigned'}</div>
    </div>
  );
}

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
      const res = await api.post('/leads/import-csv', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const { imported, skipped } = res.data.data;
      toast.success(`${imported} leads imported${skipped ? `, ${skipped} skipped` : ''}`);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    } finally { setLoading(false); }
  };

  return (
    <div>
      <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
        Upload a CSV file with columns: <code className="text-xs bg-slate-100 dark:bg-navy-800 px-1 rounded">contact_name, company_name, email, phone, shipment_type, origin, destination, notes</code>
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
          {loading ? 'Importing...' : 'Import Leads'}
        </button>
      </div>
    </div>
  );
}

const LIST_LIMIT = 25;

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [view, setView] = useState('kanban');
  const [stageFilter, setStageFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [users, setUsers] = useState([]);
  const { canManage, isAdmin } = useAuth();

  const handleDelete = async () => {
    try {
      await api.delete(`/leads/${deleteTarget.id}`);
      toast.success('Lead deleted');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error deleting lead'); }
  };
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = view === 'kanban'
        ? { limit: 200, stage: stageFilter || undefined }
        : { limit: LIST_LIMIT, page, stage: stageFilter || undefined };
      const res = await api.get('/leads', { params });
      setLeads(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (_) {}
    finally { setLoading(false); }
  }, [stageFilter, view, page]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);
  useEffect(() => {
    if (canManage) api.get('/users').then(r => setUsers(r.data.data || [])).catch(() => {});
  }, [canManage]);

  const [byStage, setByStage] = useState({});

  useEffect(() => {
    setByStage(STAGES.reduce((acc, s) => { acc[s] = leads.filter(l => l.stage === s); return acc; }, {}));
  }, [leads]);

  const onDragEnd = async ({ source, destination }) => {
    if (!destination || source.droppableId === destination.droppableId) return;
    const stage = destination.droppableId;
    const lead = byStage[source.droppableId][source.index];
    const newByStage = { ...byStage };
    newByStage[source.droppableId] = newByStage[source.droppableId].filter((_, i) => i !== source.index);
    newByStage[destination.droppableId] = [lead, ...newByStage[destination.droppableId]];
    setByStage(newByStage);
    try {
      const res = await api.patch(`/leads/${lead.id}/stage`, { stage });
      if (res.data.convertedClientId) {
        toast.success('Lead won! Converted to client.');
        navigate(`/clients/${res.data.convertedClientId}`);
      } else {
        toast.success(`Moved to ${stage}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update stage');
      load();
    }
  };

  const STAGE_COLORS_BG = {
    'New Lead': 'border-t-blue-500',
    'Contacted': 'border-t-yellow-500',
    'Proposal Sent': 'border-t-purple-500',
    'Negotiating': 'border-t-gold-500',
    'Won': 'border-t-green-500',
    'Lost': 'border-t-red-500',
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Leads Pipeline</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm">{leads.length} leads total</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-navy-800 rounded-lg p-1">
            <button onClick={() => setView('kanban')} className={`px-3 py-1.5 rounded text-sm transition-all ${view === 'kanban' ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-gray-400'}`}>
              <Squares2X2Icon className="w-4 h-4 inline mr-1" />Kanban
            </button>
            <button onClick={() => setView('list')} className={`px-3 py-1.5 rounded text-sm transition-all ${view === 'list' ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-gray-400'}`}>
              <ListBulletIcon className="w-4 h-4 inline mr-1" />List
            </button>
          </div>
          {canManage && (
            <button className="btn-secondary" onClick={() => setShowImport(true)}>
              <ArrowUpTrayIcon className="w-4 h-4 inline mr-1.5" />Import CSV
            </button>
          )}
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <PlusIcon className="w-4 h-4 inline mr-1.5" />Add Lead
          </button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : view === 'kanban' ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
            {STAGES.map(stage => (
              <div key={stage} className={`flex-shrink-0 w-64 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 border-t-2 rounded-xl p-3 ${STAGE_COLORS_BG[stage]}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{stage}</span>
                  <span className="badge-gray text-xs">{byStage[stage]?.length || 0}</span>
                </div>
                <Droppable droppableId={stage}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`space-y-2 min-h-[4rem] rounded-lg transition-colors ${snapshot.isDraggingOver ? 'bg-gold-500/10' : ''}`}
                    >
                      {byStage[stage]?.map((lead, index) => (
                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              className={`transition-shadow ${snap.isDragging ? 'shadow-2xl rotate-1 scale-105' : ''}`}
                            >
                              <KanbanCard lead={lead} onClick={() => navigate(`/leads/${lead.id}`)} onDelete={isAdmin ? setDeleteTarget : null} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {!byStage[stage]?.length && !snapshot.isDraggingOver && (
                        <div className="text-center py-6 text-slate-400 dark:text-gray-600 text-xs">No leads</div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Company</th>
                <th>Stage</th>
                <th>Shipment</th>
                <th>Route</th>
                <th>Source</th>
                <th>Assigned</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <tr key={l.id} className="cursor-pointer" onClick={() => navigate(`/leads/${l.id}`)}>
                  <td className="font-medium text-slate-900 dark:text-white">
                    <div>{l.contact_name}</div>
                    {l.email && <div className="text-xs text-slate-500 dark:text-gray-500">{l.email}</div>}
                  </td>
                  <td>{l.company_name || '—'}</td>
                  <td><Badge label={l.stage} type="stage" /></td>
                  <td className="text-xs">{l.shipment_type || '—'}</td>
                  <td className="text-xs">{l.origin && l.destination ? `${l.origin} → ${l.destination}` : '—'}</td>
                  <td><Badge label={l.source} /></td>
                  <td>{l.assigned_to_name || '—'}</td>
                  <td className="text-xs">{new Date(l.created_at).toLocaleDateString()}</td>
                  <td onClick={e => e.stopPropagation()}>
                    {isAdmin && (
                      <button className="btn-ghost text-xs text-red-400 hover:text-red-500 p-1" onClick={() => setDeleteTarget(l)}>
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'list' && total > LIST_LIMIT && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500 dark:text-gray-400">
          <span>Showing {(page - 1) * LIST_LIMIT + 1}–{Math.min(page * LIST_LIMIT, total)} of {total}</span>
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <button className="btn-secondary" disabled={page * LIST_LIMIT >= total} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="New Lead" size="lg">
        <LeadForm onSave={() => { setShowForm(false); load(); }} onClose={() => setShowForm(false)} users={users} />
      </Modal>

      <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Import Leads from CSV">
        <CsvImportModal onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); load(); }} />
      </Modal>
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Lead"
        message={`Delete lead for "${deleteTarget?.contact_name}"? This cannot be undone.`}
        danger
      />
    </div>
  );
}
