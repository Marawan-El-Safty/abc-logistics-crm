import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { APP_NAME } from '../branding';

// UX-2: Accept-invite page — route: /invite/accept/:token
// States: loading (verifying token presence), form (set password), success, error
export default function AcceptInvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState('form'); // 'form' | 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect to login after success
  useEffect(() => {
    if (phase === 'success') {
      const t = setTimeout(() => navigate('/login'), 3000);
      return () => clearTimeout(t);
    }
  }, [phase, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/auth/accept-invite/${token}`, { password, fullName: fullName.trim() || undefined });
      setPhase('success');
    } catch (err) {
      const errCode = err.response?.data?.error;
      const errMsg = err.response?.data?.message || err.response?.data?.error || '';

      if (
        errCode === 'expired' ||
        errMsg.toLowerCase().includes('expired') ||
        errMsg.toLowerCase().includes('invalid')
      ) {
        setErrorMsg('This invite has expired. Ask your admin to resend.');
      } else {
        setErrorMsg(errMsg || 'Something went wrong. Please try again or contact your admin.');
      }
      setPhase('error');
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-green-500 text-5xl mb-4">&#10003;</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Password set!</h2>
          <p className="text-gray-500 text-sm">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold text-blue-700 mb-1">{APP_NAME}</h1>
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Accept your invitation</h2>
        <p className="text-sm text-gray-500 mb-6">Set a password to activate your account.</p>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {errorMsg}
          </div>
        )}

        {phase !== 'error' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Name (optional)</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                required
                type="password"
                minLength={8}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                required
                type="password"
                minLength={8}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Activating account...' : 'Activate Account'}
            </button>
          </form>
        )}

        {phase === 'error' && (
          <p className="text-sm text-gray-500 mt-4">
            Need help? Contact your workspace admin or{' '}
            <a href="mailto:support@freightos.app" className="text-blue-600 hover:underline">
              support@freightos.app
            </a>
            .
          </p>
        )}
      </div>
    </div>
  );
}
