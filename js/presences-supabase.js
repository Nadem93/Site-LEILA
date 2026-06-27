// ── COUCHE DE CONNEXION SUPABASE — PRÉSENCES ──
// Une ligne = un résident + une date + un statut.
// sbGetEtablissementId() est défini dans js/residents-supabase.js (chargé avant ce fichier).

async function sbGetPresencesForDate(date) {
  const { data, error } = await supabaseClient
    .from('presences').select('resident_id, statut').eq('date', date);
  if (error) { console.error(error); toast('Erreur de chargement des présences', 'error'); return {}; }
  const out = {};
  data.forEach(row => { out[row.resident_id] = row.statut; });
  return out;
}

// Pour l'export PDF : toutes les présences entre deux dates, groupées par date.
async function sbGetPresencesRange(startDate, endDate) {
  const { data, error } = await supabaseClient
    .from('presences').select('resident_id, date, statut')
    .gte('date', startDate).lte('date', endDate);
  if (error) { console.error(error); toast('Erreur de chargement des présences', 'error'); return {}; }
  const out = {};
  data.forEach(row => {
    if (!out[row.date]) out[row.date] = {};
    out[row.date][row.resident_id] = row.statut;
  });
  return out;
}

async function sbSetPresence(residentId, date, statut) {
  const etablissementId = await sbGetEtablissementId();
  const { error } = await supabaseClient
    .from('presences')
    .upsert({ resident_id: residentId, date, statut, etablissement_id: etablissementId }, { onConflict: 'resident_id,date' });
  if (error) throw error;
}

async function sbSetPresencesBulk(residentIds, date, statut) {
  const etablissementId = await sbGetEtablissementId();
  const rows = residentIds.map(id => ({ resident_id: id, date, statut, etablissement_id: etablissementId }));
  const { error } = await supabaseClient
    .from('presences').upsert(rows, { onConflict: 'resident_id,date' });
  if (error) throw error;
}
