import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth';
import * as InvitesController from './invites.controller';

// Convites recebidos pela pessoa logada (valem em qualquer workspace em que ela esteja)
const router = Router();

router.get('/', requireAuth, InvitesController.listMyInvites);
router.post('/:id/accept', requireAuth, InvitesController.acceptInvite);
router.post('/:id/decline', requireAuth, InvitesController.declineInvite);

export default router;
