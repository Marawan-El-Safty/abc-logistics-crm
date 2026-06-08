import React from 'react';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-white dark:bg-navy-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <img
          src="/logo.svg"
          alt="ABC Logistics"
          className="h-16 object-contain animate-pulse"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-gold-500 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
