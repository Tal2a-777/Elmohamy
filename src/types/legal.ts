export type UserRole = 'admin' | 'lawyer' | 'secretary' | 'accountant' | 'client';

export type NavTab =
  | 'dashboard'
  | 'clients'
  | 'cases'
  | 'new-case'
  | 'procedures'
  | 'tools'
  | 'billing'
  | 'reports'
  | 'audit'
  | 'settings'
  | 'guide';

export type ClientType = 'individual' | 'entity';
export type AccountStatus = 'active' | 'suspended' | 'closed';
export type CaseStatus = 'active' | 'closed' | 'suspended';
export type ClientRoleInCase = 'plaintiff' | 'defendant';
export type ProcedureType = 'hearing' | 'review' | 'receipt' | 'filing';
export type InvoiceStatus = 'paid' | 'partial' | 'unpaid';
export type InvoiceType = 'tax_invoice' | 'credit_note' | 'debit_note';

export interface Lawyer {
  id: number;
  name: string;
  specialty: string;
  phone: string;
  email: string;
  barNumber: string;
  active: boolean;
}

export interface TeamPermissions {
  canViewCases: boolean;
  canEditCases: boolean;
  canDeleteRecords: boolean;
  canManageBilling: boolean;
  canManageSettings: boolean;
  canViewAudit: boolean;
}

export interface FirmMember {
  id: number;
  email: string;
  fullName: string;
  role: 'admin' | 'lawyer' | 'secretary' | 'accountant';
  permissions: TeamPermissions;
  status: 'active' | 'invited' | 'disabled';
  createdAt: string;
}

export interface Client {
  id: number;
  clientCode: string;
  name: string;
  clientType: ClientType;
  nationalOrRegId: string;
  phone: string;
  email: string;
  address: string;
  accountStatus: AccountStatus;
  notes: string;
  createdAt: string;
}

export interface LegalCase {
  id: number;
  caseCode: string;
  officialNumber: string;
  caseYear: number;
  subject: string;
  caseType: string;
  clientId: number;
  clientRole: ClientRoleInCase;
  opponentName: string;
  lawyerId: number | null;
  lawyerName: string;
  courtName: string;
  status: CaseStatus;
  folderUrl: string;
  notes: string;
  nextHearingDate: string;
  najizStatus?: string;
  najizCircuit?: string;
  lastSyncedAt?: string;
  createdAt: string;
}

export interface Procedure {
  id: number;
  caseId: number;
  procedureDate: string;
  procedureType: ProcedureType;
  description: string;
  executorName: string;
  outcome: string;
  nextActionDate: string;
  attachmentName: string;
  attachmentMime: string;
  attachmentSize: number;
  attachmentText: string;
  attachmentData: string;
  visibleToClient: boolean;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  caseId: number;
  clientId: number;
  description: string;
  feeAmount: number;
  expensesAmount: number;
  vatRate: number;
  vatAmount: number;
  paidAmount: number;
  invoiceType: InvoiceType;
  zatcaQr: string;
  status: InvoiceStatus;
  issuedDate: string;
  dueDate: string;
  notes: string;
}

export interface TimeEntry {
  id: number;
  caseId: number;
  lawyerName: string;
  hours: number;
  hourlyRate: number;
  billable: boolean;
  invoiced: boolean;
  description: string;
  entryDate: string;
}

export interface TrustTransaction {
  id: number;
  clientId: number;
  caseId: number | null;
  txType: 'deposit' | 'deduction' | 'refund';
  amount: number;
  description: string;
  referenceNo: string;
  txDate: string;
}

export interface LegalContract {
  id: number;
  caseId: number | null;
  clientId: number;
  title: string;
  contractType: 'fee_agreement' | 'poa' | 'settlement';
  content: string;
  feeTerms: string;
  signToken: string;
  status: 'draft' | 'pending_signature' | 'signed';
  signerName: string;
  signatureDataUrl: string;
  signedAt: string;
  createdAt: string;
}

export interface LegalDeadline {
  id: number;
  caseId: number | null;
  title: string;
  judgmentDate: string;
  deadlineType: string;
  statutoryDays: number;
  dueDate: string;
  notes: string;
  status: 'active' | 'completed';
  createdAt: string;
}

export interface AuditLogEntry {
  id: number;
  actorEmail: string;
  actorRole: string;
  actionType: string;
  entityType: string;
  entityLabel: string;
  details: string;
  createdAt: string;
}

export interface DocumentVersion {
  id: number;
  caseId: number;
  procedureId: number | null;
  docGroupKey: string;
  fileName: string;
  versionNumber: number;
  fileMime: string;
  fileSize: number;
  sha256Hash: string;
  encryptedData: string;
  isEncrypted: boolean;
  shareToken: string;
  shareExpiresAt: string;
  uploadedBy: string;
  notes: string;
  createdAt: string;
}

export interface NotificationItem {
  id: number;
  caseId: number | null;
  recipientName: string;
  recipientPhone: string;
  channel: 'whatsapp' | 'email' | 'sms';
  message: string;
  status: 'sent' | 'scheduled';
  sentAt: string;
}

export interface OfficeSettings {
  officeName: string;
  officeLogoUrl: string;
  officePhone: string;
  officeAddress: string;
  vatNumber: string;
  vatRate: number;
  autoNumberPrefix: string;
  autoNumberNext: number;
  clientNumberPrefix?: string;
  reminderDaysBefore: number;
  requireHearingSource?: boolean;
  whatsappEnabled: boolean;
  emailNotificationsEnabled: boolean;
  smsEnabled: boolean;
  najizAutoSync: boolean;
  calendarSyncProvider: 'google' | 'outlook';
  caseTypes: string[];
  courts: string[];
}

export interface WorkspaceState {
  settings: OfficeSettings;
  lawyers: Lawyer[];
  firmMembers: FirmMember[];
  clients: Client[];
  cases: LegalCase[];
  procedures: Procedure[];
  invoices: Invoice[];
  timeEntries: TimeEntry[];
  trustTransactions: TrustTransaction[];
  contracts: LegalContract[];
  deadlines: LegalDeadline[];
  auditLogs: AuditLogEntry[];
  documentVersions: DocumentVersion[];
  notifications: NotificationItem[];
}
