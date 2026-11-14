import { useState } from 'react';
import { LogIn, Mail, ShieldCheck, Sun, Moon } from 'lucide-react';

interface LoginPageProps {
  onGoogleLogin: () => Promise<void>;
  onEmailWorkspaceLogin: (email: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  authLoading: boolean;
  authError: string | null;
}

export function LoginPage({
  onGoogleLogin,
  onEmailWorkspaceLogin,
  isDark,
  onToggleTheme,
  authLoading,
  authError,
}: LoginPageProps) {
  const [heroImgError, setHeroImgError] = useState(false);
  const [logoImgError, setLogoImgError] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = emailInput.trim().toLowerCase();
    if (!cleaned || !cleaned.includes('@') || !cleaned.includes('.')) {
      setEmailError('يرجى إدخال بريد إلكتروني صحيح لفتح مساحتك الخاصة.');
      return;
    }
    setEmailError(null);
    onEmailWorkspaceLogin(cleaned);
  };

  return (
    <div
      data-testid="login-page"
      className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-12 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
    >
      {/* Right Form Column (RTL Start) */}
      <div className="lg:col-span-5 flex flex-col justify-between px-6 sm:px-12 py-8 bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-l border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 shrink-0 flex items-center justify-center">
              {!logoImgError ? (
                <img
                  src="/src/assets/images/legal_office_emblem_1794665745736.jpg"
                  alt="شعار ميزان"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-bold text-amber-400">ميزان</span>
              )}
            </div>
            <div>
              <p className="font-display font-bold text-base text-slate-900 dark:text-white leading-tight">
                ميزان للشؤون القانونية
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                السجل الرئيسي للعملاء والقضايا
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <div className="my-auto py-8 max-w-md w-full mx-auto space-y-5">
          <div>
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">
              بوابة الدخول الموحدة · مساحة معزولة لكل بريد إلكتروني
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
              تسجيل الدخول إلى النظام
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              كل بريد إلكتروني يحصل على مساحة عمل مستقلة تماماً بعملائها وقضاياها وفواتيرها دون أي تداخل مع أي حساب آخر.
            </p>
          </div>

          {(authError || emailError) && (
            <div
              role="alert"
              className="p-3.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300"
            >
              {authError || emailError}
            </div>
          )}

          {/* Direct Per-Email Isolated Workspace Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-2.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <label htmlFor="login-email-input" className="block text-xs font-bold text-[#0B1E47] dark:text-slate-200">
              الدخول ببريد إلكتروني مخصص (مساحة عمل معزولة وفارغة للمستخدم الجديد)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Mail
                  className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="login-email-input"
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="name@lawfirm.com"
                  dir="ltr"
                  className="w-full pr-9 pl-3 py-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-right"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0B1E47] text-white text-xs font-semibold hover:bg-[#132B63] transition-colors cursor-pointer shrink-0"
              >
                <ShieldCheck className="w-4 h-4 text-amber-300" aria-hidden="true" />
                <span>دخول بالبريد</span>
              </button>
            </div>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
            <span className="shrink mx-3 text-[11px] text-slate-400">أو المزامنة السحابية</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
          </div>

          <button
            type="button"
            onClick={onGoogleLogin}
            disabled={authLoading}
            className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-lg bg-gradient-to-r from-[#1D5CE5] to-[#1545B5] text-white font-semibold text-sm hover:from-[#1A52CE] hover:to-[#123B9E] shadow-sm transition-all disabled:opacity-60 cursor-pointer"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            <span>
              {authLoading ? 'جاري التحقق من الحساب...' : 'تسجيل الدخول بحساب Google (Cloud SQL)'}
            </span>
          </button>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
            <p className="text-sm font-bold text-[#0B1E47] dark:text-amber-400">
              إعداد / النقيب امين عبدالرحيم
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              نظام إدارة مكاتب المحاماة والشؤون القانونية · عزل كامل لكل بريد إلكتروني
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-500 flex items-center justify-between">
          <span>تشفير AES-256 للوثائق</span>
          <span>متوافق مع الفوترة الضريبية ZATCA</span>
        </div>
      </div>

      {/* Left Architectural Editorial Column */}
      <div className="lg:col-span-7 relative min-h-[320px] lg:min-h-screen bg-slate-900 overflow-hidden flex items-end">
        {!heroImgError ? (
          <img
            src="/src/assets/images/legal_chambers_hero_1794665747143.jpg"
            alt="قاعة اجتماعات ومكتبة مكتب محاماة"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgError(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/20" />

        <div className="relative z-10 p-8 sm:p-12 max-w-2xl">
          <p className="text-xs font-medium text-amber-400 mb-2">
            إدارة قانونية دقيقة · خزينة مشفرة · فواتير ZATCA · توقيع إلكتروني
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white leading-snug mb-3">
            المرجع المركزي لإدارة القضايا، الجلسات، المذكرات، والحسابات المالية للمكتب
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            ربط مباشر بين ملفات العملاء وسجل الإجراءات، حاسبة المدد النظامية، استخراج النصوص بالذكاء الاصطناعي (OCR)، وصياغة المذكرات القانونية بخصوصية تامة لكل حساب.
          </p>
        </div>
      </div>
    </div>
  );
}
