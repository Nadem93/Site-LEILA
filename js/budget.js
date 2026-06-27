const BUDGET_STATUT_STYLES = {
  en_attente: { bg:'#d9770618', c:'#d97706', l:'En attente' },
  accepte:    { bg:'#0891b218', c:'#0891b2', l:'Accepté · justificatif attendu' },
  justifie:   { bg:'#16a34a18', c:'#16a34a', l:'Justifié' },
  refuse:     { bg:'#ef444418', c:'#ef4444', l:'Refusé' }
};

let _budgetEnveloppesCache = [];
let _budgetDemandesCache = [];
let _budgetResidentsCache = [];

async function loadBudgetData() {
  [_budgetEnveloppesCache, _budgetDemandesCache, _budgetResidentsCache] = await Promise.all([
    sbGetBudgetEnveloppes(), sbGetBudgetDemandes(), sbGetResidents()
  ]);
}

function getBudgetEnveloppes() { return _budgetEnveloppesCache; }
function getBudgetDemandes() { return _budgetDemandesCache; }

function budgetFmtMontant(n) {
  return (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function budgetFmtSize(b) {
  if (!b) return '';
  if (b < 1024) return b + ' o';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' Ko';
  return (b / (1024 * 1024)).toFixed(1) + ' Mo';
}

function budgetCurrentUser() {
  const session = Auth.getSession();
  if (!session) return { employeId: 'anon', employeNom: 'Inconnu' };
  const users = DB.get(DB.keys.users) || [];
  const user = users.find(u => String(u.id) === String(session.userId));
  const prenom = user?.prenom || session.prenom || '';
  const nom = user?.nom || session.nom || '';
  const employes = DB.get(DB.keys.employes) || [];
  const emp = employes.find(e => prenom && nom && e.prenom === prenom && e.nom === nom);
  return {
    employeId: emp ? emp.id : 'u' + session.userId,
    employeNom: [prenom, nom].filter(Boolean).join(' ') || session.username
  };
}

function budgetEnveloppeUtilise(enveloppeId) {
  return getBudgetDemandes().filter(d => d.enveloppeId === enveloppeId && (d.statut === 'accepte' || d.statut === 'justifie'))
    .reduce((s, d) => s + (Number(d.montant) || 0), 0);
}

async function initBudget() {
  const s = Auth.requireAuth();
  if (!s) return;
  if (!requireModule('access_budget')) return;
  if (Auth.isAdmin()) {
    const empSel = document.getElementById('bgFiltreEmploye');
    if (empSel) empSel.style.display = '';
  }
  await loadBudgetData();
  renderBudget();
}

// ── ENVELOPPES ──
function openEnveloppeModal(id) {
  const enveloppes = getBudgetEnveloppes();
  const env = id ? enveloppes.find(e => e.id === id) : null;
  const html = `<div class="modal-overlay" id="modalBudgetEnv" style="display:flex" onclick="closeModal('modalBudgetEnv')">
    <div class="modal" style="max-width:440px" onclick="event.stopPropagation()">
      <div class="modal-header"><span class="modal-title">${env ? '✎ Modifier l’enveloppe' : '📁 Nouvelle enveloppe budgétaire'}</span><button class="modal-close" onclick="closeModal('modalBudgetEnv')">&times;</button></div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:.75rem">
        <div class="form-group"><label>Nom *</label><input type="text" id="benvNom" class="form-input" value="${env ? escHtml(env.nom) : ''}" placeholder="Ex: Activités éducatives"/></div>
        <div class="form-group"><label>Montant alloué (€) *</label><input type="number" id="benvMontant" class="form-input" min="0" step="0.01" value="${env ? env.montant : ''}"/></div>
        <div class="form-group"><label>Description</label><textarea id="benvDescription" class="form-input" rows="2">${env ? escHtml(env.description || '') : ''}</textarea></div>
      </div>
      <div class="modal-footer">
        ${env ? `<button class="btn btn-ghost" style="color:var(--red);margin-right:auto" onclick="deleteEnveloppe('${env.id}')">🗑 Supprimer</button>` : ''}
        <button class="btn btn-ghost" onclick="closeModal('modalBudgetEnv')">Annuler</button>
        <button class="btn btn-primary" onclick="saveEnveloppe('${env ? env.id : ''}')">💾 Enregistrer</button>
      </div>
    </div>
  </div>`;
  const old = document.getElementById('modalBudgetEnv');
  if (old) old.remove();
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div);
  requestAnimationFrame(() => document.getElementById('modalBudgetEnv')?.classList.add('open'));
}

async function saveEnveloppe(id) {
  const nom = document.getElementById('benvNom').value.trim();
  const montant = parseFloat(document.getElementById('benvMontant').value);
  const description = document.getElementById('benvDescription').value.trim();
  if (!nom) { toast('Le nom est requis', 'error'); return; }
  if (isNaN(montant) || montant < 0) { toast('Montant invalide', 'error'); return; }
  try {
    const saved = await sbSaveBudgetEnveloppe({ id: id || undefined, nom, montant, description });
    if (id) {
      const idx = _budgetEnveloppesCache.findIndex(e => e.id === id);
      if (idx !== -1) _budgetEnveloppesCache[idx] = saved;
      toast('Enveloppe mise à jour');
    } else {
      _budgetEnveloppesCache.push(saved);
      toast('Enveloppe créée');
    }
  } catch (e) {
    toast('Erreur lors de l\'enregistrement', 'error');
    console.error(e);
    return;
  }
  if (typeof auditLog === 'function') auditLog('budget_enveloppe', nom);
  closeModal('modalBudgetEnv');
  document.getElementById('modalBudgetEnv')?.remove();
  renderBudget();
}

async function deleteEnveloppe(id) {
  if (!confirm('Supprimer cette enveloppe ? Les demandes associées seront conservées.')) return;
  try {
    await sbDeleteBudgetEnveloppe(id);
  } catch (e) {
    toast('Erreur lors de la suppression', 'error');
    console.error(e);
    return;
  }
  _budgetEnveloppesCache = _budgetEnveloppesCache.filter(e => e.id !== id);
  closeModal('modalBudgetEnv');
  document.getElementById('modalBudgetEnv')?.remove();
  toast('Enveloppe supprimée', 'info');
  renderBudget();
}

const BUDGET_ENV_THEMES = [
  { icon: '🎓', c1: '#7c3aed', c2: '#c4b5fd', track: '#ede9fe', bg: '#ede9fe' },
  { icon: '🧩', c1: '#ef4444', c2: '#fca5a5', track: '#fee2e2', bg: '#fee2e2' },
  { icon: '🚗', c1: '#f59e0b', c2: '#fde68a', track: '#fef3c7', bg: '#fef3c7' },
  { icon: '🔧', c1: '#3b82f6', c2: '#bfdbfe', track: '#dbeafe', bg: '#dbeafe' },
  { icon: '🌴', c1: '#16a34a', c2: '#86efac', track: '#dcfce7', bg: '#dcfce7' }
];

function renderEnveloppes() {
  const list = getBudgetEnveloppes();
  const el = document.getElementById('bgEnveloppesList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div class="empty" style="padding:1.5rem;text-align:center"><p>Aucune enveloppe budgétaire définie.</p></div>';
    return;
  }
  const demandes = getBudgetDemandes();
  const isAdmin = Auth.isAdmin();
  el.innerHTML = list.map((env, i) => {
    const utilise = budgetEnveloppeUtilise(env.id);
    const total = Number(env.montant) || 0;
    const pct = total > 0 ? Math.min(100, Math.round(utilise / total * 100)) : 0;
    const over = utilise > total;
    const theme = BUDGET_ENV_THEMES[i % BUDGET_ENV_THEMES.length];
    const c1 = over ? '#dc2626' : theme.c1;
    const c2 = over ? '#fca5a5' : theme.c2;
    const liees = demandes.filter(d => d.enveloppeId === env.id && (d.statut === 'accepte' || d.statut === 'en_attente'));
    const lieesHtml = liees.length
      ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;background:var(--g50);border-radius:8px;padding:.5rem .75rem">
          <span style="font-size:.8rem;color:var(--text)">⏳ ${liees.length} demande${liees.length>1?'s':''} en attente de ticket ou de remboursement</span>
          <button class="btn btn-outline btn-sm" style="font-size:.72rem;padding:2px 10px;flex-shrink:0" onclick="voirDemandesEnveloppe('${env.id}')">Voir</button>
        </div>`
      : `<div style="font-size:.74rem;color:var(--muted)">Aucune demande en attente de ticket ou de remboursement.</div>`;
    return `<div style="width:100%;box-sizing:border-box;background:#fff;border:1px solid var(--border);border-radius:14px;padding:1.1rem 1.25rem;box-shadow:0 2px 10px rgba(15,43,74,.06);border-top:3px solid ${c1}">
      <div style="display:flex;align-items:center;gap:1rem">
        <div style="width:52px;height:52px;border-radius:14px;background:${theme.bg};display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0">${theme.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.92rem;color:var(--text)">${escHtml(env.nom)}</div>
          ${env.description ? `<div style="font-size:.76rem;color:var(--muted);margin-bottom:.5rem">${escHtml(env.description)}</div>` : ''}
          <div style="height:8px;border-radius:99px;background:${theme.track};overflow:hidden">
            <div style="height:100%;border-radius:99px;width:${pct}%;min-width:${pct>0?'6px':'0'};background:linear-gradient(90deg,${c1},${c2});transition:width 1s ease"></div>
          </div>
          <div style="font-size:.78rem;color:${c1};font-weight:600;margin-top:.4rem">${budgetFmtMontant(utilise)} dépensés (${pct}%)</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-weight:700;font-size:1rem;color:var(--text)">${budgetFmtMontant(Math.max(0, total - utilise))}</div>
          <div style="font-size:.76rem;color:var(--muted);white-space:nowrap">restants sur ${budgetFmtMontant(total)}</div>
        </div>
        <button class="admin-only btn btn-ghost btn-sm" style="width:34px;height:34px;border-radius:50%;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:0" onclick="openEnveloppeModal('${env.id}')" title="Modifier">›</button>
      </div>
      <div style="margin-top:.75rem;display:flex;flex-direction:column;gap:.5rem">${lieesHtml}</div>
    </div>`;
  }).join('');
}

function voirDemandesEnveloppe(envId) {
  const sel = document.getElementById('bgFiltreEnveloppe');
  if (sel) sel.value = envId;
  renderBudget();
  document.getElementById('bgList')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── NOUVELLE DEMANDE ──
function openNouvelleDemandeBudget() {
  document.getElementById('bgFormMontant').value = '';
  document.getElementById('bgFormDate').value = today();
  document.getElementById('bgFormMotif').value = '';
  document.getElementById('bgMotifCount').textContent = '0';
  document.getElementById('bgFormPartage50').checked = false;
  document.getElementById('bgFormProjetInput').value = '';
  window._pendingProjetFiles = [];
  renderBudgetProjetFiles();
  const sel = document.getElementById('bgFormEnveloppe');
  const enveloppes = getBudgetEnveloppes();
  sel.innerHTML = '<option value="">Sélectionner une enveloppe</option>' + enveloppes.map(e => `<option value="${e.id}">${escHtml(e.nom)}</option>`).join('');
  const residents = _budgetResidentsCache.filter(r => r.statut !== 'sorti')
    .sort((a,b) => `${a.nom||''}`.localeCompare(`${b.nom||''}`,'fr'));
  const resBox = document.getElementById('bgFormResidents');
  if (resBox) resBox.innerHTML = residents.map(r => `
    <label class="bg-res-chip" style="display:inline-flex;align-items:center;font-size:.78rem;font-weight:600;padding:.35rem .7rem;border:1px solid var(--border);border-radius:99px;cursor:pointer;transition:.15s">
      <input type="checkbox" class="bg-res-check" value="${r.id}" style="display:none" onchange="updateBgResidentChipStyle(this);updateBgPrixParPersonne()"/>
      ${escHtml((r.prenom||'')+' '+(r.nom||''))}
    </label>`).join('') || '<span style="font-size:.78rem;color:var(--muted)">Aucun résident actif.</span>';
  updateBgPrixParPersonne();
  openModal('modalBudgetDemande');
}

function updateBgResidentChipStyle(checkbox) {
  const chip = checkbox.closest('.bg-res-chip');
  if (!chip) return;
  if (checkbox.checked) {
    chip.style.borderColor = '#4338ca';
    chip.style.background = '#eef2ff';
    chip.style.color = '#4338ca';
  } else {
    chip.style.borderColor = 'var(--border)';
    chip.style.background = '';
    chip.style.color = '';
  }
}

function handleBudgetProjetSelect(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  window._pendingProjetFiles = window._pendingProjetFiles || [];
  Promise.all(files.map(f => fileToBase64(f).then(data => ({ id: genId(), nom: f.name, data })))).then(items => {
    window._pendingProjetFiles.push(...items);
    renderBudgetProjetFiles();
  });
  e.target.value = '';
}

function removeBudgetProjetFile(id) {
  window._pendingProjetFiles = (window._pendingProjetFiles || []).filter(f => f.id !== id);
  renderBudgetProjetFiles();
}

function renderBudgetProjetFiles() {
  const box = document.getElementById('bgFormProjetFiles');
  if (!box) return;
  const files = window._pendingProjetFiles || [];
  box.innerHTML = files.map(f => `
    <div style="display:flex;align-items:center;gap:.5rem;font-size:.78rem;background:var(--g50);border-radius:8px;padding:.4rem .6rem;margin-bottom:.3rem">
      <span>📄</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(f.nom)}</span>
      <button type="button" class="btn btn-ghost btn-sm" style="padding:2px 6px" onclick="removeBudgetProjetFile('${f.id}')">✕</button>
    </div>`).join('');
}

function updateBgPrixParPersonne() {
  const el = document.getElementById('bgPrixParPersonne');
  const montant = parseFloat(document.getElementById('bgFormMontant').value) || 0;
  const checked = Array.from(document.querySelectorAll('#bgFormResidents .bg-res-check:checked'));
  const nb = checked.length;
  if (el) {
    if (nb > 0 && montant > 0) {
      el.style.display = 'flex';
      el.querySelector('strong').textContent = budgetFmtMontant(montant / nb) + ` (${nb} résident${nb>1?'s':''})`;
    } else {
      el.style.display = 'none';
    }
  }

  const partageEl = document.getElementById('bgPartageDetail');
  const partage50 = document.getElementById('bgFormPartage50')?.checked;
  if (!partageEl) return;
  if (partage50 && montant > 0) {
    const partFoyer = montant * 0.5;
    const partResident = montant * 0.5;
    const parPersonne = nb > 0 ? partResident / nb : partResident;
    partageEl.style.display = '';
    partageEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-weight:600"><span>🏠 Part foyer (50%)</span><span>${budgetFmtMontant(partFoyer)}</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:600;color:#b45309;margin-top:.25rem"><span>👤 Part résident(s) (50%)</span><span>${budgetFmtMontant(partResident)}</span></div>
      ${nb > 0 ? `<div style="font-size:.74rem;color:var(--muted);margin-top:.25rem">Soit ${budgetFmtMontant(parPersonne)} à rembourser par résident (${nb})</div>` : `<div style="font-size:.74rem;color:var(--red);margin-top:.25rem">⚠️ Sélectionnez au moins un résident pour répartir sa part.</div>`}`;
  } else {
    partageEl.style.display = 'none';
  }
}

async function saveBudgetDemande() {
  const enveloppeId = document.getElementById('bgFormEnveloppe').value;
  const env = getBudgetEnveloppes().find(e => e.id === enveloppeId);
  const montant = parseFloat(document.getElementById('bgFormMontant').value);
  const dateDepense = document.getElementById('bgFormDate').value;
  const motif = document.getElementById('bgFormMotif').value.trim();
  if (!enveloppeId) { toast('Enveloppe requise', 'error'); return; }
  if (!montant || montant <= 0) { toast('Montant invalide', 'error'); return; }
  if (!dateDepense) { toast('Date de la dépense requise', 'error'); return; }
  if (!motif) { toast('Motif requis', 'error'); return; }
  const cu = budgetCurrentUser();
  const residents = _budgetResidentsCache;
  const checked = document.querySelectorAll('#bgFormResidents .bg-res-check:checked');
  const residentIds = Array.from(checked).map(c => c.value);
  const residentNoms = residentIds.map(id => { const r = residents.find(x => String(x.id) === String(id)); return r ? `${r.prenom||''} ${r.nom||''}`.trim() : ''; }).filter(Boolean);
  const partage50 = document.getElementById('bgFormPartage50').checked;
  let remboursements = [];
  if (partage50 && residentIds.length) {
    const partParPersonne = (montant * 0.5) / residentIds.length;
    remboursements = residentIds.map((id, i) => ({ residentId: id, residentNom: residentNoms[i] || '', montantDu: partParPersonne, paye: false, datePaiement: null }));
  }
  const projetDocuments = (window._pendingProjetFiles || []).map(f => ({ nom: f.nom, data: f.data }));
  try {
    const saved = await sbSaveBudgetDemande({
      employeId: cu.employeId, employeNom: cu.employeNom,
      enveloppeId: env ? env.id : '', enveloppeNom: env ? env.nom : '',
      montant, motif, dateDepense,
      residentIds, residentNoms,
      partage50, partFoyer: partage50 ? montant * 0.5 : 0, partResident: partage50 ? montant * 0.5 : 0,
      remboursements,
      projetDocuments,
      justificatifs: [],
      statut: 'en_attente', dateDemande: new Date().toISOString()
    });
    _budgetDemandesCache.unshift(saved);
  } catch (e) {
    toast('Erreur lors de l\'enregistrement', 'error');
    console.error(e);
    return;
  }
  if (typeof auditLog === 'function') auditLog('budget_demande', `Nouvelle demande — ${cu.employeNom} — ${budgetFmtMontant(montant)}`);
  toast('Demande de remboursement envoyée ✓', 'success');
  window._pendingProjetFiles = [];
  closeModal('modalBudgetDemande');
  renderBudget();
}

// ── VALIDATION / REFUS ──
async function repondreBudgetDemande(id, statut) {
  const item = getBudgetDemandes().find(d => d.id === id);
  if (!item) return;
  if (statut === 'refuse') {
    const motif = prompt('Motif du refus :');
    if (motif === null) return;
    item.reponseMotif = motif.trim() || '';
  } else {
    item.reponseMotif = '';
  }
  item.statut = statut;
  item.traitePar = (() => { const s = Auth.getSession(); return s ? [s.prenom, s.nom].filter(Boolean).join(' ') || s.username : ''; })();
  item.dateTraitement = new Date().toISOString();
  try {
    const saved = await sbSaveBudgetDemande(item);
    const idx = _budgetDemandesCache.findIndex(d => d.id === id);
    if (idx !== -1) _budgetDemandesCache[idx] = saved;
  } catch (e) { toast('Erreur lors de l\'enregistrement', 'error'); console.error(e); return; }
  toast('Demande ' + (statut === 'accepte' ? 'acceptée' : 'refusée'), 'success');
  if (typeof auditLog === 'function') auditLog('budget_' + statut, item.employeNom + ' — ' + budgetFmtMontant(item.montant));
  renderBudget();
}

async function supprimerBudgetDemande(id) {
  if (!confirm('Supprimer cette demande ?')) return;
  try {
    await sbDeleteBudgetDemande(id);
  } catch (e) { toast('Erreur lors de la suppression', 'error'); console.error(e); return; }
  _budgetDemandesCache = _budgetDemandesCache.filter(d => d.id !== id);
  toast('Demande supprimée', 'info');
  renderBudget();
}

// ── REMBOURSEMENT RÉSIDENT (partage 50/50) ──
// Une demande en partage 50/50 ne peut être clôturée que si TOUS les résidents
// concernés ont remboursé leur part ET qu'un ticket/justificatif a été fourni.
function budgetEstPretACloturer(d) {
  const hasJustif = (d.justificatifs || []).length > 0;
  const tousRembourses = !d.partage50 || (Array.isArray(d.remboursements) && d.remboursements.length > 0 && d.remboursements.every(r => r.paye));
  return hasJustif && tousRembourses;
}

async function syncRemboursementResidentBudget(d, r) {
  const resident = _budgetResidentsCache.find(x => String(x.id) === String(r.residentId));
  if (!resident) return;
  resident.budget = resident.budget || { operations: [] };
  resident.budget.operations = resident.budget.operations || [];
  const opId = 'bgremb-' + d.id + '-' + r.residentId;
  resident.budget.operations = resident.budget.operations.filter(o => o.id !== opId);
  if (r.paye) {
    resident.budget.operations.push({
      id: opId, type: 'depense', montant: r.montantDu, date: r.datePaiement || today(),
      categorie: 'Activité éducative', libelle: 'Remboursement — ' + (d.enveloppeNom || d.motif || 'activité éducative'),
      notes: d.motif || ''
    });
  }
  const saved = await sbSaveResident(resident);
  const idx = _budgetResidentsCache.findIndex(x => x.id === resident.id);
  if (idx !== -1) _budgetResidentsCache[idx] = saved;
}

async function marquerRemboursementResident(demandeId, residentId) {
  const d = getBudgetDemandes().find(x => x.id === demandeId);
  if (!d || !Array.isArray(d.remboursements)) return;
  const r = d.remboursements.find(x => String(x.residentId) === String(residentId));
  if (!r) return;
  r.paye = !r.paye;
  r.datePaiement = r.paye ? today() : null;
  try {
    await syncRemboursementResidentBudget(d, r);
  } catch (e) { toast('Erreur lors de l\'enregistrement', 'error'); console.error(e); return; }
  if (budgetEstPretACloturer(d) && d.statut === 'accepte') {
    d.statut = 'justifie';
    d.dateJustifie = new Date().toISOString();
    toast('Remboursements complets et ticket fourni — demande clôturée ✓', 'success');
  } else if (!budgetEstPretACloturer(d) && d.statut === 'justifie') {
    // Un remboursement a été décoché après clôture : on rouvre la demande
    d.statut = 'accepte';
    toast('Remboursement annulé — demande réouverte', 'info');
  } else {
    toast(r.paye ? 'Remboursement enregistré' : 'Remboursement annulé', 'info');
  }
  try {
    const saved = await sbSaveBudgetDemande(d);
    const idx = _budgetDemandesCache.findIndex(x => x.id === demandeId);
    if (idx !== -1) _budgetDemandesCache[idx] = saved;
  } catch (e) { toast('Erreur lors de l\'enregistrement', 'error'); console.error(e); return; }
  renderBudget();
}

// ── JUSTIFICATIFS ──
function ajouterJustificatifDemande(demandeId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,.pdf';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast('Fichier trop lourd (max 3 Mo)', 'error'); return; }
    let data;
    try { data = await fileToBase64(file); } catch { toast('Erreur de lecture du fichier', 'error'); return; }
    const d = getBudgetDemandes().find(x => x.id === demandeId);
    if (!d) return;
    d.justificatifs = [...(d.justificatifs || []), { id: genId(), name: file.name, mimeType: file.type, size: file.size, data }];
    if (budgetEstPretACloturer(d)) {
      d.statut = 'justifie';
      d.dateJustifie = new Date().toISOString();
      toast('Justificatif ajouté ✓ Demande clôturée', 'success');
    } else {
      toast('Justificatif ajouté — en attente du remboursement complet des résidents pour clôturer', 'info');
    }
    try {
      const saved = await sbSaveBudgetDemande(d);
      const idx = _budgetDemandesCache.findIndex(x => x.id === demandeId);
      if (idx !== -1) _budgetDemandesCache[idx] = saved;
    } catch (e) { toast('Erreur lors de l\'enregistrement', 'error'); console.error(e); return; }
    if (typeof auditLog === 'function') auditLog('budget_justificatif', `${d.employeNom} — ${budgetFmtMontant(d.montant)}`);
    renderBudget();
  };
  input.click();
}

function voirJustificatif(demandeId, idx) {
  const d = getBudgetDemandes().find(x => x.id === demandeId);
  const j = d?.justificatifs?.[idx];
  if (!j) return;
  document.getElementById('bgJustifTitle').textContent = j.name;
  const body = document.getElementById('bgJustifBody');
  if ((j.mimeType || '').startsWith('image/')) {
    body.innerHTML = `<img src="${j.data}" alt="${escHtml(j.name)}" style="max-width:100%;border-radius:8px"/>`;
  } else {
    body.innerHTML = `<div style="padding:1.5rem"><div style="font-size:2.2rem;margin-bottom:.5rem">📎</div><p>${escHtml(j.name)}</p><a href="${j.data}" download="${escHtml(j.name)}" class="btn btn-primary">⬇ Télécharger</a></div>`;
  }
  openModal('modalBudgetJustif');
}

// ── AFFICHAGE D'UNE DEMANDE ──
function budgetItemHtml(d, isAdmin) {
  const st = BUDGET_STATUT_STYLES[d.statut] || BUDGET_STATUT_STYLES.en_attente;
  const cu = budgetCurrentUser();
  const canRepondre = isAdmin && d.statut === 'en_attente';
  const isOwner = String(d.employeId) === String(cu.employeId);
  const canAddJustif = d.statut === 'accepte' && (isOwner || isAdmin);
  const justifs = (d.justificatifs || []).map((j, i) => `<button class="btn btn-outline btn-sm" style="font-size:.7rem;padding:1px 8px" onclick="voirJustificatif('${d.id}',${i})">📎 ${escHtml(j.name)}</button>`).join(' ');
  const remboursements = d.partage50 ? (d.remboursements || []) : [];
  const tousRembourses = remboursements.length > 0 && remboursements.every(r => r.paye);
  const hasJustif = (d.justificatifs || []).length > 0;
  const closingBlockers = [];
  if (d.partage50 && !tousRembourses) closingBlockers.push('le remboursement complet des résidents');
  if (!hasJustif) closingBlockers.push('le ticket/justificatif');
  const partageHtml = d.partage50 ? `
    <div style="margin-top:.4rem;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:.5rem .65rem">
      <div style="display:flex;justify-content:space-between;font-size:.74rem;font-weight:700;color:#b45309;margin-bottom:.35rem">
        <span>🏠 Partage 50/50</span>
        <span>Foyer ${budgetFmtMontant(d.partFoyer)} · Résidents ${budgetFmtMontant(d.partResident)}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:.25rem">
        ${remboursements.map(r => `<label title="${r.paye && r.datePaiement ? 'Remboursé le ' + escHtml(formatDate(r.datePaiement)) : ''}" style="display:inline-flex;align-items:center;gap:.22rem;font-size:.64rem;padding:.12rem .4rem;border-radius:99px;background:${r.paye?'#dcfce7':'#fff'};border:1px solid ${r.paye?'#86efac':'#fed7aa'};cursor:${isAdmin?'pointer':'default'}">
          <input type="checkbox" ${r.paye?'checked':''} ${isAdmin?'':'disabled'} onchange="marquerRemboursementResident('${d.id}','${r.residentId}')" style="width:10px;height:10px;flex-shrink:0"/>
          <span style="${r.paye?'text-decoration:line-through;color:var(--muted)':''}">${escHtml(r.residentNom)} — ${budgetFmtMontant(r.montantDu)}</span>
        </label>`).join('')}
      </div>
      ${!isAdmin ? `<div style="font-size:.68rem;color:var(--muted);margin-top:.2rem">Seul un admin peut confirmer la réception du remboursement.</div>` : ''}
    </div>` : '';
  return `<div style="width:100%;box-sizing:border-box;display:flex;align-items:flex-start;gap:.75rem;padding:.85rem 1rem;background:#fff;border-radius:10px;margin-bottom:6px;box-shadow:0 2px 6px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04)">
    <span style="font-size:1.2rem;margin-top:2px;flex-shrink:0">💶</span>
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
        <span style="font-weight:600;font-size:.85rem">${escHtml(d.employeNom)}</span>
        <span style="padding:1px 8px;border-radius:99px;font-size:.68rem;font-weight:700;background:${st.bg};color:${st.c}">${st.l}</span>
        <span style="font-weight:700;font-size:.85rem">${budgetFmtMontant(d.montant)}</span>
        ${d.enveloppeNom ? `<span style="font-size:.7rem;color:var(--g400)">${escHtml(d.enveloppeNom)}</span>` : ''}
      </div>
      <div style="font-size:.76rem;color:var(--muted);margin-top:.2rem">
        Dépense du ${formatDate(d.dateDepense)} · Demandé le ${new Date(d.dateDemande).toLocaleDateString('fr-FR')}
      </div>
      ${d.motif ? `<div style="font-size:.75rem;color:var(--g600);margin-top:.25rem">${escHtml(d.motif)}</div>` : ''}
      ${(d.residentNoms||[]).length && !d.partage50 ? `<div style="margin-top:.3rem;display:flex;gap:.3rem;flex-wrap:wrap">${d.residentNoms.map(n => `<span style="font-size:.68rem;font-weight:600;padding:1px 8px;border-radius:99px;background:#eef2ff;color:#4338ca">🧑 ${escHtml(n)}</span>`).join('')}</div>` : ''}
      ${partageHtml}
      ${canAddJustif && closingBlockers.length ? `<div class="ctdoc-alert" style="background:#dbeafe;border:1px solid #93c5fd;color:#1d4ed8;font-size:.74rem;padding:.4rem .6rem;border-radius:6px;margin-top:.4rem">⏳ En attente de ${closingBlockers.join(' et de ')} pour clôturer.</div>` : ''}
      ${justifs ? `<div style="margin-top:.4rem;display:flex;gap:.35rem;flex-wrap:wrap">${justifs}</div>` : ''}
      ${d.statut === 'refuse' && d.reponseMotif ? `<div style="font-size:.73rem;color:var(--red);margin-top:.15rem">Motif du refus : ${escHtml(d.reponseMotif)}</div>` : ''}
      ${d.traitePar ? `<div style="font-size:.7rem;color:var(--muted);margin-top:.1rem">Traité par ${escHtml(d.traitePar)}</div>` : ''}
    </div>
    <div style="display:flex;gap:.25rem;flex-shrink:0">
      ${canRepondre ? `<button class="btn btn-ghost btn-sm" style="color:#16a34a;font-size:.72rem;padding:2px 10px" onclick="repondreBudgetDemande('${d.id}','accepte')">✅ Accepter</button>
      <button class="btn btn-ghost btn-sm" style="color:#ef4444;font-size:.72rem;padding:2px 10px" onclick="repondreBudgetDemande('${d.id}','refuse')">❌ Refuser</button>` : ''}
      ${canAddJustif ? `<button class="btn btn-primary btn-sm" style="font-size:.72rem;padding:2px 10px" onclick="ajouterJustificatifDemande('${d.id}')">📎 Ajouter le ticket</button>` : ''}
      ${isAdmin ? `<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="supprimerBudgetDemande('${d.id}')">✕</button>` : ''}
    </div>
  </div>`;
}

// ── RENDU PRINCIPAL ──
function renderBudget() {
  const isAdmin = Auth.isAdmin();
  const cu = budgetCurrentUser();
  const list = getBudgetDemandes();
  const enveloppes = getBudgetEnveloppes();

  const envSel = document.getElementById('bgFiltreEnveloppe');
  if (envSel) {
    const current = envSel.value;
    envSel.innerHTML = '<option value="">Toutes les enveloppes</option>' + enveloppes.map(e => `<option value="${e.id}">${escHtml(e.nom)}</option>`).join('');
    envSel.value = current;
  }

  if (isAdmin) {
    const empSel = document.getElementById('bgFiltreEmploye');
    if (empSel) {
      const current = empSel.value;
      const employesMap = new Map();
      list.forEach(d => { if (d.employeId && !employesMap.has(d.employeId)) employesMap.set(d.employeId, d.employeNom); });
      empSel.innerHTML = '<option value="">Tous les employés</option>' + Array.from(employesMap.entries()).map(([id, nom]) => `<option value="${id}">${escHtml(nom)}</option>`).join('');
      empSel.value = current;
    }
  }

  const filtreStatut = document.getElementById('bgFiltreStatut')?.value || '';
  const filtreEnveloppe = document.getElementById('bgFiltreEnveloppe')?.value || '';
  const filtreEmploye = document.getElementById('bgFiltreEmploye')?.value || '';

  let filtered = list;
  if (!isAdmin) filtered = filtered.filter(d => d.employeId === cu.employeId);
  if (filtreStatut) filtered = filtered.filter(d => d.statut === filtreStatut);
  if (filtreEnveloppe) filtered = filtered.filter(d => d.enveloppeId === filtreEnveloppe);
  if (isAdmin && filtreEmploye) filtered = filtered.filter(d => d.employeId === filtreEmploye);

  const statsSource = isAdmin ? list : list.filter(d => d.employeId === cu.employeId);
  const enAttente = statsSource.filter(d => d.statut === 'en_attente');
  const acceptes = statsSource.filter(d => d.statut === 'accepte');
  const justifiees = statsSource.filter(d => d.statut === 'justifie');
  const refuses = statsSource.filter(d => d.statut === 'refuse');
  const totalEngage = [...acceptes, ...justifiees].reduce((s, d) => s + (Number(d.montant) || 0), 0);

  document.getElementById('bgStatEnAttente').textContent = enAttente.length;
  document.getElementById('bgStatAcceptes').textContent = acceptes.length;
  document.getElementById('bgStatJustifiees').textContent = justifiees.length;
  document.getElementById('bgStatRefuses').textContent = refuses.length;
  document.getElementById('bgStatTotal').textContent = budgetFmtMontant(totalEngage);

  const pendingCard = document.getElementById('bgPendingCard');
  if (pendingCard) {
    const allEnAttente = list.filter(d => d.statut === 'en_attente');
    if (isAdmin && allEnAttente.length) {
      pendingCard.style.display = '';
      document.getElementById('bgPendingList').innerHTML = allEnAttente
        .sort((a, b) => (a.dateDemande || '').localeCompare(b.dateDemande || ''))
        .map(d => budgetItemHtml(d, isAdmin)).join('');
    } else {
      pendingCard.style.display = 'none';
    }
  }

  const justifCard = document.getElementById('bgJustifCard');
  if (justifCard) {
    const mesAttenteJustif = list.filter(d => d.statut === 'accepte' && String(d.employeId) === String(cu.employeId));
    if (!isAdmin && mesAttenteJustif.length) {
      justifCard.style.display = '';
      document.getElementById('bgJustifList').innerHTML = mesAttenteJustif
        .sort((a, b) => (a.dateTraitement || '').localeCompare(b.dateTraitement || ''))
        .map(d => budgetItemHtml(d, isAdmin)).join('');
    } else {
      justifCard.style.display = 'none';
    }
  }

  renderEnveloppes();

  const el = document.getElementById('bgList');
  if (!filtered.length) {
    el.innerHTML = '<div class="empty" style="padding:3rem;text-align:center"><p>Aucune demande de budget trouvée.</p></div>';
    return;
  }
  el.innerHTML = filtered.sort((a, b) => (b.dateDemande || '').localeCompare(a.dateDemande || '')).map(d => budgetItemHtml(d, isAdmin)).join('');
}

document.addEventListener('DOMContentLoaded', initBudget);
if (typeof registerPageInit === 'function') registerPageInit('budget', initBudget);
