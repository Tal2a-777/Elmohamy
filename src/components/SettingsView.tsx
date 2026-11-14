import { useState } from 'react';
import {
  Briefcase,
  Building2,
  CalendarClock,
  FolderCog,
  ImagePlus,
  Landmark,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { createSeedWorkspace } from '../data/seedData.ts';
import type {
  FirmMember,
  Lawyer,
  OfficeSettings,
  TeamPermissions,
} from '../types/legal.ts';
import { DEFAULT_ROLE_PERMISSIONS } from '../utils/legalLogic.ts';

interface SettingsViewProps {
  settings: OfficeSettings;
  lawyers: Lawyer[];
  firmMembers: FirmMember[];
  onSaveSettings: (updated: OfficeSettings) => Promise<void>;
  onAddLawyer: (input: Omit<Lawyer, 'id'>) => Promise<void>;
  onDeleteLawyer?: (id: number) => Promise<void>;
  onAddFirmMember: (input: {
    email: string;
    fullName: string;
    role: 'admin' | 'lawyer' | 'secretary' | 'accountant';
    permissions: TeamPermissions;
  }) => Promise<void>;
  onUpdateFirmMember: (
    id: number,
    patch: Partial<Pick<FirmMember, 'role' | 'permissions' | 'status'>>,
  ) => Promise<void>;
  onDeleteFirmMember: (id: number) => Promise<void>;
}

const ROLE_LABELS: Record<'admin' | 'lawyer' | 'secretary' | 'accountant', string> = {
  admin: 'مدير عام',
  lawyer: 'محامٍ',
  secretary: 'سكرتارية',
  accountant: 'محاسب مالي',
};

const PERMISSION_LABELS: { key: keyof TeamPermissions; label: string }[] = [
  { key: 'canViewCases', label: 'عرض القضايا' },
  { key: 'canEditCases', label: 'تعديل القضايا والإجراءات' },
  { key: 'canDeleteRecords', label: 'حذف السجلات' },
  { key: 'canManageBilling', label: 'إدارة الفواتير والأمانات' },
  { key: 'canManageSettings', label: 'إدارة الإعدادات' },
  { key: 'canViewAudit', label: 'عرض سجل التدقيق' },
];

export function SettingsView({
  settings,
  lawyers,
  firmMembers,
  onSaveSettings,
  onAddLawyer,
  onDeleteLawyer,
  onAddFirmMember,
  onUpdateFirmMember,
  onDeleteFirmMember,
}: SettingsViewProps) {
  const [form, setForm] = useState<OfficeSettings>(settings);
  const [newCaseType, setNewCaseType] = useState('');
  const [newCourt, setNewCourt] = useState('');
  const [lawyerName, setLawyerName] = useState('');
  const [lawyerSpec, setLawyerSpec] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  // Team Member invite state
  const [memberEmail, setMemberEmail] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState<'admin' | 'lawyer' | 'secretary' | 'accountant'>(
    'lawyer',
  );
  const [memberPerms, setMemberPerms] = useState<TeamPermissions>(
    DEFAULT_ROLE_PERMISSIONS.lawyer,
  );
  const [addingMember, setAddingMember] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedBanner(false);
    try {
      await onSaveSettings(form);
      setSavedBanner(true);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    const defaults = createSeedWorkspace().settings;
    setForm(defaults);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((s) => ({ ...s, officeLogoUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddCaseType = () => {
    const val = newCaseType.trim();
    if (!val || form.caseTypes.includes(val)) return;
    setForm((s) => ({ ...s, caseTypes: [...s.caseTypes, val] }));
    setNewCaseType('');
  };

  const handleAddCourt = () => {
    const val = newCourt.trim();
    if (!val || form.courts.includes(val)) return;
    setForm((s) => ({ ...s, courts: [...s.courts, val] }));
    setNewCourt('');
  };

  const handleAddLawyerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lawyerName.trim()) return;
    await onAddLawyer({
      name: lawyerName.trim(),
      specialty: lawyerSpec.trim() || 'قانون عام',
      phone: '',
      email: '',
      barNumber: '',
      active: true,
    });
    setLawyerName('');
    setLawyerSpec('');
  };

  const handleAddMemberSubmit = async () => {
    const email = memberEmail.trim().toLowerCase();
    const fullName = memberName.trim();
    if (!email || !fullName) return;
    setAddingMember(true);
    try {
      await onAddFirmMember({
        email,
        fullName,
        role: memberRole,
        permissions: memberPerms,
      });
      setMemberEmail('');
      setMemberName('');
      setMemberRole('lawyer');
      setMemberPerms(DEFAULT_ROLE_PERMISSIONS.lawyer);
    } finally {
      setAddingMember(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-5" data-testid="settings-view">
      {/* Header matching IMG_3810 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1E47] dark:text-white">
            الإعدادات
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            تهيئة بيانات النظام والإعدادات العامة
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>استعادة الافتراضي</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-[#1D5CE5] to-[#1545B5] text-white hover:from-[#1A52CE] hover:to-[#123B9E] shadow-sm cursor-pointer"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            <span>{saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</span>
          </button>
        </div>
      </div>

      {savedBanner && (
        <div className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-800 dark:text-emerald-200">
          تم حفظ إعدادات المكتب بنجاح.
        </div>
      )}

      {/* 6-Card Grid matching IMG_3810 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch">
        {/* Card 1: Office Info (highlighted border like IMG_3810) */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-800/60 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white">
              معلومات المكتب
            </h2>
            <Building2 className="w-5 h-5 text-[#1D5CE5] dark:text-amber-400" aria-hidden="true" />
          </div>

          <div>
            <label htmlFor="set-office-name" className="block text-xs font-medium mb-1">
              اسم المكتب *
            </label>
            <input
              id="set-office-name"
              type="text"
              value={form.officeName}
              onChange={(e) => setForm((s) => ({ ...s, officeName: e.target.value }))}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
          </div>

          <div>
            <label htmlFor="set-office-phone" className="block text-xs font-medium mb-1">
              هاتف المكتب
            </label>
            <input
              id="set-office-phone"
              type="text"
              value={form.officePhone}
              onChange={(e) => setForm((s) => ({ ...s, officePhone: e.target.value }))}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label htmlFor="set-vat-number" className="block text-xs font-medium mb-1">
                الرقم الضريبي (ZATCA)
              </label>
              <input
                id="set-vat-number"
                type="text"
                value={form.vatNumber || ''}
                onChange={(e) => setForm((s) => ({ ...s, vatNumber: e.target.value }))}
                placeholder="310123456700003"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
              />
            </div>
            <div>
              <label htmlFor="set-vat-rate" className="block text-xs font-medium mb-1">
                الضريبة %
              </label>
              <input
                id="set-vat-rate"
                type="number"
                min={0}
                max={100}
                value={form.vatRate ?? 15}
                onChange={(e) => setForm((s) => ({ ...s, vatRate: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num text-center"
              />
            </div>
          </div>

          <label
            htmlFor="set-logo-upload"
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-slate-800/40 cursor-pointer text-center"
          >
            {form.officeLogoUrl ? (
              <img
                src={form.officeLogoUrl}
                alt="شعار المكتب"
                className="w-12 h-12 rounded-lg object-cover mb-1.5"
              />
            ) : (
              <ImagePlus className="w-6 h-6 text-[#1D5CE5] mb-1.5" aria-hidden="true" />
            )}
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              إرفاق شعار المكتب
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5">JPG أو PNG</span>
            <input
              id="set-logo-upload"
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="sr-only"
            />
          </label>
        </section>

        {/* Card 2: Lawyers List */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white">
              قائمة المحامين
            </h2>
            <Users className="w-5 h-5 text-[#1D5CE5] dark:text-blue-400" aria-hidden="true" />
          </div>

          <ul className="space-y-2 flex-1 max-h-48 overflow-y-auto">
            {lawyers.map((l) => (
              <li
                key={l.id}
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold block">{l.name}</span>
                  <span className="text-[11px] text-slate-400">{l.specialty}</span>
                </div>
                {onDeleteLawyer && (
                  <button
                    type="button"
                    aria-label={`حذف المحامي ${l.name}`}
                    onClick={() => onDeleteLawyer(l.id)}
                    className="text-red-500 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="grid grid-cols-12 gap-2">
              <input
                type="text"
                value={lawyerName}
                onChange={(e) => setLawyerName(e.target.value)}
                placeholder="اسم المحامي الجديد..."
                className="col-span-7 min-w-0 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
              <input
                type="text"
                value={lawyerSpec}
                onChange={(e) => setLawyerSpec(e.target.value)}
                placeholder="التخصص"
                className="col-span-5 min-w-0 w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <button
              type="button"
              onClick={handleAddLawyerSubmit}
              className="w-full py-2 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-slate-800 text-[#1D5CE5] dark:text-amber-400 hover:bg-blue-100 cursor-pointer flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>إضافة محامٍ جديد</span>
            </button>
          </div>
        </section>

        {/* Card 3: Case Types */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white">
              أنواع القضايا
            </h2>
            <Briefcase className="w-5 h-5 text-[#1D5CE5] dark:text-blue-400" aria-hidden="true" />
          </div>

          <ul className="space-y-2 flex-1 max-h-48 overflow-y-auto">
            {form.caseTypes.map((ct) => (
              <li
                key={ct}
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-xs"
              >
                <span className="font-medium">{ct}</span>
                <button
                  type="button"
                  aria-label={`حذف ${ct}`}
                  onClick={() =>
                    setForm((s) => ({
                      ...s,
                      caseTypes: s.caseTypes.filter((x) => x !== ct),
                    }))
                  }
                  className="text-red-500 hover:text-red-700 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <input
              type="text"
              value={newCaseType}
              onChange={(e) => setNewCaseType(e.target.value)}
              placeholder="نوع قضية جديد..."
              className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
            <button
              type="button"
              onClick={handleAddCaseType}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-slate-800 text-[#1D5CE5] dark:text-amber-400 hover:bg-blue-100 cursor-pointer shrink-0 whitespace-nowrap"
            >
              + إضافة
            </button>
          </div>
        </section>

        {/* Card 4: Courts & Entities */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white">
              الجهات والدوائر
            </h2>
            <Landmark className="w-5 h-5 text-[#1D5CE5] dark:text-blue-400" aria-hidden="true" />
          </div>

          <ul className="space-y-2 flex-1 max-h-48 overflow-y-auto">
            {form.courts.map((ct) => (
              <li
                key={ct}
                className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-xs"
              >
                <span className="font-medium truncate">{ct}</span>
                <button
                  type="button"
                  aria-label={`حذف ${ct}`}
                  onClick={() =>
                    setForm((s) => ({
                      ...s,
                      courts: s.courts.filter((x) => x !== ct),
                    }))
                  }
                  className="text-red-500 hover:text-red-700 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <input
              type="text"
              value={newCourt}
              onChange={(e) => setNewCourt(e.target.value)}
              placeholder="إضافة جهة أو محكمة..."
              className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
            />
            <button
              type="button"
              onClick={handleAddCourt}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-slate-800 text-[#1D5CE5] dark:text-amber-400 hover:bg-blue-100 cursor-pointer shrink-0 whitespace-nowrap"
            >
              + إضافة
            </button>
          </div>
        </section>

        {/* Card 5: File Numbering Settings */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white">
              إعدادات ترقيم الملفات
            </h2>
            <FolderCog className="w-5 h-5 text-[#1D5CE5] dark:text-amber-400" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-3 gap-3 items-end">
            <div className="col-span-2">
              <label htmlFor="set-prefix" className="block text-xs font-medium mb-1">
                بادئة رقم القضية *
              </label>
              <input
                id="set-prefix"
                type="text"
                value={form.autoNumberPrefix}
                onChange={(e) => setForm((s) => ({ ...s, autoNumberPrefix: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
              />
            </div>

            <div>
              <label htmlFor="set-next-seq" className="block text-xs font-medium mb-1">
                التالي
              </label>
              <input
                id="set-next-seq"
                type="number"
                min={1}
                value={form.autoNumberNext}
                onChange={(e) => setForm((s) => ({ ...s, autoNumberNext: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num text-center font-bold text-[#1D5CE5]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="set-client-prefix" className="block text-xs font-medium mb-1">
              بادئة رقم العميل *
            </label>
            <input
              id="set-client-prefix"
              type="text"
              value={form.clientNumberPrefix || 'CL'}
              onChange={(e) =>
                setForm((s) => ({ ...s, clientNumberPrefix: e.target.value }))
              }
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
            />
          </div>

          <p className="text-[11px] text-slate-400">
            التسلسل التلقائي للملفات القائمة لا يُعاد ترقيمه عند تغيير البادئة.
          </p>
        </section>

        {/* Card 6: Hearing & Notification Settings */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white">
              إعدادات المواعيد والتنبيهات
            </h2>
            <CalendarClock className="w-5 h-5 text-[#D97706] dark:text-amber-400" aria-hidden="true" />
          </div>

          <div>
            <label htmlFor="set-reminder-days" className="block text-xs font-medium mb-1">
              التنبيه قبل الموعد (أيام)
            </label>
            <input
              id="set-reminder-days"
              type="number"
              min={1}
              max={30}
              value={form.reminderDaysBefore}
              onChange={(e) =>
                setForm((s) => ({ ...s, reminderDaysBefore: Number(e.target.value) }))
              }
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
            />
          </div>

          <div className="space-y-2.5 pt-1">
            <label className="flex items-center justify-between gap-2 text-xs font-medium cursor-pointer">
              <span>إلزام مصدر الموعد</span>
              <input
                type="checkbox"
                checked={form.requireHearingSource !== false}
                onChange={(e) =>
                  setForm((s) => ({ ...s, requireHearingSource: e.target.checked }))
                }
                className="accent-emerald-600 w-4 h-4"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs font-medium cursor-pointer">
              <span>إشعارات WhatsApp API</span>
              <input
                type="checkbox"
                checked={form.whatsappEnabled}
                onChange={(e) => setForm((s) => ({ ...s, whatsappEnabled: e.target.checked }))}
                className="accent-[#1D5CE5] w-4 h-4"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs font-medium cursor-pointer">
              <span>تنبيهات البريد الإلكتروني</span>
              <input
                type="checkbox"
                checked={form.emailNotificationsEnabled}
                onChange={(e) =>
                  setForm((s) => ({ ...s, emailNotificationsEnabled: e.target.checked }))
                }
                className="accent-[#1D5CE5] w-4 h-4"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs font-medium cursor-pointer">
              <span>رسائل SMS للجلسات العاجلة (72/24 ساعة)</span>
              <input
                type="checkbox"
                checked={Boolean(form.smsEnabled)}
                onChange={(e) => setForm((s) => ({ ...s, smsEnabled: e.target.checked }))}
                className="accent-[#1D5CE5] w-4 h-4"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs font-medium cursor-pointer">
              <span>المزامنة التلقائية مع منصة ناجز</span>
              <input
                type="checkbox"
                checked={form.najizAutoSync !== false}
                onChange={(e) => setForm((s) => ({ ...s, najizAutoSync: e.target.checked }))}
                className="accent-emerald-600 w-4 h-4"
              />
            </label>
          </div>
        </section>
      </div>

      {/* Multi-User Firm Workspace & Granular Permissions Management */}
      <section
        data-testid="firm-members-section"
        className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#1D5CE5]" aria-hidden="true" />
              <span>إدارة فريق العمل والصلاحيات الدقيقة (Multi-User RBAC)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ادعُ أعضاء مكتبك بالبريد الإلكتروني مع تحديد الصلاحيات الست بدقة. تبقى جميع الحسابات غير المضافة معزولة تماماً.
            </p>
          </div>
          <span className="font-mono-num text-xs text-slate-500">
            {firmMembers.length} عضو
          </span>
        </div>

        {/* Invite Member Controls */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label htmlFor="member-name" className="block text-xs font-medium mb-1">
                الاسم الكامل
              </label>
              <input
                id="member-name"
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="مثال: أ. خالد السالم"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label htmlFor="member-email" className="block text-xs font-medium mb-1">
                البريد الإلكتروني
              </label>
              <input
                id="member-email"
                type="email"
                dir="ltr"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="colleague@lawfirm.com"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-right"
              />
            </div>

            <div>
              <label htmlFor="member-role" className="block text-xs font-medium mb-1">
                الدور الوظيفي
              </label>
              <select
                id="member-role"
                value={memberRole}
                onChange={(e) => {
                  const r = e.target.value as 'admin' | 'lawyer' | 'secretary' | 'accountant';
                  setMemberRole(r);
                  setMemberPerms(DEFAULT_ROLE_PERMISSIONS[r]);
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="lawyer">محامٍ</option>
                <option value="secretary">سكرتارية</option>
                <option value="accountant">محاسب مالي</option>
                <option value="admin">مدير عام</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                disabled={addingMember || !memberEmail.trim() || !memberName.trim()}
                onClick={handleAddMemberSubmit}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#1D5CE5] text-white hover:bg-[#1545B5] disabled:opacity-50 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                <span>{addingMember ? 'جاري الإضافة...' : 'إضافة عضو للفريق'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            {PERMISSION_LABELS.map((perm) => (
              <label
                key={perm.key}
                className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={memberPerms[perm.key]}
                  onChange={(e) =>
                    setMemberPerms((prev) => ({ ...prev, [perm.key]: e.target.checked }))
                  }
                  className="accent-[#1D5CE5] w-3.5 h-3.5"
                />
                <span>{perm.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Members List */}
        {firmMembers.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            لا يوجد أعضاء إضافيون في الفريق بعد. يمكنك دعوة محامين أو محاسبين أو سكرتارية أعلاه.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">العضو والبريد</th>
                  <th className="px-3 py-2.5 font-semibold">الدور</th>
                  <th className="px-3 py-2.5 font-semibold">الصلاحيات المفعلة</th>
                  <th className="px-3 py-2.5 font-semibold">إزالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {firmMembers.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-3">
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {m.fullName}
                      </span>
                      <span className="font-mono-num text-[11px] text-slate-500">{m.email}</span>
                    </td>
                    <td className="px-3 py-3 font-semibold text-[#1D5CE5] dark:text-amber-400">
                      {ROLE_LABELS[m.role]}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-3">
                        {PERMISSION_LABELS.map((perm) => (
                          <label
                            key={perm.key}
                            className="inline-flex items-center gap-1 text-[11px] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(m.permissions[perm.key])}
                              onChange={(e) =>
                                onUpdateFirmMember(m.id, {
                                  permissions: {
                                    ...m.permissions,
                                    [perm.key]: e.target.checked,
                                  },
                                })
                              }
                              className="accent-[#1D5CE5] w-3 h-3"
                            />
                            <span>{perm.label}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => onDeleteFirmMember(m.id)}
                        aria-label={`إزالة العضو ${m.fullName}`}
                        className="p-1.5 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </form>
  );
}
