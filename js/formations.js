const FORMATION_DOMAINES = [
  "Sécurité & gestes d'urgence",
  'Accompagnement éducatif & pédagogique',
  'Communication & gestion des conflits',
  'Hygiène, santé & soins',
  'Réglementation & droit des usagers',
  'Numérique & outils professionnels',
  'Management & encadrement',
  'Autre'
];
const FORMATION_STATUT_LABELS = { planifiee: 'Planifiée', realisee: 'Réalisée', annulee: 'Annulée' };
const FORMATION_STATUT_COLORS = { planifiee: '#d97706', realisee: '#16a34a', annulee: '#9ca3af' };

let _frmCache = [];
let _frmEmployesCache = [];

function getFormations() { return _frmCache; }

async function initFormations() {
  if (!requireModule('access_formations')) return;
  try {
    [_frmCache, _frmEmployesCache] = await Promise.all([sbGetFormations(), sbGetEmployes()]);
  } catch (e) {
    console.error('[initFormations]', e);
    toast('Erreur de chargement', 'error');
  }
  renderFormations();
}

function frmEur(n) { return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }

function openFormationModal(id) {
  const isAdmin = Auth.isAdmin();
  if (id && !isAdmin) return;
  const employes = _frmEmployesCache.filter(e => e.statut !== 'inactif');
  const list = getFormations();
  const f = id ? list.find(x => x.id === id) : null;
  if (f && f.statut === 'realisee') { toast('Formation réalisée — repassez-la en « Planifiée » pour la modifier', 'info'); return; }

  document.getElementById('frmModalTitle').textContent = f ? 'Modifier la formation' : 'Nouvelle formation';
  document.getElementById('frmDeleteBtn').style.display = (f && isAdmin) ? '' : 'none';
  document.getElementById('modalFormation').dataset.id = f ? f.id : '';

  document.getElementById('frmFormTitre').value = f ? f.titre : '';
  document.getElementById('frmFormOrganisme').value = f ? f.organisme || '' : '';
  document.getElementById('frmFormDomaine').value = f ? f.domaine : FORMATION_DOMAINES[0];
  document.getElementById('frmFormDateDebut').value = f ? f.dateDebut : today();
  document.getElementById('frmFormDateFin').value = f ? f.dateFin || '' : '';
  document.getElementById('frmFormDuree').value = f ? f.dureeHeures || '' : '';
  document.getElementById('frmFormCout').value = f ? f.cout || '' : '';
  document.getElementById('frmFormMax').value = f ? f.maxParticipants || '' : '';
  document.getElementById('frmFormStatut').value = f ? f.statut : 'planifiee';
  document.getElementById('frmFormNotes').value = f ? f.notes || '' : '';

  const participants = f ? (f.participants || []) : [];
  document.getElementById('frmFormParticipants').innerHTML = employes.length
    ? employes.map(e => `<label style="display:flex;align-items:center;gap:.4rem;font-size:.82rem;font-weight:400;text-transform:none;letter-spacing:0;margin:0">
        <input type="checkbox" value="${e.id}" style="width:auto"${participants.includes(e.id) ? ' checked' : ''}/> ${escHtml(e.prenom)} ${escHtml(e.nom)}
      </label>`).join('')
    : '<div style="font-size:.78rem;color:var(--muted)">Aucun employé enregistré</div>';

  frmModalSync();
  openModal('modalFormation');
}

// En-tête interactif : sous-titre = intitulé saisi + recoloration selon le statut
function frmModalSync() {
  const sub = document.querySelector('#modalFormation .mdx-sub');
  if (sub) {
    const titre = (document.getElementById('frmFormTitre')?.value || '').trim();
    const dom = document.getElementById('frmFormDomaine')?.value || '';
    sub.textContent = titre || dom || 'Formation professionnelle';
  }
  const modalEl = document.querySelector('#modalFormation .modal');
  if (modalEl) {
    const st = document.getElementById('frmFormStatut')?.value || 'planifiee';
    modalEl.style.setProperty('--mc', FORMATION_STATUT_COLORS[st] || '#7c3aed');
  }
}

async function saveFormation() {
  if (!Auth.isAdmin()) { toast('Action réservée aux administrateurs', 'error'); return; }
  const titre = document.getElementById('frmFormTitre').value.trim();
  const dateDebut = document.getElementById('frmFormDateDebut').value;
  if (!titre) { toast('Intitulé requis', 'error'); return; }
  if (!dateDebut) { toast('Date de début requise', 'error'); return; }

  const participants = [...document.querySelectorAll('#frmFormParticipants input[type=checkbox]:checked')].map(c => c.value);
  const id = document.getElementById('modalFormation').dataset.id;

  const data = {
    id: id || undefined,
    titre,
    organisme: document.getElementById('frmFormOrganisme').value.trim(),
    domaine: document.getElementById('frmFormDomaine').value,
    dateDebut,
    dateFin: document.getElementById('frmFormDateFin').value,
    dureeHeures: parseFloat(document.getElementById('frmFormDuree').value) || 0,
    cout: parseFloat(document.getElementById('frmFormCout').value) || 0,
    maxParticipants: parseInt(document.getElementById('frmFormMax').value) || null,
    statut: document.getElementById('frmFormStatut').value,
    participants,
    notes: document.getElementById('frmFormNotes').value.trim()
  };

  try {
    const saved = await sbSaveFormation(data);
    if (id) {
      const idx = _frmCache.findIndex(f => f.id === id);
      if (idx >= 0) _frmCache[idx] = saved;
      toast('Formation mise à jour');
      if (typeof auditLog === 'function') auditLog('formation_update', titre);
    } else {
      _frmCache.unshift(saved);
      toast('Formation ajoutée');
      if (typeof auditLog === 'function') auditLog('formation_create', titre);
    }
    closeModal('modalFormation');
    renderFormations();
  } catch (e) {
    const msg = e?.message || e?.details || JSON.stringify(e) || 'Erreur inconnue';
    toast('Erreur : ' + msg, 'error');
    console.error('[saveFormation]', e);
  }
}

function supprimerFormation(id) {
  if (!Auth.isAdmin()) { toast('Action réservée aux administrateurs', 'error'); return; }
  id = id || document.getElementById('modalFormation').dataset.id;
  if (!id) return;
  confirmDialog('Supprimer cette formation ?', async () => {
    try {
      await sbDeleteFormation(id);
      _frmCache = _frmCache.filter(f => f.id !== id);
      toast('Formation supprimée', 'info');
      closeModal('modalFormation');
      renderFormations();
    } catch (e) {
      toast('Erreur : ' + (e?.message || e), 'error');
      console.error('[supprimerFormation]', e);
    }
  });
}

function frmCurrentEmployeId() {
  const session = Auth.getSession();
  if (!session) return null;
  const emp = _frmEmployesCache.find(e => String(e.profileId) === String(session.userId));
  return emp ? emp.id : null;
}

async function frmInscrire(id) {
  const empId = frmCurrentEmployeId();
  if (!empId) { toast('Votre profil employé est introuvable', 'error'); return; }
  const f = _frmCache.find(x => x.id === id);
  if (!f) return;
  const parts = f.participants || [];
  if (parts.includes(empId)) { toast('Vous êtes déjà inscrit', 'info'); return; }
  if (f.maxParticipants && parts.length >= f.maxParticipants) { toast('Nombre maximum de participants atteint', 'error'); return; }
  try {
    const saved = await sbSetFormationParticipants(id, [...parts, empId]);
    const idx = _frmCache.findIndex(x => x.id === id);
    if (idx >= 0) _frmCache[idx] = saved;
    if (typeof auditLog === 'function') auditLog('formation_inscription', f.titre);
    toast('Inscription confirmée', 'success');
    renderFormations();
  } catch (e) { toast('Erreur : ' + (e?.message || e), 'error'); console.error('[frmInscrire]', e); }
}

async function frmDesinscrire(id) {
  const empId = frmCurrentEmployeId();
  if (!empId) return;
  const f = _frmCache.find(x => x.id === id);
  if (!f) return;
  try {
    const saved = await sbSetFormationParticipants(id, (f.participants || []).filter(p => p !== empId));
    const idx = _frmCache.findIndex(x => x.id === id);
    if (idx >= 0) _frmCache[idx] = saved;
    if (typeof auditLog === 'function') auditLog('formation_desinscription', f.titre);
    toast('Désinscription effectuée', 'info');
    renderFormations();
  } catch (e) { toast('Erreur : ' + (e?.message || e), 'error'); console.error('[frmDesinscrire]', e); }
}

async function frmSetStatut(id, statut) {
  if (!Auth.isAdmin()) return;
  const f = _frmCache.find(x => x.id === id);
  if (!f || f.statut === statut) return;
  try {
    const saved = await sbSaveFormation({ ...f, statut });
    const idx = _frmCache.findIndex(x => x.id === id);
    if (idx >= 0) _frmCache[idx] = saved;
    if (typeof auditLog === 'function') auditLog('formation_statut', `${f.titre} → ${FORMATION_STATUT_LABELS[statut] || statut}`);
    toast('Statut : ' + (FORMATION_STATUT_LABELS[statut] || statut));
    renderFormations();
  } catch (e) { toast('Erreur : ' + (e?.message || e), 'error'); console.error('[frmSetStatut]', e); }
}

function formationItemHtml(f, isAdmin, employesMap) {
  const color = FORMATION_STATUT_COLORS[f.statut] || '#6b7280';
  const label = FORMATION_STATUT_LABELS[f.statut] || f.statut;
  const parts = f.participants || [];
  const noms = parts.map(id => employesMap.get(id) || employesMap.get(String(id))).filter(Boolean);
  const editable = isAdmin && f.statut !== 'realisee';

  // Boutons statut (admin)
  const statutCtrl = `<span class="frx-stbtns" onclick="event.stopPropagation()">${
    Object.keys(FORMATION_STATUT_LABELS).map(st => {
      const active = f.statut === st;
      const c = FORMATION_STATUT_COLORS[st];
      return `<button class="frx-stbtn${active ? ' on' : ''}" onclick="event.stopPropagation();frmSetStatut('${f.id}','${st}')" title="Marquer comme ${FORMATION_STATUT_LABELS[st]}"${active ? ` style="background:${c};border-color:${c};color:#fff"` : ''}>${FORMATION_STATUT_LABELS[st]}</button>`;
    }).join('')
  }</span>`;

  // Bouton inscription (non-admins uniquement)
  let inscriptionBtn = '';
  if (!isAdmin && f.statut === 'planifiee') {
    const dateRef = f.dateFin || f.dateDebut;
    const datePassed = dateRef && dateRef < new Date().toISOString().slice(0, 10);
    const empId = frmCurrentEmployeId();
    const alreadyIn = empId && parts.includes(empId);
    const full = f.maxParticipants && parts.length >= f.maxParticipants && !alreadyIn;
    if (datePassed) inscriptionBtn = `<span class="frx-act muted">Formation terminée</span>`;
    else if (alreadyIn) inscriptionBtn = `<button class="frx-act ok" onclick="event.stopPropagation();frmDesinscrire('${f.id}')">✓ Inscrit · Se désinscrire</button>`;
    else if (full) inscriptionBtn = `<span class="frx-act muted">Complet (${parts.length}/${f.maxParticipants})</span>`;
    else { const pt = f.maxParticipants ? ` · ${parts.length}/${f.maxParticipants}` : ''; inscriptionBtn = `<button class="frx-act primary" onclick="event.stopPropagation();frmInscrire('${f.id}')">S'inscrire${pt}</button>`; }
  }

  const meta = [`📅 ${formatDate(f.dateDebut)}${f.dateFin && f.dateFin !== f.dateDebut ? ' → ' + formatDate(f.dateFin) : ''}`];
  if (f.organisme) meta.push(`🏢 ${escHtml(f.organisme)}`);
  if (f.dureeHeures) meta.push(`⏱ ${f.dureeHeures} h`);
  if (f.cout) meta.push(`💰 ${frmEur(f.cout)}`);

  let capHtml = '';
  if (f.maxParticipants) {
    const pct = Math.min(100, Math.round(parts.length / f.maxParticipants * 100));
    capHtml = `<div><div class="frx-cap-top"><span>Places</span><span>${parts.length}/${f.maxParticipants}</span></div><div class="frx-cap-bar"><div class="frx-cap-fill" style="width:${pct}%"></div></div></div>`;
  }

  let footInner = '';
  if (isAdmin) footInner = `<span class="frx-foot-lbl">Statut</span>${statutCtrl}${f.statut === 'realisee' ? '<span class="frx-sp"></span><span style="font-size:.66rem;color:var(--muted)">🔒 verrouillée</span>' : ''}`;
  else if (inscriptionBtn) footInner = inscriptionBtn;

  return `<article class="frx-card ${f.statut === 'annulee' ? 'annulee' : ''}" style="--ac:${color}"${editable ? ` onclick="openFormationModal('${f.id}')"` : ''}>
    <div class="frx-head">
      <div class="frx-ico">🎓</div>
      <div class="frx-h-txt">
        <div class="frx-title">${escHtml(f.titre)}</div>
        <div class="frx-chips" style="margin-top:.25rem"><span class="frx-chip dom">${escHtml(f.domaine)}</span></div>
      </div>
      ${!isAdmin ? `<span class="frx-status">${escHtml(label)}</span>` : ''}
    </div>
    <div class="frx-meta">${meta.map(m => `<span>${m}</span>`).join('')}</div>
    ${capHtml}
    ${parts.length ? `<div class="frx-names"><b>Inscrits (${parts.length}${f.maxParticipants ? '/' + f.maxParticipants : ''}) :</b> ${noms.length ? noms.map(escHtml).join(', ') : '<span style="color:var(--muted);font-style:italic">noms indisponibles</span>'}</div>` : ''}
    ${f.notes ? `<div class="frx-notes">${escHtml(f.notes)}</div>` : ''}
    ${footInner ? `<div class="frx-foot">${footInner}</div>` : ''}
  </article>`;
}

function renderFormations() {
  const isAdmin = Auth.isAdmin();
  const list = getFormations();
  const employesMap = new Map(_frmEmployesCache.map(e => [e.id, `${e.prenom} ${e.nom}`]));

  // Filtre année
  const anneeSel = document.getElementById('frmFiltreAnnee');
  if (anneeSel) {
    const annees = [...new Set(list.map(f => (f.dateDebut || '').slice(0, 4)).filter(Boolean))].sort().reverse();
    const current = anneeSel.value;
    anneeSel.innerHTML = '<option value="">Toutes les années</option>' + annees.map(a => `<option value="${a}"${current === a ? ' selected' : ''}>${a}</option>`).join('');
  }
  // Filtre domaine
  const domaineSel = document.getElementById('frmFiltreDomaine');
  if (domaineSel) {
    const current = domaineSel.value;
    domaineSel.innerHTML = '<option value="">Tous les domaines</option>' + FORMATION_DOMAINES.map(d => `<option value="${escHtml(d)}"${current === d ? ' selected' : ''}>${escHtml(d)}</option>`).join('');
  }

  const annee = document.getElementById('frmFiltreAnnee')?.value || '';
  const domaine = document.getElementById('frmFiltreDomaine')?.value || '';
  const statut = document.getElementById('frmFiltreStatut')?.value || '';

  let filtered = list;
  if (annee) filtered = filtered.filter(f => (f.dateDebut || '').startsWith(annee));
  if (domaine) filtered = filtered.filter(f => f.domaine === domaine);
  if (statut) filtered = filtered.filter(f => f.statut === statut);

  document.getElementById('frmStatPlanifiees').textContent = filtered.filter(f => f.statut === 'planifiee').length;
  document.getElementById('frmStatRealisees').textContent = filtered.filter(f => f.statut === 'realisee').length;
  document.getElementById('frmStatParticipants').textContent = filtered.reduce((a, f) => a + (f.participants || []).length, 0);
  document.getElementById('frmStatBudget').textContent = frmEur(filtered.filter(f => f.statut !== 'annulee').reduce((a, f) => a + (f.cout || 0), 0));

  const el = document.getElementById('frmList');
  if (!filtered.length) {
    el.innerHTML = '<div class="empty" style="padding:3rem;text-align:center"><p>Aucune formation trouvée.</p></div>';
    return;
  }
  el.innerHTML = `<div class="frx-grid">` + filtered
    .sort((a, b) => (b.dateDebut || '').localeCompare(a.dateDebut || ''))
    .map(f => formationItemHtml(f, isAdmin, employesMap)).join('') + `</div>`;
}

document.addEventListener('DOMContentLoaded', initFormations);
if (typeof registerPageInit === 'function') registerPageInit('formations', initFormations);
