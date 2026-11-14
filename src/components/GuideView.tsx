import { BookOpen, Database, FileDown, Shield, Sparkles } from 'lucide-react';

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

export function GuideView() {
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
