import { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileLock2,
  FileUp,
  History,
  Lock,
  Search,
  Share2,
  ShieldAlert,
} from 'lucide-react';
import type { AuditLogEntry, DocumentVersion, LegalCase } from '../types/legal.ts';

interface AuditAndVaultViewProps {
  auditLogs: AuditLogEntry[];
  documentVersions: DocumentVersion[];
  cases: LegalCase[];
  canViewAudit: boolean;
  canEditVault: boolean;
  onSaveVaultDoc: (input: {
    caseId: number;
    docGroupKey: string;
    fileName: string;
    fileMime: string;
    fileSize: number;
    plainData: string;
    notes: string;
  }) => Promise<void>;
  onDownloadVaultDoc: (doc: DocumentVersion) => Promise<void>;
  onShareVaultDoc: (docId: number, expiresInDays?: number) => Promise<DocumentVersion | null>;
}

const ACTION_LABELS: Record<string, string> = {
  create: 'إنشاء',
  update: 'تعديل',
  delete: 'حذف',
  sign: 'توقيع إلكتروني',
  sync: 'مزامنة ناجز',
  export: 'تصدير / تحميل',
  share: 'رابط مشاركة',
  reset: 'تصفير مساحة العمل',
};

export function AuditAndVaultView({
  auditLogs,
  documentVersions,
  cases,
  canViewAudit,
  canEditVault,
  onSaveVaultDoc,
  onDownloadVaultDoc,
  onShareVaultDoc,
}: AuditAndVaultViewProps) {
  const [subTab, setSubTab] = useState<'audit' | 'vault'>(
    canViewAudit ? 'audit' : 'vault',
  );

  // Audit filters
  const [auditQuery, setAuditQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  // Vault upload state
  const [vaultCaseId, setVaultCaseId] = useState<number>(cases[0]?.id || 0);
  const [docGroupKey, setDocGroupKey] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileMime, setFileMime] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [plainData, setPlainData] = useState('');
  const [vaultNotes, setVaultNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [vaultBanner, setVaultBanner] = useState<string | null>(null);
  const [sharedLinkInfo, setSharedLinkInfo] = useState<{
    docName: string;
    url: string;
    expiresAt: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const caseMap = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);

  const filteredAudit = useMemo(() => {
    const q = auditQuery.trim().toLowerCase();
    return auditLogs.filter((entry) => {
      if (actionFilter !== 'all' && entry.actionType !== actionFilter) return false;
      if (!q) return true;
      return (
        entry.actorEmail.toLowerCase().includes(q) ||
        entry.entityLabel.toLowerCase().includes(q) ||
        entry.details.toLowerCase().includes(q)
      );
    });
  }, [auditLogs, auditQuery, actionFilter]);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFileMime(file.type || 'application/octet-stream');
    setFileSize(file.size);
    if (!docGroupKey.trim()) {
      setDocGroupKey(file.name.replace(/\.[^.]+$/, ''));
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPlainData(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadVault = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenCaseId = vaultCaseId || cases[0]?.id;
    if (!chosenCaseId || !fileName || !plainData) return;
    setUploading(true);
    try {
      await onSaveVaultDoc({
        caseId: chosenCaseId,
        docGroupKey: docGroupKey.trim() || fileName,
        fileName,
        fileMime,
        fileSize,
        plainData,
        notes: vaultNotes.trim(),
      });
      setFileName('');
      setFileMime('');
      setFileSize(0);
      setPlainData('');
      setVaultNotes('');
      setVaultBanner(
        'تم تشفير المستند وحفظ الإصدار الجديد في الخزينة مع بصمة SHA-256 بنجاح.',
      );
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateShareLink = async (doc: DocumentVersion) => {
    const updated = await onShareVaultDoc(doc.id, 7);
    if (updated?.shareToken) {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}/api/shared-doc/${updated.shareToken}`;
      setSharedLinkInfo({
        docName: `${updated.fileName} (v${updated.versionNumber})`,
        url,
        expiresAt: updated.shareExpiresAt,
      });
      setCopiedLink(false);
    }
  };

  const handleCopyShareUrl = async () => {
    if (!sharedLinkInfo) return;
    try {
      await navigator.clipboard.writeText(sharedLinkInfo.url);
      setCopiedLink(true);
    } catch {
      setCopiedLink(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="audit-vault-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1E47] dark:text-white">
            سجل التدقيق الأمني وخزينة المستندات المشفرة
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            توثيق كافة العمليات الحساسة داخل المكتب، وحفظ المستندات بتشفير AES-256 مع تتبع الإصدارات وروابط المشاركة المؤقتة.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="التدقيق والخزينة"
          className="inline-flex rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 shadow-xs shrink-0"
        >
          {canViewAudit && (
            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'audit'}
              onClick={() => setSubTab('audit')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                subTab === 'audit'
                  ? 'bg-[#1D5CE5] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <History className="w-4 h-4" aria-hidden="true" />
              <span>سجل التدقيق ({auditLogs.length})</span>
            </button>
          )}

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'vault'}
            onClick={() => setSubTab('vault')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              subTab === 'vault'
                ? 'bg-[#1D5CE5] text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileLock2 className="w-4 h-4" aria-hidden="true" />
            <span>خزينة المستندات ({documentVersions.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Audit Trail */}
      {subTab === 'audit' && canViewAudit && (
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={auditQuery}
                onChange={(e) => setAuditQuery(e.target.value)}
                aria-label="بحث في سجل التدقيق"
                placeholder="بحث بالبريد الإلكتروني أو اسم العنصر أو التفاصيل..."
                className="w-full pr-9 pl-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              aria-label="تصفية حسب نوع الإجراء"
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 min-w-[180px]"
            >
              <option value="all">جميع العمليات</option>
              <option value="create">إنشاء</option>
              <option value="update">تعديل</option>
              <option value="delete">حذف</option>
              <option value="sign">توقيع إلكتروني</option>
              <option value="sync">مزامنة ناجز</option>
              <option value="export">تصدير / تحميل</option>
              <option value="share">رابط مشاركة</option>
            </select>
          </div>

          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">التوقيت</th>
                    <th className="px-4 py-3 font-semibold">المنفذ</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">نوع العملية</th>
                    <th className="px-4 py-3 font-semibold">السجل / الكيان</th>
                    <th className="px-4 py-3 font-semibold">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAudit.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3 font-mono-num text-slate-500 whitespace-nowrap">
                        {row.createdAt.replace('T', ' ').slice(0, 16)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900 dark:text-slate-100 block">
                          {row.actorEmail || 'system'}
                        </span>
                        <span className="text-[11px] text-slate-400">{row.actorRole}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-[#1D5CE5] dark:text-amber-400">
                        {ACTION_LABELS[row.actionType] || row.actionType}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {row.entityLabel || row.entityType}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {row.details}
                      </td>
                    </tr>
                  ))}
                  {filteredAudit.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                        لا توجد سجلات تدقيق مطابقة بعد. تبدأ المراقبة فور إجراء أي عملية داخل النظام.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: Encrypted Document Vault */}
      {subTab === 'vault' && (
        <div className="space-y-5">
          {vaultBanner && (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-800 dark:text-emerald-200">
              <span>{vaultBanner}</span>
              <button
                type="button"
                onClick={() => setVaultBanner(null)}
                className="underline font-semibold cursor-pointer"
              >
                إخفاء
              </button>
            </div>
          )}

          {sharedLinkInfo && (
            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#0B1E47] dark:text-blue-200">
                  رابط مشاركة مؤقت للمستند: {sharedLinkInfo.docName}
                </p>
                <span className="font-mono-num text-[11px] text-slate-500">
                  صالح حتى: {sharedLinkInfo.expiresAt.slice(0, 10)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={sharedLinkInfo.url}
                  aria-label="رابط المشاركة المؤقت"
                  className="flex-1 px-3 py-1.5 text-xs font-mono-num rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-950"
                />
                <button
                  type="button"
                  onClick={handleCopyShareUrl}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1D5CE5] text-white cursor-pointer shrink-0"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'تم النسخ' : 'نسخ الرابط'}</span>
                </button>
              </div>
            </div>
          )}

          {canEditVault && (
            <form
              onSubmit={handleUploadVault}
              className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Lock className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white">
                  رفع وتشفير مستند (AES-256-GCM + تتبع الإصدارات)
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="vault-case" className="block text-xs font-medium mb-1">
                    القضية المرتبطة *
                  </label>
                  <select
                    id="vault-case"
                    required
                    value={vaultCaseId || cases[0]?.id || ''}
                    onChange={(e) => setVaultCaseId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    {cases.length === 0 && <option value="">افتح قضية أولاً</option>}
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.caseCode} — {c.subject}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="vault-group" className="block text-xs font-medium mb-1">
                    معرّف مجموعة المستند (لتسلسل الإصدارات v1, v2)
                  </label>
                  <input
                    id="vault-group"
                    type="text"
                    value={docGroupKey}
                    onChange={(e) => setDocGroupKey(e.target.value)}
                    placeholder="مثال: defense-memo-01"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label htmlFor="vault-file-input" className="block text-xs font-medium mb-1">
                    ملف المستند *
                  </label>
                  <label
                    htmlFor="vault-file-input"
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 cursor-pointer truncate"
                  >
                    <FileUp className="w-4 h-4 text-[#1D5CE5] shrink-0" aria-hidden="true" />
                    <span className="truncate">{fileName || 'اختر ملفاً للتشفير...'}</span>
                  </label>
                  <input
                    id="vault-file-input"
                    type="file"
                    onChange={handleFilePick}
                    className="sr-only"
                  />
                </div>

                <div>
                  <label htmlFor="vault-notes" className="block text-xs font-medium mb-1">
                    وصف التعديلات في هذا الإصدار
                  </label>
                  <input
                    id="vault-notes"
                    type="text"
                    value={vaultNotes}
                    onChange={(e) => setVaultNotes(e.target.value)}
                    placeholder="مثال: النسخة المعدلة بعد الملاحظات"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  <span>يتم احتساب بصمة SHA-256 لكل نسخة لضمان عدم التلاعب بالمستند.</span>
                </p>
                <button
                  type="submit"
                  disabled={uploading || !plainData || cases.length === 0}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#1D5CE5] text-white hover:bg-[#1545B5] cursor-pointer disabled:opacity-50"
                >
                  {uploading ? 'جاري التشفير والحفظ...' : 'حفظ مشفّر في الخزينة'}
                </button>
              </div>
            </form>
          )}

          {/* Vault Documents List */}
          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">المستند والإصدار</th>
                    <th className="px-4 py-3 font-semibold">القضية</th>
                    <th className="px-4 py-3 font-semibold">بصمة SHA-256</th>
                    <th className="px-4 py-3 font-semibold">التاريخ والرافع</th>
                    <th className="px-4 py-3 font-semibold">إجراءات الخزينة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {documentVersions.map((doc) => {
                    const linkedCase = caseMap.get(doc.caseId);
                    return (
                      <tr key={doc.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                            <span className="font-bold text-[#0B1E47] dark:text-white">
                              {doc.fileName}
                            </span>
                            <span className="font-mono-num text-[11px] font-bold text-[#1D5CE5] dark:text-amber-400">
                              v{doc.versionNumber}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            المجموعة: {doc.docGroupKey} {doc.notes ? `· ${doc.notes}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono-num">
                          {linkedCase?.caseCode || `#${doc.caseId}`}
                        </td>
                        <td className="px-4 py-3 font-mono-num text-[11px] text-slate-500">
                          {doc.sha256Hash ? `${doc.sha256Hash.slice(0, 16)}...` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono-num block">{doc.createdAt}</span>
                          <span className="text-[11px] text-slate-400">{doc.uploadedBy}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onDownloadVaultDoc(doc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5 text-[#1D5CE5]" aria-hidden="true" />
                              <span>فك التشفير وتحميل</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleGenerateShareLink(doc)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-blue-200 dark:border-blue-900 text-[#1D5CE5] dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>مشاركة 7 أيام</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {documentVersions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                        الخزينة فارغة حالياً. ارفع مستنداً أعلاه ليتم تشفيره وحفظه مع رقم إصداره.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
