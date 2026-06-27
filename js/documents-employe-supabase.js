// ── COUCHE SUPABASE — DOCUMENTS DE LA FICHE EMPLOYÉ ──
// Fichiers stockés dans le bucket privé "justificatifs" (helpers définis dans absences-supabase.js).
// sbGetEtablissementId() défini dans js/residents-supabase.js

function _docEmpToRow(d, etablissementId) {
  return {
    etablissement_id: etablissementId,
    employe_id:   d.employeId ? String(d.employeId) : null,
    name:         d.name        || '',
    file_name:    d.fileName    || '',
    size:         d.size        || 0,
    mime_type:    d.mimeType    || '',
    category:     d.category    || '',
    doc_date:     d.docDate     || null,
    fichier_path: d.fichierPath || null
  };
}

function _docEmpFromRow(r) {
  return {
    id:          r.id,
    employeId:   r.employe_id   || '',
    name:        r.name         || '',
    fileName:    r.file_name    || '',
    size:        r.size         || 0,
    mimeType:    r.mime_type    || '',
    category:    r.category     || '',
    docDate:     r.doc_date     || '',
    fichierPath: r.fichier_path || '',
    createdAt:   r.created_at
  };
}

async function sbGetDocsEmploye(employeId) {
  const { data, error } = await supabaseClient
    .from('documents_employe')
    .select('*')
    .eq('employe_id', String(employeId))
    .order('created_at', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement documents', 'error'); return []; }
  return data.map(_docEmpFromRow);
}

async function sbSaveDocEmploye(d) {
  const etablissementId = await sbGetEtablissementId();
  const { data, error } = await supabaseClient
    .from('documents_employe').insert(_docEmpToRow(d, etablissementId)).select();
  if (error) throw error;
  return _docEmpFromRow(data[0]);
}

async function sbDeleteDocEmploye(id) {
  const { data, error } = await supabaseClient
    .from('documents_employe').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune ligne supprimée — id=' + id);
}
