import { useEffect, useRef } from 'react';

const FIVE_MINUTES = 5 * 60 * 1000;

export function useAutoRefresh(fn, intervalMs = FIVE_MINUTES) {
  // Stable ref so the interval never needs to restart when fn identity changes
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; }, [fn]);

  useEffect(() => {
    // Only tick when tab is visible — avoids burst of stale requests on return
    const tick = () => {
      if (document.visibilityState !== 'hidden') fnRef.current();
    };
    const id = setInterval(tick, intervalMs);

    // Re-fetch immediately when the user switches back to this tab
    const onVisible = () => {
      if (document.visibilityState === 'visible') fnRef.current();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
}
