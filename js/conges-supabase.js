// ── COUCHE SUPABASE — CONGÉS ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

function _congeToRow(c, etablissementId) {
  return {
    etablissement_id: etablissementId,
    employe_id:       c.employeId   ? String(c.employeId) : null,
    employe_nom:      c.employeNom  || '',
    type:             c.type        || 'cp',
    debut:            c.debut       || null,
    fin:              c.fin         || null,
    statut:           c.statut      || 'en_attente',
    motif:            c.motif       || '',
    reponse_motif:    c.reponseMotif || '',
    approuve_par:     c.traitePar   || null,
    approuve_par_id:  c.traiteParId ? String(c.traiteParId) : null,
    approuve_at:      c.dateTraitement || null,
    updated_at:       new Date().toISOString()
  };
}

function _congeFromRow(r) {
  return {
    id:             r.id,
    employeId:      r.employe_id    || '',
    employeNom:     r.employe_nom   || '',
    type:           r.type,
    debut:          r.debut         || '',
    fin:            r.fin           || '',
    statut:         r.statut        || 'en_attente',
    motif:          r.motif         || '',
    reponseMotif:   r.reponse_motif || '',
    traitePar:      r.approuve_par  || '',
    traiteParId:    r.approuve_par_id || null,
    dateTraitement: r.approuve_at   || null,
    dateDemande:    r.created_at,
    createdAt:      r.created_at,
    updatedAt:      r.updated_at
  };
}

async function sbGetConges() {
  const { data, error } = await supabaseClient
    .from('conges')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement congés', 'error'); return []; }
  return data.map(_congeFromRow);
}

async function sbSaveConge(c) {
  const etablissementId = await sbGetEtablissementId();
  const row = _congeToRow(c, etablissementId);
  if (c.id) {
    const { data, error } = await supabaseClient
      .from('conges').update(row).eq('id', c.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune ligne mise à jour — id=' + c.id);
    return _congeFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('conges').insert(row).select();
  if (error) throw error;
  return _congeFromRow(data[0]);
}

async function sbUpdateConge(id, fields) {
  const { data, error } = await supabaseClient
    .from('conges').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Mise à jour échouée — id=' + id);
  return _congeFromRow(data[0]);
}

async function sbDeleteConge(id) {
  const { data, error } = await supabaseClient
    .from('conges').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune ligne supprimée — id=' + id);
}
