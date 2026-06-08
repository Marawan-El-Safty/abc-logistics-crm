import React, { useState, useEffect } from 'react';
import { WifiIcon } from '@heroicons/react/24/outline';

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 border border-red-700 text-red-200 px-4 py-2 rounded-full flex items-center gap-2 text-sm backdrop-blur-sm shadow-lg">
      <WifiIcon className="w-4 h-4" />
      <span>You're offline. Changes will sync when reconnected.</span>
    </div>
  );
}
