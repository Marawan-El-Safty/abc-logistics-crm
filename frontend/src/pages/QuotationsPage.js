import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { PlusIcon, DocumentArrowDownIcon, TrashIcon, XCircleIcon, ArrowUturnLeftIcon, PaperAirplaneIcon, EyeIcon, ClockIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Badge from '../components/common/Badge';
import { TableSkeleton } from '../components/common/Skeleton';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import { useAuth } from '../store/AuthContext';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

// Pending Review = rep→manager review; Confirmed = client accepted (→ Operations books)
const STATUSES = ['Draft', 'Pending Review', 'Approved', 'Sent', 'Confirmed', 'Rejected'];
const SERVICE_TYPES = ['Sea Freight FCL', 'Sea Freight LCL', 'Air Freight', 'Inland Trucking', 'Customs Clearance', 'Storage & Warehousing'];
const DIRECTIONS = ['Import', 'Export', 'Domestic'];

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState([]);
  const [status, setStatus] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [direction, setDirection] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnNotes, setReturnNotes] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewRef, setPreviewRef] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const navigate = useNavigate();
  const { canManage, isAdmin, isRep, isFinance } = useAuth();

  // Sales Reps and Finance may only download the PDF once a manager/admin has
  // approved the quotation. Operation, Sales Manager and Admin can download any time.
  const APPROVED_STATUSES = ['Approved', 'Sent', 'Confirmed'];
  const canDownloadPdf = (q) =>
    !(isRep || isFinance) || APPROVED_STATUSES.includes(q.status);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/quotations', { params: {
        status: status || undefined,
        serviceType: serviceType || undefined,
        direction: direction || undefined,
        limit: 50,
      } });
      setQuotations(res.data.data || []);
    } catch (_) {}
    finally { setLoading(false); }
  }, [status, serviceType, direction]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  const handleDelete = async () => {
    try {
      await api.delete(`/quotations/${deleteTarget.id}`);
      toast.success('Quotation deleted');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error deleting quotation'); }
  };

  const handleReject = async () => {
    try {
      await api.put(`/quotations/${rejectTarget.id}`, { status: 'Rejected' });
      toast.success('Quotation marked as rejected');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error rejecting quotation'); }
  };

  const downloadPdf = async (e, id, ref) => {
    e.stopPropagation();
    try {
      const res = await api.get(`/quotations/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `quotation-${ref}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Error generating PDF');
    }
  };

  const previewPdf = async (e, id, ref) => {
    e.stopPropagation();
    setPreviewLoading(true);
    setPreviewRef(ref);
    setPreviewUrl(null);
    try {
      const res = await api.get(`/quotations/${id}/pdf`, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      setPreviewUrl(blobUrl);
    } catch {
      toast.error('Error generating PDF preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewRef('');
  };

  const openHistory = async (e, q) => {
    e.stopPropagation();
    setHistoryTarget(q);
    setVersions([]);
    setVersionsLoading(true);
    try {
      const res = await api.get(`/quotations/${q.id}/versions`);
      setVersions(res.data.data || []);
    } catch {
      toast.error('Could not load version history');
    } finally {
      setVersionsLoading(false);
    }
  };

  const submit = async (e, id) => {
    e.stopPropagation();
    try {
      await api.patch(`/quotations/${id}/submit`);
      toast.success('Quotation submitted for review');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error submitting quotation');
    }
  };

  const approve = async (e, id) => {
    e.stopPropagation();
    try {
      await api.patch(`/quotations/${id}/approve`);
      toast.success('Quotation approved');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error approving quotation');
    }
  };

  const handleReturn = async () => {
    try {
      await api.patch(`/quotations/${returnTarget.id}/return`, { notes: returnNotes });
      toast.success('Quotation returned for revision');
      setReturnTarget(null);
      setReturnNotes('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error returning quotation');
    }
  };

  const markSent = async (e, id) => {
    e.stopPropagation();
    try {
      await api.put(`/quotations/${id}`, { status: 'Sent' });
      toast.success('Quotation marked as sent');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error updating quotation');
    }
  };

  const confirmByClient = async (e, id) => {
    e.stopPropagation();
    try {
      await api.patch(`/quotations/${id}/confirm`);
      toast.success('Confirmed by client — sent to Operations');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error confirming quotation');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Quotations</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm">{quotations.length} quotations</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/quotations/new')}>
          <PlusIcon className="w-4 h-4 inline mr-1.5" />New Quotation
        </button>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        {['', ...STATUSES].map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${status === s ? 'bg-gold-500 text-navy-950 font-medium' : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Direction + Service Type filters */}
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        {/* Direction segmented control */}
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-navy-900 rounded-lg">
          {['', ...DIRECTIONS].map(d => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${direction === d
                ? 'bg-white dark:bg-navy-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              {d || 'All Directions'}
            </button>
          ))}
        </div>

        {/* Service type dropdown */}
        <select
          className="select text-sm w-auto"
          value={serviceType}
          onChange={e => setServiceType(e.target.value)}
        >
          <option value="">All Services</option>
          {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {(serviceType || direction) && (
          <button
            onClick={() => { setServiceType(''); setDirection(''); }}
            className="text-xs text-slate-500 dark:text-gray-400 hover:text-gold-500 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Client</th>
                <th>Service</th>
                <th>Route</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map(q => (
                <tr key={q.id} className="cursor-pointer" onClick={() => navigate(`/quotations/${q.id}/edit`)}>
                  <td className="font-mono text-gold-400 text-sm">{q.reference_no}</td>
                  <td className="text-slate-900 dark:text-white font-medium">{q.client_name || '—'}</td>
                  <td className="text-slate-500 dark:text-gray-400 text-xs">{q.service_type}</td>
                  <td className="text-slate-500 dark:text-gray-400 text-xs">{q.origin} → {q.destination}</td>
                  <td className="font-semibold text-slate-900 dark:text-white">{q.currency} {parseFloat(q.total_amount || 0).toLocaleString()}</td>
                  <td>
                    <Badge label={q.status} type="status" />
                    {q.review_notes && q.status === 'Draft' && (
                      <div className="mt-1 text-xs text-orange-500 dark:text-orange-400 flex items-center gap-1">
                        <ArrowUturnLeftIcon className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate max-w-[120px]" title={q.review_notes}>Returned for revision</span>
                      </div>
                    )}
                  </td>
                  <td className="text-gray-500 text-xs">
                    <div>{new Date(q.created_at).toLocaleDateString()}</div>
                    <div className="text-slate-500 dark:text-gray-400">{new Date(q.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    {q.created_by_name && <div className="text-gold-500 mt-0.5 font-medium">{q.created_by_name}</div>}
                  </td>
                  <td>
                    <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                      {/* PDF preview & download — Rep/Finance only after approval; others always */}
                      {canDownloadPdf(q) && (
                        <>
                          <button
                            className="p-1.5 rounded-lg text-purple-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                            title="Preview PDF"
                            aria-label={`Preview PDF for quotation ${q.reference_no}`}
                            onClick={e => previewPdf(e, q.id, q.reference_no)}
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            title="Download PDF"
                            aria-label={`Download PDF for quotation ${q.reference_no}`}
                            onClick={e => downloadPdf(e, q.id, q.reference_no)}
                          >
                            <DocumentArrowDownIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {/* Version history */}
                      <button
                        className="btn-ghost text-xs p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                        title="Version History"
                        onClick={e => openHistory(e, q)}
                      >
                        <ClockIcon className="w-4 h-4" />
                      </button>

                      {/* Submit for Review — Sales Reps only, Draft quotations */}
                      {isRep && q.status === 'Draft' && (
                        <button
                          className="btn-secondary text-xs px-2 py-1 flex items-center gap-1"
                          title="Submit for manager review"
                          onClick={e => submit(e, q.id)}
                        >
                          <PaperAirplaneIcon className="w-3.5 h-3.5" />Submit
                        </button>
                      )}

                      {/* Approve — managers only, Draft or Pending Review */}
                      {canManage && (q.status === 'Draft' || q.status === 'Pending Review') && (
                        <button className="btn-primary text-xs px-2 py-1" onClick={e => approve(e, q.id)}>
                          Approve
                        </button>
                      )}

                      {/* Return for Revision — managers only, Pending Review */}
                      {canManage && q.status === 'Pending Review' && (
                        <button
                          className="btn-ghost text-xs px-2 py-1 text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-center gap-1"
                          title="Return to Sales Rep for revision"
                          onClick={e => { e.stopPropagation(); setReturnTarget(q); setReturnNotes(''); }}
                        >
                          <ArrowUturnLeftIcon className="w-3.5 h-3.5" />Return
                        </button>
                      )}

                      {/* Mark Sent — ALL users, any active status before Sent */}
                      {['Draft', 'Approved', 'Pending Review'].includes(q.status) && (
                        <button className="btn-secondary text-xs px-2 py-1" onClick={e => markSent(e, q.id)}>
                          Mark Sent
                        </button>
                      )}

                      {/* Client Confirmed — ALL users, once Sent or Approved */}
                      {['Sent', 'Approved'].includes(q.status) && (
                        <button
                          className="btn-primary text-xs px-2 py-1 bg-green-600 hover:bg-green-700 border-green-600"
                          title="Client confirmed this quotation"
                          onClick={e => confirmByClient(e, q.id)}
                        >
                          ✓ Client Confirmed
                        </button>
                      )}

                      {/* Reject — all users on Sent or Approved */}
                      {['Approved', 'Sent'].includes(q.status) && (
                        <button
                          className="btn-ghost text-xs px-2 py-1 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1"
                          onClick={e => { e.stopPropagation(); setRejectTarget(q); }}
                        >
                          <XCircleIcon className="w-3.5 h-3.5" />Reject
                        </button>
                      )}

                      {/* Delete — admin only */}
                      {isAdmin && (
                        <button className="btn-ghost text-xs text-red-400 hover:text-red-500 p-1" onClick={e => { e.stopPropagation(); setDeleteTarget(q); }}>
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!quotations.length && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500">No quotations found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Quotation"
        message={`Delete quotation ${deleteTarget?.reference_no}? This cannot be undone.`}
        danger
      />
      <ConfirmDialog
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
        title="Reject Quotation"
        message={`Mark quotation ${rejectTarget?.reference_no} as Rejected? This means the client declined.`}
        danger
      />

      {/* PDF Preview — full-screen overlay */}
      {(previewLoading || !!previewUrl) && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700 flex-shrink-0">
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              {previewLoading ? 'Generating PDF…' : `PDF Preview — ${previewRef}`}
            </span>
            <div className="flex items-center gap-2">
              {previewUrl && (
                <a href={previewUrl} download={`quotation-${previewRef}.pdf`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gold-500 hover:bg-gold-600 text-navy-950 rounded-lg transition-colors">
                  <DocumentArrowDownIcon className="w-4 h-4" />Download
                </a>
              )}
              <button onClick={closePreview} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          {previewLoading ? (
            <div className="flex-1 flex items-center justify-center gap-2 text-slate-400">
              <div className="w-2 h-2 bg-gold-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
              <div className="w-2 h-2 bg-gold-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
              <div className="w-2 h-2 bg-gold-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
          ) : (
            <iframe src={previewUrl} className="flex-1 w-full" title={`Quotation ${previewRef}`} />
          )}
        </div>
      )}

      {/* Version History Modal */}
      <Modal
        isOpen={!!historyTarget}
        onClose={() => { setHistoryTarget(null); setVersions([]); }}
        title={`Version History — ${historyTarget?.reference_no}`}
        size="md"
      >
        {versionsLoading ? (
          <div className="py-10 text-center text-slate-400 dark:text-gray-500 text-sm">Loading history…</div>
        ) : versions.length === 0 ? (
          <div className="py-10 text-center text-slate-400 dark:text-gray-500 text-sm">
            No saved versions yet. Versions are created automatically each time a quotation is edited.
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">v{v.version_no}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 dark:text-gray-200">
                    Status at save: <span className="font-semibold">{v.status || '—'}</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    {v.currency} {parseFloat(v.total_amount || 0).toLocaleString()} · Changed by {v.changed_by_name || 'System'}
                  </div>
                </div>
                <div className="text-xs text-slate-400 dark:text-gray-500 flex-shrink-0 text-right">
                  {new Date(v.created_at).toLocaleDateString()}<br />
                  {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Return for Revision Modal */}
      <Modal
        isOpen={!!returnTarget}
        onClose={() => { setReturnTarget(null); setReturnNotes(''); }}
        title="Return for Revision"
        size="sm"
      >
        <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
          Return <span className="font-semibold text-slate-900 dark:text-white">{returnTarget?.reference_no}</span> to the Sales Rep with optional revision notes.
        </p>
        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
          Revision Notes <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={returnNotes}
          onChange={e => setReturnNotes(e.target.value)}
          rows={4}
          placeholder="Explain what needs to be changed…"
          className="input w-full resize-none text-sm"
        />
        <div className="flex gap-3 mt-5">
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            onClick={handleReturn}
          >
            <ArrowUturnLeftIcon className="w-4 h-4" />Return for Revision
          </button>
          <button
            className="btn-ghost flex-1"
            onClick={() => { setReturnTarget(null); setReturnNotes(''); }}
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
