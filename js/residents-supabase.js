// ── COUCHE DE CONNEXION SUPABASE — RÉSIDENTS ──
// Fait le pont entre le format utilisé par residents.js (camelCase, comme avant)
// et les colonnes de la table Postgres (snake_case).

let _sbEtablissementId = null;

async function sbGetEtablissementId() {
  if (_sbEtablissementId) return _sbEtablissementId;
  const { data: userData } = await supabaseClient.auth.getUser();
  if (!userData?.user) throw new Error('Non connecté');
  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('etablissement_id')
    .eq('id', userData.user.id)
    .single();
  if (error) throw error;
  _sbEtablissementId = profile.etablissement_id;
  return _sbEtablissementId;
}

// camelCase (app) → snake_case (colonnes Postgres)
function _sbToRow(r) {
  return {
    nom: r.nom, prenom: r.prenom, photo: r.photo,
    dob: r.dob || null, genre: r.genre, entree: r.entree || null,
    date_sortie: r.dateSortie || null,
    statut: r.statut, chambre: r.chambre, referent: r.referent,
    color: r.color, notes: r.notes, contacts: r.contacts,
    objectifs: r.objectifs || [],
    medecin: r.medecin, medecin_tel: r.medecinTel,
    allergies: r.allergies, nss: r.nss, ins: r.ins,
    dmp: r.dmp, dmp_date: r.dmpDate || null,
    consent: r.consent, consent_date: r.consentDate || null,
    tuteur: r.tuteur, tuteur_tel: r.tuteurTel,
    ecole: r.ecole, classe: r.classe,
    organisme: r.organisme, dossier: r.dossier,
    situation_pro: r.situationPro, ressources: r.ressources,
    organisme_a: r.organismeA, dossier_a: r.dossierA,
    situation_admin: r.situationAdmin, protection: r.protection,
    sante: r.sante || {}, sorties: r.sorties || [], trousseau: r.trousseau || [],
    activites: r.activites || [], budget: r.budget || {},
    objectifs_suivi: r.objectifsSuivi || {}, evaluations: r.evaluations || [],
    serafinph: r.serafinph || {},
    updated_at: new Date().toISOString()
  };
}

// snake_case (Postgres) → camelCase (app)
function _sbFromRow(row) {
  return {
    id: row.id, nom: row.nom, prenom: row.prenom, photo: row.photo,
    dob: row.dob, genre: row.genre, entree: row.entree,
    dateSortie: row.date_sortie,
    statut: row.statut, chambre: row.chambre, referent: row.referent,
    color: row.color, notes: row.notes, contacts: row.contacts,
    objectifs: row.objectifs || [],
    medecin: row.medecin, medecinTel: row.medecin_tel,
    allergies: row.allergies, nss: row.nss, ins: row.ins,
    dmp: row.dmp, dmpDate: row.dmp_date,
    consent: row.consent, consentDate: row.consent_date,
    tuteur: row.tuteur, tuteurTel: row.tuteur_tel,
    ecole: row.ecole, classe: row.classe,
    organisme: row.organisme, dossier: row.dossier,
    situationPro: row.situation_pro, ressources: row.ressources,
    organismeA: row.organisme_a, dossierA: row.dossier_a,
    situationAdmin: row.situation_admin, protection: row.protection,
    sante: row.sante || {}, sorties: row.sorties || [], trousseau: row.trousseau || [],
    activites: row.activites || [], budget: row.budget || {},
    objectifsSuivi: row.objectifs_suivi || {}, evaluations: row.evaluations || [],
    serafinph: row.serafinph || {},
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}

async function sbGetResidents() {
  const { data, error } = await supabaseClient.from('residents').select('*');
  if (error) { console.error(error); toast('Erreur de chargement des résidents', 'error'); return []; }
  return data.map(_sbFromRow);
}

// ── Cache résidents en LECTURE SEULE, partagé par les modules secondaires ──
// (affichage uniquement ; aucune écriture ne passe par ce cache).
// Noms volontairement distincts de _residentsCache (residents.js / modules d'écriture)
// pour éviter toute collision de déclaration quand plusieurs scripts coexistent.
let _sbResidentsCache = null;
async function sbLoadResidentsCache() { _sbResidentsCache = await sbGetResidents(); return _sbResidentsCache; }
function sbResidentsLoaded() { return _sbResidentsCache !== null; }
function sbResidents() { return _sbResidentsCache || []; }

async function sbSaveResident(data) {
  const row = _sbToRow(data);
  if (data.id) {
    const { data: updated, error } = await supabaseClient.from('residents').update(row).eq('id', data.id).select().single();
    if (error) throw error;
    return _sbFromRow(updated);
  } else {
    row.etablissement_id = await sbGetEtablissementId();
    const { data: inserted, error } = await supabaseClient.from('residents').insert(row).select().single();
    if (error) throw error;
    return _sbFromRow(inserted);
  }
}

async function sbDeleteResident(id) {
  const { error } = await supabaseClient.from('residents').delete().eq('id', id);
  if (error) throw error;
}
