// ── COUCHE SUPABASE — SATISFACTION (questionnaires + questions personnalisées) ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

// ── Questionnaires remplis ──
function _satToRow(s, etablissementId) {
  return {
    etablissement_id: etablissementId,
    repondant:     s.repondant    || '',
    lien_resident: s.lienResident || '',
    resident_id:   s.residentId   || null,
    date:          s.date         || null,
    commentaire:   s.commentaire  || '',
    reponses:      s.reponses     || {},
    updated_at:    new Date().toISOString()
  };
}
function _satFromRow(r) {
  return {
    id:           r.id,
    repondant:    r.repondant     || '',
    lienResident: r.lien_resident || '',
    residentId:   r.resident_id   || '',
    date:         r.date          || '',
    commentaire:  r.commentaire   || '',
    reponses:     r.reponses      || {},
    createdAt:    r.created_at
  };
}

async function sbGetSatisfaction() {
  const { data, error } = await supabaseClient
    .from('satisfaction').select('*').order('date', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement satisfaction', 'error'); return []; }
  return data.map(_satFromRow);
}
async function sbSaveSatisfaction(s) {
  const etablissementId = await sbGetEtablissementId();
  const row = _satToRow(s, etablissementId);
  if (s.id) {
    const { data, error } = await supabaseClient.from('satisfaction').update(row).eq('id', s.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucun questionnaire mis à jour — id=' + s.id);
    return _satFromRow(data[0]);
  }
  const { data, error } = await supabaseClient.from('satisfaction').insert(row).select();
  if (error) throw error;
  return _satFromRow(data[0]);
}
async function sbDeleteSatisfaction(id) {
  const { data, error } = await supabaseClient.from('satisfaction').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucun questionnaire supprimé — id=' + id);
}

// ── Questions personnalisées ──
function _satqFromRow(r) {
  return { id: r.id, label: r.label || '', cat: r.cat || 'Autre', createdAt: r.created_at };
}
async function sbGetSatQuestions() {
  const { data, error } = await supabaseClient
    .from('satisfaction_questions').select('*').order('created_at', { ascending: true });
  if (error) { console.error(error); toast('Erreur chargement questions', 'error'); return []; }
  return data.map(_satqFromRow);
}
async function sbSaveSatQuestion(q) {
  const etablissementId = await sbGetEtablissementId();
  const row = { etablissement_id: etablissementId, label: q.label || '', cat: q.cat || 'Autre', updated_at: new Date().toISOString() };
  if (q.id) {
    const { data, error } = await supabaseClient.from('satisfaction_questions').update(row).eq('id', q.id).select();
    if (error) throw error;
    return _satqFromRow(data[0]);
  }
  const { data, error } = await supabaseClient.from('satisfaction_questions').insert(row).select();
  if (error) throw error;
  return _satqFromRow(data[0]);
}
async function sbDeleteSatQuestion(id) {
  const { data, error } = await supabaseClient.from('satisfaction_questions').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune question supprimée — id=' + id);
}
