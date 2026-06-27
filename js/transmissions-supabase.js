// ── COUCHE SUPABASE — TRANSMISSIONS ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

function _trToRow(t, etablissementId) {
  return {
    etablissement_id: etablissementId,
    date:             t.date        || '',
    shift:            t.shift       || 'matin',
    cat:              t.cat         || 'administratif',
    priority:         t.priority    || 'normal',
    content:          t.content     || '',
    resident_id:      t.residentId  || null,
    resident_name:    t.residentName|| '',
    author_id:        String(t.authorId  || ''),
    author_name:      t.authorName  || '',
    read_by:          t.readBy      || [],
    replies:          t.replies     || [],
    incident_id:      t.incidentId  || null,
    journal_entry_id: t.journalEntryId || null,
    created_at:       t.createdAt   || new Date().toISOString(),
    updated_at:       t.updatedAt   || null
  };
}

function _trFromRow(r) {
  return {
    id:             r.id,
    date:           r.date,
    shift:          r.shift,
    cat:            r.cat,
    priority:       r.priority,
    content:        r.content,
    residentId:     r.resident_id    || '',
    residentName:   r.resident_name  || '',
    authorId:       r.author_id,
    authorName:     r.author_name,
    readBy:         r.read_by        || [],
    replies:        r.replies        || [],
    incidentId:     r.incident_id    || null,
    journalEntryId: r.journal_entry_id || null,
    createdAt:      r.created_at,
    updatedAt:      r.updated_at
  };
}

async function sbGetTransmissions() {
  const { data, error } = await supabaseClient
    .from('transmissions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement transmissions', 'error'); return []; }
  return data.map(_trFromRow);
}

async function sbSaveTransmission(t) {
  const etablissementId = await sbGetEtablissementId();
  const row = _trToRow(t, etablissementId);
  if (t.id) {
    const { data, error } = await supabaseClient
      .from('transmissions').update(row).eq('id', t.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune ligne mise à jour — id=' + t.id);
    return _trFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('transmissions').insert(row).select();
  if (error) throw error;
  return _trFromRow(data[0]);
}

async function sbDeleteTransmission(id) {
  const { data, error } = await supabaseClient
    .from('transmissions').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune ligne supprimée — id=' + id);
}

async function sbUpdateTransmissionField(id, fields) {
  const { data, error } = await supabaseClient
    .from('transmissions').update(fields).eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Mise à jour échouée — id=' + id);
  return _trFromRow(data[0]);
}
