// ── COUCHE SUPABASE — PLANNING ÉQUIPE ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

function _peToRow(s, etablissementId) {
  return {
    etablissement_id: etablissementId,
    employe_id:       s.employeId  ? String(s.employeId) : null,
    employe_nom:      s.employeNom || '',
    date:             s.date       || null,
    debut:            s.debut      || null,
    fin:              s.fin        || null,
    updated_at:       new Date().toISOString()
  };
}

function _peFromRow(r) {
  return {
    id:         r.id,
    employeId:  r.employe_id   || '',
    employeNom: r.employe_nom  || '',
    date:       r.date         || '',
    debut:      r.debut        || '',
    fin:        r.fin          || '',
    createdAt:  r.created_at,
    updatedAt:  r.updated_at
  };
}

async function sbGetPeShifts() {
  const { data, error } = await supabaseClient
    .from('planning_equipe')
    .select('*')
    .order('date', { ascending: true });
  if (error) { console.error(error); toast('Erreur chargement planning', 'error'); return []; }
  return data.map(_peFromRow);
}

async function sbSavePeShift(s) {
  const etablissementId = await sbGetEtablissementId();
  const row = _peToRow(s, etablissementId);
  if (s.id) {
    const { data, error } = await supabaseClient
      .from('planning_equipe').update(row).eq('id', s.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune ligne mise à jour — id=' + s.id);
    return _peFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('planning_equipe').insert(row).select();
  if (error) throw error;
  return _peFromRow(data[0]);
}

async function sbDeletePeShift(id) {
  const { data, error } = await supabaseClient
    .from('planning_equipe').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune ligne supprimée — id=' + id);
}

// ── Calcul des heures de récup (écart cumulé) ──
// Récup = Σ sur les semaines ayant des créneaux de (heures planifiées de la semaine − heures contractuelles).
// Renvoie un nombre de minutes (peut être négatif = déficit).
function _peWeekKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = (d.getDay() + 6) % 7;     // lundi = 0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}
function _peDurMins(debut, fin) {
  const [h1, m1] = debut.split(':').map(Number);
  const [h2, m2] = fin.split(':').map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60;
  return mins;
}
function peRecupMinutesForEmploye(shifts, employeId, heuresContrat) {
  const byWeek = {};
  shifts.forEach(s => {
    if (String(s.employeId) !== String(employeId) || !s.debut || !s.fin || !s.date) return;
    const k = _peWeekKey(s.date);
    byWeek[k] = (byWeek[k] || 0) + _peDurMins(s.debut, s.fin);
  });
  const weekContract = (heuresContrat ?? 35) * 60;
  let total = 0;
  Object.values(byWeek).forEach(wm => { total += (wm - weekContract); });
  return total;
}
function peFormatRecup(mins) {
  const sign = mins < 0 ? '−' : '+';
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60), m = abs % 60;
  return `${sign}${h}h${m ? String(m).padStart(2, '0') : ''}`;
}

// Insertion en lot (duplication de semaine, import CSV)
async function sbBulkInsertPeShifts(list) {
  if (!list || !list.length) return [];
  const etablissementId = await sbGetEtablissementId();
  const rows = list.map(s => _peToRow(s, etablissementId));
  const { data, error } = await supabaseClient
    .from('planning_equipe').insert(rows).select();
  if (error) throw error;
  return data.map(_peFromRow);
}
