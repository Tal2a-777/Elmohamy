import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarCheck,
  Calculator,
  CheckCircle2,
  Eraser,
  FileSignature,
  Plus,
  Printer,
  Trash2,
  X,
} from 'lucide-react';
import type {
  Client,
  LegalCase,
  LegalContract,
  LegalDeadline,
  OfficeSettings,
} from '../types/legal.ts';
import {
  STATUTORY_DEADLINE_PRESETS,
  calculateStatutoryDeadline,
  type StatutoryDeadlineType,
} from '../utils/legalLogic.ts';

interface LegalToolsAndContractsViewProps {
  clients: Client[];
  cases: LegalCase[];
  deadlines: LegalDeadline[];
  contracts: LegalContract[];
  settings: OfficeSettings;
  canEdit: boolean;
  onCreateDeadline: (input: Omit<LegalDeadline, 'id' | 'createdAt'>) => Promise<void>;
  onToggleDeadline: (id: number, status: 'active' | 'completed') => Promise<void>;
  onDeleteDeadline: (id: number) => Promise<void>;
  onCreateContract: (input: {
    caseId: number | null;
    clientId: number;
    title: string;
    contractType: 'fee_agreement' | 'poa' | 'settlement';
    content: string;
    feeTerms: string;
  }) => Promise<void>;
  onSignContract: (
    id: number,
    signerName: string,
    signatureDataUrl: string,
  ) => Promise<void>;
  onDeleteContract: (id: number) => Promise<void>;
}

const CONTRACT_TYPE_LABELS: Record<LegalContract['contractType'], string> = {
  fee_agreement: 'اتفاقية أتعاب محاماة',
  poa: 'تفويض / وكالة قانونية',
  settlement: 'اتفاقية تسوية وصلح',
};

export function LegalToolsAndContractsView({
  clients,
  cases,
  deadlines,
  contracts,
  settings,
  canEdit,
  onCreateDeadline,
  onToggleDeadline,
  onDeleteDeadline,
  onCreateContract,
  onSignContract,
  onDeleteContract,
}: LegalToolsAndContractsViewProps) {
  const [subTab, setSubTab] = useState<'deadlines' | 'contracts'>('deadlines');
  const [banner, setBanner] = useState<string | null>(null);

  // Statutory Deadline Calculator State
  const [dlCaseId, setDlCaseId] = useState<string>(cases[0] ? String(cases[0].id) : '');
  const [dlTitle, setDlTitle] = useState('');
  const [dlJudgmentDate, setDlJudgmentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [dlType, setDlType] = useState<StatutoryDeadlineType>('appeal_30');
  const [dlHolidaysRaw, setDlHolidaysRaw] = useState('');
  const [dlNotes, setDlNotes] = useState('');
  const [savingDl, setSavingDl] = useState(false);

  const calculatedDeadline = useMemo(() => {
    const holidays = dlHolidaysRaw
      .split(/[\s,،]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
    return calculateStatutoryDeadline(dlJudgmentDate, dlType, holidays);
  }, [dlJudgmentDate, dlType, dlHolidaysRaw]);

  // Contracts & E-Signature State
  const [showContractForm, setShowContractForm] = useState(false);
  const [cClientId, setCClientId] = useState<number>(clients[0]?.id || 0);
  const [cCaseId, setCCaseId] = useState<string>('');
  const [cType, setCType] = useState<LegalContract['contractType']>('fee_agreement');
  const [cTitle, setCTitle] = useState('');
  const [cFeeTerms, setCFeeTerms] = useState('');
  const [cContent, setCContent] = useState('');
  const [savingContract, setSavingContract] = useState(false);

  // Signature Pad Modal State
  const [signingContract, setSigningContract] = useState<LegalContract | null>(null);
  const [previewContract, setPreviewContract] = useState<LegalContract | null>(null);
  const [signerName, setSignerName] = useState('');
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const [signingBusy, setSigningBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const caseMap = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);

  useEffect(() => {
    if (signingContract) {
      const client = clientMap.get(signingContract.clientId);
      setSignerName(client?.name || '');
      setHasDrawnSignature(false);
      window.setTimeout(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#0B1E47';
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }, 40);
    }
  }, [signingContract, clientMap]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.setPointerCapture(e.pointerId);
    const pt = getCanvasPoint(e);
    drawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    // Draw a subtle dot immediately so single click/tap also registers
    ctx.lineTo(pt.x + 0.5, pt.y + 0.5);
    ctx.stroke();
    setHasDrawnSignature(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    drawingRef.current = false;
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSignature(false);
  };

  const handleSaveDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calculatedDeadline.adjustedDueDate) return;
    setSavingDl(true);
    try {
      const linkedCase = dlCaseId ? caseMap.get(Number(dlCaseId)) : null;
      const resolvedTitle =
        dlTitle.trim() ||
        `${calculatedDeadline.deadlineLabel}${linkedCase ? ` — ${linkedCase.caseCode}` : ''}`;
      await onCreateDeadline({
        caseId: dlCaseId ? Number(dlCaseId) : null,
        title: resolvedTitle,
        judgmentDate: calculatedDeadline.judgmentDate,
        deadlineType: calculatedDeadline.deadlineType,
        statutoryDays: calculatedDeadline.statutoryDays,
        dueDate: calculatedDeadline.adjustedDueDate,
        notes: dlNotes.trim() || calculatedDeadline.shiftReason,
        status: 'active',
      });
      setDlTitle('');
      setDlNotes('');
      setBanner(
        `تم حفظ المهلة النظامية حتى تاريخ ${calculatedDeadline.adjustedDueDate} بنجاح.`,
      );
    } finally {
      setSavingDl(false);
    }
  };

  const handleCreateContractSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetClientId = cClientId || clients[0]?.id;
    if (!targetClientId || !cTitle.trim()) return;
    setSavingContract(true);
    try {
      await onCreateContract({
        caseId: cCaseId ? Number(cCaseId) : null,
        clientId: targetClientId,
        title: cTitle.trim(),
        contractType: cType,
        content:
          cContent.trim() ||
          `اتفق الطرفان (${settings.officeName} والعميل ${clientMap.get(targetClientId)?.name || ''}) على تمثيل الموكل قانونياً وفق الأنظمة المرعية.`,
        feeTerms: cFeeTerms.trim() || 'وفق جدول الأتعاب المعتمد',
      });
      setCTitle('');
      setCFeeTerms('');
      setCContent('');
      setShowContractForm(false);
      setBanner('تم إنشاء مسودة العقد وإتاحتها للتوقيع الإلكتروني.');
    } finally {
      setSavingContract(false);
    }
  };

  const handleConfirmSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signingContract || !signerName.trim() || !hasDrawnSignature || !canvasRef.current) {
      return;
    }
    setSigningBusy(true);
    try {
      const signatureDataUrl = canvasRef.current.toDataURL('image/png');
      await onSignContract(signingContract.id, signerName.trim(), signatureDataUrl);
      setSigningContract(null);
      setBanner(`تم اعتماد التوقيع الإلكتروني للعقد "${signingContract.title}" وتوثيقه.`);
    } finally {
      setSigningBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="tools-contracts-view">
      {/* Header & Sub-Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1E47] dark:text-white">
            حاسبة المدد النظامية والعقود الإلكترونية
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            احتساب مواعيد الطعون والاستئناف مع ترحيل الإجازات، وإدارة اتفاقيات الأتعاب والتوقيع الإلكتروني المباشر.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="أقسام المدد والعقود"
          className="inline-flex rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 shadow-xs shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'deadlines'}
            onClick={() => setSubTab('deadlines')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              subTab === 'deadlines'
                ? 'bg-[#1D5CE5] text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Calculator className="w-4 h-4" aria-hidden="true" />
            <span>حاسبة المدد النظامية</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'contracts'}
            onClick={() => setSubTab('contracts')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              subTab === 'contracts'
                ? 'bg-[#1D5CE5] text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileSignature className="w-4 h-4" aria-hidden="true" />
            <span>العقود والتوقيع الإلكتروني</span>
          </button>
        </div>
      </div>

      {banner && (
        <div className="no-print flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-800 dark:text-emerald-200">
          <span>{banner}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="underline font-semibold cursor-pointer"
          >
            إخفاء
          </button>
        </div>
      )}

      {/* TAB 1: Statutory Deadlines Calculator */}
      {subTab === 'deadlines' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Calculator Form */}
          <form
            onSubmit={handleSaveDeadline}
            className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Calculator className="w-5 h-5 text-[#1D5CE5]" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white">
                حاسبة المهل النظامية والطعون
              </h2>
            </div>

            <div>
              <label htmlFor="dl-type" className="block text-xs font-medium mb-1">
                نوع المهلة النظامية *
              </label>
              <select
                id="dl-type"
                value={dlType}
                onChange={(e) => setDlType(e.target.value as StatutoryDeadlineType)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                {(Object.keys(STATUTORY_DEADLINE_PRESETS) as StatutoryDeadlineType[]).map((key) => (
                  <option key={key} value={key}>
                    {STATUTORY_DEADLINE_PRESETS[key].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="dl-judgment-date" className="block text-xs font-medium mb-1">
                  تاريخ استلام الحكم / القرار *
                </label>
                <input
                  id="dl-judgment-date"
                  type="date"
                  required
                  value={dlJudgmentDate}
                  onChange={(e) => setDlJudgmentDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
                />
              </div>

              <div>
                <label htmlFor="dl-case" className="block text-xs font-medium mb-1">
                  ربط بقضية (اختياري)
                </label>
                <select
                  id="dl-case"
                  value={dlCaseId}
                  onChange={(e) => setDlCaseId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="">مهلة عامة بدون ربط</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.caseCode} — {c.subject}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="dl-title" className="block text-xs font-medium mb-1">
                عنوان التذكير
              </label>
              <input
                id="dl-title"
                type="text"
                value={dlTitle}
                onChange={(e) => setDlTitle(e.target.value)}
                placeholder="مثال: آخر موعد لتقديم لائحة الاستئناف"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div>
              <label htmlFor="dl-holidays" className="block text-xs font-medium mb-1">
                تواريخ إجازات رسمية إضافية (YYYY-MM-DD مفصولة بفاصلة)
              </label>
              <input
                id="dl-holidays"
                type="text"
                value={dlHolidaysRaw}
                onChange={(e) => setDlHolidaysRaw(e.target.value)}
                placeholder="مثال: 2026-06-15, 2026-06-16"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
              />
            </div>

            <div>
              <label htmlFor="dl-notes" className="block text-xs font-medium mb-1">
                ملاحظات إضافية
              </label>
              <input
                id="dl-notes"
                type="text"
                value={dlNotes}
                onChange={(e) => setDlNotes(e.target.value)}
                placeholder="متطلبات إيداع اللائحة أو المحكمة المختصة"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            {/* Live Result Preview Card */}
            <div
              data-testid="deadline-calculation-result"
              className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">نهاية المدة الخام:</span>
                <span className="font-mono-num font-semibold">{calculatedDeadline.rawDueDate || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0B1E47] dark:text-blue-200">
                  الموعد النظامي النهائي المعتمد:
                </span>
                <span className="font-mono-num text-lg font-extrabold text-[#1D5CE5] dark:text-amber-400">
                  {calculatedDeadline.adjustedDueDate || '—'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {calculatedDeadline.shiftReason}
              </p>
            </div>

            {canEdit && (
              <button
                type="submit"
                disabled={savingDl || !calculatedDeadline.adjustedDueDate}
                className="w-full py-2.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-[#1D5CE5] to-[#1545B5] text-white hover:from-[#1A52CE] hover:to-[#123B9E] cursor-pointer disabled:opacity-60"
              >
                {savingDl ? 'جاري الحفظ...' : 'حفظ المهلة في سجل المتابعة'}
              </button>
            )}
          </form>

          {/* Saved Deadlines Tracker */}
          <section className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-amber-600" aria-hidden="true" />
                <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white">
                  سجل المدد النظامية المعتمدة
                </h2>
              </div>
              <span className="font-mono-num text-xs text-slate-500">
                {deadlines.length} مهلة
              </span>
            </div>

            {deadlines.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                لا توجد مدد نظامية محفوظة حالياً. استخدم الحاسبة لإضافة أول مهلة قانونية.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {deadlines.map((dl) => {
                  const linked = dl.caseId ? caseMap.get(dl.caseId) : null;
                  return (
                    <div
                      key={dl.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-sm font-bold ${
                              dl.status === 'completed'
                                ? 'line-through text-slate-400'
                                : 'text-[#0B1E47] dark:text-white'
                            }`}
                          >
                            {dl.title}
                          </span>
                          {linked && (
                            <span className="font-mono-num text-[11px] font-semibold text-[#1D5CE5] dark:text-amber-400">
                              {linked.caseCode}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                          <span className="font-mono-num">
                            استلام الحكم: {dl.judgmentDate}
                          </span>
                          <span className="font-mono-num font-bold text-rose-700 dark:text-rose-400">
                            آخر موعد: {dl.dueDate}
                          </span>
                        </div>
                        {dl.notes && (
                          <p className="text-[11px] text-slate-500">{dl.notes}</p>
                        )}
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              onToggleDeadline(
                                dl.id,
                                dl.status === 'completed' ? 'active' : 'completed',
                              )
                            }
                            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                              dl.status === 'completed'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300'
                                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              {dl.status === 'completed' ? 'منجزة' : 'تحديد كمنجزة'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteDeadline(dl.id)}
                            aria-label={`حذف المهلة ${dl.title}`}
                            className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: Contracts & E-Signature */}
      {subTab === 'contracts' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between no-print">
            <p className="text-xs text-slate-500">
              أصدر اتفاقيات الأتعاب والتفويضات الرسمية ووقعها إلكترونياً بالقلم الرقمي أو أتحها للعميل عبر البوابة.
            </p>
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowContractForm((v) => !v)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-[#1D5CE5] to-[#1545B5] text-white hover:from-[#1A52CE] hover:to-[#123B9E] shadow-sm cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>{showContractForm ? 'إغلاق النموذج' : 'إنشاء عقد / تفويض جديد'}</span>
              </button>
            )}
          </div>

          {showContractForm && canEdit && (
            <form
              onSubmit={handleCreateContractSubmit}
              className="no-print p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white">
                تحرير اتفاقية أتعاب أو تفويض قانوني
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="contract-type" className="block text-xs font-medium mb-1">
                    نوع الوثيقة *
                  </label>
                  <select
                    id="contract-type"
                    value={cType}
                    onChange={(e) =>
                      setCType(e.target.value as LegalContract['contractType'])
                    }
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="fee_agreement">اتفاقية أتعاب محاماة</option>
                    <option value="poa">تفويض / وكالة قانونية</option>
                    <option value="settlement">اتفاقية تسوية وصلح</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="contract-client" className="block text-xs font-medium mb-1">
                    العميل *
                  </label>
                  <select
                    id="contract-client"
                    required
                    value={cClientId || clients[0]?.id || ''}
                    onChange={(e) => setCClientId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    {clients.length === 0 && <option value="">أضف عميلاً أولاً</option>}
                    {clients.map((cl) => (
                      <option key={cl.id} value={cl.id}>
                        {cl.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="contract-case" className="block text-xs font-medium mb-1">
                    القضية المرتبطة (اختياري)
                  </label>
                  <select
                    id="contract-case"
                    value={cCaseId}
                    onChange={(e) => setCCaseId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="">عامة / غير مرتبطة بقضية</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.caseCode} — {c.subject}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="contract-fee-terms" className="block text-xs font-medium mb-1">
                    قيمة وشروط الأتعاب
                  </label>
                  <input
                    id="contract-fee-terms"
                    type="text"
                    value={cFeeTerms}
                    onChange={(e) => setCFeeTerms(e.target.value)}
                    placeholder="مثال: 15,000 ر.س + 15% ضريبة"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-4">
                  <label htmlFor="contract-title" className="block text-xs font-medium mb-1">
                    عنوان العقد *
                  </label>
                  <input
                    id="contract-title"
                    type="text"
                    required
                    value={cTitle}
                    onChange={(e) => setCTitle(e.target.value)}
                    placeholder="مثال: اتفاقية تمثيل قانوني ومرافعة في المطالبة التجارية"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-4">
                  <label htmlFor="contract-content" className="block text-xs font-medium mb-1">
                    بنود ونص العقد
                  </label>
                  <textarea
                    id="contract-content"
                    rows={3}
                    value={cContent}
                    onChange={(e) => setCContent(e.target.value)}
                    placeholder="اكتب بنود الاتفاقية ونطاق التوكيل والتزامات الطرفين..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowContractForm(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingContract || clients.length === 0}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#1D5CE5] text-white hover:bg-[#1545B5] cursor-pointer disabled:opacity-60"
                >
                  {savingContract ? 'جاري الإنشاء...' : 'حفظ وإتاحة للتوقيع'}
                </button>
              </div>
            </form>
          )}

          {/* Contracts List */}
          <div className="no-print grid grid-cols-1 md:grid-cols-2 gap-4">
            {contracts.length === 0 ? (
              <div className="md:col-span-2 p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500">
                لا توجد عقود أو تفويضات مسجلة بعد.
              </div>
            ) : (
              contracts.map((contract) => {
                const client = clientMap.get(contract.clientId);
                const linkedCase = contract.caseId ? caseMap.get(contract.caseId) : null;
                const isSigned = contract.status === 'signed';
                return (
                  <article
                    key={contract.id}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-semibold text-[#1D5CE5] dark:text-amber-400">
                          {CONTRACT_TYPE_LABELS[contract.contractType]}
                        </span>
                        <h3 className="font-display text-base font-bold text-[#0B1E47] dark:text-white mt-0.5">
                          {contract.title}
                        </h3>
                      </div>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-md whitespace-nowrap ${
                          isSigned
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900'
                            : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900'
                        }`}
                      >
                        {isSigned ? 'موقّع إلكترونياً' : 'بانتظار التوقيع'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                      <p>
                        <strong>العميل:</strong> {client?.name || '—'}
                        {linkedCase ? ` · القضية: ${linkedCase.caseCode}` : ''}
                      </p>
                      <p>
                        <strong>الأتعاب والشروط:</strong> {contract.feeTerms || '—'}
                      </p>
                      <p className="line-clamp-2 text-slate-500">{contract.content}</p>
                    </div>

                    {isSigned && contract.signatureDataUrl && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                        <div className="text-xs space-y-0.5">
                          <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                            الموقّع: {contract.signerName}
                          </p>
                          <p className="font-mono-num text-[11px] text-slate-500">
                            تاريخ التوقيع: {contract.signedAt}
                          </p>
                        </div>
                        <img
                          src={contract.signatureDataUrl}
                          alt={`توقيع ${contract.signerName}`}
                          className="h-12 w-28 object-contain rounded border border-slate-200 bg-white p-1"
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        {!isSigned && (
                          <button
                            type="button"
                            onClick={() => setSigningContract(contract)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1D5CE5] text-white hover:bg-[#1545B5] cursor-pointer"
                          >
                            <FileSignature className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>توقيع إلكتروني</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewContract(contract);
                            window.setTimeout(() => window.print(), 120);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>طباعة العقد</span>
                        </button>
                      </div>

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => onDeleteContract(contract.id)}
                          aria-label={`حذف العقد ${contract.title}`}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {/* Printable Contract */}
          {previewContract && (
            <div className="hidden print-only p-8 bg-white text-slate-900 border border-slate-300 space-y-5">
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                <div>
                  <h2 className="font-display text-xl font-bold">{settings.officeName}</h2>
                  <p className="text-xs text-slate-600">{settings.officePhone}</p>
                </div>
                <div className="text-left">
                  <p className="font-bold text-base">
                    {CONTRACT_TYPE_LABELS[previewContract.contractType]}
                  </p>
                  <p className="font-mono-num text-xs">
                    التاريخ: {previewContract.createdAt}
                  </p>
                </div>
              </div>
              <h3 className="font-display text-lg font-bold">{previewContract.title}</h3>
              <p className="text-sm">
                <strong>الطرف الثاني (العميل): </strong>
                {clientMap.get(previewContract.clientId)?.name || '—'}
              </p>
              <p className="text-sm">
                <strong>شروط الأتعاب: </strong>
                {previewContract.feeTerms}
              </p>
              <div className="p-4 border border-slate-300 rounded text-sm whitespace-pre-line leading-relaxed">
                {previewContract.content}
              </div>
              {previewContract.status === 'signed' && previewContract.signatureDataUrl && (
                <div className="pt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">توقيع العميل: {previewContract.signerName}</p>
                    <p className="text-xs font-mono-num">التاريخ: {previewContract.signedAt}</p>
                  </div>
                  <img
                    src={previewContract.signatureDataUrl}
                    alt="التوقيع الإلكتروني"
                    className="h-20 w-44 object-contain border border-slate-300 p-1"
                  />
                </div>
              )}
              <div className="pt-6 border-t border-slate-300 text-xs text-slate-600 flex justify-between">
                <span>{settings.officeName}</span>
                <span>إعداد / النقيب امين عبدالرحيم</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* E-Signature Canvas Modal */}
      {signingContract && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 no-print"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sign-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3
                id="sign-modal-title"
                className="font-display text-base font-bold text-[#0B1E47] dark:text-white"
              >
                اعتماد التوقيع الإلكتروني: {signingContract.title}
              </h3>
              <button
                type="button"
                onClick={() => setSigningContract(null)}
                aria-label="إغلاق نافذة التوقيع"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSignature} className="p-5 space-y-4">
              <div>
                <label htmlFor="signer-name-input" className="block text-xs font-medium mb-1">
                  اسم الموقّع الكامل *
                </label>
                <input
                  id="signer-name-input"
                  type="text"
                  required
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium">ارسم التوقيع في المربع أدناه:</span>
                  <button
                    type="button"
                    onClick={handleClearCanvas}
                    className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300 hover:text-rose-600 cursor-pointer"
                  >
                    <Eraser className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>مسح التوقيع</span>
                  </button>
                </div>
                <canvas
                  ref={canvasRef}
                  width={460}
                  height={160}
                  data-testid="signature-pad-canvas"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className="w-full h-40 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white touch-none cursor-crosshair"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSigningContract(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={signingBusy || !hasDrawnSignature || !signerName.trim()}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
                >
                  {signingBusy ? 'جاري التوثيق...' : 'اعتماد التوقيع الإلكتروني'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
