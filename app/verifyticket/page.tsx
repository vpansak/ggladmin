'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import jsQR from 'jsqr';
import { 
  ShieldCheck, 
  Camera, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  LogOut, 
  Ticket as TicketIcon, 
  RefreshCw, 
  User, 
  Lock,
  ArrowRight,
  KeyRound,
  Clock,
  QrCode as QrIcon
} from 'lucide-react';
import TicketAdmissionSummary from '@/components/TicketAdmissionSummary';
import { getTicketQuantity } from '@/lib/ticketQuantity';
import { TicketRecord } from '@/lib/ticketTypes';

export default function VerifyTicketPage() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Verification State
  const [ticketIdInput, setTicketIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expireCode, setExpireCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [expiring, setExpiring] = useState(false);

  const [verificationResult, setVerificationResult] = useState<{
    status: 'IDLE' | 'LOOKUP_VALID' | 'SUCCESS_EXPIRED' | 'ALREADY_USED' | 'UNPAID' | 'INVALID';
    message: string;
    ticket?: TicketRecord;
    checkedInAt?: string;
  }>({ status: 'IDLE', message: '' });

  // Camera & QR Scanner State
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastScannedIdRef = useRef<string | null>(null);

  // Restore server-side staff session
  useEffect(() => {
    fetch('/api/tickets/staff-session', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => setIsAuthenticated(Boolean(data.authenticated)))
      .catch(() => setIsAuthenticated(false));
  }, []);

  // Auto-start camera when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [isAuthenticated, facingMode]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const cleanId = 'PASSCODE';
    const cleanPw = loginPassword.trim();

    try {
      const res = await fetch('/api/tickets/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cleanId, password: cleanPw }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setLoginError(data.error || 'Invalid ID or Password. Access Denied.');
        return;
      }

      setIsAuthenticated(true);
      setLoginId('');
      setLoginPassword('');
    } catch {
      setLoginError('Network error. Please try again.');
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    stopCamera();
    try {
      await fetch('/api/tickets/staff-logout', { method: 'POST' });
    } finally {
      setIsAuthenticated(false);
      setVerificationResult({ status: 'IDLE', message: '' });
    }
  };

  // Lookup Ticket Details
  const lookupTicketDetails = async (rawId: string) => {
    if (!rawId || !rawId.trim()) return;

    let extractedId = rawId.trim();
    const match = extractedId.match(/GGLT\d{6}/i);
    if (match) {
      extractedId = match[0].toUpperCase();
    } else {
      extractedId = extractedId.toUpperCase();
    }

    setLoading(true);
    setCodeError('');
    setExpireCode('');
    setVerificationResult({ status: 'IDLE', message: '' });

    try {
      const res = await fetch('/api/tickets/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: extractedId }),
      });

      const data = await res.json();

      if (data.status === 'VALID' && data.ticket) {
        setVerificationResult({
          status: 'LOOKUP_VALID',
          message: data.message || '✓ Valid Ticket Found.',
          ticket: data.ticket,
        });
      } else if (data.status === 'ALREADY_USED' && data.ticket) {
        setVerificationResult({
          status: 'ALREADY_USED',
          message: `USED — Ticket ${data.ticket.ticket_id} has already been used.`,
          ticket: data.ticket,
          checkedInAt: data.ticket.checked_in_at || undefined,
        });
      } else if (data.status === 'UNPAID' && data.ticket) {
        setVerificationResult({
          status: 'UNPAID',
          message: `✕ UNPAID TICKET: Payment status is incomplete for ${extractedId}.`,
          ticket: data.ticket,
        });
      } else {
        setVerificationResult({
          status: 'INVALID',
          message: `✕ INVALID TICKET / QR CODE: "${extractedId}" not found in database.`,
        });
      }
    } catch (err) {
      setVerificationResult({
        status: 'INVALID',
        message: 'Network error occurred during ticket lookup. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Confirm Entry & Expire Ticket
  const executeExpireWithCode = async (codeToSubmit: string) => {
    if (!verificationResult.ticket || expiring) return;


    setExpiring(true);
    setCodeError('');

    try {
      const res = await fetch('/api/tickets/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: verificationResult.ticket.ticket_id,
          code: codeToSubmit || '',
        }),
      });

      const data = await res.json();

      if (data.success && data.ticket) {
        setVerificationResult({
          status: 'SUCCESS_EXPIRED',
          message: `✓ TICKET EXPIRED & ENTRY CONFIRMED!`,
          ticket: data.ticket,
          checkedInAt: data.ticket.checked_in_at || new Date().toISOString(),
        });
        setExpireCode('');
        setCodeError('');
      } else {
        setCodeError(data.message || 'Failed to expire ticket.');
      }
    } catch (err) {
      setCodeError('Network error. Please try again.');
    } finally {
      setExpiring(false);
    }
  };

  const handleConfirmFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeExpireWithCode(expireCode.trim());
  };

  // Start Camera Stream with Hardware Fast Constraints
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: 'environment' }, 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 60 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        
        // Try enabling continuous hardware autofocus if supported by mobile browser
        const track = stream.getVideoTracks()[0];
        if (track && 'applyConstraints' in track) {
          try {
            await track.applyConstraints({
              advanced: [{ focusMode: 'continuous' } as any]
            });
          } catch (e) {
            // Ignore if focusMode constraint is not supported
          }
        }

        setCameraActive(true);
        requestAnimationFrame(tickScanFrame);
      }
    } catch (err) {
      console.warn('Camera stream error:', err);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Camera Frame Decoder Loop (Downsampled 480x360 for Sub-10ms Instant Detection)
  const tickScanFrame = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      // Pause active scanning if a popup modal is currently open
      if (verificationResult.status === 'IDLE') {
        const video = videoRef.current;
        const SCAN_WIDTH = 480;
        const SCAN_HEIGHT = 360;

        const canvas = canvasRef.current || document.createElement('canvas');
        if (canvas.width !== SCAN_WIDTH) canvas.width = SCAN_WIDTH;
        if (canvas.height !== SCAN_HEIGHT) canvas.height = SCAN_HEIGHT;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (ctx) {
          ctx.drawImage(video, 0, 0, SCAN_WIDTH, SCAN_HEIGHT);
          const imageData = ctx.getImageData(0, 0, SCAN_WIDTH, SCAN_HEIGHT);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data) {
            const scannedText = code.data.trim();
            if (scannedText && scannedText !== lastScannedIdRef.current) {
              lastScannedIdRef.current = scannedText;
              lookupTicketDetails(scannedText);
              setTimeout(() => {
                lastScannedIdRef.current = null;
              }, 1200);
            }
          }
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(tickScanFrame);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Format Date Helper
  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return 'Earlier Session';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Close Popup Modal and Reset Scanner
  const handleCloseModal = () => {
    setVerificationResult({ status: 'IDLE', message: '' });
    setTicketIdInput('');
    setExpireCode('');
    setCodeError('');
  };

  // Auto Lookup when 11 characters are entered manually
  const handleManualInputChange = (val: string) => {
    setTicketIdInput(val);
    const cleanVal = val.trim();
    if (cleanVal.length === 11 || (cleanVal.length >= 10 && cleanVal.toUpperCase().startsWith('GGLT'))) {
      lookupTicketDetails(cleanVal);
    }
  };

  const handleCodeChange = (val: string) => {
    const cleanVal = val.replace(/\D/g, '').slice(0, 8);
    setExpireCode(cleanVal);
    setCodeError('');
  };

  // -------------------------------------------------------------
  // LOGIN SCREEN (FULLSCREEN ZERO SCROLL)
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#07080e] text-slate-100 flex flex-col items-center justify-center p-4 overflow-hidden select-none">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 p-0.5 mx-auto flex items-center justify-center text-amber-400 shadow-[0_0_30px_rgba(255,215,0,0.3)]">
              <Lock className="w-7 h-7" />
            </div>

            <h1 className="font-bebas text-3xl text-white uppercase tracking-wider">
              GATE VERIFICATION LOGIN
            </h1>
            <p className="text-xs text-slate-400">
              Gorakhpur's Got Latent — sign in as staff
            </p>
          </div>

          <Link href="/malik" className="block text-center font-bold text-amber-300">Sign in through Admin Portal</Link>
          <form onSubmit={handleLogin} className="p-6 rounded-3xl border border-amber-500/30 space-y-4 bg-slate-900/90 shadow-2xl">
            {loginError && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-bold text-center flex items-center justify-center gap-2">
                <XCircle className="w-4 h-4 text-red-400" />
                <span>{loginError}</span>
              </div>
            )}

            <label className="block text-xs text-slate-300">Staff ID<input value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="Configured gate staff ID" required className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-white" /></label>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" /> Password
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter access password"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-all text-sm font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-black font-barlow font-black uppercase tracking-wider text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,215,0,0.3)] transition-all cursor-pointer"
            >
              <span>OPEN SCANNER</span>
              <ArrowRight className="w-4 h-4 text-black" />
            </button>
          </form>

          <div className="text-center">
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // FULLSCREEN TICKET SCANNER PAGE (ZERO SCROLL, CLEAN & FAST)
  // -------------------------------------------------------------
  return (
    <>
    <div className="fixed inset-0 z-[9999] bg-[#07080e] text-slate-100 flex flex-col justify-between p-3 sm:p-4 overflow-hidden select-none h-[100dvh] w-full">
      
      {/* 1. TOP HEADER BAR — ONLY LOGOUT BUTTON & BRANDING */}
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5 px-1 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bebas text-lg sm:text-xl text-white uppercase tracking-wider leading-none">
              GGL TICKET SCANNER
            </h1>
            <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest block mt-0.5">
              ● SCANNER ACTIVE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cameraActive && (
            <button
              type="button"
              onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-400 text-[10px] font-bold uppercase transition-all"
            >
              FLIP CAMERA
            </button>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-500/50 font-bold text-xs uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
          >
            <LogOut className="w-3.5 h-3.5 text-red-400" />
            <span>LOGOUT</span>
          </button>
        </div>
      </div>

      {/* 2. MIDDLE CAMERA VIEWPORT — EXPANDED SCANNER */}
      <div className="relative flex-1 my-2 rounded-2xl bg-black border-2 border-amber-500/40 overflow-hidden flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.8)]">
        <video
          ref={videoRef}
          className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Viewfinder Target Box Overlay */}
        {cameraActive && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-56 h-56 sm:w-64 sm:h-64 border-2 border-amber-400 rounded-3xl relative shadow-[0_0_40px_rgba(255,215,0,0.35)]">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-400 -mt-1 -ml-1 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-400 -mt-1 -mr-1 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-400 -mb-1 -ml-1 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-400 -mb-1 -mr-1 rounded-br-xl" />
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse shadow-[0_0_15px_#f59e0b]" />
            </div>
            <div className="absolute bottom-4 text-[11px] font-bold text-amber-300 uppercase tracking-widest bg-black/70 px-3 py-1 rounded-full border border-amber-500/40">
              ALIGN TICKET QR CODE IN BOX
            </div>
          </div>
        )}

        {/* Camera Off Placeholder */}
        {!cameraActive && (
          <div className="text-center space-y-3 p-4">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-500 mx-auto">
              <Camera className="w-8 h-8" />
            </div>
            <p className="text-xs text-slate-400">
              Camera is off or initializing...
            </p>
            <button
              onClick={startCamera}
              className="px-4 py-2 rounded-xl bg-amber-400 text-black font-bold text-xs uppercase"
            >
              START CAMERA
            </button>
          </div>
        )}
      </div>

      {/* 3. BOTTOM MANUAL CODE INPUT BAR */}
      <div className="shrink-0 bg-slate-900/90 p-3 rounded-2xl border border-amber-500/30 space-y-2 shadow-2xl">
        <div className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center justify-between">
          <span>MANUAL TICKET CODE / ID</span>
          {loading && <span className="text-amber-300 animate-pulse">CHECKING...</span>}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (ticketIdInput.trim()) {
              lookupTicketDetails(ticketIdInput.trim());
            }
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <TicketIcon className="w-5 h-5 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={ticketIdInput}
              onChange={(e) => handleManualInputChange(e.target.value)}
              placeholder="ENTER TICKET ID (e.g. GGLT282321)"
              className="w-full pl-10 pr-3 py-3 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 placeholder-slate-600 font-mono font-black text-sm tracking-wider uppercase focus:outline-none focus:border-amber-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !ticketIdInput.trim()}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black uppercase text-xs tracking-wider shrink-0 shadow-lg disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin text-black" /> : 'CHECK'}
          </button>
        </form>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. POPUP MODALS FOR VERIFICATION STATUSES */}
      {/* ------------------------------------------------------------- */}

      {/* POPUP 1: VALID TICKET — ENTER CODE 11 */}
      {verificationResult.status === 'LOOKUP_VALID' && verificationResult.ticket && (
        <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border-2 border-emerald-500/70 bg-slate-950 shadow-[0_0_60px_rgba(16,185,129,0.3)] p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400 mx-auto flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <span className="px-3 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 font-black text-[10px] uppercase tracking-widest inline-block border border-emerald-500/40">
                ✓ VALID TICKET FOUND
              </span>
              <h2 className="font-bebas text-2xl text-white uppercase tracking-wide">
                CONFIRM GATE ENTRY
              </h2>
            </div>

            <TicketAdmissionSummary quantity={verificationResult.ticket.quantity} />

            {/* Ticket Snapshot Card */}
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400 uppercase text-[10px]">TICKET ID</span>
                <span className="font-mono font-black text-amber-300 text-sm">{verificationResult.ticket.ticket_id}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><span className="text-slate-500 uppercase text-[9px] block">Name</span><span className="font-bold text-white truncate">{verificationResult.ticket.customer_name}</span></div>
                <div><span className="text-slate-500 uppercase text-[9px] block">Mobile</span><span className="font-semibold text-slate-200">{verificationResult.ticket.mobile}</span></div>
              </div>
            </div>

            <p className="text-xs text-center text-slate-300">
              Confirm entry for all {getTicketQuantity(verificationResult.ticket.quantity)} {getTicketQuantity(verificationResult.ticket.quantity) === 1 ? 'person' : 'people'} on this ticket together.
            </p>

            {/* Code 11 Input */}
            <form onSubmit={handleConfirmFormSubmit} className="space-y-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block text-center">
                  ENTER STAFF CODE TO CONFIRM ENTRY
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  required
                  value={expireCode}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="CODE"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-900 border-2 border-amber-500/70 text-amber-300 placeholder-slate-700 font-mono font-black text-center text-3xl tracking-[0.4em] focus:outline-none focus:border-amber-400 shadow-inner"
                />
              </div>

              {codeError && (
                <p className="text-xs text-red-400 font-bold text-center">{codeError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={expiring}
                  className="flex-[2] py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {expiring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{expiring ? 'EXPIRING...' : `CONFIRM ENTRY — ${getTicketQuantity(verificationResult.ticket.quantity)} ${getTicketQuantity(verificationResult.ticket.quantity) === 1 ? 'PERSON' : 'PEOPLE'}`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP 2: SUCCESS EXPIRED / CONFIRMED MODAL */}
      {verificationResult.status === 'SUCCESS_EXPIRED' && verificationResult.ticket && (
        <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border-2 border-emerald-500/80 bg-slate-950 shadow-[0_0_60px_rgba(16,185,129,0.4)] p-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400 mx-auto flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-300 font-black text-xs uppercase tracking-widest border border-emerald-500/40 inline-block mb-1">
                ✓ CHECKED IN SUCCESSFUL
              </span>
              <h2 className="font-bebas text-3xl text-emerald-300 uppercase tracking-wide">
                ENTRY CONFIRMED
              </h2>
            </div>

            <TicketAdmissionSummary quantity={verificationResult.ticket.quantity} />

            <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/40 space-y-2 text-xs">
              <div className="text-amber-400 font-mono font-black text-base">
                {verificationResult.ticket.ticket_id}
              </div>
              <div className="font-bold text-white text-sm">
                {verificationResult.ticket.customer_name}
              </div>
              <div className="text-[11px] text-emerald-300 font-mono flex items-center justify-center gap-1 pt-1 border-t border-slate-800">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Entered: {formatDateTime(verificationResult.checkedInAt)}</span>
              </div>
            </div>

            <button
              onClick={handleCloseModal}
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-xs tracking-wider shadow-lg cursor-pointer"
            >
              DONE / SCAN NEXT TICKET
            </button>
          </div>
        </div>
      )}

      {/* POPUP 3: ALREADY USED / EXPIRED MODAL — SHOWS CHECKED-IN TIMESTAMP */}
      {verificationResult.status === 'ALREADY_USED' && verificationResult.ticket && (
        <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border-2 border-red-500/80 bg-slate-950 shadow-[0_0_60px_rgba(239,68,68,0.4)] p-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-600/20 border border-red-500 mx-auto flex items-center justify-center text-red-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <span className="px-3 py-1 rounded-full bg-red-600/30 text-red-200 font-black text-xs uppercase tracking-widest border border-red-500/50 inline-block mb-1 animate-pulse">
                ⚠️ TICKET ALREADY USED
              </span>
              <h2 className="font-bebas text-3xl text-red-400 uppercase tracking-wide">
                ALREADY EXPIRED
              </h2>
            </div>

            <TicketAdmissionSummary quantity={verificationResult.ticket.quantity} />

            <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 space-y-2 text-xs text-left">
              <div className="flex justify-between items-center border-b border-red-500/20 pb-2">
                <span className="text-slate-400 text-[10px] uppercase">STATUS</span>
                <span className="font-black text-red-400 uppercase">USED / EXPIRED</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">Ticket ID</span>
                <span className="font-mono font-black text-amber-300 text-sm">{verificationResult.ticket.ticket_id}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">Attendee Name</span>
                <span className="font-bold text-white text-sm">{verificationResult.ticket.customer_name}</span>
              </div>
              <div className="pt-2 border-t border-red-500/20">
                <span className="text-red-300 text-[10px] font-bold uppercase block">USED / CHECK-IN TIMESTAMP:</span>
                <span className="font-mono font-black text-amber-300 text-xs flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  {formatDateTime(verificationResult.checkedInAt || verificationResult.ticket.checked_in_at)}
                </span>
              </div>
            </div>

            <button
              onClick={handleCloseModal}
              className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black uppercase text-xs tracking-wider shadow-lg cursor-pointer"
            >
              CLOSE / SCAN NEXT TICKET
            </button>
          </div>
        </div>
      )}

      {/* POPUP 4: INVALID TICKET / QR CODE MODAL */}
      {verificationResult.status === 'INVALID' && (
        <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border-2 border-red-500/80 bg-slate-950 shadow-[0_0_60px_rgba(239,68,68,0.4)] p-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-600/20 border border-red-500 mx-auto flex items-center justify-center text-red-400">
              <XCircle className="w-8 h-8" />
            </div>

            <div>
              <span className="px-3 py-1 rounded-full bg-red-600/30 text-red-200 font-black text-xs uppercase tracking-widest border border-red-500/50 inline-block mb-1">
                ✕ INVALID TICKET / QR
              </span>
              <h2 className="font-bebas text-3xl text-red-400 uppercase tracking-wide">
                NOT FOUND IN DATABASE
              </h2>
            </div>

            <p className="text-xs text-slate-300 bg-red-950/40 p-3 rounded-xl border border-red-500/30">
              {verificationResult.message || 'Invalid ticket code or QR code.'}
            </p>

            <button
              onClick={handleCloseModal}
              className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black uppercase text-xs tracking-wider shadow-lg cursor-pointer"
            >
              TRY AGAIN / SCAN NEXT
            </button>
          </div>
        </div>
      )}

      {/* POPUP 5: UNPAID TICKET MODAL */}
      {verificationResult.status === 'UNPAID' && (
        <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border-2 border-red-500/80 bg-slate-950 shadow-[0_0_60px_rgba(239,68,68,0.4)] p-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-600/20 border border-red-500 mx-auto flex items-center justify-center text-red-400">
              <XCircle className="w-8 h-8" />
            </div>

            <div>
              <h2 className="font-bebas text-3xl text-red-400 uppercase tracking-wide">
                ✕ UNPAID TICKET
              </h2>
            </div>

            <p className="text-xs text-slate-300 bg-red-950/40 p-3 rounded-xl border border-red-500/30">
              {verificationResult.message}
            </p>

            <button
              onClick={handleCloseModal}
              className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black uppercase text-xs tracking-wider shadow-lg cursor-pointer"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

    </div>
    </>
  );
}
