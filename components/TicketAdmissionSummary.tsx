import { getTicketQuantity } from '@/lib/ticketQuantity';

export default function TicketAdmissionSummary({ quantity, compact = false }: { quantity: unknown; compact?: boolean }) {
  const count = getTicketQuantity(quantity);
  return (
    <div className={`rounded-xl border border-amber-400/70 bg-amber-400/10 text-center ${compact ? 'px-3 py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1' : 'px-4 py-3'}`}>
      <div className={`${compact ? 'text-base' : 'text-xl'} font-black text-amber-300`}>TICKETS × {count}</div>
      <div className={`${compact ? 'text-xs' : 'text-sm'} font-bold text-white`}>{count === 1 ? '1 व्यक्ति का टिकट' : `${count} लोगों का टिकट`}</div>
    </div>
  );
}
