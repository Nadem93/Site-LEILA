// ── COUCHE SUPABASE — CAHIER DE NUIT ──
// sbGetEtablissementId() défini dans js/residents-supabase.js
// Une ligne par nuit ; rondes/événements/astreintes stockés en jsonb.

function _nuitToRow(n, etablissementId) {
  return {
    etablissement_id: etablissementId,
    date:         n.date || null,
    veilleur:     n.veilleur || '',
    veilleur_id:  n.veilleurId ? String(n.veilleurId) : null,
    ambiance:     n.ambiance || 'calme',
    effectif:     parseInt(n.effectif, 10) || 0,
    rondes:       n.rondes || [],
    evenements:   n.evenements || [],
    astreintes:   n.astreintes || [],
    transmission: n.transmission || '',
    updated_at:   new Date().toISOString()
  };
}

function _nuitFromRow(r) {
  return {
    id:           r.id,
    date:         r.date || '',
    veilleur:     r.veilleur || '',
    veilleurId:   r.veilleur_id || null,
    ambiance:     r.ambiance || 'calme',
    effectif:     r.effectif || 0,
    rondes:       r.rondes || [],
    evenements:   r.evenements || [],
    astreintes:   r.astreintes || [],
    transmission: r.transmission || '',
    createdAt:    r.created_at,
    updatedAt:    r.updated_at
  };
}

async function sbGetNuits() {
  const { data, error } = await supabaseClient
    .from('nuits')
    .select('*')
    .order('date', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement cahier de nuit', 'error'); return []; }
  return data.map(_nuitFromRow);
}

async function sbSaveNuit(n) {
  const etablissementId = await sbGetEtablissementId();
  const row = _nuitToRow(n, etablissementId);
  if (n.id) {
    const { data, error } = await supabaseClient
      .from('nuits').update(row).eq('id', n.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune nuit mise à jour — id=' + n.id);
    return _nuitFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('nuits').insert(row).select();
  if (error) throw error;
  return _nuitFromRow(data[0]);
}
