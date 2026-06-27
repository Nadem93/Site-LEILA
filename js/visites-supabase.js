// ── COUCHE SUPABASE — VISITES & HÉBERGEMENTS FAMILLE ──
// sbGetEtablissementId() défini dans js/residents-supabase.js
// Les droits de visite (cadre par résident) restent sur la fiche résident.

function _visToRow(v, etablissementId) {
  return {
    etablissement_id: etablissementId,
    resident_id:   v.residentId   || null,
    resident_name: v.residentName || '',
    type:          v.type         || 'libre',
    personne:      v.personne     || '',
    lien:          v.lien         || '',
    date:          v.date         || null,
    heure:         v.heure        || '',
    date_retour:   v.dateRetour   || null,
    heure_retour:  v.heureRetour  || '',
    lieu:          v.lieu         || '',
    notes:         v.notes        || '',
    statut:        v.statut       || 'prevue',
    statut_at:     v.statutAt     || null,
    created_by:    v.createdBy    || '',
    updated_at:    new Date().toISOString()
  };
}

function _visFromRow(r) {
  return {
    id:           r.id,
    residentId:   r.resident_id   || '',
    residentName: r.resident_name || '',
    type:         r.type          || 'libre',
    personne:     r.personne      || '',
    lien:         r.lien          || '',
    date:         r.date          || '',
    heure:        r.heure         || '',
    dateRetour:   r.date_retour   || '',
    heureRetour:  r.heure_retour  || '',
    lieu:         r.lieu          || '',
    notes:        r.notes         || '',
    statut:       r.statut        || 'prevue',
    statutAt:     r.statut_at     || null,
    createdBy:    r.created_by     || '',
    createdAt:    r.created_at
  };
}

async function sbGetVisites() {
  const { data, error } = await supabaseClient
    .from('visites')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement visites', 'error'); return []; }
  return data.map(_visFromRow);
}

async function sbSaveVisite(v) {
  const etablissementId = await sbGetEtablissementId();
  const row = _visToRow(v, etablissementId);
  if (v.id) {
    const { data, error } = await supabaseClient
      .from('visites').update(row).eq('id', v.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune visite mise à jour — id=' + v.id);
    return _visFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('visites').insert(row).select();
  if (error) throw error;
  return _visFromRow(data[0]);
}

async function sbUpdateVisiteField(id, fields) {
  const { data, error } = await supabaseClient
    .from('visites').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Mise à jour échouée — id=' + id);
  return _visFromRow(data[0]);
}

async function sbDeleteVisite(id) {
  const { data, error } = await supabaseClient
    .from('visites').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune visite supprimée — id=' + id);
}
