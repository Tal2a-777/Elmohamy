import crypto from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  auditLogs,
  cases,
  clients,
  contracts,
  documentVersions,
  firmMembers,
  invoices,
  lawyers,
  legalDeadlines,
  notificationsLog,
  officeSettings,
  procedures,
  timeEntries,
  trustTransactions,
} from './schema.ts';
import { createEmptyWorkspace } from '../data/seedData.ts';
import {
  computeInvoiceStatus,
  computeInvoiceTotals,
  DEFAULT_ROLE_PERMISSIONS,
  generateNextCaseCode,
  generateNextClientCode,
  generateZatcaQrPayload,
} from '../utils/legalLogic.ts';
import type {
  AuditLogEntry,
  CaseStatus,
  Client,
  DocumentVersion,
  FirmMember,
  Invoice,
  Lawyer,
  LegalCase,
  LegalContract,
  LegalDeadline,
  NotificationItem,
  OfficeSettings,
  Procedure,
  TeamPermissions,
  TimeEntry,
  TrustTransaction,
  WorkspaceState,
} from '../types/legal.ts';

function getVaultKey(): Buffer {
  const secret = process.env.VAULT_ENCRYPTION_SECRET || process.env.GEMINI_API_KEY || 'mizan-vault-default-key-2026';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptVaultPayload(plainText: string): { cipherText: string; sha256: string } {
  const sha256 = crypto.createHash('sha256').update(plainText || '').digest('hex');
  if (!plainText) return { cipherText: '', sha256 };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getVaultKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('base64')}`;
  return { cipherText: combined, sha256 };
}

export function decryptVaultPayload(cipherText: string): string {
  if (!cipherText) return '';
  const parts = cipherText.split(':');
  if (parts.length !== 3) return cipherText;
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getVaultKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return cipherText;
  }
}

function mapClient(row: typeof clients.$inferSelect): Client {
  return {
    id: row.id,
    clientCode: row.clientCode,
    name: row.name,
    clientType: (row.clientType as Client['clientType']) || 'individual',
    nationalOrRegId: row.nationalOrRegId,
    phone: row.phone,
    email: row.email,
    address: row.address,
    accountStatus: (row.accountStatus as Client['accountStatus']) || 'active',
    notes: row.notes,
    createdAt: row.createdAt ? row.createdAt.toISOString().slice(0, 10) : '',
  };
}

function mapLawyer(row: typeof lawyers.$inferSelect): Lawyer {
  return {
    id: row.id,
    name: row.name,
    specialty: row.specialty,
    phone: row.phone,
    email: row.email,
    barNumber: row.barNumber,
    active: row.active,
  };
}

function mapFirmMember(row: typeof firmMembers.$inferSelect): FirmMember {
  const role = (row.role as FirmMember['role']) || 'lawyer';
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role,
    permissions: (row.permissions as TeamPermissions) || DEFAULT_ROLE_PERMISSIONS[role],
    status: (row.status as FirmMember['status']) || 'active',
    createdAt: row.createdAt ? row.createdAt.toISOString().slice(0, 10) : '',
  };
}

function mapCase(row: typeof cases.$inferSelect): LegalCase {
  return {
    id: row.id,
    caseCode: row.caseCode,
    officialNumber: row.officialNumber,
    caseYear: row.caseYear,
    subject: row.subject,
    caseType: row.caseType,
    clientId: row.clientId,
    clientRole: (row.clientRole as LegalCase['clientRole']) || 'plaintiff',
    opponentName: row.opponentName,
    lawyerId: row.lawyerId,
    lawyerName: row.lawyerName,
    courtName: row.courtName,
    status: (row.status as CaseStatus) || 'active',
    folderUrl: row.folderUrl,
    notes: row.notes,
    nextHearingDate: row.nextHearingDate,
    najizStatus: row.najizStatus,
    najizCircuit: row.najizCircuit,
    lastSyncedAt: row.lastSyncedAt,
    createdAt: row.createdAt ? row.createdAt.toISOString().slice(0, 10) : '',
  };
}

function mapProcedure(row: typeof procedures.$inferSelect): Procedure {
  return {
    id: row.id,
    caseId: row.caseId,
    procedureDate: row.procedureDate,
    procedureType: (row.procedureType as Procedure['procedureType']) || 'hearing',
    description: row.description,
    executorName: row.executorName,
    outcome: row.outcome,
    nextActionDate: row.nextActionDate,
    attachmentName: row.attachmentName,
    attachmentMime: row.attachmentMime,
    attachmentSize: row.attachmentSize,
    attachmentText: row.attachmentText,
    attachmentData: row.attachmentData,
    visibleToClient: row.visibleToClient,
  };
}

function mapInvoice(row: typeof invoices.$inferSelect): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    caseId: row.caseId,
    clientId: row.clientId,
    description: row.description,
    feeAmount: Number(row.feeAmount || 0),
    expensesAmount: Number(row.expensesAmount || 0),
    vatRate: Number(row.vatRate || 15),
    vatAmount: Number(row.vatAmount || 0),
    paidAmount: Number(row.paidAmount || 0),
    invoiceType: (row.invoiceType as Invoice['invoiceType']) || 'tax_invoice',
    zatcaQr: row.zatcaQr || '',
    status: (row.status as Invoice['status']) || 'unpaid',
    issuedDate: row.issuedDate,
    dueDate: row.dueDate,
    notes: row.notes,
  };
}

function mapTimeEntry(row: typeof timeEntries.$inferSelect): TimeEntry {
  return {
    id: row.id,
    caseId: row.caseId,
    lawyerName: row.lawyerName,
    hours: Number(row.hours || 0),
    hourlyRate: Number(row.hourlyRate || 0),
    billable: row.billable,
    invoiced: row.invoiced,
    description: row.description,
    entryDate: row.entryDate,
  };
}

function mapTrustTx(row: typeof trustTransactions.$inferSelect): TrustTransaction {
  return {
    id: row.id,
    clientId: row.clientId,
    caseId: row.caseId,
    txType: (row.txType as TrustTransaction['txType']) || 'deposit',
    amount: Number(row.amount || 0),
    description: row.description,
    referenceNo: row.referenceNo,
    txDate: row.txDate,
  };
}

function mapContract(row: typeof contracts.$inferSelect): LegalContract {
  return {
    id: row.id,
    caseId: row.caseId,
    clientId: row.clientId,
    title: row.title,
    contractType: (row.contractType as LegalContract['contractType']) || 'fee_agreement',
    content: row.content,
    feeTerms: row.feeTerms,
    signToken: row.signToken,
    status: (row.status as LegalContract['status']) || 'pending_signature',
    signerName: row.signerName,
    signatureDataUrl: row.signatureDataUrl,
    signedAt: row.signedAt,
    createdAt: row.createdAt ? row.createdAt.toISOString().slice(0, 10) : '',
  };
}

function mapDeadline(row: typeof legalDeadlines.$inferSelect): LegalDeadline {
  return {
    id: row.id,
    caseId: row.caseId,
    title: row.title,
    judgmentDate: row.judgmentDate,
    deadlineType: row.deadlineType,
    statutoryDays: row.statutoryDays,
    dueDate: row.dueDate,
    notes: row.notes,
    status: (row.status as LegalDeadline['status']) || 'active',
    createdAt: row.createdAt ? row.createdAt.toISOString().slice(0, 10) : '',
  };
}

function mapAudit(row: typeof auditLogs.$inferSelect): AuditLogEntry {
  return {
    id: row.id,
    actorEmail: row.actorEmail,
    actorRole: row.actorRole,
    actionType: row.actionType,
    entityType: row.entityType,
    entityLabel: row.entityLabel,
    details: row.details,
    createdAt: row.createdAt ? row.createdAt.toISOString() : '',
  };
}

function mapDocVersion(row: typeof documentVersions.$inferSelect): DocumentVersion {
  return {
    id: row.id,
    caseId: row.caseId,
    procedureId: row.procedureId,
    docGroupKey: row.docGroupKey,
    fileName: row.fileName,
    versionNumber: row.versionNumber,
    fileMime: row.fileMime,
    fileSize: row.fileSize,
    sha256Hash: row.sha256Hash,
    encryptedData: '', // never dump ciphertext bulk payload into workspace bootstrap
    isEncrypted: row.isEncrypted,
    shareToken: row.shareToken,
    shareExpiresAt: row.shareExpiresAt,
    uploadedBy: row.uploadedBy,
    notes: row.notes,
    createdAt: row.createdAt ? row.createdAt.toISOString().slice(0, 10) : '',
  };
}

function mapNotification(row: typeof notificationsLog.$inferSelect): NotificationItem {
  return {
    id: row.id,
    caseId: row.caseId,
    recipientName: row.recipientName,
    recipientPhone: row.recipientPhone,
    channel: (row.channel as NotificationItem['channel']) || 'whatsapp',
    message: row.message,
    status: (row.status as NotificationItem['status']) || 'sent',
    sentAt: row.sentAt ? row.sentAt.toISOString().slice(0, 10) : '',
  };
}

function mapSettings(row: typeof officeSettings.$inferSelect): OfficeSettings {
  return {
    officeName: row.officeName,
    officeLogoUrl: row.officeLogoUrl,
    officePhone: row.officePhone,
    officeAddress: row.officeAddress,
    vatNumber: row.vatNumber,
    vatRate: row.vatRate,
    autoNumberPrefix: row.autoNumberPrefix,
    autoNumberNext: row.autoNumberNext,
    clientNumberPrefix: row.clientNumberPrefix,
    reminderDaysBefore: row.reminderDaysBefore,
    requireHearingSource: row.requireHearingSource,
    whatsappEnabled: row.whatsappEnabled,
    emailNotificationsEnabled: row.emailNotificationsEnabled,
    smsEnabled: row.smsEnabled,
    najizAutoSync: row.najizAutoSync,
    calendarSyncProvider: (row.calendarSyncProvider as 'google' | 'outlook') || 'google',
    caseTypes: Array.isArray(row.caseTypes) ? row.caseTypes : [],
    courts: Array.isArray(row.courts) ? row.courts : [],
  };
}

export async function appendAuditLog(
  ownerUid: string,
  input: {
    actorEmail: string;
    actorRole?: string;
    actionType: string;
    entityType: string;
    entityLabel: string;
    details?: string;
  },
): Promise<AuditLogEntry> {
  const [inserted] = await db
    .insert(auditLogs)
    .values({
      ownerUid,
      actorEmail: input.actorEmail || ownerUid,
      actorRole: input.actorRole || 'admin',
      actionType: input.actionType,
      entityType: input.entityType,
      entityLabel: input.entityLabel,
      details: input.details || '',
    })
    .returning();
  return mapAudit(inserted);
}

export async function resolveWorkspaceAccess(
  tenantKey: string,
  email: string,
): Promise<{
  workspaceOwnerKey: string;
  memberRole: 'admin' | 'lawyer' | 'secretary' | 'accountant';
  permissions: TeamPermissions;
}> {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (normalizedEmail) {
    const memberships = await db
      .select()
      .from(firmMembers)
      .where(and(eq(firmMembers.email, normalizedEmail), eq(firmMembers.status, 'active')));
    if (memberships.length > 0) {
      const m = memberships[0];
      const role = (m.role as 'admin' | 'lawyer' | 'secretary' | 'accountant') || 'lawyer';
      return {
        workspaceOwnerKey: m.ownerUid,
        memberRole: role,
        permissions: (m.permissions as TeamPermissions) || DEFAULT_ROLE_PERMISSIONS[role],
      };
    }
  }
  return {
    workspaceOwnerKey: tenantKey,
    memberRole: 'admin',
    permissions: DEFAULT_ROLE_PERMISSIONS.admin,
  };
}

export async function ensureAndLoadWorkspace(ownerUid: string): Promise<WorkspaceState> {
  try {
    let settingsRows = await db
      .select()
      .from(officeSettings)
      .where(eq(officeSettings.ownerUid, ownerUid));

    if (settingsRows.length === 0) {
      const empty = createEmptyWorkspace();
      await db
        .insert(officeSettings)
        .values({
          ownerUid,
          officeName: empty.settings.officeName,
          officeLogoUrl: empty.settings.officeLogoUrl,
          officePhone: empty.settings.officePhone,
          officeAddress: empty.settings.officeAddress,
          vatNumber: empty.settings.vatNumber,
          vatRate: empty.settings.vatRate,
          autoNumberPrefix: empty.settings.autoNumberPrefix,
          autoNumberNext: empty.settings.autoNumberNext,
          clientNumberPrefix: empty.settings.clientNumberPrefix || 'CL',
          reminderDaysBefore: empty.settings.reminderDaysBefore,
          requireHearingSource: empty.settings.requireHearingSource ?? true,
          whatsappEnabled: empty.settings.whatsappEnabled,
          emailNotificationsEnabled: empty.settings.emailNotificationsEnabled,
          smsEnabled: empty.settings.smsEnabled,
          najizAutoSync: empty.settings.najizAutoSync,
          calendarSyncProvider: empty.settings.calendarSyncProvider,
          caseTypes: empty.settings.caseTypes,
          courts: empty.settings.courts,
        })
        .onConflictDoNothing({ target: officeSettings.ownerUid });

      settingsRows = await db
        .select()
        .from(officeSettings)
        .where(eq(officeSettings.ownerUid, ownerUid));
    }

    const [
      lawyerRows,
      memberRows,
      clientRows,
      caseRows,
      procedureRows,
      invoiceRows,
      timeRows,
      trustRows,
      contractRows,
      deadlineRows,
      auditRows,
      docRows,
      notificationRows,
    ] = await Promise.all([
      db.select().from(lawyers).where(eq(lawyers.ownerUid, ownerUid)).orderBy(lawyers.id),
      db.select().from(firmMembers).where(eq(firmMembers.ownerUid, ownerUid)).orderBy(firmMembers.id),
      db.select().from(clients).where(eq(clients.ownerUid, ownerUid)).orderBy(desc(clients.id)),
      db.select().from(cases).where(eq(cases.ownerUid, ownerUid)).orderBy(desc(cases.id)),
      db
        .select()
        .from(procedures)
        .where(eq(procedures.ownerUid, ownerUid))
        .orderBy(desc(procedures.procedureDate), desc(procedures.id)),
      db.select().from(invoices).where(eq(invoices.ownerUid, ownerUid)).orderBy(desc(invoices.id)),
      db.select().from(timeEntries).where(eq(timeEntries.ownerUid, ownerUid)).orderBy(desc(timeEntries.id)),
      db
        .select()
        .from(trustTransactions)
        .where(eq(trustTransactions.ownerUid, ownerUid))
        .orderBy(desc(trustTransactions.id)),
      db.select().from(contracts).where(eq(contracts.ownerUid, ownerUid)).orderBy(desc(contracts.id)),
      db
        .select()
        .from(legalDeadlines)
        .where(eq(legalDeadlines.ownerUid, ownerUid))
        .orderBy(legalDeadlines.dueDate),
      db.select().from(auditLogs).where(eq(auditLogs.ownerUid, ownerUid)).orderBy(desc(auditLogs.id)).limit(150),
      db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.ownerUid, ownerUid))
        .orderBy(desc(documentVersions.id)),
      db
        .select()
        .from(notificationsLog)
        .where(eq(notificationsLog.ownerUid, ownerUid))
        .orderBy(desc(notificationsLog.id)),
    ]);

    return {
      settings: mapSettings(settingsRows[0]),
      lawyers: lawyerRows.map(mapLawyer),
      firmMembers: memberRows.map(mapFirmMember),
      clients: clientRows.map(mapClient),
      cases: caseRows.map(mapCase),
      procedures: procedureRows.map(mapProcedure),
      invoices: invoiceRows.map(mapInvoice),
      timeEntries: timeRows.map(mapTimeEntry),
      trustTransactions: trustRows.map(mapTrustTx),
      contracts: contractRows.map(mapContract),
      deadlines: deadlineRows.map(mapDeadline),
      auditLogs: auditRows.map(mapAudit),
      documentVersions: docRows.map(mapDocVersion),
      notifications: notificationRows.map(mapNotification),
    };
  } catch (error) {
    console.error('Database query failed in ensureAndLoadWorkspace:', error);
    throw new Error('تعذر تحميل بيانات المكتب من قاعدة البيانات.', { cause: error });
  }
}

export async function resetWorkspaceRecords(ownerUid: string): Promise<WorkspaceState> {
  await db.delete(notificationsLog).where(eq(notificationsLog.ownerUid, ownerUid));
  await db.delete(documentVersions).where(eq(documentVersions.ownerUid, ownerUid));
  await db.delete(auditLogs).where(eq(auditLogs.ownerUid, ownerUid));
  await db.delete(legalDeadlines).where(eq(legalDeadlines.ownerUid, ownerUid));
  await db.delete(contracts).where(eq(contracts.ownerUid, ownerUid));
  await db.delete(trustTransactions).where(eq(trustTransactions.ownerUid, ownerUid));
  await db.delete(timeEntries).where(eq(timeEntries.ownerUid, ownerUid));
  await db.delete(invoices).where(eq(invoices.ownerUid, ownerUid));
  await db.delete(procedures).where(eq(procedures.ownerUid, ownerUid));
  await db.delete(cases).where(eq(cases.ownerUid, ownerUid));
  await db.delete(clients).where(eq(clients.ownerUid, ownerUid));
  await db.delete(lawyers).where(eq(lawyers.ownerUid, ownerUid));
  await db.delete(firmMembers).where(eq(firmMembers.ownerUid, ownerUid));

  const empty = createEmptyWorkspace();
  await db
    .update(officeSettings)
    .set({
      officeName: empty.settings.officeName,
      officeLogoUrl: empty.settings.officeLogoUrl,
      officePhone: empty.settings.officePhone,
      officeAddress: empty.settings.officeAddress,
      vatNumber: empty.settings.vatNumber,
      vatRate: empty.settings.vatRate,
      autoNumberPrefix: empty.settings.autoNumberPrefix,
      autoNumberNext: empty.settings.autoNumberNext,
      clientNumberPrefix: empty.settings.clientNumberPrefix || 'CL',
      reminderDaysBefore: empty.settings.reminderDaysBefore,
      requireHearingSource: empty.settings.requireHearingSource ?? true,
      whatsappEnabled: empty.settings.whatsappEnabled,
      emailNotificationsEnabled: empty.settings.emailNotificationsEnabled,
      smsEnabled: empty.settings.smsEnabled,
      najizAutoSync: empty.settings.najizAutoSync,
      calendarSyncProvider: empty.settings.calendarSyncProvider,
      caseTypes: empty.settings.caseTypes,
      courts: empty.settings.courts,
      updatedAt: new Date(),
    })
    .where(eq(officeSettings.ownerUid, ownerUid));

  return ensureAndLoadWorkspace(ownerUid);
}

export async function createClientRecord(
  ownerUid: string,
  actorEmail: string,
  input: Omit<Client, 'id' | 'createdAt' | 'clientCode'>,
): Promise<Client> {
  const [settingsRow] = await db
    .select()
    .from(officeSettings)
    .where(eq(officeSettings.ownerUid, ownerUid));
  const existing = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.ownerUid, ownerUid));
  const clientCode = generateNextClientCode(
    existing.length,
    settingsRow?.clientNumberPrefix || 'CL',
  );
  const [inserted] = await db
    .insert(clients)
    .values({
      ownerUid,
      clientCode,
      name: input.name,
      clientType: input.clientType,
      nationalOrRegId: input.nationalOrRegId,
      phone: input.phone,
      email: input.email,
      address: input.address,
      accountStatus: input.accountStatus,
      notes: input.notes,
    })
    .returning();
  await appendAuditLog(ownerUid, {
    actorEmail,
    actionType: 'create',
    entityType: 'client',
    entityLabel: `${clientCode} — ${input.name}`,
    details: 'إضافة ملف عميل جديد',
  });
  return mapClient(inserted);
}

export async function updateClientRecord(
  ownerUid: string,
  actorEmail: string,
  id: number,
  input: Partial<Omit<Client, 'id' | 'createdAt' | 'clientCode'>>,
): Promise<Client | null> {
  const patch: Partial<typeof clients.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.clientType !== undefined) patch.clientType = input.clientType;
  if (input.nationalOrRegId !== undefined) patch.nationalOrRegId = input.nationalOrRegId;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.email !== undefined) patch.email = input.email;
  if (input.address !== undefined) patch.address = input.address;
  if (input.accountStatus !== undefined) patch.accountStatus = input.accountStatus;
  if (input.notes !== undefined) patch.notes = input.notes;

  const [updated] = await db
    .update(clients)
    .set(patch)
    .where(and(eq(clients.id, id), eq(clients.ownerUid, ownerUid)))
    .returning();
  if (updated) {
    await appendAuditLog(ownerUid, {
      actorEmail,
      actionType: 'update',
      entityType: 'client',
      entityLabel: `${updated.clientCode} — ${updated.name}`,
      details: 'تحديث بيانات العميل',
    });
  }
  return updated ? mapClient(updated) : null;
}

export async function createCaseRecord(
  ownerUid: string,
  actorEmail: string,
  input: Omit<LegalCase, 'id' | 'createdAt' | 'caseCode'>,
): Promise<{ legalCase: LegalCase; nextAutoNumber: number }> {
  const [ownedClient] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, input.clientId), eq(clients.ownerUid, ownerUid)));
  if (!ownedClient) {
    throw new Error('العميل المحدد غير موجود داخل مساحة العمل الخاصة بك.');
  }

  let verifiedLawyerId: number | null = null;
  if (input.lawyerId) {
    const [ownedLawyer] = await db
      .select({ id: lawyers.id })
      .from(lawyers)
      .where(and(eq(lawyers.id, input.lawyerId), eq(lawyers.ownerUid, ownerUid)));
    if (ownedLawyer) verifiedLawyerId = ownedLawyer.id;
  }

  const [settingsRow] = await db
    .select()
    .from(officeSettings)
    .where(eq(officeSettings.ownerUid, ownerUid));

  const prefix = settingsRow?.autoNumberPrefix || 'CASE';
  const seq = settingsRow?.autoNumberNext || 1;
  const caseCode = generateNextCaseCode(prefix, input.caseYear, seq);

  const [inserted] = await db
    .insert(cases)
    .values({
      ownerUid,
      caseCode,
      officialNumber: input.officialNumber,
      caseYear: input.caseYear,
      subject: input.subject,
      caseType: input.caseType,
      clientId: input.clientId,
      clientRole: input.clientRole,
      opponentName: input.opponentName,
      lawyerId: verifiedLawyerId,
      lawyerName: input.lawyerName || 'غير محدد',
      courtName: input.courtName,
      status: input.status || 'active',
      folderUrl: input.folderUrl || '',
      notes: input.notes || '',
      nextHearingDate: input.nextHearingDate || '',
      najizStatus: input.najizStatus || '',
      najizCircuit: input.najizCircuit || '',
      lastSyncedAt: input.lastSyncedAt || '',
    })
    .returning();

  const nextSeq = seq + 1;
  if (settingsRow) {
    await db
      .update(officeSettings)
      .set({ autoNumberNext: nextSeq, updatedAt: new Date() })
      .where(eq(officeSettings.ownerUid, ownerUid));
  }

  await appendAuditLog(ownerUid, {
    actorEmail,
    actionType: 'create',
    entityType: 'case',
    entityLabel: `${caseCode} — ${input.subject}`,
    details: `فتح ملف قضية جديد (${input.officialNumber})`,
  });

  return { legalCase: mapCase(inserted), nextAutoNumber: nextSeq };
}

export async function updateCaseRecord(
  ownerUid: string,
  actorEmail: string,
  id: number,
  input: Partial<Omit<LegalCase, 'id' | 'createdAt' | 'caseCode'>>,
): Promise<LegalCase | null> {
  const patch: Partial<typeof cases.$inferInsert> = { updatedAt: new Date() };
  if (input.status !== undefined) patch.status = input.status;
  if (input.subject !== undefined) patch.subject = input.subject;
  if (input.courtName !== undefined) patch.courtName = input.courtName;
  if (input.folderUrl !== undefined) patch.folderUrl = input.folderUrl;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.nextHearingDate !== undefined) patch.nextHearingDate = input.nextHearingDate;
  if (input.lawyerName !== undefined) patch.lawyerName = input.lawyerName;
  if (input.najizStatus !== undefined) patch.najizStatus = input.najizStatus;
  if (input.najizCircuit !== undefined) patch.najizCircuit = input.najizCircuit;
  if (input.lastSyncedAt !== undefined) patch.lastSyncedAt = input.lastSyncedAt;

  const [updated] = await db
    .update(cases)
    .set(patch)
    .where(and(eq(cases.id, id), eq(cases.ownerUid, ownerUid)))
    .returning();
  if (updated) {
    await appendAuditLog(ownerUid, {
      actorEmail,
      actionType: input.lastSyncedAt ? 'sync' : 'update',
      entityType: 'case',
      entityLabel: `${updated.caseCode} — ${updated.subject}`,
      details: input.lastSyncedAt ? 'مزامنة مع بوابة ناجز والمحكمة' : `تحديث حالة/بيانات القضية (${updated.status})`,
    });
  }
  return updated ? mapCase(updated) : null;
}

export async function createProcedureRecord(
  ownerUid: string,
  actorEmail: string,
  input: Omit<Procedure, 'id'>,
): Promise<Procedure> {
  const [ownedCase] = await db
    .select({ id: cases.id, caseCode: cases.caseCode })
    .from(cases)
    .where(and(eq(cases.id, input.caseId), eq(cases.ownerUid, ownerUid)));
  if (!ownedCase) {
    throw new Error('القضية المحددة غير موجودة داخل مساحة العمل الخاصة بك.');
  }

  const [inserted] = await db
    .insert(procedures)
    .values({
      ownerUid,
      caseId: input.caseId,
      procedureDate: input.procedureDate,
      procedureType: input.procedureType,
      description: input.description,
      executorName: input.executorName,
      outcome: input.outcome,
      nextActionDate: input.nextActionDate,
      attachmentName: input.attachmentName,
      attachmentMime: input.attachmentMime,
      attachmentSize: input.attachmentSize,
      attachmentText: input.attachmentText,
      attachmentData: input.attachmentData,
      visibleToClient: input.visibleToClient,
    })
    .returning();

  if (input.nextActionDate) {
    await db
      .update(cases)
      .set({ nextHearingDate: input.nextActionDate, updatedAt: new Date() })
      .where(and(eq(cases.id, input.caseId), eq(cases.ownerUid, ownerUid)));
  }

  await appendAuditLog(ownerUid, {
    actorEmail,
    actionType: 'create',
    entityType: 'procedure',
    entityLabel: `${ownedCase.caseCode} — ${input.procedureDate}`,
    details: input.description.slice(0, 120),
  });

  return mapProcedure(inserted);
}

export async function createInvoiceRecord(
  ownerUid: string,
  actorEmail: string,
  input: Omit<Invoice, 'id' | 'invoiceNumber' | 'status' | 'vatAmount' | 'zatcaQr' | 'vatRate'> & {
    vatRate?: number;
    invoiceType?: Invoice['invoiceType'];
  },
): Promise<Invoice> {
  const [ownedCase] = await db
    .select({ id: cases.id })
    .from(cases)
    .where(and(eq(cases.id, input.caseId), eq(cases.ownerUid, ownerUid)));
  const [ownedClient] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, input.clientId), eq(clients.ownerUid, ownerUid)));
  if (!ownedCase || !ownedClient) {
    throw new Error('القضية أو العميل المحدد غير موجود داخل مساحة العمل الخاصة بك.');
  }

  const [settingsRow] = await db
    .select()
    .from(officeSettings)
    .where(eq(officeSettings.ownerUid, ownerUid));

  const existing = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.ownerUid, ownerUid));
  const year = new Date().getFullYear();
  const invoiceNumber = `INV-${year}-${String(existing.length + 1).padStart(4, '0')}`;
  const vatRate = input.vatRate ?? settingsRow?.vatRate ?? 15;
  const invoiceType = input.invoiceType || 'tax_invoice';
  const totals = computeInvoiceTotals(input.feeAmount, input.expensesAmount, vatRate, invoiceType);
  const status = computeInvoiceStatus(
    input.feeAmount,
    input.expensesAmount,
    input.paidAmount,
    totals.vatAmount,
  );
  const zatcaQr = generateZatcaQrPayload({
    sellerName: settingsRow?.officeName || 'مكتب المحاماة',
    vatNumber: settingsRow?.vatNumber || '300000000000003',
    timestampIso: new Date().toISOString(),
    totalWithVat: totals.totalWithVat,
    vatAmount: totals.vatAmount,
  });

  const [inserted] = await db
    .insert(invoices)
    .values({
      ownerUid,
      invoiceNumber,
      caseId: input.caseId,
      clientId: input.clientId,
      description: input.description,
      feeAmount: String(input.feeAmount),
      expensesAmount: String(input.expensesAmount),
      vatRate: String(vatRate),
      vatAmount: String(totals.vatAmount),
      paidAmount: String(input.paidAmount),
      invoiceType,
      zatcaQr,
      status,
      issuedDate: input.issuedDate,
      dueDate: input.dueDate,
      notes: input.notes,
    })
    .returning();

  await appendAuditLog(ownerUid, {
    actorEmail,
    actionType: 'create',
    entityType: 'invoice',
    entityLabel: invoiceNumber,
    details: `إصدار فاتورة (${invoiceType}) بإجمالي ${totals.totalWithVat}`,
  });

  return mapInvoice(inserted);
}

export async function updateInvoicePayment(
  ownerUid: string,
  actorEmail: string,
  id: number,
  paidAmount: number,
): Promise<Invoice | null> {
  const [existing] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.ownerUid, ownerUid)));
  if (!existing) return null;

  const status = computeInvoiceStatus(
    Number(existing.feeAmount),
    Number(existing.expensesAmount),
    paidAmount,
    Number(existing.vatAmount || 0),
  );
  const [updated] = await db
    .update(invoices)
    .set({ paidAmount: String(paidAmount), status })
    .where(and(eq(invoices.id, id), eq(invoices.ownerUid, ownerUid)))
    .returning();
  if (updated) {
    await appendAuditLog(ownerUid, {
      actorEmail,
      actionType: 'update',
      entityType: 'invoice',
      entityLabel: updated.invoiceNumber,
      details: `تسجيل سداد بقيمة ${paidAmount}`,
    });
  }
  return updated ? mapInvoice(updated) : null;
}

export async function createTimeEntryRecord(
  ownerUid: string,
  actorEmail: string,
  input: Omit<TimeEntry, 'id'>,
): Promise<TimeEntry> {
  const [ownedCase] = await db
    .select({ id: cases.id })
    .from(cases)
    .where(and(eq(cases.id, input.caseId), eq(cases.ownerUid, ownerUid)));
  if (!ownedCase) throw new Error('القضية غير موجودة في مساحة العمل.');

  const [inserted] = await db
    .insert(timeEntries)
    .values({
      ownerUid,
      caseId: input.caseId,
      lawyerName: input.lawyerName,
      hours: String(input.hours),
      hourlyRate: String(input.hourlyRate),
      billable: input.billable,
      invoiced: input.invoiced,
      description: input.description,
      entryDate: input.entryDate,
    })
    .returning();

  await appendAuditLog(ownerUid, {
    actorEmail,
    actionType: 'create',
    entityType: 'time_entry',
    entityLabel: `${input.hours} ساعة — ${input.lawyerName}`,
    details: input.description,
  });
  return mapTimeEntry(inserted);
}

export async function markTimeEntriesInvoiced(
  ownerUid: string,
  entryIds: number[],
): Promise<void> {
  for (const id of entryIds) {
    await db
      .update(timeEntries)
      .set({ invoiced: true })
      .where(and(eq(timeEntries.id, id), eq(timeEntries.ownerUid, ownerUid)));
  }
}

export async function deleteTimeEntryRecord(ownerUid: string, id: number): Promise<boolean> {
  const deleted = await db
    .delete(timeEntries)
    .where(and(eq(timeEntries.id, id), eq(timeEntries.ownerUid, ownerUid)))
    .returning({ id: timeEntries.id });
  return deleted.length > 0;
}

export async function createTrustTransactionRecord(
  ownerUid: string,
  actorEmail: string,
  input: Omit<TrustTransaction, 'id'>,
): Promise<TrustTransaction> {
  const [ownedClient] = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(and(eq(clients.id, input.clientId), eq(clients.ownerUid, ownerUid)));
  if (!ownedClient) throw new Error('العميل غير موجود في مساحة العمل.');

  const [inserted] = await db
    .insert(trustTransactions)
    .values({
      ownerUid,
      clientId: input.clientId,
      caseId: input.caseId,
      txType: input.txType,
      amount: String(input.amount),
      description: input.description,
      referenceNo: input.referenceNo,
      txDate: input.txDate,
    })
    .returning();

  await appendAuditLog(ownerUid, {
    actorEmail,
    actionType: 'create',
    entityType: 'trust_transaction',
    entityLabel: `${ownedClient.name} (${input.txType})`,
    details: `مبلغ ${input.amount} — ${input.description}`,
  });
  return mapTrustTx(inserted);
}

export async function createContractRecord(
  ownerUid: string,
  actorEmail: string,
  input: Omit<LegalContract, 'id' | 'signToken' | 'status' | 'signerName' | 'signatureDataUrl' | 'signedAt' | 'createdAt'>,
): Promise<LegalContract> {
  const [ownedClient] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, input.clientId), eq(clients.ownerUid, ownerUid)));
  if (!ownedClient) throw new Error('العميل غير موجود في مساحة العمل.');

  const signToken = crypto.randomBytes(12).toString('hex');
  const [inserted] = await db
    .insert(contracts)
    .values({
      ownerUid,
      caseId: input.caseId,
      clientId: input.clientId,
      title: input.title,
      contractType: input.contractType,
      content: input.content,
      feeTerms: input.feeTerms,
      signToken,
      status: 'pending_signature',
      signerName: '',
      signatureDataUrl: '',
      signedAt: '',
    })
    .returning();

  await appendAuditLog(ownerUid, {
    actorEmail,
    actionType: 'create',
    entityType: 'contract',
    entityLabel: input.title,
    details: 'إنشاء عقد / اتفاقية أتعاب للتوقيع الإلكتروني',
  });
  return mapContract(inserted);
}

export async function signContractRecord(
  ownerUid: string,
  actorEmail: string,
  id: number,
  signerName: string,
  signatureDataUrl: string,
): Promise<LegalContract | null> {
  const signedAt = new Date().toISOString().slice(0, 10);
  const [updated] = await db
    .update(contracts)
    .set({
      status: 'signed',
      signerName,
      signatureDataUrl,
      signedAt,
    })
    .where(and(eq(contracts.id, id), eq(contracts.ownerUid, ownerUid)))
    .returning();
  if (updated) {
    await appendAuditLog(ownerUid, {
      actorEmail,
      actionType: 'sign',
      entityType: 'contract',
      entityLabel: updated.title,
      details: `تم التوقيع الإلكتروني بواسطة ${signerName}`,
    });
  }
  return updated ? mapContract(updated) : null;
}

export async function deleteContractRecord(ownerUid: string, id: number): Promise<boolean> {
  const deleted = await db
    .delete(contracts)
    .where(and(eq(contracts.id, id), eq(contracts.ownerUid, ownerUid)))
    .returning({ id: contracts.id });
  return deleted.length > 0;
}

export async function createDeadlineRecord(
  ownerUid: string,
  actorEmail: string,
  input: Omit<LegalDeadline, 'id' | 'createdAt'>,
): Promise<LegalDeadline> {
  const [inserted] = await db
    .insert(legalDeadlines)
    .values({
      ownerUid,
      caseId: input.caseId,
      title: input.title,
      judgmentDate: input.judgmentDate,
      deadlineType: input.deadlineType,
      statutoryDays: input.statutoryDays,
      dueDate: input.dueDate,
      notes: input.notes,
      status: input.status || 'active',
    })
    .returning();
  await appendAuditLog(ownerUid, {
    actorEmail,
    actionType: 'create',
    entityType: 'legal_deadline',
    entityLabel: input.title,
    details: `آخر موعد نظامي: ${input.dueDate}`,
  });
  return mapDeadline(inserted);
}

export async function updateDeadlineStatusRecord(
  ownerUid: string,
  id: number,
  status: 'active' | 'completed',
): Promise<LegalDeadline | null> {
  const [updated] = await db
    .update(legalDeadlines)
    .set({ status })
    .where(and(eq(legalDeadlines.id, id), eq(legalDeadlines.ownerUid, ownerUid)))
    .returning();
  return updated ? mapDeadline(updated) : null;
}

export async function deleteDeadlineRecord(ownerUid: string, id: number): Promise<boolean> {
  const deleted = await db
    .delete(legalDeadlines)
    .where(and(eq(legalDeadlines.id, id), eq(legalDeadlines.ownerUid, ownerUid)))
    .returning({ id: legalDeadlines.id });
  return deleted.length > 0;
}

export async function createDocumentVersionRecord(
  ownerUid: string,
  actorEmail: string,
  input: {
    caseId: number;
    procedureId: number | null;
    docGroupKey: string;
    fileName: string;
    fileMime: string;
    fileSize: number;
    plainData: string;
    notes: string;
  },
): Promise<DocumentVersion> {
  const [ownedCase] = await db
    .select({ id: cases.id })
    .from(cases)
    .where(and(eq(cases.id, input.caseId), eq(cases.ownerUid, ownerUid)));
  if (!ownedCase) throw new Error('القضية غير موجودة في مساحة العمل.');

  const existingVersions = await db
    .select({ id: documentVersions.id })
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.ownerUid, ownerUid),
        eq(documentVersions.caseId, input.caseId),
        eq(documentVersions.docGroupKey, input.docGroupKey),
      ),
    );
  const versionNumber = existingVersions.length + 1;
  const { cipherText, sha256 } = encryptVaultPayload(input.plainData);

  const [inserted] = await db
    .insert(documentVersions)
    .values({
      ownerUid,
      caseId: input.caseId,
      procedureId: input.procedureId,
      docGroupKey: input.docGroupKey,
      fileName: input.fileName,
      versionNumber,
      fileMime: input.fileMime,
      fileSize: input.fileSize,
      sha256Hash: sha256,
      encryptedData: cipherText,
      isEncrypted: true,
      shareToken: '',
      shareExpiresAt: '',
      uploadedBy: actorEmail,
      notes: input.notes,
    })
    .returning();

  await appendAuditLog(ownerUid, {
    actorEmail,
    actionType: 'create',
    entityType: 'vault_document',
    entityLabel: `${input.fileName} (v${versionNumber})`,
    details: `حفظ نسخة مشفرة SHA-256: ${sha256.slice(0, 12)}...`,
  });

  return mapDocVersion(inserted);
}

export async function getDecryptedDocumentRecord(
  ownerUid: string,
  id: number,
): Promise<{ fileName: string; fileMime: string; data: string } | null> {
  const [row] = await db
    .select()
    .from(documentVersions)
    .where(and(eq(documentVersions.id, id), eq(documentVersions.ownerUid, ownerUid)));
  if (!row) return null;
  return {
    fileName: row.fileName,
    fileMime: row.fileMime,
    data: decryptVaultPayload(row.encryptedData),
  };
}

export async function createDocumentShareToken(
  ownerUid: string,
  actorEmail: string,
  id: number,
  expiresInDays = 7,
): Promise<DocumentVersion | null> {
  const shareToken = crypto.randomBytes(16).toString('hex');
  const exp = new Date();
  exp.setUTCDate(exp.getUTCDate() + expiresInDays);
  const shareExpiresAt = exp.toISOString().slice(0, 10);
  const [updated] = await db
    .update(documentVersions)
    .set({ shareToken, shareExpiresAt })
    .where(and(eq(documentVersions.id, id), eq(documentVersions.ownerUid, ownerUid)))
    .returning();
  if (updated) {
    await appendAuditLog(ownerUid, {
      actorEmail,
      actionType: 'update',
      entityType: 'vault_document',
      entityLabel: `${updated.fileName} (v${updated.versionNumber})`,
      details: `إنشاء رابط مشاركة مؤقت حتى ${shareExpiresAt}`,
    });
  }
  return updated ? mapDocVersion(updated) : null;
}

export async function getSharedDocumentByToken(
  token: string,
): Promise<{ fileName: string; fileMime: string; sha256Hash: string; expiresAt: string; data: string } | null> {
  if (!token) return null;
  const [row] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.shareToken, token));
  if (!row) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (row.shareExpiresAt && row.shareExpiresAt < today) return null;
  return {
    fileName: row.fileName,
    fileMime: row.fileMime,
    sha256Hash: row.sha256Hash,
    expiresAt: row.shareExpiresAt,
    data: decryptVaultPayload(row.encryptedData),
  };
}

export async function createLawyerRecord(
  ownerUid: string,
  actorEmail: string,
  input: Omit<Lawyer, 'id'>,
): Promise<Lawyer> {
  const [inserted] = await db
    .insert(lawyers)
    .values({
      ownerUid,
      name: input.name,
      specialty: input.specialty,
      phone: input.phone,
      email: input.email,
      barNumber: input.barNumber,
      active: input.active,
    })
    .returning();
  await appendAuditLog(ownerUid, {
    actorEmail,
    actionType: 'create',
    entityType: 'lawyer',
    entityLabel: input.name,
    details: input.specialty,
  });
  return mapLawyer(inserted);
}

export async function deleteLawyerRecord(
  ownerUid: string,
  actorEmail: string,
  id: number,
): Promise<boolean> {
  const deleted = await db
    .delete(lawyers)
    .where(and(eq(lawyers.id, id), eq(lawyers.ownerUid, ownerUid)))
    .returning({ id: lawyers.id, name: lawyers.name });
  if (deleted.length > 0) {
    await appendAuditLog(ownerUid, {
      actorEmail,
      actionType: 'delete',
      entityType: 'lawyer',
      entityLabel: deleted[0].name,
      details: 'إزالة محامٍ من قائمة المكتب',
    });
  }
  return deleted.length > 0;
}

export async function createFirmMemberRecord(
  ownerUid: string,
  actorEmail: string,
  input: Omit<FirmMember, 'id' | 'createdAt'>,
): Promise<FirmMember> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const [inserted] = await db
    .insert(firmMembers)
    .values({
      ownerUid,
      email: normalizedEmail,
      fullName: input.fullName,
      role: input.role,
      permissions: input.permissions || DEFAULT_ROLE_PERMISSIONS[input.role],
      status: input.status || 'active',
    })
    .returning();
  await appendAuditLog(ownerUid, {
    actorEmail,
    actionType: 'create',
    entityType: 'firm_member',
    entityLabel: `${input.fullName} (${normalizedEmail})`,
    details: `منح صلاحية ${input.role}`,
  });
  return mapFirmMember(inserted);
}

export async function updateFirmMemberRecord(
  ownerUid: string,
  id: number,
  input: Partial<Pick<FirmMember, 'role' | 'permissions' | 'status'>>,
): Promise<FirmMember | null> {
  const patch: Partial<typeof firmMembers.$inferInsert> = {};
  if (input.role !== undefined) patch.role = input.role;
  if (input.permissions !== undefined) patch.permissions = input.permissions;
  if (input.status !== undefined) patch.status = input.status;
  const [updated] = await db
    .update(firmMembers)
    .set(patch)
    .where(and(eq(firmMembers.id, id), eq(firmMembers.ownerUid, ownerUid)))
    .returning();
  return updated ? mapFirmMember(updated) : null;
}

export async function deleteFirmMemberRecord(ownerUid: string, id: number): Promise<boolean> {
  const deleted = await db
    .delete(firmMembers)
    .where(and(eq(firmMembers.id, id), eq(firmMembers.ownerUid, ownerUid)))
    .returning({ id: firmMembers.id });
  return deleted.length > 0;
}

export async function updateSettingsRecord(
  ownerUid: string,
  actorEmail: string,
  input: Partial<OfficeSettings>,
): Promise<OfficeSettings> {
  const patch: Partial<typeof officeSettings.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.officeName !== undefined) patch.officeName = input.officeName;
  if (input.officeLogoUrl !== undefined) patch.officeLogoUrl = input.officeLogoUrl;
  if (input.officePhone !== undefined) patch.officePhone = input.officePhone;
  if (input.officeAddress !== undefined) patch.officeAddress = input.officeAddress;
  if (input.vatNumber !== undefined) patch.vatNumber = input.vatNumber;
  if (input.vatRate !== undefined) patch.vatRate = input.vatRate;
  if (input.autoNumberPrefix !== undefined) patch.autoNumberPrefix = input.autoNumberPrefix;
  if (input.autoNumberNext !== undefined) patch.autoNumberNext = input.autoNumberNext;
  if (input.clientNumberPrefix !== undefined) patch.clientNumberPrefix = input.clientNumberPrefix;
  if (input.reminderDaysBefore !== undefined) patch.reminderDaysBefore = input.reminderDaysBefore;
  if (input.requireHearingSource !== undefined) patch.requireHearingSource = input.requireHearingSource;
  if (input.whatsappEnabled !== undefined) patch.whatsappEnabled = input.whatsappEnabled;
  if (input.emailNotificationsEnabled !== undefined)
    patch.emailNotificationsEnabled = input.emailNotificationsEnabled;
  if (input.smsEnabled !== undefined) patch.smsEnabled = input.smsEnabled;
  if (input.najizAutoSync !== undefined) patch.najizAutoSync = input.najizAutoSync;
  if (input.calendarSyncProvider !== undefined)
    patch.calendarSyncProvider = input.calendarSyncProvider;
  if (input.caseTypes !== undefined) patch.caseTypes = input.caseTypes;
  if (input.courts !== undefined) patch.courts = input.courts;

  const [updated] = await db
    .update(officeSettings)
    .set(patch)
    .where(eq(officeSettings.ownerUid, ownerUid))
    .returning();

  await appendAuditLog(ownerUid, {
    actorEmail,
    actionType: 'update',
    entityType: 'settings',
    entityLabel: updated.officeName,
    details: 'تحديث إعدادات المكتب والفوترة والتنبيهات',
  });
  return mapSettings(updated);
}

export async function createNotificationRecord(
  ownerUid: string,
  input: Omit<NotificationItem, 'id' | 'sentAt'>,
): Promise<NotificationItem> {
  if (input.caseId) {
    const [ownedCase] = await db
      .select({ id: cases.id })
      .from(cases)
      .where(and(eq(cases.id, input.caseId), eq(cases.ownerUid, ownerUid)));
    if (!ownedCase) {
      throw new Error('القضية المرتبطة بالتنبيه غير موجودة داخل مساحة العمل.');
    }
  }
  const [inserted] = await db
    .insert(notificationsLog)
    .values({
      ownerUid,
      caseId: input.caseId,
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      channel: input.channel,
      message: input.message,
      status: input.status,
    })
    .returning();
  return mapNotification(inserted);
}
