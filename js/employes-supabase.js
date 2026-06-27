// ── COUCHE SUPABASE — EMPLOYÉS (fiches RH autonomes) ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

function _empToRow(e, etablissementId) {
  return {
    etablissement_id: etablissementId,
    profile_id:       e.profileId    || null,
    prenom:           e.prenom        || '',
    nom:              e.nom           || '',
    poste:            e.poste         || '',
    telephone:        e.telephone     || '',
    email:            e.email         || '',
    statut:           e.statut        || 'actif',
    date_embauche:    e.dateEmbauche  || null,
    notes:            e.notes         || '',
    color:            e.color         || null,
    heures_contrat:   (e.heuresContrat ?? 35),
    salaire_base:     (e.salaireBase ?? 0),
    photo:            e.photo         || '',
    updated_at:       new Date().toISOString()
  };
}

function _empFromRow(r) {
  return {
    id:            r.id,
    profileId:     r.profile_id     || null,
    prenom:        r.prenom         || '',
    nom:           (r.nom || '').toUpperCase(),
    poste:         r.poste          || '',
    telephone:     r.telephone      || '',
    email:         r.email          || '',
    statut:        r.statut         || 'actif',
    dateEmbauche:  r.date_embauche  || '',
    notes:         r.notes          || '',
    color:         r.color          || '',
    heuresContrat: (r.heures_contrat ?? 35),
    salaireBase:   (r.salaire_base ?? 0),
    photo:         r.photo          || '',
    createdAt:     r.created_at,
    updatedAt:     r.updated_at
  };
}

async function sbGetEmployes() {
  const { data, error } = await supabaseClient
    .from('employes')
    .select('*')
    .order('nom', { ascending: true });
  if (error) { console.error(error); toast('Erreur chargement employés', 'error'); return []; }
  return data.map(_empFromRow);
}

async function sbSaveEmploye(e) {
  const etablissementId = await sbGetEtablissementId();
  const row = _empToRow(e, etablissementId);
  if (e.id) {
    const { data, error } = await supabaseClient
      .from('employes').update(row).eq('id', e.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune ligne mise à jour — id=' + e.id);
    return _empFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('employes').insert(row).select();
  if (error) throw error;
  return _empFromRow(data[0]);
}

async function sbDeleteEmploye(id) {
  const { data, error } = await supabaseClient
    .from('employes').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune ligne supprimée — id=' + id);
}

async function sbUpdateEmployeField(id, fields) {
  const { data, error } = await supabaseClient
    .from('employes').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Mise à jour échouée — id=' + id);
  return _empFromRow(data[0]);
}
