// ── COUCHE SUPABASE — ENTRETIENS PROFESSIONNELS ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

function _etToRow(e, etablissementId) {
  return {
    etablissement_id: etablissementId,
    employe_id:       e.employeId  ? String(e.employeId) : null,
    employe_nom:      e.employeNom || '',
    date:             e.date       || null,
    type:             e.type       || 'annuel',
    statut:           e.statut     || 'planifie',
    evaluateur:       e.evaluateur || '',
    bilan:            e.bilan      || '',
    objectifs:        e.objectifs  || '',
    formations:       e.formations || '',
    grille:           e.grille     || {},
    updated_at:       new Date().toISOString()
  };
}

function _etFromRow(r) {
  return {
    id:         r.id,
    employeId:  r.employe_id   || '',
    employeNom: r.employe_nom  || '',
    date:       r.date         || '',
    type:       r.type,
    statut:     r.statut       || 'planifie',
    evaluateur: r.evaluateur   || '',
    bilan:      r.bilan        || '',
    objectifs:  r.objectifs    || '',
    formations: r.formations   || '',
    grille:     r.grille       || {},
    createdAt:  r.created_at,
    updatedAt:  r.updated_at
  };
}

async function sbGetEntretiens() {
  const { data, error } = await supabaseClient
    .from('entretiens')
    .select('*')
    .order('date', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement entretiens', 'error'); return []; }
  return data.map(_etFromRow);
}

async function sbSaveEntretien(e) {
  const etablissementId = await sbGetEtablissementId();
  const row = _etToRow(e, etablissementId);
  if (e.id) {
    const { data, error } = await supabaseClient
      .from('entretiens').update(row).eq('id', e.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune ligne mise à jour — id=' + e.id);
    return _etFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('entretiens').insert(row).select();
  if (error) throw error;
  return _etFromRow(data[0]);
}

async function sbDeleteEntretien(id) {
  const { data, error } = await supabaseClient
    .from('entretiens').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune ligne supprimée — id=' + id);
}
