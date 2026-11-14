import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { TeamPermissions } from '../types/legal.ts';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').default('').notNull(),
  role: text('role').default('admin').notNull(),
  linkedLawyerId: integer('linked_lawyer_id'),
  linkedClientId: integer('linked_client_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const officeSettings = pgTable('office_settings', {
  id: serial('id').primaryKey(),
  ownerUid: text('owner_uid').notNull().unique(),
  officeName: text('office_name').default('مكتب المحاماة والاستشارات القانونية').notNull(),
  officeLogoUrl: text('office_logo_url').default('').notNull(),
  officePhone: text('office_phone').default('').notNull(),
  officeAddress: text('office_address').default('').notNull(),
  vatNumber: text('vat_number').default('').notNull(),
  vatRate: integer('vat_rate').default(15).notNull(),
  autoNumberPrefix: text('auto_number_prefix').default('CASE').notNull(),
  autoNumberNext: integer('auto_number_next').default(1).notNull(),
  clientNumberPrefix: text('client_number_prefix').default('CL').notNull(),
  reminderDaysBefore: integer('reminder_days_before').default(7).notNull(),
  requireHearingSource: boolean('require_hearing_source').default(true).notNull(),
  whatsappEnabled: boolean('whatsapp_enabled').default(true).notNull(),
  emailNotificationsEnabled: boolean('email_notifications_enabled').default(true).notNull(),
  smsEnabled: boolean('sms_enabled').default(false).notNull(),
  najizAutoSync: boolean('najiz_auto_sync').default(true).notNull(),
  calendarSyncProvider: text('calendar_sync_provider').default('google').notNull(),
  caseTypes: jsonb('case_types')
    .$type<string[]>()
    .default(['تجاري', 'عمالي', 'عقاري', 'مدني', 'أحوال شخصية', 'إداري', 'جزائي'])
    .notNull(),
  courts: jsonb('courts')
    .$type<string[]>()
    .default([
      'المحكمة التجارية',
      'المحكمة العمالية',
      'المحكمة العامة',
      'ديوان المظالم - المحكمة الإدارية',
      'محكمة الأحوال الشخصية',
      'المحكمة الجزائية',
      'هيئة التحكيم التجاري',
    ])
    .notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const lawyers = pgTable('lawyers', {
  id: serial('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  name: text('name').notNull(),
  specialty: text('specialty').default('قانون عام').notNull(),
  phone: text('phone').default('').notNull(),
  email: text('email').default('').notNull(),
  barNumber: text('bar_number').default('').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const firmMembers = pgTable('firm_members', {
  id: serial('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').default('lawyer').notNull(),
  permissions: jsonb('permissions')
    .$type<TeamPermissions>()
    .default({
      canViewCases: true,
      canEditCases: true,
      canDeleteRecords: false,
      canManageBilling: false,
      canManageSettings: false,
      canViewAudit: false,
    })
    .notNull(),
  status: text('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  clientCode: text('client_code').notNull(),
  name: text('name').notNull(),
  clientType: text('client_type').default('individual').notNull(),
  nationalOrRegId: text('national_or_reg_id').default('').notNull(),
  phone: text('phone').notNull(),
  email: text('email').default('').notNull(),
  address: text('address').default('').notNull(),
  accountStatus: text('account_status').default('active').notNull(),
  notes: text('notes').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const cases = pgTable('cases', {
  id: serial('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  caseCode: text('case_code').notNull(),
  officialNumber: text('official_number').notNull(),
  caseYear: integer('case_year').notNull(),
  subject: text('subject').notNull(),
  caseType: text('case_type').notNull(),
  clientId: integer('client_id')
    .references(() => clients.id, { onDelete: 'cascade' })
    .notNull(),
  clientRole: text('client_role').default('plaintiff').notNull(),
  opponentName: text('opponent_name').notNull(),
  lawyerId: integer('lawyer_id').references(() => lawyers.id, { onDelete: 'set null' }),
  lawyerName: text('lawyer_name').notNull(),
  courtName: text('court_name').notNull(),
  status: text('status').default('active').notNull(),
  folderUrl: text('folder_url').default('').notNull(),
  notes: text('notes').default('').notNull(),
  nextHearingDate: text('next_hearing_date').default('').notNull(),
  najizStatus: text('najiz_status').default('').notNull(),
  najizCircuit: text('najiz_circuit').default('').notNull(),
  lastSyncedAt: text('last_synced_at').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const procedures = pgTable('procedures', {
  id: serial('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  caseId: integer('case_id')
    .references(() => cases.id, { onDelete: 'cascade' })
    .notNull(),
  procedureDate: text('procedure_date').notNull(),
  procedureType: text('procedure_type').default('hearing').notNull(),
  description: text('description').notNull(),
  executorName: text('executor_name').notNull(),
  outcome: text('outcome').default('').notNull(),
  nextActionDate: text('next_action_date').default('').notNull(),
  attachmentName: text('attachment_name').default('').notNull(),
  attachmentMime: text('attachment_mime').default('').notNull(),
  attachmentSize: integer('attachment_size').default(0).notNull(),
  attachmentText: text('attachment_text').default('').notNull(),
  attachmentData: text('attachment_data').default('').notNull(),
  visibleToClient: boolean('visible_to_client').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  invoiceNumber: text('invoice_number').notNull(),
  caseId: integer('case_id')
    .references(() => cases.id, { onDelete: 'cascade' })
    .notNull(),
  clientId: integer('client_id')
    .references(() => clients.id, { onDelete: 'cascade' })
    .notNull(),
  description: text('description').notNull(),
  feeAmount: numeric('fee_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  expensesAmount: numeric('expenses_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  vatRate: numeric('vat_rate', { precision: 5, scale: 2 }).default('15').notNull(),
  vatAmount: numeric('vat_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  invoiceType: text('invoice_type').default('tax_invoice').notNull(),
  zatcaQr: text('zatca_qr').default('').notNull(),
  status: text('status').default('unpaid').notNull(),
  issuedDate: text('issued_date').notNull(),
  dueDate: text('due_date').notNull(),
  notes: text('notes').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const timeEntries = pgTable('time_entries', {
  id: serial('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  caseId: integer('case_id')
    .references(() => cases.id, { onDelete: 'cascade' })
    .notNull(),
  lawyerName: text('lawyer_name').notNull(),
  hours: numeric('hours', { precision: 8, scale: 2 }).default('1').notNull(),
  hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }).default('500').notNull(),
  billable: boolean('billable').default(true).notNull(),
  invoiced: boolean('invoiced').default(false).notNull(),
  description: text('description').notNull(),
  entryDate: text('entry_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const trustTransactions = pgTable('trust_transactions', {
  id: serial('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  clientId: integer('client_id')
    .references(() => clients.id, { onDelete: 'cascade' })
    .notNull(),
  caseId: integer('case_id').references(() => cases.id, { onDelete: 'set null' }),
  txType: text('tx_type').default('deposit').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).default('0').notNull(),
  description: text('description').notNull(),
  referenceNo: text('reference_no').default('').notNull(),
  txDate: text('tx_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contracts = pgTable('contracts', {
  id: serial('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  caseId: integer('case_id').references(() => cases.id, { onDelete: 'set null' }),
  clientId: integer('client_id')
    .references(() => clients.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  contractType: text('contract_type').default('fee_agreement').notNull(),
  content: text('content').notNull(),
  feeTerms: text('fee_terms').default('').notNull(),
  signToken: text('sign_token').notNull(),
  status: text('status').default('pending_signature').notNull(),
  signerName: text('signer_name').default('').notNull(),
  signatureDataUrl: text('signature_data_url').default('').notNull(),
  signedAt: text('signed_at').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const legalDeadlines = pgTable('legal_deadlines', {
  id: serial('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  caseId: integer('case_id').references(() => cases.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  judgmentDate: text('judgment_date').notNull(),
  deadlineType: text('deadline_type').notNull(),
  statutoryDays: integer('statutory_days').default(30).notNull(),
  dueDate: text('due_date').notNull(),
  notes: text('notes').default('').notNull(),
  status: text('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  actorEmail: text('actor_email').notNull(),
  actorRole: text('actor_role').default('admin').notNull(),
  actionType: text('action_type').notNull(),
  entityType: text('entity_type').notNull(),
  entityLabel: text('entity_label').default('').notNull(),
  details: text('details').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const documentVersions = pgTable('document_versions', {
  id: serial('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  caseId: integer('case_id')
    .references(() => cases.id, { onDelete: 'cascade' })
    .notNull(),
  procedureId: integer('procedure_id').references(() => procedures.id, { onDelete: 'set null' }),
  docGroupKey: text('doc_group_key').notNull(),
  fileName: text('file_name').notNull(),
  versionNumber: integer('version_number').default(1).notNull(),
  fileMime: text('file_mime').default('application/octet-stream').notNull(),
  fileSize: integer('file_size').default(0).notNull(),
  sha256Hash: text('sha256_hash').default('').notNull(),
  encryptedData: text('encrypted_data').default('').notNull(),
  isEncrypted: boolean('is_encrypted').default(true).notNull(),
  shareToken: text('share_token').default('').notNull(),
  shareExpiresAt: text('share_expires_at').default('').notNull(),
  uploadedBy: text('uploaded_by').default('').notNull(),
  notes: text('notes').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notificationsLog = pgTable('notifications_log', {
  id: serial('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  caseId: integer('case_id').references(() => cases.id, { onDelete: 'set null' }),
  recipientName: text('recipient_name').notNull(),
  recipientPhone: text('recipient_phone').default('').notNull(),
  channel: text('channel').default('whatsapp').notNull(),
  message: text('message').notNull(),
  status: text('status').default('sent').notNull(),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
});

export const clientsRelations = relations(clients, ({ many }) => ({
  cases: many(cases),
  invoices: many(invoices),
  contracts: many(contracts),
  trustTransactions: many(trustTransactions),
}));

export const lawyersRelations = relations(lawyers, ({ many }) => ({
  cases: many(cases),
}));

export const casesRelations = relations(cases, ({ one, many }) => ({
  client: one(clients, {
    fields: [cases.clientId],
    references: [clients.id],
  }),
  lawyer: one(lawyers, {
    fields: [cases.lawyerId],
    references: [lawyers.id],
  }),
  procedures: many(procedures),
  invoices: many(invoices),
  timeEntries: many(timeEntries),
  documentVersions: many(documentVersions),
}));

export const proceduresRelations = relations(procedures, ({ one }) => ({
  legalCase: one(cases, {
    fields: [procedures.caseId],
    references: [cases.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  legalCase: one(cases, {
    fields: [invoices.caseId],
    references: [cases.id],
  }),
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
}));
