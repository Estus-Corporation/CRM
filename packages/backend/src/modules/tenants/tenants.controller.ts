import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as TenantsService from './tenants.service';

export async function getOnlineMembers(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await TenantsService.getOnlineMembers(req.user!.tenantId) });
  } catch (err) {
    next(err);
  }
}

export async function getTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = await TenantsService.getTenant(req.user!.tenantId);
    res.json({ data: tenant });
  } catch (err) {
    next(err);
  }
}

export async function updateTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const input = TenantsService.updateTenantSchema.parse(req.body);
    const tenant = await TenantsService.updateTenant(req.user!.tenantId, input);
    res.json({ data: tenant });
  } catch (err) {
    next(err);
  }
}

export const offerFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype in TenantsService.OFFER_FILE_TYPES);
  },
});

export async function uploadOfferFile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      res.status(422).json({ error: 'Envie um arquivo PDF ou DOCX', code: 'invalid_file' });
      return;
    }
    const tenant = await TenantsService.setOfferFile(req.user!.tenantId, req.file);
    res.json({ data: tenant });
  } catch (err) {
    next(err);
  }
}

export async function getOfferFile(req: Request, res: Response, next: NextFunction) {
  try {
    const file = await TenantsService.getOfferFile(req.user!.tenantId);
    if (!file) {
      res.status(404).json({ error: 'Nenhum arquivo' });
      return;
    }
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.setHeader('Cache-Control', 'private, no-cache');
    res.send(file.data);
  } catch (err) {
    next(err);
  }
}

export async function deleteOfferFile(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = await TenantsService.deleteOfferFile(req.user!.tenantId);
    res.json({ data: tenant });
  } catch (err) {
    next(err);
  }
}
