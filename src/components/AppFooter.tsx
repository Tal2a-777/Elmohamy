interface AppFooterProps {
  officeName: string;
}

export function AppFooter({ officeName }: AppFooterProps) {
  return (
    <footer
      className="no-print mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4"
      data-testid="persistent-footer"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800 dark:text-slate-200">{officeName}</span>
          <span aria-hidden="true">·</span>
          <span>السجل الرئيسي للعملاء والقضايا</span>
        </div>
        <div className="font-bold text-sm text-[#0B1E47] dark:text-amber-400">
          إعداد / النقيب امين عبدالرحيم
        </div>
      </div>
    </footer>
  );
}
