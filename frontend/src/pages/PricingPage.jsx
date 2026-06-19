import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { APP_NAME } from '../branding';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    pricePerSeat: 15,
    desc: 'Perfect for small freight teams.',
    color: 'border-gray-200',
    badge: '',
    limits: { clients: 200, shipments: '50 / mo' },
    features: [
      'CRM & Client Management',
      'Quotations & Invoices',
      'Shipment Tracking',
      'Team Collaboration',
      'Email Notifications',
    ],
    locked: ['Sales Invoices', 'B/L Documents', 'Reports Export', 'Audit Log', 'Finance Dashboard'],
    minSeats: 1,
    maxSeats: 10,
  },
  {
    id: 'professional',
    name: 'Professional',
    pricePerSeat: 25,
    desc: 'For growing logistics companies.',
    color: 'border-blue-500',
    badge: 'Most Popular',
    limits: { clients: 2000, shipments: '500 / mo' },
    features: [
      'Everything in Starter',
      'Sales Invoices',
      'B/L Document Generator',
      'Reports & Analytics Export',
      'Profit Dashboard',
    ],
    locked: ['Audit Log'],
    minSeats: 3,
    maxSeats: 50,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    pricePerSeat: 40,
    desc: 'Full power for large operations.',
    color: 'border-purple-500',
    badge: 'Full Access',
    limits: { clients: 'Unlimited', shipments: 'Unlimited' },
    features: [
      'Everything in Professional',
      'Full Audit Log',
      'Priority Support',
      'Custom Onboarding',
      'Unlimited Clients & Shipments',
    ],
    locked: [],
    minSeats: 5,
    maxSeats: 500,
  },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const [seats, setSeats] = useState({ starter: 3, professional: 5, enterprise: 10 });

  const updateSeats = (planId, val) => {
    const plan = PLANS.find(p => p.id === planId);
    const clamped = Math.max(plan.minSeats, Math.min(plan.maxSeats, parseInt(val) || plan.minSeats));
    setSeats(s => ({ ...s, [planId]: clamped }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b px-8 py-4 flex items-center justify-between">
        <Link to="/landing" className="text-xl font-bold text-blue-700">{APP_NAME}</Link>
        <div className="flex gap-4 items-center">
          <Link to="/landing" className="text-gray-500 hover:text-gray-800 text-sm">Home</Link>
          <Link to="/login" className="text-gray-500 hover:text-gray-800 text-sm">Sign In</Link>
          <Link to="/register" className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Get Started</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Pay only for the seats you need</h1>
          <p className="text-lg text-gray-500">Choose a plan, pick your team size, start a 14-day free trial. No credit card required.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PLANS.map(plan => {
            const seatCount = seats[plan.id];
            const monthly = plan.pricePerSeat * seatCount;

            return (
              <div key={plan.id} className={`bg-white rounded-2xl border-2 ${plan.color} p-8 flex flex-col shadow-sm relative`}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <h2 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h2>
                <p className="text-sm text-gray-500 mb-6">{plan.desc}</p>

                {/* Seat selector */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Number of Users
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateSeats(plan.id, seatCount - 1)}
                      disabled={seatCount <= plan.minSeats}
                      className="w-8 h-8 rounded-full border flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                    >−</button>
                    <input
                      type="number"
                      min={plan.minSeats}
                      max={plan.maxSeats}
                      value={seatCount}
                      onChange={e => updateSeats(plan.id, e.target.value)}
                      className="w-16 text-center font-bold text-lg border rounded-lg py-1"
                    />
                    <button
                      onClick={() => updateSeats(plan.id, seatCount + 1)}
                      disabled={seatCount >= plan.maxSeats}
                      className="w-8 h-8 rounded-full border flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                    >+</button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{plan.minSeats}–{plan.maxSeats} users on this plan</p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-gray-900">${monthly}</span>
                    <span className="text-gray-400 text-sm">/ month</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    ${plan.pricePerSeat} × {seatCount} user{seatCount > 1 ? 's' : ''}
                  </p>
                </div>

                {/* Limits */}
                <div className="flex gap-4 mb-6 text-xs">
                  <span className="bg-gray-100 px-2 py-1 rounded text-gray-600">👥 {plan.limits.clients} clients</span>
                  <span className="bg-gray-100 px-2 py-1 rounded text-gray-600">🚢 {plan.limits.shipments}</span>
                </div>

                {/* CTA */}
                <button
                  onClick={() => navigate(`/register?plan=${plan.id}&seats=${seatCount}`)}
                  className={`w-full py-3 rounded-xl font-semibold mb-6 ${
                    plan.id === 'professional'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'border-2 border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600'
                  }`}
                >
                  Start Free Trial
                </button>

                {/* Features */}
                <ul className="space-y-2 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-green-500 font-bold">✓</span> {f}
                    </li>
                  ))}
                  {plan.locked.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-400">
                      <span>🔒</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm text-gray-400 mt-10">
          All plans include a 14-day free trial. No credit card required. Billing is manual — we'll invoice you monthly.
        </p>
      </div>
    </div>
  );
}
