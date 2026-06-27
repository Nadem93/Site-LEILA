// ── Page ouverte dans un hub (iframe ?embed=1) : on masque son titre (doublon avec le hub) ──
try { if (location.search.indexOf('embed') !== -1) document.documentElement.classList.add('is-embedded'); } catch (_) {}

// ── STORAGE HELPERS ──
const DB_GLOBAL_KEYS = new Set(['ftr_etablissements','ftr_session']);

const DB = {
  _id: () => sessionStorage.getItem('ftr_current_etab'),
  _k(k) { const id = this._id(); return (id && !DB_GLOBAL_KEYS.has(k)) ? `${k}__${id}` : k; },
  get(k) { return JSON.parse(localStorage.getItem(this._k(k)) || 'null'); },
  set(k, v) { localStorage.setItem(this._k(k), JSON.stringify(v)); },
  remove(k) { localStorage.removeItem(this._k(k)); },
  keys: {
    residents:'ftr_residents', categories:'ftr_categories', objectives:'ftr_objectives',
    journal:'ftr_journal', presences:'ftr_presences', planning:'ftr_planning',
    settings:'ftr_settings', user:'ftr_user', branding:'ftr_branding',
    users:'ftr_users', session:'ftr_session', vehicules:'ftr_vehicules',
    documents:'ftr_documents', onboarded:'ftr_onboarded', messages:'ftr_messages',
    repertoire:'ftr_repertoire', incidents:'ftr_incidents', ppe:'ftr_ppe',
    loginHistory:'ftr_login_history', auditLog:'ftr_audit_log', fonctionColors:'ftr_fonction_colors',
    aiKey:'ftr_ai_key', aiPrompts:'ftr_ai_prompts',
    interventions:'ftr_interventions', employes:'ftr_employes',
    chambres:'ftr_chambres', edl:'ftr_edl', echeances:'ftr_echeances', releves:'ftr_releves',
    repas:'ftr_repas', visites:'ftr_visites', nuits:'ftr_nuits', activites:'ftr_activites', cvs:'ftr_cvs', medicaments:'ftr_medicaments',
    planningEquipe:'ftr_planning_equipe',
    etablissements:'ftr_etablissements', viatrajectoire:'ftr_viatrajectoire',
    budgetEnveloppes:'ftr_budget_enveloppes', budgetDemandes:'ftr_budget_demandes',
    fichesPaie:'ftr_fiches_paie', entretiens:'ftr_entretiens', documentation:'ftr_documentation', admissions:'ftr_admissions',
    tarifs:'ftr_tarifs', factures:'ftr_factures', formations:'ftr_formations',
    transmissions:'ftr_transmissions', planSoins:'ftr_plan_soins',
    evaluations:'ftr_evaluations', astreintes:'ftr_astreintes',
    satisfaction:'ftr_satisfaction', inventaire:'ftr_inventaire',
    satQuestions:'ftr_sat_questions',
    contrats:'ftr_contrats', absencesAT:'ftr_absences_at', pointages:'ftr_pointages', candidats:'ftr_candidats',
    rapportContributions:'ftr_rapport_contributions',
    contactsExternes:'ftr_contacts_externes'
  }
};

// ── MULTI-ÉTABLISSEMENT ──
function getEtabs() { return JSON.parse(localStorage.getItem('ftr_etablissements') || '[]'); }
function saveEtabs(list) { localStorage.setItem('ftr_etablissements', JSON.stringify(list)); }
function getCurrentEtab() { const id = DB._id(); return getEtabs().find(e => String(e.id) === String(id)) || null; }

function initEtabs() {
  let etabs = getEtabs();
  if (etabs.length > 0) return;
  const s = localStorage.getItem('ftr_settings');
  const sObj = s ? JSON.parse(s) : DEFAULTS.settings;
  const etab1 = { id: 1, nom: sObj.etablissement || 'Établissement principal', type: 'adultes', color: '#0f2b4a', createdAt: new Date().toISOString() };
  saveEtabs([etab1]);
  // Migrer les données existantes vers l'établissement 1
  Object.values(DB.keys).filter(k => !DB_GLOBAL_KEYS.has(k)).forEach(k => {
    const existing = localStorage.getItem(k);
    if (existing && !localStorage.getItem(`${k}__1`)) localStorage.setItem(`${k}__1`, existing);
  });
}

function createEtab(nom, type, color) {
  const etabs = getEtabs();
  const id = Date.now();
  const etab = { id, nom, type: type || 'adultes', color: color || '#0f2b4a', createdAt: new Date().toISOString() };
  etabs.push(etab);
  saveEtabs(etabs);
  // Initialiser les données par défaut pour ce nouvel établissement
  const prefix = id;
  const initKey = (k, val) => { if (!localStorage.getItem(`${k}__${prefix}`)) localStorage.setItem(`${k}__${prefix}`, JSON.stringify(val)); };
  initKey(DB.keys.residents, []);
  initKey(DB.keys.categories, DEFAULTS.categories);
  initKey(DB.keys.objectives, DEFAULTS.objectives);
  initKey(DB.keys.journal, []);
  initKey(DB.keys.presences, {});
  initKey(DB.keys.planning, []);
  initKey(DB.keys.settings, { ...DEFAULTS.settings, etablissement: nom });
  initKey(DB.keys.branding, DEFAULTS.branding);
  initKey(DB.keys.users, DEFAULTS.users);
  initKey(DB.keys.vehicules, DEFAULTS.vehicules);
  initKey(DB.keys.documents, {});
  initKey(DB.keys.incidents, []);
  initKey(DB.keys.ppe, []);
  initKey(DB.keys.fonctionColors, DEFAULTS.fonctionColors);
  initKey(DB.keys.aiPrompts, DEFAULTS.aiPrompts);
  initKey(DB.keys.viatrajectoire, []);
  return etab;
}

function deleteEtab(id) {
  const etabs = getEtabs().filter(e => String(e.id) !== String(id));
  saveEtabs(etabs);
}

function addUserToAllEtabs(user) {
  getEtabs().forEach(etab => {
    const k = `${DB.keys.users}__${etab.id}`;
    const users = JSON.parse(localStorage.getItem(k) || '[]');
    if (!users.find(u => u.username === user.username)) {
      users.push({ ...user, id: genId ? genId() : Date.now() });
      localStorage.setItem(k, JSON.stringify(users));
    }
  });
}

const ETAB_BG = {
  foyer_hebergement: ['#dbeafe','#dbeafe','#eff6ff'],  // bleu
  foyer_vie:         ['#b0b8d4','#cfd4e8','#f0f2fc'],  // bleu lavande
  foyer_jeunes:      ['#d4c8b0','#e8dfc0','#fcf7e8'],  // ocre chaud
  mecs:              ['#b0d4c8','#cfe8df','#f0fcf8'],  // teal
  lhss:              ['#c8b0d4','#dfc8e8','#f8f0fc'],  // mauve
  ime:               ['#b0c4d4','#cfdae8','#f0f5fc'],  // bleu ciel
  itep:              ['#b0d4b8','#cfe8d4','#f0fce8'],  // vert menthe
  sessad:            ['#b0c8d4','#cfdfe8','#f0f8fc'],  // bleu clair
  camsp:             ['#d4b0c8','#e8cfe0','#fcf0f8'],  // rose poudré
  esat:              ['#d4c4b0','#e8d8c8','#fcf5ec'],  // beige chaud
  mas:               ['#d4b0b0','#e8c8c8','#fcf0f0'],  // saumon clair
  fam:               ['#d4b4b0','#e8ccc8','#fce8e8'],  // pêche
  savs:              ['#b0d4b4','#c8e8cc','#ecfcec'],  // vert doux
  samsah:            ['#b0d4c0','#c8e8d4','#edfcf4'],  // vert menthe clair
  saj:               ['#d4d0b0','#e8e4c8','#fcfae8'],  // jaune crème
  pead:              ['#c4b0d4','#d8cfe8','#f4f0fc'],  // violet clair
  aemo:              ['#b4b0d4','#cccfe8','#f0f0fc'],  // lilas
  cea:               ['#d4b0c0','#e8c8d4','#fcf0f4'],  // rose poudré
  cef:               ['#d4b8b0','#e8ccc8','#fcf2f0'],  // saumon
  chrs:              ['#b0b4d4','#c8cce8','#f0f0fc'],  // bleu pervenche
  cada:              ['#d4c4b0','#e8d8c8','#faf0e8'],  // terracotta clair
  siao:              ['#b8d4b0','#d0e8c8','#f0fcec'],  // vert sauge
  autre:             ['#c4c4c4','#d8d8d8','#f0f0f0'],  // gris neutre
  adultes:           ['#dbeafe','#dbeafe','#eff6ff'],  // bleu
  enfants:           ['#b0d4b8','#cfe8d4','#f0fce8'],  // vert (legacy)
};

// Construit un dégradé pastel clair à partir de la TEINTE d'une couleur hex.
// On conserve le hue (et un peu de saturation) mais on force une luminosité claire,
// pour qu'une couleur même foncée donne un fond doux et lisible (jamais gris/sombre).
function _softBgStops(hex) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let hue = 0, s = 0, l = (max + min) / 2;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
  }
  // Saturation bornée : assez pour voir la teinte, pas trop pour rester doux
  let sl = Math.round(Math.min(Math.max(s, 0.35), 0.80) * 100);
  hue = Math.round(hue);
  return [`hsl(${hue},${sl}%,91%)`, `hsl(${hue},${sl}%,95%)`, `hsl(${hue},${sl}%,98%)`];
}

// Renvoie true si la couleur hex est perçue comme foncée
function _isDarkColor(hex) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  // Luminance perçue (0..255)
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
}

function applyEtabBackground() {
  const etab = getCurrentEtab();
  if (!etab) return;
  document.body.classList.remove('etab-dark-bg');
  const stops = etab.bgColor ? _softBgStops(etab.bgColor) : null;
  if (stops) {
    // Couleur de fond personnalisée → dégradé pastel clair conservant la teinte
    document.body.style.setProperty('background',
      `linear-gradient(135deg,${stops[0]} 0%,${stops[1]} 45%,${stops[2]} 100%)`,
      'important');
  } else {
    const colors = ETAB_BG[etab.type] || ETAB_BG['foyer_hebergement'];
    document.body.style.setProperty('background',
      `linear-gradient(135deg,${colors[0]} 0%,${colors[1]} 45%,${colors[2]} 100%)`,
      'important');
  }
  document.body.style.backgroundAttachment = 'fixed';
}

// Définit (ou réinitialise) la couleur de fond de l'établissement courant
function setEtabBgColor(color) {
  const id = DB._id();
  const etabs = getEtabs();
  const etab = etabs.find(e => String(e.id) === String(id));
  if (!etab) return;
  if (color) etab.bgColor = color; else delete etab.bgColor;
  saveEtabs(etabs);
  applyEtabBackground();
}

function etabTypeLabel(type) {
  const labels = {
    foyer_hebergement:"Foyer d'hébergement", foyer_vie:"Foyer de vie", foyer_jeunes:"FJT",
    mecs:"MECS", lhss:"LHSS", ime:"IME", itep:"ITEP", sessad:"SESSAD", camsp:"CAMSP",
    esat:"ESAT", mas:"MAS", fam:"FAM", savs:"SAVS", samsah:"SAMSAH", saj:"SAJ",
    pead:"PEAD", aemo:"AEMO", cea:"CEA", cef:"CEF",
    chrs:"CHRS", cada:"CADA", siao:"SIAO", autre:"Autre",
    adultes:"Adultes", enfants:"Enfants / Jeunes"
  };
  return labels[type] || type || '—';
}

function applyTerminology() {
  const etab = getCurrentEtab();
  if (!etab || etab.type !== 'enfants') return;
  const replacements = [['Résidents','Jeunes'],['Résident','Jeune'],['résidents','jeunes'],['résident','jeune']];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentNode.nodeName !== 'SCRIPT' && n.parentNode.nodeName !== 'STYLE' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
  let node;
  while ((node = walker.nextNode())) {
    let v = node.nodeValue;
    replacements.forEach(([from, to]) => { v = v.replace(new RegExp(from, 'g'), to); });
    if (v !== node.nodeValue) node.nodeValue = v;
  }
}

const API_URL = 'http://localhost:3001';

// ── SERAFIN-PH — nomenclature officielle (sous-domaines, validée le 27/04/2018) ──
const SP_NOMENCLATURE = [
  // Prestations directes (PD) — soins et accompagnements
  { code:'2.1.1', label:'Soins somatiques et psychiques', cat:'Directe', icon:'🏥' },
  { code:'2.1.2', label:'Rééducation et réadaptation fonctionnelle', cat:'Directe', icon:'🦾' },
  { code:'2.2.1', label:"Prestations en matière d'autonomie", cat:'Directe', icon:'🧍' },
  { code:'2.3.1', label:'Accompagnements pour exercer ses droits', cat:'Directe', icon:'⚖️' },
  { code:'2.3.2', label:'Accompagnements au logement', cat:'Directe', icon:'🏠' },
  { code:'2.3.3', label:'Accompagnements pour exercer ses rôles sociaux', cat:'Directe', icon:'🎓' },
  { code:'2.3.4', label:'Accompagnements pour participer à la vie sociale', cat:'Directe', icon:'🤝' },
  { code:'2.3.5', label:"Accompagnements en matière de ressources et d'autogestion", cat:'Directe', icon:'💰' },
  { code:'2.4.1', label:'Coordination renforcée pour la cohérence du parcours', cat:'Directe', icon:'🧭' },
  // Prestations indirectes (PI) — pilotage et fonctions support
  { code:'3.1.1', label:'Gestion des ressources humaines', cat:'Indirecte', icon:'👥' },
  { code:'3.1.2', label:'Gestion administrative, budgétaire, financière et comptable', cat:'Indirecte', icon:'📊' },
  { code:'3.1.3', label:'Information et communication', cat:'Indirecte', icon:'💬' },
  { code:'3.1.4', label:'Qualité et sécurité', cat:'Indirecte', icon:'🛡️' },
  { code:'3.1.5', label:'Relations avec le territoire', cat:'Indirecte', icon:'🌍' },
  { code:'3.1.6', label:'Transports liés à gérer, manager, coopérer', cat:'Indirecte', icon:'🚐' },
  { code:'3.2.1', label:'Locaux et autres ressources pour accueillir', cat:'Indirecte', icon:'🏛️' },
  { code:'3.2.2', label:'Fournir des repas', cat:'Indirecte', icon:'🍽️' },
  { code:'3.2.3', label:'Entretenir le linge', cat:'Indirecte', icon:'🧺' },
  { code:'3.2.4', label:'Transports liés au projet individuel', cat:'Indirecte', icon:'🚗' },
  { code:'3.2.5', label:'Transports des biens et matériels liés à la restauration et au linge', cat:'Indirecte', icon:'📦' }
];

function getSpData(r) {
  const sp = r.serafinph || {};
  const selected = Array.isArray(sp.selected) ? sp.selected.filter(c => SP_NOMENCLATURE.some(p => p.code === c)) : [];
  const prestations = {};
  selected.forEach(code => { prestations[code] = { niveau: (sp.prestations && sp.prestations[code] && sp.prestations[code].niveau) || 0 }; });
  return { selected, prestations, dateEvaluation: sp.dateEvaluation || '', notes: sp.notes || '' };
}

// ── DEFAULT DATA ──
const DEFAULTS = {
  categories: [
    { id:1,  name:'Autonomie',                   color:'#3b82f6' },
    { id:2,  name:'Santé et bien-être',           color:'#ef4444' },
    { id:3,  name:'Logement',                     color:'#10b981' },
    { id:4,  name:'Vie sociale et loisirs',       color:'#f59e0b' },
    { id:5,  name:'Vie affective et familiale',   color:'#8b5cf6' },
    { id:6,  name:'Gestion du budget',            color:'#06b6d4' },
    { id:7,  name:'Transport et déplacement',     color:'#f97316' },
    { id:8,  name:'Orientation',                  color:'#84cc16' },
    { id:9,  name:'Accompagnement',               color:'#0ea5e9' },
    { id:10, name:'Administratif',                color:'#a855f7' }
  ],
  objectives: [
    { id:1, name:'Autonomie', description:"Développement de l'autonomie au quotidien" },
    { id:2, name:'Insertion sociale', description:'Intégration dans la vie sociale et collective' },
    { id:3, name:'Santé', description:'Suivi et maintien de la santé physique et psychique' },
    { id:4, name:'Scolarité / Formation', description:'Accompagnement scolaire et professionnel' },
    { id:5, name:'Lien familial', description:'Maintien et soutien du lien familial' },
    { id:6, name:'Logement', description:'Préparation à un logement autonome' }
  ],
  settings: { etablissement:'Foyer d\'Hébergement Les Trois Rivières', ville:'', tel:'', email:'', capacite:'' },
  branding: { primaryColor:'#0f2b4a', accentColor:'#e85d04', logo:'' },
  users: [{ id:1, prenom:'Admin', nom:'', username:'admin', password:'admin123', role:'admin', super:true }],
  vehicules: ['Renault Kangoo', 'Citroën Berlingo', 'Peugeot Partner', 'Volkswagen Caddy'],
  fonctionColors: [
    { id: 1, fonction: 'Éducateur spécialisé', color: '#3b82f6', permissions: ['view_dashboard','access_notes','access_messages','access_annuaire','access_documentation','access_conges','access_formations','access_planning_equipe','view_residents','edit_residents','access_journal','access_presences','access_repertoire','access_documents','view_incidents','access_activites','access_medicaments','access_ppe','access_vehicules'] },
    { id: 2, fonction: 'Moniteur-éducateur', color: '#6366f1', permissions: ['view_dashboard','access_notes','access_messages','access_annuaire','access_documentation','access_conges','access_formations','access_planning_equipe','view_residents','access_journal','access_presences','access_repertoire','access_documents','view_incidents','access_activites','access_medicaments','access_ppe','access_vehicules'] },
    { id: 3, fonction: 'Psychologue', color: '#8b5cf6', permissions: ['view_dashboard','access_notes','access_messages','access_annuaire','access_documentation','access_conges','access_formations','access_planning_equipe','view_residents','access_journal','access_ppe','access_repertoire','access_documents','access_sante','view_incidents','access_activites'] },
    { id: 4, fonction: 'Infirmier', color: '#ef4444', permissions: ['view_dashboard','access_notes','access_messages','access_annuaire','access_documentation','access_conges','access_formations','access_planning_equipe','view_residents','access_journal','access_presences','access_repertoire','access_documents','access_sante','view_incidents','access_medicaments'] },
    { id: 5, fonction: 'Aide-soignant', color: '#f43f5e', permissions: ['view_dashboard','access_notes','access_messages','access_annuaire','access_documentation','access_conges','access_formations','access_planning_equipe','view_residents','access_journal','access_presences','access_sante','access_medicaments','view_incidents'] },
    { id: 6, fonction: 'Maître / Maîtresse de maison', color: '#ec4899', permissions: ['view_dashboard','access_notes','access_messages','access_annuaire','access_documentation','access_conges','access_formations','access_planning_equipe','view_residents','access_journal','access_presences','access_vehicules'] },
    { id: 7, fonction: 'Veilleur de nuit', color: '#0ea5e9', permissions: ['view_dashboard','access_notes','access_messages','access_annuaire','access_documentation','access_conges','access_formations','access_planning_equipe','view_residents','access_journal','access_presences','view_incidents','access_medicaments'] },
    { id: 8, fonction: 'Agent hôtelier', color: '#14b8a6', permissions: ['view_dashboard','access_notes','access_messages','access_annuaire','access_documentation','access_conges','access_formations','access_planning_equipe','access_presences','access_vehicules'] },
    { id: 9, fonction: 'Agent d\'entretien', color: '#84cc16', permissions: ['view_dashboard','access_notes','access_messages','access_annuaire','access_documentation','access_conges','access_formations','access_planning_equipe','access_vehicules'] },
    { id: 10, fonction: 'Chef de service', color: '#f59e0b', permissions: ['view_dashboard','access_notes','access_messages','access_annuaire','access_documentation','access_conges','access_formations','access_planning_equipe','view_residents','edit_residents','access_journal','access_presences','access_repertoire','access_documents','view_incidents','access_activites','access_medicaments','access_ppe','access_vehicules','access_sante','validate_incidents','edit_planning_equipe','access_interventions','access_viatrajectoire','access_serafinph','access_entretiens','access_admissions','access_budget','access_cvs','access_facturation'] },
    { id: 11, fonction: 'Responsable hébergement', color: '#d97706', permissions: ['view_dashboard','access_notes','access_messages','access_annuaire','access_documentation','access_conges','access_formations','access_planning_equipe','view_residents','edit_residents','access_journal','access_presences','access_repertoire','access_documents','view_incidents','access_activites','access_medicaments','access_ppe','access_vehicules','access_sante','validate_incidents','edit_planning_equipe','access_interventions','access_entretiens','access_admissions','access_budget','access_cvs','access_facturation'] },
    { id: 12, fonction: 'Secrétaire / Assistant administratif', color: '#78716c', permissions: ['view_dashboard','access_notes','access_messages','access_annuaire','access_documentation','access_conges','access_formations','access_planning_equipe','view_residents','access_presences','access_repertoire','access_documents','access_admissions','access_facturation'] },
    { id: 13, fonction: 'Directeur d\'établissement', color: '#dc2626', permissions: ['view_dashboard','view_residents','edit_residents','access_journal','access_presences','access_ppe','access_sante','access_medicaments','access_repertoire','access_documents','access_vehicules','access_interventions','view_incidents','validate_incidents','access_viatrajectoire','access_serafinph','access_planning_equipe','edit_planning_equipe','access_conges','access_notes','access_messages','access_budget','access_paie','access_entretiens','access_annuaire','access_documentation','access_admissions','access_facturation','access_formations','access_activites','access_cvs','access_admin','access_employes','manage_users'] },
    { id: 14, fonction: 'Comptable', color: '#0d9488', permissions: ['view_dashboard','access_notes','access_messages','access_annuaire','access_documentation','access_conges','access_paie','access_budget','access_facturation'] }
  ],
  aiPrompts: {
    ppe: {
      redaction: { system: 'Tu es un rédacteur de bilans socio-éducatifs pour ESMS. Rédige en français un texte professionnel et institutionnel.' },
      correction: { system: 'Tu es un correcteur professionnel. Corrige les fautes d\'orthographe, de grammaire et de syntaxe sans changer le style.' },
      reformulation: { system: 'Tu es un rédacteur institutionnel. Reformule ce texte en langage professionnel et institutionnel.' },
      avenant: { system: 'Tu es un rédacteur de PPE en ESMS. Tu reçois des observations du journal de bord pour un bénéficiaire. Pour chaque observation, identifie le domaine du PPE concerné (autonomie, sante, viePro, logement, vieSociale, vieAffective, budget, transport, orientation). Synthétise les informations dans le ou les domaines correspondants, sans rien inventer, sans ajouter d\'analyse. Conserve les faits, dates et éléments concrets. Pour chaque domaine, propose 1 à 3 objectifs concrets avec leurs moyens, échéances et critères d\'évaluation. Restitue UNIQUEMENT un objet JSON valide (sans balises, sans texte autour) : {"sections":{"autonomie":{"bilan":"...","objectifs":[{"objectif":"...","moyens":"...","echeance":"2026-12","evaluation":"..."}],"expression":"..."},"sante":{"bilan":"...","objectifs":[],"expression":"..."},"viePro":{"bilan":"...","objectifs":[],"expression":"..."},"logement":{"bilan":"...","objectifs":[],"expression":"..."},"vieSociale":{"bilan":"...","objectifs":[],"expression":"..."},"vieAffective":{"bilan":"...","objectifs":[],"expression":"..."},"budget":{"bilan":"...","objectifs":[],"expression":"..."},"transport":{"bilan":"...","objectifs":[],"expression":"..."},"orientation":{"bilan":"...","objectifs":[],"expression":"..."}},"conclusion":"..."}. Pour chaque domaine : le bilan est une synthèse factuelle des observations pertinentes (2-3 phrases) ; l\'expression retranscrit le point de vue du bénéficiaire s\'il est rapporté ; les objectifs sont concrets et réalistes. Si aucun élément ne concerne un domaine, écrire "Aucune observation dans ce domaine."' }
    },
    journal: {
      redaction: { system: 'Tu es un éducateur spécialisé rédigeant une observation pour le journal de bord d\'un établissement médico-social. Écris en français, de manière professionnelle et factuelle.' },
      correction: { system: 'Tu es un correcteur professionnel. Corrige les fautes d\'orthographe, de grammaire et de syntaxe sans changer le style.' },
      reformulation: { system: 'Tu es un rédacteur institutionnel. Reformule ce texte de manière professionnelle.' }
    },
    messages: {
      redaction: { system: 'Tu es un professionnel en ESMS qui rédige un message interne court et professionnel. Réponds en français.' },
      correction: { system: 'Tu es un correcteur professionnel. Corrige les fautes sans changer le style.' },
      reformulation: { system: 'Tu es un rédacteur institutionnel. Reformule ce message de manière professionnelle.' }
    }
  }
};

function initDefaults() {
  initEtabs();
  const _catVersion = 'v3';
  if (localStorage.getItem('ftr_cat_version') !== _catVersion) {
    DB.set(DB.keys.categories, DEFAULTS.categories);
    localStorage.setItem('ftr_cat_version', _catVersion);
  } else if (!DB.get(DB.keys.categories)) {
    DB.set(DB.keys.categories, DEFAULTS.categories);
  }
  if (!DB.get(DB.keys.objectives)) DB.set(DB.keys.objectives, DEFAULTS.objectives);
  if (!DB.get(DB.keys.residents)) DB.set(DB.keys.residents, []);
  if (!DB.get(DB.keys.journal)) DB.set(DB.keys.journal, []);
  if (!DB.get(DB.keys.presences)) DB.set(DB.keys.presences, {});
  if (!DB.get(DB.keys.planning)) DB.set(DB.keys.planning, []);
  if (!DB.get(DB.keys.settings)) DB.set(DB.keys.settings, DEFAULTS.settings);
  if (!DB.get(DB.keys.user)) DB.set(DB.keys.user, { nom:'Administrateur', prenom:'', role:'Administrateur' });
  if (!DB.get(DB.keys.branding)) DB.set(DB.keys.branding, DEFAULTS.branding);
  if (!DB.get(DB.keys.users)) DB.set(DB.keys.users, DEFAULTS.users);
  migrateSuperAdmin();
  if (!DB.get(DB.keys.vehicules)) DB.set(DB.keys.vehicules, DEFAULTS.vehicules);
  if (!DB.get(DB.keys.documents)) DB.set(DB.keys.documents, {});
  if (!DB.get(DB.keys.incidents)) DB.set(DB.keys.incidents, []);
  if (!DB.get(DB.keys.ppe)) DB.set(DB.keys.ppe, []);
  if (!localStorage.getItem('ftr_conges')) localStorage.setItem('ftr_conges', '[]');
  if (!DB.get(DB.keys.viatrajectoire)) DB.set(DB.keys.viatrajectoire, []);
  if (!DB.get(DB.keys.fonctionColors)) DB.set(DB.keys.fonctionColors, DEFAULTS.fonctionColors);
  else migrateFonctionColors();
  // Migration unique : applique les permissions par défaut aux rôles standard
  if (localStorage.getItem(DB._k('ftr_perm_v')) !== '1') { applyDefaultFonctionPerms(); localStorage.setItem(DB._k('ftr_perm_v'), '1'); }
  if (!DB.get(DB.keys.aiPrompts)) DB.set(DB.keys.aiPrompts, DEFAULTS.aiPrompts);
  // Clé Mistral retirée (IA désactivée). Purge l'éventuelle clé restée en localStorage.
  try { DB.set(DB.keys.aiKey, ''); localStorage.removeItem(DB._k(DB.keys.aiKey)); } catch (_) {}
}
function migrateFonctionColors() {
  const existing = DB.get(DB.keys.fonctionColors) || [];
  const existingNames = new Set(existing.map(f => f.fonction));
  let changed = false;
  DEFAULTS.fonctionColors.forEach((f, i) => {
    if (!existingNames.has(f.fonction)) {
      existing.push({ ...f, id: 1000 + i });
      changed = true;
    }
  });
  if (changed) DB.set(DB.keys.fonctionColors, existing);
}

// Applique (une fois) les permissions par défaut aux fonctions standard existantes
function applyDefaultFonctionPerms() {
  const list = DB.get(DB.keys.fonctionColors) || [];
  let changed = false;
  list.forEach(f => {
    const def = DEFAULTS.fonctionColors.find(d => d.fonction === f.fonction);
    if (def) { f.permissions = [...def.permissions]; changed = true; }
  });
  if (changed) DB.set(DB.keys.fonctionColors, list);
}

// Garde d'accès à un module : true si admin ou permission accordée, sinon affiche un refus
function requireModule(perm) {
  const s = Auth.getSession();
  if (s && (s.role === 'admin' || s.role === 'superadmin' || hasPermission(s.userId, perm))) return true;
  document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;font-family:Inter,system-ui,sans-serif;color:#64748b;padding:2rem">'
    + '<div><div style="font-size:2.2rem;margin-bottom:.5rem">⛔</div>'
    + '<div style="font-size:1.15rem;font-weight:700;color:#0f2b4a">Accès refusé</div>'
    + '<div style="font-size:.9rem;margin-top:.4rem">Vous n\'avez pas la permission d\'accéder à ce module.</div>'
    + '<a href="accueil.html" style="display:inline-block;margin-top:1.2rem;background:#0f2b4a;color:#fff;padding:.6rem 1.5rem;border-radius:8px;text-decoration:none;font-size:.85rem;font-weight:600">← Retour à l\'accueil</a></div></div>';
  return false;
}

// ── AUDIT LOG ──
function auditLog(action, details) {
  try {
    const session = Auth?.getSession?.();
    if (!session) return;
    const log = JSON.parse(localStorage.getItem('ftr_audit_log') || '[]');
    log.unshift({
      id: genId(),
      date: new Date().toISOString(),
      userId: session.userId,
      user: [session.prenom, nomMaj(session.nom)].filter(Boolean).join(' ') || session.username,
      role: session.role,
      action,
      details: details || ''
    });
    if (log.length > 1000) log.length = 1000;
    localStorage.setItem('ftr_audit_log', JSON.stringify(log));
  } catch {}
}

// ── LOGIN HISTORY ──
function logConnexion(action, user) {
  const log = DB.get(DB.keys.loginHistory) || [];
  log.unshift({
    id: genId(),
    action: action,
    username: user.username || '?',
    prenom: user.prenom || '',
    nom: user.nom || '',
    role: user.role || '',
    date: new Date().toISOString()
  });
  if (log.length > 500) log.length = 500;
  DB.set(DB.keys.loginHistory, log);
}

// ── AUTH ──
// ── HACHAGE DES MOTS DE PASSE (SHA-256 + sel, fallback simple si crypto.subtle indisponible) ──
const _PWD_SALT = 'ftr.internalis.pwd.v1';
async function hashPassword(pwd) {
  try {
    const data = new TextEncoder().encode(_PWD_SALT + ':' + (pwd || ''));
    const buf = await crypto.subtle.digest('SHA-256', data);
    return 'h$' + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback : hash simple pour environnements non-sécurisés (file://, etc.)
    let h = 0;
    const s = _PWD_SALT + ':' + (pwd || '');
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return 'h$' + Math.abs(h).toString(16).padStart(8, '0');
  }
}
function isHashedPwd(s) { return typeof s === 'string' && s.startsWith('h$'); }

const Auth = {
  getSession() { return DB.get(DB.keys.session); },
  async login(username, password) {
    const users = DB.get(DB.keys.users) || DEFAULTS.users;
    const user = users.find(u => u.username === username.trim());
    if (!user) return false;
    let ok = false;
    if (isHashedPwd(user.password)) {
      ok = user.password === await hashPassword(password);
    } else if (user.password === password) {
      // Ancien mot de passe en clair → on le convertit en haché
      ok = true;
      user.password = await hashPassword(password);
      DB.set(DB.keys.users, users);
    }
    if (!ok) return false;
    DB.set(DB.keys.session, { userId: user.id, username: user.username, role: user.role, super: !!user.super, prenom: user.prenom || '', nom: user.nom || '', fonction: user.fonction || '', mustChangePassword: user.mustChangePassword || false });
    logConnexion('login', user);
    return true;
  },
  logout() {
    const s = DB.get(DB.keys.session);
    if (s) logConnexion('logout', s);
    DB.remove(DB.keys.session);
    sessionStorage.removeItem('ftr_current_etab');
    if (typeof supabaseClient !== 'undefined') supabaseClient.auth.signOut();
    window.location.href = 'index.html';
  },
  requireAuth() {
    const s = this.getSession();
    if (!s) { window.location.href = 'index.html'; return null; }
    // Vérifier qu'un établissement est sélectionné
    const etabId = sessionStorage.getItem('ftr_current_etab');
    const etabs = getEtabs();
    if (!etabId || !etabs.find(e => String(e.id) === etabId)) {
      if (etabs.length === 1) {
        sessionStorage.setItem('ftr_current_etab', String(etabs[0].id));
      } else if (etabs.length > 1) {
        window.location.href = 'accueil.html';
        return null;
      }
    }
    // Appliquer terminologie et fond selon le type d'établissement
    const _applyAll = () => { applyTerminology(); applyEtabBackground(); };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _applyAll);
    } else {
      setTimeout(_applyAll, 0);
    }
    return s;
  },
  requireAdmin() {
    const s = this.requireAuth();
    if (!s) return null;
    if (s.role !== 'admin' && s.role !== 'superadmin' && !canAccessAdmin(s.userId)) { window.location.href = 'dashboard.html'; return null; }
    return s;
  },
  isAdmin() {
    const s = this.getSession();
    if (!s) return false;
    return s.role === 'admin' || s.role === 'superadmin' || canAccessAdmin(s.userId);
  },
  // Accès RH : admins + comptes au rôle "rh" (encadrement / RH)
  isRH() {
    const s = this.getSession();
    if (!s) return false;
    return s.role === 'rh' || this.isAdmin();
  },
  isSuperAdmin() {
    const s = this.getSession();
    if (!s) return false;
    if (s.super || s.role === 'superadmin') return true;
    const u = (DB.get(DB.keys.users) || []).find(x => String(x.id) === String(s.userId));
    return !!(u && (u.super || u.role === 'superadmin'));
  },
  requireSuperAdmin() {
    const s = this.requireAuth();
    if (!s) return null;
    if (!this.isSuperAdmin()) { window.location.href = 'accueil.html'; return null; }
    return s;
  }
};

// Lit les données d'un établissement précis (clé suffixée), pour la console groupe
function getEtabData(etabId, key) {
  return JSON.parse(localStorage.getItem(`${key}__${etabId}`) || 'null');
}

// S'assure qu'au moins un super administrateur existe (drapeau super:true sur l'admin par défaut)
function migrateSuperAdmin() {
  const users = DB.get(DB.keys.users) || [];
  if (!users.length) return;
  let changed = false;
  // Normalise un éventuel role 'superadmin' (ancienne approche) → role 'admin' + super:true
  users.forEach(u => { if (u.role === 'superadmin') { u.role = 'admin'; u.super = true; changed = true; } });
  // Garantit au moins un super admin
  if (!users.some(u => u.super)) {
    const t = users.find(u => u.username === 'admin') || users.find(u => u.role === 'admin') || users[0];
    if (t) { t.super = true; if (!t.role) t.role = 'admin'; changed = true; }
  }
  if (changed) DB.set(DB.keys.users, users);
  // Normalise une session ouverte avec l'ancien role 'superadmin'
  const sess = DB.get(DB.keys.session);
  if (sess && sess.role === 'superadmin') { sess.role = 'admin'; sess.super = true; DB.set(DB.keys.session, sess); }
}

// ── STRUCTURE TYPE (toujours adulte) ──
function getStructureType() { return 'adultes'; }
function isAdult() { return true; }
function isChild() { return false; }

// ── PHOTO HELPERS ──
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function residentPhoto(r, size = 48) {
  if (r && r.photo) {
    return `<img src="${escHtml(r.photo)}" alt="${escHtml(r.prenom||'')} ${escHtml(r.nom||'')}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:2px solid var(--border)"/>`;
  }
  const bg = r?.color || 'var(--blue)';
  const fs = size < 36 ? '.65rem' : size < 48 ? '.75rem' : size < 64 ? '1rem' : '1.4rem';
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${fs};color:#fff;flex-shrink:0">${initials(r?.prenom||'', r?.nom||'')}</div>`;
}

// ── APPLY BRANDING ──
function applyBranding() {
  const b = DB.get(DB.keys.branding) || DEFAULTS.branding;
  const root = document.documentElement;
  if (b.primaryColor) {
    root.style.setProperty('--primary', b.primaryColor);
    root.style.setProperty('--primary-h', adjustColor(b.primaryColor, 15));
  }
  if (b.accentColor) {
    root.style.setProperty('--accent', b.accentColor);
    root.style.setProperty('--accent-h', adjustColor(b.accentColor, 15));
  }
  if (b.logo) {
    document.querySelectorAll('.sidebar-logo-img').forEach(el => {
      el.src = b.logo; el.style.display = '';
    });
    document.querySelectorAll('.logo-icon').forEach(el => el.style.display = 'none');
  }
}

function adjustColor(hex, amount) {
  let h = hex.replace('#','');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  const num = parseInt(h, 16);
  const r = Math.min(255, (num>>16) + amount);
  const g = Math.min(255, ((num>>8)&0xff) + amount);
  const b = Math.min(255, (num&0xff) + amount);
  return '#' + ((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}

// ── ID GENERATOR ──
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);

// ── TOAST ──
function toast(msg, type='success') {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id='toast-container'; c.className='toast-container'; document.body.appendChild(c); }
  const t = document.createElement('div');
  const icons = { success:'✓', error:'✕', info:'ℹ' };
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]||'•'}</span> ${msg}`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateY(20px)'; t.style.transition='.2s ease'; setTimeout(()=>t.remove(), 200); }, 3000);
}

// ── MODAL ──
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('open'); document.body.style.overflow='hidden'; }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('open'); document.body.style.overflow=''; }
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay.open').forEach(m => { m.classList.remove('open'); });
  document.body.style.overflow='';
}

// ── SIDEBAR ACTIVE ──
function setActiveNav() {
  const path = location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.menu-popup-item').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === path);
  });
}

// ── AVATAR INITIALS ──
function initials(prenom='', nom='') {
  return ((prenom[0]||'') + (nom[0]||'')).toUpperCase() || '?';
}

function shortName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return parts[0] + ' ' + parts[parts.length-1][0] + '.';
}

// ── DATE HELPERS ──
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function age(dob) {
  if (!dob) return '—';
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / 31557600000) + ' ans';
}

function sanitizeUrl(url) {
  if (!url) return '';
  if (/^\s*javascript\s*:/i.test(url)) return '';
  return url.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── CATEGORY BADGE ──
function categoryBadge(catId) {
  const cats = DB.get(DB.keys.categories) || [];
  const cat = cats.find(c => c.id == catId);
  if (!cat) return '<span class="badge badge-gray">—</span>';
  return `<span class="badge" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${escHtml(cat.name)}</span>`;
}

// ── CONFIRM DIALOG ──
function confirmDialog(msg, cb) {
  if (confirm(msg)) cb();
}

// ── RENDER USER INFO ──
function renderUserInfo() {
  const session = Auth.getSession();
  const settings = DB.get(DB.keys.settings) || {};
  const nameEl = document.getElementById('headerUserName');
  const avEl = document.getElementById('headerUserAvatar');
  const name = session ? [session.prenom, nomMaj(session.nom)].filter(Boolean).join(' ') || session.username : 'Utilisateur';
  if (nameEl) nameEl.textContent = name;
  if (avEl) avEl.textContent = session ? (initials(session.prenom || '', session.nom || '') || session.username?.[0]?.toUpperCase() || '?') : '?';
}

// ── MENU 9 POINTS ──
function initMenuPopup() {
  const header = document.querySelector('.header') || document.querySelector('.admin-topbar');
  if (!header) return;
  // Page chargée dans l'iframe du portail RH (rh.html) : son propre header ferait doublon
  // avec le header pleine largeur du portail — on le masque (sans le retirer du DOM,
  // certaines pages ciblent des éléments internes au header comme #pageTitle).
  if (window.self !== window.top) { header.style.display = 'none'; return; }
  const isAdmin = header.classList.contains('admin-topbar');

  // Get reference to the title wrapper before inserting the button
  const titleWrap = header.firstElementChild;

  // Add 9-dots button as first element in header (stays on left)
  // Skip the 9-dots button on the accueil page (modules already displayed)
  const isAccueil = location.pathname.endsWith('accueil.html');
  if (!isAccueil && !document.getElementById('homeBtn')) {
    // Home button (redirects to accueil). On force la navigation du document de
    // plus haut niveau pour casser hors de l'iframe quand la page est affichée
    // dans un panneau (ex: portail RH) — target="_top" seul n'est pas fiable partout.
    const homeBtn = document.createElement('a');
    homeBtn.id = 'homeBtn';
    homeBtn.className = 'menu-dots-btn';
    homeBtn.href = 'accueil.html';
    homeBtn.target = '_top';
    homeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V10"/></svg>';
    homeBtn.addEventListener('click', e => {
      if (window.top !== window.self) {
        e.preventDefault();
        window.top.location.href = 'accueil.html';
      }
    });
    header.insertBefore(homeBtn, header.firstChild);
    // Bouton « 9 points » retiré à la demande.
  }

  // French clock display (all pages)
  if (!document.getElementById('headerClock') && !isAdmin) {
    const clock = document.createElement('span');
    clock.id = 'headerClock';
    clock.style.cssText = 'font-size:1.1rem;font-weight:700;color:var(--g700);margin-left:.75rem;font-variant-numeric:tabular-nums;letter-spacing:.02em';
    function updateClock() {
      clock.textContent = new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    }
    updateClock();
    setInterval(updateClock, 1000);
    const ref = document.getElementById('menuDotsBtn') || document.querySelector('.header-right');
    if (ref) header.insertBefore(clock, ref.nextSibling);
    else header.appendChild(clock);
  }

  // Centered site brand
  if (!document.getElementById('headerBrand') && !isAdmin) {
    const brand = document.createElement('div');
    brand.id = 'headerBrand';
    brand.textContent = 'INTERNALIS';
    brand.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-family:\'Playfair Display\',serif;font-size:1.1rem;font-weight:900;color:#1e40af;letter-spacing:.16em;text-transform:uppercase;pointer-events:none';
    header.appendChild(brand);
  }

  // Add user avatar to header-right (or atb-right for admin page)
  const hr = isAdmin ? header.querySelector('.atb-right') : header.querySelector('.header-right');
  if (hr && !document.getElementById('headerUserBox')) {
    const session = Auth.getSession();
    const name = session ? [session.prenom, nomMaj(session.nom)].filter(Boolean).join(' ') || session.username : 'Utilisateur';
    const initial = session ? (initials(session.prenom || '', session.nom || '') || session.username?.[0]?.toUpperCase() || '?') : '?';
    const userBox = document.createElement('div');
    userBox.id = 'headerUserBox';
    userBox.style.cssText = 'display:flex;align-items:center;gap:.5rem;margin-left:1rem;cursor:pointer;position:relative';
    userBox.title = 'Profil';

    const nameSpan = document.createElement('span');
    nameSpan.id = 'headerUserName';
    nameSpan.style.cssText = 'font-size:.78rem;font-weight:600;color:var(--g700)';
    nameSpan.textContent = name;

    const avatarDiv = document.createElement('div');
    avatarDiv.id = 'headerUserAvatar';
    avatarDiv.style.cssText = 'width:32px;height:32px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.75rem';
    avatarDiv.textContent = initial;

    const dropdown = document.createElement('div');
    dropdown.id = 'userDropdown';
    dropdown.style.cssText = 'display:none;position:absolute;top:100%;right:0;margin-top:6px;background:#fff;border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);z-index:1000;min-width:180px;padding:.35rem';

    const ddName = document.createElement('div');
    ddName.style.cssText = 'padding:.6rem .85rem;border-bottom:1px solid var(--border);font-size:.8rem;font-weight:600;color:var(--g700)';
    ddName.textContent = name;

    const logoutBtn = document.createElement('div');
    logoutBtn.id = 'userLogoutBtn';
    logoutBtn.style.cssText = 'display:flex;align-items:center;gap:.5rem;padding:.6rem .85rem;cursor:pointer;border-radius:6px;color:#ef4444;font-size:.82rem;font-weight:500';
    logoutBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Déconnexion';

    dropdown.appendChild(ddName);
    dropdown.appendChild(logoutBtn);
    userBox.appendChild(nameSpan);
    userBox.appendChild(avatarDiv);
    userBox.appendChild(dropdown);

    userBox.onclick = (e) => {
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
      e.stopPropagation();
    };
    logoutBtn.onclick = (e) => {
      e.stopPropagation();
      Auth.logout();
      location.href = 'index.html';
    };

    hr.appendChild(userBox);
  }

  // ── Badge messages non lus dans le header ── (icône enveloppe retirée à la demande)
  if (false && !isAccueil && !document.getElementById('headerMsgBadge')) {
    const session = Auth.getSession();
    const hr2 = isAdmin ? header.querySelector('.atb-right') : header.querySelector('.header-right');
    if (hr2 && session) {
      const msgBtn = document.createElement('a');
      msgBtn.id = 'headerMsgBadge';
      msgBtn.href = 'messages.html';
      msgBtn.title = 'Messages';
      msgBtn.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:var(--g100);color:var(--g600);margin-left:.5rem;flex-shrink:0;text-decoration:none;transition:background .15s';
      msgBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:17px;height:17px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
      msgBtn.onmouseover = () => msgBtn.style.background = 'var(--g200)';
      msgBtn.onmouseout  = () => msgBtn.style.background = 'var(--g100)';

      const dot = document.createElement('span');
      dot.id = 'headerMsgDot';
      dot.style.cssText = 'display:none;position:absolute;top:2px;right:2px;min-width:16px;height:16px;background:#ef4444;color:#fff;border-radius:8px;font-size:.55rem;font-weight:700;display:none;align-items:center;justify-content:center;padding:0 3px;border:1.5px solid #fff;box-sizing:border-box';
      msgBtn.appendChild(dot);
      hr2.insertBefore(msgBtn, hr2.firstChild);

      function refreshMsgBadge() {
        const msgs = JSON.parse(localStorage.getItem('ftr_messages') || '[]');
        const uid = String(session.userId);
        const count = msgs.filter(m => String(m.from) !== uid && !(m.readBy||[]).map(String).includes(uid)).length;
        if (count > 0) {
          dot.textContent = count > 99 ? '99+' : count;
          dot.style.display = 'flex';
          msgBtn.style.color = '#ef4444';
        } else {
          dot.style.display = 'none';
          msgBtn.style.color = 'var(--g600)';
        }
      }
      refreshMsgBadge();
      setInterval(refreshMsgBadge, 15000);
    }
  }

  // Menu « 9 points » retiré : popup désactivé.
  if (false && !isAccueil && !document.getElementById('menuPopup')) {
    const popup = document.createElement('div');
    popup.id = 'menuPopup';
    popup.className = 'menu-popup';
    popup.innerHTML = `<div class="menu-popup-backdrop" id="menuPopupBackdrop"></div>
      <div class="menu-popup-body" id="menuPopupBody"></div>`;
    document.body.appendChild(popup);

    const modules = [
      { page:'dashboard.html', color:'#4f46e5', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>', label:'Tableau de bord' },
      { page:'residents.html', color:'#0891b2', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', label:'Résidents' },
      { page:'journal.html', color:'#059669', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>', label:'Journal de bord' },
      { page:'documents.html', color:'#8b5cf6', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>', label:'Documents' },
      { page:'ppe.html', color:'#dc2626', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>', label:'Avenants' },
      { page:'planning.html', color:'#d97706', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>', label:'Planning' },
      { page:'presences.html', color:'#16a34a', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>', label:'Présences' },
      { page:'vehicules.html', color:'#6366f1', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.5a1 1 0 0 0-.8.4L2 11v5h2m10 1.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h3m-3 0H9m6-6V7a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1v3M6 17.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0"/></svg>', label:'Véhicules' },
      { page:'incidents.html', color:'#e11d48', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>', label:'Incidents' },
      { page:'messages.html', color:'#0284c7', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>', label:'Messages' },
      { page:'viatrajectoire.html', color:'#e11d48', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>', label:'ViaTrajectoire' },
      { page:'serafinph.html', color:'#8b5cf6', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/><path d="M6 4h12"/><path d="M6 20h12"/></svg>', label:'SERAFIN-PH' },
      { page:'pilotage.html', color:'#0f2b4a', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/></svg>', label:'Portail' },
      { page:'repertoire.html', color:'#7c3aed', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>', label:'Répertoire' },
      { page:'admin-modules.html', color:'#78716c', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/></svg>', label:'Administration', admin:true }
    ];

    const body = document.getElementById('menuPopupBody');
    const isAdmin = Auth.isAdmin();
    body.innerHTML = modules.map(m => {
      if (m.admin && !isAdmin) return '';
      return `<a href="${m.page}" class="menu-popup-item">
        <span class="menu-popup-icon" style="background:${m.color}20;color:${m.color}">${m.icon}</span>
        <span>${m.label}</span>
      </a>`;
    }).join('');

    document.getElementById('menuDotsBtn').onclick = () => {
      popup.classList.add('open');
      positionPopup();
    };
    document.getElementById('menuPopupBackdrop').onclick = () => popup.classList.remove('open');
  }

  document.addEventListener('click', (e) => {
    const dd = document.getElementById('userDropdown');
    if (dd && !e.target.closest('#headerUserBox')) dd.style.display = 'none';
  });
}

function positionPopup() {
  const dotsBtn = document.getElementById('menuDotsBtn');
  const popup = document.getElementById('menuPopup');
  const body = document.getElementById('menuPopupBody');
  if (!dotsBtn || !popup || !body) return;
  const rect = dotsBtn.getBoundingClientRect();
  const gap = 8;
  let top = rect.bottom + gap;
  let left = rect.right - body.offsetWidth;
  if (left < 8) left = 8;
  if (top + body.offsetHeight > window.innerHeight) {
    top = rect.top - gap - body.offsetHeight;
  }
  body.style.position = 'fixed';
  body.style.top = top + 'px';
  body.style.left = left + 'px';
  body.style.marginRight = '0';
}

// ── INIT MODALS ──
function initModals() {
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => closeAllModals());
  });
}


// ── STATS FOR DASHBOARD ──
function getStats() {
  // Résidents : cache Supabase si chargé (pages migrées), sinon repli localStorage.
  const residents = (typeof sbResidents === 'function' && sbResidentsLoaded()) ? sbResidents() : (DB.get(DB.keys.residents) || []);
  const journal = DB.get(DB.keys.journal) || [];
  const planning = DB.get(DB.keys.planning) || [];
  const todayStr = today();
  const presences = DB.get(DB.keys.presences) || {};
  const todayPresences = presences[todayStr] || {};
  const presentCount = Object.values(todayPresences).filter(v => v === 'present').length;
  const vehiculeResa = planning.filter(e => e.type === 'vehicule' && e.date >= todayStr).length;
  return {
    totalResidents: residents.filter(r => r.statut !== 'sorti').length,
    totalEntries: journal.length,
    todayEntries: journal.filter(e => e.date && e.date.startsWith(todayStr)).length,
    presentsToday: presentCount,
    totalEvents: planning.filter(e => e.type !== 'vehicule').length,
    vehiculeResa
  };
}

function escHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── Nom de famille toujours en MAJUSCULES (convention « Prénom NOM ») ──
function nomMaj(n) { return (n == null ? '' : String(n)).toUpperCase(); }
function nomComplet(prenom, nom) { return [prenom, nomMaj(nom)].filter(Boolean).join(' ').trim(); }

// ── DÉTECTION DE DOUBLONS (local, par similarité de texte) ──
function _normTxt(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
// Similarité de Jaccard sur les mots significatifs (0 → 1)
function textSimilarity(a, b) {
  const ta = _normTxt(a).split(' ').filter(w => w.length > 2);
  const tb = _normTxt(b).split(' ').filter(w => w.length > 2);
  if (!ta.length || !tb.length) return 0;
  const sa = new Set(ta), sb = new Set(tb);
  let inter = 0;
  sa.forEach(w => { if (sb.has(w)) inter++; });
  return inter / new Set([...sa, ...sb]).size;
}
function _hoursBetween(d1, d2) {
  const t1 = new Date(d1).getTime(), t2 = new Date(d2).getTime();
  if (isNaN(t1) || isNaN(t2)) return Infinity;
  return Math.abs(t1 - t2) / 3600000;
}
// Cherche un doublon probable d'une transmission journal (même résident, < 3h, texte similaire)
function findJournalDuplicate(candidate, entries) {
  let best = null, bestSim = 0;
  for (const e of (entries || [])) {
    if (candidate.id && e.id === candidate.id) continue;
    if (String(e.residentId) !== String(candidate.residentId)) continue;
    if (_hoursBetween(e.date, candidate.date) > 3) continue;
    const sim = textSimilarity(e.contenu, candidate.contenu);
    if (sim >= 0.6 && sim > bestSim) { best = e; bestSim = sim; }
  }
  return best ? { entry: best, similarity: bestSim } : null;
}
// Cherche un doublon probable d'un incident (même résident, même type, même jour, heures proches, texte similaire)
function findIncidentDuplicate(candidate, list) {
  let best = null, bestSim = 0;
  for (const i of (list || [])) {
    if (candidate.id && i.id === candidate.id) continue;
    if (!candidate.residentId || String(i.residentId) !== String(candidate.residentId)) continue;
    if (i.type !== candidate.type) continue;
    if (i.date !== candidate.date) continue;
    if (candidate.heure && i.heure && _hoursBetween(candidate.date + 'T' + candidate.heure, i.date + 'T' + i.heure) > 3) continue;
    const sim = Math.max(textSimilarity(i.titre, candidate.titre), textSimilarity(i.description, candidate.description));
    if (sim >= 0.5 && sim > bestSim) { best = i; bestSim = sim; }
  }
  return best ? { incident: best, similarity: bestSim } : null;
}

const STATUT_PPE_LABEL = { brouillon:'Brouillon', actif:'Actif', termine:'Terminé' };

const DEMO_AUTHORS = [
  'Sarah Martin', 'Lucas Dubois', 'Emma Bernard', 'Hugo Leroy',
  'Chloé Moreau', 'Nathan Petit', 'Léa Robert', 'Mathis Richard',
  'Manon Simon', 'Enzo Durand', 'Camille Lambert', 'Raphaël Girard'
];

function getAuthorColor(e) {
  if (e.authorId) {
    const users = DB.get(DB.keys.users) || [];
    const u = users.find(x => x.id === e.authorId);
    if (u && u.fonction) {
      const f = u.fonction.toLowerCase();
      const list = DB.get(DB.keys.fonctionColors) || DEFAULTS.fonctionColors;
      for (const item of list) {
        if (f.includes(item.fonction.toLowerCase())) return item.color;
      }
    }
  }
  return 'var(--accent)';
}

function getJournalAuthor(e) {
  if (e.author) return e.author;
  if (e.authorId) {
    const users = DB.get(DB.keys.users) || [];
    const u = users.find(x => x.id === e.authorId);
    if (u) return [u.prenom, u.nom].filter(Boolean).join(' ') || u.username;
  }
  const idx = (e.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % DEMO_AUTHORS.length;
  return DEMO_AUTHORS[idx];
}

const PERMISSION_LABELS = {
  view_dashboard: 'Tableau de bord',
  view_residents: 'Consulter les résidents',
  edit_residents: 'Modifier les résidents',
  access_journal: 'Journal de bord',
  access_presences: 'Présences & planning',
  view_incidents: 'Voir les incidents',
  validate_incidents: 'Valider les incidents',
  access_sante: 'Santé / Médical (RDV, vaccins)',
  access_documents: 'Documents',
  access_vehicules: 'Véhicules',
  access_interventions: 'Interventions',
  access_ppe: 'PPE / Avenants',
  access_repertoire: 'Répertoire',
  access_admin: 'Administration',
  access_employes: 'Employés',
  access_viatrajectoire: 'ViaTrajectoire',
  access_serafinph: 'SERAFIN-PH',
  access_planning_equipe: 'Planning équipe',
  edit_planning_equipe: 'Modifier le planning équipe',
  access_conges: 'Congés',
  access_notes: 'Notes rapides',
  access_messages: 'Messages',
  access_budget: 'Budget & dépenses',
  access_paie: 'Fiches de paie',
  access_entretiens: 'Entretiens professionnels',
  access_annuaire: 'Contacts extérieurs', access_documentation: 'Documentation de l\'établissement', access_admissions: 'Admissions / liste d\'attente', access_facturation: 'Facturation / tarification', access_formations: 'Plan de formation collectif',
  access_activites: 'Activités éducatives',
  access_cvs: 'Conseil de la Vie Sociale (CVS)',
  access_medicaments: 'Distribution des médicaments',
  manage_users: 'Gérer les utilisateurs'
};

function hasPermission(userId, perm) {
  const users = DB.get(DB.keys.users) || [];
  // Comparaison souple de l'id (la session stocke parfois un nombre, la liste de l'établissement une chaîne, ou l'inverse)
  const u = users.find(x => String(x.id) === String(userId));
  // La fonction peut manquer dans la fiche scopée établissement : on retombe sur celle de la session
  const sess = DB.get(DB.keys.session);
  const fonctionRaw = (u && u.fonction) || (sess && String(sess.userId) === String(userId) ? sess.fonction : '') || '';
  const f = fonctionRaw.toLowerCase().trim();
  if (!f) return false;
  const list = DB.get(DB.keys.fonctionColors) || DEFAULTS.fonctionColors;
  const norm = s => (s || '').toLowerCase().trim();
  // 1) Correspondance exacte du nom de la fonction (prioritaire, évite qu'un nom court masque un nom long)
  let item = list.find(it => norm(it.fonction) === f);
  // 2) Sinon correspondance partielle dans les deux sens (tolère un renommage ou un suffixe)
  if (!item) item = list.find(it => { const r = norm(it.fonction); return r && (f.includes(r) || r.includes(f)); });
  if (!item) return false;
  return (item.permissions || []).includes(perm);
}

function canEditResidents(userId) {
  return hasPermission(userId, 'edit_residents');
}

function canViewAllIncidents(userId) {
  if (hasPermission(userId, 'view_all_incidents') || hasPermission(userId, 'view_incidents')) return true;
  const users = DB.get(DB.keys.users) || [];
  const u = users.find(x => x.id === userId);
  return u && (u.role === 'admin' || u.role === 'moderator');
}

function canValidateIncidents(userId) {
  if (hasPermission(userId, 'validate_incidents')) return true;
  const users = DB.get(DB.keys.users) || [];
  const u = users.find(x => x.id === userId);
  return u && (u.role === 'admin' || u.role === 'moderator');
}

function canAccessAdmin(userId) {
  return hasPermission(userId, 'access_admin');
}

function canManageUsers(userId) {
  return hasPermission(userId, 'manage_users');
}

// Accès aux modules : une seule source = permissions par rôle (voir hasPermission).

// ── AI (système DÉSACTIVÉ — retiré à la demande, clé Mistral supprimée) ──
// Toutes les fonctionnalités IA sont conditionnées à getAiKey() : en renvoyant
// toujours '' , les boutons IA (journal, PPE, messages…) sont masqués partout.
// Pour réactiver plus tard : passer par une Edge Function Supabase (clé côté
// serveur uniquement), et faire pointer callMistral() vers ce proxy.
function getAiKey() { return ''; }
function setAiKey() { /* no-op : IA désactivée */ }

function getAiPrompt(module, action) {
  const prompts = DB.get(DB.keys.aiPrompts) || {};
  return prompts[module]?.[action]?.system || DEFAULTS.aiPrompts[module]?.[action]?.system || '';
}
function setAiPrompt() { /* no-op : IA désactivée */ }

async function callMistral() { return null; }

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initDefaults();
  applyBranding();
  setActiveNav();
  initMenuPopup();
  initModals();
  renderUserInfo();
  if (!Auth.isAdmin()) {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }
  if (!Auth.isSuperAdmin()) {
    document.querySelectorAll('.superadmin-only').forEach(el => el.style.display = 'none');
  }
  if (location.protocol !== 'file:' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  initAutoLock();
});

// ── VERROUILLAGE AUTOMATIQUE PAR INACTIVITÉ ──
let _idleTimer = null;
const IDLE_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
function initAutoLock() {
  if (!Auth.getSession()) return;
  const lock = () => {
    try { logConnexion('logout', Auth.getSession()); } catch {}
    DB.remove(DB.keys.session);
    try { sessionStorage.setItem('ftr_lock_reason', 'idle'); } catch {}
    window.location.href = 'index.html';
  };
  const reset = () => { clearTimeout(_idleTimer); _idleTimer = setTimeout(lock, IDLE_LIMIT_MS); };
  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(ev =>
    document.addEventListener(ev, reset, { passive: true }));
  reset();
}

function getPosteOptions() {
  const list = DB.get(DB.keys.fonctionColors) || DEFAULTS.fonctionColors;
  return [['','— Sélectionner —'], ...list.map(f => [f.fonction, f.fonction])];
}
