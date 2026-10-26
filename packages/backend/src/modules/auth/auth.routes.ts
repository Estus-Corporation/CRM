import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth';
import * as AuthController from './auth.controller';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);
router.get('/me', requireAuth, AuthController.getMe);
router.patch('/me', requireAuth, AuthController.updateMe);
router.get('/workspaces', requireAuth, AuthController.listWorkspaces);
router.post('/switch-workspace', requireAuth, AuthController.switchWorkspace);
// Conta independente: criar o próprio workspace / sair de um
router.post('/workspaces', requireAuth, AuthController.createWorkspace);
router.delete('/workspaces/:tenantId/membership', requireAuth, AuthController.leaveWorkspace);

export default router;
