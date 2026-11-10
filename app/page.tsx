'use client';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import AdminApplicationPortal from '@/components/AdminApplicationPortal';
import { useAdminData } from '@/components/AdminSession';
export default function AdminDashboardPage() {
  const initialData = useAdminData();
  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* CLEAN TOP HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider">
              ADMIN CONSOLE
            </span>
            <span className="text-xs text-slate-400">
              Signed in as <strong className="text-white">Admin</strong>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1.5 tracking-tight flex items-center gap-2">
            <span>Admin Portal</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Episode 3 applications · Previous episode archived from this website view. Join Team and GGL Talent Trip remain active.
          </p>
          <Link href="/malik/talent-trip" className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-black text-amber-200 hover:bg-amber-400/20">GGL Talent Trip Management <span className="rounded bg-red-600 px-1.5 py-0.5 text-[9px] text-white">NEW</span></Link>
        </div>

        {/* LOGOUT BUTTON */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <form action="/api/malik/logout" method="POST">
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-red-500/60 text-slate-300 hover:text-red-400 font-bold text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer"
              title="Log out and return to admin login"
            >
              <LogOut className="w-4 h-4 text-red-400" />
              <span>LOG OUT</span>
            </button>
          </form>
        </div>
      </div>

      {/* STREAMLINED APPLICATION DASHBOARD & EXCEL SPREADSHEET MANAGER */}
      <AdminApplicationPortal initialData={initialData} />
    </div>
  );
}
