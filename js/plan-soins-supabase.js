// ── COUCHE SUPABASE — PLAN DE SOINS ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

function _psToRow(p, etablissementId) {
  return {
    etablissement_id: etablissementId,
    resident_id:  p.residentId  || null,
    cat:          p.cat         || 'autre',
    freq:         p.freq        || 'quotidien',
    libelle:      p.libelle     || '',
    detail:       p.detail      || '',
    intervenant:  p.intervenant || '',
    note:         p.note        || '',
    actif:        p.actif !== false,
    updated_at:   new Date().toISOString()
  };
}

function _psFromRow(r) {
  return {
    id:          r.id,
    residentId:  r.resident_id || '',
    cat:         r.cat         || 'autre',
    freq:        r.freq        || 'quotidien',
    libelle:     r.libelle     || '',
    detail:      r.detail      || '',
    intervenant: r.intervenant || '',
    note:        r.note        || '',
    actif:       r.actif !== false,
    createdAt:   r.created_at,
    updatedAt:   r.updated_at
  };
}

async function sbGetPlanSoins() {
  const { data, error } = await supabaseClient
    .from('plan_soins')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement plan de soins', 'error'); return []; }
  return data.map(_psFromRow);
}

async function sbSavePlanSoins(p) {
  const etablissementId = await sbGetEtablissementId();
  const row = _psToRow(p, etablissementId);
  if (p.id) {
    const { data, error } = await supabaseClient
      .from('plan_soins').update(row).eq('id', p.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucun soin mis à jour — id=' + p.id);
    return _psFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('plan_soins').insert(row).select();
  if (error) throw error;
  return _psFromRow(data[0]);
}

async function sbDeletePlanSoins(id) {
  const { data, error } = await supabaseClient
    .from('plan_soins').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucun soin supprimé — id=' + id);
}
