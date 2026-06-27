// ── COUCHE DE CONNEXION SUPABASE — PLANNING (évènements résidents) ──
// sbGetEtablissementId() est défini dans js/residents-supabase.js (chargé avant ce fichier).
// Note : la colonne SQL "desc" était un mot réservé Postgres → colonne renommée "description".

function _pevToRow(e, etablissementId) {
  return {
    etablissement_id: etablissementId,
    titre: e.titre || '',
    resident_id: e.residentId || null,
    resident_name: e.residentName || '',
    type: e.type || '',
    date: e.date || '',
    heure: e.heure || e.time || '',
    duree: e.duree || '',
    color: e.color || '',
    description: e.desc || '',
    vehicule: e.vehicule || null,
    destination: e.destination || null,
    motif: e.motif || null,
    recur_id: e.recurId || null,
    recur_freq: e.recurFreq || null,
    recur_until: e.recurUntil || null,
    sante_rdv_id: e.santeRdvId || null,
    lieu: e.lieu || null,
    serafin: e.serafin || null,
    resident_ids: e.residentIds || [],
    resident_names: e.residentNames || [],
    date_end: e.dateEnd || null,
    time_end: e.timeEnd || null,
    reserved_by: e.reservedBy || null,
    reserved_prenom: e.reservedPrenom || null
  };
}

function _pevFromRow(r) {
  return {
    id: r.id, titre: r.titre,
    residentId: r.resident_id, residentName: r.resident_name,
    type: r.type, date: r.date,
    heure: r.heure, time: r.heure,
    duree: r.duree, color: r.color, desc: r.description,
    vehicule: r.vehicule, destination: r.destination, motif: r.motif,
    recurId: r.recur_id, recurFreq: r.recur_freq, recurUntil: r.recur_until,
    santeRdvId: r.sante_rdv_id,
    lieu: r.lieu, serafin: r.serafin,
    residentIds: r.resident_ids || [], residentNames: r.resident_names || [],
    dateEnd: r.date_end, timeEnd: r.time_end,
    reservedBy: r.reserved_by, reservedPrenom: r.reserved_prenom
  };
}

async function sbGetPlanningEvents() {
  const { data, error } = await supabaseClient.from('planning_events').select('*');
  if (error) { console.error(error); toast('Erreur de chargement du planning', 'error'); return []; }
  return data.map(_pevFromRow);
}

async function sbSavePlanningEvent(ev) {
  const etablissementId = await sbGetEtablissementId();
  const row = _pevToRow(ev, etablissementId);
  if (ev.id) {
    const { data, error } = await supabaseClient.from('planning_events').update(row).eq('id', ev.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune ligne mise à jour (id introuvable ou accès refusé) — id=' + ev.id);
    return _pevFromRow(data[0]);
  }
  const { data, error } = await supabaseClient.from('planning_events').insert(row).select();
  if (error) throw error;
  return _pevFromRow(data[0]);
}

async function sbSavePlanningEventsBulk(events) {
  const etablissementId = await sbGetEtablissementId();
  const rows = events.map(e => _pevToRow(e, etablissementId));
  const { data, error } = await supabaseClient.from('planning_events').insert(rows).select();
  if (error) throw error;
  return data.map(_pevFromRow);
}

async function sbDeletePlanningEvent(id) {
  const { data, error } = await supabaseClient.from('planning_events').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune ligne supprimée (id introuvable ou accès refusé) — id=' + id);
}

async function sbDeletePlanningEventSeries(recurId) {
  const { data, error } = await supabaseClient.from('planning_events').delete().eq('recur_id', recurId).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune ligne supprimée (série introuvable ou accès refusé) — recurId=' + recurId);
}
