import { Router, Request, Response, NextFunction } from 'express';
import { requireApiKey } from '../../shared/middleware/requireApiKey';
import { z } from 'zod';
import { listContacts, createContact, importContactsBulk } from '../contacts/contacts.service';
import { bulkContactSchema, createContactSchema } from '../contacts/contacts.schema';
import { listActiveMembers, findActiveMemberByEmail } from '../users/users.service';
import { listDeals } from '../deals/deals.service';
import { getPaginationParams } from '../../shared/utils/paginate';

const router = Router();

const leadsBulkSchema = z.object({
  ownerEmail: z.string().email().optional(),
  leads: z
    .array(
      bulkContactSchema.extend({
        city: z.string().max(100).optional(),
        leadScore: z.number().int().min(0).max(100).optional(),
        externalId: z.string().min(1).max(100),
      }),
    )
    .min(1)
    .max(500),
});

// GET /public/users
router.get(
  '/users',
  requireApiKey('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await listActiveMembers(req.apiKey!.tenantId);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

// POST /public/leads/bulk
router.post(
  '/leads/bulk',
  requireApiKey('write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.apiKey!.tenantId;
      const { ownerEmail, leads } = leadsBulkSchema.parse(req.body);

      let ownerId: string | null = null;
      if (ownerEmail) {
        const owner = await findActiveMemberByEmail(tenantId, ownerEmail);
        if (!owner) {
          throw Object.assign(new Error('ownerEmail não é membro ativo deste workspace'), {
            status: 422,
            code: 'invalid_owner',
          });
        }
        ownerId = owner.id;
      }

      const data = await importContactsBulk(tenantId, leads, { ownerId, source: 'leadhunter' });
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  },
);

// GET /public/contacts
router.get(
  '/contacts',
  requireApiKey('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.apiKey!.tenantId;
      const { page, limit } = getPaginationParams(req.query as Record<string, string>);
      const data = await listContacts(tenantId, { page, limit });
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

// POST /public/contacts
router.post(
  '/contacts',
  requireApiKey('write'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.apiKey!.tenantId;
      const contact = await createContact(tenantId, createContactSchema.parse(req.body));
      res.status(201).json({ data: contact });
    } catch (err) {
      next(err);
    }
  },
);

// GET /public/deals
router.get(
  '/deals',
  requireApiKey('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.apiKey!.tenantId;
      const { page, limit } = getPaginationParams(req.query as Record<string, string>);
      const data = await listDeals(tenantId, { page, limit });
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
