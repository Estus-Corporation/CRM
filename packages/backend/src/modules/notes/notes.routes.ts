import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../shared/middleware/requireAuth';
import { db } from '../../db';

const router = Router();

const saveNoteSchema = z.object({
  content: z.string().max(50000),
});

// Bloco de notas do próprio usuário — sempre filtrado por tenant + usuário logado
router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const note = await db('user_notes')
      .where({ tenant_id: req.user!.tenantId, user_id: req.user!.id })
      .first('content', 'updated_at');
    res.json({ data: note ?? { content: '', updated_at: null } });
  } catch (err) {
    next(err);
  }
});

router.put('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content } = saveNoteSchema.parse(req.body);
    const [note] = await db('user_notes')
      .insert({ tenant_id: req.user!.tenantId, user_id: req.user!.id, content })
      .onConflict(['tenant_id', 'user_id'])
      .merge({ content, updated_at: new Date() })
      .returning(['content', 'updated_at']);
    res.json({ data: note });
  } catch (err) {
    next(err);
  }
});

export default router;
