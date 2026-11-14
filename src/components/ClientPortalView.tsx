import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Eraser, FileSignature, FileText, Scale, X } from 'lucide-react';
import type {
  Client,
  Invoice,
  LegalCase,
  LegalContract,
  Procedure,
} from '../types/legal.ts';
import { calculateClientFinancialSummary } from '../utils/legalLogic.ts';
import { CaseStatusTag, InvoiceStatusTag } from './StatusBadge.tsx';

interface ClientPortalViewProps {
  clients: Client[];
  selectedClientId: number;
  onChangeClient: (id: number) => void;
  cases: LegalCase[];
  procedures: Procedure[];
  invoices: Invoice[];
  contracts: LegalContract[];
  onSignContract: (
    id: number,
    signerName: string,
    signatureDataUrl: string,
  ) => Promise<void>;
}

export function ClientPortalView({
  clients,
  selectedClientId,
  onChangeClient,
  cases,
  procedures,
  invoices,
  contracts,
  onSignContract,
}: ClientPortalViewProps) {
  const [signingContract, setSigningContract] = useState<LegalContract | null>(null);
  const [signerName, setSignerName] = useState('');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signingBusy, setSigningBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const client = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? clients[0] ?? null,
    [clients, selectedClientId],
  );

  const clientCases = useMemo(
    () => (client ? cases.filter((c) => c.clientId === client.id) : []),
    [cases, client],
  );

  const clientCaseIds = useMemo(
    () => new Set(clientCases.map((c) => c.id)),
    [clientCases],
  );

  const visibleProcedures = useMemo(
    () =>
      procedures.filter((p) => clientCaseIds.has(p.caseId) && p.visibleToClient),
    [procedures, clientCaseIds],
  );

  const clientInvoices = useMemo(
    () => (client ? invoices.filter((i) => i.clientId === client.id) : []),
    [invoices, client],
  );

  const clientContracts = useMemo(
    () => (client ? contracts.filter((c) => c.clientId === client.id) : []),
    [contracts, client],
  );

  const financials = useMemo(
    () =>
      client ? calculateClientFinancialSummary(client.id, cases, invoices) : null,
    [client, cases, invoices],
  );

  useEffect(() => {
    if (signingContract) {
      setSignerName(client?.name || '');
      setHasDrawn(false);
      window.setTimeout(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#0B1E47';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }, 40);
    }
  }, [signingContract, client]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const handleConfirmSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signingContract || !signerName.trim() || !hasDrawn || !canvasRef.current) return;
    setSigningBusy(true);
    try {
      await onSignContract(
        signingContract.id,
        signerName.trim(),
        canvasRef.current.toDataURL('image/png'),
      );
      setSigningContract(null);
    } finally {
      setSigningBusy(false);
    }
  };

  if (!client) {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        لا توجد حسابات عملاء متاحة للعرض حالياً.
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="client-portal-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div>
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
            بوابة العملاء المخصصة (عرض مقيد بملفات العميل فقط)
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-1">
            مرحباً، {client.name}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="portal-client-select" className="text-xs text-slate-500">
            معاينة حساب العميل:
          </label>
          <select
            id="portal-client-select"
            value={client.id}
            onChange={(e) => onChangeClient(Number(e.target.value))}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          >
            {clients.map((cl) => (
              <option key={cl.id} value={cl.id}>
                {cl.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Strip */}
      {financials && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 block">قضاياي المسجلة</span>
            <span className="font-mono-num text-2xl font-bold mt-1 block">
              {clientCases.length}
            </span>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 block">المبالغ المدفوعة</span>
            <span className="font-mono-num text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 block">
              {financials.totalPaid.toLocaleString('en-US')} ر.س
            </span>
          </div>
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 block">الرصيد المتبقي</span>
            <span className="font-mono-num text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1 block">
              {financials.balanceDue.toLocaleString('en-US')} ر.س
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Client Cases */}
        <section className="lg:col-span-7 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <Scale className="w-4 h-4 text-amber-600" aria-hidden="true" />
            <h2 className="font-display text-base font-bold">حالة القضايا ومواعيد الجلسات</h2>
          </div>

          <div className="space-y-3">
            {clientCases.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-num text-xs font-bold text-amber-700 dark:text-amber-400">
                    {c.caseCode} · رقم رسمي {c.officialNumber}
                  </span>
                  <CaseStatusTag status={c.status} />
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {c.subject}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>{c.courtName}</span>
                  <span aria-hidden="true">·</span>
                  <span>المحامي: {c.lawyerName}</span>
                  {c.nextHearingDate && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 text-slate-800 dark:text-slate-200 font-medium font-mono-num">
                        <CalendarClock className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                        الجلسة القادمة: {c.nextHearingDate}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Visible Documents, Contracts & Invoices */}
        <div className="lg:col-span-5 space-y-6">
          {/* Contracts & E-Signature */}
          <section className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h2 className="font-display text-base font-bold border-b border-slate-200 dark:border-slate-800 pb-3">
              العقود والاتفاقيات للتوقيع الإلكتروني
            </h2>
            {clientContracts.length === 0 ? (
              <p className="text-xs text-slate-500">لا توجد اتفاقيات أو تفويضات موجهة إليك حالياً.</p>
            ) : (
              <ul className="space-y-2.5">
                {clientContracts.map((ct) => (
                  <li
                    key={ct.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">{ct.title}</span>
                      <span
                        className={`font-semibold ${
                          ct.status === 'signed' ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      >
                        {ct.status === 'signed' ? 'موقّع' : 'بانتظار توقيعك'}
                      </span>
                    </div>
                    <p className="text-slate-500">{ct.feeTerms}</p>
                    {ct.status !== 'signed' && (
                      <button
                        type="button"
                        onClick={() => setSigningContract(ct)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1D5CE5] text-white hover:bg-[#1545B5] cursor-pointer"
                      >
                        <FileSignature className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>توقيع إلكتروني الآن</span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h2 className="font-display text-base font-bold border-b border-slate-200 dark:border-slate-800 pb-3">
              المستندات والإجراءات المصرح بمشاهدتها
            </h2>
            {visibleProcedures.length === 0 ? (
              <p className="text-xs text-slate-500">لا توجد مستندات منشورة بعد.</p>
            ) : (
              <ul className="space-y-2.5">
                {visibleProcedures.map((p) => (
                  <li
                    key={p.id}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                  >
                    <div className="font-mono-num text-[11px] text-slate-500">{p.procedureDate}</div>
                    <p className="text-slate-800 dark:text-slate-200">{p.description}</p>
                    {p.attachmentName && (
                      <div className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                        <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{p.attachmentName}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h2 className="font-display text-base font-bold border-b border-slate-200 dark:border-slate-800 pb-3">
              الفواتير والدفعات
            </h2>
            {clientInvoices.length === 0 ? (
              <p className="text-xs text-slate-500">لا توجد فواتير صادرة.</p>
            ) : (
              <ul className="space-y-2">
                {clientInvoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-mono-num font-bold">{inv.invoiceNumber}</div>
                      <div className="text-slate-500">{inv.description}</div>
                    </div>
                    <div className="text-left space-y-1">
                      <div className="font-mono-num font-bold">
                        {(
                          inv.feeAmount +
                          inv.expensesAmount +
                          Number(inv.vatAmount || 0)
                        ).toLocaleString('en-US')}{' '}
                        ر.س
                      </div>
                      <InvoiceStatusTag status={inv.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Client Portal E-Signature Modal */}
      {signingContract && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-display text-base font-bold">
                توقيع: {signingContract.title}
              </h3>
              <button
                type="button"
                onClick={() => setSigningContract(null)}
                aria-label="إغلاق"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSign} className="space-y-3">
              <div>
                <label htmlFor="portal-signer-name" className="block text-xs font-medium mb-1">
                  اسم الموقّع *
                </label>
                <input
                  id="portal-signer-name"
                  type="text"
                  required
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">ارسم التوقيع:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const ctx = canvasRef.current?.getContext('2d');
                      if (ctx && canvasRef.current) {
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                        setHasDrawn(false);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 cursor-pointer"
                  >
                    <Eraser className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>مسح</span>
                  </button>
                </div>
                <canvas
                  ref={canvasRef}
                  width={420}
                  height={150}
                  onPointerDown={(e) => {
                    const ctx = canvasRef.current?.getContext('2d');
                    if (!ctx || !canvasRef.current) return;
                    canvasRef.current.setPointerCapture(e.pointerId);
                    const pt = getPoint(e);
                    drawingRef.current = true;
                    ctx.beginPath();
                    ctx.moveTo(pt.x, pt.y);
                    ctx.lineTo(pt.x + 0.5, pt.y + 0.5);
                    ctx.stroke();
                    setHasDrawn(true);
                  }}
                  onPointerMove={(e) => {
                    if (!drawingRef.current) return;
                    const ctx = canvasRef.current?.getContext('2d');
                    if (!ctx) return;
                    const pt = getPoint(e);
                    ctx.lineTo(pt.x, pt.y);
                    ctx.stroke();
                  }}
                  onPointerUp={() => {
                    drawingRef.current = false;
                  }}
                  className="w-full h-36 rounded-xl border-2 border-dashed border-slate-300 bg-white touch-none cursor-crosshair"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSigningContract(null)}
                  className="px-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={signingBusy || !hasDrawn || !signerName.trim()}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {signingBusy ? 'جاري التوقيع...' : 'اعتماد التوقيع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
