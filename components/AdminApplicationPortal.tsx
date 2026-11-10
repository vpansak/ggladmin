'use client';
import { whatsappNumber } from '@/lib/phone';

import { createPortal } from 'react-dom';
import { performerDetailFields, hasVerifiedPerformerPayment, canEditManualPerformerPayment, combinedStageIntroduction } from '@/lib/performerDetailsFields';
import React, { useState, useEffect, useMemo } from 'react';
import { useLiveRefresh } from '@/lib/useLiveRefresh';
import Link from 'next/link';
import {
  FileSpreadsheet, Download, RefreshCw, Search, Phone, MessageSquare,
  Eye, CheckCircle2, ShieldCheck, UserCheck, Users, Briefcase, Award,
  ExternalLink, Filter, Sparkles, Check, ChevronRight, X, Clock, HelpCircle,
  FileText, Sliders, Calculator, Copy, Mail, RotateCcw, CreditCard, CheckCheck, Trash2,
  Ticket as TicketIcon
} from 'lucide-react';
import { downloadCategoryExcel, downloadMasterExcel } from '@/lib/excel-export';


interface AdminApplicationPortalProps {
  initialData: {
    performers: any[];
    sponsors: any[];
    team: any[];
    guests: any[];
    talentTripCount?: number;
  };
}

type TabType = 'performer' | 'sponsor' | 'team' | 'guest' | 'computerji' | 'leads';

export default function AdminApplicationPortal({ initialData }: AdminApplicationPortalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('performer');
  const [data, setData] = useState(initialData);
  useEffect(() => { setData(initialData); }, [initialData]);
  const [computerJiScores, setComputerJiScores] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [ticketStats, setTicketStats] = useState({ totalBooked: 0, paidTickets: 0 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [detailFilter, setDetailFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [readFilter, setReadFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');

  // Modal State
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [exportingMaster, setExportingMaster] = useState(false);

  useEffect(() => {
    if (!selectedItem) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [Boolean(selectedItem)]);

  const handleSendDetailForm = async (item: any) => {
    const waTab = window.open('about:blank', '_blank');
    if (!waTab) { window.alert('Please allow pop-ups to open WhatsApp.'); return; }
    waTab.document.title = 'Preparing performer form…';
    try {
      const res = await fetch('/api/malik/performer-details', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appId: item.app_id }) });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Could not create form link');
      waTab.location.href = result.whatsappUrl;
    } catch (error: any) { waTab.close(); window.alert(error.message || 'Unable to prepare form'); }
  };

  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [manualPaymentItem, setManualPaymentItem] = useState<any | null>(null);
  const [editingManualPayment, setEditingManualPayment] = useState(false);
  const [manualPaymentStatus, setManualPaymentStatus] = useState('PAID');
  const [manualPaymentMethod, setManualPaymentMethod] = useState('');
  const [manualCorrectionReason, setManualCorrectionReason] = useState('');
  const [manualAmount, setManualAmount] = useState('799');
  const [manualReference, setManualReference] = useState('');
  const [manualConfirmed, setManualConfirmed] = useState(false);
  const [manualPaymentError, setManualPaymentError] = useState('');
  const openManualPayment = (item: any, editing = false) => {
    setEditingManualPayment(editing);
    setManualPaymentStatus('PAID');
    setManualPaymentMethod(editing ? item.manual_payment_method || '' : '');
    setManualCorrectionReason('');
    setManualAmount(editing ? String(item.payment_amount) : '799');
    setManualReference(editing ? item.manual_payment_reference || '' : '');
    setManualConfirmed(false);
    setManualPaymentError('');
    setManualPaymentItem(item);
  };
  const handleMarkPaid = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manualPaymentItem || markingPaid) return;
    const amount = Number(manualAmount);
    if ((manualPaymentStatus === 'PAID' && (!Number.isFinite(amount) || amount <= 0 || amount > 1000000 || !manualReference.trim())) || !manualConfirmed || (editingManualPayment && !manualCorrectionReason.trim())) {
      setManualPaymentError('Enter a valid amount and UTR/reference, then confirm receipt.');
      return;
    }
    setMarkingPaid(manualPaymentItem.app_id);
    setManualPaymentError('');
    try {
      const res = await fetch('/api/malik/performer-payment/manual', { method: editingManualPayment ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appId: manualPaymentItem.app_id, amount, reference: manualReference.trim(), method: manualPaymentMethod, status: manualPaymentStatus, reason: manualCorrectionReason }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Unable to record payment');
      await refreshAllData();
      if (selectedItem?.app_id === manualPaymentItem.app_id) {
        const refreshed = await fetch('/api/malik/applications?type=performer');
        const latest = await refreshed.json();
        const updated = latest.items?.find((item: any) => item.app_id === manualPaymentItem.app_id);
        if (updated) setSelectedItem(updated);
      }
      setManualPaymentItem(null);
    } catch (error: any) { setManualPaymentError(error.message || 'Unable to record payment'); }
    finally { setMarkingPaid(null); }
  };

  // Fetch Computer Ji scores from API (with 10-day TTL auto-cleanup)
  const fetchComputerJiScores = async () => {
    try {
      const res = await fetch('/api/computerji/scores');
      const json = await res.json();
      if (json.success && json.data) {
        setComputerJiScores(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch computerji scores:', err);
    }
  };

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads');
      const json = await res.json();
      if (json.success && json.leads) {
        setLeads(json.leads);
      }
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    }
  };

  const handleDeleteLead = async (id: string, name: string) => {
    if (!confirm(`Kya aap ${name || 'is lead'} ko delete karna chahte hain?`)) return;
    try {
      const res = await fetch(`/api/leads?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setLeads((prev) => prev.filter((it) => it.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete lead:', err);
    }
  };


  const handleBulkDeleteLeads = async () => {
    if (selectedLeadIds.length === 0) return;
    const confirmed = confirm(
      'Kya aap ' + selectedLeadIds.length + ' selected lead(s) ko permanently DELETE karna chahte hain? Ye action undo nahi hoga.'
    );
    if (!confirmed) return;

    try {
      const res = await fetch('/api/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedLeadIds }),
      });
      const json = await res.json();
      if (json.success) {
        setLeads((prev) => prev.filter((it) => !selectedLeadIds.includes(it.id)));
        setSelectedLeadIds([]);
      } else {
        alert(json.error || 'Failed to delete selected leads');
      }
    } catch (err) {
      console.error('Failed to bulk delete leads:', err);
      alert('Error deleting selected leads');
    }
  };

  const toggleLeadSelection = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const toggleAllVisibleLeads = () => {
    const visibleIds = filteredItems.map((item) => item.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedLeadIds.includes(id));
    setSelectedLeadIds((prev) =>
      allSelected
        ? prev.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...prev, ...visibleIds]))
    );
  };

  const fetchTicketStats = async () => {
    try {
      const res = await fetch('/api/tickets/search');
      const json = await res.json();
      if (json.success && json.stats) {
        setTicketStats(json.stats);
      }
    } catch (err) {
      console.error('Failed to fetch ticket stats:', err);
    }
  };

  useEffect(() => {
    fetchComputerJiScores();
    fetchTicketStats();
  }, []);

  useLiveRefresh(async () => {
    await fetchTicketStats();
    if (activeTab === 'computerji') await fetchComputerJiScores();
    if (activeTab === 'leads') await fetchLeads();
  });

  // Keep performer payment badges current after a payer completes checkout.
  useEffect(() => {
    if (activeTab !== 'performer') return;
    let polling = false;
    const pollPayments = async () => {
      if (polling) return;
      polling = true;
      try {
        await fetch('/api/malik/performer-payment/reconcile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const res = await fetch('/api/malik/applications?type=performer');
        const json = await res.json();
        if (json.success && Array.isArray(json.items)) {
          setData((prev) => ({ ...prev, performers: json.items }));
        }
      } catch (err) { console.error('Failed to refresh performer payment status:', err); }
      finally { polling = false; }
    };
    pollPayments();
    const timer = window.setInterval(pollPayments, 5000);
    return () => window.clearInterval(timer);
  }, [activeTab]);

  // Fetch updated data from API
  const refreshAllData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/malik/applications?type=all');
      const json = await res.json();
      if (json.success && json.data) {
        setData((prev) => ({ ...prev, ...json.data }));
      }
      await fetchComputerJiScores();
      await fetchLeads();
    } catch (err) {
      console.error('Failed to refresh applications:', err);
    } finally {
      setLoading(false);
    }
  };

  // Delete single computerji score record
  const handleDeleteComputerJiScore = async (contestantId: number) => {
    if (!confirm(`Kya aap Contestant #${contestantId} ka score record delete karna chahte hain?`)) return;
    try {
      const res = await fetch(`/api/computerji/scores?id=${contestantId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setComputerJiScores((prev) => prev.filter((it) => it.contestant_id !== contestantId));
      }
    } catch (err) {
      console.error('Failed to delete computerji score:', err);
    }
  };

  // Toggle Read / Unread Status (Unread on top, Read on bottom)
  const handleToggleRead = async (item: any) => {
    const newReadState = !item.is_read;
    const appId = item.app_id || item.id;

    if (activeTab === 'leads') {
      setLeads((prev) => prev.map((it) => it.id === appId ? {
        ...it,
        is_read: newReadState ? 1 : 0,
        read_at: newReadState ? new Date().toISOString() : null,
      } : it));
      try {
        await fetch('/api/malik/mark-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'lead', id: appId, isRead: newReadState }),
        });
      } catch (err) {
        console.error('Failed to update lead read status:', err);
      }
      return;
    }

    // Optimistically update local state so row instantly moves
    setData((prev) => {
      const listKey = activeTab === 'performer' ? 'performers' : activeTab === 'sponsor' ? 'sponsors' : activeTab === 'team' ? 'team' : 'guests';
      const updated = ((prev as any)[listKey] || []).map((it: any) => {
        if ((it.app_id || it.id) === appId) {
          return {
            ...it,
            is_read: newReadState ? 1 : 0,
            read_at: newReadState ? new Date().toISOString() : null,
          };
        }
        return it;
      });
      return { ...prev, [listKey]: updated };
    });

    if (selectedItem && (selectedItem.app_id || selectedItem.id) === appId) {
      setSelectedItem((prev: any) => (prev ? { ...prev, is_read: newReadState ? 1 : 0 } : null));
    }

    try {
      await fetch('/api/malik/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activeTab,
          id: appId,
          isRead: newReadState,
        }),
      });
    } catch (err) {
      console.error('Failed to update read status:', err);
    }
  };

  // Permanently Delete Application (Performer, Sponsor, Team, Guest)
  const handleDeleteApplication = async (item: any) => {
    const appId = item.app_id || item.id;
    const name = item.full_name || item.company_name || item.stage_name || appId;
    if (!confirm(`Kya aap ${name} (${appId}) ki application permanently DELETE karna chahte hain?`)) return;

    try {
      const res = await fetch(`/api/malik/applications?type=${activeTab}&appId=${encodeURIComponent(appId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setData((prev) => {
          const listKey = activeTab === 'performer' ? 'performers' : activeTab === 'sponsor' ? 'sponsors' : activeTab === 'team' ? 'team' : 'guests';
          const updated = ((prev as any)[listKey] || []).filter((it: any) => (it.app_id || it.id) !== appId);
          return { ...prev, [listKey]: updated };
        });
        if (selectedItem && (selectedItem.app_id || selectedItem.id) === appId) {
          setSelectedItem(null);
        }
      } else {
        alert(json.error || 'Failed to delete application');
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      alert(`Error deleting application: ${err.message}`);
    }
  };

  // Copy Razorpay Payment ID to clipboard
  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Process Razorpay Refund
  const handleProcessRefund = async (appId: string, applicantName: string) => {
    const reason = prompt(
      `Razorpay Refund initiate karein ${applicantName} (${appId}) ke liye?\nReason enter karein (e.g. Slot not available / user requested refund):`,
      'Performer slots full refund'
    );
    if (!reason) return;

    setRefunding(true);
    try {
      const res = await fetch('/api/malik/applications/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId, refundReason: reason }),
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        alert(`✅ Refund Successful! Razorpay Refund ID: ${resData.refundId}`);
        refreshAllData();
        if (selectedItem && selectedItem.app_id === appId) {
          setSelectedItem((prev: any) =>
            prev
              ? {
                  ...prev,
                  status: 'REFUNDED',
                  payment_status: 'REFUNDED',
                  application_status: 'REFUNDED',
                  refund_id: resData.refundId,
                }
              : null
          );
        }
      } else {
        alert(`❌ Refund Failed: ${resData.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Error processing refund: ${err.message}`);
    } finally {
      setRefunding(false);
    }
  };

  // Get current list
  const currentList = useMemo(() => {
    if (activeTab === 'performer') return data.performers || [];
    if (activeTab === 'sponsor') return data.sponsors || [];
    if (activeTab === 'team') return data.team || [];
    if (activeTab === 'guest') return data.guests || [];
    if (activeTab === 'computerji') return computerJiScores || [];
    if (activeTab === 'leads') return leads || [];
    return [];
  }, [activeTab, data, computerJiScores, leads]);

  // Filter & Sort items: Unread at TOP (is_read = 0), Read at BOTTOM (is_read = 1)
  const filteredItems = useMemo(() => {
    const list = currentList.filter((item) => {
      // Leads custom search
      if (activeTab === 'leads') {
        if (readFilter === 'UNREAD' && item.is_read) return false;
        if (readFilter === 'READ' && !item.is_read) return false;
        if (statusFilter !== 'ALL' && (item.status || '') !== statusFilter) return false;
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const haystack = [
          item.customer_name, item.mobile, item.email, item.lead_code, item.source,
          ...(item.data ? Object.values(item.data) : [])
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      }

      // Computer Ji custom search
      if (activeTab === 'computerji') {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const name = (item.contestant_name || '').toLowerCase();
        const contact = (item.phone || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        const idStr = String(item.contestant_id || '');
        const resStr = (item.result || '').toLowerCase();
        return name.includes(q) || contact.includes(q) || cat.includes(q) || idStr.includes(q) || resStr.includes(q);
      }

      // Read filter
      if (readFilter === 'UNREAD') {
        if (item.is_read) return false;
      } else if (readFilter === 'READ') {
        if (!item.is_read) return false;
      }

      if (activeTab === 'performer' && detailFilter !== 'ALL' && Boolean(item.details_submitted_at) !== (detailFilter === 'FILLED')) return false;

      if (statusFilter !== 'ALL') {
        const verified = activeTab === 'performer' && hasVerifiedPerformerPayment(item);
        if (activeTab === 'performer' && ['PAID', 'UNPAID', 'PAYMENT_VERIFIED'].includes(statusFilter)) {
          if (statusFilter === 'UNPAID' ? verified : !verified) return false;
        } else if (![item.application_status, item.payment_status, item.status].includes(statusFilter)) return false;
      }

      // Search query (Email, Name, Phone, App ID, Razorpay ID)
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const email = (item.email || item.biz_email || '').toLowerCase();
        const name = (item.full_name || item.company_name || item.stage_name || '').toLowerCase();
        const contact = (item.mobile_number || item.whatsapp_number || item.whatsapp || item.phone || '').toLowerCase();
        const city = (item.city || item.location || item.address || '').toLowerCase();
        const appId = (item.app_id || item.id || '').toLowerCase();
        const paymentId = (item.payment_id || item.razorpay_payment_id || '').toLowerCase();
        const orderId = (item.order_id || item.razorpay_order_id || '').toLowerCase();
        const category = (item.performance_category || item.category || item.industry || item.sponsorship_type || '').toLowerCase();

        return (
          email.includes(q) ||
          name.includes(q) ||
          contact.includes(q) ||
          city.includes(q) ||
          appId.includes(q) ||
          paymentId.includes(q) ||
          orderId.includes(q) ||
          category.includes(q)
        );
      }

      return true;
    });

    if (activeTab === 'computerji') return list;

    // CRITICAL SORT: Unread (is_read=0 or null) on TOP, Read (is_read=1) on BOTTOM, then newest created_at
    return [...list].sort((a, b) => {
      // Performers who completed payment always appear first.
      if (activeTab === 'performer') {
        const aPaid = a.payment_status === 'PAID' || a.payment_status === 'PAYMENT_VERIFIED';
        const bPaid = b.payment_status === 'PAID' || b.payment_status === 'PAYMENT_VERIFIED';
        if (aPaid !== bPaid) return aPaid ? -1 : 1;
      }
      const aRead = a.is_read ? 1 : 0;
      const bRead = b.is_read ? 1 : 0;
      if (aRead !== bRead) return aRead - bRead;
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime;
    });
  }, [currentList, activeTab, statusFilter, detailFilter, readFilter, search]);

  // Counts
  const unreadCount = useMemo(() => {
    return currentList.filter((item) => !item.is_read).length;
  }, [currentList]);

  const readCount = useMemo(() => {
    return currentList.filter((item) => Boolean(item.is_read)).length;
  }, [currentList]);

  // Single Category Excel Download
  const handleDownloadExcel = () => {
    downloadCategoryExcel(filteredItems, activeTab);
  };

  // Master Workbook Download (All 4 sheets)
  const handleDownloadMaster = async () => {
    setExportingMaster(true);
    try {
      downloadMasterExcel(data);
    } catch (err) {
      console.error('Master export error:', err);
    } finally {
      setExportingMaster(false);
    }
  };

  // Open modal
  const handleOpenItem = (item: any) => {
    setSelectedItem(item);
    setNewStatus(item.application_status || item.status || 'UNDER_REVIEW');
    setNoteText('');
    setSaveSuccess(false);
  };

  // Save Status & Note
  const handleSaveStatus = async () => {
    if (!selectedItem) return;
    setSavingNote(true);
    try {
      const res = await fetch('/api/malik/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activeTab,
          appId: selectedItem.app_id,
          status: newStatus,
          note: noteText || undefined,
        }),
      });
      const resData = await res.json();
      if (resData.success) {
        setSaveSuccess(true);
        // Update local state
        setData((prev) => {
          const listKey = activeTab === 'performer' ? 'performers' : activeTab === 'sponsor' ? 'sponsors' : activeTab === 'team' ? 'team' : 'guests';
          const updated = ((prev as any)[listKey] || []).map((it: any) => {
            if (it.app_id === selectedItem.app_id) {
              return { ...it, status: newStatus, application_status: newStatus };
            }
            return it;
          });
          return { ...prev, [listKey]: updated };
        });
        setTimeout(() => setSaveSuccess(false), 2500);
      } else {
        alert(resData.error || 'Failed to update status');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating application status');
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PERMANENT ARCHIVE ASSURANCE BANNER */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-amber-950/30 border border-emerald-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <span>Episode 3 · Fresh Website View</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold uppercase">
                100% Secure & Permanent
              </span>
            </h4>
            <p className="text-xs text-slate-300 mt-0.5">
              Sabhi performer, sponsor, team aur judge applications Neon PostgreSQL database me permanently saved hain. Koi bhi data delete nahi kiya jayega.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <a href="/api/malik/episode-backup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-black hover:bg-amber-300" title="Download all eight categories, full details and payment references as a private ZIP">Download All 8 Categories ZIP</a>
          <button
            onClick={handleDownloadMaster}
            disabled={exportingMaster}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            title="Download all 4 application categories in 1 complete Excel workbook"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{exportingMaster ? 'Generating...' : 'Master Excel Sheet (.xlsx)'}</span>
          </button>

          <button
            onClick={refreshAllData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
            title="Refresh latest applications"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 6 CORE CATEGORY STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        {/* Performers */}
        <button
          onClick={() => { setActiveTab('performer'); setStatusFilter('ALL'); setReadFilter('ALL'); setSearch(''); }}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer border ${
            activeTab === 'performer'
              ? 'bg-amber-500/15 border-amber-500 shadow-lg shadow-amber-500/10'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">1. PERFORMERS</span>
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">{data.performers?.length || 0}</div>
          <p className="text-[10px] text-emerald-400 font-semibold mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Direct Saved Auditions (Free)
          </p>
        </button>

        {/* Booked Tickets */}
        <Link
          href="/malik/orders"
          className="p-4 rounded-2xl text-left transition-all cursor-pointer border bg-slate-900/90 border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/15 shadow-lg group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
              <span>🎟️</span> BOOKED TICKETS
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 group-hover:scale-110 transition-transform">
              <TicketIcon className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-300">{ticketStats.paidTickets || ticketStats.totalBooked || 0}</div>
          <p className="text-[10px] text-emerald-400 font-bold mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Orders & Scanner ↗
          </p>
        </Link>

        {/* Sponsors */}
        <button
          onClick={() => { setActiveTab('sponsor'); setStatusFilter('ALL'); setReadFilter('ALL'); setSearch(''); }}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer border ${
            activeTab === 'sponsor'
              ? 'bg-blue-500/15 border-blue-500 shadow-lg shadow-blue-500/10'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">2. SPONSORS</span>
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">{data.sponsors?.length || 0}</div>
          <p className="text-[10px] text-slate-400 mt-1">Brand & Partner Inquiries</p>
        </button>

        {/* Join Team */}
        <button
          onClick={() => { setActiveTab('team'); setStatusFilter('ALL'); setReadFilter('ALL'); setSearch(''); }}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer border ${
            activeTab === 'team'
              ? 'bg-purple-500/15 border-purple-500 shadow-lg shadow-purple-500/10'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">3. JOIN TEAM</span>
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">{data.team?.length || 0}</div>
          <p className="text-[10px] text-slate-400 mt-1">Crew & Volunteer Applicants</p>
        </button>

        {/* Judges / VIPs */}
        <button
          onClick={() => { setActiveTab('guest'); setStatusFilter('ALL'); setReadFilter('ALL'); setSearch(''); }}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer border ${
            activeTab === 'guest'
              ? 'bg-emerald-500/15 border-emerald-500 shadow-lg shadow-emerald-500/10'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">4. JUDGES & VIPS</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300">
              <Award className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">{data.guests?.length || 0}</div>
          <p className="text-[10px] text-slate-400 mt-1">Guest & Panel Nominations</p>
        </button>

        {/* GGL Talent Trip Registrations */}
        <Link href="/malik/talent-trip" className="p-4 rounded-2xl text-left transition-all cursor-pointer border bg-amber-500/10 border-amber-400/40 hover:border-amber-300 hover:bg-amber-500/15 shadow-lg group flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">7. GGL TALENT TRIP</span>
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 group-hover:scale-110 transition-transform">🧳</div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">{initialData.talentTripCount || 0}</div>
          <p className="text-[10px] text-slate-300 font-semibold mt-1">Interest Registrations · Manage ↗</p>
        </Link>

        {/* Computer Ji Live Scores */}
        <button
          onClick={() => { setActiveTab('computerji'); setStatusFilter('ALL'); setReadFilter('ALL'); setSearch(''); }}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer border ${
            activeTab === 'computerji'
              ? 'bg-amber-500/20 border-amber-400 shadow-lg shadow-amber-500/15'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">5. COMPUTER JI</span>
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300">
              <Sliders className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">{computerJiScores.length}</div>
          <p className="text-[10px] text-amber-400 font-semibold mt-1">Live Scores (10-Day Retention)</p>
        </button>

        {/* Abandoned Leads */}
        <button
          onClick={() => { setActiveTab('leads'); setStatusFilter('ALL'); setReadFilter('ALL'); setSearch(''); }}
          className={`p-4 rounded-2xl text-left transition-all cursor-pointer border ${
            activeTab === 'leads'
              ? 'bg-rose-500/20 border-rose-400 shadow-lg shadow-rose-500/15'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">6. LEADS (DRAFTS)</span>
            <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">{leads.length}</div>
          <p className="text-[10px] text-rose-400 font-semibold mt-1">Auto-Saved Form Drafts</p>
        </button>
      </div>

      {/* MAIN APPLICATION CONSOLE */}
      <div className="glass-panel p-5 sm:p-7 rounded-3xl border border-white/10 space-y-5">
        {/* TABS HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: 'performer', label: '🎤 Performers (कलाकार Audition)', count: data.performers?.length || 0 },
              { id: 'sponsor', label: '🤝 Sponsors (स्पॉन्सर)', count: data.sponsors?.length || 0 },
              { id: 'team', label: '👥 Join Team (टीम सदस्य)', count: data.team?.length || 0 },
              { id: 'guest', label: '⚖️ Judges & VIPs (जज / पैनल)', count: data.guests?.length || 0 },
              { id: 'computerji', label: '💻 Computer Ji Scores (10-दिन डेटा)', count: computerJiScores.length },
              { id: 'leads', label: '⚡ Leads (Auto-Saved Drafts)', count: leads.length },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as TabType);
                    setStatusFilter('ALL');
                    setReadFilter('ALL');
                    setSearch('');
                  }}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 scale-[1.02]'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/5'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                    isActive ? 'bg-black text-amber-400 font-extrabold' : 'bg-white/10 text-slate-300'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* SINGLE CATEGORY EXCEL DOWNLOAD BUTTON */}
          <button
            onClick={handleDownloadExcel}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center gap-2 shadow-md transition-all shrink-0 cursor-pointer self-start md:self-auto"
            title={`Download ${activeTab.toUpperCase()} applications directly as Microsoft Excel (.xlsx)`}
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>Download {activeTab === 'performer' ? 'Performers' : activeTab === 'sponsor' ? 'Sponsors' : activeTab === 'team' ? 'Team' : activeTab === 'guest' ? 'Judges' : activeTab === 'leads' ? 'Leads' : 'Computer Ji Scores'} Excel Sheet (.xlsx)</span>
          </button>
        </div>

        {activeTab === 'performer' && <div className="mb-3 flex flex-wrap items-center gap-3">
          <p className="text-xs text-slate-400">Captured payments are checked automatically while this dashboard is open.</p>
          {search.trim().startsWith('pay_') && <button disabled={verifyingPayment} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold disabled:opacity-50" onClick={async () => {
            setVerifyingPayment(true); setPaymentMessage('');
            try {
              const response = await fetch('/api/malik/performer-payment/reconcile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId: search.trim() }) });
              const result = await response.json();
              if (!response.ok || !result.success) throw new Error(result.error || 'Verification failed');
              setPaymentMessage(`Verified ₹${result.amount} — ${result.appId} — ${result.paymentId}`);
              await refreshAllData();
            } catch (error: any) { setPaymentMessage(error.message || 'Unable to verify payment'); }
            finally { setVerifyingPayment(false); }
          }}>{verifyingPayment ? 'Checking payment…' : 'Verify payment ID'}</button>}
          {paymentMessage && <p role="status" className="text-sm text-amber-200">{paymentMessage}</p>}
        </div>}

        {/* TOOLBAR: SEARCH, FILTERS & STATS */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-black/40 p-3.5 rounded-2xl border border-white/5">
          {/* Search Bar - Supports Email, Name, Mobile, App ID, Razorpay ID */}
          <div className="flex items-center gap-2 flex-1 max-w-lg bg-slate-900/90 px-3.5 py-2.5 rounded-xl border border-slate-700/80 focus-within:border-amber-400 transition-colors">
            <Search className="w-4 h-4 text-amber-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Email (e.g. rahul@gmail.com), Name, Mobile, App ID, Razorpay ID..."
              className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-xs text-slate-400 hover:text-white cursor-pointer px-1">
                ✕
              </button>
            )}
          </div>

          {/* Filters & Toggles */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Read / Unread Status Filter Toggle */}
            <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-700">
              <button
                onClick={() => setReadFilter('ALL')}
                className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  readFilter === 'ALL' ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({currentList.length})
              </button>
              <button
                onClick={() => setReadFilter('UNREAD')}
                className={`px-3 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                  readFilter === 'UNREAD' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-400 hover:text-blue-300'
                }`}
                title="Show Unread only (Top of list)"
              >
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                Unread ({unreadCount})
              </button>
              <button
                onClick={() => setReadFilter('READ')}
                className={`px-3 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                  readFilter === 'READ' ? 'bg-emerald-500 text-black shadow-md' : 'text-slate-400 hover:text-emerald-300'
                }`}
                title="Show Read only (Bottom of list)"
              >
                <Check className="w-3 h-3" />
                Read ({readCount})
              </button>
            </div>

            {/* Status Dropdown */}
            {activeTab === 'performer' && <select aria-label="Detail form status" value={detailFilter} onChange={e => setDetailFilter(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white">
              <option value="ALL">All detail forms</option><option value="FILLED">Detail form filled</option><option value="MISSING">Detail form not filled</option>
            </select>}
            <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs text-white font-semibold focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900">All Statuses</option>
                {activeTab === 'performer' && (
                  <>
                    <option value="PAYMENT_VERIFIED" className="bg-slate-900">PAYMENT_VERIFIED</option>
                    <option value="PAID" className="bg-slate-900">Paid — verified</option>
                    <option value="UNPAID" className="bg-slate-900">Unpaid / unverified</option>
                    <option value="UNDER_REVIEW" className="bg-slate-900">UNDER_REVIEW</option>
                    <option value="SHORTLISTED" className="bg-slate-900">SHORTLISTED</option>
                    <option value="REFUNDED" className="bg-slate-900">REFUNDED</option>
                  </>
                )}
                {activeTab === 'sponsor' && (
                  <>
                    <option value="NEW_LEAD" className="bg-slate-900">NEW_LEAD</option>
                    <option value="IN_DISCUSSION" className="bg-slate-900">IN_DISCUSSION</option>
                    <option value="CONFIRMED" className="bg-slate-900">CONFIRMED</option>
                  </>
                )}
                {activeTab === 'team' && (
                  <>
                    <option value="RECEIVED" className="bg-slate-900">RECEIVED</option>
                    <option value="INTERVIEW_SCHEDULED" className="bg-slate-900">INTERVIEW_SCHEDULED</option>
                    <option value="SELECTED" className="bg-slate-900">SELECTED</option>
                  </>
                )}
                {activeTab === 'guest' && (
                  <>
                    <option value="PENDING_REVIEW" className="bg-slate-900">PENDING_REVIEW</option>
                    <option value="INVITED" className="bg-slate-900">INVITED</option>
                    <option value="CONFIRMED" className="bg-slate-900">CONFIRMED</option>
                  </>
                )}
              </select>
            </div>

            <div className="text-[11px] text-slate-400 font-mono pl-2">
              Showing <strong className="text-white">{filteredItems.length}</strong> records
            </div>
          </div>
        </div>


        {activeTab === 'leads' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-rose-950/20 border border-rose-500/20 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-300">
                {selectedLeadIds.length > 0 ? selectedLeadIds.length + ' lead(s) selected' : 'Select leads using the checkboxes'}
              </span>
              {selectedLeadIds.length > 0 && (
                <button type="button" onClick={() => setSelectedLeadIds([])} className="text-[11px] font-bold text-slate-400 hover:text-white cursor-pointer">
                  Clear Selection
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleBulkDeleteLeads}
              disabled={selectedLeadIds.length === 0}
              className="px-4 py-2 rounded-xl bg-red-950/80 hover:bg-red-800 border border-red-500/50 text-red-300 hover:text-white text-xs font-black flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected {selectedLeadIds.length > 0 ? '(' + selectedLeadIds.length + ')' : ''}
            </button>
          </div>
        )}

        {/* APPLICANTS DATA TABLE */}
        <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-inner">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0b0e18] text-slate-400 font-black uppercase tracking-wider border-b border-white/10 text-[11px]">
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4">App ID</th>
                <th className="py-3.5 px-4">Applicant / Name & Email</th>
                <th className="py-3.5 px-4">Contact (Call & WhatsApp)</th>
                {activeTab === 'performer' && (
                  <>
                    <th className="py-3.5 px-4">Category & Talent</th>
                    <th className="py-3.5 px-4">City</th>
                    <th className="py-3.5 px-4">Audition Fee / Status</th>
                  </>
                )}
                {activeTab === 'sponsor' && (
                  <>
                    <th className="py-3.5 px-4">Contact Person</th>
                    <th className="py-3.5 px-4">Sponsorship Type</th>
                    <th className="py-3.5 px-4">Budget / Package</th>
                  </>
                )}
                {activeTab === 'team' && (
                  <>
                    <th className="py-3.5 px-4">Email</th>
                    <th className="py-3.5 px-4">City / Address</th>
                    <th className="py-3.5 px-4">Skills / Role</th>
                  </>
                )}
                {activeTab === 'guest' && (
                  <>
                    <th className="py-3.5 px-4">Stage Name</th>
                    <th className="py-3.5 px-4">Profession / Category</th>
                    <th className="py-3.5 px-4">City</th>
                  </>
                )}
                {activeTab === 'computerji' && (
                  <>
                    <th className="py-3.5 px-4">Panel Judge Scores</th>
                    <th className="py-3.5 px-4 text-center">Avg Score</th>
                    <th className="py-3.5 px-4 text-center">Prediction</th>
                    <th className="py-3.5 px-4 text-center">Verdict</th>
                    <th className="py-3.5 px-4">Time Saved</th>
                    <th className="py-3.5 px-4">10-Day Retention</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </>
                )}
                {activeTab !== 'computerji' && activeTab !== 'leads' && (
                  <>
                    <th className="py-3.5 px-4 text-center">Mark as Read</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </>
                )}
                {activeTab === 'leads' && (
                  <>
                    <th className="py-3.5 px-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={filteredItems.length > 0 && filteredItems.every((item) => selectedLeadIds.includes(item.id))}
                        onChange={toggleAllVisibleLeads}
                        className="w-4 h-4 accent-rose-500 cursor-pointer"
                        aria-label="Select all visible leads"
                      />
                    </th>
                    <th className="py-3.5 px-4">Email & Instagram</th>
                    <th className="py-3.5 px-4 text-center">Ticket Qty</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Captured Time</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 text-slate-600" />
                      <span className="text-sm font-bold text-slate-300">No applications or leads found</span>
                      <span className="text-xs text-slate-500">All saved data and form drafts are displayed in this portal</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  if (activeTab === 'leads') {
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-900/60 transition-colors border-l-2 ${item.is_read ? 'border-l-transparent' : 'border-l-amber-400 bg-amber-500/5'}`}
                      >
                        <td className="py-3.5 px-4 text-center text-slate-500 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.includes(item.id)}
                            onChange={() => toggleLeadSelection(item.id)}
                            className="w-4 h-4 accent-rose-500 cursor-pointer"
                            aria-label={`Select lead ${item.lead_code || item.id}`}
                          />
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-rose-400 text-xs whitespace-nowrap">
                          <div>{item.lead_code || item.id}</div>
                          <button
                            type="button"
                            onClick={() => setSelectedItem({ ...item, __isLead: true })}
                            className="mt-1 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase cursor-pointer"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-black text-white text-sm">{item.customer_name || 'Anonymous Guest'}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-amber-300 font-bold">SOURCE: {String(item.source || 'UNKNOWN').replace(/-/g, ' ').toUpperCase()}</span>
                            {!item.is_read && <span className="px-1.5 py-0.5 rounded bg-amber-500 text-black text-[9px] font-black">NEW</span>}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-white font-bold">{item.mobile}</span>
                            {item.mobile && (
                              <div className="flex items-center gap-1">
                                <a
                                  href={`https://wa.me/91${String(item.mobile).replace(/[^0-9]/g, '').slice(-10)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 transition-colors"
                                  title="Chat on WhatsApp"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </a>
                                <a
                                  href={`tel:${item.mobile}`}
                                  className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 transition-colors"
                                  title="Call phone"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-slate-300 text-xs">{item.email || '—'}</div>
                          {item.instagram_id && <div className="text-[11px] text-amber-300">@{item.instagram_id.replace(/^@/, '')}</div>}
                          {item.data?.contactPerson && <div className="text-[11px] text-slate-400">Contact: {item.data.contactPerson}</div>}
                          {item.data?.companyName && <div className="text-[11px] text-slate-400">Company: {item.data.companyName}</div>}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-300 text-xs">
                          {item.source === 'book-ticket' ? `${item.quantity || 1} Ticket(s)` : '—'}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {item.status === 'CONVERTED' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              ✅ BOOKED (PAID)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              {item.status === 'SUBMITTED' ? '✅ SUBMITTED' : item.status === 'IN_PROGRESS' ? '✏️ IN PROGRESS' : '⚠️ ABANDONED DRAFT'}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(item.updated_at || item.created_at).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleRead(item)}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${item.is_read ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-amber-500/20 border-amber-500/40 text-amber-300'}`}
                            >
                              {item.is_read ? 'Mark Unread' : 'Mark as Read'}
                            </button>
                            <button
                            onClick={() => handleDeleteLead(item.id, item.customer_name)}
                            className="px-2.5 py-1 rounded-lg bg-red-950/70 hover:bg-red-800 border border-red-500/40 text-red-300 hover:text-white text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                            title="Delete this lead"
                          >
                            <Trash2 className="w-3 h-3 text-red-400" />
                            <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  if (activeTab === 'computerji') {
                    return (
                      <tr
                        key={item.contestant_id}
                        className="hover:bg-slate-900/60 transition-colors border-l-2 border-l-transparent hover:border-l-amber-500"
                      >
                        <td className="py-3.5 px-4 text-center text-slate-500 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-amber-400 text-xs whitespace-nowrap">
                          #{item.contestant_id}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-black text-white text-sm">{item.contestant_name}</div>
                          <div className="text-[11px] text-amber-300 font-semibold">{item.category}</div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-white font-bold">{item.phone}</span>
                            {item.phone && (
                              <div className="flex items-center gap-1">
                                <a
                                  href={`https://wa.me/${whatsappNumber(item.phone)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 transition-colors"
                                  title="Chat on WhatsApp"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </a>
                                <a
                                  href={`tel:${item.phone}`}
                                  className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 transition-colors"
                                  title="Call phone"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {Object.entries(item.judge_scores || {}).map(([jId, score]) => (
                              <span
                                key={jId}
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-slate-300"
                              >
                                {jId.replace(/^j_/, '')}: <strong className="text-amber-300">{score as string}</strong>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-black text-amber-400 text-sm">
                          {item.rounded_average} <span className="text-[10px] text-slate-500">/ 10</span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-black text-white text-sm">
                          {item.contestant_score || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {item.result === 'WIN' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              🎉 WIN (MATCH)
                            </span>
                          ) : item.result === 'LOSE' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/30">
                              ❌ MISMATCH
                            </span>
                          ) : (
                            <span className="text-slate-500 font-mono text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                          {item.saved_at}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            ⏳ {item.days_left ?? 10} दिन शेष (Auto-delete)
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleDeleteComputerJiScore(item.contestant_id)}
                            className="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-800 border border-red-500/40 text-red-300 hover:text-white text-[11px] font-bold transition-all cursor-pointer"
                            title="Delete this score"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  const appId = item.app_id || item.id || `APP-${idx + 1}`;
                  const name = item.full_name || item.company_name || item.stage_name || 'N/A';
                  const phoneNum = (item.whatsapp_number || item.whatsapp || item.mobile_number || item.phone || '').replace(/[^0-9]/g, '');
                  const displayPhone = item.mobile_number || item.phone || item.whatsapp_number || item.whatsapp || 'N/A';
                  const email = item.email || item.biz_email || '';
                  const status = item.application_status || item.payment_status || item.status || 'RECEIVED';
                  const isPaid = activeTab === 'performer' ? hasVerifiedPerformerPayment(item) : item.payment_status === 'PAID' || item.payment_status === 'PAYMENT_VERIFIED';
                  const isUnread = !item.is_read;

                  return (
                    <tr
                      key={appId}
                      className={`transition-colors border-l-4 ${
                        activeTab === 'performer' && item.details_submitted_at
                          ? 'border-l-orange-400 bg-orange-500/[0.18] hover:bg-orange-500/[0.24]'
                          : isUnread
                            ? 'border-l-blue-400 bg-blue-500/[0.04] hover:bg-blue-500/[0.08]'
                            : 'border-l-transparent hover:bg-slate-900/60 opacity-80 hover:opacity-100'
                      }`}
                    >
                      {/* S.No */}
                      <td className="py-3.5 px-4 text-center text-slate-500 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* App ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-400 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isUnread && <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0 animate-ping" title="Unread Application (Top)" />}
                          <span>{appId}</span>
                          {activeTab === 'performer' && isPaid && <span title={item.manual_payment_reference ? "Payment recorded manually" : "Razorpay payment verified"} aria-label={item.manual_payment_reference ? "Payment recorded manually" : "Razorpay payment verified"} className="text-sky-300"><CheckCircle2 className="h-4 w-4" /></span>}
                        </div>
                      </td>

                      {/* Name & Email */}
                      <td className="py-3.5 px-4">
                        <div className="font-black text-white text-sm">{name}</div>
                        {email && (
                          <div className="text-[11px] text-amber-200/90 font-mono flex items-center gap-1 mt-0.5 truncate max-w-[200px]" title={email}>
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{email}</span>
                          </div>
                        )}
                      </td>

                      {/* Contact with WhatsApp & Call button */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-white font-bold">{displayPhone}</span>
                          {phoneNum && (
                            <div className="flex items-center gap-1">
                              <a
                                href={`https://wa.me/${whatsappNumber(phoneNum)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 transition-colors"
                                title="Chat on WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={`tel:${phoneNum}`}
                                className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 transition-colors"
                                title="Call phone"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Dynamic Columns per tab */}
                      {activeTab === 'performer' && (
                        <>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-amber-300">{item.performance_category || 'Talent'}</span>
                            {item.performance_title && (
                              <div className="text-[10px] text-slate-300 italic truncate max-w-[180px]">
                                {item.performance_title}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-300">{item.city || 'Gorakhpur'}</td>
                          <td className="py-3.5 px-4 font-mono text-[11px]">
                            <div className="space-y-1">
                              {!isPaid && (Number(item.payment_amount || 0) === 0 || item.payment_status === 'FREE_AUDITION_SUBMITTED') ? (
                                <>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30 inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-blue-400" /> FREE AUDITION
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-mono block">Direct Entry (No Payment)</span>
                                </>
                              ) : (
                                (() => {
                                  // Paid badges follow the server-verified payment link.

                                  const isVerifiedPayment = hasVerifiedPerformerPayment(item);

                                  if (isVerifiedPayment) {
                                    const displayPaymentId = item.manual_payment_reference || item.verified_payment_id;
                                    return (
                                      <>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> ₹{item.payment_amount} {item.manual_payment_reference ? 'PAID MANUALLY' : 'PAID'}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px] font-mono text-amber-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 truncate max-w-[130px]" title={displayPaymentId}>
                                            {displayPaymentId}
                                          </span>
                                          <button
                                            onClick={() => copyToClipboard(displayPaymentId)}
                                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                            title="Copy Payment ID"
                                          >
                                            {copiedId === displayPaymentId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                          </button>
                                        </div>
                                      </>
                                    );
                                  }
                                  return <span className="text-[10px] text-amber-300/80 font-semibold">PAYMENT PENDING</span>;
                                })()
                              )}
                              {activeTab === 'performer' && !isPaid && (
                                <button onClick={async () => { const waTab = window.open('about:blank', '_blank'); if (!waTab) { window.alert('Please allow pop-ups for this site, then click Get Paid again.'); return; } waTab.document.title = 'Opening WhatsApp…'; waTab.document.body.innerHTML = '<p style="font-family:system-ui;padding:24px">Generating payment link and opening WhatsApp…</p>'; try { const res = await fetch('/api/malik/performer-payment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appId: item.app_id || item.id, amount: 799 }) }); const json = await res.json(); if (!res.ok || !json.success || !json.whatsappUrl) throw new Error(json.error || 'Could not create payment link'); waTab.location.href = json.whatsappUrl; } catch (e: any) { waTab.close(); window.alert(e.message || 'Could not create payment link'); } }} className="mt-2 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[10px] font-extrabold inline-flex items-center gap-1.5" title="Create ₹799 payment link and immediately open WhatsApp"><CreditCard className="w-3 h-3" /> Get Paid ₹799</button>
                              )}
                              {activeTab === 'performer' && !isPaid && !['REFUNDED', 'REJECTED_REFUND'].includes(item.status) && item.payment_status !== 'REFUNDED' && (
                                <button onClick={() => openManualPayment(item)} disabled={markingPaid !== null} className="ml-2 mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-[10px] font-bold text-emerald-200 disabled:opacity-50" title="Record a scanner / QR payment you have received">{markingPaid === item.app_id ? 'Saving…' : 'Mark as Paid'}</button>
                              )}
                              {activeTab === 'performer' && <button onClick={() => handleSendDetailForm(item)} className="ml-2 mt-2 inline-flex items-center gap-1.5 rounded-lg border border-orange-400/40 bg-orange-500/15 px-2.5 py-1.5 text-[10px] font-bold text-orange-200" title="Send pre-filled detail form on WhatsApp" aria-label={`Send detail form to ${name}`}><FileText className="h-3.5 w-3.5" /> Detail Form</button>}
                            </div>
                          </td>
                        </>
                      )}

                      {activeTab === 'sponsor' && (
                        <>
                          <td className="py-3.5 px-4 text-slate-300">{item.contact_person || '—'}</td>
                          <td className="py-3.5 px-4 font-semibold text-amber-300">{item.sponsorship_type || item.industry || 'Brand'}</td>
                          <td className="py-3.5 px-4 font-mono text-emerald-400 font-bold">{item.budget_est || item.preferred_package || 'Discuss'}</td>
                        </>
                      )}

                      {activeTab === 'team' && (
                        <>
                          <td className="py-3.5 px-4 text-slate-300 truncate max-w-[160px]">{item.email}</td>
                          <td className="py-3.5 px-4 text-slate-300 truncate max-w-[160px]">{item.address || 'Gorakhpur'}</td>
                          <td className="py-3.5 px-4 text-slate-300 truncate max-w-[160px]">{item.about || 'Crew Member'}</td>
                        </>
                      )}

                      {activeTab === 'guest' && (
                        <>
                          <td className="py-3.5 px-4 text-slate-300">{item.stage_name || '—'}</td>
                          <td className="py-3.5 px-4 font-semibold text-amber-300">{item.profession || item.category || 'VIP'}</td>
                          <td className="py-3.5 px-4 text-slate-300">{item.city || 'Gorakhpur'}</td>
                        </>
                      )}

                      {/* MARK AS READ / UNREAD BUTTON (Moves row to bottom when marked as read) */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isUnread ? (
                          <button
                            onClick={() => handleToggleRead(item)}
                            className="px-2.5 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 border border-blue-500/50 text-[10px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-105 mx-auto"
                            title="Niche bhejne ke liye click karein (Mark as Read)"
                          >
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                            <span>Mark as Read</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleRead(item)}
                            className="px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer mx-auto"
                            title="Upar lane ke liye click karein (Mark Unread)"
                          >
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Read</span>
                          </button>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          status === 'REFUNDED'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                            : isPaid || status === 'APPROVED' || status === 'CONFIRMED' || status === 'SELECTED' || status === 'PAYMENT_VERIFIED'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : status === 'SHORTLISTED'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : status === 'REJECTED'
                            ? 'bg-red-500/20 text-red-300 border-red-500/40'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {status}
                        </span>
                      </td>

                      {/* Action: View Modal & Delete */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenItem(item)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>View Details</span>
                          </button>
                          <button
                            onClick={() => handleDeleteApplication(item)}
                            className="p-1.5 rounded-xl bg-red-950/60 hover:bg-red-800 border border-red-500/40 text-red-300 hover:text-white transition-all cursor-pointer"
                            title="Permanently delete application"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5 gap-2">
          <span>Unread applications top par rahenge. &quot;Mark as Read&quot; click karte hi entry neeche chali jayegi.</span>
          <span className="text-emerald-400 font-semibold">Razorpay IDs available for instant full slot refunds.</span>
        </div>
      </div>

      {/* FULL APPLICATION DETAILS MODAL */}
      {selectedItem?.__isLead && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div style={{ overflowY: 'auto', maxHeight: '92dvh', overscrollBehavior: 'contain' }} role="dialog" aria-modal="true" aria-label="Application details" className="glass-panel max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 rounded-3xl border border-rose-500/40 space-y-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-400 uppercase font-mono">{selectedItem.lead_code || selectedItem.id}</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-black uppercase">
                    {selectedItem.status || 'ABANDONED'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase">
                    {String(selectedItem.source || 'UNKNOWN').replace(/-/g, ' ').toUpperCase()}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white mt-2">{selectedItem.customer_name || 'Anonymous Guest'}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Captured: {selectedItem.updated_at ? new Date(selectedItem.updated_at).toLocaleString('en-IN') : 'Recent'}
                </p>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
              <div><span className="text-[11px] text-slate-400 block">Name</span><strong className="text-white">{selectedItem.customer_name || 'N/A'}</strong></div>
              <div><span className="text-[11px] text-slate-400 block">Mobile / WhatsApp</span><strong className="text-emerald-400">{selectedItem.mobile || 'N/A'}</strong></div>
              <div><span className="text-[11px] text-slate-400 block">Email</span><strong className="text-white break-all">{selectedItem.email || 'N/A'}</strong></div>
              <div><span className="text-[11px] text-slate-400 block">Instagram</span><strong className="text-amber-300 break-all">{selectedItem.instagram_id ? '@' + String(selectedItem.instagram_id).replace(/^@/, '') : 'N/A'}</strong></div>
              <div><span className="text-[11px] text-slate-400 block">Date of Birth</span><strong className="text-white">{selectedItem.dob || 'N/A'}</strong></div>
              <div><span className="text-[11px] text-slate-400 block">Ticket Quantity</span><strong className="text-amber-300">{selectedItem.quantity ?? 'N/A'}</strong></div>
              <div><span className="text-[11px] text-slate-400 block">Lead Created</span><strong className="text-white">{selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleString('en-IN') : 'N/A'}</strong></div>
              <div><span className="text-[11px] text-slate-400 block">Last Captured</span><strong className="text-white">{selectedItem.updated_at ? new Date(selectedItem.updated_at).toLocaleString('en-IN') : 'N/A'}</strong></div>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedItem.mobile && <a href={'tel:' + selectedItem.mobile} className="px-3 py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-bold">Call</a>}
              {selectedItem.mobile && <a href={'https://wa.me/91' + String(selectedItem.mobile).replace(/[^0-9]/g, '').slice(-10)} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">WhatsApp</a>}
              {selectedItem.email && <a href={'mailto:' + selectedItem.email} className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">Email</a>}
              <button onClick={() => handleToggleRead(selectedItem)} className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold cursor-pointer">
                {selectedItem.is_read ? 'Mark Unread' : 'Mark as Read'}
              </button>
              <button onClick={() => handleDeleteLead(selectedItem.id, selectedItem.customer_name)} className="px-3 py-2 rounded-xl bg-red-950/80 border border-red-500/40 text-red-300 text-xs font-bold cursor-pointer">Delete</button>
            </div>

            <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
              <div className="text-[11px] font-black text-amber-400 uppercase mb-3">All Captured Form Details</div>
              {selectedItem.data && Object.keys(selectedItem.data).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(selectedItem.data).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2 py-2 border-b border-white/5 last:border-0">
                      <span className="text-[11px] text-slate-500 font-bold break-words">{key}</span>
                      <span className="text-xs text-slate-200 break-all whitespace-pre-wrap">
                        {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '—')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No additional form fields were captured.</p>
              )}
            </div>

            <div className="flex justify-end">
              <button onClick={() => setSelectedItem(null)} className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer">Close</button>
            </div>
          </div>
        </div>, document.body
      )}

      {selectedItem && !selectedItem.__isLead && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div style={{ overflowY: 'auto', maxHeight: '92dvh', overscrollBehavior: 'contain' }} role="dialog" aria-modal="true" aria-label="Application details" className="glass-panel max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 rounded-3xl border border-amber-500/40 space-y-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-400 uppercase font-mono">{selectedItem.app_id}</span>
                  {!selectedItem.is_read ? (
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-black uppercase">
                      UNREAD (TOP)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase">
                      READ
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-black text-white mt-1">
                  {selectedItem.full_name || selectedItem.company_name || selectedItem.stage_name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Applied on: {selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleString('en-IN') : 'Recent'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleRead(selectedItem)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                    !selectedItem.is_read
                      ? 'bg-blue-500 text-white border-blue-400 shadow-md'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                  title="Toggle Read / Unread"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>{!selectedItem.is_read ? 'Mark as Read' : 'Mark as Unread'}</span>
                </button>
                {activeTab === 'performer' && canEditManualPerformerPayment(selectedItem) && (
                  <button type="button" onClick={() => openManualPayment(selectedItem, true)} className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-200" title="Edit manually recorded payment">Edit</button>
                )}

                <button
                  type="button"
                  onClick={() => handleDeleteApplication(selectedItem)}
                  className="px-3 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-800 border border-red-500/50 text-red-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Permanently Delete Application"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* FULL DETAILS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs bg-slate-900/90 p-4.5 rounded-2xl border border-slate-800">
              <div>
                <span className="text-slate-400 block text-[11px]">Primary Contact (Phone):</span>
                <strong className="text-white text-sm">
                  {selectedItem.mobile_number || selectedItem.phone || 'N/A'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">WhatsApp Number:</span>
                <strong className="text-emerald-400 text-sm">
                  {selectedItem.whatsapp_number || selectedItem.whatsapp || selectedItem.mobile_number || 'N/A'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Email Address:</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <strong className="text-white font-mono">{selectedItem.email || selectedItem.biz_email || 'N/A'}</strong>
                  {selectedItem.email && (
                    <button
                      onClick={() => copyToClipboard(selectedItem.email)}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                      title="Copy email address"
                    >
                      {copiedId === selectedItem.email ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">City / Location:</span>
                <strong className="text-white">{selectedItem.city || selectedItem.location || selectedItem.address || 'Gorakhpur'}</strong>
              </div>

              {/* Performer Specific */}
              {activeTab === 'performer' && (
                <>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Category:</span>
                    <strong className="text-amber-400 font-bold">{selectedItem.performance_category}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Performance Title:</span>
                    <strong className="text-white">{selectedItem.performance_title || 'Solo Act'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Duration & Age:</span>
                    <strong className="text-white">{selectedItem.performance_duration || '2 Min'} • Age: {selectedItem.age || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Performers Count:</span>
                    <strong className="text-white">{selectedItem.performer_count || 1} Person</strong>
                  </div>
                </>
              )}

              {/* Sponsor Specific */}
              {activeTab === 'sponsor' && (
                <>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Contact Person:</span>
                    <strong className="text-white">{selectedItem.contact_person} ({selectedItem.designation || 'Owner'})</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Industry / Sector:</span>
                    <strong className="text-amber-400">{selectedItem.industry || 'Commercial'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Sponsorship Type:</span>
                    <strong className="text-white">{selectedItem.sponsorship_type}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Estimated Budget:</span>
                    <strong className="text-emerald-400">{selectedItem.budget_est || selectedItem.preferred_package}</strong>
                  </div>
                </>
              )}

              {/* Team Specific */}
              {activeTab === 'team' && (
                <>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Date of Birth:</span>
                    <strong className="text-white">{selectedItem.dob || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Skills & Passion:</span>
                    <strong className="text-amber-400">{selectedItem.about || 'Crew Volunteer'}</strong>
                  </div>
                </>
              )}

              {/* Guest Specific */}
              {activeTab === 'guest' && (
                <>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Stage / Public Name:</span>
                    <strong className="text-white">{selectedItem.stage_name || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Profession / Field:</span>
                    <strong className="text-amber-400">{selectedItem.profession || selectedItem.category}</strong>
                  </div>
                </>
              )}
            </div>

            {/* Description & Bio */}
            {activeTab === 'performer' && <section className="rounded-2xl border border-slate-700 p-4">
              <h3 className="mb-4 font-black text-amber-300">APPLICATION — ALL SAVED FIELDS</h3>
              <dl className="space-y-3">{Object.entries(selectedItem).filter(([key]) => !key.startsWith('__') && !['detail_answers', 'verified_payment_id'].includes(key)).map(([key, value]) => <div key={key}>
                <dt className="text-xs font-bold capitalize text-slate-400">{key.replace(/_/g, ' ')}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-white">{value == null || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</dd>
              </div>)}</dl>
            </section>}

            {activeTab === 'performer' && <section className="space-y-4 rounded-2xl border border-orange-400/30 bg-orange-400/5 p-4">
              <h3 className="font-black text-orange-300">DETAILED PERFORMER FORM</h3>
              {selectedItem.details_submitted_at ? <><p className="text-xs text-slate-400">Submitted: {new Date(selectedItem.details_submitted_at).toLocaleString('en-IN')}</p>
                {performerDetailFields.map(field => <div key={field.key}><p className="text-xs font-bold text-slate-400">{field.label}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-white">{(field.key === 'stageName' ? combinedStageIntroduction(selectedItem.detail_answers) : selectedItem.detail_answers?.[field.key]) || '—'}</p></div>)}
              </> : <p className="text-sm text-slate-400">Detailed form abhi submit nahi hua hai.</p>}
              <button onClick={() => handleSendDetailForm(selectedItem)} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-black">Send Detail Form</button>
            </section>}

            {(selectedItem.performance_description || selectedItem.about || selectedItem.short_intro || selectedItem.why_ggl || selectedItem.additional_message) && (
              <div className="space-y-2 text-xs bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                <span className="text-amber-400 font-bold uppercase block text-[11px]">Application Description & Notes</span>
                <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {selectedItem.additional_message || selectedItem.performance_description || selectedItem.about || selectedItem.short_intro || selectedItem.why_ggl}
                </p>
              </div>
            )}

            {/* Social Media & Media Links */}
            {(selectedItem.instagram_url || selectedItem.youtube_url || selectedItem.brand_deck_url || selectedItem.website) && (
              <div className="space-y-2 text-xs bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                <span className="text-amber-400 font-bold uppercase block text-[11px]">Profiles & Verification Links</span>
                <div className="flex flex-wrap items-center gap-3">
                  {selectedItem.instagram_url && (
                    <a
                      href={selectedItem.instagram_url.startsWith('http') ? selectedItem.instagram_url : `https://instagram.com/${selectedItem.instagram_url.replace('@', '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Instagram
                    </a>
                  )}
                  {selectedItem.youtube_url && (
                    <a
                      href={selectedItem.youtube_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> YouTube
                    </a>
                  )}
                  {selectedItem.brand_deck_url && (
                    <a
                      href={selectedItem.brand_deck_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Brand Deck
                    </a>
                  )}
                  {selectedItem.website && (
                    <a
                      href={selectedItem.website}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Website
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Payment & Fee Status Details (For Performers) */}
            {activeTab === 'performer' && (
              Number(selectedItem.payment_amount || 0) === 0 || selectedItem.payment_status === 'FREE_AUDITION_SUBMITTED' ? (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/40 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-4 h-4" /> Direct Free Audition Application
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-black uppercase">
                      FREE AUDITION
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300 bg-black/40 p-3 rounded-xl border border-white/5 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">APPLICATION TYPE:</span>
                      <strong className="text-blue-300 text-xs block mt-0.5">Free Direct Entry (No Upfront Payment Required)</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">FEE AMOUNT:</span>
                      <strong className="text-emerald-400 text-xs block mt-0.5">₹0.00 FREE</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-amber-950/30 border border-emerald-500/40 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5 text-xs">
                      <CreditCard className="w-4 h-4" /> Payment Details
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase">
                      {selectedItem.payment_status || 'PAID'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300 bg-black/40 p-3 rounded-xl border border-white/5 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">PAYMENT ID:</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <strong className="text-amber-300 text-xs break-all">{selectedItem.payment_id || selectedItem.razorpay_payment_id || 'N/A'}</strong>
                        {selectedItem.payment_id && (
                          <button
                            onClick={() => copyToClipboard(selectedItem.payment_id)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white shrink-0 cursor-pointer"
                            title="Copy Payment ID"
                          >
                            {copiedId === selectedItem.payment_id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px]">ORDER ID:</span>
                      <strong className="text-white text-xs block mt-0.5 break-all">{selectedItem.order_id || 'N/A'}</strong>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px]">FEE AMOUNT PAID:</span>
                      <strong className="text-emerald-400 text-xs block mt-0.5">₹{selectedItem.payment_amount} INR</strong>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px]">VERIFIED AT:</span>
                      <span className="text-slate-300 text-xs block mt-0.5">
                        {selectedItem.payment_verified_at ? new Date(selectedItem.payment_verified_at).toLocaleString('en-IN') : 'Verified'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <p className="text-[11px] text-amber-200/90 leading-tight">
                      💡 Slot full hone par ya performer shortlist na hone par refund initiate karein.
                    </p>

                    {selectedItem.payment_status === 'REFUNDED' || selectedItem.status === 'REFUNDED' ? (
                      <span className="px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold text-xs shrink-0 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> REFUNDED ({selectedItem.refund_id || 'PROCESSED'})
                      </span>
                    ) : (
                      <button
                        onClick={() => handleProcessRefund(selectedItem.app_id, selectedItem.full_name)}
                        disabled={refunding || !selectedItem.payment_id}
                        className="px-4 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-200 font-extrabold text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer disabled:opacity-50"
                        title="Refund customer fee"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${refunding ? 'animate-spin' : ''}`} />
                        <span>{refunding ? 'Processing Refund...' : 'Initiate Refund'}</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            )}

            {/* STATUS UPDATE & INTERNAL NOTE (NO DELETION) */}
            <div className="space-y-4 pt-4 border-t border-slate-800 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1.5">Update Application Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold focus:outline-none"
                >
                  <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                  <option value="SHORTLISTED">SHORTLISTED</option>
                  <option value="CONFIRMED">CONFIRMED / SELECTED</option>
                  <option value="PAYMENT_VERIFIED">PAYMENT_VERIFIED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="REFUNDED">REFUNDED</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1.5">Add Internal Admin Note</label>
                <textarea
                  rows={2}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Notes regarding audition call, interview time, or feedback..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none"
                />
              </div>

              {saveSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Status and note updated successfully in Neon Database!</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Protected Record (Permanent Storage)</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveStatus}
                  disabled={savingNote}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs cursor-pointer shadow-lg transition-all"
                >
                  {savingNote ? 'Saving Changes...' : 'Save Updates'}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}
      {manualPaymentItem && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
          <form onSubmit={handleMarkPaid} role="dialog" aria-modal="true" aria-labelledby="manual-payment-title" className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-950 p-6 text-white shadow-2xl">
            <h2 id="manual-payment-title" className="text-xl font-bold">{editingManualPayment ? 'Edit Manual Payment' : 'Record Manual Payment'}</h2>
            <p className="text-sm text-slate-300">{manualPaymentItem.full_name} · {manualPaymentItem.app_id}</p>
            {editingManualPayment && <label className="block text-sm">Payment status
              <select value={manualPaymentStatus} onChange={(e) => { setManualPaymentStatus(e.target.value); setManualConfirmed(false); }} disabled={Boolean(markingPaid)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-3">
                <option value="PAID">Paid manually</option><option value="UNPAID">Unpaid — correct a mistaken Paid entry</option>
              </select>
            </label>}
            {manualPaymentStatus === 'UNPAID' && <p className="text-sm text-amber-200">This corrects the recorded status only. It does not send a refund.</p>}
            {manualPaymentStatus === 'PAID' && <>
            <label className="block text-sm">Amount received (₹)
              <input autoFocus required type="number" min="0.01" max="1000000" step="0.01" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} disabled={Boolean(markingPaid)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-3" />
            </label>
            <label className="block text-sm">Payment UTR / reference
              <input required maxLength={200} value={manualReference} onChange={(e) => setManualReference(e.target.value)} disabled={Boolean(markingPaid)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-3" />
            </label>
            <label className="block text-sm">Paid via (optional)
              <input maxLength={80} placeholder="Google Pay / PhonePe / Bank / Cash" value={manualPaymentMethod} onChange={(e) => setManualPaymentMethod(e.target.value)} disabled={Boolean(markingPaid)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-3" />
            </label>
            </>}
            {editingManualPayment && <label className="block text-sm">Correction reason
              <input required maxLength={1000} value={manualCorrectionReason} onChange={(e) => setManualCorrectionReason(e.target.value)} disabled={Boolean(markingPaid)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-3" />
            </label>}
            <label className="flex items-start gap-2 text-sm text-slate-300">
              <input required type="checkbox" checked={manualConfirmed} onChange={(e) => setManualConfirmed(e.target.checked)} disabled={Boolean(markingPaid)} className="mt-1" />
              {editingManualPayment ? 'I checked these details and confirm this correction.' : 'I checked my account and received this payment.'}
            </label>
            {manualPaymentError && <p role="alert" className="text-sm text-red-300">{manualPaymentError}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" disabled={Boolean(markingPaid)} onClick={() => setManualPaymentItem(null)} className="rounded-lg bg-slate-800 px-4 py-2 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={Boolean(markingPaid) || !manualConfirmed || (manualPaymentStatus === 'PAID' && !manualReference.trim()) || (editingManualPayment && !manualCorrectionReason.trim())} className="rounded-lg bg-emerald-600 px-4 py-2 font-bold disabled:opacity-50">{markingPaid ? 'Saving…' : editingManualPayment ? 'Save Payment Changes' : 'Confirm Paid'}</button>
            </div>
          </form>
        </div>, document.body
      )}
    </div>
  );
}
