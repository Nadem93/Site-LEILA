// ── COUCHE SUPABASE — DOCUMENTS DES RÉSIDENTS ──
// sbGetEtablissementId() défini dans js/residents-supabase.js
// Fichiers stockés dans le bucket "justificatifs" (helpers dans absences-supabase.js).
// Partagé par residents.js, resident.html et documents.js.

let _docResCache = [];
async function loadDocResCache() { _docResCache = await sbGetDocumentsResident(); }
function docResAll() { return _docResCache; }
function docResByResident(rid) { return _docResCache.filter(d => String(d.residentId) === String(rid)); }

function _docResToRow(d, etablissementId) {
  return {
    etablissement_id: etablissementId,
    resident_id:   d.residentId  || null,
    name:          d.name        || '',
    file_name:     d.fileName    || d.name || '',
    size:          d.size        || 0,
    mime_type:     d.mimeType    || '',
    category:      d.category    || '',
    doc_date:      d.docDate     || null,
    due_date:      d.dueDate     || null,
    fichier_path:  d.fichierPath || null,
    type:          d.type        || 'resident',
    uploaded_by:   d.uploadedBy  || '',
    updated_at:    new Date().toISOString()
  };
}

function _docResFromRow(r) {
  return {
    id:          r.id,
    residentId:  r.resident_id  || '',
    name:        r.name         || '',
    fileName:    r.file_name    || '',
    size:        r.size         || 0,
    mimeType:    r.mime_type    || '',
    category:    r.category     || '',
    docDate:     r.doc_date     || '',
    dueDate:     r.due_date     || '',
    fichierPath: r.fichier_path || '',
    type:        r.type         || 'resident',
    uploadedBy:  r.uploaded_by  || '',
    uploadedAt:  r.created_at,
    date:        r.created_at
  };
}

async function sbGetDocumentsResident() {
  const { data, error } = await supabaseClient
    .from('documents_resident')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement documents', 'error'); return []; }
  return data.map(_docResFromRow);
}

async function sbSaveDocumentResident(d) {
  const etablissementId = await sbGetEtablissementId();
  const row = _docResToRow(d, etablissementId);
  if (d.id) {
    const { data, error } = await supabaseClient
      .from('documents_resident').update(row).eq('id', d.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucun document mis à jour — id=' + d.id);
    return _docResFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('documents_resident').insert(row).select();
  if (error) throw error;
  return _docResFromRow(data[0]);
}

async function sbDeleteDocumentResident(id) {
  const { data, error } = await supabaseClient
    .from('documents_resident').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucun document supprimé — id=' + id);
}
