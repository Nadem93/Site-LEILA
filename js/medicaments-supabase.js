// ── COUCHE SUPABASE — DISTRIBUTION DES MÉDICAMENTS ──
// sbGetEtablissementId() défini dans js/residents-supabase.js
// Les traitements eux-mêmes restent sur la fiche médicale du résident (r.sante.traitements).
// Ici : la traçabilité des prises (donné/refusé/…), une ligne par prise.

function _medToRow(m, etablissementId) {
  return {
    etablissement_id: etablissementId,
    date:          m.date || null,
    resident_id:   m.residentId   || null,
    resident_name: m.residentName || '',
    traitement_id: m.traitementId ? String(m.traitementId) : null,
    medicament:    m.medicament   || '',
    posologie:     m.posologie    || '',
    moment:        m.moment       || '',
    statut:        m.statut       || '',
    heure:         m.heure        || '',
    auteur:        m.auteur       || '',
    observation:   m.observation  || '',
    updated_at:    new Date().toISOString()
  };
}

function _medFromRow(r) {
  return {
    id:           r.id,
    date:         r.date          || '',
    residentId:   r.resident_id   || '',
    residentName: r.resident_name || '',
    traitementId: r.traitement_id || '',
    medicament:   r.medicament    || '',
    posologie:    r.posologie     || '',
    moment:       r.moment        || '',
    statut:       r.statut        || '',
    heure:        r.heure         || '',
    auteur:       r.auteur        || '',
    observation:  r.observation   || ''
  };
}

async function sbGetMedDistrib() {
  const { data, error } = await supabaseClient
    .from('med_distrib')
    .select('*')
    .order('date', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement distribution médicaments', 'error'); return []; }
  return data.map(_medFromRow);
}

async function sbSaveMedDistrib(m) {
  const etablissementId = await sbGetEtablissementId();
  const row = _medToRow(m, etablissementId);
  if (m.id) {
    const { data, error } = await supabaseClient
      .from('med_distrib').update(row).eq('id', m.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune prise mise à jour — id=' + m.id);
    return _medFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('med_distrib').insert(row).select();
  if (error) throw error;
  return _medFromRow(data[0]);
}

async function sbDeleteMedDistrib(id) {
  const { data, error } = await supabaseClient
    .from('med_distrib').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune prise supprimée — id=' + id);
}
