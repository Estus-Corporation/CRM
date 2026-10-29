import { Request, Response } from 'express';
import {
  listNotifications,
  markRead,
  markAllRead,
  getUnreadCount,
} from './notifications.service';
import { notifyDueFollowups } from '../captacao/captacao.service';

export async function list(req: Request, res: Response) {
  // Captador: retornos vencidos viram notificação na hora em que ele olha a caixa
  if (req.user!.role === 'captador') await notifyDueFollowups(req.tenantId!, req.user!.id).catch(() => undefined);
  const data = await listNotifications(req.tenantId!, req.user!.id);
  return res.json({ data });
}

export async function unreadCount(req: Request, res: Response) {
  if (req.user!.role === 'captador') await notifyDueFollowups(req.tenantId!, req.user!.id).catch(() => undefined);
  const count = await getUnreadCount(req.tenantId!, req.user!.id);
  return res.json({ data: { count } });
}

export async function read(req: Request, res: Response) {
  const n = await markRead(req.tenantId!, req.user!.id, req.params.id);
  return res.json({ data: n });
}

export async function readAll(req: Request, res: Response) {
  await markAllRead(req.tenantId!, req.user!.id);
  return res.status(204).send();
}
