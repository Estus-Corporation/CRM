import { Request, Response, NextFunction } from 'express';
import * as InvitesService from './invites.service';

export async function listMyInvites(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await InvitesService.listMyInvites(req.user!.id) });
  } catch (err) {
    next(err);
  }
}

export async function acceptInvite(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await InvitesService.acceptInvite(req.user!.id, req.params.id) });
  } catch (err) {
    next(err);
  }
}

export async function declineInvite(req: Request, res: Response, next: NextFunction) {
  try {
    await InvitesService.declineInvite(req.user!.id, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
