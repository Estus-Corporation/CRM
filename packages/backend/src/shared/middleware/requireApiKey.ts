import { Request, Response, NextFunction } from 'express';
import { authenticateApiKey } from '../../modules/api-keys/api-keys.service';

declare module 'express' {
  interface Request {
    apiKey?: { tenantId: string; scopes: string[] };
  }
}

export function requireApiKey(requiredScope?: 'read' | 'write') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const raw = req.headers['x-api-key'] as string | undefined;
      if (!raw) {
        res.status(401).json({ error: 'Missing X-API-Key header' });
        return;
      }

      const result = await authenticateApiKey(raw);
      if (!result) {
        res.status(401).json({ error: 'Invalid or revoked API key' });
        return;
      }

      if (requiredScope && !result.scopes.includes(requiredScope)) {
        res.status(403).json({ error: 'Insufficient scope', required: requiredScope });
        return;
      }

      req.apiKey = result;
      next();
    } catch (err) {
      next(err);
    }
  };
}
