import { useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  CloudUpload,
  Copy,
  Database,
  ExternalLink,
  FileDown,
  Globe,
  Loader2,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import { clearCachedDriveToken, requestDriveAccessToken } from '../lib/firebase.ts';

interface UploadedDriveGuide {
  id: string;
  name: string;
  webViewLink: string;
  webContentLink?: string;
  isPublic: boolean;
}

const SCHEMA_ENTITIES = [
  {
    table: 'firm_members',
    arabicName: 'فريق العمل والصلاحيات الدقيقة',
    columns: 'id, owner_uid, email, full_name, role, permissions (JSONB 6 flags), status, created_at',
  },
  {
    table: 'clients',
    arabicName: 'سجل العملاء (أفراد / جهات)',
    columns: 'id, owner_uid, client_code, name, client_type, national_or_reg_id, phone, email, account_status',
  },
  {
    table: 'cases',
    arabicName: 'ملفات القضايا ومزامنة ناجز',
    columns: 'id, owner_uid, case_code, official_number, subject, client_id (FK), lawyer_id (FK), court_name, status, najiz_status, najiz_circuit, last_synced_at',
  },
  {
    table: 'procedures',
    arabicName: 'سجل الإجراءات والـ OCR الذكي',
    columns: 'id, owner_uid, case_id (FK), procedure_date, procedure_type, description, attachment_text (OCR), visible_to_client',
  },
  {
    table: 'invoices',
    arabicName: 'الفواتير الضريبية ZATCA',
    columns: 'id, owner_uid, invoice_number, case_id (FK), client_id (FK), fee_amount, vat_rate, vat_amount, invoice_type, zatca_qr, status',
  },
  {
    table: 'time_entries & trust_transactions',
    arabicName: 'ساعات العمل وحسابات الأمانات',
    columns: 'time_entries (hours, hourly_rate, invoiced) | trust_transactions (tx_type: deposit/deduction/refund, amount)',
  },
  {
    table: 'contracts & legal_deadlines',
    arabicName: 'العقود الإلكترونية والمدد النظامية',
    columns: 'contracts (signature_data_url, signed_at) | legal_deadlines (judgment_date, statutory_days, due_date)',
  },
  {
    table: 'audit_logs & document_versions',
    arabicName: 'التدقيق الأمني وخزينة الوثائق المشفرة',
    columns: 'audit_logs (actor_email, action_type, details) | document_versions (version_number, sha256_hash, encrypted_data, share_token)',
  },
];

const TEN_CAPABILITIES = [
  '1. مزامنة بوابة المحاكم (ناجز) وتحديث الدوائر القضائية وتصدير التقويم (.ics).',
  '2. محرك التنبيهات الآلية متعددة القنوات (72 ساعة / 24 ساعة / اليوم) عبر WhatsApp وSMS والبريد.',
  '3. مساحة عمل متعددة الأعضاء مع مصفوفة صلاحيات دقيقة وعزل كامل بين حسابات البريد.',
  '4. استخراج النصوص التلقائي (OCR) لملفات PDF والصور + مساعد الصياغة القانونية بالذكاء الاصطناعي.',
  '5. الفوترة الإلكترونية المتوافقة مع ZATCA بنسبة 15% مع رمز QR وإشعارات دائنة ومدينة.',
  '6. تتبع ساعات العمل الاستشارية وتحويلها إلى فواتير + محاسبة الأمانات والعهد.',
  '7. عقود الأتعاب والتفويضات مع لوحة التوقيع الإلكتروني المباشر بالقلم الرقمي.',
  '8. حاسبة المدد النظامية للطعون والاستئناف مع الترحيل التلقائي لعطل نهاية الأسبوع والأعياد.',
  '9. سجل التدقيق الأمني الشامل لتتبع جميع عمليات الإنشاء والتعديل والتوقيع والتحميل.',
  '10. خزينة المستندات المشفرة (AES-256) مع تتبع الإصدارات وبصمة SHA-256 وروابط المشاركة المؤقتة.',
];

async function buildDriveMultipartBody(
  fileName: string,
  pdfBlob: Blob,
): Promise<{ contentType: string; body: Blob }> {
  const boundary = `mizan_drive_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const metadata = JSON.stringify({
    name: fileName,
    mimeType: 'application/pdf',
    description: 'دليل الاستخدام الشامل لمنصة ميزان السحابية للمحاماة — إعداد / النقيب امين عبدالرحيم',
  });
  const headerPart =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/pdf\r\n\r\n';
  const footerPart = `\r\n--${boundary}--`;
  return {
    contentType: `multipart/related; boundary=${boundary}`,
    body: new Blob([headerPart, pdfBlob, footerPart], {
      type: `multipart/related; boundary=${boundary}`,
    }),
  };
}

export function GuideView() {
  const [uploadingDrive, setUploadingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [uploadedGuide, setUploadedGuide] = useState<UploadedDriveGuide | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareConfirmOpen, setShareConfirmOpen] = useState(false);
  const [updatingShare, setUpdatingShare] = useState(false);

  const performDriveUpload = async (token: string, pdfBlob: Blob) => {
    const { contentType, body } = await buildDriveMultipartBody(
      'دليل-استخدام-نظام-ميزان.pdf',
      pdfBlob,
    );
    return fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': contentType,
        },
        body,
      },
    );
  };

  const handleUploadToDrive = async () => {
    setUploadingDrive(true);
    setDriveError(null);
    setCopiedLink(false);

    try {
      const pdfRes = await fetch('/mizan-user-guide.pdf');
      if (!pdfRes.ok) {
        throw new Error('تعذر تحميل ملف الدليل المحلي قبل رفعه إلى Google Drive.');
      }
      const pdfBlob = await pdfRes.blob();

      let token = await requestDriveAccessToken();
      let driveRes = await performDriveUpload(token, pdfBlob);

      if (driveRes.status === 401) {
        clearCachedDriveToken();
        token = await requestDriveAccessToken();
        driveRes = await performDriveUpload(token, pdfBlob);
      }

      if (!driveRes.ok) {
        const errPayload = await driveRes.json().catch(() => ({}));
        const msg =
          errPayload?.error?.message ||
          'تعذر رفع الملف إلى Google Drive. تأكد من منح صلاحية Google Drive في نافذة المصادقة.';
        throw new Error(msg);
      }

      const uploaded = (await driveRes.json()) as {
        id: string;
        name: string;
        webViewLink?: string;
        webContentLink?: string;
      };

      const viewLink =
        uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;

      setUploadedGuide({
        id: uploaded.id,
        name: uploaded.name || 'دليل-استخدام-نظام-ميزان.pdf',
        webViewLink: viewLink,
        webContentLink: uploaded.webContentLink,
        isPublic: false,
      });
    } catch (err: unknown) {
      setDriveError(
        err instanceof Error
          ? err.message
          : 'حدث خطأ غير متوقع أثناء الرفع إلى Google Drive.',
      );
    } finally {
      setUploadingDrive(false);
    }
  };

  const handleConfirmPublicShare = async () => {
    if (!uploadedGuide) return;
    setUpdatingShare(true);
    setDriveError(null);
    try {
      let token = await requestDriveAccessToken();
      let res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(uploadedGuide.id)}/permissions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            role: 'reader',
            type: 'anyone',
          }),
        },
      );

      if (res.status === 401) {
        clearCachedDriveToken();
        token = await requestDriveAccessToken();
        res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(uploadedGuide.id)}/permissions`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              role: 'reader',
              type: 'anyone',
            }),
          },
        );
      }

      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(
          errPayload?.error?.message || 'تعذر تحديث صلاحية مشاركة الملف على Google Drive.',
        );
      }

      setUploadedGuide((prev) => (prev ? { ...prev, isPublic: true } : prev));
      setShareConfirmOpen(false);
    } catch (err: unknown) {
      setDriveError(
        err instanceof Error ? err.message : 'فشل تفعيل المشاركة العامة للملف.',
      );
      setShareConfirmOpen(false);
    } finally {
      setUpdatingShare(false);
    }
  };

  const handleCopyDriveLink = async () => {
    if (!uploadedGuide) return;
    try {
      await navigator.clipboard.writeText(uploadedGuide.webViewLink);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setDriveError('تعذر نسخ الرابط تلقائياً. يمكنك نسخه مباشرة من الرابط الظاهر أدناه.');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl" data-testid="guide-view">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            دليل الاستخدام وهيكل قاعدة البيانات
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            مرجع التشغيل الاحترافي للمحامين والسكرتارية والمحاسبين والعملاء، مع توثيق جداول PostgreSQL السحابية.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleUploadToDrive}
            disabled={uploadingDrive}
            data-testid="upload-guide-drive-btn"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-[#1D5CE5] text-slate-900 dark:text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
          >
            {uploadingDrive ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#1D5CE5]" aria-hidden="true" />
            ) : (
              <CloudUpload className="w-4 h-4 text-[#1D5CE5]" aria-hidden="true" />
            )}
            <span>
              {uploadingDrive ? 'جارٍ الرفع إلى Google Drive...' : 'رفع الدليل إلى Google Drive'}
            </span>
          </button>

          <a
            href="/mizan-user-guide.pdf"
            download="دليل-استخدام-نظام-ميزان.pdf"
            data-testid="download-guide-pdf-btn"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1D5CE5] hover:bg-[#174BB8] text-white text-xs font-bold shadow-sm transition-colors"
          >
            <FileDown className="w-4 h-4" aria-hidden="true" />
            <span>تحميل الدليل الشامل (PDF)</span>
          </a>
        </div>
      </div>

      {driveError && (
        <div
          role="alert"
          data-testid="drive-upload-error"
          className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3 text-xs text-rose-800 dark:text-rose-200"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" aria-hidden="true" />
          <div className="flex-1">{driveError}</div>
          <button
            type="button"
            onClick={() => setDriveError(null)}
            aria-label="إغلاق رسالة الخطأ"
            className="text-rose-600 hover:text-rose-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {uploadedGuide && (
        <section
          data-testid="drive-upload-result"
          className="p-5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Check className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  تم رفع دليل الاستخدام إلى حسابك في Google Drive
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  اسم الملف: {uploadedGuide.name} • الحالة:{' '}
                  {uploadedGuide.isPublic ? 'متاح للمشاركة العامة (قراءة فقط)' : 'خاص بحسابك'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyDriveLink}
                data-testid="copy-drive-link-btn"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                {copiedLink ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                )}
                <span>{copiedLink ? 'تم نسخ الرابط' : 'نسخ الرابط'}</span>
              </button>

              {!uploadedGuide.isPublic && (
                <button
                  type="button"
                  onClick={() => setShareConfirmOpen(true)}
                  data-testid="enable-drive-public-share-btn"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>تفعيل رابط المشاركة للجميع (قراءة فقط)</span>
                </button>
              )}

              <a
                href={uploadedGuide.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="open-drive-link-btn"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1D5CE5] hover:bg-[#174BB8] text-white text-xs font-bold"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                <span>فتح الملف في Google Drive</span>
              </a>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300 break-all select-all">
            {uploadedGuide.webViewLink}
          </div>
        </section>
      )}

      {shareConfirmOpen && uploadedGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="drive-share-dialog-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3
                  id="drive-share-dialog-title"
                  className="font-display text-base font-bold text-slate-900 dark:text-white"
                >
                  تأكيد تفعيل المشاركة العامة على Google Drive
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShareConfirmOpen(false)}
                disabled={updatingShare}
                aria-label="إغلاق نافذة التأكيد"
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              أنت على وشك تعديل صلاحية الملف{' '}
              <strong className="text-slate-900 dark:text-white">{uploadedGuide.name}</strong> على
              حسابك في Google Drive ليصبح متاحاً <strong>للقراءة فقط لأي شخص لديه الرابط</strong>. هل
              تريد المتابعة؟
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShareConfirmOpen(false)}
                disabled={updatingShare}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmPublicShare}
                disabled={updatingShare}
                data-testid="confirm-drive-share-btn"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold disabled:opacity-60"
              >
                {updatingShare && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                <span>تأكيد تفعيل المشاركة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10 Professional Capabilities */}
      <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <Sparkles className="w-5 h-5 text-[#1D5CE5]" aria-hidden="true" />
          <h2 className="font-display text-base font-bold">المنظومة المتكاملة للنظام (10 وحدات احترافية)</h2>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed">
          {TEN_CAPABILITIES.map((cap) => (
            <li
              key={cap}
              className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 font-medium text-slate-800 dark:text-slate-200"
            >
              {cap}
            </li>
          ))}
        </ul>
      </section>

      {/* Quick Start Workflow */}
      <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <h2 className="font-display text-base font-bold">دورة العمل القياسية في المكتب</h2>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
          <li className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <strong className="block text-sm text-slate-900 dark:text-white mb-1">
              01. تسجيل العميل وفتح الملف
            </strong>
            سجل العميل وأنشئ ملف القضية بالترقيم التلقائي، ثم اربطه ببوابة ناجز وحاسبة المدد النظامية لعدم فوات أي موعد استئناف.
          </li>
          <li className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <strong className="block text-sm text-slate-900 dark:text-white mb-1">
              02. الإجراءات والأرشفة الذكية والـ OCR
            </strong>
            ارفع المذكرات والصور لاستخراج نصوصها تلقائياً بالذكاء الاصطناعي وصياغة المذكرات وحفظ نسخ مشفرة في الخزينة.
          </li>
          <li className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <strong className="block text-sm text-slate-900 dark:text-white mb-1">
              03. الفوترة الضريبية والأمانات
            </strong>
            سجل ساعات العمل الاستشارية وحولها لفواتير ضريبية (15% + رمز QR)، وتابع إيداعات ومصروفات الأمانات والعهد.
          </li>
          <li className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <strong className="block text-sm text-slate-900 dark:text-white mb-1">
              04. العقود والتدقيق الأمني
            </strong>
            أبرم اتفاقيات الأتعاب ووقعها إلكترونياً، وراقب كل عمليات المكتب في سجل التدقيق الأمني مع عزل تام لكل بريد إلكتروني.
          </li>
        </ol>
      </section>

      {/* RBAC Matrix */}
      <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <h2 className="font-display text-base font-bold">مصفوفة الصلاحيات (RBAC)</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-3 py-2.5 font-semibold">الدور الوظيفي</th>
                <th className="px-3 py-2.5 font-semibold">نطاق القضايا</th>
                <th className="px-3 py-2.5 font-semibold">المالية والضرائب</th>
                <th className="px-3 py-2.5 font-semibold">التدقيق والإعدادات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="px-3 py-2.5 font-bold">مدير عام (Admin)</td>
                <td className="px-3 py-2.5">كافة القضايا والمدد والعقود</td>
                <td className="px-3 py-2.5">فواتير ZATCA وساعات العمل والأمانات</td>
                <td className="px-3 py-2.5">الإعدادات والفريق وسجل التدقيق</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-bold">محامٍ (Lawyer)</td>
                <td className="px-3 py-2.5">القضايا المكلف بها + الإجراءات والـ OCR</td>
                <td className="px-3 py-2.5">تسجيل الساعات الاستشارية</td>
                <td className="px-3 py-2.5">عرض التقارير دون تغيير الإعدادات</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-bold">سكرتارية (Secretary)</td>
                <td className="px-3 py-2.5">فتح الملفات والمواعيد والمرفقات</td>
                <td className="px-3 py-2.5">إصدار الفواتير وتحصيل الدفعات</td>
                <td className="px-3 py-2.5">إرسال التنبيهات والتقارير</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-bold">محاسب مالي (Accountant)</td>
                <td className="px-3 py-2.5">قراءة القضايا المرتبطة بالفواتير</td>
                <td className="px-3 py-2.5">صلاحية كاملة للفواتير والضرائب والأمانات</td>
                <td className="px-3 py-2.5">عرض سجل التدقيق المالي</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-bold">عميل (Client Portal)</td>
                <td className="px-3 py-2.5">قضاياه الخاصة والإجراءات المصرح بها</td>
                <td className="px-3 py-2.5">فواتيره وتوقيع عقوده إلكترونياً</td>
                <td className="px-3 py-2.5">معزول عن بقية بيانات المكتب</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* PostgreSQL Database Schema */}
      <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <Database className="w-5 h-5 text-slate-700 dark:text-amber-400" aria-hidden="true" />
          <h2 className="font-display text-base font-bold">
            هيكل قاعدة البيانات العلائقية (PostgreSQL Schema)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SCHEMA_ENTITIES.map((item) => (
            <div
              key={item.table}
              className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <strong className="text-xs font-bold text-slate-900 dark:text-white">
                  {item.arabicName}
                </strong>
                <code className="font-mono-num text-[11px] text-amber-700 dark:text-amber-400">
                  {item.table}
                </code>
              </div>
              <p className="font-mono text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed break-words">
                {item.columns}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
