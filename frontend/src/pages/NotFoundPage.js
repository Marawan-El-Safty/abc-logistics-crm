import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white dark:bg-navy-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-gold-500 text-8xl font-black mb-4">404</div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Page Not Found</h1>
        <p className="text-slate-500 dark:text-gray-400 mb-6">The page you're looking for doesn't exist.</p>
        <button className="btn-primary" onClick={() => navigate('/')}>Go to Dashboard</button>
      </div>
    </div>
  );
}
