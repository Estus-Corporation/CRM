import { Request, Response, NextFunction } from 'express';
import { db } from '../../db';

/**
 * Libera o LeadHunter só para workspaces com a flag ligada (`tenants.leadhunter_enabled`, mexida só por SQL).
 * Lê do banco a cada chamada (como o requireTier) e responde 404: para os demais o módulo "não existe".
 */
export async function requireLeadHunter(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const tenant = await db('tenants').where({ id: req.user.tenantId }).first('leadhunter_enabled');
    if (!tenant?.leadhunter_enabled) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
