import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password, establishmentSlug } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { establishment: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    }

    // If establishment slug is provided, verify it matches
    if (establishmentSlug && user.establishment.slug !== establishmentSlug) {
      return res.status(401).json({ error: 'Accès non autorisé à cet établissement' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        establishmentId: user.establishmentId,
        role: user.role,
        username: user.username,
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.role,
      },
      establishment: {
        id: user.establishment.id,
        name: user.establishment.name,
        slug: user.establishment.slug,
        type: user.establishment.type,
        logo: user.establishment.logo,
        primaryColor: user.establishment.primaryColor,
        accentColor: user.establishment.accentColor,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { establishment: true },
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      username: user.username,
      role: user.role,
      establishment: {
        id: user.establishment.id,
        name: user.establishment.name,
        slug: user.establishment.slug,
        type: user.establishment.type,
        logo: user.establishment.logo,
        primaryColor: user.establishment.primaryColor,
        accentColor: user.establishment.accentColor,
      },
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
