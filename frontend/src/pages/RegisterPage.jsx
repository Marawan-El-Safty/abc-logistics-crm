import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { APP_NAME } from '../branding';

const PLAN_LABELS = { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' };
const PLAN_PRICES = { starter: 15, professional: 25, enterprise: 40 };

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialPlan = ['starter','professional','enterprise'].includes(searchParams.get('plan'))
    ? searchParams.get('plan') : 'starter';
  const initialSeats = Math.max(1, parseInt(searchParams.get('seats')) || 3);

  const [form, setForm] = useState({
    companyName: '', slug: '', fullName: '', email: '', password: '',
    plan: initialPlan, seats: initialSeats,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  // Auto-generate slug from company name
  useEffect(() => {
    const slug = form.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 63);
    setForm(f => ({ ...f, slug }));
  }, [form.companyName]);

  const monthly = PLAN_PRICES[form.plan] * form.seats;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/register-company', {
        company_name: form.companyName,
        slug: form.slug,
        full_name: form.fullName,
        email: form.email,
        password: form.password,
        plan: form.plan,
        seats: form.seats,
      });
      const { accessToken, refreshToken } = res.data;
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      navigate('/onboarding');
    } catch (err) {
      const errMsg = err.response?.data?.error || '';
      if (errMsg.toLowerCase().includes('slug') && errMsg.toLowerCase().includes('taken')) {
        setError('That workspace URL is already taken. Try another.');
      } else if (errMsg.toLowerCase().includes('reserved')) {
        setError('That workspace URL is reserved. Please choose another.');
      } else if (errMsg.toLowerCase().includes('email') && errMsg.toLowerCase().includes('registered')) {
        setError('An account with this email already exists.');
      } else {
        setError(errMsg || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left — plan summary */}
      <div className="hidden lg:flex flex-col justify-center w-96 bg-blue-700 text-white p-12 shrink-0">
        <div className="text-2xl font-bold mb-1">{APP_NAME}</div>
        <div className="text-blue-200 text-sm mb-12">Freight Management Made Simple</div>

        <div className="bg-white/10 rounded-2xl p-6 mb-8">
          <div className="text-sm font-semibold text-blue-200 uppercase tracking-wide mb-3">Your Plan</div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-2xl font-bold">{PLAN_LABELS[form.plan]}</span>
            <span className="text-3xl font-black">${monthly}<span className="text-base font-normal text-blue-200">/mo</span></span>
          </div>
          <div className="text-blue-200 text-sm">${PLAN_PRICES[form.plan]} × {form.seats} user{form.seats > 1 ? 's' : ''}</div>
        </div>

        <ul className="space-y-3 text-sm">
          {[
            '14-day free trial',
            'No credit card required',
            'Cancel anytime',
            'Manual invoice billing',
          ].map(item => (
            <li key={item} className="flex items-center gap-2">
              <span className="text-green-400 font-bold">✓</span> {item}
            </li>
          ))}
        </ul>

        <div className="mt-12 text-blue-200 text-xs">
          Want a different plan?{' '}
          <Link to="/pricing" className="text-white underline">Change plan</Link>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your workspace</h1>
            <p className="text-gray-500 text-sm">
              14-day free trial · {PLAN_LABELS[form.plan]} plan · {form.seats} seat{form.seats > 1 ? 's' : ''}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input required className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.companyName} onChange={set('companyName')} placeholder="Acme Freight LLC" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Workspace URL</label>
              <div className="flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                <span className="px-3 py-2.5 bg-gray-50 text-gray-400 text-sm border-r">freightos.app/</span>
                <input required pattern="[a-z0-9-]{3,63}" className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
                  value={form.slug} onChange={set('slug')} placeholder="acme-freight" />
              </div>
              <p className="text-xs text-gray-400 mt-1">Lowercase letters, numbers, hyphens. 3–63 chars.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Full Name</label>
              <input required className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.fullName} onChange={set('fullName')} placeholder="Your name" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Work Email</label>
              <input required type="email" className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.email} onChange={set('email')} placeholder="you@company.com" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input required type="password" minLength={8} className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.password} onChange={set('password')} placeholder="Min 8 characters" />
            </div>

            {/* Plan + seats (mobile / change) */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                <select className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.plan} onChange={set('plan')}>
                  <option value="starter">Starter — $15/seat/mo</option>
                  <option value="professional">Professional — $25/seat/mo</option>
                  <option value="enterprise">Enterprise — $40/seat/mo</option>
                </select>
              </div>
              <div className="w-28">
                <label className="block text-sm font-medium text-gray-700 mb-1">Users</label>
                <input type="number" min="1" max="500" required
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.seats} onChange={e => setForm(f => ({ ...f, seats: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>

            <div className="text-right text-sm text-gray-500">
              Total: <strong className="text-gray-900">${monthly}/month</strong> after trial
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 mt-2">
              {loading ? 'Creating workspace...' : 'Start 14-Day Free Trial'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            Already have an account? <Link to="/login" className="text-blue-600 hover:underline">Sign in</Link>
          </p>
          <p className="mt-2 text-center text-xs text-gray-400">
            By signing up you agree to our{' '}
            <Link to="/terms" className="underline">Terms</Link> and{' '}
            <Link to="/privacy" className="underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
