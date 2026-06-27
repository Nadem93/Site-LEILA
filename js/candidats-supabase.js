// ── COUCHE SUPABASE — RECRUTEMENT (candidats) ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

function _candToRow(c, etablissementId) {
  return {
    etablissement_id: etablissementId,
    prenom:         c.prenom        || '',
    nom:            c.nom           || '',
    poste:          c.poste         || '',
    tel:            c.tel           || '',
    email:          c.email         || '',
    date:           c.date          || null,
    date_entretien: c.dateEntretien || null,
    notes:          c.notes         || '',
    statut:         c.statut        || 'recu',
    updated_at:     new Date().toISOString()
  };
}

function _candFromRow(r) {
  return {
    id:            r.id,
    prenom:        r.prenom        || '',
    nom:           r.nom           || '',
    poste:         r.poste         || '',
    tel:           r.tel           || '',
    email:         r.email         || '',
    date:          r.date          || '',
    dateEntretien: r.date_entretien || '',
    notes:         r.notes         || '',
    statut:        r.statut        || 'recu',
    createdAt:     r.created_at,
    updatedAt:     r.updated_at
  };
}

async function sbGetCandidats() {
  const { data, error } = await supabaseClient
    .from('candidats')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement candidats', 'error'); return []; }
  return data.map(_candFromRow);
}

async function sbSaveCandidat(c) {
  const etablissementId = await sbGetEtablissementId();
  const row = _candToRow(c, etablissementId);
  if (c.id) {
    const { data, error } = await supabaseClient
      .from('candidats').update(row).eq('id', c.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune ligne mise à jour — id=' + c.id);
    return _candFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('candidats').insert(row).select();
  if (error) throw error;
  return _candFromRow(data[0]);
}

async function sbDeleteCandidat(id) {
  const { data, error } = await supabaseClient
    .from('candidats').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune ligne supprimée — id=' + id);
}
