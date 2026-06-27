// ── COUCHE SUPABASE — REPAS (inscriptions + menus par jour) ──
// sbGetEtablissementId() défini dans js/residents-supabase.js
// Les régimes restent stockés sur la fiche résident (sbSaveResident).
// Stockage : 1 ligne par jour dans la table repas_jour { date, data jsonb }.

async function sbGetRepasAll() {
  const { data, error } = await supabaseClient
    .from('repas_jour')
    .select('date,data');
  if (error) { console.error(error); toast('Erreur chargement repas', 'error'); return {}; }
  const out = {};
  (data || []).forEach(r => { out[r.date] = r.data || {}; });
  return out;
}

async function sbSaveRepasJour(date, dayData) {
  if (!date) return;
  const etablissementId = await sbGetEtablissementId();
  const { error } = await supabaseClient
    .from('repas_jour')
    .upsert(
      { etablissement_id: etablissementId, date, data: dayData || {}, updated_at: new Date().toISOString() },
      { onConflict: 'etablissement_id,date' }
    );
  if (error) throw error;
}
