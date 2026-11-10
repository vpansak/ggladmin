'use client';

import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import { 
  ShieldCheck, 
  Ticket as TicketIcon, 
  QrCode as QrIcon, 
  Lock, 
  CheckCircle2, 
  Download, 
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { TicketRecord } from '@/lib/ticketTypes';
import { getTicketQuantity } from '@/lib/ticketQuantity';
import TicketAdmissionSummary from '@/components/TicketAdmissionSummary';
import { EPISODE_2 } from '@/lib/episode2';

const GGL_MASCOT_DATA = "/ggl-mascot.jpg";

interface TicketCardProps {
  ticket: TicketRecord;
  showActions?: boolean;
}

export default function TicketCard({ ticket, showActions = true }: TicketCardProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const ticketRef = useRef<HTMLDivElement>(null);
  const [ticketImage,setTicketImage]=useState('');
  const [imageError,setImageError]=useState('');
  useEffect(()=>{let active=true;let url='';setTicketImage('');setImageError('');
    fetch('/api/tickets/image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId:ticket.ticket_id,token:ticket.qr_token})}).then(async res=>{if(!res.ok)throw new Error('Ticket image unavailable. Please reload.');url=URL.createObjectURL(await res.blob());if(active)setTicketImage(url);else URL.revokeObjectURL(url);}).catch(error=>{if(active)setImageError(error.message);});
    return()=>{active=false;if(url)URL.revokeObjectURL(url);};
  },[ticket.ticket_id,ticket.qr_token]);

  useEffect(() => {
    async function generateQr() {
      try {
        const verifyUrl = `https://gkpgotlatent.in/ticket/verify/${ticket.ticket_id}`;
        const url = await QRCode.toDataURL(verifyUrl, {
          width: 250,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        setQrCodeDataUrl(url);
      } catch (err) {
        console.warn('QR Code generation notice:', err);
      }
    }
    generateQr();
  }, [ticket]);

  const [downloading, setDownloading] = useState(false);
  const [deliveryEmail, setDeliveryEmail] = useState(ticket.email === 'attendee@gkpgotlatent.in' ? '' : ticket.email || '');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  useEffect(() => {setDeliveryEmail(ticket.email === 'attendee@gkpgotlatent.in' ? '' : ticket.email || '');setEmailMessage('');}, [ticket.ticket_id, ticket.email]);
  const sendEmail = async (event: React.FormEvent) => {
    event.preventDefault(); if(emailBusy)return;setEmailBusy(true);setEmailMessage('');
    try {
      const res=await fetch('/api/tickets/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId:ticket.ticket_id,token:ticket.qr_token,email:deliveryEmail})});
      const json=await res.json();if(!res.ok)throw new Error(json.error||'Unable to email ticket');setEmailMessage(json.message);
    } catch(error:any){setEmailMessage(error.message||'Please try again.');}finally{setEmailBusy(false);}
  };
  const downloadPdf = async () => {
    try {
      const res=await fetch('/api/tickets/pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticketId:ticket.ticket_id,token:ticket.qr_token})});
      if(!res.ok)throw new Error('Unable to download PDF');
      const url=URL.createObjectURL(await res.blob());const a=document.createElement('a');a.href=url;a.download=`GGL-Ticket-${ticket.ticket_id}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
    }catch(error:any){setEmailMessage(error.message);}
  };

  const handleDownloadImage = async () => {
    if(!ticketImage)return;
    const link=document.createElement('a');link.download=`GGL-Ticket-${ticket.ticket_id}.png`;link.href=ticketImage;link.click();
  };

  const quantity = getTicketQuantity(ticket.quantity);
  const formattedAmount = `₹${ticket.amount ?? 0}`;
  const formattedCreated = ticket.created_at 
    ? new Date(ticket.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : '03 October 2026';

  return (
    <div className="space-y-4 w-full">
      {/* Demo Badge Banner if ticket is sample demo */}
      {ticket.is_demo && (
        <div className="bg-amber-500/20 border border-amber-500/50 rounded-2xl p-2.5 text-center flex items-center justify-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>SAMPLE DEMO TICKET PREVIEW — FOR DEVELOPMENT & PREVIEW ONLY</span>
        </div>
      )}

      {ticketImage && <img src={ticketImage} alt={`GGL Episode 3 ticket ${ticket.ticket_id}, admits ${quantity} people`} className="mx-auto w-full max-w-4xl rounded-2xl" />}
      {imageError && <p role="status" className="text-center text-red-300">{imageError}</p>}
      {/* SLEEK WIDE GGL TICKET PASS */}
      <div hidden={Boolean(ticketImage)} ref={ticketRef} className="relative w-full max-w-4xl mx-auto overflow-hidden rounded-[20px] border-2 border-amber-400/80 bg-[#08080b] text-white shadow-[0_15px_50px_rgba(0,0,0,0.7)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_50%,rgba(255,190,30,0.15),transparent_35%),radial-gradient(circle_at_85%_50%,rgba(180,0,0,0.2),transparent_40%),linear-gradient(115deg,#0c0607,#08080b_50%,#110906)]" />
        
        <div className="relative flex flex-col md:flex-row items-stretch min-h-[200px]">
          
          {/* 1. LEFT STUB: LOGO & MASCOT ARTWORK ("lest me logo") */}
          <div className="w-full md:w-[160px] lg:w-[180px] p-3 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-dashed border-amber-400/40 bg-gradient-to-b from-amber-950/50 via-black to-slate-950 shrink-0 text-center">
            <div className="relative w-full h-[100px] sm:h-[110px] rounded-xl overflow-hidden border border-amber-400/50 shadow-[0_0_20px_rgba(255,190,30,0.3)] bg-black/60 p-1 flex items-center justify-center my-auto">
              <img src={GGL_MASCOT_DATA} alt="GGL Mascot" className="w-full h-full object-contain" />
            </div>

            <div className="space-y-0.5 mt-1.5">
              <div className="text-[10px] font-black tracking-[0.2em] text-amber-300 uppercase font-barlow">LIVE EVENT TICKET</div>
              <div className="text-[11px] font-bold text-slate-200">KUCH BHI HO SAKTA HAI!</div>
            </div>
          </div>

          {/* 2. CENTER MAIN: ATTENDEE & TICKET DETAILS ("bech me details") */}
          <div className="flex-1 min-w-0 p-3 flex flex-col justify-between space-y-2">
            {/* Header Title */}
            <div className="flex items-center justify-between gap-2 border-b border-amber-400/20 pb-2">
              <div>
                <div className="text-[9px] sm:text-[10px] tracking-[0.25em] text-amber-300 font-black uppercase font-barlow">Official Admission Pass</div>
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white uppercase font-bebas leading-none mt-0.5">
                  GORAKHPUR&apos;S <span className="text-amber-300">GOT LATENT</span>
                </h2>
                <p className="text-[9px] tracking-[0.2em] text-slate-400 mt-0.5 uppercase">Talent • Comedy • Roast • Vibes</p>
              </div>

              <div className="shrink-0 w-8 h-8 rounded-lg bg-black/50 border border-amber-400/30 p-1.5">
                <img src="/ggl-logo.png" alt="GGL" className="w-full h-full object-contain" />
              </div>
            </div>

            <TicketAdmissionSummary quantity={quantity} compact />

            {/* Attendee Info Grid (Clean 2-Column Specs) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-xs my-0.5">
              <div>
                <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">NAME</div>
                <div className="min-w-0 whitespace-normal break-words [overflow-wrap:anywhere] font-extrabold text-white text-xs sm:text-sm leading-snug">{ticket.customer_name}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">TICKET ID</div>
                <div className="font-black font-mono text-amber-300 text-xs sm:text-sm leading-tight">{ticket.ticket_id}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">MOBILE</div>
                <div className="font-bold text-slate-200 text-xs leading-tight">{ticket.mobile}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">TOTAL PRICE</div>
                <div className="font-black text-amber-300 text-xs sm:text-sm leading-tight">{formattedAmount}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">EMAIL</div>
                <div className="font-semibold text-slate-300 text-[11px] truncate max-w-[170px] leading-tight">{ticket.email}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">BOOKING DATE</div>
                <div className="font-semibold text-slate-300 text-[11px] leading-tight">{formattedCreated}</div>
              </div>
            </div>

            <div className="border-t border-amber-400/20 pt-2 text-[10px] leading-4 text-slate-200">
              <p className="font-bold text-amber-200">EPISODE 3</p>
              <p>Date, time &amp; venue: official updates coming soon.</p>
            </div>
            {/* Footer Status Badges */}
            <div className="flex flex-wrap items-center gap-2 border-t border-amber-400/20 pt-2">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[9px] font-black uppercase font-barlow">
                {ticket.payment_status || 'PAID'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase font-barlow ${ticket.checked_in === 1 ? 'bg-amber-400 text-black' : 'bg-white/10 text-slate-300'}`}>
                {ticket.checked_in === 1 ? 'CHECKED IN' : 'NOT CHECKED IN'}
              </span>
            </div>
          </div>

          {/* 3. RIGHT STUB: QR CODE & TICKET CODE ("right me qr aur code") */}
          <div className="w-full md:w-[150px] lg:w-[160px] p-3 flex flex-col items-center justify-between border-t md:border-t-0 md:border-l border-dashed border-amber-400/40 bg-black/50 shrink-0 text-center">
            <div className="space-y-0.5">
              <div className="text-amber-300 text-[10px] font-black tracking-[0.25em] uppercase font-barlow">ADMIT {quantity} {quantity === 1 ? 'PERSON' : 'PEOPLE'}</div>
              <div className="text-[8px] text-slate-400 tracking-widest uppercase">SCAN AT VENUE</div>
            </div>

            <div className="my-1.5 p-1.5 bg-white rounded-2xl border-2 border-amber-400 shadow-[0_0_20px_rgba(255,190,30,0.25)] inline-block">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt={`QR Code for Ticket ${ticket.ticket_id}`} className="w-20 h-20 sm:w-24 sm:h-24 object-contain" />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-200 rounded-xl animate-pulse" />
              )}
            </div>

            <div className="w-full space-y-1">
              <div className="font-mono font-black text-amber-300 text-xs sm:text-sm tracking-wider">{ticket.ticket_id}</div>
              <div className="h-3.5 flex gap-[2px] justify-center opacity-80">
                {Array.from({length: 22}).map((_,i)=>(
                  <span key={i} className="bg-amber-300" style={{width: i%4===0 ? 3 : 1, height: '100%'}} />
                ))}
              </div>
              <div className="text-[8px] text-slate-400 tracking-[0.18em] uppercase">18+ • QR VERIFIED ENTRY</div>
            </div>
          </div>

        </div>
      </div>

      {showActions && <div className="mx-auto w-full max-w-xl space-y-3 print:hidden">
        <button onClick={downloadPdf} className="w-full rounded-xl border border-amber-400 px-5 py-3 font-bold text-amber-300">Download ticket PDF</button>
        <form onSubmit={sendEmail} className="space-y-2 rounded-xl border border-slate-700 bg-slate-900 p-4">
          <label htmlFor={`ticket-email-${ticket.ticket_id}`} className="block text-sm font-bold text-white">Send ticket PDF to email</label>
          <input id={`ticket-email-${ticket.ticket_id}`} type="email" required maxLength={254} value={deliveryEmail} onChange={event=>setDeliveryEmail(event.target.value)} placeholder="Your email address" className="w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-white" />
          <button disabled={emailBusy} className="w-full rounded-lg bg-amber-400 p-3 font-bold text-black disabled:opacity-50">{emailBusy?'Sending…':'Send to email'}</button>
          {emailMessage && <p role="status" className="text-sm text-slate-200">{emailMessage}</p>}
        </form>
      </div>}
      {/* ACTION BUTTONS: VIEW / DOWNLOAD / PRINT */}
      {showActions && (
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2 print:hidden">
          <button
            disabled={!ticketImage} onClick={handleDownloadImage}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-xl hover:scale-105 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'GENERATING IMAGE...' : 'DOWNLOAD TICKET IMAGE'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
