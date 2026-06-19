import React from 'react';
import { Link } from 'react-router-dom';
import { APP_NAME, APP_TAGLINE } from '../branding';

const features = [
  { icon: '🚢', title: 'Shipment Tracking', desc: 'Track every booking from quote to delivery.' },
  { icon: '📄', title: 'Quotations & Invoices', desc: 'Generate professional quotes and collect payments.' },
  { icon: '👥', title: 'CRM & Leads', desc: 'Manage clients and sales pipeline in one place.' },
  { icon: '📊', title: 'Reports & Analytics', desc: 'Data-driven decisions with real-time dashboards.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b">
        <span className="text-xl font-bold text-blue-700">{APP_NAME}</span>
        <div className="flex gap-4">
          <Link to="/pricing" className="text-gray-600 hover:text-gray-900">Pricing</Link>
          <Link to="/login" className="text-gray-600 hover:text-gray-900">Login</Link>
          <Link to="/register" className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center py-24 px-4">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">{APP_NAME}</h1>
        <p className="text-xl text-gray-500 mb-8">{APP_TAGLINE}</p>
        <div className="flex gap-4 justify-center">
          <Link to="/register" className="px-8 py-3 bg-blue-600 text-white rounded-xl text-lg hover:bg-blue-700">
            Start Free Trial
          </Link>
          <Link to="/pricing" className="px-8 py-3 border border-gray-300 text-gray-700 rounded-xl text-lg hover:bg-gray-50">
            See Pricing
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-8 pb-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {features.map(f => (
          <div key={f.title} className="p-6 border rounded-xl text-center">
            <div className="text-4xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-gray-800 mb-1">{f.title}</h3>
            <p className="text-sm text-gray-500">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-gray-400">
        <div className="flex gap-6 justify-center mb-2">
          <Link to="/terms" className="hover:text-gray-600">Terms</Link>
          <Link to="/privacy" className="hover:text-gray-600">Privacy</Link>
        </div>
        &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
      </footer>
    </div>
  );
}
