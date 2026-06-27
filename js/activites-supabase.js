// ── COUCHE SUPABASE — ACTIVITÉS (catalogue) ──
// sbGetEtablissementId() défini dans js/residents-supabase.js
// Les inscriptions & bilans individuels restent stockés sur la fiche résident.

function _actToRow(a, etablissementId) {
  return {
    etablissement_id: etablissementId,
    nom:            a.nom         || '',
    categorie:      a.categorie   || 'autre',
    jour:           a.jour        || '',
    heure_debut:    a.heureDebut  || '',
    heure_fin:      a.heureFin    || '',
    lieu:           a.lieu        || '',
    animateur:      a.animateur   || '',
    places_max:     parseInt(a.placesMax, 10) || 0,
    description:    a.description || '',
    actif:          a.actif !== false,
    bilans_annuels: a.bilansAnnuels || {},
    updated_at:     new Date().toISOString()
  };
}

function _actFromRow(r) {
  return {
    id:            r.id,
    nom:           r.nom         || '',
    categorie:     r.categorie   || 'autre',
    jour:          r.jour        || '',
    heureDebut:    r.heure_debut || '',
    heureFin:      r.heure_fin   || '',
    lieu:          r.lieu        || '',
    animateur:     r.animateur   || '',
    placesMax:     r.places_max  || 0,
    description:   r.description || '',
    actif:         r.actif !== false,
    bilansAnnuels: r.bilans_annuels || {},
    createdAt:     r.created_at
  };
}

async function sbGetActivites() {
  const { data, error } = await supabaseClient
    .from('activites')
    .select('*')
    .order('nom', { ascending: true });
  if (error) { console.error(error); toast('Erreur chargement activités', 'error'); return []; }
  return data.map(_actFromRow);
}

async function sbSaveActivite(a) {
  const etablissementId = await sbGetEtablissementId();
  const row = _actToRow(a, etablissementId);
  if (a.id) {
    const { data, error } = await supabaseClient
      .from('activites').update(row).eq('id', a.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune activité mise à jour — id=' + a.id);
    return _actFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('activites').insert(row).select();
  if (error) throw error;
  return _actFromRow(data[0]);
}

async function sbDeleteActivite(id) {
  const { data, error } = await supabaseClient
    .from('activites').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune activité supprimée — id=' + id);
}
