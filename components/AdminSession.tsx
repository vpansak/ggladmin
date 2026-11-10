'use client';
import { createContext, useContext, useRef, useState } from 'react';
import AdminOtpLogin from './AdminOtpLogin';
import { useLiveRefresh } from '@/lib/useLiveRefresh';
type PortalData = { performers: any[]; sponsors: any[]; team: any[]; guests: any[]; talentTripCount: number };
const Context = createContext<PortalData | null>(null);
export function useAdminData() {
  const value = useContext(Context);
  if (!value) throw new Error('Admin session is required');
  return value;
}
export default function AdminSession({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [status, setStatus] = useState<'loading' | 'signed-out' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const fingerprint = useRef('');
  const generation = useRef(0);
  const refresh = async () => {
    const current = generation.current;
    try {
      const response = await fetch('/api/malik/applications?type=all', { cache: 'no-store', signal: AbortSignal.timeout(20000) });
      if (current !== generation.current) return;
      if (response.status === 401 || response.status === 403) {
        setData(null); fingerprint.current = ''; setStatus('signed-out'); return;
      }
      const json = await response.json();
      if (!response.ok || !json.success || !json.data) throw new Error('Unable to refresh applications.');
      const tripResponse = await fetch('/api/ggl-talent-trip', { cache: 'no-store', signal: AbortSignal.timeout(20000) });
      if (current !== generation.current) return;
      if (tripResponse.status === 401 || tripResponse.status === 403) {
        setData(null); fingerprint.current = ''; setStatus('signed-out'); return;
      }
      const trip = await tripResponse.json();
      if (!tripResponse.ok || !trip.success) throw new Error('Unable to refresh Talent Trip registrations.');
      const next = { ...json.data, talentTripCount: trip.registrations.length };
      const encoded = JSON.stringify(next);
      if (encoded !== fingerprint.current) { fingerprint.current = encoded; setData(next); }
      setError(''); setStatus('ready');
    } catch {
      if (current !== generation.current) return;
      setError('Live updates are temporarily unavailable. Reconnecting…');
      setStatus(previous => previous === 'ready' ? previous : 'error');
    }
  };
  useLiveRefresh(refresh, status !== 'signed-out');
  if (status === 'signed-out') return <AdminOtpLogin onSuccess={() => {
    generation.current += 1; setStatus('loading'); void refresh();
  }} />;
  if (!data) return <main className="flex min-h-[85vh] items-center justify-center px-4 text-center"><div><p className="font-bold text-amber-300">{error || 'Opening Admin Portal…'}</p>{error && <button className="mt-4 rounded-xl border border-amber-400/30 px-5 py-3" onClick={() => void refresh()}>Retry</button>}</div></main>;
  return <Context.Provider value={data}>{error && <p role="status" className="border-b border-amber-400/20 bg-amber-400/10 px-4 py-2 text-center text-xs text-amber-200">{error}</p>}{children}</Context.Provider>;
}
