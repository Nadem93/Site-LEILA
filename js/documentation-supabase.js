// ── COUCHE SUPABASE — DOCUMENTATION DE L'ÉTABLISSEMENT ──
// sbGetEtablissementId() défini dans js/residents-supabase.js
// Les fichiers sont stockés dans le bucket "justificatifs" (helpers dans absences-supabase.js).

function _docuToRow(d, etablissementId) {
  return {
    etablissement_id: etablissementId,
    titre:          d.titre        || '',
    categorie:      d.categorie    || 'Autre',
    fichier_nom:    d.fichierNom    || '',
    fichier_mime:   d.fichierMime   || '',
    fichier_taille: d.fichierTaille || 0,
    fichier_path:   d.fichierPath   || null,
    ajoute_par:     d.ajoutePar     || '',
    updated_at:     new Date().toISOString()
  };
}

function _docuFromRow(r) {
  return {
    id:            r.id,
    titre:         r.titre          || '',
    categorie:     r.categorie      || 'Autre',
    fichierNom:    r.fichier_nom    || '',
    fichierMime:   r.fichier_mime   || '',
    fichierTaille: r.fichier_taille || 0,
    fichierPath:   r.fichier_path   || '',
    dateAjout:     r.created_at,
    ajoutePar:     r.ajoute_par     || ''
  };
}

async function sbGetDocumentation() {
  const { data, error } = await supabaseClient
    .from('documentation')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement documentation', 'error'); return []; }
  return data.map(_docuFromRow);
}

async function sbSaveDocumentation(d) {
  const etablissementId = await sbGetEtablissementId();
  const row = _docuToRow(d, etablissementId);
  const { data, error } = await supabaseClient
    .from('documentation').insert(row).select();
  if (error) throw error;
  return _docuFromRow(data[0]);
}

async function sbDeleteDocumentation(id) {
  const { data, error } = await supabaseClient
    .from('documentation').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucun document supprimé — id=' + id);
}
