import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { tenantGuard } from '../middleware/tenant';
import { upload } from '../middleware/upload';

export const residentsRouter = Router();

residentsRouter.use(requireAuth, tenantGuard);

// GET /api/residents
residentsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { search, statut, objectif } = req.query;
    const where: any = { establishmentId: req.user!.establishmentId };

    if (statut) where.status = statut;

    let residents = await prisma.resident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Filter by search query
    if (search) {
      const q = String(search).toLowerCase();
      residents = residents.filter(
        r =>
          `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
          r.firstName.toLowerCase().includes(q) ||
          r.lastName.toLowerCase().includes(q)
      );
    }

    // Filter by objective
    if (objectif) {
      residents = residents.filter(r => {
        const obj = JSON.parse(r.objectifs || '[]');
        return obj.includes(String(objectif));
      });
    }

    res.json(residents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/residents/:id
residentsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const resident = await prisma.resident.findFirst({
      where: {
        id: req.params.id,
        establishmentId: req.user!.establishmentId,
      },
    });
    if (!resident) return res.status(404).json({ error: 'Résident introuvable' });
    res.json(resident);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/residents
residentsRouter.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const resident = await prisma.resident.create({
      data: {
        establishmentId: req.user!.establishmentId,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        photo: data.photo || '',
        dob: data.dob || '',
        gender: data.gender || '',
        entryDate: data.entryDate || '',
        status: data.status || 'present',
        room: data.room || '',
        referent: data.referent || '',
        color: data.color || '#3b82f6',
        notes: data.notes || '',
        emergencyContacts: data.emergencyContacts || '',
        tuteur: data.tuteur || '',
        tuteurTel: data.tuteurTel || '',
        ecole: data.ecole || '',
        classe: data.classe || '',
        organisme: data.organisme || '',
        dossier: data.dossier || '',
        situationPro: data.situationPro || '',
        ressources: data.ressources || '',
        organismeA: data.organismeA || '',
        dossierA: data.dossierA || '',
        situationAdmin: data.situationAdmin || '',
        medecin: data.medecin || '',
        medecinTel: data.medecinTel || '',
        allergies: data.allergies || '',
        nss: data.nss || '',
        objectifs: JSON.stringify(data.objectifs || []),
      },
    });
    res.status(201).json(resident);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/residents/:id
residentsRouter.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const resident = await prisma.resident.updateMany({
      where: {
        id: req.params.id,
        establishmentId: req.user!.establishmentId,
      },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        photo: data.photo,
        dob: data.dob,
        gender: data.gender,
        entryDate: data.entryDate,
        status: data.status,
        room: data.room,
        referent: data.referent,
        color: data.color,
        notes: data.notes,
        emergencyContacts: data.emergencyContacts,
        tuteur: data.tuteur,
        tuteurTel: data.tuteurTel,
        ecole: data.ecole,
        classe: data.classe,
        organisme: data.organisme,
        dossier: data.dossier,
        situationPro: data.situationPro,
        ressources: data.ressources,
        organismeA: data.organismeA,
        dossierA: data.dossierA,
        situationAdmin: data.situationAdmin,
        medecin: data.medecin,
        medecinTel: data.medecinTel,
        allergies: data.allergies,
        nss: data.nss,
        objectifs: JSON.stringify(data.objectifs || []),
      },
    });
    if (resident.count === 0) return res.status(404).json({ error: 'Résident introuvable' });
    const updated = await prisma.resident.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/residents/:id
residentsRouter.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.resident.deleteMany({
      where: {
        id: req.params.id,
        establishmentId: req.user!.establishmentId,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/residents/:id/photo - Upload photo
residentsRouter.post('/:id/photo', requireAdmin, upload.single('photo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
    const photoUrl = `/uploads/files/${req.file.filename}`;
    await prisma.resident.updateMany({
      where: { id: req.params.id, establishmentId: req.user!.establishmentId },
      data: { photo: photoUrl },
    });
    res.json({ photoUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/residents/:id/documents
residentsRouter.get('/:id/documents', async (req: Request, res: Response) => {
  try {
    const docs = await prisma.document.findMany({
      where: {
        residentId: req.params.id,
        establishmentId: req.user!.establishmentId,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/residents/:id/documents
residentsRouter.post('/:id/documents', requireAdmin, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
    const doc = await prisma.document.create({
      data: {
        establishmentId: req.user!.establishmentId,
        residentId: req.params.id,
        name: req.file.originalname,
        category: req.body.category || 'autre',
        size: req.file.size,
        mimeType: req.file.mimetype,
        filePath: `/uploads/files/${req.file.filename}`,
        uploadedBy: req.body.uploadedBy || req.user!.username,
      },
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/residents/:residentId/documents/:docId
residentsRouter.delete('/:residentId/documents/:docId', requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.document.deleteMany({
      where: {
        id: req.params.docId,
        residentId: req.params.residentId,
        establishmentId: req.user!.establishmentId,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
