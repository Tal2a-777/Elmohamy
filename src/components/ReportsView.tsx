import { useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  Download,
  FolderSearch,
  Printer,
  UserCheck,
} from 'lucide-react';
import type {
  Client,
  Invoice,
  Lawyer,
  LegalCase,
  OfficeSettings,
  Procedure,
} from '../types/legal.ts';
import {
  calculateClientFinancialSummary,
  generateCsvContent,
  getUpcomingHearings,
} from '../utils/legalLogic.ts';
import { CaseStatusTag, HearingUrgencyTag } from './StatusBadge.tsx';

type ReportType = 'by-lawyer' | 'by-status' | 'client-statement' | 'hearings';

interface ReportsViewProps {
  clients: Client[];
  lawyers: Lawyer[];
  cases: LegalCase[];
  procedures: Procedure[];
  invoices: Invoice[];
  settings: OfficeSettings;
}

export function ReportsView({
  clients,
  lawyers,
  cases,
  procedures,
  invoices,
  settings,
}: ReportsViewProps) {
  const [reportType, setReportType] = useState<ReportType>('by-lawyer');
  const [fromDate, setFromDate] = useState('2025-01-01');
  const [toDate, setToDate] = useState('2027-12-31');
  const [selectedLawyer, setSelectedLawyer] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedClientId, setSelectedClientId] = useState<number>(clients[0]?.id || 0);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const dateFilteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (fromDate && c.createdAt < fromDate) return false;
      if (toDate && c.createdAt > toDate) return false;
      if (reportType === 'by-lawyer' && selectedLawyer !== 'all' && c.lawyerName !== selectedLawyer) {
        return false;
      }
      if (reportType === 'by-status' && selectedStatus !== 'all' && c.status !== selectedStatus) {
        return false;
      }
      if (reportType === 'client-statement' && selectedClientId && c.clientId !== selectedClientId) {
        return false;
      }
      return true;
    });
  }, [cases, fromDate, toDate, reportType, selectedLawyer, selectedStatus, selectedClientId]);

  const lawyerBreakdown = useMemo(() => {
    const names = Array.from(
      new Set([...lawyers.map((l) => l.name), ...dateFilteredCases.map((c) => c.lawyerName)]),
    );
    return names.map((name) => {
      const owned = dateFilteredCases.filter((c) => c.lawyerName === name);
      return {
        name,
        active: owned.filter((c) => c.status === 'active').length,
        closed: owned.filter((c) => c.status === 'closed').length,
        suspended: owned.filter((c) => c.status === 'suspended').length,
        total: owned.length,
      };
    });
  }, [lawyers, dateFilteredCases]);

  const lawyerTotals = useMemo(
    () => ({
      active: lawyerBreakdown.reduce((s, r) => s + r.active, 0),
      closed: lawyerBreakdown.reduce((s, r) => s + r.closed, 0),
      suspended: lawyerBreakdown.reduce((s, r) => s + r.suspended, 0),
      total: lawyerBreakdown.reduce((s, r) => s + r.total, 0),
    }),
    [lawyerBreakdown],
  );

  const hearings = useMemo(
    () =>
      getUpcomingHearings(
        cases,
        clients,
        procedures,
        todayIso,
        settings.reminderDaysBefore,
      ).filter((h) => (!fromDate || h.hearingDate >= fromDate) && (!toDate || h.hearingDate <= toDate)),
    [cases, clients, procedures, todayIso, settings.reminderDaysBefore, fromDate, toDate],
  );

  const clientSummary = useMemo(
    () =>
      selectedClientId
        ? calculateClientFinancialSummary(selectedClientId, cases, invoices)
        : null,
    [selectedClientId, cases, invoices],
  );

  const handleExportCsv = () => {
    if (reportType === 'hearings') {
      const csv = generateCsvContent(
        ['تاريخ الجلسة', 'رمز القضية', 'الموضوع', 'العميل', 'المحامي', 'الجهة'],
        hearings.map((h) => [
          h.hearingDate,
          h.caseCode,
          h.subject,
          h.clientName,
          h.lawyerName,
          h.courtName,
        ]),
      );
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `تقرير-المواعيد-${todayIso}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const csv = generateCsvContent(
      ['الرمز', 'الرقم الرسمي', 'الموضوع', 'العميل', 'المحامي', 'الجهة', 'الحالة', 'تاريخ الفتح'],
      dateFilteredCases.map((c) => [
        c.caseCode,
        c.officialNumber,
        c.subject,
        clientMap.get(c.clientId)?.name || '',
        c.lawyerName,
        c.courtName,
        c.status === 'active' ? 'متابعة' : c.status === 'suspended' ? 'موقوفة' : 'مغلقة',
        c.createdAt,
      ]),
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير-${reportType}-${todayIso}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reportCards: {
    id: ReportType;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'by-lawyer',
      title: 'قضايا حسب المحامي',
      subtitle: 'عدد القضايا لكل محامٍ',
      icon: BarChart3,
    },
    {
      id: 'by-status',
      title: 'قضايا حسب الحالة',
      subtitle: 'القضايا موزعة بالحالة',
      icon: FolderSearch,
    },
    {
      id: 'client-statement',
      title: 'كشف العميل',
      subtitle: 'قضايا العميل وحسابه المالي',
      icon: UserCheck,
    },
    {
      id: 'hearings',
      title: 'المواعيد المعتمدة',
      subtitle: 'المواعيد المعتمدة والقادمة',
      icon: CalendarClock,
    },
  ];

  return (
    <div className="space-y-5" data-testid="reports-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1E47] dark:text-white">
            التقارير
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            تقارير القضايا والمواعيد وكشوف الحساب
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#1D5CE5]" aria-hidden="true" />
            <span>تصدير Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-[#1D5CE5] to-[#1545B5] text-white hover:from-[#1A52CE] hover:to-[#123B9E] shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            <span>طباعة / تصدير PDF</span>
          </button>
        </div>
      </div>

      {/* Filters Row matching IMG_3816 */}
      <div className="no-print p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label htmlFor="rep-client" className="block text-[11px] font-medium text-slate-500 mb-1">
            العميل
          </label>
          <select
            id="rep-client"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(Number(e.target.value))}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          >
            {clients.map((cl) => (
              <option key={cl.id} value={cl.id}>
                {cl.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rep-lawyer" className="block text-[11px] font-medium text-slate-500 mb-1">
            المحامي
          </label>
          <select
            id="rep-lawyer"
            value={selectedLawyer}
            onChange={(e) => setSelectedLawyer(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          >
            <option value="all">المحامي: الكل</option>
            {lawyers.map((l) => (
              <option key={l.id} value={l.name}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rep-status" className="block text-[11px] font-medium text-slate-500 mb-1">
            الحالة
          </label>
          <select
            id="rep-status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          >
            <option value="all">الحالة: الكل</option>
            <option value="active">متابعة</option>
            <option value="suspended">موقوفة</option>
            <option value="closed">مغلقة</option>
          </select>
        </div>

        <div>
          <label htmlFor="rep-from" className="block text-[11px] font-medium text-slate-500 mb-1">
            من تاريخ
          </label>
          <input
            id="rep-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
          />
        </div>

        <div>
          <label htmlFor="rep-to" className="block text-[11px] font-medium text-slate-500 mb-1">
            إلى تاريخ
          </label>
          <input
            id="rep-to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
          />
        </div>
      </div>

      {/* 4 Visual Report Type Cards matching IMG_3816 */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {reportCards.map((card) => {
          const Icon = card.icon;
          const isActive = reportType === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setReportType(card.id)}
              className={`p-4 rounded-xl border text-right flex items-center gap-3.5 transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-br from-[#2364EE] to-[#0E39A3] text-white border-[#1D5CE5] shadow-md'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-[#1D5CE5]/50 text-[#0B1E47] dark:text-white'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  isActive
                    ? 'bg-white/20 text-amber-300'
                    : 'bg-blue-50 dark:bg-slate-800 text-[#1D5CE5] dark:text-amber-400'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-display text-sm font-bold">{card.title}</p>
                <p
                  className={`text-[11px] mt-0.5 ${
                    isActive ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {card.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Report Document with Custom Office Letterhead */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0B1E47] dark:text-white">
              {settings.officeName}
            </h2>
            <p className="text-xs text-slate-500">
              {settings.officeAddress} · {settings.officePhone}
            </p>
          </div>
          <div className="text-xs text-slate-500 font-mono-num">
            تاريخ التقرير: {todayIso}
          </div>
        </div>

        {reportType === 'client-statement' && clientSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 block">إجمالي الأتعاب</span>
              <span className="font-mono-num text-lg font-bold">
                {clientSummary.totalFees.toLocaleString('en-US')}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 block">المصروفات القضائية</span>
              <span className="font-mono-num text-lg font-bold">
                {clientSummary.totalExpenses.toLocaleString('en-US')}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 block">إجمالي المدفوع</span>
              <span className="font-mono-num text-lg font-bold text-emerald-700 dark:text-emerald-400">
                {clientSummary.totalPaid.toLocaleString('en-US')}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 block">الرصيد المتبقي</span>
              <span className="font-mono-num text-lg font-bold text-amber-700 dark:text-amber-400">
                {clientSummary.balanceDue.toLocaleString('en-US')}
              </span>
            </div>
          </div>
        )}

        {reportType === 'by-lawyer' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold">المحامي</th>
                  <th className="px-4 py-3 font-semibold text-center">متابعة</th>
                  <th className="px-4 py-3 font-semibold text-center">مغلق</th>
                  <th className="px-4 py-3 font-semibold text-center">موقوف</th>
                  <th className="px-4 py-3 font-semibold text-center">إجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {lawyerBreakdown.map((row) => (
                  <tr key={row.name}>
                    <td className="px-4 py-3 text-xs font-semibold">{row.name}</td>
                    <td className="px-4 py-3 text-center font-mono-num text-xs">{row.active}</td>
                    <td className="px-4 py-3 text-center font-mono-num text-xs">{row.closed}</td>
                    <td className="px-4 py-3 text-center font-mono-num text-xs">{row.suspended}</td>
                    <td className="px-4 py-3 text-center font-mono-num text-xs font-bold">{row.total}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 dark:bg-slate-950/60 font-bold">
                  <td className="px-4 py-3 text-xs">الإجمالي</td>
                  <td className="px-4 py-3 text-center font-mono-num text-xs">{lawyerTotals.active}</td>
                  <td className="px-4 py-3 text-center font-mono-num text-xs">{lawyerTotals.closed}</td>
                  <td className="px-4 py-3 text-center font-mono-num text-xs">{lawyerTotals.suspended}</td>
                  <td className="px-4 py-3 text-center font-mono-num text-xs text-[#1D5CE5] dark:text-amber-400">
                    {lawyerTotals.total}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : reportType === 'hearings' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold">تاريخ الجلسة</th>
                  <th className="px-4 py-3 font-semibold">القضية</th>
                  <th className="px-4 py-3 font-semibold">العميل</th>
                  <th className="px-4 py-3 font-semibold">المحامي</th>
                  <th className="px-4 py-3 font-semibold">المحكمة</th>
                  <th className="px-4 py-3 font-semibold">الأولوية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {hearings.map((h) => (
                  <tr key={h.caseId}>
                    <td className="px-4 py-3 font-mono-num text-xs font-bold">{h.hearingDate}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="font-mono-num font-semibold">{h.caseCode}</span> — {h.subject}
                    </td>
                    <td className="px-4 py-3 text-xs">{h.clientName}</td>
                    <td className="px-4 py-3 text-xs">{h.lawyerName}</td>
                    <td className="px-4 py-3 text-xs">{h.courtName}</td>
                    <td className="px-4 py-3">
                      <HearingUrgencyTag urgency={h.urgency} daysUntil={h.daysUntil} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold">الرمز</th>
                  <th className="px-4 py-3 font-semibold">الموضوع</th>
                  <th className="px-4 py-3 font-semibold">العميل</th>
                  <th className="px-4 py-3 font-semibold">المحامي</th>
                  <th className="px-4 py-3 font-semibold">الجهة</th>
                  <th className="px-4 py-3 font-semibold">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dateFilteredCases.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-mono-num text-xs font-semibold">{c.caseCode}</td>
                    <td className="px-4 py-3 text-xs font-medium">{c.subject}</td>
                    <td className="px-4 py-3 text-xs">{clientMap.get(c.clientId)?.name || '—'}</td>
                    <td className="px-4 py-3 text-xs">{c.lawyerName}</td>
                    <td className="px-4 py-3 text-xs">{c.courtName}</td>
                    <td className="px-4 py-3">
                      <CaseStatusTag status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
