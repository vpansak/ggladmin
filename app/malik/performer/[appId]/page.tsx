
'use client';
import { use } from 'react';
import { useAdminData } from '@/components/AdminSession';
import Link from 'next/link';
export default function PerformerRecord({params}: {params: Promise<{appId: string}>}) {
  const {appId} = use(params);
  const {performers} = useAdminData();
  const record = performers.find(item => item.app_id === appId);
  if (!record) return <main className="mx-auto max-w-4xl px-5 py-12"><Link href="/" className="text-amber-300">← Admin dashboard</Link><p className="mt-6">Performer not found in the current episode.</p></main>;
  return <main className="mx-auto max-w-4xl px-5 py-12 text-white"><Link href="/" className="text-amber-300">← Admin dashboard</Link><h1 className="my-6 text-3xl font-bold">{record.full_name} · {appId}</h1><dl className="space-y-3">{Object.entries({...record,...(record.detail_answers||{})}).map(([key,value])=><div key={key} className="rounded-xl border border-slate-700 bg-slate-900 p-4"><dt className="text-sm text-amber-300">{key.replaceAll('_',' ')}</dt><dd className="mt-2 whitespace-pre-wrap break-words">{typeof value==='object'?JSON.stringify(value,null,2):String(value??'—')}</dd></div>)}</dl></main>;
}
