import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as ContactsService from './contacts.service';
import { getContactLeadHunter as getContactLeadHunterInfo } from '../leadhunter/contactView';

export const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype === 'text/csv' || file.originalname.endsWith('.csv'));
  },
});

export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});
import {
  createContactSchema,
  updateContactSchema,
  listContactsQuerySchema,
  bulkImportSchema,
} from './contacts.schema';

export async function listContacts(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listContactsQuerySchema.parse(req.query);
    const result = await ContactsService.listContacts(req.user!.tenantId, query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listNiches(req: Request, res: Response, next: NextFunction) {
  try {
    const niches = await ContactsService.listNiches(req.user!.tenantId);
    res.json({ data: niches });
  } catch (err) {
    next(err);
  }
}

export async function getContact(req: Request, res: Response, next: NextFunction) {
  try {
    const contact = await ContactsService.getContact(req.user!.tenantId, req.params.id);
    res.json({ data: contact });
  } catch (err) {
    next(err);
  }
}

export async function getContactLeadHunter(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getContactLeadHunterInfo(req.user!.tenantId, req.params.id);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function createContact(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createContactSchema.parse(req.body);
    const contact = await ContactsService.createContact(req.user!.tenantId, input);
    res.status(201).json({ data: contact });
  } catch (err) {
    next(err);
  }
}

export async function updateContact(req: Request, res: Response, next: NextFunction) {
  try {
    const input = updateContactSchema.parse(req.body);
    const contact = await ContactsService.updateContact(req.user!.tenantId, req.params.id, input);
    res.json({ data: contact });
  } catch (err) {
    next(err);
  }
}

export async function deleteContact(req: Request, res: Response, next: NextFunction) {
  try {
    await ContactsService.deleteContact(req.user!.tenantId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function importContacts(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) { res.status(400).json({ error: 'CSV file required' }); return; }
    const result = await ContactsService.importContactsCsv(req.user!.tenantId, req.file.buffer);
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
}

export async function importContactsBulk(req: Request, res: Response, next: NextFunction) {
  try {
    const { contacts } = bulkImportSchema.parse(req.body);
    const result = await ContactsService.importContactsBulk(req.user!.tenantId, contacts);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function uploadPhoto(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) { res.status(400).json({ error: 'Image file required' }); return; }
    await ContactsService.uploadContactPhoto(
      req.user!.tenantId,
      req.params.id,
      req.file.buffer,
      req.file.mimetype,
    );
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
}

export async function getPhoto(req: Request, res: Response, next: NextFunction) {
  try {
    const photo = await ContactsService.getContactPhoto(req.params.id);
    if (!photo) { res.status(404).json({ error: 'No photo' }); return; }
    res.setHeader('Content-Type', photo.mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(photo.data);
  } catch (err) { next(err); }
}

export async function deletePhoto(req: Request, res: Response, next: NextFunction) {
  try {
    await ContactsService.deleteContactPhoto(req.user!.tenantId, req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function exportContacts(req: Request, res: Response, next: NextFunction) {
  try {
    const csv = await ContactsService.exportContactsCsv(req.user!.tenantId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
}
