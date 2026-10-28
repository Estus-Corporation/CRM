import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireLeadHunter } from '../../shared/middleware/requireLeadHunter';
import { requireRole } from '../../shared/middleware/requireRole';
import * as LeadRequestsController from './lead-requests.controller';

// Pedidos de leads (JWT) — só admin, e só em workspace com o LeadHunter ligado (404 antes da checagem de papel)
const router = Router();

router.use(requireAuth, requireLeadHunter, requireRole('admin'));

router.get('/', LeadRequestsController.list);
router.post('/', LeadRequestsController.create);
router.get('/:id', LeadRequestsController.getOne);
router.post('/:id/cancel', LeadRequestsController.cancel);
router.post('/:id/execute', LeadRequestsController.execute);
router.post('/:id/reject', LeadRequestsController.reject);

export default router;
