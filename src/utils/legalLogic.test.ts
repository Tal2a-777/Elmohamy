import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLocalTenantStorageKey,
  calculateClientFinancialSummary,
  calculateDashboardStats,
  calculateStatutoryDeadline,
  calculateTrustBalance,
  classifyHearingUrgency,
  computeAutomatedReminderPlan,
  computeDaysBetween,
  computeInvoiceStatus,
  computeInvoiceTotals,
  filterCases,
  generateCsvContent,
  generateHearingIcsEvent,
  generateNextCaseCode,
  generateNextClientCode,
  generateZatcaQrPayload,
  getAccessibleCasesForRole,
  getUpcomingHearings,
  resolveTenantKey,
} from './legalLogic.ts';
import type { Client, Invoice, LegalCase, Procedure, TrustTransaction } from '../types/legal.ts';

const sampleClients: Client[] = [
  {
    id: 1,
    clientCode: 'CL-0001',
    name: 'شركة الأفق للتجارة',
    clientType: 'entity',
    nationalOrRegId: '1010456789',
    phone: '0501234567',
    email: 'legal@alofoq.sa',
    address: 'الرياض',
    accountStatus: 'active',
    notes: '',
    createdAt: '2026-01-01',
  },
  {
    id: 2,
    clientCode: 'CL-0002',
    name: 'سالم القحطاني',
    clientType: 'individual',
    nationalOrRegId: '1088776655',
    phone: '0559876543',
    email: 'salem@mail.sa',
    address: 'جدة',
    accountStatus: 'active',
    notes: '',
    createdAt: '2026-02-01',
  },
];

const sampleCases: LegalCase[] = [
  {
    id: 1,
    caseCode: 'LAW-2026-101',
    officialNumber: '45809123',
    caseYear: 2026,
    subject: 'مطالبة مالية تجارية',
    caseType: 'تجاري',
    clientId: 1,
    clientRole: 'plaintiff',
    opponentName: 'شركة البنيان',
    lawyerId: 1,
    lawyerName: 'أ. خالد المنصور',
    courtName: 'المحكمة التجارية',
    status: 'active',
    folderUrl: '',
    notes: '',
    nextHearingDate: '2026-11-16',
    createdAt: '2026-06-01',
  },
  {
    id: 2,
    caseCode: 'LAW-2026-102',
    officialNumber: '45811490',
    caseYear: 2026,
    subject: 'دعوى تعويض عمالية',
    caseType: 'عمالي',
    clientId: 2,
    clientRole: 'plaintiff',
    opponentName: 'شركة المدار',
    lawyerId: 2,
    lawyerName: 'أ. سارة العتيبي',
    courtName: 'المحكمة العمالية',
    status: 'closed',
    folderUrl: '',
    notes: '',
    nextHearingDate: '2026-11-15',
    createdAt: '2026-07-01',
  },
];

const sampleProcedures: Procedure[] = [
  {
    id: 1,
    caseId: 1,
    procedureDate: '2026-11-01',
    procedureType: 'hearing',
    description: 'جلسة تحضيرية',
    executorName: 'أ. خالد المنصور',
    outcome: 'تأجيل لتقديم مستندات',
    nextActionDate: '2026-11-16',
    attachmentName: 'مذكرة_101.pdf',
    attachmentMime: 'application/pdf',
    attachmentSize: 2048,
    attachmentText: 'عقد التوريد رقم 882 ومصرف الراجحي',
    attachmentData: '',
    visibleToClient: true,
  },
];

const sampleInvoices: Invoice[] = [
  {
    id: 1,
    invoiceNumber: 'INV-2026-0001',
    caseId: 1,
    clientId: 1,
    description: 'دفعة أولى',
    feeAmount: 10000,
    expensesAmount: 2000,
    vatRate: 15,
    vatAmount: 1800,
    paidAmount: 5000,
    invoiceType: 'tax_invoice',
    zatcaQr: '',
    status: 'partial',
    issuedDate: '2026-10-01',
    dueDate: '2026-10-15',
    notes: '',
  },
  {
    id: 2,
    invoiceNumber: 'INV-2026-0002',
    caseId: 1,
    clientId: 1,
    description: 'دفعة ثانية',
    feeAmount: 5000,
    expensesAmount: 0,
    vatRate: 15,
    vatAmount: 750,
    paidAmount: 5750,
    invoiceType: 'tax_invoice',
    zatcaQr: '',
    status: 'paid',
    issuedDate: '2026-10-20',
    dueDate: '2026-10-30',
    notes: '',
  },
];

test('generateNextCaseCode pads sequence numbers and formats prefix/year', () => {
  assert.equal(generateNextCaseCode('law', 2026, 7), 'LAW-2026-007');
  assert.equal(generateNextCaseCode('CASE', 2026, 105), 'CASE-2026-105');
});

test('computeDaysBetween and classifyHearingUrgency evaluate deadlines accurately', () => {
  assert.equal(computeDaysBetween('2026-11-14', '2026-11-16'), 2);
  assert.equal(classifyHearingUrgency(-1, 7), 'overdue');
  assert.equal(classifyHearingUrgency(2, 7), 'urgent');
  assert.equal(classifyHearingUrgency(5, 7), 'upcoming');
  assert.equal(classifyHearingUrgency(14, 7), 'later');
});

test('filterCases supports phone lookup, case code, and OCR document text search', () => {
  const byPhone = filterCases(sampleCases, sampleClients, sampleProcedures, {
    query: '0501234567',
  });
  assert.equal(byPhone.length, 1);
  assert.equal(byPhone[0].id, 1);

  const byOcr = filterCases(sampleCases, sampleClients, sampleProcedures, {
    query: 'مصرف الراجحي',
  });
  assert.equal(byOcr.length, 1);
  assert.equal(byOcr[0].caseCode, 'LAW-2026-101');
});

test('getAccessibleCasesForRole enforces RBAC for lawyer and client portal', () => {
  const lawyerView = getAccessibleCasesForRole(sampleCases, 'lawyer', {
    lawyerName: 'أ. خالد المنصور',
  });
  assert.equal(lawyerView.length, 1);

  const clientView = getAccessibleCasesForRole(sampleCases, 'client', {
    clientId: 2,
  });
  assert.equal(clientView.length, 1);
  assert.equal(clientView[0].clientId, 2);
});

test('calculateDashboardStats and getUpcomingHearings exclude closed cases from hearings', () => {
  const hearings = getUpcomingHearings(sampleCases, sampleClients, sampleProcedures, '2026-11-14', 7);
  assert.equal(hearings.length, 1);
  assert.equal(hearings[0].caseCode, 'LAW-2026-101');

  const stats = calculateDashboardStats(
    sampleClients,
    sampleCases,
    sampleProcedures,
    '2026-11-14',
    7,
  );
  assert.equal(stats.totalCases, 2);
  assert.equal(stats.activeCases, 1);
  assert.equal(stats.closedCases, 1);
  assert.equal(stats.upcomingHearingsCount, 1);
});

test('calculateClientFinancialSummary and computeInvoiceStatus compute VAT balances correctly', () => {
  const summary = calculateClientFinancialSummary(1, sampleCases, sampleInvoices);
  assert.equal(summary.totalFees, 15000);
  assert.equal(summary.totalExpenses, 2000);
  assert.equal(summary.totalVat, 2550);
  assert.equal(summary.totalBilled, 19550);
  assert.equal(summary.totalPaid, 10750);
  assert.equal(summary.balanceDue, 8800);

  assert.equal(computeInvoiceStatus(1000, 200, 0, 180), 'unpaid');
  assert.equal(computeInvoiceStatus(1000, 200, 500, 180), 'partial');
  assert.equal(computeInvoiceStatus(1000, 200, 1380, 180), 'paid');
});

test('generateCsvContent adds UTF-8 BOM and escapes commas, and generateHearingIcsEvent formats VEVENT', () => {
  const csv = generateCsvContent(['الاسم', 'ملاحظة'], [['عميل', 'أ, ب']]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"أ, ب"'));

  const hearings = getUpcomingHearings(
    sampleCases,
    sampleClients,
    sampleProcedures,
    '2026-11-14',
    7,
  );
  const ics = generateHearingIcsEvent(hearings[0], 'مكتب النخبة');
  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261116'));
  assert.ok(ics.includes('المحكمة التجارية'));
});

test('resolveTenantKey and buildLocalTenantStorageKey isolate workspaces strictly by normalized email', () => {
  const k1 = resolveTenantKey('uid-a', 'Lawyer.One@Office.com');
  const k1Same = resolveTenantKey('uid-b', '  lawyer.one@office.com ');
  const k2 = resolveTenantKey('uid-c', 'lawyer.two@office.com');

  assert.equal(k1, 'email:lawyer.one@office.com');
  assert.equal(k1, k1Same);
  assert.notEqual(k1, k2);
  assert.equal(resolveTenantKey('uid-only', ''), 'uid:uid-only');

  assert.equal(
    buildLocalTenantStorageKey('UserA@Mail.com'),
    'mizan_workspace_v2::usera@mail.com',
  );
  assert.notEqual(
    buildLocalTenantStorageKey('usera@mail.com'),
    buildLocalTenantStorageKey('userb@mail.com'),
  );
  assert.equal(generateNextClientCode(0, 'clt'), 'CLT-0001');

  const emptyStats = calculateDashboardStats([], [], [], '2026-11-14', 7);
  assert.equal(emptyStats.totalClients, 0);
  assert.equal(emptyStats.totalCases, 0);
  assert.equal(emptyStats.upcomingHearingsCount, 0);
});

test('ZATCA TLV Base64 QR, VAT totals, Trust Balance, Automated Reminders & Statutory Deadlines work accurately', () => {
  const totals = computeInvoiceTotals(10000, 0, 15, 'tax_invoice');
  assert.equal(totals.vatAmount, 1500);
  assert.equal(totals.totalWithVat, 11500);

  const qr = generateZatcaQrPayload({
    sellerName: 'مكتب النقيب للمحاماة',
    vatNumber: '310123456700003',
    timestampIso: '2026-11-14T10:00:00Z',
    totalWithVat: 11500,
    vatAmount: 1500,
  });
  const decoded = Buffer.from(qr, 'base64');
  assert.equal(decoded[0], 1); // ZATCA Tag 1
  assert.ok(decoded.includes(Buffer.from('310123456700003')));

  // Automated 72h & 24h reminders
  const reminders = computeAutomatedReminderPlan(
    [
      { ...sampleCases[0], nextHearingDate: '2026-11-17' }, // +3 days => 72h
      { ...sampleCases[0], id: 9, caseCode: 'CASE-009', nextHearingDate: '2026-11-15' }, // +1 day => 24h
    ],
    sampleClients,
    '2026-11-14',
  );
  assert.equal(reminders.length, 2);
  assert.equal(reminders[0].tier, '24h');
  assert.equal(reminders[1].tier, '72h');

  // Statutory deadline shifting off Friday/Saturday weekend
  // 2026-10-14 + 30 days = 2026-11-13 (Friday) -> shifts +2 days to Sunday 2026-11-15
  const deadline = calculateStatutoryDeadline('2026-10-14', 'appeal_30');
  assert.equal(deadline.rawDueDate, '2026-11-13');
  assert.equal(deadline.adjustedDueDate, '2026-11-15');
  assert.equal(deadline.shiftedDays, 2);

  // Trust / Retainer accounting
  const trustTxs: TrustTransaction[] = [
    {
      id: 1,
      clientId: 1,
      caseId: 1,
      txType: 'deposit',
      amount: 25000,
      description: 'إيداع أمانة',
      referenceNo: 'TRX-1',
      txDate: '2026-11-01',
    },
    {
      id: 2,
      clientId: 1,
      caseId: 1,
      txType: 'deduction',
      amount: 4500,
      description: 'خصم رسوم خبرة',
      referenceNo: 'TRX-2',
      txDate: '2026-11-05',
    },
  ];
  const trust = calculateTrustBalance(trustTxs, 1);
  assert.equal(trust.totalDeposits, 25000);
  assert.equal(trust.totalDeductions, 4500);
  assert.equal(trust.balance, 20500);
});
