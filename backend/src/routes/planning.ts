import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { requireAuth } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

export const planningRouter = Router();

planningRouter.use(requireAuth, tenantGuard);

// GET /api/planning
planningRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { residentId, dateStart, dateEnd, type } = req.query;
    const where: any = { establishmentId: req.user!.establishmentId };

    if (residentId) where.residentId = residentId;
    if (type) where.type = type;
    if (dateStart) where.date = { ...(where.date || {}), gte: String(dateStart) };
    if (dateEnd) where.date = { ...(where.date || {}), lte: String(dateEnd) };

    const events = await prisma.planningEvent.findMany({
      where,
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      include: {
        resident: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/planning/:id
planningRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const event = await prisma.planningEvent.findFirst({
      where: { id: req.params.id, establishmentId: req.user!.establishmentId },
      include: { resident: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!event) return res.status(404).json({ error: 'Événement introuvable' });
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/planning
planningRouter.post('/', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const event = await prisma.planningEvent.create({
      data: {
        establishmentId: req.user!.establishmentId,
        residentId: data.residentId || null,
        title: data.title,
        type: data.type || 'activite',
        date: data.date,
        time: data.time || '',
        dateEnd: data.dateEnd || '',
        timeEnd: data.timeEnd || '',
        duration: data.duration || '60',
        color: data.color || '#3b82f6',
        description: data.description || '',
        vehicle: data.vehicle || '',
        destination: data.destination || '',
        reservedBy: data.reservedBy || '',
      },
      include: { resident: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/planning/:id
planningRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    await prisma.planningEvent.updateMany({
      where: { id: req.params.id, establishmentId: req.user!.establishmentId },
      data: {
        residentId: data.residentId || null,
        title: data.title,
        type: data.type,
        date: data.date,
        time: data.time,
        dateEnd: data.dateEnd,
        timeEnd: data.timeEnd,
        duration: data.duration,
        color: data.color,
        description: data.description,
      },
    });
    const updated = await prisma.planningEvent.findFirst({
      where: { id: req.params.id, establishmentId: req.user!.establishmentId },
      include: { resident: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/planning/:id
planningRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.planningEvent.deleteMany({
      where: { id: req.params.id, establishmentId: req.user!.establishmentId },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
