import React from 'react';
import { Link } from 'react-router-dom';
import { APP_NAME } from '../branding';

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-6">
      <Link to="/" className="text-sm text-blue-600 hover:underline">&larr; Back</Link>
      <h1 className="text-3xl font-bold text-gray-900 mt-6 mb-4">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>
      <div className="prose prose-gray text-sm leading-relaxed space-y-4">
        <p>By accessing or using {APP_NAME} ("Service"), you agree to be bound by these Terms of Service.</p>
        <h2 className="text-lg font-semibold mt-6">1. Use of Service</h2>
        <p>You may use the Service only for lawful purposes and in accordance with these Terms. You are responsible for all activity under your account.</p>
        <h2 className="text-lg font-semibold mt-6">2. Subscriptions & Billing</h2>
        <p>Subscriptions are billed per seat per month. You may cancel at any time; charges are non-refundable for the current billing period.</p>
        <h2 className="text-lg font-semibold mt-6">3. Data</h2>
        <p>You retain ownership of your data. We process it only to provide the Service. See our Privacy Policy for details.</p>
        <h2 className="text-lg font-semibold mt-6">4. Termination</h2>
        <p>We may suspend or terminate accounts that violate these Terms. On termination, your data may be deleted after 30 days.</p>
        <h2 className="text-lg font-semibold mt-6">5. Limitation of Liability</h2>
        <p>The Service is provided "as is". We are not liable for indirect, incidental, or consequential damages.</p>
        <h2 className="text-lg font-semibold mt-6">6. Changes</h2>
        <p>We may update these Terms at any time. Continued use constitutes acceptance of the new Terms.</p>
        <p className="mt-8">For questions, contact us at <a href="mailto:legal@freightos.app" className="text-blue-600 underline">legal@freightos.app</a></p>
      </div>
    </div>
  );
}
