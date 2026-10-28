import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireRole } from '../../shared/middleware/requireRole';
import * as LeadRequestsController from './lead-requests.controller';

// Pedidos de leads (JWT) — só admin
const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', LeadRequestsController.list);
router.post('/', LeadRequestsController.create);
router.get('/:id', LeadRequestsController.getOne);
router.post('/:id/cancel', LeadRequestsController.cancel);

export default router;
