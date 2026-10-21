"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Users, Ticket, Handshake, UserRound, BriefcaseBusiness, RefreshCw, LogOut, ShieldCheck, Search } from "lucide-react";

type DashboardData = {
  counts: Record<string, number>;
  recent: Record<string, Record<string, unknown>[]>;
  updatedAt: string;
  diagnostics?: Record<string, string>;
};

const sections = [
  { key: "performers", label: "Performers", icon: Users },
  { key: "sponsors", label: "Sponsors", icon: Handshake },
  { key: "guests", label: "Guests", icon: UserRound },
  { key: "team", label: "Team Applications", icon: BriefcaseBusiness },
  { key: "talentTrip", label: "Talent Trip", icon: Ticket },
];

function displayName(row: Record<string, unknown>) {
  return String(row.full_name || row.name || row.stage_name || row.business_name || "Application");
}
function statusOf(row: Record<string, unknown>) {
  return String(row.application_status || row.status || row.payment_status || "SUBMITTED");
}
function dateOf(row: Record<string, unknown>) {
  const raw = row.created_at;
  if (!raw) return "—";
  const date = new Date(String(raw));
  return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function Home() {
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState("performers");
  const [search, setSearch] = useState("");

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const json = await res.json();
      if (res.status === 401) { setLoggedIn(false); setData(null); return; }
      if (!res.ok) throw new Error(json.error || "Could not load dashboard.");
      setData(json);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load dashboard.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((json) => {
        if (!cancelled && json?.success) {
          setData(json);
          setLoggedIn(true);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    void loadData();
    const timer = window.setInterval(() => void loadData(true), 15000);
    return () => window.clearInterval(timer);
  }, [loggedIn, loadData]);

  async function login(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Login failed.");
      setLoggedIn(true); setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed.");
    } finally { setLoading(false); }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setLoggedIn(false); setData(null);
  }

  if (!loggedIn) return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10 bg-[radial-gradient(ellipse_at_top,_rgba(153,27,27,0.18),_transparent_55%)]">
      <form onSubmit={login} className="w-full max-w-md rounded-3xl border border-amber-400/20 bg-slate-950/90 p-8 shadow-2xl">
        <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300"><ShieldCheck size={30}/></div>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">Gorakhpur's Got Latent</p>
        <h1 className="mt-2 text-3xl font-black">GGLADMIN</h1>
        <p className="mt-2 text-sm text-slate-400">Secure control room · Authorized team only</p>
        <label className="mt-7 block text-sm font-semibold text-slate-300" htmlFor="password">Admin password</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-amber-400" placeholder="Enter dashboard password"/>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        <button disabled={loading} className="mt-5 w-full rounded-xl bg-amber-400 px-4 py-3 font-black text-slate-950 disabled:opacity-60">{loading ? "Checking..." : "Secure Login"}</button>
        <p className="mt-5 text-xs leading-5 text-slate-500">Access is protected. Set GGLADMIN_PASSWORD and GGLADMIN_SESSION_SECRET in the deployment environment.</p>
      </form>
    </main>
  );

  const activeRows = active === "talentTrip" ? [] : (data?.recent[active] || []);
  const filteredRows = activeRows.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
  return (
    <main className="min-h-screen">
      <header className="border-b border-white/10 bg-black/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-amber-400/10 p-3 text-amber-300"><Activity/></div><div><p className="text-xs font-bold tracking-[0.22em] text-amber-300">GORAKHPUR'S GOT LATENT</p><h1 className="text-2xl font-black">GGLADMIN <span className="text-sm font-medium text-emerald-300">LIVE</span></h1></div></div>
          <div className="flex gap-2"><button onClick={()=>void loadData()} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5"><RefreshCw size={16}/> Refresh</button><button onClick={()=>void logout()} className="flex items-center gap-2 rounded-xl border border-red-400/20 px-3 py-2 text-sm text-red-200 hover:bg-red-950/40"><LogOut size={16}/> Logout</button></div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold">Control Room</h2><p className="mt-1 text-sm text-slate-400">Applications from the existing GGL database · Auto-refresh every 15 seconds</p></div><p className="text-xs text-slate-500">Last sync: {data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString("en-IN") : "Connecting..."}</p></div>
        {error && <div className="mb-5 rounded-xl border border-red-400/20 bg-red-950/30 p-4 text-sm text-red-200">{error}</div>}
        {data?.diagnostics && Object.keys(data.diagnostics).length > 0 && <div className="mb-5 rounded-xl border border-amber-400/30 bg-amber-950/20 p-4 text-sm text-amber-100"><p className="mb-2 font-bold">Database diagnostics</p><ul className="list-disc space-y-1 pl-5">{Object.entries(data.diagnostics).map(([key, message]) => <li key={key}><span className="font-semibold">{key}:</span> {message}</li>)}</ul></div>}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {sections.map(({key,label,icon:Icon})=><button key={key} onClick={()=>setActive(key)} className={`rounded-2xl border p-5 text-left transition ${active===key?"border-amber-300/50 bg-amber-300/10":"border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}><div className="flex items-center justify-between"><span className="text-sm text-slate-400">{label}</span><Icon size={19} className="text-amber-300"/></div><p className="mt-4 text-3xl font-black tabular-nums">{data?.counts[key] ?? "—"}</p><p className="mt-1 text-xs text-slate-500">Total records</p></button>)}
        </section>
        <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
          <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-lg font-bold">{sections.find(s=>s.key===active)?.label} Applications</h3><p className="text-xs text-slate-500">Showing the latest 8 records for this category</p></div><div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-500"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search loaded records..." className="w-full rounded-xl border border-white/10 bg-slate-950 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-amber-300/50 sm:w-64"/></div></div>
          {active==="talentTrip" ? <p className="p-8 text-sm text-slate-400">Total Talent Trip registrations are counted above. Detailed records need the current registration table's exact column structure.</p> : filteredRows.length===0 ? <p className="p-8 text-sm text-slate-400">{loading ? "Loading applications..." : "No matching records in the latest 8 applications."}</p> :
          <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Applicant</th><th className="px-5 py-3">Contact</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Received</th></tr></thead><tbody>{filteredRows.map((row,i)=><tr key={String(row.id || row.app_id || i)} className="border-t border-white/[0.06] hover:bg-white/[0.025]"><td className="px-5 py-4"><p className="font-semibold">{displayName(row)}</p><p className="mt-1 text-xs text-slate-500">{String(row.app_id || row.id || "")}</p></td><td className="px-5 py-4 text-slate-300">{String(row.mobile_number || row.whatsapp_number || row.whatsapp || row.phone || row.email || "—")}</td><td className="px-5 py-4"><span className="rounded-full border border-white/10 px-2.5 py-1 text-xs">{statusOf(row)}</span></td><td className="px-5 py-4 text-slate-400">{dateOf(row)}</td></tr>)}</tbody></table></div>}
        </section>
        <p className="mt-6 text-center text-xs text-slate-600">GGLADMIN · Private dashboard · Database credentials stay server-side</p>
      </div>
    </main>
  );
}
