// ── COUCHE DE CONNEXION SUPABASE — ASTREINTES ──
// sbGetEtablissementId() est défini dans js/residents-supabase.js (chargé avant ce fichier).

function _astToRow(a, etablissementId) {
  return {
    etablissement_id: etablissementId,
    type: a.type || '',
    date: a.date || '',
    nom: a.nom || '',
    tel: a.tel || '',
    note: a.note || '',
    created_at: a.createdAt || new Date().toISOString(),
    updated_at: a.updatedAt || null
  };
}

function _astFromRow(r) {
  return {
    id: r.id, type: r.type, date: r.date, nom: r.nom, tel: r.tel, note: r.note,
    createdAt: r.created_at, updatedAt: r.updated_at
  };
}

async function sbGetAstreintes() {
  const { data, error } = await supabaseClient.from('astreintes').select('*');
  if (error) { console.error(error); toast('Erreur de chargement des astreintes', 'error'); return []; }
  return data.map(_astFromRow);
}

async function sbSaveAstreinte(a) {
  const etablissementId = await sbGetEtablissementId();
  const row = _astToRow(a, etablissementId);
  if (a.id) {
    const { data, error } = await supabaseClient.from('astreintes').update(row).eq('id', a.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune ligne mise à jour (id introuvable ou accès refusé) — id=' + a.id);
    return _astFromRow(data[0]);
  }
  const { data, error } = await supabaseClient.from('astreintes').insert(row).select();
  if (error) throw error;
  return _astFromRow(data[0]);
}

async function sbDeleteAstreinte(id) {
  const { data, error } = await supabaseClient.from('astreintes').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune ligne supprimée (id introuvable ou accès refusé) — id=' + id);
}
