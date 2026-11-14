import { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  FileText,
  FileUp,
  Lock,
  Plus,
  ScanText,
  Search,
  Sparkles,
  Download,
  Eye,
  EyeOff,
  Wand2,
} from 'lucide-react';
import type { Lawyer, LegalCase, Procedure, ProcedureType } from '../types/legal.ts';

interface ProceduresViewProps {
  cases: LegalCase[];
  lawyers: Lawyer[];
  procedures: Procedure[];
  initialCaseId: number | null;
  onAddProcedure: (input: Omit<Procedure, 'id'>) => Promise<void>;
  onSaveToVault: (input: {
    caseId: number;
    procedureId?: number | null;
    docGroupKey: string;
    fileName: string;
    fileMime: string;
    fileSize: number;
    plainData: string;
    notes: string;
  }) => Promise<void>;
  canEdit: boolean;
}

const PROC_TYPE_LABELS: Record<ProcedureType, string> = {
  hearing: 'جلسة',
  review: 'مراجعة',
  receipt: 'استلام',
  filing: 'إيداع مذكرة',
};

export function ProceduresView({
  cases,
  lawyers,
  procedures,
  initialCaseId,
  onAddProcedure,
  onSaveToVault,
  canEdit,
}: ProceduresViewProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<number | 'all'>(
    initialCaseId || 'all',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // AI Legal Memo Drafter state
  const [showDrafter, setShowDrafter] = useState(false);
  const [draftCaseId, setDraftCaseId] = useState<number>(initialCaseId || cases[0]?.id || 0);
  const [draftMemoType, setDraftMemoType] = useState('مذكرة دفاع جوابية');
  const [draftFacts, setDraftFacts] = useState('');
  const [draftingMemo, setDraftingMemo] = useState(false);
  const [draftResult, setDraftResult] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copiedDraft, setCopiedDraft] = useState(false);

  // Add procedure form state
  const [caseId, setCaseId] = useState<number>(initialCaseId || cases[0]?.id || 0);
  const [procedureDate, setProcedureDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [procedureType, setProcedureType] = useState<ProcedureType>('hearing');
  const [description, setDescription] = useState('');
  const [executorName, setExecutorName] = useState(lawyers[0]?.name || '');
  const [outcome, setOutcome] = useState('');
  const [nextActionDate, setNextActionDate] = useState('');
  const [visibleToClient, setVisibleToClient] = useState(true);
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentMime, setAttachmentMime] = useState('');
  const [attachmentSize, setAttachmentSize] = useState(0);
  const [attachmentText, setAttachmentText] = useState('');
  const [attachmentData, setAttachmentData] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [vaultMessage, setVaultMessage] = useState<string | null>(null);

  // AI Summarization state
  const [summaryMap, setSummaryMap] = useState<Record<number, string>>({});
  const [summarizingId, setSummarizingId] = useState<number | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const caseMap = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);

  const filteredProcedures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return procedures.filter((p) => {
      if (selectedCaseId !== 'all' && p.caseId !== selectedCaseId) return false;
      if (!q) return true;
      const c = caseMap.get(p.caseId);
      return (
        p.description.toLowerCase().includes(q) ||
        p.outcome.toLowerCase().includes(q) ||
        p.executorName.toLowerCase().includes(q) ||
        p.attachmentName.toLowerCase().includes(q) ||
        p.attachmentText.toLowerCase().includes(q) ||
        Boolean(c && (c.caseCode.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q)))
      );
    });
  }, [procedures, selectedCaseId, searchQuery, caseMap]);

  const runAutoOcr = async (dataUrl: string, mime: string, name: string) => {
    if (!dataUrl) return;
    setOcrLoading(true);
    try {
      const res = await fetch('/api/ai/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, mimeType: mime, fileName: name }),
      });
      const data = await res.json();
      if (res.ok && data.extractedText) {
        setAttachmentText(data.extractedText);
      }
    } catch {
      // Keep manual text fallback silently if OCR service unavailable
    } finally {
      setOcrLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mime = file.type || 'application/octet-stream';
    setAttachmentName(file.name);
    setAttachmentMime(mime);
    setAttachmentSize(file.size);

    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setAttachmentData(result);
      if (mime.startsWith('image/') || mime === 'application/pdf') {
        await runAutoOcr(result, mime, file.name);
      }
    };
    reader.readAsDataURL(file);

    if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
      const text = await file.text();
      setAttachmentText(text.slice(0, 8000));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveCaseId = caseId || cases[0]?.id || 0;
    if (!effectiveCaseId || !description.trim() || !executorName.trim()) {
      setFormError('يرجى تحديد القضية، وصف الإجراء، واسم المنفذ.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await onAddProcedure({
        caseId: effectiveCaseId,
        procedureDate,
        procedureType,
        description: description.trim(),
        executorName: executorName.trim(),
        outcome: outcome.trim(),
        nextActionDate,
        attachmentName,
        attachmentMime,
        attachmentSize,
        attachmentText: attachmentText.trim(),
        attachmentData,
        visibleToClient,
      });
      setDescription('');
      setOutcome('');
      setNextActionDate('');
      setAttachmentName('');
      setAttachmentMime('');
      setAttachmentSize(0);
      setAttachmentText('');
      setAttachmentData('');
      setShowAddForm(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'تعذر حفظ الإجراء');
    } finally {
      setSaving(false);
    }
  };

  const handleDraftMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCase = caseMap.get(draftCaseId || cases[0]?.id || 0);
    if (!targetCase && !draftFacts.trim()) {
      setDraftError('يرجى تحديد القضية أو إدخال الوقائع المطلوب صياغتها.');
      return;
    }
    setDraftingMemo(true);
    setDraftError(null);
    setCopiedDraft(false);
    try {
      const procSummary = targetCase
        ? procedures
            .filter((p) => p.caseId === targetCase.id)
            .slice(0, 5)
            .map((p) => `${p.procedureDate}: ${p.description}`)
            .join(' | ')
        : '';
      const res = await fetch('/api/ai/draft-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memoType: draftMemoType,
          caseSubject: targetCase?.subject || 'دعوى قانونية',
          clientRole: targetCase?.clientRole || 'plaintiff',
          opponentName: targetCase?.opponentName || '',
          courtName: targetCase?.courtName || '',
          facts: draftFacts.trim(),
          proceduresSummary: procSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر توليد مسودة المذكرة.');
      }
      setDraftResult(data.draft || '');
    } catch (err: unknown) {
      setDraftError(
        err instanceof Error ? err.message : 'تعذر الاتصال بمساعد الصياغة الذكي.',
      );
    } finally {
      setDraftingMemo(false);
    }
  };

  const handleSummarize = async (proc: Procedure) => {
    const sourceText = proc.attachmentText || `${proc.description}\nالنتيجة: ${proc.outcome}`;
    setSummarizingId(proc.id);
    setSummaryError(null);
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sourceText,
          documentTitle: proc.attachmentName || PROC_TYPE_LABELS[proc.procedureType],
          caseSubject: caseMap.get(proc.caseId)?.subject || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'تعذر تلخيص المستند.');
      }
      setSummaryMap((prev) => ({ ...prev, [proc.id]: data.summary }));
    } catch (err: unknown) {
      setSummaryError(
        err instanceof Error ? err.message : 'تعذر الاتصال بخدمة التلخيص بالذكاء الاصطناعي.',
      );
    } finally {
      setSummarizingId(null);
    }
  };

  const handleDownloadAttachment = (proc: Procedure) => {
    if (proc.attachmentData) {
      const a = document.createElement('a');
      a.href = proc.attachmentData;
      a.download = proc.attachmentName || 'document';
      a.click();
    } else if (proc.attachmentText) {
      const blob = new Blob([proc.attachmentText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${proc.attachmentName || 'memo'}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleArchiveProcedureAttachment = async (proc: Procedure) => {
    const payloadData =
      proc.attachmentData ||
      (proc.attachmentText
        ? `data:text/plain;charset=utf-8,${encodeURIComponent(proc.attachmentText)}`
        : '');
    if (!payloadData) return;
    await onSaveToVault({
      caseId: proc.caseId,
      procedureId: proc.id,
      docGroupKey: `proc-${proc.id}-${proc.attachmentName || 'doc'}`,
      fileName: proc.attachmentName || `procedure-${proc.id}.txt`,
      fileMime: proc.attachmentMime || 'text/plain',
      fileSize: proc.attachmentSize || proc.attachmentText.length,
      plainData: payloadData,
      notes: `أرشفة من إجراء ${proc.procedureDate}: ${proc.description.slice(0, 60)}`,
    });
    setVaultMessage(`تم تشفير وحفظ "${proc.attachmentName || 'المستند'}" في خزينة المستندات بنجاح.`);
  };

  return (
    <div className="space-y-6" data-testid="procedures-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1E47] dark:text-white">
            سجل الإجراءات والأرشفة الذكية
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            تتبع تاريخي دقيق للجلسات والمراجعات مع إرفاق المذكرات والبحث في محتواها وتلخيصها بالذكاء الاصطناعي.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowDrafter((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 cursor-pointer"
          >
            <Wand2 className="w-4 h-4" aria-hidden="true" />
            <span>{showDrafter ? 'إغلاق مساعد الصياغة' : 'مساعد الصياغة القانونية (AI)'}</span>
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-[#1D5CE5] to-[#1545B5] text-white hover:from-[#1A52CE] hover:to-[#123B9E] shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>{showAddForm ? 'إغلاق النموذج' : 'تسجيل إجراء جديد'}</span>
            </button>
          )}
        </div>
      </div>

      {vaultMessage && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-800 dark:text-emerald-200">
          <span>{vaultMessage}</span>
          <button
            type="button"
            onClick={() => setVaultMessage(null)}
            className="underline font-semibold cursor-pointer"
          >
            إخفاء
          </button>
        </div>
      )}

      {/* AI Legal Memo & Defense Drafter */}
      {showDrafter && (
        <section
          data-testid="ai-memo-drafter"
          className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-800/60 shadow-xs space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Wand2 className="w-5 h-5 text-amber-600" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white">
              مساعِد الصياغة القانونية وإعداد المذكرات بالذكاء الاصطناعي
            </h2>
          </div>

          {draftError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {draftError}
            </div>
          )}

          <form onSubmit={handleDraftMemo} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="draft-case" className="block text-xs font-medium mb-1">
                  القضية المستهدفة
                </label>
                <select
                  id="draft-case"
                  value={draftCaseId}
                  onChange={(e) => setDraftCaseId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={0}>صياغة عامة</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.caseCode} — {c.subject}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="draft-type" className="block text-xs font-medium mb-1">
                  نوع المذكرة / اللائحة
                </label>
                <select
                  id="draft-type"
                  value={draftMemoType}
                  onChange={(e) => setDraftMemoType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="مذكرة دفاع جوابية">مذكرة دفاع جوابية</option>
                  <option value="لائحة دعوى ابتدائية">لائحة دعوى ابتدائية</option>
                  <option value="لائحة اعتراضية (استئناف)">لائحة اعتراضية (استئناف)</option>
                  <option value="طلب عارض / مستعجل">طلب عارض / مستعجل</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="draft-facts" className="block text-xs font-medium mb-1">
                الوقائع والدفوع والطلبات المطلوب تضمينها *
              </label>
              <textarea
                id="draft-facts"
                rows={3}
                value={draftFacts}
                onChange={(e) => setDraftFacts(e.target.value)}
                placeholder="اشرح الوقائع الأساسية أو أسباب الاعتراض أو الطلبات الختامية..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={draftingMemo}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-[#1D5CE5] text-white hover:bg-[#1545B5] cursor-pointer disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span>{draftingMemo ? 'جاري صياغة المذكرة...' : 'توليد مسودة المذكرة القانونية'}</span>
              </button>
            </div>
          </form>

          {draftResult && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <strong className="text-xs text-[#0B1E47] dark:text-amber-400">
                  مسودة المذكرة المقترحة:
                </strong>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(draftResult).catch(() => {});
                    setCopiedDraft(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer"
                >
                  {copiedDraft ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedDraft ? 'تم النسخ' : 'نسخ النص'}</span>
                </button>
              </div>
              <div className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                {draftResult}
              </div>
            </div>
          )}
        </section>
      )}

      {showAddForm && canEdit && (
        <form
          onSubmit={handleCreate}
          className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
        >
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            إضافة إجراء ومستند إلى سجل القضية
          </h2>

          {formError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="proc-case" className="block text-xs font-medium mb-1">
                القضية *
              </label>
              <select
                id="proc-case"
                value={caseId || cases[0]?.id || 0}
                onChange={(e) => setCaseId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                {cases.length === 0 && <option value={0}>افتح ملف قضية أولاً</option>}
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.caseCode} — {c.subject}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="proc-date" className="block text-xs font-medium mb-1">
                تاريخ الإجراء *
              </label>
              <input
                id="proc-date"
                type="date"
                required
                value={procedureDate}
                onChange={(e) => setProcedureDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
              />
            </div>

            <div>
              <label htmlFor="proc-type" className="block text-xs font-medium mb-1">
                نوع الإجراء
              </label>
              <select
                id="proc-type"
                value={procedureType}
                onChange={(e) => setProcedureType(e.target.value as ProcedureType)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value="hearing">جلسة</option>
                <option value="review">مراجعة</option>
                <option value="receipt">استلام</option>
                <option value="filing">إيداع مذكرة</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="proc-executor" className="block text-xs font-medium mb-1">
                المنفذ *
              </label>
              <input
                id="proc-executor"
                type="text"
                required
                value={executorName}
                onChange={(e) => setExecutorName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div>
              <label htmlFor="proc-next-date" className="block text-xs font-medium mb-1">
                تاريخ الموعد القادم
              </label>
              <input
                id="proc-next-date"
                type="date"
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
              />
            </div>

            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleToClient}
                  onChange={(e) => setVisibleToClient(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>إظهار الإجراء والمرفق في بوابة العميل</span>
              </label>
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <label htmlFor="proc-desc" className="block text-xs font-medium mb-1">
                وصف الإجراء التفصيلي *
              </label>
              <textarea
                id="proc-desc"
                rows={2}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="proc-outcome" className="block text-xs font-medium mb-1">
                النتيجة / القرار الصادر
              </label>
              <input
                id="proc-outcome"
                type="text"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="proc-file" className="block text-xs font-medium mb-1">
                إرفاق مستند (PDF / صورة / DOCX / TXT)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor="proc-file"
                  className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <FileUp className="w-4 h-4" aria-hidden="true" />
                  <span>{attachmentName || 'اختر ملفاً...'}</span>
                </label>
                <input
                  id="proc-file"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,image/*"
                  onChange={handleFileChange}
                  className="sr-only"
                />
                {attachmentData && (
                  <button
                    type="button"
                    disabled={ocrLoading}
                    onClick={() => runAutoOcr(attachmentData, attachmentMime, attachmentName)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-slate-800 text-[#1D5CE5] dark:text-amber-400 hover:bg-blue-100 cursor-pointer"
                  >
                    <ScanText className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{ocrLoading ? 'جاري الاستخراج...' : 'استخراج النص (OCR)'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <label htmlFor="proc-ocr" className="block text-xs font-medium mb-1">
                النص المفهرس للمستند (OCR تلقائي / محتوى المذكرة للبحث الذكي والتلخيص بالذكاء الاصطناعي)
              </label>
              <textarea
                id="proc-ocr"
                rows={2}
                placeholder="يتم استخراج النص تلقائياً عند رفع PDF أو صورة، أو يمكنك لصقه يدوياً هنا..."
                value={attachmentText}
                onChange={(e) => setAttachmentText(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#1D5CE5] text-white hover:bg-[#1545B5] cursor-pointer"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ الإجراء'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Case Filter */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="البحث في سجل الإجراءات ونصوص المرفقات"
            placeholder="البحث الذكي (OCR): ابحث داخل وصف الإجراء أو محتوى ملفات PDF والمذكرات..."
            className="w-full pr-10 pl-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
        </div>

        <select
          value={selectedCaseId}
          onChange={(e) =>
            setSelectedCaseId(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
          aria-label="تصفية الإجراءات حسب القضية"
          className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 min-w-[240px]"
        >
          <option value="all">كل القضايا</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.caseCode} — {c.subject}
            </option>
          ))}
        </select>
      </div>

      {summaryError && (
        <div
          role="alert"
          className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between"
        >
          <span>{summaryError}</span>
          <button type="button" onClick={() => setSummaryError(null)} className="underline">
            إغلاق
          </button>
        </div>
      )}

      {/* Procedures Timeline List */}
      <div className="space-y-4">
        {filteredProcedures.map((proc) => {
          const linkedCase = caseMap.get(proc.caseId);
          return (
            <article
              key={proc.id}
              className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono-num font-bold text-slate-900 dark:text-amber-400">
                    {proc.procedureDate}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {PROC_TYPE_LABELS[proc.procedureType]}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-600 dark:text-slate-400">
                    {linkedCase ? `${linkedCase.caseCode} (${linkedCase.subject})` : ''}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>المنفذ: {proc.executorName}</span>
                  <span className="inline-flex items-center gap-1">
                    {proc.visibleToClient ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                        <span>مرئي للعميل</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                        <span>داخلي فقط</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                {proc.description}
              </p>

              {proc.outcome && (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  <strong className="text-slate-800 dark:text-slate-200">النتيجة:</strong>{' '}
                  {proc.outcome}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  {proc.attachmentName && (
                    <button
                      type="button"
                      onClick={() => handleDownloadAttachment(proc)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                      <span>{proc.attachmentName}</span>
                      <Download className="w-3 h-3 text-slate-400" aria-hidden="true" />
                    </button>
                  )}

                  {(proc.attachmentData || proc.attachmentText) && (
                    <button
                      type="button"
                      onClick={() => handleArchiveProcedureAttachment(proc)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 cursor-pointer"
                    >
                      <Lock className="w-3 h-3" aria-hidden="true" />
                      <span>حفظ بالخزينة المشفرة</span>
                    </button>
                  )}

                  {proc.nextActionDate && (
                    <span className="text-xs text-slate-500 font-mono-num">
                      الموعد القادم: {proc.nextActionDate}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleSummarize(proc)}
                  disabled={summarizingId === proc.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-60"
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    {summarizingId === proc.id ? 'جاري التلخيص...' : 'تلخيص المستند بالذكاء الاصطناعي'}
                  </span>
                </button>
              </div>

              {summaryMap[proc.id] && (
                <div className="mt-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                  <strong className="block text-slate-900 dark:text-amber-400 mb-1.5">
                    ملخص الذكاء الاصطناعي للمذكرة:
                  </strong>
                  {summaryMap[proc.id]}
                </div>
              )}
            </article>
          );
        })}

        {filteredProcedures.length === 0 && (
          <div className="p-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500">
            لا توجد إجراءات مسجلة مطابقة للبحث.
          </div>
        )}
      </div>
    </div>
  );
}
