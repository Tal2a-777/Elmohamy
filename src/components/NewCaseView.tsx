import { useMemo, useState } from 'react';
import { Briefcase, Calendar, FolderPlus, Scale } from 'lucide-react';
import type {
  CaseStatus,
  Client,
  ClientRoleInCase,
  Lawyer,
  LegalCase,
  OfficeSettings,
} from '../types/legal.ts';
import { generateNextCaseCode } from '../utils/legalLogic.ts';

interface NewCaseViewProps {
  clients: Client[];
  lawyers: Lawyer[];
  settings: OfficeSettings;
  onCreateCase: (input: Omit<LegalCase, 'id' | 'createdAt' | 'caseCode'>) => Promise<void>;
  onCancel: () => void;
}

export function NewCaseView({
  clients,
  lawyers,
  settings,
  onCreateCase,
  onCancel,
}: NewCaseViewProps) {
  const currentYear = new Date().getFullYear();
  const [officialNumber, setOfficialNumber] = useState('');
  const [caseYear, setCaseYear] = useState(currentYear);
  const [caseType, setCaseType] = useState(settings.caseTypes[0] || 'تجاري');
  const [subject, setSubject] = useState('');
  const [clientId, setClientId] = useState<number>(clients[0]?.id || 0);
  const [clientRole, setClientRole] = useState<ClientRoleInCase>('plaintiff');
  const [opponentName, setOpponentName] = useState('');
  const [lawyerId, setLawyerId] = useState<number>(lawyers[0]?.id || 0);
  const [courtName, setCourtName] = useState(settings.courts[0] || 'المحكمة التجارية');
  const [nextHearingDate, setNextHearingDate] = useState('');
  const [folderUrl, setFolderUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<CaseStatus>('active');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewCode = generateNextCaseCode(
    settings.autoNumberPrefix,
    caseYear,
    settings.autoNumberNext,
  );

  const effectiveClientId = clientId || clients[0]?.id || 0;
  const effectiveLawyerId = lawyerId || lawyers[0]?.id || 0;

  const selectedClientName = useMemo(
    () => clients.find((c) => c.id === effectiveClientId)?.name || '—',
    [clients, effectiveClientId],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officialNumber.trim() || !subject.trim() || !effectiveClientId || !opponentName.trim()) {
      setError('يرجى استكمال كافة الحقول الإلزامية (الرقم الرسمي، الموضوع، العميل، والطرف الآخر).');
      return;
    }
    const chosenLawyer = lawyers.find((l) => l.id === effectiveLawyerId);
    setSubmitting(true);
    setError(null);
    try {
      await onCreateCase({
        officialNumber: officialNumber.trim(),
        caseYear,
        subject: subject.trim(),
        caseType,
        clientId: effectiveClientId,
        clientRole,
        opponentName: opponentName.trim(),
        lawyerId: chosenLawyer ? chosenLawyer.id : null,
        lawyerName: chosenLawyer ? chosenLawyer.name : 'غير محدد',
        courtName,
        status,
        folderUrl: folderUrl.trim(),
        notes: notes.trim(),
        nextHearingDate,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر فتح ملف القضية.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="new-case-view">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0B1E47] dark:text-white">
          فتح ملف قضية جديد
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          إدخال بيانات القضية مع معاينة حية لبطاقة الملف والترقيم التلقائي
        </p>
      </div>

      {/* 2-Column Split matching IMG_3815 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Column (8 cols) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-8 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5"
        >
          <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            بيانات القضية
          </h2>

          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300"
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="case-preview-code" className="block text-xs font-medium mb-1">
                رقم القضية التلقائي
              </label>
              <input
                id="case-preview-code"
                type="text"
                readOnly
                value={previewCode}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-mono-num font-bold text-[#1D5CE5] dark:text-amber-400"
              />
            </div>

            <div>
              <label htmlFor="case-official-num" className="block text-xs font-medium mb-1">
                الرقم الرسمي للقضية *
              </label>
              <input
                id="case-official-num"
                type="text"
                required
                placeholder="مثال: 45902114"
                value={officialNumber}
                onChange={(e) => setOfficialNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
              />
            </div>

            <div>
              <label htmlFor="case-client" className="block text-xs font-medium mb-1">
                العميل *
              </label>
              <select
                id="case-client"
                value={clientId || clients[0]?.id || 0}
                onChange={(e) => setClientId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                {clients.length === 0 && (
                  <option value={0}>سجّل عميلاً أولاً من شاشة العملاء</option>
                )}
                {clients.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.clientCode} — {cl.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="case-year" className="block text-xs font-medium mb-1">
                السنة *
              </label>
              <input
                id="case-year"
                type="number"
                required
                min={2000}
                max={2099}
                value={caseYear}
                onChange={(e) => setCaseYear(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
              />
            </div>

            <div>
              <label htmlFor="case-subject" className="block text-xs font-medium mb-1">
                الموضوع *
              </label>
              <input
                id="case-subject"
                type="text"
                required
                placeholder="موضوع القضية"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div>
              <label htmlFor="case-type" className="block text-xs font-medium mb-1">
                نوع القضية *
              </label>
              <select
                id="case-type"
                value={caseType}
                onChange={(e) => setCaseType(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                {settings.caseTypes.map((ct) => (
                  <option key={ct} value={ct}>
                    {ct}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="case-client-role" className="block text-xs font-medium mb-1">
                صفة العميل *
              </label>
              <select
                id="case-client-role"
                value={clientRole}
                onChange={(e) => setClientRole(e.target.value as ClientRoleInCase)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value="plaintiff">مدعٍ</option>
                <option value="defendant">مدعى عليه</option>
              </select>
            </div>

            <div>
              <label htmlFor="case-opponent" className="block text-xs font-medium mb-1">
                الطرف الآخر (الخصم) *
              </label>
              <input
                id="case-opponent"
                type="text"
                required
                placeholder="اسم الطرف الآخر"
                value={opponentName}
                onChange={(e) => setOpponentName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div>
              <label htmlFor="case-court" className="block text-xs font-medium mb-1">
                الجهة / المحكمة المختصة *
              </label>
              <select
                id="case-court"
                value={courtName}
                onChange={(e) => setCourtName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                {settings.courts.map((ct) => (
                  <option key={ct} value={ct}>
                    {ct}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="case-lawyer" className="block text-xs font-medium mb-1">
                المحامي المكلف *
              </label>
              <select
                id="case-lawyer"
                value={lawyerId || lawyers[0]?.id || 0}
                onChange={(e) => setLawyerId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                {lawyers.length === 0 && <option value={0}>غير محدد</option>}
                {lawyers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="case-next-hearing" className="block text-xs font-medium mb-1">
                موعد الجلسة القادمة
              </label>
              <input
                id="case-next-hearing"
                type="date"
                value={nextHearingDate}
                onChange={(e) => setNextHearingDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
              />
            </div>

            <div>
              <label htmlFor="case-status" className="block text-xs font-medium mb-1">
                حالة الملف
              </label>
              <select
                id="case-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as CaseStatus)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value="active">متابعة</option>
                <option value="suspended">موقوفة</option>
                <option value="closed">مغلقة</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="case-folder-url" className="block text-xs font-medium mb-1">
                رابط المجلد السحابي (اختياري)
              </label>
              <input
                id="case-folder-url"
                type="url"
                placeholder="https://drive.google.com/..."
                value={folderUrl}
                onChange={(e) => setFolderUrl(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="case-notes" className="block text-xs font-medium mb-1">
                ملاحظات إضافية
              </label>
              <textarea
                id="case-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-[#1D5CE5] to-[#1545B5] text-white hover:from-[#1A52CE] hover:to-[#123B9E] shadow-sm cursor-pointer"
            >
              <FolderPlus className="w-4 h-4" aria-hidden="true" />
              <span>{submitting ? 'جاري فتح الملف...' : 'اعتماد وفتح ملف القضية'}</span>
            </button>
          </div>
        </form>

        {/* Live File Preview Card (4 cols, matching IMG_3815) */}
        <aside className="lg:col-span-4 rounded-2xl bg-gradient-to-b from-blue-50/70 to-white dark:from-slate-900 dark:to-slate-900 border border-blue-100 dark:border-slate-800 shadow-xs p-6 space-y-5">
          <div className="flex flex-col items-center text-center pb-4 border-b border-slate-200/80 dark:border-slate-800">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1D5CE5] to-[#0B1E47] flex items-center justify-center shadow-md mb-3">
              <Scale className="w-8 h-8 text-amber-300" aria-hidden="true" />
            </div>
            <h3 className="font-display text-lg font-bold text-[#0B1E47] dark:text-white">
              ملف القضية
            </h3>
            <span className="mt-1.5 px-3 py-1 rounded-md bg-blue-100/80 dark:bg-slate-800 text-[#1D5CE5] dark:text-amber-400 font-mono-num text-xs font-bold">
              {previewCode}
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-slate-500">العميل</span>
              <span className="font-semibold text-slate-900 dark:text-white text-left truncate max-w-[180px]">
                {selectedClientName}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-slate-500">الموضوع</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 text-left truncate max-w-[180px]">
                {subject.trim() || '—'}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-slate-500">الجهة</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 text-left truncate max-w-[180px]">
                {courtName}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-slate-500 inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                <span>تاريخ الفتح</span>
              </span>
              <span className="font-mono-num font-semibold">
                {new Date().toISOString().slice(0, 10)}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-slate-500 inline-flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5" aria-hidden="true" />
                <span>حالة الملف</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-medium">
                جديد ({status === 'active' ? 'متابعة' : status === 'suspended' ? 'موقوفة' : 'مغلقة'})
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
