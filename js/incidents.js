const INCIDENT_TYPES = {
  chute:'Chute', agression:'Agression', fugue:'Fugue / Absence inquiétante',
  violence:'Violence', medical:'Médical / Soins', materiel:'Dégât matériel',
  accident:'Accident', autre:'Autre'
};
const GRAVITE_LABELS  = { leger:'Léger', moyen:'Modéré', grave:'Grave', critique:'Critique' };
const STATUT_LABELS   = { declare:'Déclaré', cours:'En cours', valide:'Validé', classe:'Classé' };
const GRAVITE_CLASSES = { leger:'leger', moyen:'moyen', grave:'grave', critique:'dangere' };
const STATUT_CLASSES  = { declare:'declare', cours:'cours', valide:'valide', classe:'classe' };
const INCIDENT_ICONS  = {
  chute:'🦶', agression:'👊', fugue:'🚪', violence:'⚡',
  medical:'💊', materiel:'🔧', accident:'⚠️', autre:'📋'
};

let _incCache          = [];
let _incResidentsCache = [];
let _currentIncidentId = null;

function getIncidents() { return _incCache; }

// ─── Init ─────────────────────────────────────────────────────────────────────
async function initIncidents() {
  const session = Auth.requireAuth();
  if (!session) return;
  if (!requireModule('view_incidents')) return;

  try {
    [_incCache, _incResidentsCache] = await Promise.all([
      sbGetIncidents(),
      sbGetResidents()
    ]);
  } catch(e) {
    console.error(e);
    toast('Erreur de chargement', 'error');
  }

  populateResidentSelect();
  setDefaults();
  renderIncidents();
}

function populateResidentSelect() {
  const sel = document.getElementById('fResident');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Aucun —</option>' + _incResidentsCache.map(r =>
    `<option value="${r.id}">${escHtml(r.prenom||'')} ${escHtml(r.nom||'')}</option>`
  ).join('');
}

function setDefaults() {
  const d = document.getElementById('fDate');
  if (d && !d.value) d.value = new Date().toISOString().slice(0,10);
  const h = document.getElementById('fHeure');
  if (h && !h.value) h.value = new Date().toTimeString().slice(0,5);
}

// ─── Sauvegarde ───────────────────────────────────────────────────────────────
async function saveIncident() {
  try {
    const titre       = document.getElementById('fTitre').value.trim();
    const type        = document.getElementById('fType').value;
    const gravite     = document.getElementById('fGravite').value;
    const date        = document.getElementById('fDate').value;
    const heure       = document.getElementById('fHeure').value;
    const residentId  = document.getElementById('fResident').value;
    const lieu        = document.getElementById('fLieu').value.trim();
    const description = document.getElementById('fDescription').value.trim();
    if (!titre || !description) { toast('Veuillez remplir le titre et la description', 'error'); return; }

    const resident = _incResidentsCache.find(r => r.id === residentId);
    const session  = Auth.getSession();
    const etab     = (typeof getCurrentEtab === 'function') ? getCurrentEtab() : null;

    const incident = {
      titre, type, gravite, date: date || null, heure: heure || null,
      residentId:   residentId || null,
      residentName: resident ? `${resident.prenom||''} ${resident.nom||''}`.trim() : '',
      etabNom:      etab ? etab.nom : '',
      lieu, description,
      statut:       'declare',
      declaredBy:   session ? `${session.prenom||''} ${session.nom||''}`.trim() || session.username : 'Inconnu',
      declaredById: session ? session.userId : null,
      declaredAt:   new Date().toISOString(),
      notes:        ''
    };

    const dup = findIncidentDuplicate(incident, _incCache);
    if (dup) {
      if (!confirm(`⚠️ Doublon possible avec un incident déjà déclaré :\n\n« ${escHtml(dup.titre||'')} »\n${dup.date ? formatDate(dup.date) : ''}${dup.heure ? ' à ' + dup.heure : ''} · déclaré par ${dup.declaredBy || '?'}\n\nDéclarer quand même ce nouvel incident ?`)) return;
    }

    const saved = await sbSaveIncident(incident);
    _incCache.unshift(saved);
    if (typeof auditLog === 'function') auditLog('incident_create', `${saved.titre} (${GRAVITE_LABELS[saved.gravite]||saved.gravite})`);
    closeModal('modalIncident');
    toast('Incident déclaré');
    renderIncidents();
    resetForm();
  } catch(e) {
    const msg = e?.message || e?.details || JSON.stringify(e) || 'Erreur inconnue';
    toast('Erreur : ' + msg, 'error');
    console.error('[saveIncident]', e);
  }
}

function resetForm() {
  ['fTitre','fLieu','fDescription'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('fGravite').value = 'leger';
  document.getElementById('fType').value    = 'chute';
  document.getElementById('fResident').value = '';
  setDefaults();
}

// ─── Rendu liste ──────────────────────────────────────────────────────────────
function renderIncidents() {
  const container = document.getElementById('incidentsList');
  const countEl   = document.getElementById('incidentCount');
  if (!container) return;

  let list = [..._incCache];
  const search       = (document.getElementById('searchIncident')?.value || '').toLowerCase();
  const filterType   = document.getElementById('filterType')?.value   || '';
  const filterGravite= document.getElementById('filterGravite')?.value|| '';
  const filterStatut = document.getElementById('filterStatut')?.value || '';
  const session      = Auth.getSession();
  const isAdmin      = session && (session.role === 'admin' || session.role === 'moderator' || canViewAllIncidents(session.userId));

  list = list.filter(i => {
    if (filterType    && i.type    !== filterType)    return false;
    if (filterGravite && i.gravite !== filterGravite) return false;
    if (filterStatut  && i.statut  !== filterStatut)  return false;
    if (!isAdmin && i.declaredById !== session?.userId) return false;
    if (search) {
      const txt = `${i.titre} ${i.residentName||''} ${i.description||''} ${i.lieu||''} ${i.declaredBy||''}`.toLowerCase();
      if (!txt.includes(search)) return false;
    }
    return true;
  });

  list.sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
  if (countEl) countEl.textContent = `${list.length} incident${list.length > 1 ? 's' : ''}`;

  if (!list.length) {
    container.innerHTML = '<div class="empty" style="padding:3rem"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:48px;height:48px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><p>Aucun incident à afficher</p></div>';
    return;
  }

  container.innerHTML = list.map(i => {
    const typeLabel = INCIDENT_TYPES[i.type] || i.type;
    const gravLabel = GRAVITE_LABELS[i.gravite] || i.gravite;
    const statLabel = STATUT_LABELS[i.statut]  || i.statut;
    const icon      = INCIDENT_ICONS[i.type]   || '📋';
    const dateStr   = i.date  ? formatDate(i.date) : '—';
    const timeStr   = i.heure ? i.heure.slice(0,5) : '';
    const canValidate = session && (session.role === 'admin' || session.role === 'moderator' || canValidateIncidents(session.userId)) && (i.statut === 'declare' || i.statut === 'cours');

    return `<div class="incident-card">
      <div class="top">
        <div class="incident-type-icon" style="background:${graviteColor(i.gravite)}22;color:${graviteColor(i.gravite)}">${icon}</div>
        <div class="info">
          <h3>${escHtml(i.titre)}</h3>
          <div class="meta">
            <span>📅 ${dateStr}${timeStr ? ' · '+timeStr : ''}</span>
            ${i.residentName ? `<span>👤 ${escHtml(i.residentName)}</span>` : ''}
            ${i.lieu         ? `<span>📍 ${escHtml(i.lieu)}</span>`         : ''}
            <span>✍️ ${escHtml(i.declaredBy)}</span>
            ${i.etabNom      ? `<span>🏢 ${escHtml(i.etabNom)}</span>`      : ''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.3rem;flex-shrink:0">
          <span class="badge-incident ${GRAVITE_CLASSES[i.gravite]||''}">${gravLabel}</span>
          <span class="badge-status ${STATUT_CLASSES[i.statut]||''}">${statLabel}</span>
          ${i.eig?.declarable ? `<span class="badge-incident dangere" title="Événement indésirable grave">🚨 EIG${i.eig.cloture ? ' · clôturé' : i.eig.declareARS ? ' · déclaré' : ' · à déclarer'}</span>` : ''}
        </div>
      </div>
      ${i.description ? `<div class="desc">${escHtml(i.description)}</div>` : ''}
      ${i.notes       ? `<div class="validation-tag">📎 Notes : ${escHtml(i.notes)}</div>` : ''}
      <div class="incident-actions">
        <button class="btn btn-ghost btn-sm" onclick="viewIncident('${i.id}')">Détails</button>
        ${canValidate ? `<button class="btn btn-outline btn-sm" onclick="openValidation('${i.id}')">Traiter</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function graviteColor(g) {
  return { leger:'#16a34a', moyen:'#ca8a04', grave:'#ea580c', critique:'#dc2626' }[g] || '#6b7280';
}

// ─── Détail ───────────────────────────────────────────────────────────────────
function viewIncident(id) {
  _currentIncidentId = id;
  const btnPrint = document.getElementById('btnPrintIncident');
  if (btnPrint) btnPrint.style.display = '';
  const i = _incCache.find(x => x.id === id);
  if (!i) return;
  const session     = Auth.getSession();
  const isAdmin     = session && (session.role === 'admin' || session.role === 'moderator' || canViewAllIncidents(session.userId));
  const typeLabel   = INCIDENT_TYPES[i.type]  || i.type;
  const gravLabel   = GRAVITE_LABELS[i.gravite]|| i.gravite;
  const statLabel   = STATUT_LABELS[i.statut]  || i.statut;
  const canValidate = isAdmin && (i.statut === 'declare' || i.statut === 'cours');

  document.getElementById('detailTitle').textContent = i.titre;
  document.getElementById('detailBody').innerHTML = `
    <div style="display:flex;gap:.5rem;flex-wrap:wrap">
      <span class="badge-incident ${GRAVITE_CLASSES[i.gravite]||''}">${gravLabel}</span>
      <span class="badge-status ${STATUT_CLASSES[i.statut]||''}">${statLabel}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;background:var(--bg-alt,#f9fafb);padding:.75rem;border-radius:var(--r)">
      <div><strong>Type</strong><br>${typeLabel}</div>
      <div><strong>Gravité</strong><br>${gravLabel}</div>
      <div><strong>Date</strong><br>${i.date ? formatDate(i.date) : '—'}</div>
      <div><strong>Heure</strong><br>${i.heure ? i.heure.slice(0,5) : '—'}</div>
      ${i.residentName ? `<div><strong>Résident</strong><br>${escHtml(i.residentName)}</div>` : ''}
      ${i.lieu         ? `<div><strong>Lieu</strong><br>${escHtml(i.lieu)}</div>` : ''}
      ${i.etabNom      ? `<div><strong>Établissement</strong><br>🏢 ${escHtml(i.etabNom)}</div>` : ''}
      <div><strong>Déclaré par</strong><br>${escHtml(i.declaredBy)}</div>
      <div><strong>Déclaré le</strong><br>${i.declaredAt ? formatDateTime(i.declaredAt) : '—'}</div>
    </div>
    <div><strong>Description</strong><br>${escHtml(i.description) || '—'}</div>
    ${i.validatedBy ? `<div><strong>Validé par</strong><br>${escHtml(i.validatedBy)}${i.validatedAt ? ' le '+formatDateTime(i.validatedAt) : ''}</div>` : ''}
    ${i.notes       ? `<div><strong>Notes de validation</strong><br>${escHtml(i.notes)}</div>` : ''}
    <div style="border-top:1px solid var(--border);padding-top:.6rem;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">
      <strong>🚨 Événement indésirable grave (ARS)</strong>
      ${i.eig?.declarable ? `<span class="badge-incident dangere">${i.eig.cloture ? 'Clôturé' : i.eig.declareARS ? 'Déclaré' : 'À déclarer'}</span>` : '<span class="badge badge-gray">Non déclarable</span>'}
      ${(typeof canValidateIncidents === 'function' && canValidateIncidents(session?.userId)) || isAdmin ? `
        <button class="btn btn-ghost btn-sm" onclick="toggleEigDeclarable('${i.id}')">${i.eig?.declarable ? 'Retirer du registre EIG' : 'Marquer comme EIG'}</button>
        ${i.eig?.declarable ? `<a class="btn btn-ghost btn-sm" href="eig.html">Gérer la déclaration →</a>` : ''}
      ` : ''}
    </div>
  `;

  const footer = document.getElementById('detailFooter');
  footer.innerHTML = canValidate
    ? `<button class="btn btn-ghost" onclick="closeModal('modalDetail')">Fermer</button>
       <button class="btn btn-outline" onclick="closeModal('modalDetail');openValidation('${i.id}')">Traiter</button>`
    : `<button class="btn btn-ghost" onclick="closeModal('modalDetail')">Fermer</button>`;

  openModal('modalDetail');
}

function printSingleIncident() {
  if (!_currentIncidentId) return;
  const i = _incCache.find(x => x.id === _currentIncidentId);
  if (!i) return;
  _printIncidentWindow([i], `Incident — ${i.titre}`);
}

function exportIncidentsPDF() {
  let list = [..._incCache];
  const search        = (document.getElementById('searchIncident')?.value || '').toLowerCase();
  const filterType    = document.getElementById('filterType')?.value    || '';
  const filterGravite = document.getElementById('filterGravite')?.value || '';
  const filterStatut  = document.getElementById('filterStatut')?.value  || '';
  const session = Auth.getSession();
  const isAdmin = session && (session.role === 'admin' || session.role === 'moderator' || canViewAllIncidents(session.userId));
  list = list.filter(i => {
    if (filterType    && i.type    !== filterType)    return false;
    if (filterGravite && i.gravite !== filterGravite) return false;
    if (filterStatut  && i.statut  !== filterStatut)  return false;
    if (!isAdmin && i.declaredById !== session?.userId) return false;
    if (search) {
      const txt = `${i.titre} ${i.residentName||''} ${i.description||''} ${i.lieu||''} ${i.declaredBy||''}`.toLowerCase();
      if (!txt.includes(search)) return false;
    }
    return true;
  });
  list.sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
  if (!list.length) { toast('Aucun incident à exporter', 'error'); return; }
  _printIncidentWindow(list, `Rapport d'incidents — ${new Date().toLocaleDateString('fr-FR')}`);
}

function _printIncidentWindow(list, title) {
  const settings   = DB.get(DB.keys.settings) || {};
  const gravColors = { leger:'#16a34a', moyen:'#ca8a04', grave:'#ea580c', critique:'#dc2626' };
  const gravBg     = { leger:'#f0fdf4', moyen:'#fefce8', grave:'#ffedd5', critique:'#fef2f2' };
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escHtml(title)}</title>
<style>
  @page{margin:1.8cm 1.5cm}
  body{font-family:'Inter','Segoe UI',system-ui,sans-serif;font-size:9.5pt;line-height:1.6;color:#334155;max-width:800px;margin:0 auto}
  .top-stripe{height:6px;background:#0f2b4a;border-radius:0 0 4px 4px;margin-bottom:.5cm}
  .doc-header{margin-bottom:.6cm}
  .doc-header .etab{font-size:11pt;font-weight:300;color:#0f2b4a}
  .doc-header .etab strong{font-weight:700}
  .doc-header .doc-title{font-size:15pt;font-weight:800;color:#0f2b4a;margin-top:.05cm}
  .doc-header .doc-meta{font-size:7.5pt;color:#64748b;margin-top:.15cm}
  .incident{border:1px solid #e2e8f0;border-radius:8px;padding:.5cm .6cm;margin-bottom:.4cm;page-break-inside:avoid}
  .inc-top{display:flex;align-items:flex-start;gap:.4cm;margin-bottom:.2cm}
  .inc-icon{width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0}
  .inc-title{font-size:10.5pt;font-weight:700;color:#0f2b4a;margin:0 0 2px}
  .inc-meta{font-size:7.5pt;color:#64748b;display:flex;flex-wrap:wrap;gap:.1cm .35cm}
  .badge{display:inline-block;padding:1px 7px;border-radius:100px;font-size:7pt;font-weight:600}
  .badges{display:flex;gap:.2cm;margin-top:.15cm}
  .inc-desc{font-size:8.5pt;color:#475569;margin-top:.2cm;line-height:1.5;border-top:1px solid #f1f5f9;padding-top:.2cm}
  .inc-notes{font-size:8pt;color:#64748b;font-style:italic;margin-top:.15cm}
  .inc-validation{font-size:7.5pt;color:#16a34a;margin-top:.15cm}
  .footer{margin-top:.8cm;padding-top:.3cm;border-top:1px solid #e2e8f0;text-align:center;font-size:7pt;color:#94a3b8}
  .actions{text-align:center;margin:.4cm 0}
  .actions button{padding:.35rem 1.1rem;border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc;cursor:pointer;font-size:9pt;margin:.2rem}
  @media print{.actions{display:none}}
</style></head><body>
<div class="top-stripe"></div>
<div class="doc-header">
  <div class="etab"><strong>${escHtml(settings.etablissement||'Foyer d\'Hébergement')}</strong></div>
  <div class="doc-title">${escHtml(title)}</div>
  <div class="doc-meta">Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})} · ${list.length} incident${list.length>1?'s':''}</div>
</div>
<div class="actions">
  <button onclick="window.print()">🖨 Imprimer / Enregistrer en PDF</button>
  <button onclick="window.close()">Fermer</button>
</div>
${list.map(i => {
  const gc   = gravColors[i.gravite]||'#6b7280';
  const gb   = gravBg[i.gravite]||'#f3f4f6';
  const icon = INCIDENT_ICONS[i.type]||'📋';
  return `<div class="incident">
    <div class="inc-top">
      <div class="inc-icon" style="background:${gb};color:${gc}">${icon}</div>
      <div style="flex:1;min-width:0">
        <div class="inc-title">${escHtml(i.titre)}</div>
        <div class="inc-meta">
          <span>📅 ${escHtml(i.date||'—')}${i.heure?' · '+i.heure.slice(0,5):''}</span>
          ${i.residentName?`<span>👤 ${escHtml(i.residentName)}</span>`:''}
          ${i.lieu?`<span>📍 ${escHtml(i.lieu)}</span>`:''}
          <span>✍️ ${escHtml(i.declaredBy||'')}</span>
          ${i.etabNom?`<span>🏢 ${escHtml(i.etabNom)}</span>`:''}
        </div>
        <div class="badges">
          <span class="badge" style="background:${gb};color:${gc}">${GRAVITE_LABELS[i.gravite]||i.gravite}</span>
          <span class="badge" style="background:#f1f5f9;color:#475569">${INCIDENT_TYPES[i.type]||i.type}</span>
          <span class="badge" style="background:#f1f5f9;color:#475569">${STATUT_LABELS[i.statut]||i.statut}</span>
        </div>
      </div>
    </div>
    ${i.description?`<div class="inc-desc">${escHtml(i.description)}</div>`:''}
    ${i.notes?`<div class="inc-notes">📎 Notes : ${escHtml(i.notes)}</div>`:''}
    ${i.validatedBy?`<div class="inc-validation">✔ Traité par ${escHtml(i.validatedBy)}${i.validatedAt?' le '+new Date(i.validatedAt).toLocaleDateString('fr-FR'):''}</div>`:''}
  </div>`;
}).join('')}
<div class="footer">${escHtml(settings.etablissement||'Foyer d\'Hébergement')} — Document généré le ${new Date().toLocaleDateString('fr-FR')}</div>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}

// ─── Validation ───────────────────────────────────────────────────────────────
function openValidation(id) {
  const btnPrint = document.getElementById('btnPrintIncident');
  if (btnPrint) btnPrint.style.display = 'none';
  closeModal('modalDetail');
  const i = _incCache.find(x => x.id === id);
  if (!i) return;

  document.getElementById('detailTitle').textContent = `Traiter : ${i.titre}`;
  document.getElementById('detailBody').innerHTML = `
    <p style="font-size:.875rem;color:var(--muted)">Changer le statut de cet incident :</p>
    <div class="form-group">
      <label>Nouveau statut</label>
      <select id="vStatut">
        <option value="cours"  ${i.statut==='cours'  ?'selected':''}>En cours</option>
        <option value="valide" ${i.statut==='valide' ?'selected':''}>Validé</option>
        <option value="classe" ${i.statut==='classe' ?'selected':''}>Classé</option>
      </select>
    </div>
    <div class="form-group">
      <label>Notes (optionnel)</label>
      <textarea id="vNotes" rows="3" placeholder="Commentaire sur le traitement…">${escHtml(i.notes||'')}</textarea>
    </div>
  `;
  document.getElementById('detailFooter').innerHTML = `
    <button class="btn btn-ghost" onclick="viewIncident('${id}')">Annuler</button>
    <button class="btn btn-primary" onclick="validateIncident('${id}')">Enregistrer</button>
  `;
  openModal('modalDetail');
}

async function validateIncident(id) {
  const i = _incCache.find(x => x.id === id);
  if (!i) return;
  const session = Auth.getSession();
  const statut  = document.getElementById('vStatut').value;
  const notes   = document.getElementById('vNotes').value.trim();
  const fields  = {
    statut,
    notes:           notes || '',
    validated_by:    session ? `${session.prenom||''} ${session.nom||''}`.trim() || session.username : 'Inconnu',
    validated_by_id: session ? String(session.userId) : null,
    validated_at:    new Date().toISOString()
  };
  try {
    const updated = await sbUpdateIncidentField(id, fields);
    const idx = _incCache.findIndex(x => x.id === id);
    if (idx !== -1) _incCache[idx] = updated;
    if (typeof auditLog === 'function') auditLog('incident_update', `${i.titre} → ${STATUT_LABELS[statut]||statut}`);
    closeModal('modalDetail');
    toast(`Incident ${STATUT_LABELS[statut]?.toLowerCase() || statut}`);
    renderIncidents();
  } catch(e) {
    toast('Erreur lors de la mise à jour', 'error');
    console.error(e);
  }
}

// ─── EIG ──────────────────────────────────────────────────────────────────────
async function toggleEigDeclarable(id) {
  const i    = _incCache.find(x => x.id === id);
  if (!i) return;
  const next = !(i.eig && i.eig.declarable);
  const newEig = next
    ? { declarable:true, declareARS:false, dateDeclarationARS:'', numeroSignalement:'', destinataires:['ars'], mesuresImmediates:'', mesuresCorrectives:'', cloture:false, dateCloture:'', suites:'' }
    : { ...(i.eig||{}), declarable:false };
  try {
    const updated = await sbUpdateIncidentField(id, { eig: newEig });
    const idx = _incCache.findIndex(x => x.id === id);
    if (idx !== -1) _incCache[idx] = updated;
    if (typeof auditLog === 'function') auditLog('eig_toggle', `${i.titre} → ${next ? 'ajouté au registre EIG' : 'retiré du registre EIG'}`);
    toast(next ? 'Ajouté au registre des EIG' : 'Retiré du registre des EIG');
    viewIncident(id);
    renderIncidents();
  } catch(e) {
    toast('Erreur', 'error');
    console.error(e);
  }
}

// ─── Doublon ──────────────────────────────────────────────────────────────────
function findIncidentDuplicate(newInc, list) {
  if (!list || !list.length) return null;
  return list.find(i => {
    if (i.type !== newInc.type) return false;
    if (i.residentId && newInc.residentId && i.residentId !== newInc.residentId) return false;
    if (i.date !== newInc.date) return false;
    return strSimilarity(i.titre || '', newInc.titre || '') > 0.6;
  }) || null;
}

function strSimilarity(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (!longer.length) return 1;
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  return matches / longer.length;
}

function escHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  initIncidents();
  const session = Auth.getSession();
  if (session) localStorage.setItem('ftr_last_visit_incidents_' + session.userId, Date.now());
  ['searchIncident','filterType','filterGravite','filterStatut'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', renderIncidents);
  });
});
if (typeof registerPageInit === 'function') registerPageInit('incidents', initIncidents);
