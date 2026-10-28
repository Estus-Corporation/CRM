import type { NextFunction, Request, RequestHandler, Response } from 'express';
import {
  companyFiltersQuery,
  exportCompaniesBody,
  foundCompaniesQuery,
  idParams,
  patchCompanyBody,
  sendContactsBody,
} from './leadhunter.schema';
import * as service from './leadhunter.service';

// Mesmo teto de corpo do LeadHunter (1.000.000 bytes). O parser global aceita até 1 MB (1.048.576): este
// teto é conferido depois dele, no Content-Length e no tamanho do JSON já lido (um corpo comprimido tem
// Content-Length pequeno e incha ao ser descompactado).
const BODY_MAX_BYTES = 1_000_000;

export const limitBody: RequestHandler = (req, res, next) => {
  const declared = Number(req.headers['content-length']);
  const parsed = Buffer.byteLength(JSON.stringify(req.body ?? {}));
  if (parsed > BODY_MAX_BYTES || (Number.isFinite(declared) && declared > BODY_MAX_BYTES)) {
    res.status(413).json({ error: 'Arquivo vazio ou acima de 1 MB.' });
    return;
  }
  next();
};

/** Express 4 não repassa rejeição de handler assíncrono: tudo vai para o errorHandler. */
const handle =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const tenantOf = (req: Request): string => req.user!.tenantId;
const idOf = (req: Request): string => idParams.parse(req.params).id;

function sendCsv(res: Response, file: { csv: string; filename: string }): void {
  res.attachment(file.filename).send(file.csv);
}

export const status = handle(async (_req, res) => {
  res.json({ data: await service.status() });
});

export const listCampaigns = handle(async (req, res) => {
  res.json({ data: await service.listCampaigns(tenantOf(req)) });
});

export const estimate = handle(async (req, res) => {
  res.json({ data: await service.estimate(tenantOf(req), req.body) });
});

export const createCampaign = handle(async (req, res) => {
  const { id } = await service.createCampaignChecked(tenantOf(req), req.user!.id, req.body);
  res.status(201).json({ data: { id } });
});

export const importCampaign = handle(async (req, res) => {
  const id = await service.importCampaign(tenantOf(req), req.user!.id, req.body);
  res.status(201).json({ data: { id } });
});

export const getCampaign = handle(async (req, res) => {
  const filters = companyFiltersQuery.parse(req.query);
  res.json({ data: await service.getCampaignDetail(tenantOf(req), idOf(req), filters) });
});

export const exportCampaign = handle(async (req, res) => {
  const filters = companyFiltersQuery.parse(req.query);
  sendCsv(res, await service.exportCampaignCsv(tenantOf(req), idOf(req), filters));
});

export const cancelCampaign = handle(async (req, res) => {
  await service.cancelCampaign(tenantOf(req), idOf(req));
  res.json({ data: { ok: true } });
});

export const sendContacts = handle(async (req, res) => {
  const id = idOf(req);
  const body = sendContactsBody.parse(req.body);
  res.json({ data: await service.sendContacts(tenantOf(req), id, body) });
});

export const companyHistory = handle(async (req, res) => {
  res.json({ data: await service.companyHistory(tenantOf(req), idOf(req)) });
});

export const patchCompany = handle(async (req, res) => {
  const id = idOf(req);
  await service.patchCompany(tenantOf(req), id, patchCompanyBody.parse(req.body));
  res.json({ data: { ok: true } });
});

export const deleteCompany = handle(async (req, res) => {
  await service.removeCompany(tenantOf(req), idOf(req));
  res.json({ data: { ok: true } });
});

export const listSearches = handle(async (req, res) => {
  res.json({ data: await service.listSearches(tenantOf(req)) });
});

export const foundCompanies = handle(async (req, res) => {
  const { demo } = foundCompaniesQuery.parse(req.query);
  res.json({ data: await service.foundCompanies(tenantOf(req), demo === '1') });
});

export const exportFoundCompanies = handle(async (req, res) => {
  const { companyIds } = exportCompaniesBody.parse(req.body ?? {});
  sendCsv(res, await service.exportCompaniesCsv(tenantOf(req), companyIds));
});
