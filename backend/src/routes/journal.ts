import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { requireAuth } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

export const journalRouter = Router();

journalRouter.use(requireAuth, tenantGuard);

// GET /api/journal
journalRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { search, residentId, categoryId, date } = req.query;
    const where: any = { establishmentId: req.user!.establishmentId };

    if (residentId) where.residentId = residentId;
    if (categoryId) where.categoryId = categoryId;
    if (date) where.date = { startsWith: String(date) };

    let entries = await prisma.journalEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        resident: { select: { id: true, firstName: true, lastName: true, color: true } },
        category: { select: { id: true, name: true, color: true } },
      },
    });

    if (search) {
      const q = String(search).toLowerCase();
      entries = entries.filter(
        e =>
          e.content.toLowerCase().includes(q) ||
          (e.resident?.firstName || '').toLowerCase().includes(q) ||
          (e.resident?.lastName || '').toLowerCase().includes(q)
      );
    }

    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/journal/:id
journalRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: req.params.id, establishmentId: req.user!.establishmentId },
      include: {
        resident: { select: { id: true, firstName: true, lastName: true, color: true } },
        category: { select: { id: true, name: true, color: true } },
      },
    });
    if (!entry) return res.status(404).json({ error: 'Entrée introuvable' });
    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/journal
journalRouter.post('/', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const entry = await prisma.journalEntry.create({
      data: {
        establishmentId: req.user!.establishmentId,
        residentId: data.residentId,
        categoryId: data.categoryId || null,
        objectiveId: data.objectiveId || '',
        content: data.content,
        visibility: data.visibility || 'equipe',
        date: data.date || new Date().toISOString(),
        createdBy: req.user!.username,
      },
      include: {
        resident: { select: { id: true, firstName: true, lastName: true, color: true } },
        category: { select: { id: true, name: true, color: true } },
      },
    });
    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/journal/:id
journalRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    await prisma.journalEntry.updateMany({
      where: { id: req.params.id, establishmentId: req.user!.establishmentId },
      data: {
        residentId: data.residentId,
        categoryId: data.categoryId || null,
        objectiveId: data.objectiveId || '',
        content: data.content,
        visibility: data.visibility,
        date: data.date,
      },
    });
    const updated = await prisma.journalEntry.findFirst({
      where: { id: req.params.id, establishmentId: req.user!.establishmentId },
      include: {
        resident: { select: { id: true, firstName: true, lastName: true, color: true } },
        category: { select: { id: true, name: true, color: true } },
      },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/journal/:id
journalRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.journalEntry.deleteMany({
      where: { id: req.params.id, establishmentId: req.user!.establishmentId },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
