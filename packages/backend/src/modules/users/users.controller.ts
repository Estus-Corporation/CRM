import { Request, Response, NextFunction } from 'express';
import * as UsersService from './users.service';

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await UsersService.listUsers(req.user!.tenantId, req.query as Record<string, unknown>);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function inviteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const input = UsersService.inviteUserSchema.parse(req.body);
    const user = await UsersService.inviteUser(req.user!.tenantId, req.user!.id, input);
    res.status(201).json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const input = UsersService.updateUserSchema.parse(req.body);
    const user = await UsersService.updateUser(req.user!.tenantId, req.params.id, input);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.params.id === req.user!.id) {
      throw Object.assign(new Error('Use "sair do workspace" em Minha conta'), { status: 400 });
    }
    await UsersService.deleteUser(req.user!.tenantId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function listInvites(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await UsersService.listTenantInvites(req.user!.tenantId) });
  } catch (err) {
    next(err);
  }
}

export async function cancelInvite(req: Request, res: Response, next: NextFunction) {
  try {
    await UsersService.cancelInvite(req.user!.tenantId, req.params.inviteId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
