import type {
  CaseStatus,
  Client,
  Invoice,
  InvoiceType,
  LegalCase,
  Procedure,
  TeamPermissions,
  TrustTransaction,
  UserRole,
} from '../types/legal.ts';

export type HearingUrgency = 'overdue' | 'urgent' | 'upcoming' | 'later';

export interface UpcomingHearing {
  caseId: number;
  caseCode: string;
  officialNumber: string;
  subject: string;
  clientId: number;
  clientName: string;
  lawyerName: string;
  courtName: string;
  hearingDate: string;
  daysUntil: number;
  urgency: HearingUrgency;
  sourceLabel: string;
}

export interface DashboardStats {
  totalClients: number;
  activeClients: number;
  totalCases: number;
  activeCases: number;
  closedCases: number;
  suspendedCases: number;
  upcomingHearingsCount: number;
  urgentHearingsCount: number;
}

export interface ClientFinancialSummary {
  clientId: number;
  totalFees: number;
  totalExpenses: number;
  totalVat: number;
  totalBilled: number;
  totalPaid: number;
  balanceDue: number;
  invoiceCount: number;
  caseCount: number;
}

export interface AutomatedReminderCandidate {
  caseId: number;
  caseCode: string;
  subject: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  lawyerName: string;
  hearingDate: string;
  tier: '72h' | '24h' | 'today';
  tierLabel: string;
  message: string;
}

export type StatutoryDeadlineType =
  | 'appeal_30'
  | 'expedited_10'
  | 'admin_60'
  | 'cassation_30'
  | 'review_petition_30';

export interface StatutoryDeadlineResult {
  deadlineType: StatutoryDeadlineType;
  deadlineLabel: string;
  statutoryDays: number;
  judgmentDate: string;
  rawDueDate: string;
  adjustedDueDate: string;
  shiftedDays: number;
  shiftReason: string;
}

export interface TrustBalanceSummary {
  totalDeposits: number;
  totalDeductions: number;
  totalRefunds: number;
  balance: number;
}

export const DEFAULT_ROLE_PERMISSIONS: Record<
  'admin' | 'lawyer' | 'secretary' | 'accountant',
  TeamPermissions
> = {
  admin: {
    canViewCases: true,
    canEditCases: true,
    canDeleteRecords: true,
    canManageBilling: true,
    canManageSettings: true,
    canViewAudit: true,
  },
  lawyer: {
    canViewCases: true,
    canEditCases: true,
    canDeleteRecords: false,
    canManageBilling: false,
    canManageSettings: false,
    canViewAudit: false,
  },
  secretary: {
    canViewCases: true,
    canEditCases: true,
    canDeleteRecords: false,
    canManageBilling: true,
    canManageSettings: false,
    canViewAudit: false,
  },
  accountant: {
    canViewCases: true,
    canEditCases: false,
    canDeleteRecords: false,
    canManageBilling: true,
    canManageSettings: false,
    canViewAudit: true,
  },
};

export const STATUTORY_DEADLINE_PRESETS: Record<
  StatutoryDeadlineType,
  { label: string; days: number }
> = {
  appeal_30: { label: 'اعتراض / استئناف حكم ابتدائي (30 يوماً)', days: 30 },
  expedited_10: { label: 'استئناف دعوى مستعجلة / أمر أداء (10 أيام)', days: 10 },
  admin_60: { label: 'تظلم / دعوى إدارية - ديوان المظالم (60 يوماً)', days: 60 },
  cassation_30: { label: 'الطعن بالنقض أمام المحكمة العليا (30 يوماً)', days: 30 },
  review_petition_30: { label: 'التماس إعادة النظر (30 يوماً)', days: 30 },
};

export function generateNextCaseCode(
  prefix: string,
  year: number,
  sequenceNumber: number,
): string {
  const cleanPrefix = (prefix || 'CASE').trim().toUpperCase();
  const padded = String(Math.max(1, sequenceNumber)).padStart(3, '0');
  return `${cleanPrefix}-${year}-${padded}`;
}

export function generateNextClientCode(
  existingCount: number,
  prefix = 'CL',
): string {
  const cleanPrefix = (prefix || 'CL').trim().toUpperCase();
  const next = Math.max(1, existingCount + 1);
  return `${cleanPrefix}-${String(next).padStart(4, '0')}`;
}

export function resolveTenantKey(uid: string, email?: string | null): string {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (normalizedEmail) {
    return `email:${normalizedEmail}`;
  }
  return `uid:${uid}`;
}

export function buildLocalTenantStorageKey(email: string): string {
  const normalized = (email || '').trim().toLowerCase() || 'guest@local.mizan';
  return `mizan_workspace_v2::${normalized}`;
}

export function generateNextInvoiceNumber(
  year: number,
  existingCount: number,
): string {
  const next = Math.max(1, existingCount + 1);
  return `INV-${year}-${String(next).padStart(4, '0')}`;
}

export function computeDaysBetween(fromIsoDate: string, toIsoDate: string): number {
  if (!fromIsoDate || !toIsoDate) return 9999;
  const from = new Date(`${fromIsoDate.slice(0, 10)}T00:00:00Z`).getTime();
  const to = new Date(`${toIsoDate.slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 9999;
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

export function classifyHearingUrgency(
  daysUntil: number,
  reminderDaysBefore: number,
): HearingUrgency {
  if (daysUntil < 0) return 'overdue';
  if (daysUntil <= 2) return 'urgent';
  if (daysUntil <= reminderDaysBefore) return 'upcoming';
  return 'later';
}

export function getAccessibleCasesForRole(
  cases: LegalCase[],
  role: UserRole,
  options?: { lawyerName?: string; clientId?: number },
): LegalCase[] {
  if (role === 'lawyer' && options?.lawyerName) {
    return cases.filter((c) => c.lawyerName === options.lawyerName);
  }
  if (role === 'client' && options?.clientId) {
    return cases.filter((c) => c.clientId === options.clientId);
  }
  return cases;
}

export function filterCases(
  cases: LegalCase[],
  clients: Client[],
  procedures: Procedure[],
  params: {
    query?: string;
    caseType?: string;
    status?: CaseStatus | 'all';
    lawyerName?: string;
  },
): LegalCase[] {
  const q = (params.query || '').trim().toLowerCase();
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  return cases.filter((item) => {
    if (params.caseType && params.caseType !== 'all' && item.caseType !== params.caseType) {
      return false;
    }
    if (params.status && params.status !== 'all' && item.status !== params.status) {
      return false;
    }
    if (params.lawyerName && params.lawyerName !== 'all' && item.lawyerName !== params.lawyerName) {
      return false;
    }
    if (!q) return true;

    const client = clientMap.get(item.clientId);
    const matchesCaseFields =
      item.caseCode.toLowerCase().includes(q) ||
      item.officialNumber.toLowerCase().includes(q) ||
      item.subject.toLowerCase().includes(q) ||
      item.opponentName.toLowerCase().includes(q) ||
      item.lawyerName.toLowerCase().includes(q) ||
      item.courtName.toLowerCase().includes(q);

    const matchesClient =
      Boolean(client) &&
      (client!.name.toLowerCase().includes(q) ||
        client!.phone.toLowerCase().includes(q) ||
        client!.clientCode.toLowerCase().includes(q));

    const matchesDocumentOcr = procedures.some(
      (p) =>
        p.caseId === item.id &&
        (p.description.toLowerCase().includes(q) ||
          p.attachmentName.toLowerCase().includes(q) ||
          p.attachmentText.toLowerCase().includes(q)),
    );

    return matchesCaseFields || matchesClient || matchesDocumentOcr;
  });
}

export function getUpcomingHearings(
  cases: LegalCase[],
  clients: Client[],
  procedures: Procedure[],
  referenceIsoDate: string,
  reminderDaysBefore: number,
): UpcomingHearing[] {
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const items: UpcomingHearing[] = [];

  for (const c of cases) {
    if (c.status === 'closed') continue;

    let targetDate = c.nextHearingDate;
    let sourceLabel = 'موعد الجلسة القادمة';

    if (!targetDate) {
      const procWithDate = procedures
        .filter((p) => p.caseId === c.id && p.nextActionDate)
        .sort((a, b) => b.procedureDate.localeCompare(a.procedureDate))[0];
      if (procWithDate) {
        targetDate = procWithDate.nextActionDate;
        sourceLabel = 'إجراء مجدول';
      }
    }

    if (!targetDate) continue;

    const daysUntil = computeDaysBetween(referenceIsoDate, targetDate);
    if (daysUntil > 60 && daysUntil !== 9999) continue;

    const urgency = classifyHearingUrgency(daysUntil, reminderDaysBefore);
    items.push({
      caseId: c.id,
      caseCode: c.caseCode,
      officialNumber: c.officialNumber,
      subject: c.subject,
      clientId: c.clientId,
      clientName: clientMap.get(c.clientId)?.name || 'عميل غير محدد',
      lawyerName: c.lawyerName,
      courtName: c.courtName,
      hearingDate: targetDate,
      daysUntil,
      urgency,
      sourceLabel,
    });
  }

  return items.sort((a, b) => a.daysUntil - b.daysUntil);
}

export function computeAutomatedReminderPlan(
  cases: LegalCase[],
  clients: Client[],
  referenceIsoDate: string,
): AutomatedReminderCandidate[] {
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const plan: AutomatedReminderCandidate[] = [];

  for (const c of cases) {
    if (c.status !== 'active' || !c.nextHearingDate) continue;
    const days = computeDaysBetween(referenceIsoDate, c.nextHearingDate);
    if (days !== 3 && days !== 1 && days !== 0) continue;

    const client = clientMap.get(c.clientId);
    const tier: AutomatedReminderCandidate['tier'] =
      days === 3 ? '72h' : days === 1 ? '24h' : 'today';
    const tierLabel =
      tier === '72h'
        ? 'تنبيه استباقي (قبل 72 ساعة)'
        : tier === '24h'
          ? 'تنبيه عاجل (قبل 24 ساعة)'
          : 'جلسة اليوم';

    plan.push({
      caseId: c.id,
      caseCode: c.caseCode,
      subject: c.subject,
      clientName: client?.name || 'العميل',
      clientPhone: client?.phone || '',
      clientEmail: client?.email || '',
      lawyerName: c.lawyerName,
      hearingDate: c.nextHearingDate,
      tier,
      tierLabel,
      message: `${tierLabel}: تذكير بموعد جلسة القضية ${c.caseCode} (${c.subject}) بتاريخ ${c.nextHearingDate} في ${c.courtName} — المحامي: ${c.lawyerName}`,
    });
  }

  return plan.sort((a, b) => a.hearingDate.localeCompare(b.hearingDate));
}

export function calculateDashboardStats(
  clients: Client[],
  cases: LegalCase[],
  procedures: Procedure[],
  referenceIsoDate: string,
  reminderDaysBefore: number,
): DashboardStats {
  const activeCases = cases.filter((c) => c.status === 'active').length;
  const closedCases = cases.filter((c) => c.status === 'closed').length;
  const suspendedCases = cases.filter((c) => c.status === 'suspended').length;
  const hearings = getUpcomingHearings(
    cases,
    clients,
    procedures,
    referenceIsoDate,
    reminderDaysBefore,
  );
  const upcomingHearingsCount = hearings.filter(
    (h) => h.daysUntil >= 0 && h.daysUntil <= reminderDaysBefore,
  ).length;
  const urgentHearingsCount = hearings.filter(
    (h) => h.urgency === 'urgent' || h.urgency === 'overdue',
  ).length;

  return {
    totalClients: clients.length,
    activeClients: clients.filter((c) => c.accountStatus === 'active').length,
    totalCases: cases.length,
    activeCases,
    closedCases,
    suspendedCases,
    upcomingHearingsCount,
    urgentHearingsCount,
  };
}

export function computeInvoiceTotals(
  feeAmount: number,
  expensesAmount: number,
  vatRate = 15,
  invoiceType: InvoiceType = 'tax_invoice',
): {
  subtotal: number;
  vatAmount: number;
  totalWithVat: number;
  sign: number;
} {
  const sign = invoiceType === 'credit_note' ? -1 : 1;
  const subtotal = Math.round((Number(feeAmount || 0) + Number(expensesAmount || 0)) * 100) / 100;
  const vatAmount = Math.round(subtotal * (Math.max(0, Number(vatRate || 0)) / 100) * 100) / 100;
  const totalWithVat = Math.round((subtotal + vatAmount) * 100) / 100;
  return { subtotal, vatAmount, totalWithVat, sign };
}

export function generateZatcaQrPayload(params: {
  sellerName: string;
  vatNumber: string;
  timestampIso: string;
  totalWithVat: number;
  vatAmount: number;
}): string {
  const encoder = new TextEncoder();
  const fields: [number, string][] = [
    [1, params.sellerName || 'مكتب المحاماة'],
    [2, params.vatNumber || '300000000000003'],
    [3, params.timestampIso || new Date().toISOString()],
    [4, Number(params.totalWithVat || 0).toFixed(2)],
    [5, Number(params.vatAmount || 0).toFixed(2)],
  ];

  const chunks: Uint8Array[] = [];
  let totalLen = 0;
  for (const [tag, value] of fields) {
    const valBytes = encoder.encode(value);
    const len = Math.min(255, valBytes.length);
    const chunk = new Uint8Array(2 + len);
    chunk[0] = tag;
    chunk[1] = len;
    chunk.set(valBytes.subarray(0, len), 2);
    chunks.push(chunk);
    totalLen += chunk.length;
  }

  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(combined).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < combined.length; i += 1) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

export function calculateClientFinancialSummary(
  clientId: number,
  cases: LegalCase[],
  invoices: Invoice[],
): ClientFinancialSummary {
  const clientInvoices = invoices.filter((inv) => inv.clientId === clientId);
  const clientCases = cases.filter((c) => c.clientId === clientId);

  let totalFees = 0;
  let totalExpenses = 0;
  let totalVat = 0;
  let totalPaid = 0;

  for (const inv of clientInvoices) {
    const sign = inv.invoiceType === 'credit_note' ? -1 : 1;
    totalFees += sign * Number(inv.feeAmount || 0);
    totalExpenses += sign * Number(inv.expensesAmount || 0);
    totalVat += sign * Number(inv.vatAmount || 0);
    totalPaid += sign * Number(inv.paidAmount || 0);
  }

  const totalBilled = Math.max(0, totalFees + totalExpenses + totalVat);
  const balanceDue = Math.max(0, totalBilled - totalPaid);

  return {
    clientId,
    totalFees: Math.max(0, totalFees),
    totalExpenses: Math.max(0, totalExpenses),
    totalVat: Math.max(0, totalVat),
    totalBilled,
    totalPaid: Math.max(0, totalPaid),
    balanceDue,
    invoiceCount: clientInvoices.length,
    caseCount: clientCases.length,
  };
}

export function computeInvoiceStatus(
  feeAmount: number,
  expensesAmount: number,
  paidAmount: number,
  vatAmount = 0,
): 'paid' | 'partial' | 'unpaid' {
  const total = feeAmount + expensesAmount + vatAmount;
  if (total <= 0 || paidAmount >= total) return 'paid';
  if (paidAmount > 0) return 'partial';
  return 'unpaid';
}

export function calculateTrustBalance(
  transactions: TrustTransaction[],
  clientId?: number,
): TrustBalanceSummary {
  const scoped = clientId
    ? transactions.filter((t) => t.clientId === clientId)
    : transactions;
  let totalDeposits = 0;
  let totalDeductions = 0;
  let totalRefunds = 0;
  for (const tx of scoped) {
    const amt = Number(tx.amount || 0);
    if (tx.txType === 'deposit') totalDeposits += amt;
    else if (tx.txType === 'deduction') totalDeductions += amt;
    else if (tx.txType === 'refund') totalRefunds += amt;
  }
  return {
    totalDeposits,
    totalDeductions,
    totalRefunds,
    balance: Math.max(0, totalDeposits - totalDeductions - totalRefunds),
  };
}

export function calculateStatutoryDeadline(
  judgmentDateIso: string,
  deadlineType: StatutoryDeadlineType,
  officialHolidays: string[] = [],
): StatutoryDeadlineResult {
  const preset = STATUTORY_DEADLINE_PRESETS[deadlineType];
  const base = new Date(`${judgmentDateIso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(base.getTime())) {
    return {
      deadlineType,
      deadlineLabel: preset.label,
      statutoryDays: preset.days,
      judgmentDate: judgmentDateIso,
      rawDueDate: '',
      adjustedDueDate: '',
      shiftedDays: 0,
      shiftReason: '',
    };
  }

  const rawDate = new Date(base.getTime());
  rawDate.setUTCDate(rawDate.getUTCDate() + preset.days);
  const rawDueDate = rawDate.toISOString().slice(0, 10);

  const holidaySet = new Set([
    ...officialHolidays,
    `${rawDate.getUTCFullYear()}-02-22`,
    `${rawDate.getUTCFullYear()}-09-23`,
  ]);

  const adjusted = new Date(rawDate.getTime());
  let shiftedDays = 0;
  let hitWeekend = false;
  let hitHoliday = false;

  while (true) {
    const iso = adjusted.toISOString().slice(0, 10);
    const dayOfWeek = adjusted.getUTCDay(); // 5 = Friday, 6 = Saturday
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    const isHoliday = holidaySet.has(iso);
    if (!isWeekend && !isHoliday) break;
    if (isWeekend) hitWeekend = true;
    if (isHoliday) hitHoliday = true;
    adjusted.setUTCDate(adjusted.getUTCDate() + 1);
    shiftedDays += 1;
  }

  let shiftReason = 'يوافق يوم عمل رسمي دون تمديد.';
  if (shiftedDays > 0) {
    if (hitWeekend && hitHoliday) {
      shiftReason = `تم التمديد ${shiftedDays} يوم لتصادف الموعد مع عطلة أسبوعية وإجازة رسمية.`;
    } else if (hitHoliday) {
      shiftReason = `تم التمديد ${shiftedDays} يوم لتصادف الموعد مع إجازة رسمية.`;
    } else {
      shiftReason = `تم التمديد ${shiftedDays} يوم لتصادف الموعد مع عطلة نهاية الأسبوع (الجمعة/السبت).`;
    }
  }

  return {
    deadlineType,
    deadlineLabel: preset.label,
    statutoryDays: preset.days,
    judgmentDate: judgmentDateIso.slice(0, 10),
    rawDueDate,
    adjustedDueDate: adjusted.toISOString().slice(0, 10),
    shiftedDays,
    shiftReason,
  };
}

export function generateCsvContent(headers: string[], rows: (string | number)[][]): string {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];
  return '\uFEFF' + lines.join('\r\n');
}

export function generateHearingIcsEvent(hearing: UpcomingHearing, officeName: string): string {
  const dateCompact = hearing.hearingDate.replace(/-/g, '');
  const uid = `hearing-${hearing.caseId}-${dateCompact}@mizan-legal`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mizan Legal Practice//AR',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART;VALUE=DATE:${dateCompact}`,
    `SUMMARY:جلسة قضية ${hearing.caseCode} — ${hearing.subject}`,
    `DESCRIPTION:العميل: ${hearing.clientName} | المحامي: ${hearing.lawyerName} | المكتب: ${officeName}`,
    `LOCATION:${hearing.courtName}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
