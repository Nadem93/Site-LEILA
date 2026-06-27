// ── COUCHE SUPABASE — FORMATIONS (plan collectif) ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

function _frmToRow(f, etablissementId) {
  return {
    etablissement_id: etablissementId,
    titre:            f.titre        || '',
    organisme:        f.organisme    || '',
    domaine:          f.domaine      || '',
    date_debut:       f.dateDebut    || null,
    date_fin:         f.dateFin      || null,
    duree_heures:     (f.dureeHeures ?? 0),
    cout:             (f.cout ?? 0),
    max_participants: (f.maxParticipants ?? null),
    statut:           f.statut       || 'planifiee',
    participants:     f.participants || [],
    notes:            f.notes        || '',
    updated_at:       new Date().toISOString()
  };
}

function _frmFromRow(r) {
  return {
    id:              r.id,
    titre:           r.titre,
    organisme:       r.organisme       || '',
    domaine:         r.domaine         || '',
    dateDebut:       r.date_debut       || '',
    dateFin:         r.date_fin         || '',
    dureeHeures:     r.duree_heures     ?? 0,
    cout:            r.cout             ?? 0,
    maxParticipants: r.max_participants ?? null,
    statut:          r.statut           || 'planifiee',
    participants:    r.participants     || [],
    notes:           r.notes            || '',
    createdAt:       r.created_at,
    updatedAt:       r.updated_at
  };
}

async function sbGetFormations() {
  const { data, error } = await supabaseClient
    .from('formations')
    .select('*')
    .order('date_debut', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement formations', 'error'); return []; }
  return data.map(_frmFromRow);
}

async function sbSaveFormation(f) {
  const etablissementId = await sbGetEtablissementId();
  const row = _frmToRow(f, etablissementId);
  if (f.id) {
    const { data, error } = await supabaseClient
      .from('formations').update(row).eq('id', f.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune ligne mise à jour — id=' + f.id);
    return _frmFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('formations').insert(row).select();
  if (error) throw error;
  return _frmFromRow(data[0]);
}

// Mise à jour ciblée des participants (inscription / désinscription self-service)
async function sbSetFormationParticipants(id, participants) {
  const { data, error } = await supabaseClient
    .from('formations').update({ participants, updated_at: new Date().toISOString() }).eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Mise à jour échouée — id=' + id);
  return _frmFromRow(data[0]);
}

async function sbDeleteFormation(id) {
  const { data, error } = await supabaseClient
    .from('formations').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune ligne supprimée — id=' + id);
}
