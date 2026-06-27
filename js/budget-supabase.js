// ── COUCHE DE CONNEXION SUPABASE — BUDGET (enveloppes & demandes) ──
// sbGetEtablissementId() est défini dans js/residents-supabase.js (chargé avant ce fichier).

function _benvToRow(e, etablissementId) {
  return {
    etablissement_id: etablissementId,
    nom: e.nom || '',
    montant: e.montant || 0,
    description: e.description || '',
    created_at: e.createdAt || new Date().toISOString()
  };
}

function _benvFromRow(r) {
  return { id: r.id, nom: r.nom, montant: r.montant, description: r.description, createdAt: r.created_at };
}

async function sbGetBudgetEnveloppes() {
  const { data, error } = await supabaseClient.from('budget_enveloppes').select('*').order('created_at', { ascending: true });
  if (error) { console.error(error); toast('Erreur de chargement des enveloppes', 'error'); return []; }
  return data.map(_benvFromRow);
}

async function sbSaveBudgetEnveloppe(env) {
  const etablissementId = await sbGetEtablissementId();
  const row = _benvToRow(env, etablissementId);
  if (env.id) {
    const { data, error } = await supabaseClient.from('budget_enveloppes').update(row).eq('id', env.id).select().single();
    if (error) throw error;
    return _benvFromRow(data);
  }
  const { data, error } = await supabaseClient.from('budget_enveloppes').insert(row).select().single();
  if (error) throw error;
  return _benvFromRow(data);
}

async function sbDeleteBudgetEnveloppe(id) {
  const { error } = await supabaseClient.from('budget_enveloppes').delete().eq('id', id);
  if (error) throw error;
}

function _bdemToRow(d, etablissementId) {
  return {
    etablissement_id: etablissementId,
    employe_id: d.employeId || '',
    employe_nom: d.employeNom || '',
    enveloppe_id: d.enveloppeId || null,
    enveloppe_nom: d.enveloppeNom || '',
    montant: d.montant || 0,
    motif: d.motif || '',
    date_depense: d.dateDepense || '',
    resident_ids: d.residentIds || [],
    resident_noms: d.residentNoms || [],
    partage50: !!d.partage50,
    part_foyer: d.partFoyer || 0,
    part_resident: d.partResident || 0,
    remboursements: d.remboursements || [],
    projet_documents: d.projetDocuments || [],
    justificatifs: d.justificatifs || [],
    statut: d.statut || 'en_attente',
    date_demande: d.dateDemande || new Date().toISOString(),
    reponse_motif: d.reponseMotif || '',
    traite_par: d.traitePar || '',
    date_traitement: d.dateTraitement || null,
    date_justifie: d.dateJustifie || null
  };
}

function _bdemFromRow(r) {
  return {
    id: r.id, employeId: r.employe_id, employeNom: r.employe_nom,
    enveloppeId: r.enveloppe_id, enveloppeNom: r.enveloppe_nom,
    montant: r.montant, motif: r.motif, dateDepense: r.date_depense,
    residentIds: r.resident_ids || [], residentNoms: r.resident_noms || [],
    partage50: r.partage50, partFoyer: r.part_foyer, partResident: r.part_resident,
    remboursements: r.remboursements || [], projetDocuments: r.projet_documents || [],
    justificatifs: r.justificatifs || [], statut: r.statut, dateDemande: r.date_demande,
    reponseMotif: r.reponse_motif, traitePar: r.traite_par,
    dateTraitement: r.date_traitement, dateJustifie: r.date_justifie
  };
}

async function sbGetBudgetDemandes() {
  const { data, error } = await supabaseClient.from('budget_demandes').select('*').order('date_demande', { ascending: false });
  if (error) { console.error(error); toast('Erreur de chargement des demandes', 'error'); return []; }
  return data.map(_bdemFromRow);
}

async function sbSaveBudgetDemande(d) {
  const etablissementId = await sbGetEtablissementId();
  const row = _bdemToRow(d, etablissementId);
  if (d.id) {
    const { data, error } = await supabaseClient.from('budget_demandes').update(row).eq('id', d.id).select().single();
    if (error) throw error;
    return _bdemFromRow(data);
  }
  const { data, error } = await supabaseClient.from('budget_demandes').insert(row).select().single();
  if (error) throw error;
  return _bdemFromRow(data);
}

async function sbDeleteBudgetDemande(id) {
  const { error } = await supabaseClient.from('budget_demandes').delete().eq('id', id);
  if (error) throw error;
}
