'use client';

import { useDroppable } from '@dnd-kit/core';
import type { OrderStatus } from '@/types/order';

interface Props {
  status: OrderStatus;
  label: string;
  count: number;
  dot: string;
  tint: string;
  children: React.ReactNode;
}

export function KdsColumn({ status, label, count, dot, tint, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl p-3 space-y-3 min-h-[200px] transition-colors duration-150 ${tint} ${
        isOver ? 'ring-2 ring-command-700 ring-offset-2' : ''
      }`}
    >
      <div className="flex items-center gap-2 px-1">
        <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
        <h2 className="font-bold text-sm text-slate-700">{label}</h2>
        <span className="px-2 py-0.5 rounded-full bg-white/70 text-slate-600 text-xs font-semibold">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
