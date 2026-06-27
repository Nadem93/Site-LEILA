// ── COUCHE SUPABASE — DEMANDES D'ADMISSION ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

function _admToRow(a, etablissementId) {
  return {
    etablissement_id: etablissementId,
    prenom:         a.prenom        || '',
    nom:            a.nom           || '',
    date_naissance: a.dateNaissance || null,
    date_demande:   a.dateDemande   || null,
    date_entree:    a.dateEntree     || null,
    date_decision:  a.dateDecision   || null,
    dossier:        a.dossier        || '',
    origine:        a.origine        || '',
    statut:         a.statut         || 'en_attente',
    contact_nom:    a.contactNom     || '',
    contact_tel:    a.contactTel     || '',
    notes:          a.notes          || '',
    resident_id:    a.residentId     || null,
    updated_at:     new Date().toISOString()
  };
}

function _admFromRow(r) {
  return {
    id:            r.id,
    prenom:        r.prenom         || '',
    nom:           r.nom            || '',
    dateNaissance: r.date_naissance || '',
    dateDemande:   r.date_demande   || '',
    dateEntree:    r.date_entree    || '',
    dateDecision:  r.date_decision  || '',
    dossier:       r.dossier        || '',
    origine:       r.origine        || '',
    statut:        r.statut         || 'en_attente',
    contactNom:    r.contact_nom    || '',
    contactTel:    r.contact_tel    || '',
    notes:         r.notes          || '',
    residentId:    r.resident_id    || '',
    createdAt:     r.created_at,
    updatedAt:     r.updated_at
  };
}

async function sbGetAdmissions() {
  const { data, error } = await supabaseClient
    .from('admissions')
    .select('*')
    .order('date_demande', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement admissions', 'error'); return []; }
  return data.map(_admFromRow);
}

async function sbSaveAdmission(a) {
  const etablissementId = await sbGetEtablissementId();
  const row = _admToRow(a, etablissementId);
  if (a.id) {
    const { data, error } = await supabaseClient
      .from('admissions').update(row).eq('id', a.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune demande mise à jour — id=' + a.id);
    return _admFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('admissions').insert(row).select();
  if (error) throw error;
  return _admFromRow(data[0]);
}

async function sbDeleteAdmission(id) {
  const { data, error } = await supabaseClient
    .from('admissions').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune demande supprimée — id=' + id);
}
