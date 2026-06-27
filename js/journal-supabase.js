// ── COUCHE DE CONNEXION SUPABASE — JOURNAL DE BORD ──
// sbGetEtablissementId() et sbGetResidents() sont définis dans js/residents-supabase.js
// (chargé avant ce fichier).

function _jToRow(e, etablissementId) {
  return {
    etablissement_id: etablissementId,
    resident_id: e.residentId || null,
    resident: e.resident || '',
    resident_color: e.residentColor || '',
    categorie: e.categorie || '',
    date: e.date || '',
    objectif: e.objectif || '',
    contenu: e.contenu || '',
    visibilite: e.visibilite || 'equipe',
    serafinph_type: e.serafinphType || '',
    attachments: e.attachments || [],
    author: e.author || '',
    author_id: e.authorId || null,
    replies: e.replies || [],
    read_by: e.readBy || [],
    edited_by: e.editedBy || null,
    edited_by_id: e.editedById || null,
    edited_at: e.editedAt || null,
    edit_history: e.editHistory || [],
    created_at: e.createdAt || new Date().toISOString(),
    updated_at: e.updatedAt || new Date().toISOString()
  };
}

function _jFromRow(r) {
  return {
    id: r.id,
    type: 'observation',
    residentId: r.resident_id,
    resident: r.resident,
    residentColor: r.resident_color,
    categorie: r.categorie,
    date: r.date,
    objectif: r.objectif,
    contenu: r.contenu,
    visibilite: r.visibilite,
    serafinphType: r.serafinph_type,
    attachments: r.attachments || [],
    author: r.author,
    authorId: r.author_id,
    replies: r.replies || [],
    readBy: r.read_by || [],
    editedBy: r.edited_by,
    editedById: r.edited_by_id,
    editedAt: r.edited_at,
    editHistory: r.edit_history || [],
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

async function sbGetJournalEntries() {
  const { data, error } = await supabaseClient
    .from('journal_entries').select('*').order('date', { ascending: false });
  if (error) { console.error(error); toast('Erreur de chargement du journal', 'error'); return []; }
  return data.map(_jFromRow);
}

async function sbSaveJournalEntry(entry) {
  const etablissementId = await sbGetEtablissementId();
  const row = _jToRow(entry, etablissementId);
  if (entry.id) {
    const { data, error } = await supabaseClient
      .from('journal_entries').update(row).eq('id', entry.id).select().single();
    if (error) throw error;
    return _jFromRow(data);
  }
  const { data, error } = await supabaseClient
    .from('journal_entries').insert(row).select().single();
  if (error) throw error;
  return _jFromRow(data);
}

async function sbDeleteJournalEntry(id) {
  const { error } = await supabaseClient.from('journal_entries').delete().eq('id', id);
  if (error) throw error;
}
