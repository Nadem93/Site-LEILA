// ── COUCHE SUPABASE — CONTACTS EXTERNES (vacataires, intervenants…) ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

function _ceToRow(c, etablissementId) {
  return {
    etablissement_id: etablissementId,
    prenom:     c.prenom    || '',
    nom:        c.nom       || '',
    type:       c.type      || 'autre',
    fonction:   c.fonction  || '',
    telephone:  c.telephone || '',
    email:      c.email     || '',
    notes:      c.notes     || '',
    updated_at: new Date().toISOString()
  };
}

function _ceFromRow(r) {
  return {
    id:        r.id,
    prenom:    r.prenom    || '',
    nom:       r.nom       || '',
    type:      r.type      || 'autre',
    fonction:  r.fonction  || '',
    telephone: r.telephone || '',
    email:     r.email     || '',
    notes:     r.notes     || '',
    createdAt: r.created_at
  };
}

async function sbGetContactsExternes() {
  const { data, error } = await supabaseClient
    .from('contacts_externes')
    .select('*')
    .order('nom', { ascending: true });
  if (error) { console.error(error); toast('Erreur chargement contacts externes', 'error'); return []; }
  return data.map(_ceFromRow);
}

async function sbSaveContactExterne(c) {
  const etablissementId = await sbGetEtablissementId();
  const row = _ceToRow(c, etablissementId);
  if (c.id) {
    const { data, error } = await supabaseClient
      .from('contacts_externes').update(row).eq('id', c.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucun contact mis à jour — id=' + c.id);
    return _ceFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('contacts_externes').insert(row).select();
  if (error) throw error;
  return _ceFromRow(data[0]);
}

async function sbDeleteContactExterne(id) {
  const { data, error } = await supabaseClient
    .from('contacts_externes').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucun contact supprimé — id=' + id);
}
