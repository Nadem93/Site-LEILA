// ── COUCHE SUPABASE — CONFIG PARTAGÉE (table app_config, clé/valeur JSON) ──
// Permet de partager entre postes/appareils : permissions par fonction + taux de
// majoration paie. Le localStorage reste le cache de lecture synchrone ; Supabase
// est la source de vérité (hydratée au login et sur les pages concernées).
// sbGetEtablissementId() défini dans js/residents-supabase.js

async function sbGetAppConfig() {
  const { data, error } = await supabaseClient.from('app_config').select('cle, valeur');
  if (error) { console.error('[sbGetAppConfig]', error); return {}; }
  const out = {};
  (data || []).forEach(r => { out[r.cle] = r.valeur; });
  return out;
}

async function sbSaveAppConfig(cle, valeur) {
  const etablissementId = await sbGetEtablissementId();
  const { error } = await supabaseClient.from('app_config')
    .upsert({ etablissement_id: etablissementId, cle, valeur, updated_at: new Date().toISOString() },
            { onConflict: 'etablissement_id,cle' });
  if (error) throw error;
}

// Hydrate le localStorage depuis Supabase (à appeler au login et sur les pages concernées)
async function hydrateConfigFromCloud() {
  try {
    const cfg = await sbGetAppConfig();
    if (cfg.fonction_colors) localStorage.setItem('ftr_fonction_colors', JSON.stringify(cfg.fonction_colors));
    if (cfg.paie_majoration) localStorage.setItem('ftr_paie_majoration', JSON.stringify(cfg.paie_majoration));
    return cfg;
  } catch (e) { console.error('[hydrateConfigFromCloud]', e); return {}; }
}
