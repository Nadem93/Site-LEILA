// ── COUCHE SUPABASE — AVENANTS / PPE ──
// sbGetEtablissementId() défini dans js/residents-supabase.js
// Les prestations SERAFIN sont aussi répercutées sur la fiche résident (sbSaveResident).

function _ppeToRow(p, etablissementId) {
  return {
    etablissement_id: etablissementId,
    resident_id:    p.residentId   || null,
    resident_name:  p.residentName || '',
    date_redaction: p.dateRedaction || null,
    date_revision:  p.dateRevision  || null,
    referent:       p.referent     || '',
    protection:     p.protection   || '',
    employeur:      p.employeur    || '',
    atelier:        p.atelier      || '',
    entree_esat:    p.entreeEsat   || null,
    statut:         p.statut       || 'brouillon',
    sections:       p.sections     || {},
    conclusion:     p.conclusion   || '',
    signatures:     p.signatures   || {},
    serafin:        p.serafin      || {},
    created_by:     p.createdBy    || '',
    updated_at:     new Date().toISOString()
  };
}

function _ppeFromRow(r) {
  return {
    id:            r.id,
    residentId:    r.resident_id   || '',
    residentName:  r.resident_name || '',
    dateRedaction: r.date_redaction || '',
    dateRevision:  r.date_revision  || '',
    referent:      r.referent      || '',
    protection:    r.protection    || '',
    employeur:     r.employeur      || '',
    atelier:       r.atelier        || '',
    entreeEsat:    r.entree_esat    || '',
    statut:        r.statut         || 'brouillon',
    sections:      r.sections       || {},
    conclusion:    r.conclusion     || '',
    signatures:    r.signatures     || { resident: null, referent: null, direction: null, date: null },
    serafin:       r.serafin        || {},
    createdBy:     r.created_by      || '',
    createdAt:     r.created_at
  };
}

async function sbGetPpe() {
  const { data, error } = await supabaseClient
    .from('ppe')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement avenants', 'error'); return []; }
  return data.map(_ppeFromRow);
}

async function sbSavePpe(p) {
  const etablissementId = await sbGetEtablissementId();
  const row = _ppeToRow(p, etablissementId);
  if (p.id) {
    const { data, error } = await supabaseClient
      .from('ppe').update(row).eq('id', p.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucun avenant mis à jour — id=' + p.id);
    return _ppeFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('ppe').insert(row).select();
  if (error) throw error;
  return _ppeFromRow(data[0]);
}

async function sbDeletePpe(id) {
  const { data, error } = await supabaseClient
    .from('ppe').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucun avenant supprimé — id=' + id);
}
