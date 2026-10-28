import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { requireLeadHunter } from '../../shared/middleware/requireLeadHunter';
import { requireRole } from '../../shared/middleware/requireRole';
import * as LeadHunterController from './leadhunter.controller';

// LeadHunter: só admin e só em workspace com a flag ligada (404 para os demais, antes da checagem de papel).
const router = Router();

router.use(requireAuth, requireLeadHunter, requireRole('admin'));
router.use(LeadHunterController.limitBody);

router.get('/status', LeadHunterController.status);

router.get('/campaigns', LeadHunterController.listCampaigns);
router.post('/campaigns', LeadHunterController.createCampaign);
router.post('/campaigns/estimate', LeadHunterController.estimate);
router.get('/campaigns/:id', LeadHunterController.getCampaign);
router.get('/campaigns/:id/export', LeadHunterController.exportCampaign);
router.post('/campaigns/:id/cancel', LeadHunterController.cancelCampaign);
router.post('/campaigns/:id/contacts', LeadHunterController.sendContacts);
router.post('/import', LeadHunterController.importCampaign);

router.get('/companies/:id/history', LeadHunterController.companyHistory);
router.patch('/companies/:id', LeadHunterController.patchCompany);
router.delete('/companies/:id', LeadHunterController.deleteCompany);

router.get('/searches', LeadHunterController.listSearches);
router.get('/found-companies', LeadHunterController.foundCompanies);
router.post('/found-companies/export', LeadHunterController.exportFoundCompanies);

export default router;
