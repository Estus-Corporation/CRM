import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireRole } from '../../shared/middleware/requireRole';
import * as FinanceController from './finance.controller';

const router = Router();

// Dados de lucro, sócios e pró-labore: só o admin do workspace
router.use(requireAuth, requireRole('admin'));

router.get('/expenses', FinanceController.listExpenses);
router.post('/expenses', FinanceController.createExpense);
router.patch('/expenses/:id', FinanceController.updateExpense);
router.delete('/expenses/:id', FinanceController.deleteExpense);
router.put('/expenses/:id/payments/:month', FinanceController.setPayment);

router.get('/taxes', FinanceController.listTaxes);
router.put('/taxes', FinanceController.replaceTaxes);

router.get('/partners', FinanceController.listPartners);
router.put('/partners', FinanceController.replacePartners);

export default router;
