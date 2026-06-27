// ── COUCHE SUPABASE — CONSEIL DE LA VIE SOCIALE (CVS) ──
// sbGetEtablissementId() défini dans js/residents-supabase.js
// Tout le CVS (membres + séances + thématiques) tient dans un seul objet jsonb par établissement.
// Les échéances de fin de mandat sont gérées via la couche echeances (echeances-supabase.js).

async function sbGetCvs() {
  const { data, error } = await supabaseClient
    .from('cvs').select('data').limit(1);
  if (error) { console.error(error); toast('Erreur chargement CVS', 'error'); return null; }
  return (data && data[0]) ? data[0].data : null;
}

async function sbSaveCvs(obj) {
  const etablissementId = await sbGetEtablissementId();
  const { error } = await supabaseClient
    .from('cvs')
    .upsert({ etablissement_id: etablissementId, data: obj || {}, updated_at: new Date().toISOString() },
            { onConflict: 'etablissement_id' });
  if (error) throw error;
}
