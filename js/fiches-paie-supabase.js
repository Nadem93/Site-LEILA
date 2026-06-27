// ── COUCHE SUPABASE — FICHES DE PAIE ──
// sbGetEtablissementId() défini dans js/residents-supabase.js
// Le bulletin (fichier) est stocké dans le bucket "justificatifs" (helpers dans absences-supabase.js)

function _fpToRow(f, etablissementId) {
  return {
    etablissement_id: etablissementId,
    employe_id:       String(f.employeId),
    employe_nom:      f.employeNom || '',
    periode:          f.periode    || '',
    brut:             Number(f.brut) || 0,
    primes:           Number(f.primes) || 0,
    heures_sup:       Number(f.heuresSup) || 0,
    retenues:         Number(f.retenues) || 0,
    net:              Number(f.net) || 0,
    details:          (f.details && typeof f.details === 'object') ? f.details : {},
    fichier_path:     f.fichierPath || null,
    fichier_nom:      f.fichierNom  || null,
    ajoute_par:       f.ajoutePar   || ''
  };
}

function _fpFromRow(r) {
  return {
    id:         r.id,
    employeId:  r.employe_id  || '',
    employeNom: r.employe_nom || '',
    periode:    r.periode     || '',
    brut:       r.brut       ?? 0,
    primes:     r.primes     ?? 0,
    heuresSup:  r.heures_sup ?? 0,
    retenues:   r.retenues   ?? 0,
    net:        r.net        ?? 0,
    details:    r.details    || {},
    fichierPath: r.fichier_path || '',
    fichierNom:  r.fichier_nom  || '',
    ajoutePar:  r.ajoute_par || '',
    createdAt:  r.created_at
  };
}

async function sbGetFichesPaie() {
  const { data, error } = await supabaseClient
    .from('fiches_paie')
    .select('*')
    .order('periode', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement fiches de paie', 'error'); return []; }
  return data.map(_fpFromRow);
}

async function sbSaveFichePaie(f) {
  const etablissementId = await sbGetEtablissementId();
  const row = _fpToRow(f, etablissementId);
  if (f.id) {
    const { data, error } = await supabaseClient
      .from('fiches_paie').update(row).eq('id', f.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune ligne mise à jour — id=' + f.id);
    return _fpFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('fiches_paie').insert(row).select();
  if (error) throw error;
  return _fpFromRow(data[0]);
}

async function sbDeleteFichePaie(id) {
  const { data, error } = await supabaseClient
    .from('fiches_paie').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune ligne supprimée — id=' + id);
}
