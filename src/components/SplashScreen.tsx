import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(18);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setProgress(58), 220);
    const t2 = window.setTimeout(() => setProgress(92), 550);
    const t3 = window.setTimeout(() => {
      setProgress(100);
      onComplete();
    }, 1150);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-between bg-gradient-to-br from-[#071533] via-[#0B1E47] to-[#10295E] text-slate-100 px-6 py-10"
      data-testid="splash-screen"
    >
      <div className="w-full max-w-md flex justify-end">
        <button
          type="button"
          onClick={onComplete}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-blue-100 hover:text-white border border-blue-400/30 rounded-lg hover:bg-blue-900/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>تخطي إلى النظام</span>
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col items-center text-center max-w-lg">
        <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-amber-400/50 bg-[#0B1E47] mb-6 flex items-center justify-center shadow-xl">
          {!imgFailed ? (
            <img
              src="/src/assets/images/legal_office_emblem_1794665745736.jpg"
              alt="شعار نظام ميزان للمحاماة"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="font-display text-2xl font-bold text-amber-400">ميزان</span>
          )}
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
          السجل الرئيسي للعملاء والقضايا
        </h1>
        <p className="text-sm sm:text-base text-blue-200/80 leading-relaxed mb-8">
          نظام إدارة مكاتب المحاماة والشؤون القانونية · متابعة الجلسات · سجل الإجراءات · التقارير
        </p>

        <div className="w-64 h-1.5 bg-blue-950/80 rounded-full overflow-hidden mb-3 border border-blue-800/60">
          <div
            className="h-full bg-gradient-to-r from-[#2563EB] to-amber-400 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-blue-200/70 font-mono-num">
          جاري تهيئة بيئة العمل الآمنة... {progress}%
        </span>
      </div>

      <div className="w-full max-w-md border-t border-blue-800/60 pt-5 text-center">
        <p className="text-sm font-bold text-amber-400 tracking-wide">
          إعداد / النقيب امين عبدالرحيم
        </p>
      </div>
    </div>
  );
}
