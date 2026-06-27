import { Request, Response, NextFunction } from 'express';

export function tenantGuard(req: Request, res: Response, next: NextFunction) {
  // req.user.establishmentId is set by auth middleware
  // All routes that use this guard must have requireAuth before it
  if (!req.user?.establishmentId) {
    return res.status(401).json({ error: 'Établissement non identifié' });
  }
  next();
}
