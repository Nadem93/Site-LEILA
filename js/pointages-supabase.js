// ── COUCHE SUPABASE — POINTAGES ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

function _ptToRow(p, etablissementId) {
  return {
    etablissement_id: etablissementId,
    employe_id:       String(p.employeId),
    date:             p.date,
    arrivee:          p.arrivee || null,
    depart:           p.depart  || null,
    pause_min:        Number(p.pauseMin) || 0,
    valide:           !!p.valide,
    updated_at:       new Date().toISOString()
  };
}

function _ptFromRow(r) {
  return {
    id:        r.id,
    employeId: r.employe_id || '',
    date:      r.date || '',
    arrivee:   r.arrivee || '',
    depart:    r.depart  || '',
    pauseMin:  r.pause_min || 0,
    valide:    !!r.valide
  };
}

async function sbGetPointages() {
  const { data, error } = await supabaseClient
    .from('pointages')
    .select('*')
    .order('date', { ascending: true });
  if (error) { console.error(error); toast('Erreur chargement pointages', 'error'); return []; }
  return data.map(_ptFromRow);
}

// Un pointage par (employé, date) : insert ou update via la contrainte unique
async function sbUpsertPointage(p) {
  const etablissementId = await sbGetEtablissementId();
  const row = _ptToRow(p, etablissementId);
  const { data, error } = await supabaseClient
    .from('pointages')
    .upsert(row, { onConflict: 'etablissement_id,employe_id,date' })
    .select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Pointage non enregistré');
  return _ptFromRow(data[0]);
}
