import { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  FolderPlus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import type {
  CaseStatus,
  Client,
  Lawyer,
  LegalCase,
  OfficeSettings,
  Procedure,
} from '../types/legal.ts';
import { filterCases, generateCsvContent } from '../utils/legalLogic.ts';
import { CaseStatusTag } from './StatusBadge.tsx';

interface CasesViewProps {
  cases: LegalCase[];
  clients: Client[];
  lawyers: Lawyer[];
  procedures: Procedure[];
  settings: OfficeSettings;
  selectedCaseId: number | null;
  onSelectCase: (c: LegalCase | null) => void;
  onUpdateCaseStatus: (caseId: number, status: CaseStatus) => Promise<void>;
  onNajizSync: (
    caseId: number,
    payload: { najizStatus: string; najizCircuit: string; nextHearingDate?: string },
  ) => Promise<void>;
  onOpenNewCase: () => void;
  onGoToProcedures: (caseId: number) => void;
  canEdit: boolean;
}

export function CasesView({
  cases,
  clients,
  lawyers,
  procedures,
  settings,
  selectedCaseId,
  onSelectCase,
  onUpdateCaseStatus,
  onNajizSync,
  onOpenNewCase,
  onGoToProcedures,
  canEdit,
}: CasesViewProps) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all');
  const [lawyerFilter, setLawyerFilter] = useState('all');

  // Najiz Sync inline state
  const [najizFormOpen, setNajizFormOpen] = useState(false);
  const [najizCircuit, setNajizCircuit] = useState('الدائرة التجارية الأولى');
  const [najizStatus, setNajizStatus] = useState('قيد النظر القضائي — متزامن مع ناجز');
  const [najizNextDate, setNajizNextDate] = useState('');
  const [syncingNajiz, setSyncingNajiz] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const clientMap = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients],
  );

  const filtered = useMemo(
    () =>
      filterCases(cases, clients, procedures, {
        query,
        caseType: typeFilter,
        status: statusFilter,
        lawyerName: lawyerFilter,
      }),
    [cases, clients, procedures, query, typeFilter, statusFilter, lawyerFilter],
  );

  const selectedCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) ?? null,
    [cases, selectedCaseId],
  );

  const selectedCaseProcedures = useMemo(
    () => (selectedCase ? procedures.filter((p) => p.caseId === selectedCase.id) : []),
    [procedures, selectedCase],
  );

  const handleNajizSyncSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    setSyncingNajiz(true);
    setSyncMessage(null);
    try {
      await onNajizSync(selectedCase.id, {
        najizStatus: najizStatus.trim() || 'قيد النظر القضائي — متزامن مع ناجز',
        najizCircuit: najizCircuit.trim() || 'الدائرة المختصة',
        nextHearingDate: najizNextDate || undefined,
      });
      setNajizFormOpen(false);
      setSyncMessage('تمت مزامنة حالة القضية والدائرة القضائية مع بوابة المحاكم بنجاح.');
    } finally {
      setSyncingNajiz(false);
    }
  };

  const handleExport = () => {
    const csv = generateCsvContent(
      ['رمز الملف', 'الرقم الرسمي', 'الموضوع', 'العميل', 'المحامي', 'الجهة', 'الحالة'],
      filtered.map((c) => [
        c.caseCode,
        c.officialNumber,
        c.subject,
        clientMap.get(c.clientId)?.name || '',
        c.lawyerName,
        c.courtName,
        c.status === 'active' ? 'متابعة' : c.status === 'suspended' ? 'موقوفة' : 'مغلقة',
      ]),
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `قائمة-القضايا-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5" data-testid="cases-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1E47] dark:text-white">
            قائمة ملفات القضايا
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            استعراض وتصفية كافة القضايا والبحث المتقدم داخل نصوص المستندات والمذكرات.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={onOpenNewCase}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-[#1D5CE5] to-[#1545B5] text-white hover:from-[#1A52CE] hover:to-[#123B9E] shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4" aria-hidden="true" />
            <span>فتح ملف قضية جديد</span>
          </button>
        )}
      </div>

      {/* Filters matching IMG_3813 */}
      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
        <div className="lg:col-span-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="تصفية حسب نوع القضية"
            className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950"
          >
            <option value="all">النوع: الكل</option>
            {settings.caseTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CaseStatus | 'all')}
            aria-label="تصفية حسب الحالة"
            className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950"
          >
            <option value="all">الحالة: الكل</option>
            <option value="active">متابعة</option>
            <option value="suspended">موقوفة</option>
            <option value="closed">مغلقة</option>
          </select>
        </div>

        <div className="lg:col-span-3">
          <select
            value={lawyerFilter}
            onChange={(e) => setLawyerFilter(e.target.value)}
            aria-label="تصفية حسب المحامي المكلف"
            className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950"
          >
            <option value="all">المحامي: الكل</option>
            {lawyers.map((l) => (
              <option key={l.id} value={l.name}>
                {l.name}
              </option>
            ))}
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
            aria-label="بحث في سجل القضايا"
            placeholder="بحث برمز الملف أو الموضوع أو اسم العميل..."
            className="w-full pr-9 pl-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <section
          className={`${
            selectedCase ? 'xl:col-span-8' : 'xl:col-span-12'
          } rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3.5 py-3 font-semibold whitespace-nowrap">رمز الملف</th>
                  <th className="px-3.5 py-3 font-semibold">الموضوع</th>
                  <th className="px-3.5 py-3 font-semibold">العميل</th>
                  <th className="px-3.5 py-3 font-semibold">المحامي</th>
                  <th className="px-3.5 py-3 font-semibold">الجهة</th>
                  <th className="px-3.5 py-3 font-semibold whitespace-nowrap">الحالة</th>
                  <th className="px-3.5 py-3 font-semibold whitespace-nowrap text-center">عرض</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filtered.map((c) => {
                  const isSelected = selectedCase?.id === c.id;
                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-blue-50/70 dark:bg-blue-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="font-mono-num text-xs font-bold text-[#0B1E47] dark:text-amber-400 block">
                          {c.caseCode}
                        </span>
                        <span className="font-mono-num text-[11px] text-slate-400">
                          {c.officialNumber} / {c.caseYear}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 max-w-[240px]">
                        <button
                          type="button"
                          onClick={() => onSelectCase(c)}
                          className="text-right text-xs font-semibold text-slate-900 dark:text-slate-100 hover:text-[#1D5CE5] line-clamp-2 cursor-pointer"
                        >
                          {c.subject}
                        </button>
                        <span className="text-[11px] text-slate-500">
                          {c.caseType} · {c.clientRole === 'plaintiff' ? 'مدعٍ' : 'مدعى عليه'}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-xs text-slate-700 dark:text-slate-300">
                        {clientMap.get(c.clientId)?.name || '—'}
                      </td>
                      <td className="px-3.5 py-3 text-xs text-slate-700 dark:text-slate-300">
                        {c.lawyerName}
                      </td>
                      <td className="px-3.5 py-3 text-xs text-slate-600 dark:text-slate-400">
                        {c.courtName}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <CaseStatusTag status={c.status} />
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={() => onSelectCase(c)}
                          aria-label={`عرض تفاصيل القضية ${c.caseCode}`}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 dark:bg-slate-800 text-[#1D5CE5] dark:text-amber-400 hover:bg-blue-100 cursor-pointer"
                        >
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                      لا توجد قضايا مطابقة لمعايير التصفية.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex items-center justify-between">
            <span>عرض 1 إلى {filtered.length} من {cases.length} سجل</span>
          </div>
        </section>

        {selectedCase && (
          <aside className="xl:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-800/60 shadow-sm p-5 space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="font-mono-num text-xs font-bold text-[#1D5CE5] dark:text-amber-400">
                  {selectedCase.caseCode} · رقم رسمي {selectedCase.officialNumber}
                </span>
                <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white mt-1">
                  {selectedCase.subject}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onSelectCase(null)}
                aria-label="إغلاق تفاصيل القضية"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">العميل</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {clientMap.get(selectedCase.clientId)?.name || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">الخصم</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {selectedCase.opponentName}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">المحامي المكلف</span>
                <span className="font-medium">{selectedCase.lawyerName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">الجهة / المحكمة</span>
                <span className="font-medium">{selectedCase.courtName}</span>
              </div>
            </div>

            {canEdit && (
              <div>
                <label htmlFor="case-status-select" className="block text-xs font-medium mb-1">
                  تحديث حالة القضية
                </label>
                <select
                  id="case-status-select"
                  value={selectedCase.status}
                  onChange={(e) =>
                    onUpdateCaseStatus(selectedCase.id, e.target.value as CaseStatus)
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="active">متابعة</option>
                  <option value="suspended">موقوفة</option>
                  <option value="closed">مغلقة</option>
                </select>
              </div>
            )}

            {/* Najiz & Court Portal Sync Section */}
            <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/50 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#0B1E47] dark:text-blue-200">
                  الربط والمزامنة مع منصة ناجز
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setNajizCircuit(selectedCase.najizCircuit || 'الدائرة التجارية الأولى');
                      setNajizStatus(
                        selectedCase.najizStatus || 'قيد النظر القضائي — متزامن مع ناجز',
                      );
                      setNajizNextDate(selectedCase.nextHearingDate || '');
                      setNajizFormOpen((v) => !v);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-[#1D5CE5] text-white hover:bg-[#1545B5] cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" aria-hidden="true" />
                    <span>مزامنة ناجز</span>
                  </button>
                )}
              </div>

              {syncMessage && (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                  {syncMessage}
                </p>
              )}

              <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                <p>
                  <strong>الدائرة القضائية:</strong>{' '}
                  {selectedCase.najizCircuit || 'لم تتم المزامنة بعد'}
                </p>
                <p>
                  <strong>الحالة في ناجز:</strong>{' '}
                  {selectedCase.najizStatus || 'بانتظار المزامنة'}
                </p>
                {selectedCase.lastSyncedAt && (
                  <p className="font-mono-num text-slate-500">
                    آخر مزامنة: {selectedCase.lastSyncedAt}
                  </p>
                )}
              </div>

              {najizFormOpen && canEdit && (
                <form
                  onSubmit={handleNajizSyncSubmit}
                  className="pt-2 border-t border-blue-200/70 dark:border-blue-900 space-y-2"
                >
                  <div>
                    <label htmlFor="najiz-circuit" className="block text-[11px] font-medium mb-0.5">
                      الدائرة / القاضي
                    </label>
                    <input
                      id="najiz-circuit"
                      type="text"
                      value={najizCircuit}
                      onChange={(e) => setNajizCircuit(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label htmlFor="najiz-status" className="block text-[11px] font-medium mb-0.5">
                      حالة القيد الرسمية
                    </label>
                    <input
                      id="najiz-status"
                      type="text"
                      value={najizStatus}
                      onChange={(e) => setNajizStatus(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label htmlFor="najiz-next-date" className="block text-[11px] font-medium mb-0.5">
                      تاريخ الجلسة القادمة المستورد (اختياري)
                    </label>
                    <input
                      id="najiz-next-date"
                      type="date"
                      value={najizNextDate}
                      onChange={(e) => setNajizNextDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-num"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setNajizFormOpen(false)}
                      className="px-3 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-700"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={syncingNajiz}
                      className="px-3 py-1 text-[11px] font-semibold rounded bg-[#1D5CE5] text-white cursor-pointer"
                    >
                      {syncingNajiz ? 'جاري المزامنة...' : 'تحديث من البوابة'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {selectedCase.folderUrl && (
              <a
                href={selectedCase.folderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D5CE5] dark:text-amber-400 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                <span>فتح مجلد القضية السحابي</span>
              </a>
            )}

            {selectedCase.notes && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-600 dark:text-slate-300">
                <strong className="block text-slate-800 dark:text-slate-200 mb-1">ملاحظات:</strong>
                {selectedCase.notes}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  آخر الإجراءات ({selectedCaseProcedures.length})
                </span>
                <button
                  type="button"
                  onClick={() => onGoToProcedures(selectedCase.id)}
                  className="text-xs font-semibold text-[#1D5CE5] dark:text-amber-400 hover:underline cursor-pointer"
                >
                  إدارة الإجراءات والمرفقات
                </button>
              </div>
              {selectedCaseProcedures.slice(0, 3).map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-mono-num">{p.procedureDate}</span>
                    <span>{p.executorName}</span>
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 line-clamp-2">{p.description}</p>
                  {p.attachmentName && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <FileText className="w-3 h-3" aria-hidden="true" />
                      <span className="truncate">{p.attachmentName}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* Bottom 4 Quick Action Cards (matching IMG_3813) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={onOpenNewCase}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#1D5CE5]/50 shadow-xs flex items-center justify-between gap-3 text-right cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-[#1D5CE5] flex items-center justify-center">
              <FolderPlus className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#0B1E47] dark:text-white">فتح ملف قضية</p>
              <p className="text-[11px] text-slate-500">إنشاء ملف قضية جديد</p>
            </div>
          </div>
          <ChevronLeft className="w-4 h-4 text-slate-400" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={handleExport}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#1D5CE5]/50 shadow-xs flex items-center justify-between gap-3 text-right cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-[#D97706] flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#0B1E47] dark:text-white">تصدير السجل</p>
              <p className="text-[11px] text-slate-500">تصدير قائمة القضايا</p>
            </div>
          </div>
          <ChevronLeft className="w-4 h-4 text-slate-400" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => {
            setQuery('');
            setTypeFilter('all');
            setStatusFilter('all');
            setLawyerFilter('all');
          }}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#1D5CE5]/50 shadow-xs flex items-center justify-between gap-3 text-right cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#1D5CE5] flex items-center justify-center">
              <Search className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#0B1E47] dark:text-white">إظهار كل السجلات</p>
              <p className="text-[11px] text-slate-500">إلغاء جميع الفلاتر</p>
            </div>
          </div>
          <ChevronLeft className="w-4 h-4 text-slate-400" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (cases[0]) onGoToProcedures(cases[0].id);
          }}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#1D5CE5]/50 shadow-xs flex items-center justify-between gap-3 text-right cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
              <FolderOpen className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#0B1E47] dark:text-white">سجل الإجراءات</p>
              <p className="text-[11px] text-slate-500">متابعة الجلسات والمذكرات</p>
            </div>
          </div>
          <ChevronLeft className="w-4 h-4 text-slate-400" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
