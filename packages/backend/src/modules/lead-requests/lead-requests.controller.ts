import { Request, Response, NextFunction } from 'express';
import * as LeadRequestsService from './lead-requests.service';
import {
  createLeadRequestSchema,
  listLeadRequestsQuerySchema,
  queueQuerySchema,
  progressSchema,
  resultSchema,
  uuidParam,
} from './lead-requests.schema';

/** `:id` que não é UUID vira 404 (não 500) */
function parseId(raw: string) {
  const parsed = uuidParam.safeParse(raw);
  if (!parsed.success) throw Object.assign(new Error('Pedido não encontrado'), { status: 404 });
  return parsed.data;
}

const viewerOf = (req: Request) => ({ id: req.user!.id, role: req.user!.role });

// ── Usuário (JWT) ────────────────────────────────────────────────────────────

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listLeadRequestsQuerySchema.parse(req.query);
    res.json({ data: await LeadRequestsService.listLeadRequests(req.user!.tenantId, viewerOf(req), query) });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createLeadRequestSchema.parse(req.body);
    res.status(201).json({ data: await LeadRequestsService.createLeadRequest(req.user!.tenantId, req.user!.id, input) });
  } catch (err) {
    next(err);
  }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await LeadRequestsService.getLeadRequest(req.user!.tenantId, viewerOf(req), parseId(req.params.id));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await LeadRequestsService.cancelLeadRequest(req.user!.tenantId, viewerOf(req), parseId(req.params.id));
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

// ── Executor (chave de API) ──────────────────────────────────────────────────

export async function queue(req: Request, res: Response, next: NextFunction) {
  try {
    queueQuerySchema.parse(req.query);
    res.json({ data: await LeadRequestsService.listQueue(req.apiKey!.tenantId) });
  } catch (err) {
    next(err);
  }
}

export async function claim(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await LeadRequestsService.claimLeadRequest(req.apiKey!.tenantId, parseId(req.params.id)) });
  } catch (err) {
    next(err);
  }
}

export async function progress(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    const { message } = progressSchema.parse(req.body ?? {});
    res.json({ data: await LeadRequestsService.progressLeadRequest(req.apiKey!.tenantId, id, message) });
  } catch (err) {
    next(err);
  }
}

export async function result(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    const input = resultSchema.parse(req.body);
    res.json({ data: await LeadRequestsService.deliverLeadRequest(req.apiKey!.tenantId, id, input) });
  } catch (err) {
    next(err);
  }
}
