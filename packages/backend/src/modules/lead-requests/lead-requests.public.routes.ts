import { Router } from 'express';
import { requireApiKey } from '../../shared/middleware/requireApiKey';
import * as LeadRequestsController from './lead-requests.controller';

// Fila de pedidos consumida pelo Radar Local (chave de API; o workspace vem sempre da chave)
const router = Router();

router.get('/', requireApiKey('read'), LeadRequestsController.queue);
router.post('/:id/claim', requireApiKey('write'), LeadRequestsController.claim);
router.post('/:id/progress', requireApiKey('write'), LeadRequestsController.progress);
router.post('/:id/result', requireApiKey('write'), LeadRequestsController.result);

export default router;
