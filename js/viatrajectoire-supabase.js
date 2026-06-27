// ── COUCHE SUPABASE — DEMANDES VIATRAJECTOIRE ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

function _vtToRow(d, etablissementId) {
  return {
    etablissement_id: etablissementId,
    resident_id: d.residentId  || null,
    type:        d.type        || 'orientation',
    mdph:        d.mdph        || '',
    date:        d.date        || null,
    statut:      d.statut      || 'brouillon',
    commentaire: d.commentaire || '',
    updated_at:  new Date().toISOString()
  };
}

function _vtFromRow(r) {
  return {
    id:          r.id,
    residentId:  r.resident_id || '',
    type:        r.type        || 'orientation',
    mdph:        r.mdph        || '',
    date:        r.date        || '',
    statut:      r.statut      || 'brouillon',
    commentaire: r.commentaire || '',
    createdAt:   r.created_at
  };
}

async function sbGetViaTrajectoire() {
  const { data, error } = await supabaseClient
    .from('viatrajectoire')
    .select('*')
    .order('date', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement ViaTrajectoire', 'error'); return []; }
  return data.map(_vtFromRow);
}

async function sbSaveViaTrajectoire(d) {
  const etablissementId = await sbGetEtablissementId();
  const row = _vtToRow(d, etablissementId);
  if (d.id) {
    const { data, error } = await supabaseClient
      .from('viatrajectoire').update(row).eq('id', d.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune demande mise à jour — id=' + d.id);
    return _vtFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('viatrajectoire').insert(row).select();
  if (error) throw error;
  return _vtFromRow(data[0]);
}

async function sbDeleteViaTrajectoire(id) {
  const { data, error } = await supabaseClient
    .from('viatrajectoire').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune demande supprimée — id=' + id);
}
