import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: 'Validation failed',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  if (err instanceof Error) {
    const status = (err as any).status as number | undefined;
    if (status && status < 500) {
      const body: Record<string, unknown> = { error: err.message };
      if ((err as any).code) body.code = (err as any).code;
      if ((err as any).requiredPlan) body.requiredPlan = (err as any).requiredPlan;
      // Lead duplicado: nome do contato que já existe, pra mostrar no aviso
      if ((err as any).existing) body.existing = (err as any).existing;
      res.status(status).json(body);
      return;
    }
    console.error(err);
    res.status(500).json({ error: err.message });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
