import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireRole } from '../../shared/middleware/requireRole';
import * as CaptacaoController from './captacao.controller';

const router = Router();

router.use(requireAuth);

// Captador: só os próprios leads (cada consulta filtra por captador_id = usuário logado)
router.get('/me/leads', CaptacaoController.listMyLeads);
router.post('/me/leads', CaptacaoController.createMyLead);
router.get('/me/leads/:id', CaptacaoController.getMyLead);
router.get('/me/admin-busy', CaptacaoController.getAdminBusy);
router.patch('/me/leads/:id', CaptacaoController.updateMyLead);
router.post('/me/leads/:id/whatsapp', CaptacaoController.recordWhatsapp);
router.get('/me/summary', CaptacaoController.getMySummary);
router.get('/me/stats', CaptacaoController.getMyStats);

// Admin / gerente: distribuição, acompanhamento e comissões
const manage = requireRole('admin', 'manager');
router.get('/captadores', manage, CaptacaoController.listCaptadores);
router.post('/captadores/:captadorId/pay-all', requireRole('admin'), CaptacaoController.payAllCommissions);
router.get('/available-contacts', manage, CaptacaoController.listAvailableContacts);
router.post('/leads', manage, CaptacaoController.createLead);
router.get('/assignments', manage, CaptacaoController.listAssignments);
router.post('/assignments', manage, CaptacaoController.assignLeads);
router.patch('/assignments/:id/close', manage, CaptacaoController.closeAssignment);
router.patch('/assignments/:id/payment', requireRole('admin'), CaptacaoController.setCommissionPaid);
router.delete('/assignments/:id', manage, CaptacaoController.unassign);
router.get('/settings', manage, CaptacaoController.getSettings);
router.patch('/settings', requireRole('admin'), CaptacaoController.updateSettings);

export default router;
