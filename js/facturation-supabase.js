// ── COUCHE SUPABASE — FACTURATION (tarifs + factures) ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

// ── TARIFS : un seul objet par établissement { categories:[], affectations:{} } ──
async function sbGetTarifs() {
  const { data, error } = await supabaseClient
    .from('facturation_tarifs').select('data').limit(1);
  if (error) { console.error(error); toast('Erreur chargement tarifs', 'error'); return null; }
  return (data && data[0]) ? data[0].data : null;
}

async function sbSaveTarifs(obj) {
  const etablissementId = await sbGetEtablissementId();
  const { error } = await supabaseClient
    .from('facturation_tarifs')
    .upsert({ etablissement_id: etablissementId, data: obj || {}, updated_at: new Date().toISOString() },
            { onConflict: 'etablissement_id' });
  if (error) throw error;
}

// ── FACTURES : liste ──
function _factToRow(f, etablissementId) {
  return {
    etablissement_id: etablissementId,
    periode:         f.periode        || '',
    resident_id:     f.residentId     || null,
    resident_nom:    f.residentNom    || '',
    organisme:       f.organisme      || '',
    categorie_id:    f.categorieId    || '',
    categorie_label: f.categorieLabel || '',
    nb_jours:        f.nbJours        || 0,
    prix_jour:       f.prixJour       || 0,
    montant:         f.montant        || 0,
    statut:          f.statut         || 'brouillon',
    date_envoi:      f.dateEnvoi      || null,
    date_paiement:   f.datePaiement   || null,
    updated_at:      new Date().toISOString()
  };
}

function _factFromRow(r) {
  return {
    id:            r.id,
    periode:       r.periode         || '',
    residentId:    r.resident_id     || '',
    residentNom:   r.resident_nom    || '',
    organisme:     r.organisme       || '',
    categorieId:   r.categorie_id    || '',
    categorieLabel:r.categorie_label || '',
    nbJours:       r.nb_jours        || 0,
    prixJour:      r.prix_jour       || 0,
    montant:       r.montant         || 0,
    statut:        r.statut          || 'brouillon',
    dateEnvoi:     r.date_envoi      || '',
    datePaiement:  r.date_paiement   || '',
    createdAt:     r.created_at
  };
}

async function sbGetFactures() {
  const { data, error } = await supabaseClient
    .from('factures').select('*').order('periode', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement factures', 'error'); return []; }
  return data.map(_factFromRow);
}

async function sbSaveFacture(f) {
  const etablissementId = await sbGetEtablissementId();
  const row = _factToRow(f, etablissementId);
  if (f.id) {
    const { data, error } = await supabaseClient.from('factures').update(row).eq('id', f.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune facture mise à jour — id=' + f.id);
    return _factFromRow(data[0]);
  }
  const { data, error } = await supabaseClient.from('factures').insert(row).select();
  if (error) throw error;
  return _factFromRow(data[0]);
}

async function sbDeleteFacture(id) {
  const { data, error } = await supabaseClient.from('factures').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune facture supprimée — id=' + id);
}
