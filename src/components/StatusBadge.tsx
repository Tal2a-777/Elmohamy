import { AlertTriangle, CheckCircle2, Clock, PauseCircle, XCircle } from 'lucide-react';
import type { CaseStatus, AccountStatus, InvoiceStatus } from '../types/legal.ts';
import type { HearingUrgency } from '../utils/legalLogic.ts';

export function CaseStatusTag({ status }: { status: CaseStatus }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border border-amber-200 dark:border-amber-900/70 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
        <span>قيد المتابعة</span>
      </span>
    );
  }
  if (status === 'suspended') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 whitespace-nowrap">
        <PauseCircle className="w-3.5 h-3.5" aria-hidden="true" />
        <span>موقوفة</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
      <span>مغلقة</span>
    </span>
  );
}

export function AccountStatusTag({ status }: { status: AccountStatus }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
        <span>نشط</span>
      </span>
    );
  }
  if (status === 'suspended') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border border-amber-200 dark:border-amber-900/70 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 whitespace-nowrap">
        <PauseCircle className="w-3.5 h-3.5" aria-hidden="true" />
        <span>معلق</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 whitespace-nowrap">
      <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
      <span>مقفل</span>
    </span>
  );
}

export function InvoiceStatusTag({ status }: { status: InvoiceStatus }) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
        <span>مدفوعة</span>
      </span>
    );
  }
  if (status === 'partial') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border border-amber-200 dark:border-amber-900/70 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
        <span>مدفوعة جزئياً</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 whitespace-nowrap">
      <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
      <span>غير مسددة</span>
    </span>
  );
}

export function HearingUrgencyTag({
  urgency,
  daysUntil,
}: {
  urgency: HearingUrgency;
  daysUntil: number;
}) {
  if (urgency === 'overdue') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
        <span>متأخر ({Math.abs(daysUntil)} يوم)</span>
      </span>
    );
  }
  if (urgency === 'urgent') {
    const label = daysUntil === 0 ? 'اليوم' : daysUntil === 1 ? 'غداً' : `خلال ${daysUntil} يوم`;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
        <span>عاجل · {label}</span>
      </span>
    );
  }
  if (urgency === 'upcoming') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
        <span>قريب · بعد {daysUntil} أيام</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap">
      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
      <span>بعد {daysUntil} يوم</span>
    </span>
  );
}
