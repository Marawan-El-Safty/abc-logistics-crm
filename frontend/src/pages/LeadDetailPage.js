import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { ArrowLeftIcon, PlusIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import ActivityForm from '../components/activities/ActivityForm';

const STAGES = ['New Lead', 'Contacted', 'Proposal Sent', 'Negotiating', 'Won', 'Lost'];

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [stagingTo, setStagingTo] = useState('');

  const load = async () => {
    try {
      const res = await api.get(`/leads/${id}`);
      setLead(res.data.data);
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const moveToStage = (stage) => {
    if (stage === 'Lost') { setStagingTo(stage); setShowStageModal(true); return; }
    confirmMove(stage);
  };

  const confirmMove = async (stage, reason) => {
    try {
      const res = await api.patch(`/leads/${id}/stage`, { stage, lostReason: reason });
      if (res.data.convertedClientId) {
        navigate(`/clients/${res.data.convertedClientId}`);
        return;
      }
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error updating stage');
    }
  };

  if (loading) return <div className="text-center py-16 text-slate-500 dark:text-gray-500">Loading...</div>;
  if (!lead) return <div className="text-center py-16 text-slate-500 dark:text-gray-500">Lead not found</div>;

  const currentStageIdx = STAGES.indexOf(lead.stage);

  return (
    <div>
      <div className="flex items-start gap-4 mb-6">
        <button onClick={() => navigate('/leads')} className="btn-ghost mt-0.5">
          <ArrowLeftIcon className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{lead.contact_name}</h2>
            <Badge label={lead.stage} type="stage" />
            <Badge label={lead.source} />
          </div>
          {lead.company_name && <p className="text-slate-500 dark:text-gray-400 mt-0.5">{lead.company_name}</p>}
        </div>
        <button className="btn-secondary" onClick={() => setShowActivityForm(true)}>
          <PlusIcon className="w-4 h-4 inline mr-1.5" />Log Activity
        </button>
        <button className="btn-primary" onClick={() => navigate(`/quotations/new?leadId=${id}`)}>
          New Quotation
        </button>
      </div>

      {/* Stage Pipeline */}
      <div className="card mb-6">
        <h3 className="section-title mb-3">Pipeline Progress</h3>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {STAGES.slice(0, 4).map((stage, idx) => {
            const isPast = currentStageIdx > idx;
            const isCurrent = currentStageIdx === idx;
            const canMove = !['Won', 'Lost'].includes(lead.stage);
            return (
              <React.Fragment key={stage}>
                <button
                  onClick={() => canMove && moveToStage(stage)}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${isCurrent ? 'bg-gold-500 text-navy-950' :
                      isPast ? 'bg-green-600/30 text-green-400 border border-green-600/30' :
                      'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-navy-700 hover:text-slate-900 dark:hover:text-white'}`}
                  disabled={!canMove}
                >
                  {isPast && <CheckIcon className="w-3.5 h-3.5 inline mr-1" />}
                  {stage}
                </button>
                {idx < 3 && <div className={`w-6 h-px flex-shrink-0 ${isPast ? 'bg-green-600' : 'bg-slate-300 dark:bg-navy-700'}`} />}
              </React.Fragment>
            );
          })}
          <div className="ml-auto flex gap-2">
            {!['Won', 'Lost'].includes(lead.stage) && (
              <>
                <button onClick={() => moveToStage('Won')} className="btn-primary text-xs px-3 py-1.5">
                  <CheckIcon className="w-3.5 h-3.5 inline mr-1" />Mark Won
                </button>
                <button onClick={() => { setStagingTo('Lost'); setShowStageModal(true); }} className="btn-danger text-xs px-3 py-1.5">
                  <XMarkIcon className="w-3.5 h-3.5 inline mr-1" />Mark Lost
                </button>
              </>
            )}
          </div>
        </div>
        {lead.stage === 'Won' && lead.converted_to && (
          <div className="mt-3 bg-green-900/20 border border-green-700/30 rounded-lg px-4 py-2 text-sm text-green-400">
            Converted to client. <span className="link" onClick={() => navigate(`/clients/${lead.converted_to}`)}>View Client →</span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="card lg:col-span-2">
          <h3 className="section-title">Lead Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              ['Contact', lead.contact_name],
              ['Company', lead.company_name],
              ['Email', lead.email],
              ['Phone', lead.phone],
              ['Shipment Type', lead.shipment_type],
              ['Assigned To', lead.assigned_to_name],
              ['Origin', lead.origin],
              ['Destination', lead.destination],
              ['Weight', lead.weight ? `${lead.weight} ${lead.weight_unit}` : null],
              ['Volume', lead.volume ? `${lead.volume} ${lead.volume_unit}` : null],
            ].map(([label, value]) => value ? (
              <div key={label}>
                <span className="text-slate-500 dark:text-gray-500">{label}:</span>
                <span className="text-slate-800 dark:text-gray-200 ml-2">{value}</span>
              </div>
            ) : null)}
          </div>
          {lead.cargo_details && (
            <div className="mt-4">
              <span className="label">Cargo Details</span>
              <p className="text-slate-700 dark:text-gray-300 text-sm">{lead.cargo_details}</p>
            </div>
          )}
          {lead.notes && (
            <div className="mt-3">
              <span className="label">Notes</span>
              <p className="text-slate-700 dark:text-gray-300 text-sm">{lead.notes}</p>
            </div>
          )}
          {lead.lost_reason && (
            <div className="mt-3 bg-red-900/20 border border-red-700/30 rounded-lg p-3">
              <span className="label">Lost Reason</span>
              <p className="text-red-600 dark:text-red-300 text-sm">{lead.lost_reason}</p>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="section-title">Stage Timeline</h3>
          <div className="space-y-2 text-xs">
            {[
              ['New Lead', lead.stage_new_lead_at],
              ['Contacted', lead.stage_contacted_at],
              ['Proposal Sent', lead.stage_proposal_at],
              ['Negotiating', lead.stage_negotiating_at],
              ['Won', lead.stage_won_at],
              ['Lost', lead.stage_lost_at],
            ].filter(([, date]) => date).map(([stage, date]) => (
              <div key={stage} className="flex justify-between">
                <Badge label={stage} type="stage" />
                <span className="text-gray-500">{new Date(date).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="card">
        <div className="flex justify-between mb-4">
          <h3 className="section-title">Activity Log ({lead.activities?.length || 0})</h3>
          <button className="btn-primary text-xs" onClick={() => setShowActivityForm(true)}>
            <PlusIcon className="w-3.5 h-3.5 inline mr-1" />Log Activity
          </button>
        </div>
        {lead.activities?.length > 0 ? (
          <div className="space-y-3">
            {lead.activities.map(act => (
              <div key={act.id} className="flex gap-3 p-3 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge label={act.activity_type} />
                    <span className="text-slate-500 dark:text-gray-400 text-xs">by {act.performed_by_name}</span>
                    <span className="text-slate-400 dark:text-gray-600 text-xs">{new Date(act.activity_date).toLocaleDateString()}</span>
                  </div>
                  {act.notes && <p className="text-slate-600 dark:text-gray-300 text-sm mt-1">{act.notes}</p>}
                  {act.next_follow_up && (
                    <p className="text-gold-600 dark:text-gold-400 text-xs mt-1">Follow-up: {new Date(act.next_follow_up).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 dark:text-gray-500 text-sm">No activities yet</div>
        )}
      </div>

      {/* Activity Form Modal */}
      <Modal isOpen={showActivityForm} onClose={() => setShowActivityForm(false)} title="Log Activity" size="md">
        <ActivityForm leadId={id} onSave={() => { setShowActivityForm(false); load(); }} onClose={() => setShowActivityForm(false)} />
      </Modal>

      {/* Lost Reason Modal */}
      <Modal isOpen={showStageModal} onClose={() => setShowStageModal(false)} title="Mark as Lost" size="sm">
        <div className="form-group">
          <label className="label">Reason for loss</label>
          <textarea className="input" rows={3} placeholder="Why was this lead lost?" value={lostReason} onChange={e => setLostReason(e.target.value)} />
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button className="btn-secondary" onClick={() => setShowStageModal(false)}>Cancel</button>
          <button className="btn-danger" onClick={() => { confirmMove('Lost', lostReason); setShowStageModal(false); }}>
            Confirm Lost
          </button>
        </div>
      </Modal>
    </div>
  );
}
