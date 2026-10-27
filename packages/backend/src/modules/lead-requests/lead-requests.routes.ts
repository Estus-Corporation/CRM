import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth';
import * as LeadRequestsController from './lead-requests.controller';

// Pedidos de leads feitos pelos usuários do workspace (JWT)
const router = Router();

router.use(requireAuth);

router.get('/', LeadRequestsController.list);
router.post('/', LeadRequestsController.create);
router.get('/:id', LeadRequestsController.getOne);
router.post('/:id/cancel', LeadRequestsController.cancel);

export default router;
