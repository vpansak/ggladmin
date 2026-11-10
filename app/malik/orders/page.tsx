'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useLiveRefresh } from '@/lib/useLiveRefresh';
import { 
  TrendingUp, 
  Search, 
  ArrowLeft, 
  Loader2, 
  RefreshCw, 
  Ticket as TicketIcon, 
  QrCode as QrIcon, 
  CheckCircle2, 
  AlertTriangle, 
  Camera, 
  Download, 
  ShieldCheck, 
  Check, 
  X,
  Plus,
  Trash2
} from 'lucide-react';
import TicketCard from '@/components/TicketCard';
import { getTicketQuantity } from '@/lib/ticketQuantity';
import { TicketRecord } from '@/lib/ticketTypes';

export default function OrdersLedgerPage() {
  const [search, setSearch] = useState('');
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [stats, setStats] = useState({
    totalBooked: 0,
    todayBookings: 0,
    paidTickets: 0,
    pendingOrFailed: 0,
    checkedIn: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(false);

  // Selected Ticket for Modal View
  const [selectedTicket, setSelectedTicket] = useState<TicketRecord | null>(null);

  // QR Scanner & Manual Lookup State
  const [showScanner, setShowScanner] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanResultMsg, setScanResultMsg] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async (query = '', quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch(`/api/tickets/search?q=${encodeURIComponent(query || search)}`);
      const data = await res.json();
      if (data.success) {
        setTickets(data.tickets || []);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useLiveRefresh(() => fetchTickets(search, true));

  // Handle Admin Check-In Action
  const handleCheckIn = async (ticketId: string) => {
    try {
      const res = await fetch('/api/tickets/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, code: '11' }),
      });
      const data = await res.json();
      setScanResultMsg(data.message || 'Check-in processed.');
      fetchTickets();
      if (selectedTicket && selectedTicket.ticket_id === ticketId && data.ticket) {
        setSelectedTicket(data.ticket);
      }
    } catch (err) {
      setScanResultMsg('Check-in failed due to network error.');
    }
  };

  // Handle Admin Delete Ticket Action
  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm(`⚠️ PERMANENT DELETE WARNING:\n\nAre you sure you want to delete ticket "${ticketId}" from the database?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/tickets/delete?ticketId=${encodeURIComponent(ticketId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        alert(`✓ Ticket ${ticketId} deleted successfully.`);
        if (selectedTicket && selectedTicket.ticket_id === ticketId) {
          setSelectedTicket(null);
        }
        fetchTickets();
      } else {
        alert(data.error || 'Failed to delete ticket.');
      }
    } catch (err) {
      alert('Network error occurred while deleting ticket.');
    }
  };

  // Start Camera Stream
  const startCamera = async () => {
    setShowScanner(true);
    setScanResultMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      alert('Unable to open mobile camera. Please use manual Ticket ID input.');
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Export CSV Ledger
  const handleExportCSV = () => {
    if (tickets.length === 0) return alert('No ticket records to export.');
    
    const headers = ['Ticket ID', 'Customer Name', 'Mobile', 'Email', 'Instagram ID', 'Quantity', 'Amount', 'Razorpay ID', 'Payment Status', 'Entry Status', 'Checked In At', 'Created At'];
    const rows = tickets.map(t => [
      t.ticket_id,
      `"${t.customer_name.replace(/"/g, '""')}"`,
      t.mobile,
      t.email,
      t.instagram_id,
      t.quantity,
      t.amount,
      t.razorpay_payment_id || t.razorpay_order_id || 'N/A',
      t.payment_status,
      t.checked_in === 1 ? 'USED' : 'NOT USED',
      t.checked_in_at ? new Date(t.checked_in_at).toLocaleString('en-IN') : '',
      t.created_at ? new Date(t.created_at).toLocaleString('en-IN') : '',
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `GGL_Tickets_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#07080e] text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <Link href="/malik" className="text-xs text-amber-400 hover:underline flex items-center gap-1 mb-1 font-bold">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          <h1 className="font-bebas text-3xl sm:text-4xl text-white uppercase tracking-wide flex items-center gap-3">
            <TicketIcon className="w-8 h-8 text-amber-400" /> BOOK TICKET & GATE CONTROL MODULE
          </h1>
          <p className="text-xs text-slate-400">
            Direct ticket management, attendee lookup, QR scanner verification & check-in controller.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/invitebyus"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-barlow font-black text-xs uppercase flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>INVITE BY US</span>
          </Link>
          <Link
            href="https://www.gkpgotlatent.in/book-ticket"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-black font-barlow font-black text-xs uppercase flex items-center gap-1.5 shadow-[0_0_20px_rgba(255,215,0,0.3)]"
          >
            <Plus className="w-4 h-4 text-black" />
            <span>BOOK NEW TICKET</span>
          </Link>

          <Link
            href="/verifyticket"
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-barlow font-black text-xs uppercase flex items-center gap-1.5 shadow-[0_0_20px_rgba(168,85,247,0.3)]"
          >
            <Camera className="w-4 h-4 text-white" />
            <span>OPEN QR SCANNER</span>
          </Link>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase flex items-center gap-1.5 border border-slate-700"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => fetchTickets()}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">TOTAL BOOKED</div>
          <div className="font-bebas text-3xl text-amber-400 mt-1">{stats.totalBooked}</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">TODAY'S BOOKINGS</div>
          <div className="font-bebas text-3xl text-amber-300 mt-1">{stats.todayBookings}</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">PAID TICKETS</div>
          <div className="font-bebas text-3xl text-emerald-400 mt-1">{stats.paidTickets}</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">PENDING / FAILED</div>
          <div className="font-bebas text-3xl text-red-400 mt-1">{stats.pendingOrFailed}</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">CHECKED IN</div>
          <div className="font-bebas text-3xl text-amber-300 mt-1">{stats.checkedIn}</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">TOTAL REVENUE</div>
          <div className="font-bebas text-3xl text-emerald-400 mt-1">₹{stats.totalRevenue}</div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchTickets(search)}
            placeholder="Search by Ticket ID (GGLT123456), Customer Name, Mobile, Email, Instagram ID, Razorpay ID..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-amber-500 transition-all"
          />
        </div>
        <button
          onClick={() => fetchTickets(search)}
          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase"
        >
          Search
        </button>
      </div>

      {/* TICKETS TABLE LEDGER */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
            <div className="text-xs font-bold uppercase">Loading Ticket Records...</div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <TicketIcon className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="text-sm font-bold text-white uppercase">No Ticket Records Found</div>
            <p className="text-xs text-slate-500">Book new tickets using the /book-ticket page.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800">
                <tr>
                  <th className="p-4">Ticket ID</th>
                  <th className="p-4">Customer Name</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4">Instagram</th>
                  <th className="p-4">Tickets / People</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Razorpay ID</th>
                  <th className="p-4">Payment</th>
                  <th className="p-4">Entry Status</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                {tickets.map((tck) => (
                  <tr key={tck.ticket_id} className="hover:bg-slate-900/50 transition-colors">
                    
                    {/* Ticket ID */}
                    <td className="p-4 font-mono font-black text-amber-400">
                      {tck.ticket_id}
                    </td>

                    {/* Customer Name */}
                    <td className="p-4 font-bold text-white">
                      {tck.customer_name}
                    </td>

                    {/* Contact */}
                    <td className="p-4 space-y-0.5">
                      <div className="font-mono text-slate-200">{tck.mobile}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[150px]">{tck.email}</div>
                    </td>

                    {/* Instagram */}
                    <td className="p-4 font-bold text-pink-400">
                      {tck.instagram_id}
                    </td>

                    <td className="p-4 font-black text-amber-300 whitespace-nowrap">
                      TICKETS × {getTicketQuantity(tck.quantity)}
                      <div className="text-[11px] text-slate-300">{getTicketQuantity(tck.quantity)} {getTicketQuantity(tck.quantity) === 1 ? 'person' : 'people'}</div>
                    </td>

                    {/* Amount */}
                    <td className="p-4 font-bold text-white font-mono">
                      ₹{tck.amount}
                    </td>

                    {/* Razorpay ID */}
                    <td className="p-4 font-mono text-[11px] text-amber-300">
                      {tck.razorpay_payment_id || tck.razorpay_order_id || 'N/A'}
                    </td>

                    {/* Payment Status */}
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full font-black text-[10px] uppercase ${
                        tck.payment_status === 'PAID' ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/40' : 'bg-red-950 text-red-400 border border-red-500/40'
                      }`}>
                        {tck.payment_status}
                      </span>
                    </td>

                    {/* Entry Status */}
                    <td className="p-4 space-y-1">
                      <span className={`px-2.5 py-1 rounded-full font-black text-[10px] uppercase block w-max ${
                        tck.checked_in === 1 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {tck.checked_in === 1 ? 'USED / ENTERED' : 'NOT USED'}
                      </span>
                      {tck.checked_in === 1 && tck.checked_in_at && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date(tck.checked_in_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </td>

                    {/* Action */}
                    <td className="p-4 text-center flex items-center justify-center gap-2">
                      <button
                        onClick={() => setSelectedTicket(tck)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-[11px] uppercase transition-all"
                      >
                        View Ticket
                      </button>

                      {tck.checked_in !== 1 && (
                        <button
                          onClick={() => handleCheckIn(tck.ticket_id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] uppercase transition-all"
                        >
                          Check In
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteTicket(tck.ticket_id)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-600 border border-red-500/50 text-red-300 hover:text-white font-bold text-[11px] uppercase transition-all flex items-center gap-1"
                        title="Delete Ticket"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SELECTED TICKET MODAL VIEW */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#07080e] border border-amber-500/50 rounded-3xl max-w-4xl w-full p-6 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="font-bebas text-2xl text-white uppercase flex items-center gap-2">
                <TicketIcon className="w-5 h-5 text-amber-400" /> TICKET DETAILS — {selectedTicket.ticket_id}
              </h3>
              <button onClick={() => setSelectedTicket(null)} className="p-2 text-slate-400 hover:text-white rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            <TicketCard ticket={selectedTicket} showActions={true} />

            <div className="flex flex-wrap justify-between items-center gap-3 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-3">
                {selectedTicket.checked_in !== 1 ? (
                  <button
                    onClick={() => handleCheckIn(selectedTicket.ticket_id)}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider"
                  >
                    ✓ CHECK IN {getTicketQuantity(selectedTicket.quantity)} {getTicketQuantity(selectedTicket.quantity) === 1 ? 'PERSON' : 'PEOPLE'}
                  </button>
                ) : (
                  <div className="text-xs text-amber-300 font-bold">
                    ✓ Attendees checked in at {selectedTicket.checked_in_at || 'Earlier'}
                  </div>
                )}

                <button
                  onClick={() => handleDeleteTicket(selectedTicket.ticket_id)}
                  className="px-5 py-2.5 rounded-xl bg-red-600/80 hover:bg-red-600 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>DELETE TICKET</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedTicket(null)}
                className="px-6 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs uppercase"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
