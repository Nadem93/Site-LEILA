// ── COUCHE SUPABASE — ÉCHÉANCIER ──
// sbGetEtablissementId() défini dans js/residents-supabase.js
// Le module CVS crée aussi des échéances (fin de mandat) via source_id.

function _ecToRow(e, etablissementId) {
  return {
    etablissement_id: etablissementId,
    type:          e.type         || 'autre',
    libelle:       e.libelle      || '',
    date:          e.date         || null,
    resident_id:   e.residentId   || null,
    resident_name: e.residentName || '',
    notes:         e.notes        || '',
    done:          !!e.done,
    done_at:       e.doneAt       || null,
    author:        e.author       || '',
    source_id:     e.sourceId     || null,
    updated_at:    new Date().toISOString()
  };
}

function _ecFromRow(r) {
  return {
    id:           r.id,
    type:         r.type          || 'autre',
    libelle:      r.libelle       || '',
    date:         r.date          || '',
    residentId:   r.resident_id   || '',
    residentName: r.resident_name || '',
    notes:        r.notes         || '',
    done:         !!r.done,
    doneAt:       r.done_at       || null,
    author:       r.author        || '',
    sourceId:     r.source_id     || null,
    createdAt:    r.created_at
  };
}

async function sbGetEcheances() {
  const { data, error } = await supabaseClient
    .from('echeances')
    .select('*')
    .order('date', { ascending: true });
  if (error) { console.error(error); toast('Erreur chargement échéances', 'error'); return []; }
  return data.map(_ecFromRow);
}

async function sbSaveEcheance(e) {
  const etablissementId = await sbGetEtablissementId();
  const row = _ecToRow(e, etablissementId);
  if (e.id) {
    const { data, error } = await supabaseClient
      .from('echeances').update(row).eq('id', e.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune échéance mise à jour — id=' + e.id);
    return _ecFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('echeances').insert(row).select();
  if (error) throw error;
  return _ecFromRow(data[0]);
}

async function sbUpdateEcheanceField(id, fields) {
  const { data, error } = await supabaseClient
    .from('echeances').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Mise à jour échéance échouée — id=' + id);
  return _ecFromRow(data[0]);
}

async function sbDeleteEcheance(id) {
  const { data, error } = await supabaseClient
    .from('echeances').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune échéance supprimée — id=' + id);
}

// Supprime toutes les échéances rattachées à une source (ex. mandat CVS supprimé)
async function sbDeleteEcheancesBySource(sourceId) {
  if (!sourceId) return;
  const { error } = await supabaseClient
    .from('echeances').delete().eq('source_id', sourceId);
  if (error) throw error;
}
