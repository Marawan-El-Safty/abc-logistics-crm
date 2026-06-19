import React from 'react';
import { Link } from 'react-router-dom';
import { APP_NAME } from '../branding';

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto py-16 px-6">
      <Link to="/" className="text-sm text-blue-600 hover:underline">&larr; Back</Link>
      <h1 className="text-3xl font-bold text-gray-900 mt-6 mb-4">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>
      <div className="text-sm leading-relaxed space-y-4">
        <p>This Privacy Policy describes how {APP_NAME} collects, uses, and protects your information.</p>
        <h2 className="text-lg font-semibold mt-6">1. Information We Collect</h2>
        <p>We collect information you provide (name, email, company data) and usage data (logs, IP addresses) to operate the Service.</p>
        <h2 className="text-lg font-semibold mt-6">2. How We Use It</h2>
        <p>We use your data to provide and improve the Service, send transactional emails, and comply with legal obligations. We do not sell your data.</p>
        <h2 className="text-lg font-semibold mt-6">3. Data Storage</h2>
        <p>Data is stored on secured servers. Each tenant's data is logically isolated. Backups are encrypted.</p>
        <h2 className="text-lg font-semibold mt-6">4. Cookies</h2>
        <p>We use cookies for session management only. No advertising or tracking cookies.</p>
        <h2 className="text-lg font-semibold mt-6">5. Your Rights</h2>
        <p>You may request access to, correction of, or deletion of your personal data at any time by contacting us.</p>
        <h2 className="text-lg font-semibold mt-6">6. Changes</h2>
        <p>We may update this policy. We'll notify you via email of material changes.</p>
        <p className="mt-8">Contact: <a href="mailto:privacy@freightos.app" className="text-blue-600 underline">privacy@freightos.app</a></p>
      </div>
    </div>
  );
}
