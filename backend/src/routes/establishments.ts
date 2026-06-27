import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { requireAuth, requireAdmin } from '../middleware/auth';

export const establishmentsRouter = Router();

// GET /api/establishments/slug/:slug - Lookup by slug (for login)
establishmentsRouter.get('/slug/:slug', async (req: Request, res: Response) => {
  try {
    const est = await prisma.establishment.findUnique({
      where: { slug: req.params.slug },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        city: true,
        logo: true,
        primaryColor: true,
        accentColor: true,
      },
    });
    if (!est) return res.status(404).json({ error: 'Établissement introuvable' });
    res.json(est);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/establishments/register - Create new establishment + admin
establishmentsRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const {
      name,
      slug,
      type,
      city,
      finess,
      firstName,
      lastName,
      username,
      password,
    } = req.body;

    if (!name || !slug || !username || !password) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Mot de passe : 6 caractères minimum' });
    }

    // Check slug uniqueness
    const existing = await prisma.establishment.findUnique({ where: { slug } });
    if (existing) {
      return res.status(409).json({ error: 'Ce slug est déjà utilisé' });
    }

    // Check username uniqueness
    const userExists = await prisma.user.findUnique({ where: { username } });
    if (userExists) {
      return res.status(409).json({ error: 'Cet identifiant est déjà utilisé' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const establishment = await prisma.establishment.create({
      data: {
        name,
        slug,
        type: type || 'FOYER',
        city: city || '',
        finess: finess || '',
        users: {
          create: {
            firstName: firstName || '',
            lastName: lastName || '',
            username,
            passwordHash,
            role: 'admin',
          },
        },
      },
      include: { users: true },
    });

    res.status(201).json({
      id: establishment.id,
      name: establishment.name,
      slug: establishment.slug,
      type: establishment.type,
      adminId: establishment.users[0].id,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la création' });
  }
});

// PATCH /api/establishments/onboarded - Mark onboarding complete
establishmentsRouter.patch('/onboarded', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.establishment.update({
      where: { id: req.user!.establishmentId },
      data: { onboarded: true },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/establishments/check-onboarding
establishmentsRouter.get('/check-onboarding', requireAuth, async (req: Request, res: Response) => {
  try {
    const est = await prisma.establishment.findUnique({
      where: { id: req.user!.establishmentId },
      select: { onboarded: true },
    });
    res.json({ onboarded: est?.onboarded ?? false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
