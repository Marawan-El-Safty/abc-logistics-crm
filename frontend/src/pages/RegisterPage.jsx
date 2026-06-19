import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { APP_NAME } from '../branding';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ companyName: '', slug: '', fullName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

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
      });
      const { accessToken, refreshToken } = res.data;
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      navigate('/onboarding');
    } catch (err) {
      // UX-4: Map backend error codes to user-friendly messages
      const errMsg = err.response?.data?.error || '';
      if (errMsg.toLowerCase().includes('slug') && errMsg.toLowerCase().includes('taken')) {
        setError('That workspace name is already taken. Try another.');
      } else if (errMsg.toLowerCase().includes('reserved')) {
        setError('That workspace name is reserved. Please choose another.');
      } else if (errMsg.toLowerCase().includes('email') && errMsg.toLowerCase().includes('registered')) {
        setError('An account with this email already exists. Try logging in.');
      } else {
        setError(errMsg || err.response?.data?.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-8">
        <h1 className="text-2xl font-bold text-blue-700 mb-1">{APP_NAME}</h1>
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Create your company account</h2>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input required className="w-full border rounded-lg px-3 py-2 text-sm" value={form.companyName} onChange={set('companyName')} placeholder="Acme Logistics" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Workspace Slug</label>
            <input required pattern="[a-z0-9-]{3,63}" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.slug} onChange={set('slug')} placeholder="acme-logistics" />
            <p className="text-xs text-gray-400 mt-1">Lowercase letters, numbers, hyphens. 3–63 chars.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Full Name</label>
            <input required className="w-full border rounded-lg px-3 py-2 text-sm" value={form.fullName} onChange={set('fullName')} placeholder="John Doe" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work Email</label>
            <input required type="email" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.email} onChange={set('email')} placeholder="you@company.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input required type="password" minLength={8} className="w-full border rounded-lg px-3 py-2 text-sm" value={form.password} onChange={set('password')} placeholder="Min 8 characters" />
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p className="mt-4 text-sm text-center text-gray-500">
          Already have an account? <Link to="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </p>
        <p className="mt-2 text-xs text-center text-gray-400">
          By signing up you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
