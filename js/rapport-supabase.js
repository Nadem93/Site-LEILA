// ── COUCHE SUPABASE — CONTRIBUTIONS AU RAPPORT D'ACTIVITÉ ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

function _rcToRow(c, etablissementId) {
  return {
    etablissement_id: etablissementId,
    categorie:  c.categorie || 'fait_marquant',
    mois:       c.mois      || '',
    texte:      c.texte     || '',
    auteur:     c.auteur    || '',
    author_id:  c.authorId ? String(c.authorId) : null,
    updated_at: new Date().toISOString()
  };
}

function _rcFromRow(r) {
  return {
    id:        r.id,
    categorie: r.categorie || 'fait_marquant',
    mois:      r.mois      || '',
    texte:     r.texte     || '',
    auteur:    r.auteur    || '',
    authorId:  r.author_id || null,
    createdAt: r.created_at
  };
}

async function sbGetRapportContributions() {
  const { data, error } = await supabaseClient
    .from('rapport_contributions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement contributions', 'error'); return []; }
  return data.map(_rcFromRow);
}

async function sbSaveRapportContribution(c) {
  const etablissementId = await sbGetEtablissementId();
  const row = _rcToRow(c, etablissementId);
  if (c.id) {
    const { data, error } = await supabaseClient
      .from('rapport_contributions').update(row).eq('id', c.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune contribution mise à jour — id=' + c.id);
    return _rcFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('rapport_contributions').insert(row).select();
  if (error) throw error;
  return _rcFromRow(data[0]);
}

async function sbDeleteRapportContribution(id) {
  const { data, error } = await supabaseClient
    .from('rapport_contributions').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune contribution supprimée — id=' + id);
}
