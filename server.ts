import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import {
  appendAuditLog,
  createCaseRecord,
  createClientRecord,
  createContractRecord,
  createDeadlineRecord,
  createDocumentShareToken,
  createDocumentVersionRecord,
  createFirmMemberRecord,
  createInvoiceRecord,
  createLawyerRecord,
  createNotificationRecord,
  createProcedureRecord,
  createTimeEntryRecord,
  createTrustTransactionRecord,
  deleteContractRecord,
  deleteDeadlineRecord,
  deleteFirmMemberRecord,
  deleteLawyerRecord,
  deleteTimeEntryRecord,
  ensureAndLoadWorkspace,
  getDecryptedDocumentRecord,
  getSharedDocumentByToken,
  markTimeEntriesInvoiced,
  resetWorkspaceRecords,
  resolveWorkspaceAccess,
  signContractRecord,
  updateCaseRecord,
  updateClientRecord,
  updateDeadlineStatusRecord,
  updateFirmMemberRecord,
  updateInvoicePayment,
  updateSettingsRecord,
} from './src/db/repository.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '16mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Public time-limited encrypted document share endpoint
  app.get('/api/shared-doc/:token', async (req, res) => {
    try {
      const doc = await getSharedDocumentByToken(req.params.token);
      if (!doc) {
        return res.status(404).json({ error: 'رابط المشاركة غير صالح أو انتهت صلاحيته.' });
      }
      res.json(doc);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load shared document';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/workspace', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const data = await ensureAndLoadWorkspace(access.workspaceOwnerKey);
      res.json({ ...data, _access: access });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load workspace';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/workspace/reset', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await resetWorkspaceRecords(req.tenantKey!);
      res.json(data);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to reset workspace';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/clients', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const { name, phone } = req.body || {};
      if (!name || !phone) {
        return res.status(400).json({ error: 'اسم العميل ورقم الهاتف حقول إلزامية.' });
      }
      const created = await createClientRecord(access.workspaceOwnerKey, actorEmail, {
        name: String(name).trim(),
        clientType: req.body.clientType === 'entity' ? 'entity' : 'individual',
        nationalOrRegId: String(req.body.nationalOrRegId || ''),
        phone: String(phone).trim(),
        email: String(req.body.email || ''),
        address: String(req.body.address || ''),
        accountStatus: req.body.accountStatus || 'active',
        notes: String(req.body.notes || ''),
      });
      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create client';
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/clients/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const id = Number(req.params.id);
      const updated = await updateClientRecord(access.workspaceOwnerKey, actorEmail, id, req.body);
      if (!updated) return res.status(404).json({ error: 'العميل غير موجود.' });
      res.json(updated);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update client';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/cases', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const { officialNumber, caseYear, subject, caseType, clientId, opponentName, lawyerName, courtName } =
        req.body || {};
      if (!officialNumber || !subject || !clientId || !opponentName || !courtName) {
        return res.status(400).json({ error: 'يرجى استكمال كافة الحقول الإلزامية لملف القضية.' });
      }
      const result = await createCaseRecord(access.workspaceOwnerKey, actorEmail, {
        officialNumber: String(officialNumber).trim(),
        caseYear: Number(caseYear) || new Date().getFullYear(),
        subject: String(subject).trim(),
        caseType: String(caseType || 'تجاري'),
        clientId: Number(clientId),
        clientRole: req.body.clientRole === 'defendant' ? 'defendant' : 'plaintiff',
        opponentName: String(opponentName).trim(),
        lawyerId: req.body.lawyerId ? Number(req.body.lawyerId) : null,
        lawyerName: String(lawyerName || 'غير محدد').trim(),
        courtName: String(courtName).trim(),
        status: req.body.status || 'active',
        folderUrl: String(req.body.folderUrl || ''),
        notes: String(req.body.notes || ''),
        nextHearingDate: String(req.body.nextHearingDate || ''),
        najizStatus: String(req.body.najizStatus || ''),
        najizCircuit: String(req.body.najizCircuit || ''),
        lastSyncedAt: String(req.body.lastSyncedAt || ''),
      });
      res.status(201).json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create case';
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/cases/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const id = Number(req.params.id);
      const updated = await updateCaseRecord(access.workspaceOwnerKey, actorEmail, id, req.body);
      if (!updated) return res.status(404).json({ error: 'ملف القضية غير موجود.' });
      res.json(updated);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update case';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/cases/:id/najiz-sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const id = Number(req.params.id);
      const nowIso = new Date().toISOString().slice(0, 10);
      const updated = await updateCaseRecord(access.workspaceOwnerKey, actorEmail, id, {
        najizStatus: String(req.body.najizStatus || 'قيد النظر القضائي — متزامن مع ناجز'),
        najizCircuit: String(req.body.najizCircuit || 'الدائرة التجارية الأولى'),
        nextHearingDate: req.body.nextHearingDate ? String(req.body.nextHearingDate) : undefined,
        lastSyncedAt: nowIso,
      });
      if (!updated) return res.status(404).json({ error: 'ملف القضية غير موجود.' });
      res.json(updated);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to sync with Najiz';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/procedures', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const { caseId, procedureDate, description, executorName } = req.body || {};
      if (!caseId || !procedureDate || !description || !executorName) {
        return res.status(400).json({ error: 'بيانات الإجراء غير مكتملة.' });
      }
      const created = await createProcedureRecord(access.workspaceOwnerKey, actorEmail, {
        caseId: Number(caseId),
        procedureDate: String(procedureDate),
        procedureType: req.body.procedureType || 'hearing',
        description: String(description).trim(),
        executorName: String(executorName).trim(),
        outcome: String(req.body.outcome || ''),
        nextActionDate: String(req.body.nextActionDate || ''),
        attachmentName: String(req.body.attachmentName || ''),
        attachmentMime: String(req.body.attachmentMime || ''),
        attachmentSize: Number(req.body.attachmentSize || 0),
        attachmentText: String(req.body.attachmentText || ''),
        attachmentData: String(req.body.attachmentData || ''),
        visibleToClient: req.body.visibleToClient !== false,
      });
      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create procedure';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/invoices', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const { caseId, clientId, description, feeAmount } = req.body || {};
      if (!caseId || !clientId || !description || feeAmount === undefined) {
        return res.status(400).json({ error: 'بيانات الفاتورة غير مكتملة.' });
      }
      const created = await createInvoiceRecord(access.workspaceOwnerKey, actorEmail, {
        caseId: Number(caseId),
        clientId: Number(clientId),
        description: String(description).trim(),
        feeAmount: Number(feeAmount || 0),
        expensesAmount: Number(req.body.expensesAmount || 0),
        vatRate: req.body.vatRate !== undefined ? Number(req.body.vatRate) : undefined,
        invoiceType: req.body.invoiceType || 'tax_invoice',
        paidAmount: Number(req.body.paidAmount || 0),
        issuedDate: String(req.body.issuedDate || new Date().toISOString().slice(0, 10)),
        dueDate: String(req.body.dueDate || new Date().toISOString().slice(0, 10)),
        notes: String(req.body.notes || ''),
      });
      if (Array.isArray(req.body.timeEntryIds) && req.body.timeEntryIds.length > 0) {
        await markTimeEntriesInvoiced(
          access.workspaceOwnerKey,
          req.body.timeEntryIds.map((x: unknown) => Number(x)),
        );
      }
      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create invoice';
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/invoices/:id/payment', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const id = Number(req.params.id);
      const updated = await updateInvoicePayment(
        access.workspaceOwnerKey,
        actorEmail,
        id,
        Number(req.body.paidAmount || 0),
      );
      if (!updated) return res.status(404).json({ error: 'الفاتورة غير موجودة.' });
      res.json(updated);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update invoice payment';
      res.status(500).json({ error: msg });
    }
  });

  // Time Tracking routes
  app.post('/api/time-entries', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const created = await createTimeEntryRecord(access.workspaceOwnerKey, actorEmail, {
        caseId: Number(req.body.caseId),
        lawyerName: String(req.body.lawyerName || 'المحامي المختص'),
        hours: Number(req.body.hours || 1),
        hourlyRate: Number(req.body.hourlyRate || 500),
        billable: req.body.billable !== false,
        invoiced: false,
        description: String(req.body.description || 'عمل قانوني واستشارة'),
        entryDate: String(req.body.entryDate || new Date().toISOString().slice(0, 10)),
      });
      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to log time entry';
      res.status(500).json({ error: msg });
    }
  });

  app.delete('/api/time-entries/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const ok = await deleteTimeEntryRecord(access.workspaceOwnerKey, Number(req.params.id));
      res.json({ ok });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete time entry';
      res.status(500).json({ error: msg });
    }
  });

  // Client Trust / Retainer Accounting routes
  app.post('/api/trust-transactions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const created = await createTrustTransactionRecord(access.workspaceOwnerKey, actorEmail, {
        clientId: Number(req.body.clientId),
        caseId: req.body.caseId ? Number(req.body.caseId) : null,
        txType: req.body.txType || 'deposit',
        amount: Number(req.body.amount || 0),
        description: String(req.body.description || ''),
        referenceNo: String(req.body.referenceNo || ''),
        txDate: String(req.body.txDate || new Date().toISOString().slice(0, 10)),
      });
      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create trust transaction';
      res.status(500).json({ error: msg });
    }
  });

  // E-Signature Contracts & POA routes
  app.post('/api/contracts', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const created = await createContractRecord(access.workspaceOwnerKey, actorEmail, {
        caseId: req.body.caseId ? Number(req.body.caseId) : null,
        clientId: Number(req.body.clientId),
        title: String(req.body.title || ''),
        contractType: req.body.contractType || 'fee_agreement',
        content: String(req.body.content || ''),
        feeTerms: String(req.body.feeTerms || ''),
      });
      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create contract';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/contracts/:id/sign', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const updated = await signContractRecord(
        access.workspaceOwnerKey,
        actorEmail,
        Number(req.params.id),
        String(req.body.signerName || ''),
        String(req.body.signatureDataUrl || ''),
      );
      if (!updated) return res.status(404).json({ error: 'العقد غير موجود.' });
      res.json(updated);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to sign contract';
      res.status(500).json({ error: msg });
    }
  });

  app.delete('/api/contracts/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const ok = await deleteContractRecord(access.workspaceOwnerKey, Number(req.params.id));
      res.json({ ok });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete contract';
      res.status(500).json({ error: msg });
    }
  });

  // Statutory Deadlines routes
  app.post('/api/deadlines', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const created = await createDeadlineRecord(access.workspaceOwnerKey, actorEmail, {
        caseId: req.body.caseId ? Number(req.body.caseId) : null,
        title: String(req.body.title || ''),
        judgmentDate: String(req.body.judgmentDate || ''),
        deadlineType: String(req.body.deadlineType || 'appeal_30'),
        statutoryDays: Number(req.body.statutoryDays || 30),
        dueDate: String(req.body.dueDate || ''),
        notes: String(req.body.notes || ''),
        status: 'active',
      });
      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to save deadline';
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/deadlines/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const updated = await updateDeadlineStatusRecord(
        access.workspaceOwnerKey,
        Number(req.params.id),
        req.body.status === 'completed' ? 'completed' : 'active',
      );
      if (!updated) return res.status(404).json({ error: 'المهلة غير موجودة.' });
      res.json(updated);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update deadline';
      res.status(500).json({ error: msg });
    }
  });

  app.delete('/api/deadlines/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const ok = await deleteDeadlineRecord(access.workspaceOwnerKey, Number(req.params.id));
      res.json({ ok });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete deadline';
      res.status(500).json({ error: msg });
    }
  });

  // Encrypted Document Vault with Versioning
  app.post('/api/vault/documents', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const created = await createDocumentVersionRecord(access.workspaceOwnerKey, actorEmail, {
        caseId: Number(req.body.caseId),
        procedureId: req.body.procedureId ? Number(req.body.procedureId) : null,
        docGroupKey: String(req.body.docGroupKey || req.body.fileName || 'doc'),
        fileName: String(req.body.fileName || 'document'),
        fileMime: String(req.body.fileMime || 'application/octet-stream'),
        fileSize: Number(req.body.fileSize || 0),
        plainData: String(req.body.plainData || ''),
        notes: String(req.body.notes || ''),
      });
      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to store encrypted document';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/vault/documents/:id/download', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const doc = await getDecryptedDocumentRecord(access.workspaceOwnerKey, Number(req.params.id));
      if (!doc) return res.status(404).json({ error: 'المستند غير موجود.' });
      await appendAuditLog(access.workspaceOwnerKey, {
        actorEmail,
        actionType: 'export',
        entityType: 'vault_document',
        entityLabel: doc.fileName,
        details: 'فك تشفير وتحميل مستند من الخزينة',
      });
      res.json(doc);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to decrypt document';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/vault/documents/:id/share', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const updated = await createDocumentShareToken(
        access.workspaceOwnerKey,
        actorEmail,
        Number(req.params.id),
        Number(req.body.expiresInDays || 7),
      );
      if (!updated) return res.status(404).json({ error: 'المستند غير موجود.' });
      res.json(updated);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create share token';
      res.status(500).json({ error: msg });
    }
  });

  // Audit Log endpoint
  app.post('/api/audit-logs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const created = await appendAuditLog(access.workspaceOwnerKey, {
        actorEmail,
        actorRole: access.memberRole,
        actionType: String(req.body.actionType || 'export'),
        entityType: String(req.body.entityType || 'report'),
        entityLabel: String(req.body.entityLabel || ''),
        details: String(req.body.details || ''),
      });
      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to log audit event';
      res.status(500).json({ error: msg });
    }
  });

  // Lawyers & Firm Team Members
  app.post('/api/lawyers', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      if (!req.body?.name) {
        return res.status(400).json({ error: 'اسم المحامي مطلوب.' });
      }
      const created = await createLawyerRecord(access.workspaceOwnerKey, actorEmail, {
        name: String(req.body.name).trim(),
        specialty: String(req.body.specialty || 'قانون عام'),
        phone: String(req.body.phone || ''),
        email: String(req.body.email || ''),
        barNumber: String(req.body.barNumber || ''),
        active: req.body.active !== false,
      });
      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to add lawyer';
      res.status(500).json({ error: msg });
    }
  });

  app.delete('/api/lawyers/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const id = Number(req.params.id);
      const deleted = await deleteLawyerRecord(access.workspaceOwnerKey, actorEmail, id);
      if (!deleted) return res.status(404).json({ error: 'المحامي غير موجود.' });
      res.json({ ok: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete lawyer';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/firm-members', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      if (!req.body?.email || !req.body?.fullName) {
        return res.status(400).json({ error: 'البريد الإلكتروني والاسم الكامل مطلوبان.' });
      }
      const created = await createFirmMemberRecord(access.workspaceOwnerKey, actorEmail, {
        email: String(req.body.email),
        fullName: String(req.body.fullName),
        role: req.body.role || 'lawyer',
        permissions: req.body.permissions,
        status: 'active',
      });
      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to add firm member';
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/firm-members/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const updated = await updateFirmMemberRecord(
        access.workspaceOwnerKey,
        Number(req.params.id),
        req.body,
      );
      if (!updated) return res.status(404).json({ error: 'العضو غير موجود.' });
      res.json(updated);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update firm member';
      res.status(500).json({ error: msg });
    }
  });

  app.delete('/api/firm-members/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const ok = await deleteFirmMemberRecord(access.workspaceOwnerKey, Number(req.params.id));
      res.json({ ok });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to remove firm member';
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/settings', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const updated = await updateSettingsRecord(access.workspaceOwnerKey, actorEmail, req.body);
      res.json(updated);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update settings';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/notifications', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actorEmail = (req.user?.email || '').trim().toLowerCase();
      const access = await resolveWorkspaceAccess(req.tenantKey!, actorEmail);
      const created = await createNotificationRecord(access.workspaceOwnerKey, {
        caseId: req.body.caseId ? Number(req.body.caseId) : null,
        recipientName: String(req.body.recipientName || ''),
        recipientPhone: String(req.body.recipientPhone || ''),
        channel: req.body.channel || 'whatsapp',
        message: String(req.body.message || ''),
        status: req.body.status === 'scheduled' ? 'scheduled' : 'sent',
      });
      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to log notification';
      res.status(500).json({ error: msg });
    }
  });

  // Gemini AI: Summarize document
  app.post('/api/ai/summarize', async (req, res) => {
    try {
      const { text, documentTitle, caseSubject } = req.body || {};
      if (!text || String(text).trim().length < 10) {
        return res.status(400).json({ error: 'يرجى توفير نص المذكرة أو المستند لتلخيصه.' });
      }
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({
          error: 'مفتاح Gemini API غير مهيأ في بيئة الخادم. يرجى ضبط GEMINI_API_KEY في الإعدادات.',
        });
      }
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `قم بتلخيص هذا المستند القانوني باللغة العربية الفصحى بأسلوب مهني موجز ومنظم في نقاط واضحة (الوقائع الأساسية، الطلبات أو الدفوع، التوصية العملية):\n\nعنوان المستند: ${documentTitle || 'مذكرة قانونية'}\nموضوع القضية: ${caseSubject || 'عام'}\n\nالنص:\n${text}`,
        config: {
          systemInstruction:
            'أنت مستشار قانوني محترف تساعد المحامين في تلخيص المذكرات والمستندات القضائية بدقة واختصار دون اختلاق معلومات غير واردة في النص.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      res.json({ summary: response.text || '' });
    } catch (error: unknown) {
      console.error('Gemini summarization error:', error);
      const msg = error instanceof Error ? error.message : 'تعذر تلخيص المستند عبر الذكاء الاصطناعي.';
      res.status(500).json({ error: msg });
    }
  });

  // Gemini AI: Auto-OCR extraction for uploaded PDF or Image files
  app.post('/api/ai/ocr', async (req, res) => {
    try {
      const { dataUrl, mimeType, fileName } = req.body || {};
      if (!dataUrl || typeof dataUrl !== 'string') {
        return res.status(400).json({ error: 'يرجى إرفاق ملف صورة أو PDF لاستخراج النص.' });
      }
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'مفتاح Gemini API غير مهيأ في بيئة الخادم.' });
      }
      const base64Match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      const resolvedMime = base64Match ? base64Match[1] : mimeType || 'application/pdf';
      const base64Data = base64Match ? base64Match[2] : dataUrl;

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          {
            inlineData: {
              mimeType: resolvedMime,
              data: base64Data,
            },
          },
          {
            text: `استخرج كافة النصوص والتواريخ والأرقام القضائية الواردة في هذا المستند (${fileName || 'مستند قانوني'}) بدقة عالية دون تلخيص أو حذف.`,
          },
        ],
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      res.json({ extractedText: response.text || '' });
    } catch (error: unknown) {
      console.error('Gemini OCR error:', error);
      const msg = error instanceof Error ? error.message : 'تعذر استخراج النص تلقائياً من المستند.';
      res.status(500).json({ error: msg });
    }
  });

  // Gemini AI: Legal Memo & Defense Drafting Assistant
  app.post('/api/ai/draft-memo', async (req, res) => {
    try {
      const { memoType, caseSubject, clientRole, opponentName, courtName, facts, proceduresSummary } =
        req.body || {};
      if (!caseSubject && !facts) {
        return res.status(400).json({ error: 'يرجى إدخال وقائع أو موضوع القضية لصياغة المذكرة.' });
      }
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'مفتاح Gemini API غير مهيأ في بيئة الخادم.' });
      }
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `قم بصياغة مسودة (${memoType || 'مذكرة دفاع قانونية'}) باللغة العربية القضائية الرصينة:
- المحكمة / الجهة: ${courtName || 'المحكمة المختصة'}
- موضوع القضية: ${caseSubject || ''}
- صفة الموكل: ${clientRole === 'defendant' ? 'مدعى عليه' : 'مدعٍ'}
- الخصم: ${opponentName || ''}
- ملخص الإجراءات السابقة: ${proceduresSummary || 'لا يوجد'}
- الوقائع والطلبات المطلوبة: ${facts || ''}

اجعل الصياغة منظمة: (البسملة والديباجة، الوقائع، الأسانيد والدفوع الشرعية والنظامية، الطلبات الختامية).`,
        config: {
          systemInstruction:
            'أنت محامٍ ومستشار قانوني متمرس تصوغ المذكرات القضائية واللوائح القانونية بأسلوب رصين ومنظم.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      res.json({ draft: response.text || '' });
    } catch (error: unknown) {
      console.error('Gemini draft-memo error:', error);
      const msg = error instanceof Error ? error.message : 'تعذر توليد مسودة المذكرة.';
      res.status(500).json({ error: msg });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
