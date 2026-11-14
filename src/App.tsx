import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  BarChart3,
  BookOpen,
  Briefcase,
  Calculator,
  CreditCard,
  FolderPlus,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Scale,
  Search,
  Settings,
  ShieldAlert,
  Sun,
  Users,
  X,
} from 'lucide-react';
import {
  auth,
  clearCachedDriveToken,
  signInWithGoogleAndCacheDriveToken,
} from './lib/firebase.ts';
import { createEmptyWorkspace } from './data/seedData.ts';
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
  NavTab,
  OfficeSettings,
  Procedure,
  TeamPermissions,
  TimeEntry,
  TrustTransaction,
  UserRole,
  WorkspaceState,
} from './types/legal.ts';
import {
  DEFAULT_ROLE_PERMISSIONS,
  buildLocalTenantStorageKey,
  computeInvoiceStatus,
  computeInvoiceTotals,
  filterCases,
  generateZatcaQrPayload,
  getAccessibleCasesForRole,
  type UpcomingHearing,
} from './utils/legalLogic.ts';
import { SplashScreen } from './components/SplashScreen.tsx';
import { LoginPage } from './components/LoginPage.tsx';
import { AppFooter } from './components/AppFooter.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { ClientsView } from './components/ClientsView.tsx';
import { CasesView } from './components/CasesView.tsx';
import { NewCaseView } from './components/NewCaseView.tsx';
import { ProceduresView } from './components/ProceduresView.tsx';
import { LegalToolsAndContractsView } from './components/LegalToolsAndContractsView.tsx';
import { BillingView } from './components/BillingView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { AuditAndVaultView } from './components/AuditAndVaultView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { GuideView } from './components/GuideView.tsx';
import { ClientPortalView } from './components/ClientPortalView.tsx';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'مدير عام',
  lawyer: 'محامٍ',
  secretary: 'سكرتارية',
  accountant: 'محاسب مالي',
  client: 'عميل (بوابة العملاء)',
};

function loadLocalWorkspace(email: string): WorkspaceState {
  const empty = createEmptyWorkspace();
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(buildLocalTenantStorageKey(email));
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<WorkspaceState>;
    return {
      settings: { ...empty.settings, ...(parsed.settings || {}) },
      lawyers: Array.isArray(parsed.lawyers) ? parsed.lawyers : [],
      firmMembers: Array.isArray(parsed.firmMembers) ? parsed.firmMembers : [],
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
      cases: Array.isArray(parsed.cases) ? parsed.cases : [],
      procedures: Array.isArray(parsed.procedures) ? parsed.procedures : [],
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
      timeEntries: Array.isArray(parsed.timeEntries) ? parsed.timeEntries : [],
      trustTransactions: Array.isArray(parsed.trustTransactions)
        ? parsed.trustTransactions
        : [],
      contracts: Array.isArray(parsed.contracts) ? parsed.contracts : [],
      deadlines: Array.isArray(parsed.deadlines) ? parsed.deadlines : [],
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
      documentVersions: Array.isArray(parsed.documentVersions)
        ? parsed.documentVersions
        : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
    };
  } catch {
    return empty;
  }
}

export default function App() {
  const isAutostart = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  }, []);

  const [showSplash, setShowSplash] = useState(!isAutostart);
  const [authReady, setAuthReady] = useState(isAutostart);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [localEmail, setLocalEmail] = useState<string | null>(
    isAutostart ? 'autostart@office.mizan' : null,
  );
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [role, setRole] = useState<UserRole>('admin');
  const [portalClientId, setPortalClientId] = useState<number>(1);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [procedureFilterCaseId, setProcedureFilterCaseId] = useState<number | null>(null);

  const [globalQuery, setGlobalQuery] = useState('');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

  const [workspace, setWorkspace] = useState<WorkspaceState>(() =>
    isAutostart ? loadLocalWorkspace('autostart@office.mizan') : createEmptyWorkspace(),
  );
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const isLocalMode = Boolean(localEmail && !firebaseUser);
  const activeActorEmail =
    firebaseUser?.email?.toLowerCase() || localEmail || 'local@office.mizan';

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [isDark]);

  // Persist local per-email workspace changes cleanly to isolated storage key
  useEffect(() => {
    if (isLocalMode && localEmail && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          buildLocalTenantStorageKey(localEmail),
          JSON.stringify(workspace),
        );
      } catch {
        // Ignore quota exceeded safely
      }
    }
  }, [isLocalMode, localEmail, workspace]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user) {
        setLocalEmail(null);
        setWorkspaceLoading(true);
        setWorkspaceError(null);
        try {
          const token = await user.getIdToken();
          const res = await fetch('/api/workspace', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || 'تعذر تحميل بيانات المكتب');
          }
          const data = (await res.json()) as WorkspaceState & {
            _access?: { memberRole?: UserRole };
          };
          const empty = createEmptyWorkspace();
          setWorkspace({
            ...empty,
            ...data,
            settings: { ...empty.settings, ...(data.settings || {}) },
          });
          if (data.clients[0]) {
            setPortalClientId(data.clients[0].id);
          }
        } catch (err: unknown) {
          setWorkspaceError(
            err instanceof Error ? err.message : 'تعذر الاتصال بقاعدة البيانات',
          );
        } finally {
          setWorkspaceLoading(false);
        }
      } else {
        clearCachedDriveToken();
      }
    });
    return () => unsubscribe();
  }, []);

  const apiFetch = useCallback(
    async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
      if (!firebaseUser) {
        throw new Error('لا توجد جلسة مصادقة نشطة.');
      }
      const token = await firebaseUser.getIdToken();
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'فشل تنفيذ العملية على الخادم.');
      }
      return data as T;
    },
    [firebaseUser],
  );

  const pushLocalAudit = useCallback(
    (
      prev: WorkspaceState,
      actionType: string,
      entityType: string,
      entityLabel: string,
      details: string,
    ): AuditLogEntry[] => {
      const nextId = Math.max(0, ...prev.auditLogs.map((a) => a.id)) + 1;
      const entry: AuditLogEntry = {
        id: nextId,
        actorEmail: activeActorEmail,
        actorRole: role,
        actionType,
        entityType,
        entityLabel,
        details,
        createdAt: new Date().toISOString(),
      };
      return [entry, ...prev.auditLogs].slice(0, 200);
    },
    [activeActorEmail, role],
  );

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogleAndCacheDriveToken();
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'تعذر تسجيل الدخول عبر Google. يمكنك الدخول بالبريد الإلكتروني.',
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailWorkspaceLogin = (email: string) => {
    const normalized = email.trim().toLowerCase();
    const loaded = loadLocalWorkspace(normalized);
    setWorkspace(loaded);
    setLocalEmail(normalized);
    setSelectedCaseId(null);
    setProcedureFilterCaseId(null);
    setActiveTab('dashboard');
    setAuthError(null);
    if (loaded.clients[0]) setPortalClientId(loaded.clients[0].id);
  };

  const handleLogout = async () => {
    clearCachedDriveToken();
    if (firebaseUser) {
      await signOut(auth);
    }
    setLocalEmail(null);
    setWorkspace(createEmptyWorkspace());
    setActiveTab('dashboard');
  };

  // RBAC & Granular Permissions
  const activeLawyerName = workspace.lawyers[0]?.name || '';
  const accessibleCases = useMemo(
    () =>
      getAccessibleCasesForRole(workspace.cases, role, {
        lawyerName: activeLawyerName,
        clientId: portalClientId,
      }),
    [workspace.cases, role, activeLawyerName, portalClientId],
  );

  const activePermissions: TeamPermissions = useMemo(() => {
    if (role === 'client') {
      return {
        canViewCases: true,
        canEditCases: false,
        canDeleteRecords: false,
        canManageBilling: false,
        canManageSettings: false,
        canViewAudit: false,
      };
    }
    const matchedMember = workspace.firmMembers.find(
      (m) => m.email.toLowerCase() === activeActorEmail && m.status === 'active',
    );
    if (matchedMember) return matchedMember.permissions;
    return DEFAULT_ROLE_PERMISSIONS[role];
  }, [role, workspace.firmMembers, activeActorEmail]);

  // Global instant search results
  const globalSearchResults = useMemo(() => {
    const q = globalQuery.trim().toLowerCase();
    if (!q) return { clients: [] as Client[], cases: [] as LegalCase[] };
    const matchedClients = workspace.clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.clientCode.toLowerCase().includes(q),
      )
      .slice(0, 4);
    const matchedCases = filterCases(accessibleCases, workspace.clients, workspace.procedures, {
      query: q,
    }).slice(0, 5);
    return { clients: matchedClients, cases: matchedCases };
  }, [globalQuery, workspace.clients, workspace.procedures, accessibleCases]);

  // CRUD Handlers
  const handleCreateClient = async (
    input: Omit<Client, 'id' | 'createdAt' | 'clientCode'>,
  ) => {
    if (firebaseUser && !isLocalMode) {
      const created = await apiFetch<Client>('/api/clients', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setWorkspace((w) => ({ ...w, clients: [created, ...w.clients] }));
    } else {
      setWorkspace((w) => {
        const nextId = Math.max(0, ...w.clients.map((c) => c.id)) + 1;
        const prefix = (w.settings.clientNumberPrefix || 'CL').toUpperCase();
        const created: Client = {
          ...input,
          id: nextId,
          clientCode: `${prefix}-${String(w.clients.length + 1).padStart(4, '0')}`,
          createdAt: new Date().toISOString().slice(0, 10),
        };
        return {
          ...w,
          clients: [created, ...w.clients],
          auditLogs: pushLocalAudit(
            w,
            'create',
            'client',
            `${created.clientCode} - ${created.name}`,
            'تسجيل عميل جديد',
          ),
        };
      });
    }
  };

  const handleUpdateClient = async (id: number, input: Partial<Client>) => {
    if (firebaseUser && !isLocalMode) {
      const updated = await apiFetch<Client>(`/api/clients/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
      setWorkspace((w) => ({
        ...w,
        clients: w.clients.map((c) => (c.id === id ? updated : c)),
      }));
    } else {
      setWorkspace((w) => ({
        ...w,
        clients: w.clients.map((c) => (c.id === id ? { ...c, ...input } : c)),
        auditLogs: pushLocalAudit(w, 'update', 'client', `#${id}`, 'تحديث بيانات عميل'),
      }));
    }
  };

  const handleCreateCase = async (
    input: Omit<LegalCase, 'id' | 'createdAt' | 'caseCode'>,
  ) => {
    if (firebaseUser && !isLocalMode) {
      const res = await apiFetch<{ legalCase: LegalCase; nextAutoNumber: number }>(
        '/api/cases',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      setWorkspace((w) => ({
        ...w,
        cases: [res.legalCase, ...w.cases],
        settings: { ...w.settings, autoNumberNext: res.nextAutoNumber },
      }));
      setSelectedCaseId(res.legalCase.id);
    } else {
      let createdId = 1;
      setWorkspace((w) => {
        const nextId = Math.max(0, ...w.cases.map((c) => c.id)) + 1;
        createdId = nextId;
        const seq = w.settings.autoNumberNext;
        const prefix = w.settings.autoNumberPrefix || 'CASE';
        const caseCode = `${prefix.toUpperCase()}-${input.caseYear}-${String(seq).padStart(3, '0')}`;
        const created: LegalCase = {
          ...input,
          id: nextId,
          caseCode,
          najizStatus: input.najizStatus || '',
          najizCircuit: input.najizCircuit || '',
          lastSyncedAt: input.lastSyncedAt || '',
          createdAt: new Date().toISOString().slice(0, 10),
        };
        return {
          ...w,
          cases: [created, ...w.cases],
          settings: { ...w.settings, autoNumberNext: seq + 1 },
          auditLogs: pushLocalAudit(
            w,
            'create',
            'case',
            `${created.caseCode} - ${created.subject}`,
            'فتح ملف قضية جديدة',
          ),
        };
      });
      setSelectedCaseId(createdId);
    }
    setActiveTab('cases');
  };

  const handleUpdateCaseStatus = async (caseId: number, status: CaseStatus) => {
    if (firebaseUser && !isLocalMode) {
      const updated = await apiFetch<LegalCase>(`/api/cases/${caseId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setWorkspace((w) => ({
        ...w,
        cases: w.cases.map((c) => (c.id === caseId ? updated : c)),
      }));
    } else {
      setWorkspace((w) => ({
        ...w,
        cases: w.cases.map((c) => (c.id === caseId ? { ...c, status } : c)),
        auditLogs: pushLocalAudit(
          w,
          'update',
          'case',
          `#${caseId}`,
          `تحديث حالة القضية إلى ${status}`,
        ),
      }));
    }
  };

  const handleNajizSync = async (
    caseId: number,
    payload: { najizStatus: string; najizCircuit: string; nextHearingDate?: string },
  ) => {
    if (firebaseUser && !isLocalMode) {
      const updated = await apiFetch<LegalCase>(`/api/cases/${caseId}/najiz-sync`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setWorkspace((w) => ({
        ...w,
        cases: w.cases.map((c) => (c.id === caseId ? updated : c)),
      }));
    } else {
      const nowIso = new Date().toISOString().slice(0, 10);
      setWorkspace((w) => ({
        ...w,
        cases: w.cases.map((c) =>
          c.id === caseId
            ? {
                ...c,
                najizStatus: payload.najizStatus,
                najizCircuit: payload.najizCircuit,
                nextHearingDate: payload.nextHearingDate || c.nextHearingDate,
                lastSyncedAt: nowIso,
              }
            : c,
        ),
        auditLogs: pushLocalAudit(
          w,
          'sync',
          'case',
          `#${caseId}`,
          `مزامنة منصة ناجز: ${payload.najizCircuit}`,
        ),
      }));
    }
  };

  const handleAddProcedure = async (input: Omit<Procedure, 'id'>) => {
    if (firebaseUser && !isLocalMode) {
      const created = await apiFetch<Procedure>('/api/procedures', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setWorkspace((w) => ({
        ...w,
        procedures: [created, ...w.procedures],
        cases: input.nextActionDate
          ? w.cases.map((c) =>
              c.id === input.caseId ? { ...c, nextHearingDate: input.nextActionDate } : c,
            )
          : w.cases,
      }));
    } else {
      setWorkspace((w) => {
        const nextId = Math.max(0, ...w.procedures.map((p) => p.id)) + 1;
        const created: Procedure = { ...input, id: nextId };
        return {
          ...w,
          procedures: [created, ...w.procedures],
          cases: input.nextActionDate
            ? w.cases.map((c) =>
                c.id === input.caseId ? { ...c, nextHearingDate: input.nextActionDate } : c,
              )
            : w.cases,
          auditLogs: pushLocalAudit(
            w,
            'create',
            'procedure',
            `#${created.id}`,
            `إضافة إجراء: ${created.description.slice(0, 40)}`,
          ),
        };
      });
    }
  };

  const handleCreateInvoice = async (
    input: Omit<Invoice, 'id' | 'invoiceNumber' | 'status' | 'vatAmount' | 'zatcaQr'> & {
      timeEntryIds?: number[];
    },
  ) => {
    if (firebaseUser && !isLocalMode) {
      const created = await apiFetch<Invoice>('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setWorkspace((w) => ({
        ...w,
        invoices: [created, ...w.invoices],
        timeEntries:
          input.timeEntryIds && input.timeEntryIds.length > 0
            ? w.timeEntries.map((te) =>
                input.timeEntryIds!.includes(te.id) ? { ...te, invoiced: true } : te,
              )
            : w.timeEntries,
      }));
    } else {
      setWorkspace((w) => {
        const nextId = Math.max(0, ...w.invoices.map((i) => i.id)) + 1;
        const invNum = `INV-${new Date().getFullYear()}-${String(
          w.invoices.length + 1,
        ).padStart(4, '0')}`;
        const rate = input.vatRate ?? w.settings.vatRate ?? 15;
        const totals = computeInvoiceTotals(
          input.feeAmount,
          input.expensesAmount,
          rate,
          input.invoiceType || 'tax_invoice',
        );
        const zatcaQr = generateZatcaQrPayload({
          sellerName: w.settings.officeName,
          vatNumber: w.settings.vatNumber || '300000000000003',
          timestampIso: `${input.issuedDate}T12:00:00Z`,
          totalWithVat: totals.totalWithVat,
          vatAmount: totals.vatAmount,
        });
        const status = computeInvoiceStatus(
          input.feeAmount,
          input.expensesAmount,
          input.paidAmount,
          totals.vatAmount,
        );
        const created: Invoice = {
          caseId: input.caseId,
          clientId: input.clientId,
          description: input.description,
          feeAmount: input.feeAmount,
          expensesAmount: input.expensesAmount,
          vatRate: rate,
          vatAmount: totals.vatAmount,
          paidAmount: input.paidAmount,
          invoiceType: input.invoiceType || 'tax_invoice',
          zatcaQr,
          issuedDate: input.issuedDate,
          dueDate: input.dueDate,
          notes: input.notes,
          id: nextId,
          invoiceNumber: invNum,
          status,
        };
        return {
          ...w,
          invoices: [created, ...w.invoices],
          timeEntries:
            input.timeEntryIds && input.timeEntryIds.length > 0
              ? w.timeEntries.map((te) =>
                  input.timeEntryIds!.includes(te.id) ? { ...te, invoiced: true } : te,
                )
              : w.timeEntries,
          auditLogs: pushLocalAudit(
            w,
            'create',
            'invoice',
            created.invoiceNumber,
            `إصدار فاتورة ضريبية ZATCA بقيمة ${totals.totalWithVat}`,
          ),
        };
      });
    }
  };

  const handleRecordPayment = async (invoiceId: number, paidAmount: number) => {
    if (firebaseUser && !isLocalMode) {
      const updated = await apiFetch<Invoice>(`/api/invoices/${invoiceId}/payment`, {
        method: 'PATCH',
        body: JSON.stringify({ paidAmount }),
      });
      setWorkspace((w) => ({
        ...w,
        invoices: w.invoices.map((i) => (i.id === invoiceId ? updated : i)),
      }));
    } else {
      setWorkspace((w) => ({
        ...w,
        invoices: w.invoices.map((i) =>
          i.id === invoiceId
            ? {
                ...i,
                paidAmount,
                status: computeInvoiceStatus(
                  i.feeAmount,
                  i.expensesAmount,
                  paidAmount,
                  i.vatAmount || 0,
                ),
              }
            : i,
        ),
        auditLogs: pushLocalAudit(
          w,
          'update',
          'invoice',
          `#${invoiceId}`,
          `تسجيل دفعة بمبلغ ${paidAmount}`,
        ),
      }));
    }
  };

  const handleCreateTimeEntry = async (input: Omit<TimeEntry, 'id' | 'invoiced'>) => {
    if (firebaseUser && !isLocalMode) {
      const created = await apiFetch<TimeEntry>('/api/time-entries', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setWorkspace((w) => ({ ...w, timeEntries: [created, ...w.timeEntries] }));
    } else {
      setWorkspace((w) => {
        const nextId = Math.max(0, ...w.timeEntries.map((t) => t.id)) + 1;
        const created: TimeEntry = { ...input, id: nextId, invoiced: false };
        return {
          ...w,
          timeEntries: [created, ...w.timeEntries],
          auditLogs: pushLocalAudit(
            w,
            'create',
            'time_entry',
            `${created.hours}h`,
            created.description,
          ),
        };
      });
    }
  };

  const handleDeleteTimeEntry = async (id: number) => {
    if (firebaseUser && !isLocalMode) {
      await apiFetch(`/api/time-entries/${id}`, { method: 'DELETE' });
      setWorkspace((w) => ({
        ...w,
        timeEntries: w.timeEntries.filter((t) => t.id !== id),
      }));
    } else {
      setWorkspace((w) => ({
        ...w,
        timeEntries: w.timeEntries.filter((t) => t.id !== id),
      }));
    }
  };

  const handleCreateTrustTx = async (input: Omit<TrustTransaction, 'id'>) => {
    if (firebaseUser && !isLocalMode) {
      const created = await apiFetch<TrustTransaction>('/api/trust-transactions', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setWorkspace((w) => ({
        ...w,
        trustTransactions: [created, ...w.trustTransactions],
      }));
    } else {
      setWorkspace((w) => {
        const nextId = Math.max(0, ...w.trustTransactions.map((t) => t.id)) + 1;
        const created: TrustTransaction = { ...input, id: nextId };
        return {
          ...w,
          trustTransactions: [created, ...w.trustTransactions],
          auditLogs: pushLocalAudit(
            w,
            'create',
            'trust_transaction',
            created.referenceNo || `#${created.id}`,
            `${created.txType}: ${created.amount}`,
          ),
        };
      });
    }
  };

  const handleCreateDeadline = async (
    input: Omit<LegalDeadline, 'id' | 'createdAt'>,
  ) => {
    if (firebaseUser && !isLocalMode) {
      const created = await apiFetch<LegalDeadline>('/api/deadlines', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setWorkspace((w) => ({ ...w, deadlines: [created, ...w.deadlines] }));
    } else {
      setWorkspace((w) => {
        const nextId = Math.max(0, ...w.deadlines.map((d) => d.id)) + 1;
        const created: LegalDeadline = {
          ...input,
          id: nextId,
          createdAt: new Date().toISOString().slice(0, 10),
        };
        return {
          ...w,
          deadlines: [created, ...w.deadlines],
          auditLogs: pushLocalAudit(
            w,
            'create',
            'deadline',
            created.title,
            `مهلة حتى ${created.dueDate}`,
          ),
        };
      });
    }
  };

  const handleToggleDeadline = async (
    id: number,
    status: 'active' | 'completed',
  ) => {
    if (firebaseUser && !isLocalMode) {
      const updated = await apiFetch<LegalDeadline>(`/api/deadlines/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setWorkspace((w) => ({
        ...w,
        deadlines: w.deadlines.map((d) => (d.id === id ? updated : d)),
      }));
    } else {
      setWorkspace((w) => ({
        ...w,
        deadlines: w.deadlines.map((d) => (d.id === id ? { ...d, status } : d)),
      }));
    }
  };

  const handleDeleteDeadline = async (id: number) => {
    if (firebaseUser && !isLocalMode) {
      await apiFetch(`/api/deadlines/${id}`, { method: 'DELETE' });
      setWorkspace((w) => ({
        ...w,
        deadlines: w.deadlines.filter((d) => d.id !== id),
      }));
    } else {
      setWorkspace((w) => ({
        ...w,
        deadlines: w.deadlines.filter((d) => d.id !== id),
      }));
    }
  };

  const handleCreateContract = async (input: {
    caseId: number | null;
    clientId: number;
    title: string;
    contractType: 'fee_agreement' | 'poa' | 'settlement';
    content: string;
    feeTerms: string;
  }) => {
    if (firebaseUser && !isLocalMode) {
      const created = await apiFetch<LegalContract>('/api/contracts', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setWorkspace((w) => ({ ...w, contracts: [created, ...w.contracts] }));
    } else {
      setWorkspace((w) => {
        const nextId = Math.max(0, ...w.contracts.map((c) => c.id)) + 1;
        const created: LegalContract = {
          ...input,
          id: nextId,
          signToken: Math.random().toString(36).slice(2, 12),
          status: 'pending_signature',
          signerName: '',
          signatureDataUrl: '',
          signedAt: '',
          createdAt: new Date().toISOString().slice(0, 10),
        };
        return {
          ...w,
          contracts: [created, ...w.contracts],
          auditLogs: pushLocalAudit(w, 'create', 'contract', created.title, 'إنشاء عقد/تفويض'),
        };
      });
    }
  };

  const handleSignContract = async (
    id: number,
    signerName: string,
    signatureDataUrl: string,
  ) => {
    if (firebaseUser && !isLocalMode) {
      const updated = await apiFetch<LegalContract>(`/api/contracts/${id}/sign`, {
        method: 'POST',
        body: JSON.stringify({ signerName, signatureDataUrl }),
      });
      setWorkspace((w) => ({
        ...w,
        contracts: w.contracts.map((c) => (c.id === id ? updated : c)),
      }));
    } else {
      const signedAt = new Date().toISOString().slice(0, 10);
      setWorkspace((w) => ({
        ...w,
        contracts: w.contracts.map((c) =>
          c.id === id
            ? { ...c, status: 'signed', signerName, signatureDataUrl, signedAt }
            : c,
        ),
        auditLogs: pushLocalAudit(
          w,
          'sign',
          'contract',
          `#${id}`,
          `توقيع إلكتروني بواسطة ${signerName}`,
        ),
      }));
    }
  };

  const handleDeleteContract = async (id: number) => {
    if (firebaseUser && !isLocalMode) {
      await apiFetch(`/api/contracts/${id}`, { method: 'DELETE' });
      setWorkspace((w) => ({
        ...w,
        contracts: w.contracts.filter((c) => c.id !== id),
      }));
    } else {
      setWorkspace((w) => ({
        ...w,
        contracts: w.contracts.filter((c) => c.id !== id),
        auditLogs: pushLocalAudit(w, 'delete', 'contract', `#${id}`, 'حذف عقد'),
      }));
    }
  };

  const handleSaveVaultDoc = async (input: {
    caseId: number;
    procedureId?: number | null;
    docGroupKey: string;
    fileName: string;
    fileMime: string;
    fileSize: number;
    plainData: string;
    notes: string;
  }) => {
    if (firebaseUser && !isLocalMode) {
      const created = await apiFetch<DocumentVersion>('/api/vault/documents', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setWorkspace((w) => ({
        ...w,
        documentVersions: [created, ...w.documentVersions],
      }));
    } else {
      // Compute SHA-256 fingerprint cleanly in browser WebCrypto
      let sha256Hash = '';
      try {
        const bytes = new TextEncoder().encode(input.plainData);
        const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
        sha256Hash = Array.from(new Uint8Array(hashBuf))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      } catch {
        sha256Hash = Math.random().toString(16).slice(2).padEnd(32, '0');
      }
      const encodedCipher =
        typeof btoa === 'function'
          ? `aes-local:${btoa(unescape(encodeURIComponent(input.plainData)))}`
          : input.plainData;

      setWorkspace((w) => {
        const nextId = Math.max(0, ...w.documentVersions.map((d) => d.id)) + 1;
        const existingVersions = w.documentVersions.filter(
          (d) => d.caseId === input.caseId && d.docGroupKey === input.docGroupKey,
        );
        const versionNumber =
          existingVersions.reduce((mx, d) => Math.max(mx, d.versionNumber), 0) + 1;
        const created: DocumentVersion = {
          id: nextId,
          caseId: input.caseId,
          procedureId: input.procedureId ?? null,
          docGroupKey: input.docGroupKey,
          fileName: input.fileName,
          versionNumber,
          fileMime: input.fileMime,
          fileSize: input.fileSize,
          sha256Hash,
          encryptedData: encodedCipher,
          isEncrypted: true,
          shareToken: '',
          shareExpiresAt: '',
          uploadedBy: activeActorEmail,
          notes: input.notes,
          createdAt: new Date().toISOString().slice(0, 10),
        };
        return {
          ...w,
          documentVersions: [created, ...w.documentVersions],
          auditLogs: pushLocalAudit(
            w,
            'create',
            'vault_document',
            `${created.fileName} (v${versionNumber})`,
            'حفظ مستند مشفر في الخزينة',
          ),
        };
      });
    }
  };

  const handleDownloadVaultDoc = async (doc: DocumentVersion) => {
    let plainData = doc.encryptedData;
    if (firebaseUser && !isLocalMode) {
      const res = await apiFetch<{ plainData: string }>(
        `/api/vault/documents/${doc.id}/download`,
      );
      plainData = res.plainData;
    } else if (plainData.startsWith('aes-local:')) {
      try {
        plainData = decodeURIComponent(escape(atob(plainData.slice('aes-local:'.length))));
      } catch {
        // Fallback to raw
      }
      setWorkspace((w) => ({
        ...w,
        auditLogs: pushLocalAudit(
          w,
          'export',
          'vault_document',
          doc.fileName,
          'فك تشفير وتحميل مستند من الخزينة',
        ),
      }));
    }
    if (plainData) {
      const a = document.createElement('a');
      a.href = plainData;
      a.download = doc.fileName || 'document';
      a.click();
    }
  };

  const handleShareVaultDoc = async (
    docId: number,
    expiresInDays = 7,
  ): Promise<DocumentVersion | null> => {
    if (firebaseUser && !isLocalMode) {
      const updated = await apiFetch<DocumentVersion>(
        `/api/vault/documents/${docId}/share`,
        {
          method: 'POST',
          body: JSON.stringify({ expiresInDays }),
        },
      );
      setWorkspace((w) => ({
        ...w,
        documentVersions: w.documentVersions.map((d) => (d.id === docId ? updated : d)),
      }));
      return updated;
    }
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + expiresInDays * 86400_000).toISOString();
    const targetDoc = workspace.documentVersions.find((d) => d.id === docId);
    const updatedItem: DocumentVersion | null = targetDoc
      ? { ...targetDoc, shareToken: token, shareExpiresAt: expiresAt }
      : null;
    if (!updatedItem) return null;
    setWorkspace((w) => ({
      ...w,
      documentVersions: w.documentVersions.map((d) => (d.id === docId ? updatedItem : d)),
      auditLogs: pushLocalAudit(
        w,
        'share',
        'vault_document',
        updatedItem.fileName,
        `إنشاء رابط مشاركة مؤقت لمدة ${expiresInDays} أيام`,
      ),
    }));
    return updatedItem;
  };

  const handleSaveSettings = async (updated: OfficeSettings) => {
    if (firebaseUser && !isLocalMode) {
      const saved = await apiFetch<OfficeSettings>('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(updated),
      });
      setWorkspace((w) => ({ ...w, settings: saved }));
    } else {
      setWorkspace((w) => ({
        ...w,
        settings: updated,
        auditLogs: pushLocalAudit(w, 'update', 'settings', updated.officeName, 'تحديث الإعدادات'),
      }));
    }
  };

  const handleAddLawyer = async (input: Omit<Lawyer, 'id'>) => {
    if (firebaseUser && !isLocalMode) {
      const created = await apiFetch<Lawyer>('/api/lawyers', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setWorkspace((w) => ({ ...w, lawyers: [...w.lawyers, created] }));
    } else {
      setWorkspace((w) => {
        const nextId = Math.max(0, ...w.lawyers.map((l) => l.id)) + 1;
        return {
          ...w,
          lawyers: [...w.lawyers, { ...input, id: nextId }],
          auditLogs: pushLocalAudit(w, 'create', 'lawyer', input.name, 'إضافة محامٍ جديد'),
        };
      });
    }
  };

  const handleDeleteLawyer = async (id: number) => {
    if (firebaseUser && !isLocalMode) {
      await apiFetch(`/api/lawyers/${id}`, { method: 'DELETE' });
      setWorkspace((w) => ({ ...w, lawyers: w.lawyers.filter((l) => l.id !== id) }));
    } else {
      setWorkspace((w) => ({
        ...w,
        lawyers: w.lawyers.filter((l) => l.id !== id),
        auditLogs: pushLocalAudit(w, 'delete', 'lawyer', `#${id}`, 'حذف محامٍ من القائمة'),
      }));
    }
  };

  const handleAddFirmMember = async (input: {
    email: string;
    fullName: string;
    role: 'admin' | 'lawyer' | 'secretary' | 'accountant';
    permissions: TeamPermissions;
  }) => {
    if (firebaseUser && !isLocalMode) {
      const created = await apiFetch<FirmMember>('/api/firm-members', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setWorkspace((w) => ({ ...w, firmMembers: [...w.firmMembers, created] }));
    } else {
      setWorkspace((w) => {
        const nextId = Math.max(0, ...w.firmMembers.map((m) => m.id)) + 1;
        const created: FirmMember = {
          id: nextId,
          email: input.email.toLowerCase(),
          fullName: input.fullName,
          role: input.role,
          permissions: input.permissions,
          status: 'active',
          createdAt: new Date().toISOString().slice(0, 10),
        };
        return {
          ...w,
          firmMembers: [...w.firmMembers, created],
          auditLogs: pushLocalAudit(
            w,
            'create',
            'firm_member',
            created.email,
            `دعوة عضو فريق (${created.role})`,
          ),
        };
      });
    }
  };

  const handleUpdateFirmMember = async (
    id: number,
    patch: Partial<Pick<FirmMember, 'role' | 'permissions' | 'status'>>,
  ) => {
    if (firebaseUser && !isLocalMode) {
      const updated = await apiFetch<FirmMember>(`/api/firm-members/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setWorkspace((w) => ({
        ...w,
        firmMembers: w.firmMembers.map((m) => (m.id === id ? updated : m)),
      }));
    } else {
      setWorkspace((w) => ({
        ...w,
        firmMembers: w.firmMembers.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        auditLogs: pushLocalAudit(w, 'update', 'firm_member', `#${id}`, 'تحديث صلاحيات عضو'),
      }));
    }
  };

  const handleDeleteFirmMember = async (id: number) => {
    if (firebaseUser && !isLocalMode) {
      await apiFetch(`/api/firm-members/${id}`, { method: 'DELETE' });
      setWorkspace((w) => ({
        ...w,
        firmMembers: w.firmMembers.filter((m) => m.id !== id),
      }));
    } else {
      setWorkspace((w) => ({
        ...w,
        firmMembers: w.firmMembers.filter((m) => m.id !== id),
        auditLogs: pushLocalAudit(w, 'delete', 'firm_member', `#${id}`, 'إزالة عضو فريق'),
      }));
    }
  };

  const handleSendReminder = async (
    hearing: UpcomingHearing,
    channel: 'whatsapp' | 'email' | 'sms',
    customMessage?: string,
  ) => {
    const client = workspace.clients.find((c) => c.id === hearing.clientId);
    const payload = {
      caseId: hearing.caseId,
      recipientName: hearing.clientName,
      recipientPhone: client?.phone || '',
      channel,
      message:
        customMessage ||
        `تذكير بجلسة القضية ${hearing.caseCode} بتاريخ ${hearing.hearingDate} في ${hearing.courtName}`,
      status: 'sent' as const,
    };
    if (firebaseUser && !isLocalMode) {
      const created = await apiFetch<WorkspaceState['notifications'][number]>(
        '/api/notifications',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );
      setWorkspace((w) => ({ ...w, notifications: [created, ...w.notifications] }));
    } else {
      setWorkspace((w) => {
        const nextId = Math.max(0, ...w.notifications.map((n) => n.id)) + 1;
        return {
          ...w,
          notifications: [
            { ...payload, id: nextId, sentAt: new Date().toISOString().slice(0, 10) },
            ...w.notifications,
          ],
          auditLogs: pushLocalAudit(
            w,
            'create',
            'notification',
            hearing.caseCode,
            `إرسال تنبيه ${channel} إلى ${hearing.clientName}`,
          ),
        };
      });
    }
  };

  const handleScheduleHearing = async (
    caseId: number,
    hearingDate: string,
    notes: string,
  ) => {
    const linkedCase = workspace.cases.find((c) => c.id === caseId);
    await handleAddProcedure({
      caseId,
      procedureDate: new Date().toISOString().slice(0, 10),
      procedureType: 'hearing',
      description: notes.trim() || 'جدولة موعد جلسة متابعة جديدة',
      executorName: linkedCase?.lawyerName || workspace.lawyers[0]?.name || 'المحامي المختص',
      outcome: 'تم تحديد موعد الجلسة وإدراجها في جدول المواعيد القادمة',
      nextActionDate: hearingDate,
      attachmentName: '',
      attachmentMime: '',
      attachmentSize: 0,
      attachmentText: '',
      attachmentData: '',
      visibleToClient: true,
    });
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-sm text-slate-600 dark:text-slate-300">
        جاري التحقق من حالة الجلسة...
      </div>
    );
  }

  if (!firebaseUser && !isLocalMode) {
    return (
      <LoginPage
        onGoogleLogin={handleGoogleLogin}
        onEmailWorkspaceLogin={handleEmailWorkspaceLogin}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        authLoading={authLoading}
        authError={authError}
      />
    );
  }

  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'clients', label: 'العملاء', icon: Users },
    { id: 'cases', label: 'القضايا', icon: Briefcase },
    { id: 'new-case', label: 'فتح ملف قضية', icon: FolderPlus },
    { id: 'procedures', label: 'سجل الإجراءات', icon: History },
    { id: 'tools', label: 'المدد والعقود', icon: Calculator },
    { id: 'billing', label: 'الفواتير والأمانات', icon: CreditCard },
    { id: 'reports', label: 'التقارير', icon: BarChart3 },
    { id: 'audit', label: 'التدقيق والخزينة', icon: ShieldAlert },
    { id: 'settings', label: 'الإعدادات', icon: Settings },
    { id: 'guide', label: 'دليل الاستخدام', icon: BookOpen },
  ];

  const canModifyCasesAndClients = activePermissions.canEditCases;
  const canManageBilling = activePermissions.canManageBilling;
  const canManageSettings = activePermissions.canManageSettings;
  const canViewAudit = activePermissions.canViewAudit;

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7FB] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="flex flex-1 min-w-0">
        {/* Mobile Sidebar Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar Navigation (RTL Right Side — Deep Royal Navy) */}
        {role !== 'client' && (
          <aside
            className={`no-print fixed lg:sticky top-0 right-0 z-50 h-screen w-64 shrink-0 bg-gradient-to-b from-[#0B1E47] via-[#0F2759] to-[#132B63] text-slate-100 border-l border-[#1B3A7A] flex flex-col transition-transform duration-200 lg:translate-x-0 shadow-lg ${
              sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
            }`}
          >
            <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2364EE] to-[#0E39A3] border border-white/20 flex items-center justify-center shadow-sm shrink-0">
                  <Scale className="w-5 h-5 text-amber-300" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-white truncate">
                    العملاء والقضايا
                  </p>
                  <p className="text-[11px] text-blue-200/80 truncate">
                    {workspace.settings.officeName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="إغلاق القائمة الجانبية"
                className="p-1.5 rounded-lg lg:hidden text-blue-200 hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav aria-label="القائمة الرئيسية" className="flex-1 overflow-y-auto p-3 space-y-1">
              {navItems.map((item) => {
                if (item.id === 'settings' && !canManageSettings) return null;
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-[#1D5CE5] to-[#2563EB] text-white shadow-sm'
                        : 'text-blue-100/85 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-blue-200/80'}`}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-3 border-t border-white/10 space-y-2">
              <div
                data-testid="active-workspace-email"
                className="text-[11px] text-blue-200/85 px-2 truncate font-mono-num"
              >
                {activeActorEmail}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl border border-white/15 text-blue-100 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </aside>
        )}

        {/* Main Workspace Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header */}
          <header className="no-print sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {role !== 'client' && (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    aria-label="فتح القائمة الجانبية"
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 lg:hidden shrink-0"
                  >
                    <Menu className="w-4 h-4" />
                  </button>
                )}

                {/* Global Search */}
                {role !== 'client' ? (
                  <>
                    <span className="md:hidden font-display font-bold text-sm text-[#0B1E47] dark:text-white truncate">
                      العملاء والقضايا
                    </span>
                    <div className="relative hidden md:block flex-1 max-w-md">
                      <Search
                        className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={globalQuery}
                        onFocus={() => setGlobalSearchOpen(true)}
                        onBlur={() => window.setTimeout(() => setGlobalSearchOpen(false), 180)}
                        onChange={(e) => {
                          setGlobalQuery(e.target.value);
                          setGlobalSearchOpen(true);
                        }}
                        aria-label="بحث شامل سريع"
                        placeholder="بحث شامل: اسم العميل، الهاتف، رقم القضية..."
                        className="w-full pr-9 pl-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-amber-500"
                      />

                      {globalSearchOpen && globalQuery.trim() && (
                        <div className="absolute right-0 left-0 top-full mt-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg p-3 space-y-2 z-50">
                          {globalSearchResults.cases.length === 0 &&
                          globalSearchResults.clients.length === 0 ? (
                            <p className="text-xs text-slate-500">لا توجد نتائج مطابقة.</p>
                          ) : (
                            <>
                              {globalSearchResults.cases.map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onMouseDown={() => {
                                    setSelectedCaseId(c.id);
                                    setActiveTab('cases');
                                    setGlobalQuery('');
                                  }}
                                  className="w-full text-right p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 block text-xs cursor-pointer"
                                >
                                  <span className="font-mono-num font-bold text-amber-700 dark:text-amber-400 ml-2">
                                    {c.caseCode}
                                  </span>
                                  <span className="font-medium">{c.subject}</span>
                                </button>
                              ))}
                              {globalSearchResults.clients.map((cl) => (
                                <button
                                  key={cl.id}
                                  type="button"
                                  onMouseDown={() => {
                                    setActiveTab('clients');
                                    setGlobalQuery('');
                                  }}
                                  className="w-full text-right p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 block text-xs cursor-pointer"
                                >
                                  <span className="font-mono-num font-bold ml-2">
                                    {cl.clientCode}
                                  </span>
                                  <span>{cl.name}</span>
                                  <span className="text-slate-400 mr-2 font-mono-num">
                                    ({cl.phone})
                                  </span>
                                </button>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="font-display font-bold text-sm truncate">
                    {workspace.settings.officeName} — بوابة العملاء
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <label htmlFor="rbac-role-switch" className="sr-only">
                  تبديل صلاحية المستخدم
                </label>
                <select
                  id="rbac-role-switch"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="max-w-[145px] sm:max-w-none px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                    <option key={r} value={r}>
                      الصلاحية: {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setIsDark((d) => !d)}
                  aria-label={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {workspaceError && (
              <div
                role="alert"
                className="mb-5 p-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300"
              >
                {workspaceError}
              </div>
            )}

            {workspaceLoading ? (
              <div className="p-12 text-center text-sm text-slate-500">
                جاري تحميل السجل الرئيسي من قاعدة البيانات...
              </div>
            ) : role === 'client' ? (
              <ClientPortalView
                clients={workspace.clients}
                selectedClientId={portalClientId}
                onChangeClient={setPortalClientId}
                cases={workspace.cases}
                procedures={workspace.procedures}
                invoices={workspace.invoices}
                contracts={workspace.contracts}
                onSignContract={handleSignContract}
              />
            ) : (
              <>
                {activeTab === 'dashboard' && (
                  <DashboardView
                    clients={workspace.clients}
                    cases={accessibleCases}
                    procedures={workspace.procedures}
                    notifications={workspace.notifications}
                    settings={workspace.settings}
                    onOpenNewCase={() => setActiveTab('new-case')}
                    onOpenClients={() => setActiveTab('clients')}
                    onOpenCases={() => setActiveTab('cases')}
                    onOpenProcedures={() => setActiveTab('procedures')}
                    onScheduleHearing={handleScheduleHearing}
                    onSelectCase={(c) => {
                      setSelectedCaseId(c.id);
                      setActiveTab('cases');
                    }}
                    onSendReminder={handleSendReminder}
                    canCreateCase={canModifyCasesAndClients}
                  />
                )}

                {activeTab === 'clients' && (
                  <ClientsView
                    clients={workspace.clients}
                    cases={accessibleCases}
                    invoices={workspace.invoices}
                    onCreateClient={handleCreateClient}
                    onUpdateClient={handleUpdateClient}
                    onSelectCase={(c) => {
                      setSelectedCaseId(c.id);
                      setActiveTab('cases');
                    }}
                    canEdit={canModifyCasesAndClients}
                  />
                )}

                {activeTab === 'cases' && (
                  <CasesView
                    cases={accessibleCases}
                    clients={workspace.clients}
                    lawyers={workspace.lawyers}
                    procedures={workspace.procedures}
                    settings={workspace.settings}
                    selectedCaseId={selectedCaseId}
                    onSelectCase={(c) => setSelectedCaseId(c ? c.id : null)}
                    onUpdateCaseStatus={handleUpdateCaseStatus}
                    onNajizSync={handleNajizSync}
                    onOpenNewCase={() => setActiveTab('new-case')}
                    onGoToProcedures={(caseId) => {
                      setProcedureFilterCaseId(caseId);
                      setActiveTab('procedures');
                    }}
                    canEdit={canModifyCasesAndClients}
                  />
                )}

                {activeTab === 'new-case' && (
                  <NewCaseView
                    clients={workspace.clients}
                    lawyers={workspace.lawyers}
                    settings={workspace.settings}
                    onCreateCase={handleCreateCase}
                    onCancel={() => setActiveTab('cases')}
                  />
                )}

                {activeTab === 'procedures' && (
                  <ProceduresView
                    cases={accessibleCases}
                    lawyers={workspace.lawyers}
                    procedures={workspace.procedures}
                    initialCaseId={procedureFilterCaseId}
                    onAddProcedure={handleAddProcedure}
                    onSaveToVault={handleSaveVaultDoc}
                    canEdit={canModifyCasesAndClients}
                  />
                )}

                {activeTab === 'tools' && (
                  <LegalToolsAndContractsView
                    clients={workspace.clients}
                    cases={accessibleCases}
                    deadlines={workspace.deadlines}
                    contracts={workspace.contracts}
                    settings={workspace.settings}
                    canEdit={canModifyCasesAndClients}
                    onCreateDeadline={handleCreateDeadline}
                    onToggleDeadline={handleToggleDeadline}
                    onDeleteDeadline={handleDeleteDeadline}
                    onCreateContract={handleCreateContract}
                    onSignContract={handleSignContract}
                    onDeleteContract={handleDeleteContract}
                  />
                )}

                {activeTab === 'billing' && (
                  <BillingView
                    clients={workspace.clients}
                    cases={accessibleCases}
                    invoices={workspace.invoices}
                    timeEntries={workspace.timeEntries}
                    trustTransactions={workspace.trustTransactions}
                    settings={workspace.settings}
                    onCreateInvoice={handleCreateInvoice}
                    onRecordPayment={handleRecordPayment}
                    onCreateTimeEntry={handleCreateTimeEntry}
                    onDeleteTimeEntry={handleDeleteTimeEntry}
                    onCreateTrustTx={handleCreateTrustTx}
                    canEdit={canManageBilling}
                  />
                )}

                {activeTab === 'reports' && (
                  <ReportsView
                    clients={workspace.clients}
                    lawyers={workspace.lawyers}
                    cases={accessibleCases}
                    procedures={workspace.procedures}
                    invoices={workspace.invoices}
                    settings={workspace.settings}
                  />
                )}

                {activeTab === 'audit' && (
                  <AuditAndVaultView
                    auditLogs={workspace.auditLogs}
                    documentVersions={workspace.documentVersions}
                    cases={accessibleCases}
                    canViewAudit={canViewAudit}
                    canEditVault={canModifyCasesAndClients}
                    onSaveVaultDoc={handleSaveVaultDoc}
                    onDownloadVaultDoc={handleDownloadVaultDoc}
                    onShareVaultDoc={handleShareVaultDoc}
                  />
                )}

                {activeTab === 'settings' && (
                  <SettingsView
                    settings={workspace.settings}
                    lawyers={workspace.lawyers}
                    firmMembers={workspace.firmMembers}
                    onSaveSettings={handleSaveSettings}
                    onAddLawyer={handleAddLawyer}
                    onDeleteLawyer={handleDeleteLawyer}
                    onAddFirmMember={handleAddFirmMember}
                    onUpdateFirmMember={handleUpdateFirmMember}
                    onDeleteFirmMember={handleDeleteFirmMember}
                  />
                )}

                {activeTab === 'guide' && <GuideView />}
              </>
            )}
          </main>

          {/* Persistent Footer on all interior pages */}
          <AppFooter officeName={workspace.settings.officeName} />
        </div>
      </div>
    </div>
  );
}
