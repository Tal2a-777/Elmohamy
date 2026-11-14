import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Clock,
  CreditCard,
  Landmark,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Trash2,
  X,
} from 'lucide-react';
import type {
  Client,
  Invoice,
  InvoiceType,
  LegalCase,
  OfficeSettings,
  TimeEntry,
  TrustTransaction,
} from '../types/legal.ts';
import {
  calculateTrustBalance,
  computeInvoiceTotals,
  generateZatcaQrPayload,
} from '../utils/legalLogic.ts';
import { InvoiceStatusTag } from './StatusBadge.tsx';

interface BillingViewProps {
  clients: Client[];
  cases: LegalCase[];
  invoices: Invoice[];
  timeEntries: TimeEntry[];
  trustTransactions: TrustTransaction[];
  settings: OfficeSettings;
  onCreateInvoice: (
    input: Omit<Invoice, 'id' | 'invoiceNumber' | 'status' | 'vatAmount' | 'zatcaQr'> & {
      timeEntryIds?: number[];
    },
  ) => Promise<void>;
  onRecordPayment: (invoiceId: number, paidAmount: number) => Promise<void>;
  onCreateTimeEntry: (input: Omit<TimeEntry, 'id' | 'invoiced'>) => Promise<void>;
  onDeleteTimeEntry: (id: number) => Promise<void>;
  onCreateTrustTx: (input: Omit<TrustTransaction, 'id'>) => Promise<void>;
  canEdit: boolean;
}

const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  tax_invoice: 'فاتورة ضريبية',
  credit_note: 'إشعار دائن (خصم)',
  debit_note: 'إشعار مدين (إضافة)',
};

export function BillingView({
  clients,
  cases,
  invoices,
  timeEntries,
  trustTransactions,
  settings,
  onCreateInvoice,
  onRecordPayment,
  onCreateTimeEntry,
  onDeleteTimeEntry,
  onCreateTrustTx,
  canEdit,
}: BillingViewProps) {
  const [subTab, setSubTab] = useState<'invoices' | 'time' | 'trust'>('invoices');
  const [banner, setBanner] = useState<string | null>(null);

  // Invoice form state
  const [showForm, setShowForm] = useState(false);
  const [caseId, setCaseId] = useState<number>(cases[0]?.id || 0);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('tax_invoice');
  const [description, setDescription] = useState('');
  const [feeAmount, setFeeAmount] = useState('15000');
  const [expensesAmount, setExpensesAmount] = useState('0');
  const [vatRate, setVatRate] = useState<string>(String(settings.vatRate ?? 15));
  const [paidAmount, setPaidAmount] = useState('0');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Invoice QR & Print preview
  const [printingInvoice, setPrintingInvoice] = useState<Invoice | null>(null);
  const [previewQrInvoice, setPreviewQrInvoice] = useState<Invoice | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Time Tracking form state
  const [timeCaseId, setTimeCaseId] = useState<number>(cases[0]?.id || 0);
  const [timeLawyer, setTimeLawyer] = useState('');
  const [timeHours, setTimeHours] = useState('2');
  const [timeRate, setTimeRate] = useState('600');
  const [timeDesc, setTimeDesc] = useState('');
  const [timeDate, setTimeDate] = useState(new Date().toISOString().slice(0, 10));
  const [savingTime, setSavingTime] = useState(false);

  // Trust Accounting form state
  const [trustClientId, setTrustClientId] = useState<number>(clients[0]?.id || 0);
  const [trustCaseId, setTrustCaseId] = useState<string>('');
  const [trustTxType, setTrustTxType] = useState<'deposit' | 'deduction' | 'refund'>('deposit');
  const [trustAmount, setTrustAmount] = useState('10000');
  const [trustDesc, setTrustDesc] = useState('');
  const [trustRef, setTrustRef] = useState('');
  const [trustDate, setTrustDate] = useState(new Date().toISOString().slice(0, 10));
  const [trustFilterClient, setTrustFilterClient] = useState<string>('all');
  const [savingTrust, setSavingTrust] = useState(false);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const caseMap = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);

  const activeQrInvoice = previewQrInvoice || printingInvoice;

  useEffect(() => {
    let active = true;
    if (!activeQrInvoice) {
      setQrDataUrl('');
      return;
    }
    const totals = computeInvoiceTotals(
      activeQrInvoice.feeAmount,
      activeQrInvoice.expensesAmount,
      activeQrInvoice.vatRate ?? 15,
      activeQrInvoice.invoiceType ?? 'tax_invoice',
    );
    const tlv =
      activeQrInvoice.zatcaQr ||
      generateZatcaQrPayload({
        sellerName: settings.officeName,
        vatNumber: settings.vatNumber || '300000000000003',
        timestampIso: `${activeQrInvoice.issuedDate}T12:00:00Z`,
        totalWithVat: totals.totalWithVat,
        vatAmount: totals.vatAmount,
      });
    QRCode.toDataURL(tlv, { width: 180, margin: 1 })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [activeQrInvoice, settings.officeName, settings.vatNumber]);

  const previewTotals = useMemo(
    () =>
      computeInvoiceTotals(
        Number(feeAmount || 0),
        Number(expensesAmount || 0),
        Number(vatRate || 0),
        invoiceType,
      ),
    [feeAmount, expensesAmount, vatRate, invoiceType],
  );

  const financialTotals = useMemo(() => {
    let billed = 0;
    let vatTotal = 0;
    let paid = 0;
    for (const inv of invoices) {
      const sign = inv.invoiceType === 'credit_note' ? -1 : 1;
      const vat = Number(inv.vatAmount || 0);
      billed += sign * (inv.feeAmount + inv.expensesAmount + vat);
      vatTotal += sign * vat;
      paid += sign * inv.paidAmount;
    }
    return {
      billed: Math.max(0, billed),
      vatTotal: Math.max(0, vatTotal),
      paid: Math.max(0, paid),
      due: Math.max(0, billed - paid),
    };
  }, [invoices]);

  const unbilledEntries = useMemo(
    () => timeEntries.filter((t) => t.billable && !t.invoiced),
    [timeEntries],
  );
  const unbilledHoursTotal = useMemo(
    () => unbilledEntries.reduce((s, e) => s + Number(e.hours || 0), 0),
    [unbilledEntries],
  );
  const unbilledAmountTotal = useMemo(
    () => unbilledEntries.reduce((s, e) => s + Number(e.hours || 0) * Number(e.hourlyRate || 0), 0),
    [unbilledEntries],
  );

  const trustSummary = useMemo(
    () =>
      calculateTrustBalance(
        trustTransactions,
        trustFilterClient === 'all' ? undefined : Number(trustFilterClient),
      ),
    [trustTransactions, trustFilterClient],
  );

  const visibleTrustTx = useMemo(
    () =>
      trustFilterClient === 'all'
        ? trustTransactions
        : trustTransactions.filter((t) => String(t.clientId) === trustFilterClient),
    [trustTransactions, trustFilterClient],
  );

  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenCase = caseMap.get(caseId || cases[0]?.id || 0);
    if (!chosenCase || !description.trim()) return;
    setSaving(true);
    try {
      await onCreateInvoice({
        caseId: chosenCase.id,
        clientId: chosenCase.clientId,
        description: description.trim(),
        feeAmount: Number(feeAmount || 0),
        expensesAmount: Number(expensesAmount || 0),
        vatRate: Number(vatRate || 0),
        invoiceType,
        paidAmount: Number(paidAmount || 0),
        issuedDate: new Date().toISOString().slice(0, 10),
        dueDate,
        notes: notes.trim(),
      });
      setDescription('');
      setNotes('');
      setShowForm(false);
      setBanner('تم إصدار الفاتورة الضريبية وتوليد رمز الاستجابة السريعة (ZATCA QR) بنجاح.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCase = caseMap.get(timeCaseId || cases[0]?.id || 0);
    if (!targetCase || !timeDesc.trim()) return;
    setSavingTime(true);
    try {
      await onCreateTimeEntry({
        caseId: targetCase.id,
        lawyerName: timeLawyer.trim() || targetCase.lawyerName || 'المحامي المختص',
        hours: Number(timeHours || 1),
        hourlyRate: Number(timeRate || 500),
        billable: true,
        description: timeDesc.trim(),
        entryDate: timeDate,
      });
      setTimeDesc('');
      setBanner('تم تسجيل ساعات العمل الاستشارية في السجل بنجاح.');
    } finally {
      setSavingTime(false);
    }
  };

  const handleConvertHoursToInvoice = async () => {
    if (unbilledEntries.length === 0) return;
    const firstCase = caseMap.get(unbilledEntries[0].caseId) || cases[0];
    if (!firstCase) return;
    await onCreateInvoice({
      caseId: firstCase.id,
      clientId: firstCase.clientId,
      description: `أتعاب ساعات عمل استشارية (${unbilledHoursTotal} ساعة غير مفوترة)`,
      feeAmount: Math.round(unbilledAmountTotal * 100) / 100,
      expensesAmount: 0,
      vatRate: settings.vatRate ?? 15,
      invoiceType: 'tax_invoice',
      paidAmount: 0,
      issuedDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date().toISOString().slice(0, 10),
      notes: 'تم تحويلها تلقائياً من سجل ساعات العمل',
      timeEntryIds: unbilledEntries.map((e) => e.id),
    });
    setSubTab('invoices');
    setBanner(`تم تحويل ${unbilledHoursTotal} ساعة إلى فاتورة ضريبية متوافقة مع ZATCA بنجاح.`);
  };

  const handleAddTrustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetClientId = trustClientId || clients[0]?.id;
    if (!targetClientId || Number(trustAmount) <= 0) return;
    setSavingTrust(true);
    try {
      await onCreateTrustTx({
        clientId: targetClientId,
        caseId: trustCaseId ? Number(trustCaseId) : null,
        txType: trustTxType,
        amount: Number(trustAmount || 0),
        description: trustDesc.trim() || 'حركة مالية على حساب الأمانة',
        referenceNo: trustRef.trim() || `TR-${Date.now().toString().slice(-5)}`,
        txDate: trustDate,
      });
      setTrustDesc('');
      setTrustRef('');
      setBanner('تم تسجيل الحركة المالية وتحديث رصيد الأمانة بنجاح.');
    } finally {
      setSavingTrust(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="billing-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1E47] dark:text-white">
            الأتعاب والفوترة الإلكترونية (ZATCA) والأمانات
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            إصدار فواتير ضريبية برمز QR، تتبع ساعات العمل القابلة للفوترة، وإدارة حسابات الأمانات والعهد.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="أقسام الفوترة والمالية"
          className="inline-flex flex-wrap rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 shadow-xs shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'invoices'}
            onClick={() => setSubTab('invoices')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              subTab === 'invoices'
                ? 'bg-[#1D5CE5] text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" aria-hidden="true" />
            <span>الفواتير الضريبية ZATCA</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'time'}
            onClick={() => setSubTab('time')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              subTab === 'time'
                ? 'bg-[#1D5CE5] text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" aria-hidden="true" />
            <span>ساعات العمل ({timeEntries.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'trust'}
            onClick={() => setSubTab('trust')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              subTab === 'trust'
                ? 'bg-[#1D5CE5] text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Landmark className="w-4 h-4" aria-hidden="true" />
            <span>الأمانات والعهد ({trustTransactions.length})</span>
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

      {/* SUB-TAB 1: ZATCA Invoices */}
      {subTab === 'invoices' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">إجمالي الفواتير شاملة الضريبة</p>
              <p className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
                {financialTotals.billed.toLocaleString('en-US')} ر.س
              </p>
            </div>
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">إجمالي ضريبة القيمة المضافة</p>
              <p className="font-mono-num text-2xl font-bold text-[#1D5CE5] dark:text-blue-400 mt-1.5">
                {financialTotals.vatTotal.toLocaleString('en-US')} ر.س
              </p>
            </div>
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">إجمالي المحصل</p>
              <p className="font-mono-num text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1.5">
                {financialTotals.paid.toLocaleString('en-US')} ر.س
              </p>
            </div>
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">الرصيد المستحق</p>
              <p className="font-mono-num text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1.5">
                {financialTotals.due.toLocaleString('en-US')} ر.س
              </p>
            </div>
          </div>

          {canEdit && (
            <div className="flex justify-end no-print">
              <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-[#1D5CE5] to-[#1545B5] text-white hover:from-[#1A52CE] hover:to-[#123B9E] shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>{showForm ? 'إلغاء' : 'إصدار فاتورة ضريبية ZATCA'}</span>
              </button>
            </div>
          )}

          {showForm && canEdit && (
            <form
              onSubmit={handleSubmitInvoice}
              className="no-print p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <h2 className="font-display text-base font-bold">
                إصدار فاتورة ضريبية / إشعار دائن أو مدين (متوافقة مع ZATCA)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="inv-type" className="block text-xs font-medium mb-1">
                    نوع المستند الضريبي *
                  </label>
                  <select
                    id="inv-type"
                    value={invoiceType}
                    onChange={(e) => setInvoiceType(e.target.value as InvoiceType)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="tax_invoice">فاتورة ضريبية</option>
                    <option value="credit_note">إشعار دائن (خصم / استرجاع)</option>
                    <option value="debit_note">إشعار مدين (رسوم إضافية)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="inv-case" className="block text-xs font-medium mb-1">
                    القضية المرتبطة *
                  </label>
                  <select
                    id="inv-case"
                    value={caseId || cases[0]?.id || ''}
                    onChange={(e) => setCaseId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    {cases.length === 0 && <option value="">افتح قضية أولاً</option>}
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.caseCode} — {clientMap.get(c.clientId)?.name || ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="inv-due" className="block text-xs font-medium mb-1">
                    تاريخ الاستحقاق
                  </label>
                  <input
                    id="inv-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-4">
                  <label htmlFor="inv-desc" className="block text-xs font-medium mb-1">
                    البيان / وصف الأتعاب *
                  </label>
                  <input
                    id="inv-desc"
                    type="text"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="مثال: أتعاب المرحلة الابتدائية وتقديم المرافعة"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label htmlFor="inv-fee" className="block text-xs font-medium mb-1">
                    مبلغ الأتعاب (قبل الضريبة)
                  </label>
                  <input
                    id="inv-fee"
                    type="number"
                    min={0}
                    value={feeAmount}
                    onChange={(e) => setFeeAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
                  />
                </div>

                <div>
                  <label htmlFor="inv-exp" className="block text-xs font-medium mb-1">
                    المصروفات القضائية
                  </label>
                  <input
                    id="inv-exp"
                    type="number"
                    min={0}
                    value={expensesAmount}
                    onChange={(e) => setExpensesAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
                  />
                </div>

                <div>
                  <label htmlFor="inv-vat-rate" className="block text-xs font-medium mb-1">
                    نسبة الضريبة (%)
                  </label>
                  <input
                    id="inv-vat-rate"
                    type="number"
                    min={0}
                    max={100}
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
                  />
                </div>

                <div>
                  <label htmlFor="inv-paid" className="block text-xs font-medium mb-1">
                    الدفعة المقدمة (المدفوع)
                  </label>
                  <input
                    id="inv-paid"
                    type="number"
                    min={0}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 flex flex-wrap items-center justify-between gap-4 text-xs">
                <span>
                  المجموع قبل الضريبة:{' '}
                  <strong className="font-mono-num">{previewTotals.subtotal.toLocaleString('en-US')}</strong> ر.س
                </span>
                <span>
                  الضريبة ({vatRate}%):{' '}
                  <strong className="font-mono-num">{previewTotals.vatAmount.toLocaleString('en-US')}</strong> ر.س
                </span>
                <span className="text-sm font-bold text-[#0B1E47] dark:text-amber-400">
                  الإجمالي شامل الضريبة:{' '}
                  <span className="font-mono-num">{previewTotals.totalWithVat.toLocaleString('en-US')}</span> ر.س
                </span>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={saving || cases.length === 0}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#1D5CE5] text-white hover:bg-[#1545B5] cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'جاري الإصدار...' : 'إصدار الفاتورة وتوليد QR'}
                </button>
              </div>
            </form>
          )}

          {/* Invoices Table */}
          <section className="no-print rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">رقم الفاتورة</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">العميل / القضية</th>
                    <th className="px-4 py-3 font-semibold">البيان والنوع</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">الضريبة</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">الإجمالي النهائي</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">المدفوع</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">الحالة</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {invoices.map((inv) => {
                    const vat = Number(inv.vatAmount || 0);
                    const totalWithVat = inv.feeAmount + inv.expensesAmount + vat;
                    const client = clientMap.get(inv.clientId);
                    const c = caseMap.get(inv.caseId);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-mono-num text-xs font-bold whitespace-nowrap">
                          {inv.invoiceNumber}
                          <div className="text-[11px] font-normal text-slate-500">{inv.issuedDate}</div>
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {client?.name || '—'}
                          </div>
                          <div className="font-mono-num text-[11px] text-slate-500">{c?.caseCode || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300 max-w-[230px]">
                          <div className="font-medium">{inv.description}</div>
                          <div className="text-[11px] text-[#1D5CE5] dark:text-amber-400">
                            {INVOICE_TYPE_LABELS[inv.invoiceType || 'tax_invoice']}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono-num text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {vat.toLocaleString('en-US')}
                        </td>
                        <td className="px-4 py-3 font-mono-num text-xs font-bold whitespace-nowrap">
                          {totalWithVat.toLocaleString('en-US')}
                        </td>
                        <td className="px-4 py-3 font-mono-num text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          {inv.paidAmount.toLocaleString('en-US')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <InvoiceStatusTag status={inv.status} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {canEdit && inv.status !== 'paid' && (
                              <button
                                type="button"
                                onClick={() => onRecordPayment(inv.id, totalWithVat)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                              >
                                <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>سداد</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setPreviewQrInvoice(inv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-blue-200 dark:border-blue-900 text-[#1D5CE5] dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                            >
                              <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>QR</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPrintingInvoice(inv);
                                window.setTimeout(() => window.print(), 180);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>طباعة</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                        لا توجد فواتير صادرة بعد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* SUB-TAB 2: Time Tracking */}
      {subTab === 'time' && (
        <div className="space-y-5 no-print">
          <div className="p-5 rounded-2xl bg-gradient-to-l from-[#0B1E47] to-[#1D5CE5] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <p className="text-xs text-blue-100">ساعات العمل غير المفوترة القابلة للتحصيل</p>
              <p className="font-display text-2xl font-bold mt-1">
                <span className="font-mono-num">{unbilledHoursTotal}</span> ساعة ·{' '}
                <span className="font-mono-num">{unbilledAmountTotal.toLocaleString('en-US')}</span> ر.س
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                disabled={unbilledEntries.length === 0}
                onClick={handleConvertHoursToInvoice}
                className="px-4 py-2.5 text-xs font-bold rounded-xl bg-white text-[#0B1E47] hover:bg-blue-50 disabled:opacity-50 cursor-pointer shrink-0"
              >
                تحويل الساعات غير المفوترة إلى فاتورة ضريبية
              </button>
            )}
          </div>

          {canEdit && (
            <form
              onSubmit={handleAddTimeSubmit}
              className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white">
                تسجيل ساعات عمل استشارية / مرافعة
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="lg:col-span-2">
                  <label htmlFor="time-case" className="block text-xs font-medium mb-1">
                    القضية *
                  </label>
                  <select
                    id="time-case"
                    value={timeCaseId || cases[0]?.id || ''}
                    onChange={(e) => setTimeCaseId(Number(e.target.value))}
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
                  <label htmlFor="time-hours" className="block text-xs font-medium mb-1">
                    عدد الساعات *
                  </label>
                  <input
                    id="time-hours"
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={timeHours}
                    onChange={(e) => setTimeHours(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
                  />
                </div>

                <div>
                  <label htmlFor="time-rate" className="block text-xs font-medium mb-1">
                    سعر الساعة (ر.س) *
                  </label>
                  <input
                    id="time-rate"
                    type="number"
                    min={0}
                    required
                    value={timeRate}
                    onChange={(e) => setTimeRate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
                  />
                </div>

                <div>
                  <label htmlFor="time-date" className="block text-xs font-medium mb-1">
                    التاريخ
                  </label>
                  <input
                    id="time-date"
                    type="date"
                    value={timeDate}
                    onChange={(e) => setTimeDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-2">
                  <label htmlFor="time-lawyer" className="block text-xs font-medium mb-1">
                    المحامي المنفذ
                  </label>
                  <input
                    id="time-lawyer"
                    type="text"
                    value={timeLawyer}
                    onChange={(e) => setTimeLawyer(e.target.value)}
                    placeholder="اتركه فارغاً لاستخدام محامي القضية"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <label htmlFor="time-desc" className="block text-xs font-medium mb-1">
                    بيان العمل القانوني *
                  </label>
                  <input
                    id="time-desc"
                    type="text"
                    required
                    value={timeDesc}
                    onChange={(e) => setTimeDesc(e.target.value)}
                    placeholder="مثال: دراسة الأسانيد وإعداد مذكرة الرد الأولى"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingTime || cases.length === 0}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#1D5CE5] text-white hover:bg-[#1545B5] cursor-pointer disabled:opacity-50"
                >
                  {savingTime ? 'جاري التسجيل...' : 'تسجيل الساعات'}
                </button>
              </div>
            </form>
          )}

          <section className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">التاريخ</th>
                    <th className="px-4 py-3 font-semibold">القضية</th>
                    <th className="px-4 py-3 font-semibold">المحامي</th>
                    <th className="px-4 py-3 font-semibold">البيان</th>
                    <th className="px-4 py-3 font-semibold">الساعات × السعر</th>
                    <th className="px-4 py-3 font-semibold">الحالة</th>
                    <th className="px-4 py-3 font-semibold">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {timeEntries.map((entry) => {
                    const c = caseMap.get(entry.caseId);
                    return (
                      <tr key={entry.id}>
                        <td className="px-4 py-3 font-mono-num">{entry.entryDate}</td>
                        <td className="px-4 py-3 font-mono-num font-bold">
                          {c?.caseCode || `#${entry.caseId}`}
                        </td>
                        <td className="px-4 py-3">{entry.lawyerName}</td>
                        <td className="px-4 py-3">{entry.description}</td>
                        <td className="px-4 py-3 font-mono-num font-bold">
                          {entry.hours} × {entry.hourlyRate} ={' '}
                          {(entry.hours * entry.hourlyRate).toLocaleString('en-US')} ر.س
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[11px] font-bold ${
                              entry.invoiced ? 'text-emerald-600' : 'text-amber-600'
                            }`}
                          >
                            {entry.invoiced ? 'تمت الفوترة' : 'بانتظار الفوترة'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {canEdit && !entry.invoiced && (
                            <button
                              type="button"
                              onClick={() => onDeleteTimeEntry(entry.id)}
                              aria-label={`حذف سجل ساعات ${entry.description}`}
                              className="p-1.5 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {timeEntries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                        لا توجد ساعات عمل مسجلة بعد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* SUB-TAB 3: Client Trust / Retainer Accounting */}
      {subTab === 'trust' && (
        <div className="space-y-5 no-print">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">إجمالي الإيداعات بالأمانات</p>
              <p className="font-mono-num text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                {trustSummary.totalDeposits.toLocaleString('en-US')} ر.س
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">المسحوبات / المصروفات</p>
              <p className="font-mono-num text-xl font-bold text-amber-700 dark:text-amber-400 mt-1">
                {trustSummary.totalDeductions.toLocaleString('en-US')} ر.س
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">المبالغ المستردة للعملاء</p>
              <p className="font-mono-num text-xl font-bold text-slate-700 dark:text-slate-300 mt-1">
                {trustSummary.totalRefunds.toLocaleString('en-US')} ر.س
              </p>
            </div>
            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
              <p className="text-xs font-bold text-[#0B1E47] dark:text-blue-200">
                الرصيد المتاح في حساب الأمانات
              </p>
              <p
                data-testid="trust-balance-value"
                className="font-mono-num text-2xl font-extrabold text-[#1D5CE5] dark:text-amber-400 mt-1"
              >
                {trustSummary.balance.toLocaleString('en-US')} ر.س
              </p>
            </div>
          </div>

          {canEdit && (
            <form
              onSubmit={handleAddTrustSubmit}
              className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white">
                تسجيل حركة على حساب الأمانة والعهدة
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="trust-client" className="block text-xs font-medium mb-1">
                    العميل *
                  </label>
                  <select
                    id="trust-client"
                    value={trustClientId || clients[0]?.id || ''}
                    onChange={(e) => setTrustClientId(Number(e.target.value))}
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
                  <label htmlFor="trust-type" className="block text-xs font-medium mb-1">
                    نوع الحركة *
                  </label>
                  <select
                    id="trust-type"
                    value={trustTxType}
                    onChange={(e) =>
                      setTrustTxType(e.target.value as 'deposit' | 'deduction' | 'refund')
                    }
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="deposit">إيداع أمانة / عهدة</option>
                    <option value="deduction">سحب مصروفات / سداد أتعاب</option>
                    <option value="refund">استرداد للعميل</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="trust-amount" className="block text-xs font-medium mb-1">
                    المبلغ (ر.س) *
                  </label>
                  <input
                    id="trust-amount"
                    type="number"
                    min={1}
                    required
                    value={trustAmount}
                    onChange={(e) => setTrustAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
                  />
                </div>

                <div>
                  <label htmlFor="trust-date" className="block text-xs font-medium mb-1">
                    تاريخ الحركة
                  </label>
                  <input
                    id="trust-date"
                    type="date"
                    value={trustDate}
                    onChange={(e) => setTrustDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
                  />
                </div>

                <div>
                  <label htmlFor="trust-case" className="block text-xs font-medium mb-1">
                    القضية (اختياري)
                  </label>
                  <select
                    id="trust-case"
                    value={trustCaseId}
                    onChange={(e) => setTrustCaseId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="">رصيد عام للعميل</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.caseCode}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="trust-ref" className="block text-xs font-medium mb-1">
                    رقم المرجع / السند
                  </label>
                  <input
                    id="trust-ref"
                    type="text"
                    value={trustRef}
                    onChange={(e) => setTrustRef(e.target.value)}
                    placeholder="مثال: REC-2026-01"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono-num"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="trust-desc" className="block text-xs font-medium mb-1">
                    البيان *
                  </label>
                  <input
                    id="trust-desc"
                    type="text"
                    required
                    value={trustDesc}
                    onChange={(e) => setTrustDesc(e.target.value)}
                    placeholder="مثال: دفعة عهدة مصروفات خبرة ورسوم"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingTrust || clients.length === 0}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#1D5CE5] text-white hover:bg-[#1545B5] cursor-pointer disabled:opacity-50"
                >
                  {savingTrust ? 'جاري التسجيل...' : 'حفظ الحركة المالية'}
                </button>
              </div>
            </form>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0B1E47] dark:text-white">
              سجل حركات الأمانات
            </h3>
            <select
              value={trustFilterClient}
              onChange={(e) => setTrustFilterClient(e.target.value)}
              aria-label="تصفية حركات الأمانات حسب العميل"
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <option value="all">كل العملاء</option>
              {clients.map((cl) => (
                <option key={cl.id} value={String(cl.id)}>
                  {cl.name}
                </option>
              ))}
            </select>
          </div>

          <section className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">التاريخ والمرجع</th>
                    <th className="px-4 py-3 font-semibold">العميل</th>
                    <th className="px-4 py-3 font-semibold">النوع</th>
                    <th className="px-4 py-3 font-semibold">البيان</th>
                    <th className="px-4 py-3 font-semibold">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleTrustTx.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-3 font-mono-num">
                        <div>{tx.txDate}</div>
                        <div className="text-[11px] text-slate-400">{tx.referenceNo}</div>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {clientMap.get(tx.clientId)?.name || '—'}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        <span
                          className={
                            tx.txType === 'deposit'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : tx.txType === 'deduction'
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-rose-700 dark:text-rose-400'
                          }
                        >
                          {tx.txType === 'deposit'
                            ? 'إيداع'
                            : tx.txType === 'deduction'
                              ? 'سحب / مصروف'
                              : 'استرداد'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{tx.description}</td>
                      <td className="px-4 py-3 font-mono-num font-bold">
                        {tx.amount.toLocaleString('en-US')} ر.س
                      </td>
                    </tr>
                  ))}
                  {visibleTrustTx.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                        لا توجد حركات مسجلة في حساب الأمانات.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ZATCA QR Preview Modal */}
      {previewQrInvoice && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 no-print"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-5 space-y-4 text-center">
            <div className="flex items-center justify-between">
              <h3 id="qr-modal-title" className="font-display text-base font-bold">
                رمز الفاتورة الإلكترونية (ZATCA)
              </h3>
              <button
                type="button"
                onClick={() => setPreviewQrInvoice(null)}
                aria-label="إغلاق رمز QR"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt={`رمز ZATCA QR للفاتورة ${previewQrInvoice.invoiceNumber}`}
                className="w-44 h-44 mx-auto rounded-xl border border-slate-200 bg-white p-2"
              />
            )}

            <div className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
              <p className="font-mono-num font-bold text-sm text-[#0B1E47] dark:text-white">
                {previewQrInvoice.invoiceNumber}
              </p>
              <p>الرقم الضريبي: {settings.vatNumber || '300000000000003'}</p>
              <p className="font-mono-num">
                الضريبة ({previewQrInvoice.vatRate ?? 15}%):{' '}
                {Number(previewQrInvoice.vatAmount || 0).toLocaleString('en-US')} ر.س
              </p>
              <p className="font-mono-num font-bold">
                الإجمالي شامل الضريبة:{' '}
                {(
                  previewQrInvoice.feeAmount +
                  previewQrInvoice.expensesAmount +
                  Number(previewQrInvoice.vatAmount || 0)
                ).toLocaleString('en-US')}{' '}
                ر.س
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Printable ZATCA Invoice Letterhead */}
      {printingInvoice && (
        <div className="hidden print-only p-8 bg-white text-slate-900 border border-slate-300">
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-6">
            <div>
              <h2 className="font-display text-xl font-bold">{settings.officeName}</h2>
              <p className="text-xs text-slate-600">{settings.officeAddress}</p>
              <p className="text-xs text-slate-600 font-mono-num">
                الرقم الضريبي: {settings.vatNumber || '300000000000003'}
              </p>
            </div>
            <div className="text-left">
              <p className="font-bold text-lg">
                {INVOICE_TYPE_LABELS[printingInvoice.invoiceType || 'tax_invoice']}
              </p>
              <p className="font-mono-num text-sm">{printingInvoice.invoiceNumber}</p>
              <p className="font-mono-num text-xs">تاريخ الإصدار: {printingInvoice.issuedDate}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="space-y-1 text-sm">
              <p>
                <strong>المكرم / </strong>
                {clientMap.get(printingInvoice.clientId)?.name}
              </p>
              <p>
                <strong>القضية: </strong>
                {caseMap.get(printingInvoice.caseId)?.caseCode} —{' '}
                {caseMap.get(printingInvoice.caseId)?.subject}
              </p>
            </div>
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="ZATCA QR"
                className="w-28 h-28 border border-slate-300 p-1"
              />
            )}
          </div>
          <table className="w-full border border-slate-300 text-sm mb-6">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-2 border border-slate-300 text-right">البيان</th>
                <th className="p-2 border border-slate-300 text-right">الأتعاب والمصروفات</th>
                <th className="p-2 border border-slate-300 text-right">الضريبة ({printingInvoice.vatRate ?? 15}%)</th>
                <th className="p-2 border border-slate-300 text-right">الإجمالي</th>
                <th className="p-2 border border-slate-300 text-right">المدفوع</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border border-slate-300">{printingInvoice.description}</td>
                <td className="p-2 border border-slate-300 font-mono-num">
                  {(printingInvoice.feeAmount + printingInvoice.expensesAmount).toLocaleString('en-US')}
                </td>
                <td className="p-2 border border-slate-300 font-mono-num">
                  {Number(printingInvoice.vatAmount || 0).toLocaleString('en-US')}
                </td>
                <td className="p-2 border border-slate-300 font-mono-num font-bold">
                  {(
                    printingInvoice.feeAmount +
                    printingInvoice.expensesAmount +
                    Number(printingInvoice.vatAmount || 0)
                  ).toLocaleString('en-US')}
                </td>
                <td className="p-2 border border-slate-300 font-mono-num">
                  {printingInvoice.paidAmount.toLocaleString('en-US')}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="pt-6 border-t border-slate-300 text-xs text-slate-600 flex justify-between">
            <span>{settings.officeName}</span>
            <span>إعداد / النقيب امين عبدالرحيم</span>
          </div>
        </div>
      )}
    </div>
  );
}
