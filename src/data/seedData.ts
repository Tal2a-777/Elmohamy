import type { WorkspaceState } from '../types/legal.ts';

export const DEFAULT_REFERENCE_DATE = new Date().toISOString().slice(0, 10);

export function createEmptyWorkspace(): WorkspaceState {
  return {
    settings: {
      officeName: 'مكتب المحاماة والاستشارات القانونية',
      officeLogoUrl: '',
      officePhone: '',
      officeAddress: '',
      vatNumber: '',
      vatRate: 15,
      autoNumberPrefix: 'CASE',
      autoNumberNext: 1,
      clientNumberPrefix: 'CL',
      reminderDaysBefore: 7,
      requireHearingSource: true,
      whatsappEnabled: true,
      emailNotificationsEnabled: true,
      smsEnabled: false,
      najizAutoSync: true,
      calendarSyncProvider: 'google',
      caseTypes: ['تجاري', 'عمالي', 'عقاري', 'مدني', 'أحوال شخصية', 'إداري', 'جزائي'],
      courts: [
        'المحكمة التجارية',
        'المحكمة العمالية',
        'المحكمة العامة',
        'ديوان المظالم - المحكمة الإدارية',
        'محكمة الأحوال الشخصية',
        'المحكمة الجزائية',
        'هيئة التحكيم التجاري',
      ],
    },
    lawyers: [],
    firmMembers: [],
    clients: [],
    cases: [],
    procedures: [],
    invoices: [],
    timeEntries: [],
    trustTransactions: [],
    contracts: [],
    deadlines: [],
    auditLogs: [],
    documentVersions: [],
    notifications: [],
  };
}

export function createSeedWorkspace(): WorkspaceState {
  return createEmptyWorkspace();
}
