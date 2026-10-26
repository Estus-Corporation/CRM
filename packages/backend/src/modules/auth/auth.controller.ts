import { Request, Response, NextFunction } from 'express';
import * as AuthService from './auth.service';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  updateMeSchema,
  switchWorkspaceSchema,
  createWorkspaceSchema,
} from './auth.schema';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const input = registerSchema.parse(req.body);
    const result = await AuthService.register(input);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const input = loginSchema.parse(req.body);
    const result = await AuthService.login(input);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await AuthService.refresh(refreshToken);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    await AuthService.logout(refreshToken);
    res.json({ data: { message: 'Logged out' } });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await AuthService.getMe(req.user!.id, req.user!.tenantId, req.user!.role);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const input = updateMeSchema.parse(req.body);
    const user = await AuthService.updateMe(req.user!.id, req.user!.tenantId, req.user!.role, input);
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function listWorkspaces(req: Request, res: Response, next: NextFunction) {
  try {
    const workspaces = await AuthService.listWorkspaces(req.user!.id);
    res.json({ data: workspaces });
  } catch (err) {
    next(err);
  }
}

export async function switchWorkspace(req: Request, res: Response, next: NextFunction) {
  try {
    const { tenantId } = switchWorkspaceSchema.parse(req.body);
    const result = await AuthService.switchWorkspace(req.user!.id, tenantId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function createWorkspace(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, keyPeople } = createWorkspaceSchema.parse(req.body);
    const result = await AuthService.createOwnWorkspace(req.user!.id, name, { email, keyPeople });
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function leaveWorkspace(req: Request, res: Response, next: NextFunction) {
  try {
    await AuthService.leaveWorkspace(req.user!.id, req.params.tenantId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
