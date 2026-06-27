// ── COUCHE SUPABASE — INVENTAIRE & MATÉRIEL ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

function _invToRow(i, etablissementId) {
  return {
    etablissement_id: etablissementId,
    cat:              i.cat   || 'autre',
    nom:              i.nom   || '',
    ref:              i.ref   || '',
    quantite:         Number(i.quantite) || 1,
    etat:             i.etat  || 'bon',
    lieu:             i.lieu  || '',
    date_achat:       i.dateAchat       || null,
    date_maintenance: i.dateMaintenance || null,
    notes:            i.notes || '',
    updated_at:       new Date().toISOString()
  };
}

function _invFromRow(r) {
  return {
    id:              r.id,
    cat:             r.cat   || 'autre',
    nom:             r.nom   || '',
    ref:             r.ref   || '',
    quantite:        r.quantite || 1,
    etat:            r.etat  || 'bon',
    lieu:            r.lieu  || '',
    dateAchat:       r.date_achat       || '',
    dateMaintenance: r.date_maintenance || '',
    notes:           r.notes || '',
    createdAt:       r.created_at
  };
}

async function sbGetInventaire() {
  const { data, error } = await supabaseClient
    .from('inventaire')
    .select('*')
    .order('nom', { ascending: true });
  if (error) { console.error(error); toast('Erreur chargement inventaire', 'error'); return []; }
  return data.map(_invFromRow);
}

async function sbSaveInventaire(i) {
  const etablissementId = await sbGetEtablissementId();
  const row = _invToRow(i, etablissementId);
  if (i.id) {
    const { data, error } = await supabaseClient
      .from('inventaire').update(row).eq('id', i.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucun équipement mis à jour — id=' + i.id);
    return _invFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('inventaire').insert(row).select();
  if (error) throw error;
  return _invFromRow(data[0]);
}

async function sbDeleteInventaire(id) {
  const { data, error } = await supabaseClient
    .from('inventaire').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucun équipement supprimé — id=' + id);
}
