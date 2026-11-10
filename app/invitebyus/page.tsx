'use client';

import { useState } from 'react';
import { Ticket as TicketIcon, UserRoundPlus, CheckCircle2, AlertCircle } from 'lucide-react';
import TicketCard from '@/components/TicketCard';
import { TicketRecord } from '@/lib/ticketTypes';

export default function InviteByUsPage() {
  const [unlocked,setUnlocked] = useState(false);
  const [password,setPassword] = useState('');
  const [name,setName] = useState('');
  const [mobile,setMobile] = useState('');
  const [quantity,setQuantity] = useState(1);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [ticket,setTicket] = useState<TicketRecord|null>(null);

  async function unlockPage(e: React.FormEvent) { e.preventDefault(); if (password === '1100') { setUnlocked(true); setError(''); } else { setError('Incorrect password'); } }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault(); setError(''); setTicket(null);
    const normalizedMobile = mobile.trim();
    if (!name.trim() || !/^\+?[0-9\s()-]{10,16}$/.test(normalizedMobile) || normalizedMobile.replace(/\D/g, '').length < 10 || normalizedMobile.replace(/\D/g, '').length > 15) { setError('Naam aur valid mobile number bhariye.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/malik/invite-ticket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),mobile:mobile.trim(),quantity})});
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Ticket nahi ban paya.');
      setTicket(data.ticket);
    } catch (err:any) { setError(err.message || 'Something went wrong.'); }
    finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-[#07080d] text-white px-4 py-8 sm:px-8">
    <div className="max-w-4xl mx-auto space-y-7">
      {!unlocked ? <section className="max-w-md mx-auto mt-16 rounded-3xl border border-amber-400/30 bg-slate-900/80 p-7 space-y-5"><div className="text-center"><TicketIcon className="mx-auto text-amber-300" size={36}/><h1 className="text-2xl font-black mt-3">Restricted Access</h1><p className="text-slate-400 text-sm mt-2">Enter password to open Invite by Us.</p></div><form onSubmit={unlockPage} className="space-y-4"><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Enter password" className="w-full rounded-xl bg-black/40 border border-white/15 px-4 py-3"/>{error&&<p className="text-red-300 text-sm">{error}</p>}<button className="w-full rounded-xl bg-amber-400 text-black font-black py-3">Unlock Page</button></form><a href="/malik/orders" className="block text-center text-amber-300 text-sm">← Back to Admin Ticket Management</a></section> : <>
      <a href="/malik/orders" className="text-amber-300 text-sm font-bold">← Back to Admin Ticket Management</a>
      <header className="rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-950/50 to-slate-950 p-6 sm:p-8">
        <div className="flex items-center gap-3 text-amber-300"><TicketIcon/><span className="text-xs font-black tracking-[.2em]">GGL ADMIN INVITATION</span></div>
        <h1 className="text-3xl sm:text-4xl font-black mt-3">Invite by Us</h1>
        <p className="text-slate-300 mt-2">Guest ka naam aur mobile number daal kar complimentary event ticket banayein. Payment required nahi hai.</p>
      </header>
      <form onSubmit={createTicket} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 sm:p-6 space-y-4">
        <label className="block text-sm font-bold">Guest Full Name<input value={name} onChange={e=>setName(e.target.value)} required maxLength={100} placeholder="Guest ka poora naam" className="mt-2 w-full rounded-xl bg-black/40 border border-white/15 px-4 py-3 outline-none focus:border-amber-400"/></label>
        <label className="block text-sm font-bold">Mobile Number<input value={mobile} onChange={e=>setMobile(e.target.value)} required inputMode="tel" maxLength={16} placeholder="10-digit mobile number" className="mt-2 w-full rounded-xl bg-black/40 border border-white/15 px-4 py-3 outline-none focus:border-amber-400"/></label>
        <label className="block text-sm font-bold">Tickets / People<select value={quantity} onChange={e=>setQuantity(Number(e.target.value))} className="mt-2 w-full rounded-xl bg-slate-950 border border-white/15 px-4 py-3">{Array.from({length:10},(_,i)=>i+1).map(count=><option key={count} value={count}>{count} {count===1?'person':'people'}</option>)}</select></label>
        {error && <p className="text-red-300 text-sm flex items-center gap-2"><AlertCircle size={16}/>{error}</p>}
        <button disabled={loading} className="w-full rounded-xl bg-amber-400 text-black font-black py-3.5 flex items-center justify-center gap-2 disabled:opacity-60"><UserRoundPlus size={18}/>{loading?'Creating ticket…':'Create Complimentary Ticket'}</button>
      </form>
      {ticket && <section className="space-y-3"><div className="flex items-center gap-2 text-emerald-300 font-bold"><CheckCircle2/> Ticket created and added to Admin Ticket Management.</div><TicketCard ticket={ticket}/></section>}
      </>}
    </div>
  </main>;
}