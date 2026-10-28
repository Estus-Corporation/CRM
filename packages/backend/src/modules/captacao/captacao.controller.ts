import { Request, Response, NextFunction } from 'express';
import * as CaptacaoService from './captacao.service';
import {
  updateMyLeadSchema,
  myLeadsQuerySchema,
  assignLeadsSchema,
  availableContactsQuerySchema,
  assignmentsQuerySchema,
  closeAssignmentSchema,
  commissionPaymentSchema,
  updateSettingsSchema,
  createLeadSchema,
} from './captacao.schema';

type Handler = (req: Request, res: Response) => Promise<void>;

// Encaminha erros (Zod → 422, status customizados) para o errorHandler
const wrap = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

// ── Captador ────────────────────────────────────────────────────────────────

export const listMyLeads = wrap(async (req, res) => {
  const query = myLeadsQuerySchema.parse(req.query);
  // Distribuição automática: completa a cota do dia antes de listar
  await CaptacaoService.topUpDailyLeads(req.user!.tenantId, req.user!.id);
  const data = await CaptacaoService.listMyLeads(req.user!.tenantId, req.user!.id, query);
  res.json({ data });
});

// Lead cadastrado pelo próprio captador: sempre atribuído a ele (o captadorId do corpo é ignorado)
export const createMyLead = wrap(async (req, res) => {
  const input = createLeadSchema.parse(req.body);
  try {
    const data = await CaptacaoService.createLead(req.user!.tenantId, req.user!.id, { ...input, captadorId: req.user!.id });
    res.status(201).json({ data });
  } catch (err) {
    // Duplicado: não devolve o nome do contato existente (o captador não enxerga os contatos do workspace)
    if ((err as { code?: string }).code === 'duplicate_lead') delete (err as { existing?: string }).existing;
    throw err;
  }
});

// Horários ocupados dos admins (padrão: hoje + 14 dias)
export const getAdminBusy = wrap(async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().setHours(0, 0, 0, 0));
  const to = req.query.to ? new Date(String(req.query.to)) : new Date(from.getTime() + 15 * 86_400_000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    res.status(422).json({ error: 'Invalid range' });
    return;
  }
  // Até 60 dias por consulta
  const capped = new Date(Math.min(to.getTime(), from.getTime() + 60 * 86_400_000));
  res.json({ data: await CaptacaoService.getAdminBusy(req.user!.tenantId, from, capped) });
});

export const getMyLead = wrap(async (req, res) => {
  const data = await CaptacaoService.getMyLead(req.user!.tenantId, req.user!.id, req.params.id);
  res.json({ data });
});

export const updateMyLead = wrap(async (req, res) => {
  const input = updateMyLeadSchema.parse(req.body);
  const data = await CaptacaoService.updateMyLead(req.user!.tenantId, req.user!.id, req.params.id, input);
  res.json({ data });
});

// Plano B: o captador abriu o WhatsApp do lead (fica registrado pros admins)
export const recordWhatsapp = wrap(async (req, res) => {
  const data = await CaptacaoService.recordWhatsapp(req.user!.tenantId, req.user!.id, req.params.id);
  res.json({ data });
});

export const getMyStats = wrap(async (req, res) => {
  const days = req.query.period === 'month' ? 30 : 7;
  res.json({ data: await CaptacaoService.getMyStats(req.user!.tenantId, req.user!.id, days) });
});

export const getMySummary = wrap(async (req, res) => {
  await CaptacaoService.topUpDailyLeads(req.user!.tenantId, req.user!.id);
  const data = await CaptacaoService.getMySummary(req.user!.tenantId, req.user!.id);
  res.json({ data });
});

// ── Admin / gerente ─────────────────────────────────────────────────────────

export const listCaptadores = wrap(async (req, res) => {
  const data = await CaptacaoService.listCaptadores(req.user!.tenantId);
  res.json({ data });
});

export const listAvailableContacts = wrap(async (req, res) => {
  const query = availableContactsQuerySchema.parse(req.query);
  res.json(await CaptacaoService.listAvailableContacts(req.user!.tenantId, query));
});

export const getLeadForManager = wrap(async (req, res) => {
  const data = await CaptacaoService.getLeadForManager(req.user!.tenantId, req.params.id);
  res.json({ data });
});

export const assignLeads = wrap(async (req, res) => {
  const input = assignLeadsSchema.parse(req.body);
  const data = await CaptacaoService.assignLeads(req.user!.tenantId, req.user!.id, input);
  res.status(201).json({ data });
});

export const listAssignments = wrap(async (req, res) => {
  const query = assignmentsQuerySchema.parse(req.query);
  res.json(await CaptacaoService.listAssignments(req.user!.tenantId, query));
});

export const closeAssignment = wrap(async (req, res) => {
  const input = closeAssignmentSchema.parse(req.body);
  const data = await CaptacaoService.closeAssignment(req.user!.tenantId, req.user!.id, req.params.id, input);
  res.json({ data });
});

export const setCommissionPaid = wrap(async (req, res) => {
  const { paid } = commissionPaymentSchema.parse(req.body);
  const data = await CaptacaoService.setCommissionPaid(req.user!.tenantId, req.params.id, paid);
  res.json({ data });
});

export const payAllCommissions = wrap(async (req, res) => {
  const data = await CaptacaoService.payAllCommissions(req.user!.tenantId, req.params.captadorId);
  res.json({ data });
});

export const unassign = wrap(async (req, res) => {
  await CaptacaoService.unassign(req.user!.tenantId, req.user!.id, req.params.id);
  res.status(204).send();
});

export const getSettings = wrap(async (req, res) => {
  res.json({ data: await CaptacaoService.getSettings(req.user!.tenantId) });
});

export const updateSettings = wrap(async (req, res) => {
  const input = updateSettingsSchema.parse(req.body);
  res.json({ data: await CaptacaoService.updateSettings(req.user!.tenantId, input) });
});

export const createLead = wrap(async (req, res) => {
  const input = createLeadSchema.parse(req.body);
  const data = await CaptacaoService.createLead(req.user!.tenantId, req.user!.id, input);
  res.status(201).json({ data });
});
