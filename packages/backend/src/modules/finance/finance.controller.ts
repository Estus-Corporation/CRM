import { Request, Response, NextFunction } from 'express';
import * as FinanceService from './finance.service';
import {
  createExpenseSchema,
  monthParam,
  replacePartnersSchema,
  replaceTaxesSchema,
  setPaymentSchema,
  updateExpenseSchema,
  uuidParam,
} from './finance.schemas';

/** `:id`/`:month` inválidos viram 422 (ZodError) antes de tocar o banco */
const parseId = (raw: string) => uuidParam.parse(raw);

export async function listExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await FinanceService.listExpenses(req.user!.tenantId) });
  } catch (err) {
    next(err);
  }
}

export async function createExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createExpenseSchema.parse(req.body);
    res.status(201).json({ data: await FinanceService.createExpense(req.user!.tenantId, input) });
  } catch (err) {
    next(err);
  }
}

export async function updateExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const patch = updateExpenseSchema.parse(req.body);
    res.json({ data: await FinanceService.updateExpense(req.user!.tenantId, parseId(req.params.id), patch) });
  } catch (err) {
    next(err);
  }
}

export async function deleteExpense(req: Request, res: Response, next: NextFunction) {
  try {
    await FinanceService.deleteExpense(req.user!.tenantId, parseId(req.params.id));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function setPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const month = monthParam.parse(req.params.month);
    const { paid } = setPaymentSchema.parse(req.body);
    res.json({ data: await FinanceService.setPayment(req.user!.tenantId, parseId(req.params.id), month, paid) });
  } catch (err) {
    next(err);
  }
}

export async function listTaxes(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await FinanceService.listTaxes(req.user!.tenantId) });
  } catch (err) {
    next(err);
  }
}

export async function replaceTaxes(req: Request, res: Response, next: NextFunction) {
  try {
    const { taxes } = replaceTaxesSchema.parse(req.body);
    res.json({ data: await FinanceService.replaceTaxes(req.user!.tenantId, taxes) });
  } catch (err) {
    next(err);
  }
}

export async function listPartners(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await FinanceService.listPartners(req.user!.tenantId) });
  } catch (err) {
    next(err);
  }
}

export async function replacePartners(req: Request, res: Response, next: NextFunction) {
  try {
    const { partners } = replacePartnersSchema.parse(req.body);
    res.json({ data: await FinanceService.replacePartners(req.user!.tenantId, partners) });
  } catch (err) {
    next(err);
  }
}

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const month = req.query.month === undefined ? undefined : monthParam.parse(req.query.month);
    res.json({ data: await FinanceService.getSummary(req.user!.tenantId, month) });
  } catch (err) {
    next(err);
  }
}
