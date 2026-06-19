import React from 'react';
import { Link } from 'react-router-dom';
import { APP_NAME } from '../branding';

const plans = [
  {
    name: 'Starter',
    price: 15,
    desc: 'Great for small teams getting started.',
    limits: { seats: 3, clients: 200, shipments: '50/mo' },
    features: ['Core CRM', 'Quotations', 'Shipments', 'Invoices'],
    missing: ['Sales Invoices', 'B/L Documents', 'Reports Export', 'Audit Log'],
  },
  {
    name: 'Professional',
    price: 25,
    popular: true,
    desc: 'Everything your growing team needs.',
    limits: { seats: 15, clients: 2000, shipments: '500/mo' },
    features: ['Everything in Starter', 'Sales Invoices', 'B/L Documents', 'Reports Export'],
    missing: ['Audit Log'],
  },
  {
    name: 'Enterprise',
    price: 40,
    desc: 'Unlimited scale with full audit trail.',
    limits: { seats: 'Unlimited', clients: 'Unlimited', shipments: 'Unlimited' },
    features: ['Everything in Professional', 'Audit Log', 'Priority Support', 'Custom Onboarding'],
    missing: [],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Simple, Transparent Pricing</h1>
        <p className="text-gray-500">Per seat / per month. Cancel anytime.</p>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(p => (
          <div key={p.name} className={`bg-white rounded-2xl border p-6 ${p.popular ? 'border-blue-500 shadow-lg' : ''}`}>
            {p.popular && <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">Most Popular</div>}
            <h2 className="text-xl font-bold text-gray-900">{p.name}</h2>
            <p className="text-4xl font-bold text-gray-900 mt-3">${p.price}<span className="text-base font-normal text-gray-500">/seat/mo</span></p>
            <p className="text-sm text-gray-500 mt-2 mb-5">{p.desc}</p>

            <div className="text-xs text-gray-500 space-y-1 mb-5">
              <div>Up to <strong>{p.limits.seats}</strong> seats</div>
              <div><strong>{p.limits.clients}</strong> clients</div>
              <div><strong>{p.limits.shipments}</strong> shipments</div>
            </div>

            <ul className="space-y-2 mb-6">
              {p.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-500">✓</span>{f}
                </li>
              ))}
              {p.missing.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-400">
                  <span>✗</span>{f}
                </li>
              ))}
            </ul>

            <Link to="/register" className={`block text-center py-2.5 rounded-lg font-medium transition ${p.popular ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
              Get Started
            </Link>
          </div>
        ))}
      </div>

      <p className="text-center text-sm text-gray-400 mt-12">
        Questions? Contact us at <a href="mailto:hello@freightos.app" className="underline">hello@freightos.app</a>
      </p>

      <div className="text-center mt-6">
        <Link to="/" className="text-sm text-blue-600 hover:underline">&larr; Back to {APP_NAME}</Link>
      </div>
    </div>
  );
}
