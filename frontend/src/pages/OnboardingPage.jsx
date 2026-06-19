import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { APP_NAME } from '../branding';

const steps = ['Company Info', 'Invite Team', 'Done'];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState({ name: '', address: '', email: '', phone: '' });
  const [invites, setInvites] = useState(['']);
  const [saving, setSaving] = useState(false);

  const saveCompany = async () => {
    setSaving(true);
    try {
      await api.patch('/settings', { company });
      setStep(1);
    } catch (_) {} finally { setSaving(false); }
  };

  const sendInvites = async () => {
    setSaving(true);
    try {
      for (const email of invites.filter(e => e.trim())) {
        await api.post('/users/invite', { email }).catch(() => {});
      }
      setStep(2);
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow p-8">
        <h1 className="text-xl font-bold text-blue-700 mb-1">{APP_NAME}</h1>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Welcome! Let's set things up</h2>
        {/* Steps */}
        <div className="flex gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className={`flex-1 h-1.5 rounded-full ${i <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-700">Company Information</h3>
            {['name','address','email','phone'].map(k => (
              <input key={k} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={k.charAt(0).toUpperCase()+k.slice(1)}
                value={company[k]} onChange={e => setCompany(c => ({ ...c, [k]: e.target.value }))} />
            ))}
            <button onClick={saveCompany} disabled={saving} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Next'}
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-700">Invite Team Members (optional)</h3>
            {invites.map((inv, i) => (
              <input key={i} type="email" className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="colleague@company.com" value={inv}
                onChange={e => setInvites(arr => arr.map((v, j) => j === i ? e.target.value : v))} />
            ))}
            <button type="button" onClick={() => setInvites(a => [...a, ''])} className="text-sm text-blue-600 hover:underline">+ Add another</button>
            <div className="flex gap-3">
              <button onClick={sendInvites} disabled={saving} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Sending...' : 'Send Invites'}
              </button>
              <button onClick={() => setStep(2)} className="px-4 py-2.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Skip</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">You're all set!</h3>
            <p className="text-gray-500 mb-6">Your FreightOS workspace is ready.</p>
            <button onClick={() => navigate('/dashboard')} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
