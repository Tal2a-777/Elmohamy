import { useMemo, useState } from 'react';
import {
  BellRing,
  Briefcase,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  Download,
  Eye,
  FileSpreadsheet,
  FolderPlus,
  Mail,
  MessageSquare,
  MessageSquareShare,
  PauseCircle,
  Scale,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  CaseStatus,
  Client,
  LegalCase,
  NotificationItem,
  OfficeSettings,
  Procedure,
} from '../types/legal.ts';
import {
  calculateDashboardStats,
  computeAutomatedReminderPlan,
  filterCases,
  generateCsvContent,
  generateHearingIcsEvent,
  getUpcomingHearings,
  type AutomatedReminderCandidate,
  type UpcomingHearing,
} from '../utils/legalLogic.ts';
import { CaseStatusTag, HearingUrgencyTag } from './StatusBadge.tsx';

interface DashboardViewProps {
  clients: Client[];
  cases: LegalCase[];
  procedures: Procedure[];
  notifications: NotificationItem[];
  settings: OfficeSettings;
  onOpenNewCase: () => void;
  onOpenClients: () => void;
  onOpenCases: () => void;
  onOpenProcedures: () => void;
  onOpenAddClient?: () => void;
  onScheduleHearing: (caseId: number, hearingDate: string, notes: string) => Promise<void>;
  onSelectCase: (legalCase: LegalCase) => void;
  onSendReminder: (
    hearing: UpcomingHearing,
    channel: 'whatsapp' | 'email' | 'sms',
    customMessage?: string,
  ) => void;
  canCreateCase: boolean;
}

export function DashboardView({
  clients,
  cases,
  procedures,
  notifications,
  settings,
  onOpenNewCase,
  onOpenClients,
  onOpenCases,
  onOpenProcedures,
  onScheduleHearing,
  onSelectCase,
  onSendReminder,
  canCreateCase,
}: DashboardViewProps) {
  const [query, setQuery] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all');
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  // Quick Schedule Hearing Modal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleCaseId, setScheduleCaseId] = useState<number>(cases[0]?.id || 0);
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().slice(0, 10));
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [scheduling, setScheduling] = useState(false);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const stats = useMemo(
    () =>
      calculateDashboardStats(
        clients,
        cases,
        procedures,
        todayIso,
        settings.reminderDaysBefore,
      ),
    [clients, cases, procedures, todayIso, settings.reminderDaysBefore],
  );

  const filteredCases = useMemo(() => {
    const base = filterCases(cases, clients, procedures, {
      query,
      caseType: typeFilter,
      status: statusFilter,
    });
    if (clientFilter === 'all') return base;
    return base.filter((c) => String(c.clientId) === clientFilter);
  }, [cases, clients, procedures, query, typeFilter, statusFilter, clientFilter]);

  const upcomingHearings = useMemo(
    () =>
      getUpcomingHearings(
        cases,
        clients,
        procedures,
        todayIso,
        settings.reminderDaysBefore,
      ),
    [cases, clients, procedures, todayIso, settings.reminderDaysBefore],
  );

  const automatedReminders = useMemo(
    () => computeAutomatedReminderPlan(cases, clients, todayIso),
    [cases, clients, todayIso],
  );

  const clientMap = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients],
  );

  const handleDispatchAutomated = (
    candidate: AutomatedReminderCandidate,
    channel: 'whatsapp' | 'email' | 'sms',
  ) => {
    const linked = upcomingHearings.find((h) => h.caseId === candidate.caseId) || {
      caseId: candidate.caseId,
      caseCode: candidate.caseCode,
      officialNumber: '',
      subject: candidate.subject,
      clientId: 0,
      clientName: candidate.clientName,
      lawyerName: candidate.lawyerName,
      courtName: '',
      hearingDate: candidate.hearingDate,
      daysUntil: candidate.tier === '72h' ? 3 : candidate.tier === '24h' ? 1 : 0,
      urgency: 'urgent',
      sourceLabel: candidate.tierLabel,
    };
    onSendReminder(linked, channel, candidate.message);
    const channelLabel =
      channel === 'whatsapp' ? 'واتساب' : channel === 'sms' ? 'رسالة SMS' : 'البريد الإلكتروني';
    setActionBanner(
      `تم تسجيل وإرسال ${candidate.tierLabel} عبر ${channelLabel} للعميل ${candidate.clientName}.`,
    );
  };

  const handleExportCsv = () => {
    const headers = ['رمز الملف', 'الرقم الرسمي', 'موضوع القضية', 'العميل', 'المحامي', 'الجهة', 'الحالة', 'الجلسة القادمة'];
    const rows = filteredCases.map((c) => [
      c.caseCode,
      c.officialNumber,
      c.subject,
      clientMap.get(c.clientId)?.name || '',
      c.lawyerName,
      c.courtName,
      c.status === 'active' ? 'قيد المتابعة' : c.status === 'suspended' ? 'موقوفة' : 'مغلقة',
      c.nextHearingDate || '-',
    ]);
    const csv = generateCsvContent(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `سجل-القضايا-${todayIso}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setActionBanner(`تم تصدير ${filteredCases.length} قضية إلى ملف CSV بنجاح.`);
  };

  const handleDownloadIcs = (hearing: UpcomingHearing) => {
    const ics = generateHearingIcsEvent(hearing, settings.officeName);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hearing-${hearing.caseCode}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    setActionBanner(`تم تجهيز ملف التقويم (.ics) لجلسة القضية ${hearing.caseCode}.`);
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleCaseId || !scheduleDate) return;
    setScheduling(true);
    try {
      await onScheduleHearing(scheduleCaseId, scheduleDate, scheduleNotes);
      setScheduleModalOpen(false);
      setScheduleNotes('');
      setActionBanner('تمت جدولة الموعد وتحديث جدول الجلسات القريبة بنجاح.');
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="dashboard-view">
      {/* Page Title & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1E47] dark:text-white">
            السجل الرئيسي للعملاء والقضايا
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            لوحة المتابعة اليومية · القضايا الجارية والمواعيد القريبة
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#1D5CE5] dark:text-amber-400" aria-hidden="true" />
            <span>تصدير التقرير</span>
          </button>

          {canCreateCase && (
            <button
              type="button"
              onClick={onOpenNewCase}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-[#1D5CE5] to-[#1545B5] text-white hover:from-[#1A52CE] hover:to-[#123B9E] shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" aria-hidden="true" />
              <span>فتح ملف قضية</span>
            </button>
          )}
        </div>
      </div>

      {/* Top 4-Control Search & Filter Strip (matching reference IMG_3809) */}
      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
        <div className="lg:col-span-3">
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            aria-label="تصفية حسب العميل"
            className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
          >
            <option value="all">العميل: الكل</option>
            {clients.map((cl) => (
              <option key={cl.id} value={String(cl.id)}>
                {cl.name}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="تصفية حسب نوع القضية"
            className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
          >
            <option value="all">نوع القضية: الكل</option>
            {settings.caseTypes.map((ct) => (
              <option key={ct} value={ct}>
                {ct}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CaseStatus | 'all')}
            aria-label="تصفية حسب الحالة"
            className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 text-slate-800 dark:text-slate-200"
          >
            <option value="all">الحالة: الكل</option>
            <option value="active">قيد المتابعة</option>
            <option value="suspended">موقوفة</option>
            <option value="closed">مغلقة</option>
          </select>
        </div>

        <div className="relative lg:col-span-5">
          <Search
            className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="بحث متقدم في القضايا والعملاء والمستندات"
            placeholder="بحث برقم القضية أو اسم العميل أو موضوع القضية..."
            className="w-full pr-9 pl-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D5CE5]"
          />
        </div>
      </div>

      {actionBanner && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-800 dark:text-emerald-200">
          <span>{actionBanner}</span>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            className="underline font-semibold shrink-0 cursor-pointer"
          >
            إخفاء
          </button>
        </div>
      )}

      {/* Top 3 Hero KPI Cards (matching IMG_3809 architecture) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Card 1: Featured Royal Cobalt Blue Card — Total Cases + 3 Status Sub-tiles */}
        <div className="lg:col-span-5 rounded-2xl bg-gradient-to-br from-[#2364EE] via-[#1B53D6] to-[#0E39A3] text-white p-5 shadow-md flex flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-blue-100">إجمالي القضايا</p>
              <p className="font-mono-num text-4xl font-extrabold tracking-tight">
                {stats.totalCases}
              </p>
            </div>

            <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <Scale className="w-6 h-6 text-amber-300" aria-hidden="true" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mt-5">
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
              className={`p-2.5 rounded-xl border text-right transition-colors cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-white/25 border-white/50'
                  : 'bg-white/10 border-white/15 hover:bg-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-blue-100">متابعة</span>
                <Briefcase className="w-3.5 h-3.5 text-blue-200" aria-hidden="true" />
              </div>
              <span className="font-mono-num text-xl font-bold block">{stats.activeCases}</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'closed' ? 'all' : 'closed')}
              className={`p-2.5 rounded-xl border text-right transition-colors cursor-pointer ${
                statusFilter === 'closed'
                  ? 'bg-white/25 border-white/50'
                  : 'bg-white/10 border-white/15 hover:bg-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-blue-100">مغلقة</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
              </div>
              <span className="font-mono-num text-xl font-bold block">{stats.closedCases}</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'suspended' ? 'all' : 'suspended')}
              className={`p-2.5 rounded-xl border text-right transition-colors cursor-pointer ${
                statusFilter === 'suspended'
                  ? 'bg-white/25 border-white/50'
                  : 'bg-white/10 border-white/15 hover:bg-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-blue-100">موقوفة</span>
                <PauseCircle className="w-3.5 h-3.5 text-rose-300" aria-hidden="true" />
              </div>
              <span className="font-mono-num text-xl font-bold block">{stats.suspendedCases}</span>
            </button>
          </div>
        </div>

        {/* Card 2: Warm Amber-Tinted Card — Upcoming Hearings */}
        <div className="lg:col-span-4 rounded-2xl bg-gradient-to-br from-[#FFFDF7] to-[#FEF5E4] dark:from-slate-900 dark:to-amber-950/20 border border-amber-200/70 dark:border-amber-900/50 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#0B1E47] dark:text-slate-100">
                مواعيد قريبة
              </p>
              <p className="font-mono-num text-4xl font-extrabold text-[#B45309] dark:text-amber-400 mt-2">
                {stats.upcomingHearingsCount}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5">
                {stats.urgentHearingsCount === 0
                  ? `خلال ${settings.reminderDaysBefore} أيام قادمة`
                  : stats.urgentHearingsCount === 1
                    ? 'جلسة واحدة عاجلة أو متأخرة'
                    : `${stats.urgentHearingsCount} جلسات عاجلة أو متأخرة`}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-100/80 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
              <CalendarClock className="w-6 h-6 text-[#D97706] dark:text-amber-400" aria-hidden="true" />
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenProcedures}
            className="mt-4 pt-3 border-t border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between text-xs font-semibold text-[#0B1E47] dark:text-amber-300 hover:text-[#1D5CE5] cursor-pointer"
          >
            <span>عرض المواعيد القادمة</span>
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Card 3: Ice-Blue Tinted Card — Total Clients */}
        <div className="lg:col-span-3 rounded-2xl bg-gradient-to-br from-white to-[#EEF4FF] dark:from-slate-900 dark:to-slate-900 border border-blue-100 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#0B1E47] dark:text-slate-100">
                إجمالي العملاء
              </p>
              <p className="font-mono-num text-4xl font-extrabold text-[#0B1E47] dark:text-white mt-2">
                {stats.totalClients}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                {stats.activeClients} حساب نشط
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-100/80 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6 text-[#1D5CE5] dark:text-blue-400" aria-hidden="true" />
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenClients}
            className="mt-4 pt-3 border-t border-blue-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-[#0B1E47] dark:text-blue-300 hover:text-[#1D5CE5] cursor-pointer"
          >
            <span>عرض قائمة العملاء</span>
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Main Split: Recent Cases Table + Upcoming Hearings */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Recent Cases Table */}
        <section className="xl:col-span-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white">
              أحدث القضايا
            </h2>
            <button
              type="button"
              onClick={onOpenCases}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D5CE5] dark:text-amber-400 hover:underline cursor-pointer"
            >
              <span>عرض الكل</span>
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {filteredCases.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                لا توجد قضايا مطابقة لمعايير البحث الحالية.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setClientFilter('all');
                  setTypeFilter('all');
                  setStatusFilter('all');
                }}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                إعادة ضبط الفلاتر
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-3 font-semibold whitespace-nowrap">رمز الملف</th>
                    <th className="px-3 py-3 font-semibold">موضوع القضية</th>
                    <th className="px-3 py-3 font-semibold">العميل</th>
                    <th className="px-3 py-3 font-semibold">المحامي والجهة</th>
                    <th className="px-3 py-3 font-semibold whitespace-nowrap">الحالة</th>
                    <th className="px-3 py-3 font-semibold whitespace-nowrap text-center">عرض</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredCases.slice(0, 6).map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-3 py-3 whitespace-nowrap align-middle">
                        <span className="font-mono-num text-xs font-bold text-[#0B1E47] dark:text-amber-400 block">
                          {c.caseCode}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono-num">
                          {c.officialNumber}
                        </span>
                      </td>
                      <td className="px-3 py-3 min-w-[170px] max-w-[230px] align-middle">
                        <button
                          type="button"
                          onClick={() => onSelectCase(c)}
                          className="text-right text-xs font-semibold text-slate-900 dark:text-slate-100 hover:text-[#1D5CE5] dark:hover:text-amber-400 line-clamp-2 cursor-pointer"
                        >
                          {c.subject}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700 dark:text-slate-300 max-w-[130px] align-middle">
                        <span className="line-clamp-2">{clientMap.get(c.clientId)?.name || '—'}</span>
                      </td>
                      <td className="px-3 py-3 text-xs align-middle max-w-[150px]">
                        <div className="text-slate-800 dark:text-slate-200 font-medium truncate">
                          {c.lawyerName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {c.courtName}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap align-middle">
                        <CaseStatusTag status={c.status} />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap align-middle text-center">
                        <button
                          type="button"
                          onClick={() => onSelectCase(c)}
                          aria-label={`عرض تفاصيل القضية ${c.caseCode}`}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 dark:bg-slate-800 text-[#1D5CE5] dark:text-amber-400 hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Upcoming Hearings Panel */}
        <section className="xl:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-[#D97706] dark:text-amber-400" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white">
                المواعيد القريبة
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
              {upcomingHearings.length} مواعيد
            </span>
          </div>

          <div className="p-3.5 space-y-3">
            {upcomingHearings.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                لا توجد جلسات مجدولة خلال الفترة القادمة.
              </div>
            ) : (
              upcomingHearings.slice(0, 4).map((h) => (
                <div
                  key={h.caseId}
                  className="p-3.5 rounded-xl bg-amber-50/40 dark:bg-slate-950/60 border border-amber-200/70 dark:border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-num text-xs font-bold text-[#0B1E47] dark:text-white">
                      {h.hearingDate}
                    </span>
                    <HearingUrgencyTag urgency={h.urgency} daysUntil={h.daysUntil} />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        const target = cases.find((x) => x.id === h.caseId);
                        if (target) onSelectCase(target);
                      }}
                      className="text-right text-xs font-bold text-slate-900 dark:text-slate-100 hover:text-[#1D5CE5] line-clamp-1 cursor-pointer"
                    >
                      {h.caseCode} — {h.subject}
                    </button>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                      معتمد من {h.lawyerName} · {h.courtName}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleDownloadIcs(h)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <CalendarPlus className="w-3 h-3 text-[#1D5CE5]" aria-hidden="true" />
                      <span>التقويم</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSendReminder(h, 'whatsapp');
                        setActionBanner(`تم إرسال تنبيه WhatsApp لموعد القضية ${h.caseCode} إلى ${h.clientName}.`);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 cursor-pointer"
                    >
                      <MessageSquareShare className="w-3 h-3" aria-hidden="true" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSendReminder(h, 'sms');
                        setActionBanner(`تم إرسال تنبيه SMS لموعد القضية ${h.caseCode} إلى ${h.clientName}.`);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-blue-200 dark:border-blue-900 text-[#1D5CE5] dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 cursor-pointer"
                    >
                      <MessageSquare className="w-3 h-3" aria-hidden="true" />
                      <span>SMS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSendReminder(h, 'email');
                        setActionBanner(`تم إرسال تذكير البريد الإلكتروني لموعد القضية ${h.caseCode}.`);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Mail className="w-3 h-3" aria-hidden="true" />
                      <span>إيميل</span>
                    </button>
                  </div>
                </div>
              ))
            )}

            <button
              type="button"
              onClick={onOpenProcedures}
              className="w-full py-2 text-xs font-semibold text-[#1D5CE5] dark:text-amber-400 rounded-lg border border-blue-100 dark:border-slate-800 hover:bg-blue-50/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              عرض جميع المواعيد ({upcomingHearings.length})
            </button>
          </div>
        </section>
      </div>

      {/* Automated Pre-Hearing Alert Center (72h / 24h / Today) + Dispatch Log */}
      {(automatedReminders.length > 0 || notifications.length > 0) && (
        <section
          data-testid="automated-alerts-center"
          className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-[#1D5CE5]" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white">
                مركز التنبيهات الآلية متعددة القنوات (قبل 72 ساعة / 24 ساعة / اليوم)
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-mono-num">
              {automatedReminders.length} تنبيه مجدول · {notifications.length} إشعار مرسل
            </span>
          </div>

          {automatedReminders.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {automatedReminders.map((cand) => {
                const cleanPhone = cand.clientPhone.replace(/[^\d]/g, '');
                return (
                  <div
                    key={`${cand.caseId}-${cand.tier}`}
                    className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                        {cand.tierLabel}
                      </span>
                      <span className="font-mono-num text-xs font-bold text-[#0B1E47] dark:text-white">
                        {cand.hearingDate}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {cand.message}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDispatchAutomated(cand, 'whatsapp')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                      >
                        <MessageSquareShare className="w-3 h-3" aria-hidden="true" />
                        <span>إرسال WhatsApp</span>
                      </button>
                      {settings.smsEnabled && (
                        <button
                          type="button"
                          onClick={() => handleDispatchAutomated(cand, 'sms')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-[#1D5CE5] text-white hover:bg-[#1545B5] cursor-pointer"
                        >
                          <MessageSquare className="w-3 h-3" aria-hidden="true" />
                          <span>إرسال SMS</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDispatchAutomated(cand, 'email')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 cursor-pointer"
                      >
                        <Mail className="w-3 h-3" aria-hidden="true" />
                        <span>بريد إلكتروني</span>
                      </button>
                      {cleanPhone && (
                        <a
                          href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(cand.message)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 underline mr-auto"
                        >
                          فتح محادثة واتساب
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {notifications.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                آخر الإشعارات المرسلة:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {notifications.slice(0, 3).map((n) => (
                  <div
                    key={n.id}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 text-[11px] space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>{n.recipientName}</span>
                      <span className="uppercase text-[#1D5CE5] dark:text-amber-400">
                        {n.channel}
                      </span>
                    </div>
                    <p className="text-slate-500 line-clamp-1">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Bottom 4 Quick Action Shortcut Cards (matching IMG_3809) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={onOpenClients}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-[#1D5CE5]/50 shadow-xs flex items-center justify-between gap-3 text-right transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0B1E47] dark:text-white">إضافة عميل جديد</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">تسجيل عميل جديد</p>
            </div>
          </div>
          <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onOpenNewCase}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-[#1D5CE5]/50 shadow-xs flex items-center justify-between gap-3 text-right transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#1D5CE5] dark:text-blue-400 flex items-center justify-center shrink-0">
              <FolderPlus className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0B1E47] dark:text-white">فتح ملف قضية</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">إنشاء ملف قضية جديد</p>
            </div>
          </div>
          <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (cases[0]) setScheduleCaseId(cases[0].id);
            setScheduleModalOpen(true);
          }}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-[#1D5CE5]/50 shadow-xs flex items-center justify-between gap-3 text-right transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-[#D97706] dark:text-amber-400 flex items-center justify-center shrink-0">
              <CalendarPlus className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0B1E47] dark:text-white">إضافة موعد</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">جدولة موعد جلسة</p>
            </div>
          </div>
          <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={handleExportCsv}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-[#1D5CE5]/50 shadow-xs flex items-center justify-between gap-3 text-right transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#0B1E47] dark:text-slate-200 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0B1E47] dark:text-white">تصدير البيانات</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">تصدير قائمة القضايا</p>
            </div>
          </div>
          <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
        </button>
      </div>

      {/* Quick Schedule Hearing Modal */}
      {scheduleModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 id="schedule-modal-title" className="font-display text-base font-bold text-[#0B1E47] dark:text-white">
                جدولة موعد جلسة جديدة
              </h3>
              <button
                type="button"
                onClick={() => setScheduleModalOpen(false)}
                aria-label="إغلاق نافذة جدولة الموعد"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleScheduleSubmit} className="p-5 space-y-4">
              <div>
                <label htmlFor="sched-case" className="block text-xs font-medium mb-1">
                  القضية *
                </label>
                <select
                  id="sched-case"
                  value={scheduleCaseId}
                  onChange={(e) => setScheduleCaseId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.caseCode} — {c.subject}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sched-date" className="block text-xs font-medium mb-1">
                  تاريخ الجلسة *
                </label>
                <input
                  id="sched-date"
                  type="date"
                  required
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
                />
              </div>
              <div>
                <label htmlFor="sched-notes" className="block text-xs font-medium mb-1">
                  بيان الموعد / المطلوب تحضيره
                </label>
                <input
                  id="sched-notes"
                  type="text"
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  placeholder="مثال: جلسة مرافعة وتقديم المستندات"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={scheduling}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#1D5CE5] text-white hover:bg-[#1545B5] cursor-pointer"
                >
                  {scheduling ? 'جاري الحفظ...' : 'حفظ الموعد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
