// ── COUCHE SUPABASE — INCIDENTS ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

function _incToRow(i, etablissementId) {
  return {
    etablissement_id:       etablissementId,
    titre:                  i.titre           || '',
    type:                   i.type            || 'autre',
    gravite:                i.gravite         || 'moyen',
    date:                   i.date            || '',
    heure:                  i.heure           || '',
    resident_id:            i.residentId      || null,
    resident_name:          i.residentName    || '',
    etab_nom:               i.etabNom         || '',
    lieu:                   i.lieu            || '',
    description:            i.description     || '',
    statut:                 i.statut          || 'declare',
    declared_by:            i.declaredBy      || '',
    declared_by_id:         i.declaredById    ? String(i.declaredById) : null,
    declared_at:            i.declaredAt      || new Date().toISOString(),
    validated_by:           i.validatedBy     || null,
    validated_by_id:        i.validatedById   ? String(i.validatedById) : null,
    validated_at:           i.validatedAt     || null,
    notes:                  i.notes           || '',
    eig:                    i.eig             || null,
    source_transmission_id: i.sourceTransmissionId || null,
    updated_at:             new Date().toISOString()
  };
}

function _incFromRow(r) {
  return {
    id:                   r.id,
    titre:                r.titre,
    type:                 r.type,
    gravite:              r.gravite,
    date:                 r.date,
    heure:                r.heure,
    residentId:           r.resident_id           || '',
    residentName:         r.resident_name         || '',
    etabNom:              r.etab_nom              || '',
    lieu:                 r.lieu                  || '',
    description:          r.description           || '',
    statut:               r.statut,
    declaredBy:           r.declared_by           || '',
    declaredById:         r.declared_by_id        || null,
    declaredAt:           r.declared_at,
    validatedBy:          r.validated_by          || null,
    validatedById:        r.validated_by_id       || null,
    validatedAt:          r.validated_at          || null,
    notes:                r.notes                 || '',
    eig:                  r.eig                   || null,
    sourceTransmissionId: r.source_transmission_id || null,
    createdAt:            r.created_at,
    updatedAt:            r.updated_at
  };
}

async function sbGetIncidents() {
  const { data, error } = await supabaseClient
    .from('incidents')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); toast('Erreur chargement incidents', 'error'); return []; }
  return data.map(_incFromRow);
}

async function sbSaveIncident(i) {
  const etablissementId = await sbGetEtablissementId();
  const row = _incToRow(i, etablissementId);
  if (i.id) {
    const { data, error } = await supabaseClient
      .from('incidents').update(row).eq('id', i.id).select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('Aucune ligne mise à jour — id=' + i.id);
    return _incFromRow(data[0]);
  }
  const { data, error } = await supabaseClient
    .from('incidents').insert(row).select();
  if (error) throw error;
  return _incFromRow(data[0]);
}

async function sbDeleteIncident(id) {
  const { data, error } = await supabaseClient
    .from('incidents').delete().eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Aucune ligne supprimée — id=' + id);
}

async function sbUpdateIncidentField(id, fields) {
  const { data, error } = await supabaseClient
    .from('incidents').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('Mise à jour échouée — id=' + id);
  return _incFromRow(data[0]);
}
