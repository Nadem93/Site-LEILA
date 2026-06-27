import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { requireAuth } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';

export const presencesRouter = Router();

presencesRouter.use(requireAuth, tenantGuard);

// GET /api/presences?date=YYYY-MM-DD
presencesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    const establishmentId = req.user!.establishmentId;

    const presences = await prisma.presence.findMany({
      where: { establishmentId, date },
      include: {
        resident: { select: { id: true, firstName: true, lastName: true, room: true, color: true, dob: true } },
      },
    });

    // Get all active residents for this establishment
    const residents = await prisma.resident.findMany({
      where: { establishmentId, status: { not: 'sorti' } },
      orderBy: { firstName: 'asc' },
    });

    // Build complete presence data
    const result = residents.map(r => {
      const presence = presences.find(p => p.residentId === r.id);
      return {
        residentId: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        room: r.room,
        color: r.color,
        dob: r.dob,
        status: presence?.status || 'unknown',
        presenceId: presence?.id || null,
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/presences/stats?date=YYYY-MM-DD
presencesRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    const establishmentId = req.user!.establishmentId;

    const presences = await prisma.presence.findMany({
      where: { establishmentId, date },
    });

    const residents = await prisma.resident.count({
      where: { establishmentId, status: { not: 'sorti' } },
    });

    let present = 0, absent = 0, sortie = 0, unknown = 0;
    const statusMap = new Map(presences.map(p => [p.residentId, p.status]));

    // We can't easily iterate over residents without fetching them
    // Let's fetch them
    const allResidents = await prisma.resident.findMany({
      where: { establishmentId, status: { not: 'sorti' } },
      select: { id: true },
    });

    allResidents.forEach(r => {
      const s = statusMap.get(r.id) || 'unknown';
      if (s === 'present') present++;
      else if (s === 'absent') absent++;
      else if (s === 'sortie') sortie++;
      else unknown++;
    });

    res.json({
      total: allResidents.length,
      present,
      absent,
      sortie,
      unknown,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/presences/batch
presencesRouter.post('/batch', async (req: Request, res: Response) => {
  try {
    const { date, presences: updates } = req.body;
    if (!date || !updates) {
      return res.status(400).json({ error: 'Date et présences requises' });
    }
    const establishmentId = req.user!.establishmentId;

    for (const p of updates) {
      await prisma.presence.upsert({
        where: {
          establishmentId_residentId_date: {
            establishmentId,
            residentId: p.residentId,
            date,
          },
        },
        update: { status: p.status },
        create: {
          establishmentId,
          residentId: p.residentId,
          date,
          status: p.status,
        },
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/presences/:residentId
presencesRouter.put('/:residentId', async (req: Request, res: Response) => {
  try {
    const { date, status } = req.body;
    if (!date || !status) {
      return res.status(400).json({ error: 'Date et statut requis' });
    }
    const establishmentId = req.user!.establishmentId;

    const presence = await prisma.presence.upsert({
      where: {
        establishmentId_residentId_date: {
          establishmentId,
          residentId: req.params.residentId,
          date,
        },
      },
      update: { status },
      create: {
        establishmentId,
        residentId: req.params.residentId,
        date,
        status,
      },
    });

    res.json(presence);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/presences/all-present
presencesRouter.post('/all-present', async (req: Request, res: Response) => {
  try {
    const date = req.body.date || new Date().toISOString().slice(0, 10);
    const establishmentId = req.user!.establishmentId;

    const residents = await prisma.resident.findMany({
      where: { establishmentId, status: { not: 'sorti' } },
      select: { id: true },
    });

    for (const r of residents) {
      await prisma.presence.upsert({
        where: {
          establishmentId_residentId_date: {
            establishmentId,
            residentId: r.id,
            date,
          },
        },
        update: { status: 'present' },
        create: {
          establishmentId,
          residentId: r.id,
          date,
          status: 'present',
        },
      });
    }

    res.json({ ok: true, count: residents.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
