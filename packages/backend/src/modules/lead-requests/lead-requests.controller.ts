import { Request, Response, NextFunction } from 'express';
import * as LeadRequestsService from './lead-requests.service';
import {
  createLeadRequestSchema,
  executeLeadRequestSchema,
  listLeadRequestsQuerySchema,
  rejectLeadRequestSchema,
  uuidParam,
} from './lead-requests.schema';

/** `:id` que não é UUID vira 422 (ZodError) antes de tocar o banco */
const parseId = (raw: string) => uuidParam.parse(raw);

const viewerOf = (req: Request) => ({ id: req.user!.id, role: req.user!.role });

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

export async function execute(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    const edits = executeLeadRequestSchema.parse(req.body ?? {});
    res.json({ data: await LeadRequestsService.executeLeadRequest(req.user!.tenantId, req.user!.id, id, edits) });
  } catch (err) {
    next(err);
  }
}

export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseId(req.params.id);
    const { message } = rejectLeadRequestSchema.parse(req.body ?? {});
    res.json({ data: await LeadRequestsService.rejectLeadRequest(req.user!.tenantId, req.user!.id, id, message) });
  } catch (err) {
    next(err);
  }
}
