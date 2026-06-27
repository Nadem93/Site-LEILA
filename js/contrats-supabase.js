// ── COUCHE SUPABASE — CONTRATS ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

function _ctToRow(c, etablissementId) {
  return {
    etablissement_id: etablissementId,
    employe_id:       c.employeId   ? String(c.employeId) : null,
    employe_nom:      c.employeNom  || '',
    type:             c.type        || 'cdi',
    debut:            c.debut       || null,
    fin:              c.fin         || null,
    temps:            c.temps       || 'plein',
    heures:           (c.heures ?? null),
    essai:            c.essai       || null,
    poste:            c.poste       || '',
    statut:           c.statut      || 'actif',
    notes:            c.notes       || '',
    avenants:         c.avenants    || [],
    fichier_path:     c.fichierPath || null,
    fichier_nom:      c.fichierNom  || '',
    updated_at:       new Date().toISOString()
  };
}

function _ctFromRow(r) {
  return {
    id:         r.id,
    employeId:  r.employe_id    || '',
    employeNom: r.employe_nom   || '',
    type:       r.type,
    debut:      r.debut         || '',
    fin:        r.fin           || '',
    temps:      r.temps         || 'plein',
    heures:     r.heures        ?? 0,
    essai:      r.essai         || '',
    poste:      r.poste         || '',
    statut:     r.statut        || 'actif',
    notes:      r.notes         || '',
    avenants:   r.avenants      || [],
    fichierPath: r.fichier_path || '',
    fichierNom:  r.fichier_nom  || '',
    createdAt:  r.created_at,
    updatedAt:  r.updated_at
  };
}

async function sbGetContrats() {
  const { data, error } = await supabaseClient
    .from('contrats')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement contrats', 'error'); return []; }
  return data.map(_ctFromRow);
}

async function sbSaveContrat(c) {
  const etablissementId = await sbGetEtablissementId();
  const row = _ctToRow(c, etablissementId);
  if (c.id) {
    const { data, error } = await supabaseClient
      .from('contrats').update(row).eq('id', c.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune ligne mise à jour — id=' + c.id);
    return _ctFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('contrats').insert(row).select();
  if (error) throw error;
  return _ctFromRow(data[0]);
}

async function sbDeleteContrat(id) {
  const { data, error } = await supabaseClient
    .from('contrats').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune ligne supprimée — id=' + id);
}
