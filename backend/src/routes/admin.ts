import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

export const adminRouter = Router();

adminRouter.use(requireAuth, tenantGuard);

// ── DASHBOARD STATS ──
adminRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const eid = req.user!.establishmentId;
    const today = new Date().toISOString().slice(0, 10);

    const totalResidents = await prisma.resident.count({
      where: { establishmentId: eid, status: { not: 'sorti' } },
    });

    const todayEntries = await prisma.journalEntry.count({
      where: { establishmentId: eid, date: { startsWith: today } },
    });

    const totalEvents = await prisma.planningEvent.count({
      where: { establishmentId: eid, type: { not: 'vehicule' } },
    });

    const vehiculeResa = await prisma.planningEvent.count({
      where: { establishmentId: eid, type: 'vehicule', date: { gte: today } },
    });

    // Presence count for today
    const presences = await prisma.presence.findMany({
      where: { establishmentId: eid, date: today },
    });
    const presentsToday = presences.filter(p => p.status === 'present').length;

    res.json({
      totalResidents,
      todayEntries,
      totalEvents,
      vehiculeResa,
      presentsToday,
      totalPresences: presences.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── SETTINGS ──
adminRouter.get('/settings', async (req: Request, res: Response) => {
  try {
    const est = await prisma.establishment.findUnique({
      where: { id: req.user!.establishmentId },
    });
    if (!est) return res.status(404).json({ error: 'Établissement introuvable' });
    res.json({
      etablissement: est.name,
      ville: est.city,
      finess: est.finess,
      tel: est.phone,
      email: est.email,
      adresse: est.address,
      typeStructure: est.type,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

adminRouter.put('/settings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = req.body;
    await prisma.establishment.update({
      where: { id: req.user!.establishmentId },
      data: {
        name: data.etablissement,
        city: data.ville,
        finess: data.finess,
        phone: data.tel,
        email: data.email,
        address: data.adresse,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

adminRouter.put('/settings/type', requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.establishment.update({
      where: { id: req.user!.establishmentId },
      data: { type: req.body.typeStructure },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── BRANDING ──
adminRouter.get('/branding', async (req: Request, res: Response) => {
  try {
    const est = await prisma.establishment.findUnique({
      where: { id: req.user!.establishmentId },
      select: { primaryColor: true, accentColor: true, logo: true },
    });
    res.json(est);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

adminRouter.put('/branding', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { primaryColor, accentColor, logo } = req.body;
    await prisma.establishment.update({
      where: { id: req.user!.establishmentId },
      data: {
        primaryColor: primaryColor || '#0f2b4a',
        accentColor: accentColor || '#e85d04',
        logo: logo ?? undefined,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── CATEGORIES ──
adminRouter.get('/categories', async (req: Request, res: Response) => {
  try {
    const cats = await prisma.category.findMany({
      where: { establishmentId: req.user!.establishmentId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(cats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

adminRouter.post('/categories', requireAdmin, async (req: Request, res: Response) => {
  try {
    const cat = await prisma.category.create({
      data: {
        establishmentId: req.user!.establishmentId,
        name: req.body.name,
        color: req.body.color || '#3b82f6',
      },
    });
    res.status(201).json(cat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

adminRouter.put('/categories/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.category.updateMany({
      where: { id: req.params.id, establishmentId: req.user!.establishmentId },
      data: { name: req.body.name, color: req.body.color },
    });
    const updated = await prisma.category.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

adminRouter.delete('/categories/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.category.deleteMany({
      where: { id: req.params.id, establishmentId: req.user!.establishmentId },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── OBJECTIVES ──
adminRouter.get('/objectives', async (req: Request, res: Response) => {
  try {
    const objs = await prisma.objective.findMany({
      where: { establishmentId: req.user!.establishmentId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(objs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

adminRouter.post('/objectives', requireAdmin, async (req: Request, res: Response) => {
  try {
    const obj = await prisma.objective.create({
      data: {
        establishmentId: req.user!.establishmentId,
        name: req.body.name,
        description: req.body.description || '',
      },
    });
    res.status(201).json(obj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

adminRouter.put('/objectives/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.objective.updateMany({
      where: { id: req.params.id, establishmentId: req.user!.establishmentId },
      data: { name: req.body.name, description: req.body.description },
    });
    const updated = await prisma.objective.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

adminRouter.delete('/objectives/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.objective.deleteMany({
      where: { id: req.params.id, establishmentId: req.user!.establishmentId },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── USERS (educators) ──
adminRouter.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { establishmentId: req.user!.establishmentId },
      select: { id: true, firstName: true, lastName: true, username: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

adminRouter.post('/users', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
    }
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(409).json({ error: 'Cet identifiant est déjà utilisé' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        establishmentId: req.user!.establishmentId,
        firstName: firstName || '',
        lastName: lastName || '',
        username,
        passwordHash,
        role: role || 'educateur',
      },
      select: { id: true, firstName: true, lastName: true, username: true, role: true },
    });
    res.status(201).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

adminRouter.put('/users/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, username, password } = req.body;
    const data: any = { firstName, lastName, username };
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 12);
    }
    await prisma.user.updateMany({
      where: { id: req.params.id, establishmentId: req.user!.establishmentId },
      data,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

adminRouter.delete('/users/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.user.deleteMany({
      where: { id: req.params.id, establishmentId: req.user!.establishmentId },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── ACCOUNT (current user) ──
adminRouter.get('/account', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, firstName: true, lastName: true, username: true, email: true, role: true },
    });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

adminRouter.put('/account/profile', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email } = req.body;
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { firstName, lastName, email },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

adminRouter.put('/account/credentials', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const data: any = {};
    if (username) data.username = username;
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 12);
    }
    await prisma.user.update({
      where: { id: req.user!.userId },
      data,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── VEHICLES ──
adminRouter.get('/vehicles', async (req: Request, res: Response) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { establishmentId: req.user!.establishmentId },
      orderBy: { name: 'asc' },
    });
    res.json(vehicles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

adminRouter.post('/vehicles', requireAdmin, async (req: Request, res: Response) => {
  try {
    const v = await prisma.vehicle.create({
      data: {
        establishmentId: req.user!.establishmentId,
        name: req.body.name,
      },
    });
    res.status(201).json(v);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

adminRouter.delete('/vehicles/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.vehicle.deleteMany({
      where: { id: req.params.id, establishmentId: req.user!.establishmentId },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── DATA ──
adminRouter.get('/export', async (req: Request, res: Response) => {
  try {
    const eid = req.user!.establishmentId;
    const data: any = {};
    const type = req.query.type as string;

    if (type === 'residents' || type === 'all') {
      data.residents = await prisma.resident.findMany({ where: { establishmentId: eid } });
    }
    if (type === 'journal' || type === 'all') {
      data.journal = await prisma.journalEntry.findMany({ where: { establishmentId: eid } });
    }
    if (type === 'all') {
      data.categories = await prisma.category.findMany({ where: { establishmentId: eid } });
      data.objectives = await prisma.objective.findMany({ where: { establishmentId: eid } });
      data.presences = await prisma.presence.findMany({ where: { establishmentId: eid } });
      data.planning = await prisma.planningEvent.findMany({ where: { establishmentId: eid } });
      data.settings = await prisma.establishment.findUnique({ where: { id: eid } });
    }

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

adminRouter.post('/reset', requireAdmin, async (req: Request, res: Response) => {
  try {
    const eid = req.user!.establishmentId;
    const target = req.body.target as string;

    if (target === 'journal') {
      await prisma.journalEntry.deleteMany({ where: { establishmentId: eid } });
    } else if (target === 'presences') {
      await prisma.presence.deleteMany({ where: { establishmentId: eid } });
    } else if (target === 'all') {
      await prisma.document.deleteMany({ where: { establishmentId: eid } });
      await prisma.journalEntry.deleteMany({ where: { establishmentId: eid } });
      await prisma.presence.deleteMany({ where: { establishmentId: eid } });
      await prisma.planningEvent.deleteMany({ where: { establishmentId: eid } });
      await prisma.resident.deleteMany({ where: { establishmentId: eid } });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
