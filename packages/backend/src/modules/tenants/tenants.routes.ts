import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireRole } from '../../shared/middleware/requireRole';
import * as TenantsController from './tenants.controller';

const router = Router();

router.get('/', requireAuth, TenantsController.getTenant);
// Quem do espaço está online agora (visto nos últimos 2 minutos)
router.get('/online', requireAuth, TenantsController.getOnlineMembers);
router.patch('/', requireAuth, requireRole('admin'), TenantsController.updateTenant);
// Serviços e preços em arquivo (PDF/DOCX): toda a equipe baixa, só o admin troca
router.get('/offer-file', requireAuth, TenantsController.getOfferFile);
router.post('/offer-file', requireAuth, requireRole('admin'), TenantsController.offerFileUpload.single('file'), TenantsController.uploadOfferFile);
router.delete('/offer-file', requireAuth, requireRole('admin'), TenantsController.deleteOfferFile);

export default router;
