import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireRole } from '../../shared/middleware/requireRole';
import * as UsersController from './users.controller';

const router = Router();

// Equipe do workspace (vínculos). A conta da pessoa é dela — aqui só entra/sai do workspace.
router.get('/', requireAuth, requireRole('manager', 'admin'), UsersController.listUsers);
router.post('/invite', requireAuth, requireRole('admin'), UsersController.inviteUser);
// Convites ainda sem resposta (a pessoa aceita/recusa em /invites)
router.get('/invites', requireAuth, requireRole('manager', 'admin'), UsersController.listInvites);
router.delete('/invites/:inviteId', requireAuth, requireRole('admin'), UsersController.cancelInvite);
router.patch('/:id', requireAuth, requireRole('admin'), UsersController.updateUser);
router.delete('/:id', requireAuth, requireRole('admin'), UsersController.deleteUser);

export default router;
