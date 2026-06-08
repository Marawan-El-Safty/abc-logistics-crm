import { useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

const PING_MS  = 5 * 60 * 1000;  // 5 min → backend keep-alive ping
const CHECK_MS = 5 * 1000;        // re-evaluate every 5s

/**
 * Inactivity timer based on wall-clock timestamps rather than a single long
 * setTimeout. Long timeouts get throttled/paused in background tabs (so they
 * "don't count until opened"), and resetting them on every mouse move while the
 * warning is up prevents logout entirely. Comparing Date.now() against the last
 * activity time on an interval + on focus avoids both problems.
 */
export function useInactivityTimer({ enabled, onWarning, onTimeout, warningMinutes = 25, timeoutMinutes = 30 }) {
  const WARNING_MS = Math.max(1, warningMinutes) * 60 * 1000;
  const TIMEOUT_MS = Math.max(2, timeoutMinutes) * 60 * 1000;
  const lastActivity = useRef(Date.now());
  const warned       = useRef(false);
  const checkTimer   = useRef(null);
  const pingInterval = useRef(null);

  // Called when the user explicitly chooses to stay logged in.
  const reset = useCallback(() => {
    lastActivity.current = Date.now();
    warned.current = false;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Record activity — but NOT while the warning is showing. Once warned, only
    // an explicit "I'm still here" (which calls reset) keeps the session alive.
    const onActivity = () => {
      if (warned.current) return;
      lastActivity.current = Date.now();
    };

    const check = () => {
      const elapsed = Date.now() - lastActivity.current;
      if (elapsed >= TIMEOUT_MS) {
        onTimeout();
      } else if (elapsed >= WARNING_MS && !warned.current) {
        warned.current = true;
        onWarning();
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));

    // When the tab regains focus/visibility, evaluate immediately so a session
    // that expired in the background is logged out right away.
    const onFocus = () => check();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    lastActivity.current = Date.now();
    warned.current = false;
    checkTimer.current = setInterval(check, CHECK_MS);

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity));
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(checkTimer.current);
    };
  }, [enabled, onWarning, onTimeout, WARNING_MS, TIMEOUT_MS]);

  // Keep the backend session alive while the user is active
  useEffect(() => {
    if (!enabled) return;
    pingInterval.current = setInterval(() => {
      api.post('/sessions/ping').catch(() => {});
    }, PING_MS);
    return () => clearInterval(pingInterval.current);
  }, [enabled]);

  return { reset };
}
