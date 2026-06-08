import React, { useState, useEffect, useRef } from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';

const COUNTDOWN_SECS = 5 * 60; // 5 minutes

export default function InactivityWarning({ onStayLoggedIn, onLogout }) {
  const [secs, setSecs] = useState(COUNTDOWN_SECS);
  // Keep latest onLogout without restarting the countdown each render
  const logoutRef = useRef(onLogout);
  logoutRef.current = onLogout;

  useEffect(() => {
    const id = setInterval(() => setSecs(s => {
      if (s <= 1) {
        clearInterval(id);
        logoutRef.current?.();
        return 0;
      }
      return s - 1;
    }), 1000);
    return () => clearInterval(id);
  }, []);

  const mins = Math.floor(secs / 60);
  const rem  = secs % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center border border-slate-200 dark:border-navy-700">
        <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
          <ClockIcon className="w-7 h-7 text-amber-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Still there?</h2>
        <p className="text-slate-500 dark:text-gray-400 text-sm mb-5">
          You've been inactive for a while. You'll be logged out in:
        </p>
        <div className="text-5xl font-mono font-bold text-amber-500 mb-6 tabular-nums">
          {String(mins).padStart(2, '0')}:{String(rem).padStart(2, '0')}
        </div>
        <div className="flex gap-3">
          <button onClick={onLogout} className="btn-secondary flex-1">Log out now</button>
          <button onClick={onStayLoggedIn} className="btn-primary flex-1">I'm still here</button>
        </div>
      </div>
    </div>
  );
}
