import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';
import { env } from '../../config/env';

const secret = new TextEncoder().encode(env.JWT_SECRET);

// Captador só enxerga os próprios leads: tudo fora desta lista é negado por padrão,
// inclusive rotas criadas no futuro.
const CAPTADOR_ALLOWED: Array<{ prefix: string; methods?: string[] }> = [
  { prefix: '/api/v1/auth' },
  { prefix: '/api/v1/captacao/me' },
  { prefix: '/api/v1/notifications' },
  { prefix: '/api/v1/notes' },
  { prefix: '/api/v1/lead-requests' },
  { prefix: '/api/v1/tenant', methods: ['GET'] },
];

function captadorCanAccess(req: Request) {
  const path = req.originalUrl.split('?')[0];
  return CAPTADOR_ALLOWED.some(
    ({ prefix, methods }) =>
      (path === prefix || path.startsWith(`${prefix}/`)) && (!methods || methods.includes(req.method)),
  );
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, secret);
    req.user = {
      id: payload.sub as string,
      tenantId: payload.tenantId as string,
      role: payload.role as Express.User['role'],
      email: payload.email as string,
    };
    req.tenantId = payload.tenantId as string;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  if (req.user.role === 'captador' && !captadorCanAccess(req)) {
    res.status(403).json({ error: 'Insufficient permissions' });
    return;
  }
  next();
}
