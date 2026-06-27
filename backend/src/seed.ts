import prisma from './prisma';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Seeding database...');

  // Create a demo establishment
  const est = await prisma.establishment.upsert({
    where: { slug: 'foyer-trois-rivieres' },
    update: {},
    create: {
      name: "Foyer d'Hébergement Les Trois Rivières",
      slug: 'foyer-trois-rivieres',
      type: 'FOYER',
      city: 'Paris',
      finess: '750123456',
      phone: '01 23 45 67 89',
      email: 'contact@foyer-trois-rivieres.fr',
      primaryColor: '#0f2b4a',
      accentColor: '#e85d04',
      onboarded: false,
    },
  });

  console.log(`✅ Establishment: ${est.name} (${est.id})`);

  // Create admin user
  const passwordHash = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      establishmentId: est.id,
      firstName: 'Admin',
      lastName: '',
      username: 'admin',
      passwordHash,
      role: 'admin',
    },
  });

  console.log(`✅ Admin user: admin / admin123 (${admin.id})`);

  // Default categories
  const defaultCategories = [
    { name: 'Accompagnement', color: '#3b82f6' },
    { name: 'Médical', color: '#ef4444' },
    { name: 'Éducatif', color: '#10b981' },
    { name: 'Administratif', color: '#f59e0b' },
    { name: 'Familial', color: '#8b5cf6' },
    { name: 'Loisirs', color: '#06b6d4' },
  ];

  for (const cat of defaultCategories) {
    await prisma.category.create({
      data: { establishmentId: est.id, name: cat.name, color: cat.color },
    });
  }

  // Default objectives
  const defaultObjectives = [
    { name: 'Autonomie', description: "Développement de l'autonomie au quotidien" },
    { name: 'Insertion sociale', description: 'Intégration dans la vie sociale et collective' },
    { name: 'Santé', description: 'Suivi et maintien de la santé physique et psychique' },
    { name: 'Scolarité / Formation', description: 'Accompagnement scolaire et professionnel' },
    { name: 'Lien familial', description: 'Maintien et soutien du lien familial' },
    { name: 'Logement', description: 'Préparation à un logement autonome' },
  ];

  for (const obj of defaultObjectives) {
    await prisma.objective.create({
      data: { establishmentId: est.id, name: obj.name, description: obj.description },
    });
  }

  // Default vehicles
  const defaultVehicles = ['Renault Kangoo', 'Citroën Berlingo', 'Peugeot Partner', 'Volkswagen Caddy'];
  for (const v of defaultVehicles) {
    await prisma.vehicle.create({
      data: { establishmentId: est.id, name: v },
    });
  }

  console.log('✅ Default data seeded');
  console.log('');
  console.log('📋 Connexion demo :');
  console.log('   URL: http://localhost:3001');
  console.log('   Identifiant: admin');
  console.log('   Mot de passe: admin123');
}

seed()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
