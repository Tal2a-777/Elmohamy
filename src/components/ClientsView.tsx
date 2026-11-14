import { useMemo, useState } from 'react';
import { Briefcase, Edit3, Eye, IdCard, Plus, Search, UserPlus, X } from 'lucide-react';
import type {
  AccountStatus,
  Client,
  ClientType,
  Invoice,
  LegalCase,
} from '../types/legal.ts';
import { calculateClientFinancialSummary } from '../utils/legalLogic.ts';
import { AccountStatusTag, CaseStatusTag } from './StatusBadge.tsx';

interface ClientsViewProps {
  clients: Client[];
  cases: LegalCase[];
  invoices: Invoice[];
  onCreateClient: (input: Omit<Client, 'id' | 'createdAt' | 'clientCode'>) => Promise<void>;
  onUpdateClient: (id: number, input: Partial<Client>) => Promise<void>;
  onSelectCase: (c: LegalCase) => void;
  canEdit: boolean;
}

export function ClientsView({
  clients,
  cases,
  invoices,
  onCreateClient,
  onUpdateClient,
  onSelectCase,
  canEdit,
}: ClientsViewProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ClientType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AccountStatus>('all');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(
    clients[0]?.id ?? null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formState, setFormState] = useState({
    name: '',
    clientType: 'individual' as ClientType,
    nationalOrRegId: '',
    phone: '',
    email: '',
    address: '',
    accountStatus: 'active' as AccountStatus,
    notes: '',
  });

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (typeFilter !== 'all' && c.clientType !== typeFilter) return false;
      if (statusFilter !== 'all' && c.accountStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.clientCode.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    });
  }, [clients, search, typeFilter, statusFilter]);

  const activeClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? filteredClients[0] ?? null,
    [clients, selectedClientId, filteredClients],
  );

  const activeClientCases = useMemo(
    () => (activeClient ? cases.filter((k) => k.clientId === activeClient.id) : []),
    [cases, activeClient],
  );

  const activeClientFinancials = useMemo(
    () =>
      activeClient
        ? calculateClientFinancialSummary(activeClient.id, cases, invoices)
        : null,
    [activeClient, cases, invoices],
  );

  const openAddModal = () => {
    setEditingClient(null);
    setFormError(null);
    setFormState({
      name: '',
      clientType: 'individual',
      nationalOrRegId: '',
      phone: '',
      email: '',
      address: '',
      accountStatus: 'active',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormError(null);
    setFormState({
      name: client.name,
      clientType: client.clientType,
      nationalOrRegId: client.nationalOrRegId,
      phone: client.phone,
      email: client.email,
      address: client.address,
      accountStatus: client.accountStatus,
      notes: client.notes,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim() || !formState.phone.trim()) {
      setFormError('اسم العميل ورقم الهاتف حقول إلزامية.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editingClient) {
        await onUpdateClient(editingClient.id, formState);
      } else {
        await onCreateClient(formState);
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'تعذر حفظ بيانات العميل');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="clients-view">
      {/* Header matching IMG_3811 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0B1E47] dark:text-white">
            العملاء
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            إدارة بيانات العملاء والبطاقة التفصيلية لكل عميل
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {activeClient && activeClientCases[0] && (
            <button
              type="button"
              onClick={() => onSelectCase(activeClientCases[0])}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs cursor-pointer"
            >
              <Briefcase className="w-4 h-4 text-[#1D5CE5]" aria-hidden="true" />
              <span>عرض قضايا العميل</span>
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-[#1D5CE5] to-[#1545B5] text-white hover:from-[#1A52CE] hover:to-[#123B9E] shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              <span>إضافة عميل جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
        <div className="sm:col-span-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | ClientType)}
            aria-label="تصفية حسب نوع العميل"
            className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950"
          >
            <option value="all">نوع العميل: الكل</option>
            <option value="individual">أفراد</option>
            <option value="entity">جهات / شركات</option>
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | AccountStatus)}
            aria-label="تصفية حسب حالة العميل"
            className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950"
          >
            <option value="all">الحالة: الكل</option>
            <option value="active">نشط</option>
            <option value="suspended">معلق</option>
            <option value="closed">مقفل</option>
          </select>
        </div>

        <div className="relative sm:col-span-6">
          <Search
            className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="بحث في العملاء"
            placeholder="بحث برقم العميل أو اسم العميل أو الهاتف..."
            className="w-full pr-9 pl-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Split Layout: Clients List Table + Golden-Outlined Client Detail Card */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <section className="xl:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#0B1E47] dark:text-white">
              قائمة العملاء
            </h2>
            <span className="text-xs text-slate-500 font-mono-num">
              {filteredClients.length} سجل
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-3 font-semibold whitespace-nowrap">رقم العميل</th>
                  <th className="px-3 py-3 font-semibold">اسم العميل</th>
                  <th className="px-3 py-3 font-semibold whitespace-nowrap">النوع</th>
                  <th className="px-3 py-3 font-semibold whitespace-nowrap">القضايا</th>
                  <th className="px-3 py-3 font-semibold whitespace-nowrap">الحالة</th>
                  <th className="px-3 py-3 font-semibold whitespace-nowrap text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredClients.map((client) => {
                  const caseCount = cases.filter((c) => c.clientId === client.id).length;
                  const isSelected = activeClient?.id === client.id;
                  return (
                    <tr
                      key={client.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-blue-50/70 dark:bg-blue-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-3 py-3 font-mono-num text-xs font-bold text-[#0B1E47] dark:text-amber-400 whitespace-nowrap">
                        {client.clientCode}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedClientId(client.id)}
                          className="text-right text-xs font-semibold text-slate-900 dark:text-white hover:text-[#1D5CE5] cursor-pointer"
                        >
                          {client.name}
                        </button>
                        <div className="text-[11px] text-slate-400 font-mono-num">{client.phone}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {client.clientType === 'entity' ? 'جهة' : 'فرد'}
                      </td>
                      <td className="px-3 py-3 font-mono-num text-xs font-bold text-slate-800 dark:text-slate-200">
                        {caseCount}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <AccountStatusTag status={client.accountStatus} />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedClientId(client.id)}
                            aria-label={`عرض بطاقة ${client.name}`}
                            className="w-7 h-7 rounded-md bg-blue-50 dark:bg-slate-800 text-[#1D5CE5] dark:text-blue-400 inline-flex items-center justify-center hover:bg-blue-100 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEditModal(client)}
                              aria-label={`تعديل ${client.name}`}
                              className="w-7 h-7 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center hover:bg-slate-200 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                      لا يوجد عملاء مطابقون للبحث.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Detailed Client Card matching IMG_3812 */}
        <aside className="xl:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-800/60 shadow-sm p-5 space-y-4">
          {activeClient ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 flex items-center justify-center text-[#1D5CE5] dark:text-blue-400 shrink-0">
                    <IdCard className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#0B1E47] dark:text-white">
                      بيانات العميل
                    </h2>
                    <span className="font-mono-num text-xs text-slate-500">
                      {activeClient.clientCode}
                    </span>
                  </div>
                </div>
                <AccountStatusTag status={activeClient.accountStatus} />
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-slate-500">رقم العميل</span>
                  <span className="font-mono-num font-bold text-[#0B1E47] dark:text-amber-400">
                    {activeClient.clientCode}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-slate-500">اسم العميل</span>
                  <span className="font-bold text-slate-900 dark:text-white text-left">
                    {activeClient.name}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-slate-500">نوع العميل</span>
                  <span className="font-medium">
                    {activeClient.clientType === 'entity' ? 'جهة' : 'فرد'}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-slate-500">عدد القضايا</span>
                  <span className="font-mono-num font-bold">{activeClientCases.length}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-slate-500">الهاتف</span>
                  <span className="font-mono-num font-medium">{activeClient.phone}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-slate-500">البريد الإلكتروني</span>
                  <span className="font-medium break-all text-left">
                    {activeClient.email || '—'}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between gap-3">
                  <span className="text-slate-500">الهوية / السجل</span>
                  <span className="font-mono-num font-medium">
                    {activeClient.nationalOrRegId || '—'}
                  </span>
                </div>
                <div className="py-2.5 flex items-start justify-between gap-3">
                  <span className="text-slate-500 shrink-0">ملاحظات</span>
                  <span className="text-slate-700 dark:text-slate-300 text-left">
                    {activeClient.notes || '—'}
                  </span>
                </div>
              </div>

              {activeClientFinancials && (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 text-center">
                    <span className="text-[11px] text-slate-500 block">الفواتير</span>
                    <span className="font-mono-num text-xs font-bold">
                      {activeClientFinancials.totalBilled.toLocaleString('en-US')}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 text-center">
                    <span className="text-[11px] text-slate-500 block">المدفوع</span>
                    <span className="font-mono-num text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      {activeClientFinancials.totalPaid.toLocaleString('en-US')}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 text-center">
                    <span className="text-[11px] text-slate-500 block">المتبقي</span>
                    <span className="font-mono-num text-xs font-bold text-amber-700 dark:text-amber-400">
                      {activeClientFinancials.balanceDue.toLocaleString('en-US')}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openEditModal(activeClient)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-[#1D5CE5] to-[#1545B5] text-white hover:from-[#1A52CE] hover:to-[#123B9E] shadow-xs cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>تعديل العميل</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (activeClientCases[0]) onSelectCase(activeClientCases[0]);
                  }}
                  disabled={activeClientCases.length === 0}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
                >
                  <span>قضايا العميل ({activeClientCases.length})</span>
                </button>
              </div>

              {activeClientCases.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  {activeClientCases.slice(0, 3).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelectCase(c)}
                      className="w-full p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between gap-2 text-right cursor-pointer"
                    >
                      <span className="text-xs font-semibold truncate">
                        {c.caseCode} — {c.subject}
                      </span>
                      <CaseStatusTag status={c.status} />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500 text-center py-10">
              اختر عميلاً من القائمة لعرض بطاقته التفصيلية.
            </p>
          )}
        </aside>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="client-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 id="client-modal-title" className="font-display text-base font-bold text-[#0B1E47] dark:text-white">
                {editingClient ? `تعديل بيانات العميل (${editingClient.clientCode})` : 'إضافة عميل جديد'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="إغلاق النافذة"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="client-name" className="block text-xs font-medium mb-1">
                    اسم العميل / الجهة *
                  </label>
                  <input
                    id="client-name"
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label htmlFor="client-type" className="block text-xs font-medium mb-1">
                    نوع العميل
                  </label>
                  <select
                    id="client-type"
                    value={formState.clientType}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, clientType: e.target.value as ClientType }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="individual">فرد</option>
                    <option value="entity">جهة / شركة</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="client-status" className="block text-xs font-medium mb-1">
                    حالة الحساب
                  </label>
                  <select
                    id="client-status"
                    value={formState.accountStatus}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        accountStatus: e.target.value as AccountStatus,
                      }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="active">نشط</option>
                    <option value="suspended">معلق</option>
                    <option value="closed">مقفل</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="client-phone" className="block text-xs font-medium mb-1">
                    رقم الهاتف *
                  </label>
                  <input
                    id="client-phone"
                    type="text"
                    required
                    value={formState.phone}
                    onChange={(e) => setFormState((s) => ({ ...s, phone: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label htmlFor="client-email" className="block text-xs font-medium mb-1">
                    البريد الإلكتروني
                  </label>
                  <input
                    id="client-email"
                    type="email"
                    value={formState.email}
                    onChange={(e) => setFormState((s) => ({ ...s, email: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label htmlFor="client-idnum" className="block text-xs font-medium mb-1">
                    الهوية / السجل التجاري
                  </label>
                  <input
                    id="client-idnum"
                    type="text"
                    value={formState.nationalOrRegId}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, nationalOrRegId: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label htmlFor="client-address" className="block text-xs font-medium mb-1">
                    العنوان
                  </label>
                  <input
                    id="client-address"
                    type="text"
                    value={formState.address}
                    onChange={(e) => setFormState((s) => ({ ...s, address: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="client-notes" className="block text-xs font-medium mb-1">
                    ملاحظات
                  </label>
                  <textarea
                    id="client-notes"
                    rows={2}
                    value={formState.notes}
                    onChange={(e) => setFormState((s) => ({ ...s, notes: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-lg bg-[#1D5CE5] text-white hover:bg-[#1545B5] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{saving ? 'جاري الحفظ...' : editingClient ? 'حفظ التعديلات' : 'إضافة العميل'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
