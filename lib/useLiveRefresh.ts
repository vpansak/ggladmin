'use client';
import { useEffect, useRef } from 'react';
export function useLiveRefresh(refresh: () => Promise<void>, enabled = true) {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    let stopped = false, busy = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      if (stopped || busy) return;
      clearTimeout(timer);
      if (document.visibilityState === 'visible' && navigator.onLine) {
        busy = true;
        const started = Date.now();
        try { await latest.current(); } catch {} finally {
          busy = false;
          if (!stopped) timer = setTimeout(run, Math.max(0, 1000 - (Date.now() - started)));
        }
      } else timer = setTimeout(run, 1000);
    };
    void run();
    document.addEventListener('visibilitychange', run);
    window.addEventListener('online', run);
    return () => {
      stopped = true; clearTimeout(timer);
      document.removeEventListener('visibilitychange', run);
      window.removeEventListener('online', run);
    };
  }, [enabled]);
}
