// ── COUCHE SUPABASE — RÉPERTOIRE (contacts partenaires) ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

function _repToRow(c, etablissementId) {
  return {
    etablissement_id: etablissementId,
    organisme:  c.organisme || '',
    nom:        c.nom       || '',
    tel:        c.tel       || '',
    email:      c.email     || '',
    fonction:   c.fonction  || '',
    adresse:    c.adresse   || '',
    notes:      c.notes     || '',
    updated_at: new Date().toISOString()
  };
}

function _repFromRow(r) {
  return {
    id:        r.id,
    organisme: r.organisme || '',
    nom:       r.nom       || '',
    tel:       r.tel       || '',
    email:     r.email     || '',
    fonction:  r.fonction  || '',
    adresse:   r.adresse   || '',
    notes:     r.notes     || '',
    createdAt: r.created_at
  };
}

async function sbGetRepertoire() {
  const { data, error } = await supabaseClient
    .from('repertoire')
    .select('*')
    .order('organisme', { ascending: true });
  if (error) { console.error(error); toast('Erreur chargement répertoire', 'error'); return []; }
  return data.map(_repFromRow);
}

async function sbSaveRepertoire(c) {
  const etablissementId = await sbGetEtablissementId();
  const row = _repToRow(c, etablissementId);
  if (c.id) {
    const { data, error } = await supabaseClient
      .from('repertoire').update(row).eq('id', c.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucun contact mis à jour — id=' + c.id);
    return _repFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('repertoire').insert(row).select();
  if (error) throw error;
  return _repFromRow(data[0]);
}

async function sbDeleteRepertoire(id) {
  const { data, error } = await supabaseClient
    .from('repertoire').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucun contact supprimé — id=' + id);
}
