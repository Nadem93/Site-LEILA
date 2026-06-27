// ── GESTION DES CONTRATS ──
const CT_TYPES = {
  cdi:        { label: 'CDI',        color: '#16a34a' },
  cdd:        { label: 'CDD',        color: '#d97706' },
  vacation:   { label: 'Vacation',   color: '#6366f1' },
  stage:      { label: 'Stage',      color: '#0891b2' },
  alternance: { label: 'Alternance', color: '#8b5cf6' }
};

let ctEditId = null;
let ctAvenants = [];
let _ctCache = [];
let _ctEmployesCache = [];

function getContrats()      { return _ctCache; }
function ctEmployes()       { return _ctEmployesCache; }
function ctEmployeNom(id)   { const e = ctEmployes().find(x => String(x.id) === String(id)); return e ? `${e.prenom||''} ${e.nom||''}`.trim() : 'Inconnu'; }

function ctIsCanEdit() {
  return Auth.isAdmin() || (typeof canEditResidents === 'function' && canEditResidents(Auth.getSession()?.userId));
}

// Remplit un <select> avec les postes de référence (fonctions définies en Admin),
// en conservant le poste déjà saisi même s'il n'est pas dans la liste.
function ctFillPosteSelect(selectEl, currentPoste) {
  const fonctions = DB.get(DB.keys.fonctionColors) || [];
  const noms = fonctions.map(f => f.fonction);
  const poste = currentPoste || '';
  if (poste && !noms.includes(poste)) noms.unshift(poste);
  selectEl.innerHTML = '<option value="">— Sélectionner un poste —</option>'
    + noms.map(n => `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join('');
  selectEl.value = poste;
}

// Ouvre le document joint au contrat (URL signée temporaire)
async function ctOpenFichier(id) {
  const c = _ctCache.find(x => x.id === id);
  if (!c || !c.fichierPath) return;
  const url = await sbJustificatifUrl(c.fichierPath);
  if (url) window.open(url, '_blank'); else toast('Document introuvable', 'error');
}

function ctJoursRestants(dateFin) {
  if (!dateFin) return null;
  return Math.ceil((new Date(dateFin + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 86400000);
}

// ── RENDU PRINCIPAL ──
function renderContrats() {
  const all = getContrats();
  const fEmp  = document.getElementById('ctFilterEmploye')?.value || '';
  const fType = document.getElementById('ctFilterType')?.value || '';
  const fStat = document.getElementById('ctFilterStatut')?.value || '';

  let list = all;
  if (fEmp)  list = list.filter(c => String(c.employeId) === fEmp);
  if (fType) list = list.filter(c => c.type === fType);
  if (fStat) list = list.filter(c => (c.statut || 'actif') === fStat);
  list = [...list].sort((a,b) => (b.debut||'').localeCompare(a.debut||''));

  const actifs = all.filter(c => (c.statut || 'actif') === 'actif');
  const cddBientotFini = actifs.filter(c => c.type === 'cdd' && c.fin && ctJoursRestants(c.fin) !== null && ctJoursRestants(c.fin) <= 30 && ctJoursRestants(c.fin) >= 0);
  const essaisEnCours  = actifs.filter(c => c.essai && ctJoursRestants(c.essai) !== null && ctJoursRestants(c.essai) <= 15 && ctJoursRestants(c.essai) >= 0);

  document.getElementById('ctStats').innerHTML = `
    <div class="chx-stat" style="--c:#16a34a"><div class="chx-stat-top"><span class="chx-stat-lbl">Contrats actifs</span></div><div class="chx-stat-num">${actifs.length}</div></div>
    <div class="chx-stat" style="--c:#e85d04"><div class="chx-stat-top"><span class="chx-stat-lbl">CDD actifs</span></div><div class="chx-stat-num">${actifs.filter(c=>c.type==='cdd').length}</div></div>
    <div class="chx-stat" style="--c:#ef4444"><div class="chx-stat-top"><span class="chx-stat-lbl">Fins de CDD ≤30j</span></div><div class="chx-stat-num">${cddBientotFini.length}</div></div>
    <div class="chx-stat" style="--c:#8b5cf6"><div class="chx-stat-top"><span class="chx-stat-lbl">Périodes d'essai ≤15j</span></div><div class="chx-stat-num">${essaisEnCours.length}</div></div>`;

  // Alertes
  const alertsEl = document.getElementById('ctAlerts');
  const alerts = [];
  cddBientotFini.forEach(c => alerts.push({ c, txt: `CDD de ${escHtml(ctEmployeNom(c.employeId))} se termine le ${formatDate(c.fin)} (J-${ctJoursRestants(c.fin)})`, color:'#dc2626' }));
  essaisEnCours.forEach(c => alerts.push({ c, txt: `Période d'essai de ${escHtml(ctEmployeNom(c.employeId))} se termine le ${formatDate(c.essai)} (J-${ctJoursRestants(c.essai)})`, color:'#8b5cf6' }));
  alertsEl.innerHTML = alerts.length ? alerts.map(a => `
    <div style="display:flex;align-items:center;gap:.6rem;padding:.6rem .85rem;background:${a.color}10;border:1px solid ${a.color}33;border-radius:10px;margin-bottom:.5rem;cursor:pointer" onclick="openContratModal('${a.c.id}')">
      <span style="font-size:1rem">⚠️</span><span style="font-size:.82rem;font-weight:600;color:${a.color}">${a.txt}</span>
    </div>`).join('') : '';

  const el = document.getElementById('ctList');
  if (!list.length) {
    const vide = (all.length === 0);
    el.innerHTML = `<div class="empty" style="padding:2.5rem;text-align:center"><div style="font-size:2.5rem;margin-bottom:.5rem">📑</div><h3>Aucun contrat${vide?'':' pour ce filtre'}</h3><p>${vide?"Créez le premier contrat d'un employé.":'Aucun contrat ne correspond aux filtres sélectionnés.'}</p>
      ${ctIsCanEdit()&&vide?`<button class="btn btn-primary" style="margin-top:1rem" onclick="openContratModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;margin-right:.3rem"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Nouveau contrat</button>`:''}</div>`;
    return;
  }

  el.innerHTML = `<div class="ctx-grid">${list.map(ctCard).join('')}</div>`;
}

function ctCard(c) {
  const t = CT_TYPES[c.type] || CT_TYPES.cdi;
  const termine = (c.statut || 'actif') === 'termine';
  const jr = c.fin ? ctJoursRestants(c.fin) : null;
  const urgent = c.type !== 'cdi' && jr !== null && jr <= 30 && jr >= 0 && !termine;
  const emp = ctEmployes().find(x => String(x.id) === String(c.employeId));
  const nom = ctEmployeNom(c.employeId);
  const init = emp ? (initials(emp.prenom || '', emp.nom || '') || '?') : '?';
  const canEdit = ctIsCanEdit();

  let periodHtml;
  if (c.fin) {
    const start = new Date(c.debut + 'T00:00:00').getTime();
    const end = new Date(c.fin + 'T00:00:00').getTime();
    let pct = end > start ? Math.round(((Date.now() - start) / (end - start)) * 100) : 100;
    pct = Math.max(0, Math.min(100, pct));
    const lbl = termine ? 'Contrat terminé' : (jr >= 0 ? `${pct}% écoulé · J-${jr}` : 'Échéance dépassée');
    periodHtml = `<div>
      <div class="ctx-period-dates"><span>${formatDate(c.debut)}</span><span>${formatDate(c.fin)}</span></div>
      <div class="ctx-bar"><div class="ctx-bar-fill" style="width:${termine ? 100 : pct}%"></div></div>
      <div class="ctx-period-lbl">${lbl}</div>
    </div>`;
  } else {
    periodHtml = `<div>
      <div class="ctx-period-dates"><span>${formatDate(c.debut)}</span><span>∞</span></div>
      <div class="ctx-bar cdi"></div>
      <div class="ctx-period-lbl">Durée indéterminée</div>
    </div>`;
  }

  const chips = [];
  if (c.heures) chips.push(`<span class="ctx-chip">⏱ ${c.heures}h/sem · ${c.temps === 'partiel' ? 'partiel' : 'plein'}</span>`);
  if (c.poste)  chips.push(`<span class="ctx-chip">💼 ${escHtml(c.poste)}</span>`);
  if (urgent)   chips.push(`<span class="ctx-chip warn">⚠️ Fin dans ${jr}j</span>`);
  if (c.essai && !termine) { const ej = ctJoursRestants(c.essai); if (ej !== null && ej >= 0) chips.push(`<span class="ctx-chip essai">🧪 Essai J-${ej}</span>`); }
  if (c.avenants?.length) chips.push(`<span class="ctx-chip avenant">🔄 ${c.avenants.length} avenant${c.avenants.length > 1 ? 's' : ''}</span>`);

  return `<div class="ctx-card ${termine ? 'termine' : ''}" style="--type:${t.color}">
    <span class="ctx-wm">${escHtml(t.label.slice(0, 3).toUpperCase())}</span>
    <div class="ctx-head">
      <div class="ctx-avatar">${escHtml(init)}</div>
      <div class="ctx-head-text">
        <div class="ctx-name">${escHtml(nom)}</div>
        <div class="ctx-type">${t.label}</div>
      </div>
      <span class="ctx-status ${termine ? 'fini' : 'actif'}">${termine ? 'Terminé' : 'Actif'}</span>
    </div>
    <div class="ctx-body">
      ${periodHtml}
      ${chips.length ? `<div class="ctx-chips">${chips.join('')}</div>` : ''}
    </div>
    ${canEdit ? `<div class="ctx-foot">
      ${c.fichierPath ? `<button class="ctx-btn" onclick="ctOpenFichier('${c.id}')" title="${escHtml(c.fichierNom || 'Document joint')}">📎 Contrat</button>` : ''}
      <span class="sp"></span>
      <button class="ctx-btn primary" onclick="openContratDetail('${c.id}')">📑 Détail</button>
    </div>` : ''}
  </div>`;
}

// ── DÉTAIL — CARTE ANIMÉE ──
function openContratDetail(id) {
  const c = getContrats().find(x => x.id === id);
  if (!c) return;
  const t = CT_TYPES[c.type] || CT_TYPES.cdi;
  const emp = ctEmployes().find(x => String(x.id) === String(c.employeId));
  const nomComplet = ctEmployeNom(c.employeId);
  const init = emp ? (initials(emp.prenom||'', emp.nom||'') || '?') : '?';
  const joursRestants = c.fin ? ctJoursRestants(c.fin) : null;
  const urgent = joursRestants !== null && joursRestants <= 30 && joursRestants >= 0;
  const essaiJours = c.essai ? ctJoursRestants(c.essai) : null;
  const essaiUrgent = essaiJours !== null && essaiJours <= 15 && essaiJours >= 0;
  const statutTermine = (c.statut||'actif') === 'termine';

  const statsHtml = `
    <div class="ctcard-grid">
      <div class="ctcard-stat"><div class="v">${formatDate(c.debut).slice(0,6)}</div><div class="l">Début</div></div>
      <div class="ctcard-stat"><div class="v">${c.heures||'—'}h</div><div class="l">${c.temps==='partiel'?'Temps partiel':'Temps plein'}</div></div>
      <div class="ctcard-stat"><div class="v" style="color:${urgent?'#dc2626':'var(--primary)'}">${c.fin ? formatDate(c.fin).slice(0,6) : '∞'}</div><div class="l">${c.fin?'Échéance':'Durée'}</div></div>
    </div>`;

  const alertHtml = urgent && !statutTermine
    ? `<div class="ctcard-section" style="background:#fef2f2;border-color:#fecaca"><h4 style="color:#dc2626"><span class="ctcard-pulse"></span>Échéance proche</h4><p>Ce contrat se termine le <strong>${formatDate(c.fin)}</strong> — J-${joursRestants}.</p></div>`
    : '';

  const essaiHtml = c.essai
    ? `<div class="ctcard-section" style="${essaiUrgent?'background:#f5f3ff;border-color:#ddd6fe':''}"><h4>🧪 Période d'essai</h4><p>Jusqu'au <strong>${formatDate(c.essai)}</strong>${essaiUrgent?` — J-${essaiJours}`:''}</p></div>`
    : '';

  const posteHtml = c.poste
    ? `<div class="ctcard-section"><h4>💼 Poste</h4><p>${escHtml(c.poste)}</p></div>` : '';

  const notesHtml = c.notes
    ? `<div class="ctcard-section"><h4>📝 Notes</h4><p>${escHtml(c.notes)}</p></div>` : '';

  const avenantsHtml = (c.avenants||[]).length ? `
    <div class="ctcard-section">
      <h4>🔄 Avenants</h4>
      <div class="ctcard-timeline">
        ${c.avenants.map(a => `<div class="ctcard-tl-item"><strong>${formatDate(a.date)}</strong> — ${escHtml(a.texte)}</div>`).join('')}
      </div>
    </div>` : '';

  document.getElementById('ctDocBody').innerHTML = `
    <div class="ctcard-hero" style="background:linear-gradient(135deg,${t.color},${t.color}cc)">
      <div style="display:flex;align-items:center;gap:.9rem;position:relative;z-index:1">
        <div class="ctcard-avatar">${escHtml(init)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:1.05rem">${escHtml(nomComplet)}</div>
          <div style="display:flex;gap:.4rem;margin-top:.3rem">
            <span class="ctcard-badge">${t.label}</span>
            ${statutTermine?'<span class="ctcard-badge">Terminé</span>':''}
          </div>
        </div>
      </div>
    </div>
    ${statsHtml}
    ${alertHtml}
    ${essaiHtml}
    ${posteHtml}
    ${avenantsHtml}
    ${notesHtml}
  `;

  document.getElementById('ctDocEditBtn').onclick = () => { closeModal('modalContratDoc'); openContratModal(c.id); };
  openModal('modalContratDoc');
}

// Recolore l'en-tête du modal selon le type de contrat sélectionné (écho des cartes)
function cmxSyncType() {
  const modalEl = document.querySelector('#modalContrat .cmx-modal');
  if (!modalEl) return;
  const type = document.getElementById('ctType')?.value || 'cdi';
  const t = CT_TYPES[type] || { label: type, color: '#64748b' };
  modalEl.style.setProperty('--type', t.color);
  const badge = document.getElementById('cmxBadge');
  if (badge) badge.textContent = t.label.slice(0, 3).toUpperCase();
  const sub = document.getElementById('cmxSub');
  if (sub) {
    const empSel = document.getElementById('ctEmploye');
    const empNom = (empSel && empSel.value && empSel.selectedIndex >= 0) ? empSel.options[empSel.selectedIndex].text : '';
    sub.textContent = empNom ? `${t.label} · ${empNom}` : t.label;
  }
}

// ── MODAL ──
function openContratModal(id) {
  ctEditId = id || null;
  const c = id ? getContrats().find(x => x.id === id) : null;
  ctAvenants = c?.avenants ? [...c.avenants] : [];

  document.getElementById('ctModalTitle').textContent = c ? 'Modifier le contrat' : 'Nouveau contrat';
  document.getElementById('ctEmploye').value = c?.employeId || '';
  document.getElementById('ctType').value    = c?.type || 'cdi';
  document.getElementById('ctDebut').value   = c?.debut || today();
  document.getElementById('ctFin').value     = c?.fin || '';
  document.getElementById('ctTemps').value   = c?.temps || 'plein';
  document.getElementById('ctHeures').value  = c?.heures || 35;
  document.getElementById('ctEssai').value   = c?.essai || '';
  ctFillPosteSelect(document.getElementById('ctPoste'), c?.poste || '');
  document.getElementById('ctNotes').value   = c?.notes || '';
  const cf = document.getElementById('ctFichier'); if (cf) cf.value = '';
  const cfi = document.getElementById('ctFichierInfo');
  if (cfi) cfi.innerHTML = c?.fichierPath ? `📎 ${escHtml(c.fichierNom || 'Document joint')} — <a href="#" onclick="ctOpenFichier('${c.id}');return false">voir</a>` : '';
  document.getElementById('ctDeleteBtn').style.display = c ? '' : 'none';
  document.getElementById('ctAvenantsSection').style.display = c ? '' : 'none';
  renderAvenantsList();
  cmxSyncType();
  openModal('modalContrat');
}

function renderAvenantsList() {
  const box = document.getElementById('ctAvenantsList');
  if (!box) return;
  box.innerHTML = ctAvenants.length ? ctAvenants.map((a,i) => `
    <div style="display:flex;align-items:center;gap:.5rem;padding:.4rem .6rem;background:var(--g50);border-radius:6px;margin-bottom:.25rem">
      <span style="font-size:.72rem;color:var(--muted);white-space:nowrap">${formatDate(a.date)}</span>
      <span style="font-size:.78rem;flex:1">${escHtml(a.texte)}</span>
      <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="removeAvenant(${i})">✕</button>
    </div>`).join('') : '<div style="font-size:.74rem;color:var(--muted);font-style:italic;padding:.3rem 0">Aucun avenant.</div>';
}

function addAvenant() {
  const txt = document.getElementById('ctAvenantTxt').value.trim();
  if (!txt) return;
  ctAvenants.push({ id: genId(), date: today(), texte: txt });
  document.getElementById('ctAvenantTxt').value = '';
  renderAvenantsList();
}

function removeAvenant(idx) {
  ctAvenants.splice(idx, 1);
  renderAvenantsList();
}

async function saveContrat() {
  const employeId = document.getElementById('ctEmploye').value;
  const debut = document.getElementById('ctDebut').value;
  if (!employeId || !debut) { toast('Employé et date de début obligatoires', 'error'); return; }

  const existing = ctEditId ? getContrats().find(x => x.id === ctEditId) : null;
  const file = document.getElementById('ctFichier')?.files[0];
  if (file && file.size > 5 * 1024 * 1024) { toast('Fichier trop lourd (max 5 Mo)', 'error'); return; }

  const data = {
    id: ctEditId || undefined,
    employeId,
    employeNom: ctEmployeNom(employeId),
    type: document.getElementById('ctType').value,
    debut,
    fin: document.getElementById('ctFin').value,
    temps: document.getElementById('ctTemps').value,
    heures: Number(document.getElementById('ctHeures').value) || 0,
    essai: document.getElementById('ctEssai').value,
    poste: document.getElementById('ctPoste').value.trim(),
    notes: document.getElementById('ctNotes').value.trim(),
    avenants: ctAvenants,
    fichierPath: existing?.fichierPath || '',
    fichierNom: existing?.fichierNom || '',
    statut: ctEditId ? (existing?.statut || 'actif') : 'actif'
  };

  try {
    if (file) {
      const emp = ctEmployes().find(e => String(e.id) === String(employeId));
      const folder = (emp && emp.profileId) ? emp.profileId : Auth.getSession().userId;
      data.fichierPath = await sbUploadJustificatif(file, folder);
      data.fichierNom = file.name;
    }
    const saved = await sbSaveContrat(data);
    if (ctEditId) {
      const idx = _ctCache.findIndex(x => x.id === ctEditId);
      if (idx >= 0) _ctCache[idx] = saved;
      toast('Contrat mis à jour');
    } else {
      _ctCache.unshift(saved);
      toast('Contrat créé ✓', 'success');
    }
    if (typeof auditLog === 'function') auditLog('contrat_save', `Contrat — ${ctEmployeNom(employeId)}`);
    closeModal('modalContrat');
    renderContrats();
  } catch (e) {
    const msg = e?.message || e?.details || JSON.stringify(e) || 'Erreur inconnue';
    toast('Erreur : ' + msg, 'error');
    console.error('[saveContrat]', e);
  }
}

function deleteContrat() {
  if (!ctEditId) return;
  const id = ctEditId;
  confirmDialog('Supprimer ce contrat ?', async () => {
    try {
      await sbDeleteContrat(id);
      _ctCache = _ctCache.filter(x => x.id !== id);
      closeModal('modalContrat');
      renderContrats();
      toast('Contrat supprimé', 'info');
    } catch (e) {
      toast('Erreur : ' + (e?.message || e), 'error');
      console.error('[deleteContrat]', e);
    }
  });
}

// ── INIT ──
async function initContrats() {
  const s = Auth.requireAuth();
  if (!s) return;
  try {
    [_ctCache, _ctEmployesCache] = await Promise.all([sbGetContrats(), sbGetEmployes()]);
  } catch (e) {
    console.error('[initContrats]', e);
    toast('Erreur de chargement', 'error');
  }
  const employes = ctEmployes();
  const opts = employes.map(e => `<option value="${e.id}">${escHtml((e.prenom||'')+' '+(e.nom||''))}</option>`).join('');
  document.getElementById('ctFilterEmploye').innerHTML = '<option value="">Tous les employés</option>' + opts;
  document.getElementById('ctEmploye').innerHTML = '<option value="">— Choisir —</option>' + opts;

  if (!ctIsCanEdit()) { const b = document.getElementById('btnAddContrat'); if (b) b.style.display = 'none'; }
  ['ctFilterEmploye','ctFilterType','ctFilterStatut'].forEach(id => document.getElementById(id)?.addEventListener('change', renderContrats));
  renderContrats();
}
document.addEventListener('DOMContentLoaded', initContrats);
