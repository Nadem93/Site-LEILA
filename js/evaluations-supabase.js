// ── COUCHE SUPABASE — ÉVALUATIONS (MIF / Barthel) ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

function _evToRow(e, etablissementId) {
  return {
    etablissement_id: etablissementId,
    resident_id: e.residentId || null,
    grille:      e.grille     || 'mif',
    date:        e.date       || null,
    note:        e.note       || '',
    scores:      e.scores     || {},
    updated_at:  new Date().toISOString()
  };
}

function _evFromRow(r) {
  return {
    id:         r.id,
    residentId: r.resident_id || '',
    grille:     r.grille      || 'mif',
    date:       r.date        || '',
    note:       r.note        || '',
    scores:     r.scores      || {},
    createdAt:  r.created_at,
    updatedAt:  r.updated_at
  };
}

async function sbGetEvaluations() {
  const { data, error } = await supabaseClient
    .from('evaluations')
    .select('*')
    .order('date', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement évaluations', 'error'); return []; }
  return data.map(_evFromRow);
}

async function sbSaveEvaluation(e) {
  const etablissementId = await sbGetEtablissementId();
  const row = _evToRow(e, etablissementId);
  if (e.id) {
    const { data, error } = await supabaseClient
      .from('evaluations').update(row).eq('id', e.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune évaluation mise à jour — id=' + e.id);
    return _evFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('evaluations').insert(row).select();
  if (error) throw error;
  return _evFromRow(data[0]);
}

async function sbDeleteEvaluation(id) {
  const { data, error } = await supabaseClient
    .from('evaluations').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune évaluation supprimée — id=' + id);
}
