/* ============================================================
   Association LEILA — Base de données partagée (localStorage)
   Site multi-services : Foyer / SAJ / SAVS / global (asso)
   Ce fichier est inclus par toutes les pages dynamiques.
   ============================================================ */

'use strict';

const FoyerDB = (() => {

  /* ── Services connus ────────────────────────────────── */
  const SERVICES = ['foyer', 'saj', 'savs', 'emp'];
  const SERVICE_LABEL = { foyer:'Foyer', saj:'SAJ', savs:'SAVS', emp:'EMP Henri Wallon', global:'Association' };

  /* ── Clés de stockage (uniques, pas par service) ────── */
  const KEYS = {
    articles:     '3r-articles',
    testimonials: '3r-testimonials',
    activities:   '3r-activities',
    admissions:   '3r-admissions',
    documents:    '3r-documents',
    applications: '3r-applications',
    photos:       '3r-photos',
    events:       '3r-events',
    team:         '3r-team',
    partners:     '3r-partners',
    faq:          '3r-faq',
    settings:     '3r-settings',
    association:  '3r-association',  // données globales asso LEILA
    alerts:       '3r-alerts',       // bandeaux d'alerte
    media:        '3r-media',        // médiathèque centralisée
    messages:     '3r-messages',     // messages reçus depuis le formulaire de contact
    branding:     '3r-branding',     // logo, couleurs, polices, favicon
    versions:     '3r-versions',     // historique des versions (snapshots)
    customPages:  '3r-custom-pages', // pages secondaires éditables (WYSIWYG)
    sectionStyles:'3r-section-styles', // couleurs de fond personnalisées par section
    schemaVersion:'3r-schema-version',
    users:        '3r-users'
  };

  const MAX_VERSIONS_PER_KEY = 10; // nombre max de versions conservées par clé

  const SCHEMA_VERSION = 5;
  const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 Mo / fichier

  /* ── Données par défaut ─────────────────────────────── */
  const DEFAULTS = {

    /* ============ ASSOCIATION (global) ============ */
    association: {
      name: 'Association LEILA',
      tagline: 'Accompagner avec dignité, soutenir l\'autonomie',
      description: "L'association LEILA, créée en 1963, gère 4 établissements et services pour adultes et enfants en situation de handicap mental et/ou psychique à Stains, en Seine-Saint-Denis.",
      yearFounded: 1963,
      address: 'Mail des Trois Rivières, Moulin Neuf — 93240 STAINS',
      phone: '01 49 46 24 40',
      email: 'contact@asso-leila.org',
      president: 'Schéhérazad DJENANE',
      director: 'Arnaud BRASSET',
      directorEmail: 'abrasset@asso-leila.org',
      stats: [
        { value: '4', label: 'Établissements et services' },
        { value: '60+', label: 'Années d\'engagement' },
        { value: '100+', label: 'Personnes accompagnées' },
        { value: '93240', label: 'Stains, Seine-Saint-Denis' }
      ],
      pageContent: {
        heroTag:    'Depuis 1963 · 60 ans d\'engagement',
        heroTitle:  'Association',
        heroAccent: 'LEILA',
        heroSuffix: ' — accompagner avec dignité.',
        heroLead:   "L'association LEILA gère 4 établissements et services pour adultes et enfants en situation de handicap mental et/ou psychique, à Stains, en Seine-Saint-Denis. Quatre établissements distincts, une seule association : le Foyer Les Trois Rivières, le SAJ, le SAVS et l'EMP Henri Wallon. Chaque service a sa propre mission, son équipe, ses agréments.",
        heroBtn1Label: 'Découvrir nos services',
        heroBtn1Href:  '#nos-services',
        heroBtn2Label: 'Nous contacter',
        heroBtn2Href:  'contact.html',

        assoEyebrow: 'Une histoire associative engagée',
        assoTitle:   "L'association LEILA en quelques mots",
        assoLead:    "Créée en 1963, l'association LEILA accompagne adultes et enfants en situation de handicap mental et/ou psychique à Stains, en Seine-Saint-Denis. Quatre établissements et services, une équipe pluridisciplinaire, et un même engagement : la dignité, l'autonomie et l'inclusion.",

        servicesEyebrow: '4 établissements et services — Association LEILA',
        servicesTitle:   'Des services distincts, un engagement commun',
        servicesLead:    "Le Foyer, le SAJ, le SAVS et l'EMP Henri Wallon sont 4 services, chacun avec sa propre mission.",

        valeursEyebrow: 'Nos engagements',
        valeursTitle:   'Des valeurs partagées entre tous nos services',
        valeurs: [
          { icon:'🫶', title:'Dignité & bienveillance', text:'Une posture professionnelle qui place la personne au cœur, dans le respect de ses choix et de son histoire.' },
          { icon:'🌱', title:'Autodétermination',       text:'Soutenir l\'expression, la participation et les choix des personnes accompagnées dans leur quotidien.' },
          { icon:'🤝', title:'Inclusion',                text:'Tisser des liens avec le territoire, les partenaires et les acteurs du droit commun pour favoriser l\'inclusion sociale.' },
          { icon:'📚', title:'Formation continue',       text:'Une équipe pluridisciplinaire qui se forme, se questionne et accueille des stagiaires comme un vivier.' },
          { icon:'👥', title:'Travail en réseau',        text:'Liens avec les ESAT, le CMP, les bailleurs, les institutions, les associations partenaires.' },
          { icon:'🔍', title:'Amélioration continue',    text:'Démarche qualité, recherche participative (CapDroits), CPOM, évaluations régulières.' }
        ],

        ctaTitle:     'Une question, une demande, un projet ?',
        ctaLead:      "Notre équipe est à votre écoute pour toute information sur nos services, une admission ou un partenariat.",
        ctaBtn1Label: 'Nous contacter',
        ctaBtn1Href:  'contact.html',
        ctaBtn2Label: 'Candidater à un stage',
        ctaBtn2Href:  'candidater.html'
      }
    },

    /* ============ BRANDING (logo, couleurs, polices) ============ */
    branding: {
      logo: {
        emoji: '🌊',
        imageUrl: '',
        text: 'Association LEILA',
        sub: 'Foyer · SAJ · SAVS · EMP — Stains'
      },
      favicon: '',
      colors: {
        foyer: { color: '#256880', dark: '#1d4f64', bg: '#e6f2f6' },
        saj:   { color: '#d4880a', dark: '#b97331', bg: '#fff5e8' },
        savs:  { color: '#4a8a37', dark: '#2f6b22', bg: '#ecf3e8' },
        emp:   { color: '#7c4dab', dark: '#5d3787', bg: '#f3ebfa' },
        primary: '#256880',
        accent:  '#d9924a'
      },
      fonts: {
        sans:  'Inter',
        serif: 'Playfair Display'
      }
    },

    /* ============ SETTINGS PAR SERVICE ============ */
    settings: {
      foyer: {
        siteName: 'Foyer Les Trois Rivières',
        tagline: "Un foyer où chacun trouve sa place.",
        capacity: '45 places',
        publicTarget: 'Adultes en situation de handicap travaillant en ESAT',
        phone: '01 49 46 24 40',
        email: 'residence@asso-leila.org',
        address: 'Mail des Trois Rivières, 93240 Stains',
        color: '#256880',
        accent: '#d9924a',
        icon: '🏡',
        hours: { weekday: '7h00 - 22h00', weekend: '7h00 - 22h00', notes: 'Service éducatif présent 365 jours par an. Veilleur de nuit pendant les heures nocturnes.' },
        cvsEmail: 'cvs-fh@asso-leila.org',
        transports: [
          { label: 'Bus',      detail: '153 et 253\narrêt Moulin Neuf' },
          { label: 'Tramway',  detail: 'T11\narrêt Stains–La Cerisaie' },
          { label: 'Voiture',  detail: '18 rue de la\nVieille Mer, Stains' },
          { label: 'À pied',   detail: 'Mail des 3 Rivières\n93240 Stains' }
        ],
        heroStats: [
          { value: '45',       label: 'places' },
          { value: '98,5%',    label: "taux d'occupation" },
          { value: '20 ans',   label: "d'existence" },
          { value: '365j/365', label: "d'ouverture" }
        ],
        pageContent: {
          heroTag:      "Depuis 2005 · 20 ans d'engagement · Foyer d'hébergement",
          heroTitle:    "Un foyer où chacun trouve sa place.",
          heroLead:     "Le Foyer Les Trois Rivières accueille 45 adultes en situation de handicap travaillant en ESAT, à Stains. Cadre de vie sécurisé, bienveillant et structurant, accompagnement éducatif global 7 jours sur 7.",
          missionTitle: "Accompagner avec dignité, soutenir l'autonomie",
          missionLead:  "Le Foyer accueille des adultes (hommes et femmes, à partir de 18 ans) présentant une déficience intellectuelle et/ou des troubles psychiques, titulaires d'une RQTH et engagés dans une activité professionnelle en ESAT, entreprise adaptée ou milieu ordinaire."
        }
      },
      saj: {
        siteName: 'SAJ Les Trois Rivières',
        tagline: "Un accueil de jour collectif et créatif.",
        capacity: '15 places',
        publicTarget: 'Adultes en situation de handicap psychique et/ou mental',
        phone: '01 85 58 68 14',
        email: 'saj@asso-leila.org',
        address: 'Mail des Trois Rivières, 93240 Stains',
        color: '#d9924a',
        accent: '#256880',
        icon: '🎨',
        hours: { weekday: 'Lundi au vendredi · 9h00 - 16h00', weekend: 'Plusieurs samedis par an', notes: 'Ouverture 210 jours / an environ. Pré-ouverture de 9h00 à 9h30 pour l\'accueil.' },
        cvsEmail: 'cvs-saj@asso-leila.org',
        transports: [
          { label: 'Transport adapté', detail: 'Service de transport\ndomicile-SAJ assuré par\nun prestataire' },
          { label: 'Bus',     detail: '153 et 253\narrêt Moulin Neuf' },
          { label: 'Tramway', detail: 'T11\narrêt Stains–La Cerisaie' },
          { label: 'Adresse', detail: 'Mail des 3 Rivières\n93240 Stains' }
        ],
        heroStats: [
          { value: '15',  label: 'places' },
          { value: '95,5%', label: "taux d'occupation 2023" },
          { value: '21',  label: 'personnes accueillies' },
          { value: '2018', label: "ouverture" }
        ],
        pageContent: {
          heroTag:      "Depuis avril 2018 · Service d'Accueil de Jour",
          heroTitle:    "Un accueil collectif, créatif et participatif.",
          heroLead:     "Le SAJ accueille 15 adultes en situation de handicap psychique et/ou mental, du lundi au vendredi. Notre démarche est collaborative : ateliers, projets, vie collective, tout se construit avec les personnes accueillies.",
          missionTitle: "Favoriser l'autonomie et l'inclusion par le collectif",
          missionLead:  "Le SAJ a pour mission de favoriser l'autonomie et l'inclusion des personnes adultes en situation de handicap psychique et/ou mental par le biais d'un accueil collectif quotidien ou régulier. Notre méthode s'inspire de l'éducation active et de la coopération."
        }
      },
      savs: {
        siteName: 'SAVS Les Trois Rivières',
        tagline: "Accompagner vers l'autonomie et l'inclusion sociale.",
        capacity: '42 places',
        publicTarget: 'Adultes en situation de handicap psychique et/ou mental, vivant à domicile',
        phone: '01 85 58 68 14',
        email: 'savs@asso-leila.org',
        address: '18 rue de la Vieille Mer, 93240 Stains',
        color: '#5b8c4a',
        accent: '#256880',
        icon: '🤝',
        hours: { weekday: 'Lundi au vendredi · sur rendez-vous', weekend: '—', notes: 'Visites à domicile, entretiens individuels et temps collectifs sur planning.' },
        cvsEmail: 'cvs-savs@asso-leila.org',
        transports: [
          { label: 'Bus',     detail: '153 et 253\narrêt Moulin Neuf' },
          { label: 'Tramway', detail: 'T11\narrêt Stains–La Cerisaie' },
          { label: 'Voiture', detail: '18 rue de la\nVieille Mer, Stains' },
          { label: 'À pied',  detail: 'Quartier du\nMoulin Neuf' }
        ],
        heroStats: [
          { value: '42',   label: 'places' },
          { value: '57',   label: 'personnes accompagnées 2024' },
          { value: '2016', label: "ouverture" },
          { value: '3',    label: "logements en sous-location" }
        ],
        pageContent: {
          heroTag:      "Depuis janvier 2016 · Service d'Accompagnement à la Vie Sociale",
          heroTitle:    "Accompagner vers l'autonomie et l'inclusion sociale.",
          heroLead:     "Le SAVS accompagne 42 adultes en situation de handicap psychique et/ou mental vivant à domicile : visites, entretiens, démarches, temps collectifs, accompagnement à la parentalité.",
          missionTitle: "Favoriser l'autonomie par des actions individuelles et collectives",
          missionLead:  "Le SAVS a pour mission de favoriser l'autonomie et l'insertion sociale des personnes adultes en situation de handicap psychique et/ou mental, par le biais d'actions individuelles et collectives, d'accueil et d'accompagnement social, pluridimensionnelles et personnalisées."
        }
      },
      emp: {
        siteName: 'EMP Henri Wallon',
        tagline: "Externat Médico-Pédagogique pour enfants en situation de handicap.",
        capacity: 'À compléter',
        publicTarget: 'Enfants en situation de handicap mental et/ou psychique',
        phone: 'À compléter',
        email: 'emp@asso-leila.org',
        address: 'Stains, Seine-Saint-Denis',
        color: '#9b6dc4',
        accent: '#1d4f64',
        icon: '🎒',
        hours: { weekday: 'À compléter', weekend: '—', notes: 'Informations détaillées à venir avec le rapport d\'activité.' },
        cvsEmail: '',
        transports: [
          { label: 'À compléter', detail: 'Informations\ndétaillées à venir' }
        ],
        heroStats: [
          { value: '—', label: 'places' },
          { value: '—', label: 'enfants accueillis' },
          { value: '—', label: 'année d\'ouverture' },
          { value: 'Stains', label: 'localisation' }
        ],
        pageContent: {
          heroTag:      "EMP Henri Wallon · Externat Médico-Pédagogique",
          heroTitle:    "L'EMP Henri Wallon — à compléter.",
          heroLead:     "L'EMP Henri Wallon accueille des enfants en situation de handicap mental et/ou psychique à Stains. Les informations détaillées seront ajoutées avec le rapport d'activité.",
          missionTitle: "Notre mission",
          missionLead:  "Informations à venir avec le rapport d'activité de l'EMP Henri Wallon."
        }
      }
    },

    /* ============ UTILISATEURS ============ */
    users: [
      { id: 'u-admin', username: 'admin',    password: 'foyer2026', role: 'admin',     service: null,    name: 'Administrateur' },
      { id: 'u-foyer', username: 'modfoyer', password: 'foyer2024', role: 'moderator', service: 'foyer', name: 'Modérateur Foyer' },
      { id: 'u-saj',   username: 'modsaj',   password: 'saj2024',   role: 'moderator', service: 'saj',   name: 'Modérateur SAJ' },
      { id: 'u-savs',  username: 'modsavs',  password: 'savs2024',  role: 'moderator', service: 'savs',  name: 'Modérateur SAVS' },
      { id: 'u-emp',   username: 'modemp',   password: 'emp2024',   role: 'moderator', service: 'emp',   name: 'Modérateur EMP' }
    ],

    /* ============ ARTICLES ============ */
    articles: [
      // FOYER
      { id: 'belgique', service: 'foyer', cat: 'transfert', catLabel: 'Transfert éducatif', date: '2025-12-15', title: "Retour sur notre transfert éducatif en Belgique", excerpt: "Sept résidents accompagnés d'un éducateur et d'un stagiaire ont vécu une semaine d'expérimentation collective hors du cadre habituel.", img: 'https://picsum.photos/seed/news-belgique2/800/500', featured: true, published: true, readTime: 3, content: `<p>En décembre 2025, sept résidents du foyer ont participé à un transfert éducatif d'une semaine en Belgique.</p><blockquote>« C'était la première fois que je prenais un avion. » — <strong>Farid, résident</strong></blockquote>` },
      { id: '20ans',    service: 'foyer', cat: 'evenement', catLabel: 'Événement',          date: '2025-10-10', title: "Le foyer fête ses 20 ans !", excerpt: "Une célébration mémorable rassemblant résidents, professionnels, familles et partenaires.", img: 'https://picsum.photos/seed/news-anniv/800/500', featured: false, published: true, readTime: 4, content: `<p>Le 10 octobre 2025, le Foyer Les Trois Rivières a célébré ses 20 ans avec une journée festive.</p>` },
      { id: 'cuisine',  service: 'foyer', cat: 'travaux',   catLabel: 'Travaux',            date: '2025-09-05', title: "Inauguration de la cuisine pédagogique rénovée", excerpt: "Un espace entièrement repensé pour mieux accompagner l'autonomie des résidents.", img: 'https://picsum.photos/seed/news-cuisine/800/500', featured: false, published: true, readTime: 2, content: `<p>Après plusieurs semaines de travaux, la cuisine pédagogique a été rénovée cet été.</p>` },

      // SAJ
      { id: 'saj-kiosque',  service: 'saj', cat: 'evenement', catLabel: 'Événement', date: '2025-11-20', title: "Le « Kiosque à propagande » sur le territoire", excerpt: "Le SAJ s'est exposé sur le territoire avec son kiosque créatif, à la rencontre des habitants de Stains.", img: 'https://picsum.photos/seed/saj-kiosque/800/500', featured: true, published: true, readTime: 3, content: `<p>Le « Kiosque à propagande » est un projet emblématique du SAJ qui s'exporte régulièrement dans la ville pour rencontrer le public.</p>` },
      { id: 'saj-comete',   service: 'saj', cat: 'spectacle', catLabel: 'Spectacle', date: '2025-06-10', title: "Le spectacle « Grande Salade et + » à La Comète", excerpt: "Une création scénique partagée entre SAJ et partenaires culturels du territoire.", img: 'https://picsum.photos/seed/saj-comete/800/500', featured: false, published: true, readTime: 4, content: `<p>Le SAJ a présenté son spectacle « Grande Salade et + » à La Comète, fruit d'une longue préparation collective.</p>` },
      { id: 'saj-fleche',   service: 'saj', cat: 'sortie',    catLabel: 'Sortie',    date: '2025-09-15', title: "La Flèche d'Or — sortie culturelle", excerpt: "Un moment partagé autour de la musique et de la création, ouvert à tous les services.", img: 'https://picsum.photos/seed/saj-fleche/800/500', featured: false, published: true, readTime: 2, content: `<p>Une sortie qui a rassemblé les personnes accueillies du SAJ autour d'un projet artistique.</p>` },

      // SAVS
      { id: 'savs-jo2024',     service: 'savs', cat: 'evenement', catLabel: 'Événement', date: '2024-08-15', title: "2024 : année olympique au SAVS", excerpt: "Plusieurs ateliers et temps collectifs ont accompagné l'engouement des Jeux Olympiques de Paris 2024.", img: 'https://picsum.photos/seed/savs-jo/800/500', featured: true, published: true, readTime: 3, content: `<p>Le SAVS a vécu une année olympique intense, marquée par des ateliers d'écriture et de mouvement autour des JO.</p>` },
      { id: 'savs-capdroits',  service: 'savs', cat: 'projet',    catLabel: 'Recherche', date: '2024-09-01', title: "Lancement du projet AUVI — CapDroits", excerpt: "Une recherche participative de 5 ans pour ancrer l'autonomie de vie des personnes accompagnées.", img: 'https://picsum.photos/seed/savs-capdroits/800/500', featured: false, published: true, readTime: 4, content: `<p>Le SAVS s'engage dans un projet de recherche participative AUVI sur l'autonomie de vie, en partenariat avec le collectif CapDroits.</p>` },
      { id: 'savs-muides',     service: 'savs', cat: 'sejour',    catLabel: 'Séjour',    date: '2024-07-20', title: "Séjour à Muides-sur-Loire", excerpt: "Un séjour partagé qui a permis de renforcer les liens du collectif.", img: 'https://picsum.photos/seed/savs-muides/800/500', featured: false, published: true, readTime: 2, content: `<p>Le séjour annuel du SAVS s'est tenu à Muides-sur-Loire, l'occasion d'expérimenter le quotidien autrement.</p>` },

      // EMP (placeholders à compléter)
      { id: 'emp-batucada',    service: 'emp', cat: 'evenement', catLabel: 'Événement', date: '2025-12-15', title: "La batucada des jeunes de l'EMP", excerpt: "Les jeunes de l'EMP Henri Wallon ont ouvert les festivités des 60 ans de l'association LEILA.", img: 'https://picsum.photos/seed/emp-batucada/800/500', featured: true, published: true, readTime: 2, content: `<p>Lors des 60 ans de l'association LEILA en décembre 2023, la batucada des jeunes de l'EMP a ouvert les festivités, un moment fort de partage entre tous les services.</p><p><em>Article à compléter avec le rapport d'activité.</em></p>` },
      { id: 'emp-placeholder', service: 'emp', cat: 'projet',    catLabel: 'Projet',    date: '2025-09-01', title: "Présentation de l'EMP Henri Wallon", excerpt: "Un externat médico-pédagogique au service des enfants. Contenu détaillé à venir.", img: 'https://picsum.photos/seed/emp-pres/800/500', featured: false, published: true, readTime: 1, content: `<p><em>Cette page sera complétée avec les informations du rapport d'activité de l'EMP.</em></p>` }
    ],

    /* ============ TÉMOIGNAGES ============ */
    testimonials: [
      // FOYER
      { id: 't1', service: 'foyer', name: 'Mickaël', role: 'Résident depuis 2018', text: "Ici, je me sens chez moi. J'ai mes amis, mon travail à l'ESAT, et l'équipe est toujours là quand j'ai besoin.", avatar: 'M', color: '#256880', featured: false, published: true, order: 1 },
      { id: 't2', service: 'foyer', name: 'Sylvie',  role: "Maman d'une résidente", text: "Ce qui m'a marquée, c'est la place réelle donnée à la parole de ma fille.", avatar: 'S', color: '#d9924a', featured: true, published: true, order: 2 },
      { id: 't3', service: 'foyer', name: 'Pascal D.', role: "Moniteur d'atelier ESAT", text: "Le travail de coordination avec les Trois Rivières est précieux.", avatar: 'P', color: '#5b8c4a', featured: false, published: true, order: 3 },
      // SAJ
      { id: 't-saj-1', service: 'saj', name: 'Jelissa', role: 'Personne accueillie au SAJ', text: "C'est ici au SAJ que j'ai commencé à préparer les actualités pour mes camarades. C'est une activité que j'ai décidé de faire toute seule.", avatar: 'J', color: '#d9924a', featured: true, published: true, order: 1 },
      { id: 't-saj-2', service: 'saj', name: 'Mahamadou', role: 'Personne accueillie au SAJ', text: "Je fais la basse et on prépare des chansons pour les fêtes. La réunion c'est important parce qu'on décide les activités.", avatar: 'M', color: '#256880', featured: false, published: true, order: 2 },
      { id: 't-saj-3', service: 'saj', name: 'Merline', role: 'Personne accueillie au SAJ', text: "On chante la mélodie, les paroles. On parle de la fête du printemps, des séjours, des activités. C'est important pour apprendre à bien parler avec tout le monde.", avatar: 'M', color: '#5b8c4a', featured: false, published: true, order: 3 },
      // SAVS
      { id: 't-savs-1', service: 'savs', name: 'Alicia', role: 'Stagiaire CAFERUIS', text: "J'ai compris alors la notion d'autodétermination et de libre arbitre. Je comprends surtout que j'ai beaucoup à apprendre.", avatar: 'A', color: '#5b8c4a', featured: true, published: true, order: 1 },
      { id: 't-savs-2', service: 'savs', name: 'Personne accompagnée', role: 'SAVS', text: "Au SAVS, on participe aux entretiens, on lit les CV, on prépare les questions. On est partie prenante.", avatar: 'P', color: '#256880', featured: false, published: true, order: 2 },
      // EMP (placeholders)
      { id: 't-emp-1', service: 'emp', name: 'Témoignage à compléter', role: 'EMP Henri Wallon', text: "Les témoignages de l'EMP seront ajoutés à partir du rapport d'activité.", avatar: 'E', color: '#9b6dc4', featured: false, published: true, order: 1 }
    ],

    admissions: [],

    /* ============ DOCUMENTS ============ */
    documents: [
      // FOYER
      { id: 'foyer-projet-etab',         service: 'foyer', category: 'institutionnels', categoryLabel: 'Documents institutionnels', title: "Projet d'établissement Foyer", description: "Notre projet, nos valeurs et nos missions", type: 'PDF', size: 0, fileName: '', fileData: '', published: true, updated: '2025-09-01', isPlaceholder: true },
      { id: 'foyer-livret-accueil',      service: 'foyer', category: 'institutionnels', categoryLabel: 'Documents institutionnels', title: "Livret d'accueil Foyer",        description: "Votre arrivée au foyer, étape par étape", type: 'PDF', size: 0, fileName: '', fileData: '', published: true, updated: '2025-02-15', isPlaceholder: true },
      { id: 'foyer-reglement',           service: 'foyer', category: 'institutionnels', categoryLabel: 'Documents institutionnels', title: "Règlement de fonctionnement",   description: "Règles de vie et fonctionnement collectif", type: 'PDF', size: 0, fileName: '', fileData: '', published: true, updated: '2025-01-10', isPlaceholder: true },
      // SAJ
      { id: 'saj-projet-service',        service: 'saj',   category: 'institutionnels', categoryLabel: 'Documents institutionnels', title: 'Projet de service SAJ',         description: "Méthodes, démarches et ateliers du SAJ",   type: 'PDF', size: 0, fileName: '', fileData: '', published: true, updated: '2025-01-20', isPlaceholder: true },
      { id: 'saj-livret-accueil',        service: 'saj',   category: 'institutionnels', categoryLabel: 'Documents institutionnels', title: "Livret d'accueil SAJ",          description: "Présentation et fonctionnement",            type: 'PDF', size: 0, fileName: '', fileData: '', published: true, updated: '2025-02-10', isPlaceholder: true },
      { id: 'saj-rapport-2023',          service: 'saj',   category: 'rapports',        categoryLabel: 'Rapports d\'activité',      title: "Rapport d'activité 2023 SAJ",   description: "Bilan de l'année 2023",                     type: 'PDF', size: 0, fileName: '', fileData: '', published: true, updated: '2024-04-15', isPlaceholder: true },
      // SAVS
      { id: 'savs-projet-service',       service: 'savs',  category: 'institutionnels', categoryLabel: 'Documents institutionnels', title: 'Projet de service SAVS',         description: "Méthodes et modalités d'accompagnement",   type: 'PDF', size: 0, fileName: '', fileData: '', published: true, updated: '2024-12-01', isPlaceholder: true },
      { id: 'savs-rapport-2024',         service: 'savs',  category: 'rapports',        categoryLabel: 'Rapports d\'activité',      title: "Rapport d'activité 2024 SAVS",  description: "Bilan de l'année 2024 et CPOM",            type: 'PDF', size: 0, fileName: '', fileData: '', published: true, updated: '2025-04-10', isPlaceholder: true },
      // EMP (placeholders)
      { id: 'emp-projet-pedago',         service: 'emp',   category: 'institutionnels', categoryLabel: 'Documents institutionnels', title: 'Projet pédagogique EMP',         description: "Document à téléverser avec le rapport d'activité.", type: 'PDF', size: 0, fileName: '', fileData: '', published: true, updated: '2025-01-01', isPlaceholder: true },
      { id: 'emp-livret-accueil',        service: 'emp',   category: 'institutionnels', categoryLabel: 'Documents institutionnels', title: "Livret d'accueil EMP",          description: "Document à téléverser.",                          type: 'PDF', size: 0, fileName: '', fileData: '', published: true, updated: '2025-01-01', isPlaceholder: true },
      // GLOBAL
      { id: 'asso-statuts',              service: 'global', category: 'institutionnels', categoryLabel: 'Documents institutionnels', title: 'Statuts de l\'association LEILA', description: "Textes fondateurs (1963)", type: 'PDF', size: 0, fileName: '', fileData: '', published: true, updated: '2024-06-01', isPlaceholder: true }
    ],

    applications: [],

    /* ============ PHOTOS ============ */
    photos: [
      // FOYER
      { id: 'p1', service: 'foyer', category: 'atelier',   categoryLabel: 'Atelier',   title: 'Cuisine pédagogique', description: 'Un espace rénové en 2025.', src: 'https://picsum.photos/seed/foyer-cuisine/800/600',  size: 'large', tag: 'Atelier',   alt: 'Cuisine pédagogique',   featured: true,  published: true, order: 1 },
      { id: 'p2', service: 'foyer', category: 'activite',  categoryLabel: 'Activité',  title: 'Atelier jardinage',   description: '',                          src: 'https://picsum.photos/seed/foyer-jardin/600/600',                  tag: 'Activité',  alt: 'Atelier jardinage',     featured: false, published: true, order: 2 },
      { id: 'p3', service: 'foyer', category: 'sortie',    categoryLabel: 'Sortie',    title: 'Activité piscine',    description: '',                          src: 'https://picsum.photos/seed/foyer-piscine/600/600',                 tag: 'Sortie',    alt: 'Activité piscine',      featured: false, published: true, order: 3 },
      { id: 'p4', service: 'foyer', category: 'evenement', categoryLabel: 'Événement', title: 'Les 20 ans du foyer', description: '',                          src: 'https://picsum.photos/seed/foyer-fete/600/600',                    tag: 'Événement', alt: 'Anniversaire 20 ans',   featured: false, published: true, order: 4 },
      // SAJ
      { id: 'ps1', service: 'saj', category: 'atelier',   categoryLabel: 'Atelier',   title: 'Atelier musique',     description: "Un atelier hebdomadaire animé par les personnes accueillies.", src: 'https://picsum.photos/seed/saj-musique/800/600',  size: 'large', tag: 'Atelier',   alt: 'Atelier musique',  featured: true,  published: true, order: 1 },
      { id: 'ps2', service: 'saj', category: 'atelier',   categoryLabel: 'Atelier',   title: 'Atelier cuisine',     description: '',                                                            src: 'https://picsum.photos/seed/saj-cuisine/600/600',                tag: 'Atelier',   alt: 'Atelier cuisine',  featured: false, published: true, order: 2 },
      { id: 'ps3', service: 'saj', category: 'evenement', categoryLabel: 'Événement', title: 'Repas du monde',      description: 'Une journée dédiée à un pays.',                              src: 'https://picsum.photos/seed/saj-repasmonde/600/600',             tag: 'Événement', alt: 'Repas du monde',    featured: false, published: true, order: 3 },
      { id: 'ps4', service: 'saj', category: 'sortie',    categoryLabel: 'Sortie',    title: 'Atelier jardinage',   description: 'Bacs potagers hors sol.',                                    src: 'https://picsum.photos/seed/saj-jardin/600/600',                 tag: 'Sortie',    alt: 'Atelier jardinage', featured: false, published: true, order: 4 },
      // SAVS
      { id: 'pv1', service: 'savs', category: 'evenement', categoryLabel: 'Événement', title: 'Atelier d\'écriture JO 2024', description: 'Une année olympique au SAVS.',     src: 'https://picsum.photos/seed/savs-ecriture/800/600', size: 'large', tag: 'Atelier',   alt: 'Atelier d\'écriture',     featured: true,  published: true, order: 1 },
      { id: 'pv2', service: 'savs', category: 'sortie',    categoryLabel: 'Sortie',    title: 'Séjour Muides-sur-Loire',    description: '',                                  src: 'https://picsum.photos/seed/savs-muides/600/600',                tag: 'Séjour',    alt: 'Séjour Muides-sur-Loire', featured: false, published: true, order: 2 },
      { id: 'pv3', service: 'savs', category: 'atelier',   categoryLabel: 'Atelier',   title: 'Atelier mouvement',          description: 'Atelier interservices SAVS/Foyer.', src: 'https://picsum.photos/seed/savs-mouvement/600/600',             tag: 'Atelier',   alt: 'Atelier mouvement',       featured: false, published: true, order: 3 },
      { id: 'pv4', service: 'savs', category: 'projet',    categoryLabel: 'Projet',    title: 'Projet jardin',              description: '',                                  src: 'https://picsum.photos/seed/savs-jardin/600/600',                tag: 'Projet',    alt: 'Projet jardin',           featured: false, published: true, order: 4 },
      // EMP (placeholders)
      { id: 'pe1', service: 'emp', category: 'placeholder', categoryLabel: 'À compléter', title: 'EMP Henri Wallon',     description: 'Photo à téléverser.', src: 'https://picsum.photos/seed/emp1/800/600', size: 'large', tag: 'EMP', alt: 'EMP Henri Wallon',  featured: true,  published: true, order: 1 },
      { id: 'pe2', service: 'emp', category: 'placeholder', categoryLabel: 'À compléter', title: 'Activité pédagogique', description: '',                    src: 'https://picsum.photos/seed/emp2/600/600',                tag: 'Activité', alt: 'Activité pédagogique', featured: false, published: true, order: 2 },
      { id: 'pe3', service: 'emp', category: 'placeholder', categoryLabel: 'À compléter', title: 'Atelier collectif',    description: '',                    src: 'https://picsum.photos/seed/emp3/600/600',                tag: 'Atelier',  alt: 'Atelier collectif',     featured: false, published: true, order: 3 }
    ],

    /* ============ ÉVÉNEMENTS / AGENDA ============ */
    events: [
      // FOYER
      { id: 'e1', service: 'foyer', date: '2026-05-20', time: '18:00', endTime: '20:00', title: 'Soirée à thème : transition écologique', location: 'Salle des résidents', tag: 'Soirée à thème', audience: 'Résidents', description: 'Réflexion collective animée par les résidents.', published: true },
      { id: 'e2', service: 'foyer', date: '2026-06-15', time: '14:00', endTime: '17:00', title: 'Sortie au parc Georges-Valbon',          location: 'Parc Georges-Valbon', tag: 'Sortie',          audience: 'Résidents', description: 'Pique-nique et activités gratuites.',           published: true },
      { id: 'e3', service: 'foyer', date: '2026-07-04', time: '12:00', endTime: '17:00', title: 'Barbecue interservices',                 location: 'Foyer Les Trois Rivières', tag: 'Inter-services', audience: 'Tous',     description: 'Rencontre conviviale FH / SAVS / SAJ.',         published: true },
      // SAJ
      { id: 'es1', service: 'saj', date: '2026-05-15', time: '10:00', endTime: '16:00', title: 'Repas du monde — Italie', location: 'Salle Jardin', tag: 'Atelier',     audience: 'SAJ',          description: "Cuisine et découverte culturelle.",       published: true },
      { id: 'es2', service: 'saj', date: '2026-06-20', time: '14:00', endTime: '17:00', title: 'Kiosque à propagande',     location: 'Stains',       tag: 'Événement',   audience: 'Public',       description: 'Présentation publique des créations.',     published: true },
      { id: 'es3', service: 'saj', date: '2026-07-10', time: '09:00', endTime: '17:00', title: 'Sortie piscine',           location: 'Piscine de Stains', tag: 'Sortie', audience: 'SAJ',          description: '',                                          published: true },
      // SAVS
      { id: 'ev1', service: 'savs', date: '2026-05-23', time: '14:00', endTime: '16:00', title: 'Quoi de neuf ? — Vendredi', location: 'SAVS', tag: 'Temps collectif', audience: 'SAVS',     description: 'Temps collectif hebdomadaire.', published: true },
      { id: 'ev2', service: 'savs', date: '2026-06-05', time: '14:00', endTime: '17:00', title: 'Atelier mouvement',         location: 'Foyer 3R', tag: 'Atelier',     audience: 'SAVS/Foyer',   description: 'Atelier interservices.',         published: true },
      { id: 'ev3', service: 'savs', date: '2026-07-15', time: '09:00', endTime: '18:00', title: 'Séjour annuel SAVS',         location: 'À déterminer', tag: 'Séjour',  audience: 'SAVS',         description: 'Séjour annuel du collectif.',     published: true },
      // EMP (placeholders)
      { id: 'ee1', service: 'emp', date: '2026-06-25', time: '14:00', endTime: '17:00', title: 'Événement EMP — à compléter', location: 'Stains', tag: 'Événement', audience: 'EMP',  description: 'Événement à compléter avec le rapport d\'activité.', published: true }
    ],

    /* ============ ÉQUIPE ============ */
    team: [
      // FOYER
      { id: 'r1',  service: 'foyer', icon: '👔', count: '1 personne',  role: 'Direction',           description: "Pilotage stratégique et coordination.",       order: 1, published: true },
      { id: 'r2',  service: 'foyer', icon: '📊', count: '1 personne',  role: 'Directeur adjoint',   description: "Coordination opérationnelle.",                order: 2, published: true },
      { id: 'r3',  service: 'foyer', icon: '👩‍🏫', count: '4 personnes', role: 'Éducateurs spécialisés', description: "Accompagnement éducatif global.",         order: 3, published: true },
      { id: 'r4',  service: 'foyer', icon: '🎓', count: '7 personnes', role: 'Moniteurs éducateurs', description: "Animation et accompagnement quotidien.",     order: 4, published: true },
      { id: 'r5',  service: 'foyer', icon: '🧠', count: '0,5 ETP',     role: 'Psychologue',         description: "Suivi clinique et appui à l'équipe.",         order: 5, published: true },
      { id: 'r6',  service: 'foyer', icon: '🌙', count: '3 personnes', role: 'Veilleurs de nuit',   description: "Surveillance et soutien nocturne.",           order: 6, published: true },
      { id: 'r7',  service: 'foyer', icon: '🧹', count: '3 personnes', role: 'Agents de service',   description: "Hygiène et entretien des locaux.",            order: 7, published: true },
      { id: 'r8',  service: 'foyer', icon: '🛠️', count: '1 personne',  role: "Agent d'entretien",   description: "Maintenance des installations.",              order: 8, published: true },
      { id: 'r9',  service: 'foyer', icon: '📋', count: '1 personne',  role: 'Secrétariat',         description: "Gestion administrative et accueil.",          order: 9, published: true },
      { id: 'r10', service: 'foyer', icon: '💶', count: '1 personne',  role: 'Comptabilité',        description: "Suivi financier, aide sociale, APL.",         order: 10, published: true },
      // SAJ
      { id: 'rs1', service: 'saj', icon: '📊', count: '0,25 ETP',    role: 'Responsable de service', description: "Pilotage du service.",                       order: 1, published: true },
      { id: 'rs2', service: 'saj', icon: '🧠', count: '0,25 ETP',    role: 'Psychologue',            description: "Atelier thérapeutique et entretiens.",       order: 2, published: true },
      { id: 'rs3', service: 'saj', icon: '👩‍🏫', count: '4 ETP',       role: 'Équipe éducative',       description: "Animation des ateliers et accompagnement.",  order: 3, published: true },
      { id: 'rs4', service: 'saj', icon: '📋', count: '0,80 ETP',    role: 'Administration',         description: "Mutualisée avec Foyer et SAVS.",             order: 4, published: true },
      { id: 'rs5', service: 'saj', icon: '🧹', count: '0,70 ETP',    role: 'Services généraux',      description: "Entretien et services courants.",            order: 5, published: true },
      // SAVS
      { id: 'rv1', service: 'savs', icon: '📊', count: '0,75 ETP',   role: 'Responsable de service', description: "Pilotage et coordination du service.",       order: 1, published: true },
      { id: 'rv2', service: 'savs', icon: '🧠', count: '0,5 ETP',    role: 'Psychologue',            description: "Suivi clinique des personnes accompagnées.", order: 2, published: true },
      { id: 'rv3', service: 'savs', icon: '👥', count: '4 personnes', role: 'Accompagnatrices sociales', description: "Visites à domicile, entretiens, démarches.", order: 3, published: true },
      { id: 'rv4', service: 'savs', icon: '📋', count: '0,9 ETP',    role: 'Administration',         description: "Gestion administrative mutualisée.",         order: 4, published: true },
      { id: 'rv5', service: 'savs', icon: '🧹', count: '0,3 ETP',    role: 'Services généraux',      description: "Entretien des locaux.",                      order: 5, published: true },
      // EMP (placeholders)
      { id: 're1', service: 'emp', icon: '📊', count: 'À compléter', role: 'Direction-adjointe',     description: "Pilotage et coordination de l'EMP.",         order: 1, published: true },
      { id: 're2', service: 'emp', icon: '👩‍🏫', count: 'À compléter', role: 'Équipe pédagogique',    description: "Accompagnement éducatif des enfants.",       order: 2, published: true },
      { id: 're3', service: 'emp', icon: '🧠', count: 'À compléter', role: 'Équipe paramédicale',     description: "Suivi clinique et thérapeutique.",            order: 3, published: true },
      { id: 're4', service: 'emp', icon: '🧩', count: 'À compléter', role: 'Coordinatrice de parcours', description: "Mutualisée avec FH et SAJ.",                order: 4, published: true }
    ],

    /* ============ PARTENAIRES ============ */
    partners: [
      // GLOBAL ASSO
      { id: 'pa1',  service: 'global', name: 'GAPAS',              type: 'association', typeLabel: 'Association partenaire', logo: '🤝', description: "Convention de prestation de services.",                  url: '', relation: 'Convention de prestation', order: 1, published: true },
      { id: 'pa2',  service: 'global', name: 'EINA',               type: 'association', typeLabel: 'Association partenaire', logo: '🌱', description: "Partenariat associatif.",                                url: '', relation: 'Partenariat associatif', order: 2, published: true },
      { id: 'pa3',  service: 'global', name: 'AFDAEIM',            type: 'association', typeLabel: 'Association partenaire', logo: '💙', description: "Partenariat associatif.",                                url: '', relation: 'Partenariat associatif', order: 3, published: true },
      { id: 'pa4',  service: 'global', name: 'La Voix du Devenir', type: 'association', typeLabel: 'Association partenaire', logo: '🗣️', description: "Partenariat associatif.",                                url: '', relation: 'Partenariat associatif', order: 4, published: true },
      // FOYER
      { id: 'paf1', service: 'foyer',  name: 'Planning Familial',  type: 'sante', typeLabel: 'Santé / VASI', logo: '❤️', description: "Vie affective, intime et sexuelle (VASI).", url: 'https://www.planning-familial.org', relation: 'Santé / VASI', order: 1, published: true },
      { id: 'paf2', service: 'foyer',  name: 'CMP de Stains',      type: 'sante', typeLabel: 'Santé',        logo: '🏥', description: "Coordination autour des suivis psychiatriques.", url: '',                                  relation: 'Santé',        order: 2, published: true },
      { id: 'paf3', service: 'foyer',  name: 'ESAT partenaires',   type: 'esat',  typeLabel: 'ESAT',          logo: '💼', description: "Travailleurs accueillis par 10 ESAT du territoire.", url: '',                              relation: 'ESAT du territoire', order: 3, published: true },
      // SAJ
      { id: 'pas1', service: 'saj',    name: 'Service Sports Stains', type: 'territoire', typeLabel: 'Ville',     logo: '⚽', description: "Ateliers sportifs municipaux.",          url: '', relation: 'Service municipal', order: 1, published: true },
      { id: 'pas2', service: 'saj',    name: 'La Comète',             type: 'culture',    typeLabel: 'Culture',   logo: '🎭', description: "Créations scéniques partagées.",          url: '', relation: 'Lieu culturel',     order: 2, published: true },
      { id: 'pas3', service: 'saj',    name: 'Stains-Actu',           type: 'media',      typeLabel: 'Média',     logo: '📰', description: "Expositions et publications dans le journal local.", url: '', relation: 'Média local', order: 3, published: true },
      { id: 'pas4', service: 'saj',    name: 'CAJ Cap Avenir',        type: 'esms',       typeLabel: 'ESMS',      logo: '🏢', description: "Échanges autour des admissions et orientations.", url: '', relation: 'Partenaire ESMS', order: 4, published: true },
      // SAVS
      { id: 'pav1', service: 'savs',   name: 'CapDroits',                   type: 'recherche', typeLabel: 'Recherche participative', logo: '📚', description: "Projet AUVI — Ancrer l'Autonomie de Vie.", url: '', relation: 'Recherche participative', order: 1, published: true },
      { id: 'pav2', service: 'savs',   name: 'Médiathèques Plaine Commune', type: 'culture',   typeLabel: 'Culture',                  logo: '📖', description: "Projets culturels conjoints.",             url: '', relation: 'Culture',                 order: 2, published: true },
      { id: 'pav3', service: 'savs',   name: 'Seine-Saint-Denis Habitat',   type: 'logement',  typeLabel: 'Logement social',          logo: '🏠', description: "Bailleur des 3 logements en sous-location.", url: '', relation: 'Bailleur social',       order: 3, published: true },
      { id: 'pav4', service: 'savs',   name: "L'Abominable",                type: 'culture',   typeLabel: 'Culture / Cinéma',         logo: '🎬', description: "Chantier cinématographique.",              url: '', relation: 'Culture / Cinéma',        order: 4, published: true },
      // EMP (placeholders)
      { id: 'pae1', service: 'emp', name: 'Partenaires de l\'EMP', type: 'placeholder', typeLabel: 'À compléter', logo: '🤝', description: "Liste des partenaires à compléter avec le rapport d'activité.", url: '', relation: 'À compléter', order: 1, published: true }
    ],

    /* ============ FAQ ============ */
    faq: [
      // FOYER
      { id: 'f1', service: 'foyer', question: "Comment faire une demande d'admission au Foyer ?", answer: "Vous pouvez transmettre votre dossier directement au foyer, via Trajectoire ou par l'intermédiaire d'un établissement. Nous proposons ensuite un entretien et une visite, puis une période d'accueil temporaire (jusqu'à 90 jours).", order: 1, published: true },
      { id: 'f2', service: 'foyer', question: "Quels sont les critères d'accueil au Foyer ?", answer: "Le foyer accueille des adultes (18 ans et +), titulaires d'une RQTH, présentant une déficience intellectuelle et/ou des troubles psychiques, et engagés dans une activité professionnelle (ESAT, EA ou milieu ordinaire).", order: 2, published: true },
      { id: 'f3', service: 'foyer', question: "Comment se déroule la vie au foyer ?", answer: "Le service éducatif est présent de 7h à 22h, 365 jours par an. Un veilleur de nuit assure la sécurité.", order: 3, published: true },
      // SAJ
      { id: 'fs1', service: 'saj', question: "Comment intégrer le SAJ ?", answer: "Le SAJ accueille 15 personnes adultes en situation de handicap psychique et/ou mental, résidant dans le Nord-Ouest de la Seine-Saint-Denis. Les demandes passent par Via Trajectoire ou directement auprès du service. Une période de stage est systématiquement proposée.", order: 1, published: true },
      { id: 'fs2', service: 'saj', question: "Quels sont les horaires du SAJ ?", answer: "Le SAJ est ouvert du lundi au vendredi de 9h à 16h, et plusieurs samedis par an. Une pré-ouverture en équipe a lieu de 9h à 9h30 pour préparer l'accueil.", order: 2, published: true },
      { id: 'fs3', service: 'saj', question: "Le transport est-il assuré ?", answer: "Oui, un service de transport domicile-SAJ est assuré par un prestataire privé pour les personnes accueillies.", order: 3, published: true },
      // SAVS
      { id: 'fv1', service: 'savs', question: "Qu'est-ce que le SAVS ?", answer: "Le SAVS (Service d'Accompagnement à la Vie Sociale) propose un accompagnement individuel et collectif aux adultes en situation de handicap psychique et/ou mental vivant à domicile, pour favoriser leur autonomie et leur inclusion sociale.", order: 1, published: true },
      { id: 'fv2', service: 'savs', question: "Comment se déroule un accompagnement SAVS ?", answer: "Visites à domicile, entretiens individualisés, échanges téléphoniques, accompagnement social à l'extérieur, coordination avec les partenaires médico-sociaux, et participation à des temps collectifs.", order: 2, published: true },
      { id: 'fv3', service: 'savs', question: "Le SAVS propose-t-il du logement ?", answer: "Le SAVS dispose de 3 logements (F1, F2, F3) en sous-location auprès de Seine-Saint-Denis Habitat, pour faciliter l'accès au logement autonome.", order: 3, published: true },
      { id: 'fv4', service: 'savs', question: "Y a-t-il un accompagnement à la parentalité ?", answer: "Oui, le SAVS propose un accompagnement spécifique aux adultes en situation de handicap exprimant un désir d'enfant, préparant l'arrivée d'un enfant ou en ayant déjà.", order: 4, published: true },
      // EMP (placeholders)
      { id: 'fe1', service: 'emp', question: "Qu'est-ce que l'EMP Henri Wallon ?", answer: "L'EMP (Externat Médico-Pédagogique) Henri Wallon est un établissement de l'association LEILA situé à Stains, qui accueille des enfants en situation de handicap mental et/ou psychique. Les informations détaillées seront ajoutées avec le rapport d'activité.", order: 1, published: true },
      { id: 'fe2', service: 'emp', question: "Comment inscrire un enfant à l'EMP ?", answer: "Les modalités d'admission seront détaillées prochainement. En attendant, vous pouvez nous contacter pour toute information.", order: 2, published: true },
      { id: 'fe3', service: 'emp', question: "Quels sont les horaires de l'EMP ?", answer: "Informations à venir.", order: 3, published: true }
    ],

    /* ============ ALERTES (bandeaux) ============ */
    alerts: [],

    /* ============ MÉDIATHÈQUE ============ */
    media: []
  };

  /* ── Helpers ────────────────────────────────────────── */
  function load(key) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
    catch (_) { return null; }
  }

  function persist(key, data) {
    try {
      // Snapshot avant écrasement (sauf pour la clé versions elle-même + sessions)
      if (key && key !== KEYS.versions && key !== KEYS.schemaVersion) {
        snapshot(key);
      }
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (_) { return false; }
  }

  function init(key, defaultVal) {
    if (load(key) === null) persist(key, defaultVal);
  }

  /* ── Historique des versions ────────────────────── */
  // Stocke pour chaque clé un tableau des N dernières versions précédentes
  function snapshot(key) {
    try {
      const old = localStorage.getItem(key);
      if (old === null) return; // pas de version précédente
      const all = JSON.parse(localStorage.getItem(KEYS.versions) || '{}');
      const list = all[key] || [];
      list.unshift({
        ts: Date.now(),
        date: new Date().toISOString(),
        size: old.length,
        data: old
      });
      // Garde seulement les N dernières
      if (list.length > MAX_VERSIONS_PER_KEY) list.length = MAX_VERSIONS_PER_KEY;
      all[key] = list;
      localStorage.setItem(KEYS.versions, JSON.stringify(all));
    } catch (_) { /* silence */ }
  }
  function getVersions(key) {
    try {
      const all = JSON.parse(localStorage.getItem(KEYS.versions) || '{}');
      return all[key] || [];
    } catch (_) { return []; }
  }
  function getAllVersions() {
    try { return JSON.parse(localStorage.getItem(KEYS.versions) || '{}'); }
    catch (_) { return {}; }
  }
  function restoreVersion(key, ts) {
    const versions = getVersions(key);
    const v = versions.find(x => x.ts === ts);
    if (!v) return false;
    try {
      // Snapshot la version actuelle avant de restaurer
      snapshot(key);
      localStorage.setItem(key, v.data);
      return true;
    } catch (_) { return false; }
  }
  function clearVersions(key) {
    try {
      const all = JSON.parse(localStorage.getItem(KEYS.versions) || '{}');
      if (key) delete all[key];
      else Object.keys(all).forEach(k => delete all[k]);
      localStorage.setItem(KEYS.versions, JSON.stringify(all));
      return true;
    } catch (_) { return false; }
  }

  /* ── Migration progressive (v1 → v2 → v3) ────────── */
  function migrateIfNeeded() {
    const cur = parseInt(localStorage.getItem(KEYS.schemaVersion) || '1', 10);
    if (cur >= SCHEMA_VERSION) return;

    /* v1 → v2 : ajoute service: 'foyer' aux anciennes données */
    if (cur < 2) {
      const collections = ['articles', 'testimonials', 'documents', 'photos', 'events', 'team', 'partners', 'faq'];
      collections.forEach(name => {
        const key = KEYS[name];
        const data = load(key);
        if (Array.isArray(data)) {
          let changed = false;
          data.forEach(item => { if (item && !item.service) { item.service = 'foyer'; changed = true; } });
          if (changed) persist(key, data);
        }
      });

      // Settings v1 (objet plat) → v2 (objet par service)
      const oldSettings = load(KEYS.settings);
      if (oldSettings && !oldSettings.foyer && oldSettings.siteName) {
        const newSettings = JSON.parse(JSON.stringify(DEFAULTS.settings));
        newSettings.foyer = Object.assign({}, newSettings.foyer, oldSettings);
        persist(KEYS.settings, newSettings);
      }
    }

    /* v2 → v3 : ajoute le service EMP (settings + entrées par défaut placeholders) */
    if (cur < 3) {
      // Settings : si emp manque, on l'ajoute à partir des défauts
      const settings = load(KEYS.settings) || {};
      if (!settings.emp) {
        settings.emp = DEFAULTS.settings.emp;
        persist(KEYS.settings, settings);
      }
      // Pour chaque collection, on ajoute les entrées EMP des défauts si elles n'existent pas
      const collections = ['articles', 'testimonials', 'documents', 'photos', 'events', 'team', 'partners', 'faq'];
      collections.forEach(name => {
        const key = KEYS[name];
        const data = load(key);
        const defaults = DEFAULTS[name] || [];
        if (Array.isArray(data)) {
          const existingIds = new Set(data.map(x => x && x.id).filter(Boolean));
          const empDefaults = defaults.filter(x => x.service === 'emp' && !existingIds.has(x.id));
          if (empDefaults.length) {
            data.push(...empDefaults);
            persist(key, data);
          }
        }
      });
    }

    /* v3 → v4 : ajoute le store users + pageContent dans les settings */
    if (cur < 4) {
      // Ajout de pageContent dans les settings de chaque service si absent
      const settings = load(KEYS.settings) || {};
      let settingsChanged = false;
      SERVICES.forEach(svc => {
        if (settings[svc] && !settings[svc].pageContent && DEFAULTS.settings[svc]) {
          settings[svc].pageContent = DEFAULTS.settings[svc].pageContent;
          settingsChanged = true;
        }
      });
      if (settingsChanged) persist(KEYS.settings, settings);
    }

    /* v4 → v5 : ré-injecte la page gouvernance (avec les 5 cartes responsables)
       si elle a été supprimée ou si elle utilise encore l'ancien contenu sans cartes. */
    if (cur < 5) {
      const pages = load(KEYS.customPages) || [];
      const idx = pages.findIndex(p => p.slug === 'gouvernance');
      const defaultGouv = DEFAULT_CUSTOM_PAGES.find(p => p.slug === 'gouvernance');
      if (defaultGouv) {
        if (idx === -1) {
          pages.push(JSON.parse(JSON.stringify(defaultGouv)));
        } else if (!pages[idx].content || !pages[idx].content.includes('team-grid')) {
          // Mise à jour : ancien contenu sans cartes → on remplace
          pages[idx].content = defaultGouv.content;
          pages[idx].updatedAt = new Date().toISOString();
        }
        persist(KEYS.customPages, pages);
      }
    }

    localStorage.setItem(KEYS.schemaVersion, String(SCHEMA_VERSION));
  }

  /* ── Init de tous les stores ────────────────────────── */
  function initAll() {
    migrateIfNeeded();
    init(KEYS.articles,     DEFAULTS.articles);
    init(KEYS.testimonials, DEFAULTS.testimonials);
    init(KEYS.admissions,   DEFAULTS.admissions);
    init(KEYS.documents,    DEFAULTS.documents);
    init(KEYS.applications, DEFAULTS.applications);
    init(KEYS.photos,       DEFAULTS.photos);
    init(KEYS.events,       DEFAULTS.events);
    init(KEYS.team,         DEFAULTS.team);
    init(KEYS.partners,     DEFAULTS.partners);
    init(KEYS.faq,          DEFAULTS.faq);
    init(KEYS.settings,     DEFAULTS.settings);
    init(KEYS.association,  DEFAULTS.association);
    init(KEYS.alerts,       DEFAULTS.alerts);
    init(KEYS.media,        DEFAULTS.media);
    init(KEYS.users,        DEFAULTS.users);
    init(KEYS.customPages,  DEFAULT_CUSTOM_PAGES);
    init(KEYS.sectionStyles, {});
  }

  /* ── Couleurs / images de section personnalisées ──── */
  function getSectionStyles() {
    return load(KEYS.sectionStyles) || {};
  }
  function setSectionStyle(page, sectionId, styleObj) {
    // styleObj : { backgroundColor?, backgroundImage?, overlay? }
    // Pour compatibilité ascendante : si une string est passée, c'est une couleur
    if (typeof styleObj === 'string') styleObj = { backgroundColor: styleObj };
    const all = getSectionStyles();
    const key = page + ':' + sectionId;
    const cur = all[key] || {};
    const next = { ...cur, ...(styleObj || {}) };
    // Nettoyage : si toutes les valeurs sont vides, on supprime l'entrée
    Object.keys(next).forEach(k => { if (!next[k]) delete next[k]; });
    if (Object.keys(next).length === 0) {
      delete all[key];
    } else {
      all[key] = next;
    }
    return persist(KEYS.sectionStyles, all);
  }
  function clearSectionStyle(page, sectionId) {
    const all = getSectionStyles();
    delete all[page + ':' + sectionId];
    return persist(KEYS.sectionStyles, all);
  }
  function clearAllSectionStyles() {
    return persist(KEYS.sectionStyles, {});
  }

  /* ── Filtre commun par service + published + publishAt ── */
  function applyFilters(arr, opts) {
    let res = arr;
    if (opts.service && opts.service !== 'all') res = res.filter(x => x.service === opts.service);
    if (opts.published !== undefined)            res = res.filter(x => x.published === opts.published);
    // Publication différée : si publishAt > now, masquer côté public sauf si opts.includeScheduled
    if (opts.published === true && !opts.includeScheduled) {
      const now = Date.now();
      res = res.filter(x => !x.publishAt || new Date(x.publishAt).getTime() <= now);
    }
    // Workflow modérateur : par défaut on n'affiche pas les éléments en attente d'approbation côté public
    if (opts.published === true && !opts.includePending) {
      res = res.filter(x => !x.pendingApproval);
    }
    return res;
  }

  /* ── Articles ──────────────────────────────────────── */
  function getArticles(opts = {}) {
    let res = applyFilters(load(KEYS.articles) || [], opts);
    if (opts.cat) res = res.filter(a => a.cat === opts.cat);
    res.sort((a, b) => new Date(b.date) - new Date(a.date));
    return res;
  }
  function getArticle(id) { return (load(KEYS.articles) || []).find(a => a.id === id) || null; }
  function saveArticle(article) {
    const all = load(KEYS.articles) || [];
    const idx = all.findIndex(a => a.id === article.id);
    if (idx >= 0) all[idx] = article; else all.unshift(article);
    return persist(KEYS.articles, all);
  }
  function deleteArticle(id) { return persist(KEYS.articles, (load(KEYS.articles) || []).filter(a => a.id !== id)); }

  /* ── Témoignages ───────────────────────────────────── */
  function getTestimonials(opts = {}) {
    const res = applyFilters(load(KEYS.testimonials) || [], opts);
    res.sort((a, b) => (a.order || 99) - (b.order || 99));
    return res;
  }
  function saveTestimonial(t) {
    const all = load(KEYS.testimonials) || [];
    const idx = all.findIndex(x => x.id === t.id);
    if (idx >= 0) all[idx] = t; else all.push(t);
    return persist(KEYS.testimonials, all);
  }
  function deleteTestimonial(id) { return persist(KEYS.testimonials, (load(KEYS.testimonials) || []).filter(t => t.id !== id)); }

  /* ── Admissions ────────────────────────────────────── */
  function getAdmissions(opts = {}) {
    let res = load(KEYS.admissions) || [];
    if (opts.service && opts.service !== 'all') res = res.filter(a => a.service === opts.service);
    return res;
  }
  function saveAdmission(a) {
    const all = load(KEYS.admissions) || [];
    const idx = all.findIndex(x => x.id === a.id);
    if (idx >= 0) all[idx] = a; else all.unshift(a);
    return persist(KEYS.admissions, all);
  }
  function deleteAdmission(id) { return persist(KEYS.admissions, (load(KEYS.admissions) || []).filter(a => a.id !== id)); }

  /* ── Documents ─────────────────────────────────────── */
  function getDocuments(opts = {}) {
    let res = applyFilters(load(KEYS.documents) || [], opts);
    if (opts.category) res = res.filter(d => d.category === opts.category);
    return res;
  }
  function saveDocument(doc) {
    const all = load(KEYS.documents) || [];
    const idx = all.findIndex(d => d.id === doc.id);
    if (idx >= 0) all[idx] = doc; else all.unshift(doc);
    return persist(KEYS.documents, all);
  }
  function deleteDocument(id) { return persist(KEYS.documents, (load(KEYS.documents) || []).filter(d => d.id !== id)); }

  /* ── Messages contact ──────────────────────────────── */
  function getMessages(opts = {}) {
    let res = load(KEYS.messages) || [];
    if (opts.service && opts.service !== 'all') res = res.filter(m => m.service === opts.service || !m.service);
    if (opts.status) res = res.filter(m => m.status === opts.status);
    if (opts.unreadOnly) res = res.filter(m => m.status === 'new');
    res.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    return res;
  }
  function saveMessage(m) {
    const all = load(KEYS.messages) || [];
    if (!m.id) m.id = 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    if (!m.submittedAt) m.submittedAt = new Date().toISOString();
    if (!m.status) m.status = 'new';
    const idx = all.findIndex(x => x.id === m.id);
    if (idx >= 0) all[idx] = m; else all.unshift(m);
    return persist(KEYS.messages, all);
  }
  function deleteMessage(id) { return persist(KEYS.messages, (load(KEYS.messages) || []).filter(m => m.id !== id)); }
  function setMessageStatus(id, status) {
    const all = load(KEYS.messages) || [];
    const m = all.find(x => x.id === id);
    if (m) { m.status = status; persist(KEYS.messages, all); }
    return m;
  }
  function getInboxCounts() {
    const msgs = load(KEYS.messages) || [];
    const adms = load(KEYS.admissions) || [];
    const apps = load(KEYS.applications) || [];
    return {
      messages:     { total: msgs.length, unread: msgs.filter(m => m.status === 'new').length },
      admissions:   { total: adms.length, unread: adms.filter(a => !a.status || a.status === 'new').length },
      applications: { total: apps.length, unread: apps.filter(a => !a.status || a.status === 'new').length },
      get totalUnread() { return this.messages.unread + this.admissions.unread + this.applications.unread; }
    };
  }

  /* ── Candidatures stage ────────────────────────────── */
  function getApplications(opts = {}) {
    let res = load(KEYS.applications) || [];
    if (opts.service && opts.service !== 'all') res = res.filter(a => a.service === opts.service);
    if (opts.status) res = res.filter(a => a.status === opts.status);
    res.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    return res;
  }
  function saveApplication(a) {
    const all = load(KEYS.applications) || [];
    const idx = all.findIndex(x => x.id === a.id);
    if (idx >= 0) all[idx] = a; else all.unshift(a);
    return persist(KEYS.applications, all);
  }
  function deleteApplication(id) { return persist(KEYS.applications, (load(KEYS.applications) || []).filter(a => a.id !== id)); }

  /* ── CRUD générique multi-services ─────────────────── */
  function crud(key, sortFn) {
    const sorter = sortFn || ((a, b) => (a.order || 99) - (b.order || 99));
    return {
      list(opts = {}) { const r = applyFilters(load(key) || [], opts); r.sort(sorter); return r; },
      get(id)         { return (load(key) || []).find(x => x.id === id) || null; },
      save(obj) {
        const all = load(key) || [];
        const idx = all.findIndex(x => x.id === obj.id);
        if (idx >= 0) all[idx] = obj; else all.push(obj);
        return persist(key, all);
      },
      del(id) { return persist(key, (load(key) || []).filter(x => x.id !== id)); }
    };
  }

  const photosCrud   = crud(KEYS.photos);
  const teamCrud     = crud(KEYS.team);
  const partnersCrud = crud(KEYS.partners);
  const faqCrud      = crud(KEYS.faq);
  const eventsCrud   = crud(KEYS.events, (a, b) => new Date(a.date) - new Date(b.date));
  const alertsCrud   = crud(KEYS.alerts);
  const mediaCrud    = crud(KEYS.media);

  /* ── Settings (par service) ────────────────────────── */
  function getSettings(service) {
    const all = load(KEYS.settings) || DEFAULTS.settings;
    if (!service) return all;
    return all[service] || (DEFAULTS.settings[service] || {});
  }
  function saveSettings(serviceOrAll, data) {
    if (typeof serviceOrAll === 'object' && data === undefined) {
      // sauvegarde tout l'objet
      return persist(KEYS.settings, serviceOrAll);
    }
    const all = load(KEYS.settings) || DEFAULTS.settings;
    all[serviceOrAll] = data;
    return persist(KEYS.settings, all);
  }

  /* ── Utilisateurs ─────────────────────────────────── */
  function getUsers()  { return load(KEYS.users) || DEFAULTS.users; }
  function getUserByUsername(username) { return getUsers().find(u => u.username === username) || null; }
  function saveUser(user) {
    const all = getUsers();
    const idx = all.findIndex(u => u.id === user.id);
    if (idx >= 0) all[idx] = user; else all.push(user);
    return persist(KEYS.users, all);
  }
  function deleteUser(id) { return persist(KEYS.users, getUsers().filter(u => u.id !== id)); }

  /* ── Association ──────────────────────────────────── */
  function getAssociation()    {
    const stored = load(KEYS.association);
    if (!stored) return DEFAULTS.association;
    // Fusion défauts (pour les nouveaux champs ajoutés après création)
    return Object.assign({}, DEFAULTS.association, stored, {
      pageContent: Object.assign({}, DEFAULTS.association.pageContent, stored.pageContent || {})
    });
  }
  function saveAssociation(a)  { return persist(KEYS.association, a); }

  /* ── Pages secondaires (WYSIWYG) ──────────────────── */
  // Slug = identifiant unique, content = HTML libre, eyebrow + title pour le hero
  const DEFAULT_CUSTOM_PAGES = [
    {
      slug: 'association',
      title: "L'association LEILA",
      eyebrow: 'Notre association',
      breadcrumb: 'Association',
      published: true,
      content: `<p>L'association LEILA, créée en <strong>1963</strong>, gère 4 établissements et services pour adultes et enfants en situation de handicap mental et/ou psychique à Stains, en Seine-Saint-Denis.</p>
<h2>Notre histoire</h2>
<p>Depuis plus de 60 ans, l'Association LEILA accompagne avec dignité et bienveillance les personnes qui nous sont confiées, en plaçant l'autonomie et l'inclusion au cœur de notre action.</p>
<h2>Nos missions</h2>
<ul><li>Accompagner les adultes en situation de handicap travaillant en ESAT (Foyer Les Trois Rivières)</li><li>Proposer un accueil de jour pour adultes en situation de handicap psychique (SAJ Les Trois Rivières)</li><li>Accompagner à la vie sociale (SAVS Les Trois Rivières)</li><li>Accueillir des enfants en situation de handicap (EMP Henri Wallon)</li></ul>`,
      updatedAt: new Date().toISOString()
    },
    {
      slug: 'gouvernance',
      title: 'Gouvernance',
      eyebrow: "À propos de l'association",
      breadcrumb: 'Gouvernance',
      published: true,
      content: `<h2>Direction générale</h2><p>L'association LEILA est dirigée par <strong>Arnaud BRASSET</strong>, directeur général. La présidence du conseil d'administration est assurée par <strong>Schéhérazad DJENANE</strong>.</p>

<h2>Les responsables de service</h2>
<p>Chaque établissement et service de l'association est piloté par un responsable dédié. Ensemble, ils forment l'équipe de direction qui met en œuvre les orientations définies par le conseil d'administration.</p>

<div class="team-grid" style="margin: 2rem 0;">
  <article class="team-card">
    <div class="team-avatar"><img src="https://placehold.co/120x120/256880/ffffff?text=DG" alt="Photo du directeur général"></div>
    <span class="team-count">Direction</span>
    <div class="team-role">Directeur général</div>
    <p>Arnaud BRASSET — Pilotage stratégique de l'association et coordination des 4 établissements.</p>
  </article>
  <article class="team-card">
    <div class="team-avatar"><img src="https://placehold.co/120x120/256880/ffffff?text=Foyer" alt="Photo du chef de service du Foyer"></div>
    <span class="team-count">Foyer</span>
    <div class="team-role">Chef de service Foyer</div>
    <p>Responsable du Foyer Les Trois Rivières — hébergement et accompagnement de 45 adultes en situation de handicap.</p>
  </article>
  <article class="team-card">
    <div class="team-avatar"><img src="https://placehold.co/120x120/d18a4a/ffffff?text=SAJ" alt="Photo du chef de service du SAJ"></div>
    <span class="team-count">SAJ</span>
    <div class="team-role">Chef de service SAJ</div>
    <p>Responsable du SAJ Les Trois Rivières — accueil de jour pour 15 adultes en situation de handicap psychique.</p>
  </article>
  <article class="team-card">
    <div class="team-avatar"><img src="https://placehold.co/120x120/5a8c6e/ffffff?text=SAVS" alt="Photo du chef de service du SAVS"></div>
    <span class="team-count">SAVS</span>
    <div class="team-role">Chef de service SAVS</div>
    <p>Responsable du SAVS Les Trois Rivières — accompagnement à la vie sociale de 42 personnes à domicile.</p>
  </article>
  <article class="team-card">
    <div class="team-avatar"><img src="https://placehold.co/120x120/8b5e9c/ffffff?text=EMP" alt="Photo du directeur pédagogique de l'EMP"></div>
    <span class="team-count">EMP</span>
    <div class="team-role">Directeur pédagogique EMP</div>
    <p>Responsable de l'EMP Henri Wallon — externat médico-pédagogique pour enfants en situation de handicap.</p>
  </article>
</div>

<h2>Conseil d'administration</h2>
<p>Le conseil d'administration se réunit régulièrement pour définir les orientations stratégiques de l'association, valider les budgets et accompagner les évolutions des services.</p>`,
      updatedAt: new Date().toISOString()
    },
    {
      slug: 'mentions-legales',
      title: 'Mentions légales',
      eyebrow: 'Informations légales',
      breadcrumb: 'Mentions légales',
      published: true,
      content: `<h2>Éditeur du site</h2><p><strong>Association LEILA</strong><br>Mail des Trois Rivières — Moulin Neuf<br>93240 STAINS<br>Tél. : 01 49 46 24 40<br>Email : contact@asso-leila.org</p><h2>Hébergement</h2><p>À compléter.</p><h2>Propriété intellectuelle</h2><p>L'ensemble du contenu de ce site (textes, images, vidéos) est la propriété exclusive de l'Association LEILA.</p>`,
      updatedAt: new Date().toISOString()
    },
    {
      slug: 'accessibilite',
      title: 'Déclaration d\'accessibilité',
      eyebrow: 'Accessibilité numérique',
      breadcrumb: 'Accessibilité',
      published: true,
      content: `<h2>Engagement</h2><p>L'Association LEILA s'engage à rendre son site internet accessible conformément à l'article 47 de la loi n°2005-102 du 11 février 2005.</p><h2>État de conformité</h2><p>Ce site est <strong>partiellement conforme</strong> avec le référentiel général d'amélioration de l'accessibilité (RGAA) version 4.</p><h2>Signaler un problème</h2><p>Si vous rencontrez un problème d'accessibilité, contactez-nous à <a href="mailto:contact@asso-leila.org">contact@asso-leila.org</a></p>`,
      updatedAt: new Date().toISOString()
    }
  ];

  function getCustomPages(opts = {}) {
    let res = load(KEYS.customPages) || DEFAULT_CUSTOM_PAGES;
    if (opts.published === true) {
      res = res.filter(p => p.published !== false);
      if (!opts.includeScheduled) {
        const now = Date.now();
        res = res.filter(p => !p.publishAt || new Date(p.publishAt).getTime() <= now);
      }
    }
    return res;
  }
  function getCustomPage(slug) {
    return (load(KEYS.customPages) || DEFAULT_CUSTOM_PAGES).find(p => p.slug === slug) || null;
  }
  function saveCustomPage(page) {
    const all = load(KEYS.customPages) || DEFAULT_CUSTOM_PAGES.slice();
    page.updatedAt = new Date().toISOString();
    const idx = all.findIndex(p => p.slug === page.slug);
    if (idx >= 0) all[idx] = page; else all.push(page);
    return persist(KEYS.customPages, all);
  }
  function deleteCustomPage(slug) {
    return persist(KEYS.customPages, (load(KEYS.customPages) || []).filter(p => p.slug !== slug));
  }

  function getBranding() {
    const stored = load(KEYS.branding);
    if (!stored) return DEFAULTS.branding;
    return {
      logo:    Object.assign({}, DEFAULTS.branding.logo,    stored.logo    || {}),
      favicon: stored.favicon !== undefined ? stored.favicon : DEFAULTS.branding.favicon,
      colors:  {
        foyer:   Object.assign({}, DEFAULTS.branding.colors.foyer,   (stored.colors || {}).foyer   || {}),
        saj:     Object.assign({}, DEFAULTS.branding.colors.saj,     (stored.colors || {}).saj     || {}),
        savs:    Object.assign({}, DEFAULTS.branding.colors.savs,    (stored.colors || {}).savs    || {}),
        emp:     Object.assign({}, DEFAULTS.branding.colors.emp,     (stored.colors || {}).emp     || {}),
        primary: (stored.colors && stored.colors.primary) || DEFAULTS.branding.colors.primary,
        accent:  (stored.colors && stored.colors.accent)  || DEFAULTS.branding.colors.accent
      },
      fonts:   Object.assign({}, DEFAULTS.branding.fonts,   stored.fonts   || {})
    };
  }
  function saveBranding(b)     { return persist(KEYS.branding, b); }
  function resetBranding()     { return persist(KEYS.branding, DEFAULTS.branding); }

  /* ── Outils fichiers ──────────────────────────────── */
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('Aucun fichier'));
      if (file.size > MAX_FILE_BYTES) return reject(new Error(`Fichier trop volumineux (max ${(MAX_FILE_BYTES/1024/1024).toFixed(0)} Mo).`));
      const r = new FileReader();
      r.onload  = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error('Lecture impossible'));
      r.readAsDataURL(file);
    });
  }
  function downloadDataUrl(dataUrl, fileName) {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl; a.download = fileName || 'fichier';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  function fmtSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' Ko';
    return (bytes / 1024 / 1024).toFixed(2) + ' Mo';
  }

  function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function reset() { Object.values(KEYS).forEach(k => localStorage.removeItem(k)); initAll(); }

  /* ── Export / Import (sauvegarde JSON) ────────────── */
  function exportAll() {
    const out = { exportedAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION };
    Object.entries(KEYS).forEach(([name, key]) => { if (name !== 'schemaVersion') out[name] = load(key); });
    return out;
  }
  function importAll(json) {
    try {
      Object.entries(KEYS).forEach(([name, key]) => {
        if (name !== 'schemaVersion' && json[name] !== undefined) persist(key, json[name]);
      });
      localStorage.setItem(KEYS.schemaVersion, String(SCHEMA_VERSION));
      return true;
    } catch (e) { return false; }
  }

  /* ── Détection du service depuis l'URL ────────────── */
  function detectServiceFromPath() {
    const path = (location.pathname || '').toLowerCase();
    if (/\bsaj[-/.]/.test(path)  || path.includes('/saj/'))  return 'saj';
    if (/\bsavs[-/.]/.test(path) || path.includes('/savs/')) return 'savs';
    if (/\bfoyer[-/.]/.test(path)|| path.includes('/foyer/'))return 'foyer';
    return 'foyer'; // par défaut
  }

  initAll();

  /* ── API publique ─────────────────────────────────── */
  return {
    SERVICES, SERVICE_LABEL, KEYS, DEFAULTS, MAX_FILE_BYTES, SCHEMA_VERSION,

    getArticles, getArticle, saveArticle, deleteArticle,
    getTestimonials, saveTestimonial, deleteTestimonial,
    getAdmissions, saveAdmission, deleteAdmission,
    getDocuments, saveDocument, deleteDocument,
    getApplications, saveApplication, deleteApplication,
    getMessages, saveMessage, deleteMessage, setMessageStatus, getInboxCounts,

    getPhotos:   photosCrud.list,   getPhoto:   photosCrud.get,   savePhoto:   photosCrud.save,   deletePhoto:   photosCrud.del,
    getEvents:   eventsCrud.list,   getEvent:   eventsCrud.get,   saveEvent:   eventsCrud.save,   deleteEvent:   eventsCrud.del,
    getTeam:     teamCrud.list,     getTeamItem: teamCrud.get,    saveTeamItem: teamCrud.save,    deleteTeamItem: teamCrud.del,
    getPartners: partnersCrud.list, getPartner: partnersCrud.get, savePartner: partnersCrud.save, deletePartner: partnersCrud.del,
    getFaq:      faqCrud.list,      getFaqItem: faqCrud.get,      saveFaqItem: faqCrud.save,      deleteFaqItem: faqCrud.del,
    getAlerts:   alertsCrud.list,   getAlert:   alertsCrud.get,   saveAlert:    alertsCrud.save,  deleteAlert:    alertsCrud.del,
    getMedia:    mediaCrud.list,    getMediaItem: mediaCrud.get,  saveMediaItem: mediaCrud.save,  deleteMediaItem: mediaCrud.del,

    getSettings, saveSettings,
    getAssociation, saveAssociation,
    getBranding, saveBranding, resetBranding,
    getCustomPages, getCustomPage, saveCustomPage, deleteCustomPage,
    getSectionStyles, setSectionStyle, clearSectionStyle, clearAllSectionStyles,
    getVersions, getAllVersions, restoreVersion, clearVersions,
    getUsers, getUserByUsername, saveUser, deleteUser,

    fileToDataUrl, downloadDataUrl, fmtSize,
    genId, reset, exportAll, importAll,
    detectServiceFromPath
  };
})();
