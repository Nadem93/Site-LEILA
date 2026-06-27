// ── TABS ──
function activateTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  ['etablissement','categories','objectifs','fonctions','educateurs','compte','donnees'].forEach(n => {
    const el = document.getElementById('tab-'+n);
    if (el) el.style.display = n === name ? '' : 'none';
  });
}

// ── BRANDING ──
function loadBranding() {
  const b = DB.get(DB.keys.branding) || DEFAULTS.branding;
  document.getElementById('bPrimary').value = b.primaryColor || '#0f2b4a';
  document.getElementById('bAccent').value = b.accentColor || '#e85d04';
  if (b.logo) updateLogoPreview(b.logo);
  loadBgColorInput();
}

// Renseigne le sélecteur de couleur de fond depuis l'établissement courant
function loadBgColorInput() {
  const input = document.getElementById('bBackground');
  if (!input) return;
  const etab = (typeof getCurrentEtab === 'function') ? getCurrentEtab() : null;
  let val = etab && etab.bgColor;
  if (!val) {
    // Aperçu : couleur de base du type d'établissement (1re teinte du dégradé)
    const c = (typeof ETAB_BG !== 'undefined' && etab) ? (ETAB_BG[etab.type] || ETAB_BG['foyer_hebergement']) : null;
    val = c ? c[0] : '#dbeafe';
  }
  input.value = val;
}

function saveBranding() {
  const data = {
    primaryColor: document.getElementById('bPrimary').value,
    accentColor: document.getElementById('bAccent').value,
    logo: DB.get(DB.keys.branding)?.logo || ''
  };
  DB.set(DB.keys.branding, data);
  applyBranding();
  toast('Couleurs appliquées');
}

function resetBranding() {
  const data = { primaryColor:'#0f2b4a', accentColor:'#e85d04', logo:'' };
  DB.set(DB.keys.branding, data);
  document.getElementById('bPrimary').value = data.primaryColor;
  document.getElementById('bAccent').value = data.accentColor;
  applyBranding();
  updateLogoPreview('');
  toast('Couleurs réinitialisées', 'info');
}

// ── LOGO ──
function initLogoUpload() {
  const input = document.getElementById('logoInput');
  if (!input) return;
  input.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { toast('Logo trop lourd (max 1 Mo)', 'error'); return; }
    try {
      const base64 = await fileToBase64(file);
      const b = DB.get(DB.keys.branding) || DEFAULTS.branding;
      b.logo = base64;
      DB.set(DB.keys.branding, b);
      updateLogoPreview(base64);
      applyBranding();
      toast('Logo enregistré');
    } catch { toast('Erreur lors du chargement du logo', 'error'); }
  });
}

function updateLogoPreview(src) {
  const preview = document.getElementById('logoPreview');
  const removeBtn = document.getElementById('logoRemoveBtn');
  if (!preview) return;
  if (src) {
    preview.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:10px" alt="Logo"/>`;
    if (removeBtn) removeBtn.style.display = '';
  } else {
    preview.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--g400)" stroke-width="1.5" style="width:24px;height:24px"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`;
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

function removeLogo() {
  const b = DB.get(DB.keys.branding) || DEFAULTS.branding;
  b.logo = '';
  DB.set(DB.keys.branding, b);
  document.getElementById('logoInput').value = '';
  updateLogoPreview('');
  applyBranding();
  toast('Logo supprimé', 'info');
}

// ── ÉTABLISSEMENT ──
function loadSettings() {
  const s = DB.get(DB.keys.settings) || {};
  document.getElementById('setEtab').value = s.etablissement || '';
  document.getElementById('setVille').value = s.ville || '';
  document.getElementById('setFiness').value = s.finess || '';
  document.getElementById('setTel').value = s.tel || '';
  document.getElementById('setEmail').value = s.email || '';
  document.getElementById('setAdresse').value = s.adresse || '';
  document.getElementById('setCapacite').value = s.capacite || '';
  updatePreview();
}

function updatePreview() {
  document.getElementById('previewNom').textContent = document.getElementById('setEtab').value || '—';
  document.getElementById('previewVille').textContent = document.getElementById('setVille').value || '';
  document.getElementById('previewFiness').textContent = document.getElementById('setFiness').value || '—';
  document.getElementById('previewTel').textContent = document.getElementById('setTel').value || '—';
  document.getElementById('previewEmail').textContent = document.getElementById('setEmail').value || '—';
  const adr = document.getElementById('previewAdresse');
  if (adr) adr.textContent = document.getElementById('setAdresse').value || '—';
}

function saveSettings() {
  const data = {
    etablissement: document.getElementById('setEtab').value.trim(),
    ville: document.getElementById('setVille').value.trim(),
    finess: document.getElementById('setFiness').value.trim(),
    tel: document.getElementById('setTel').value.trim(),
    email: document.getElementById('setEmail').value.trim(),
    adresse: document.getElementById('setAdresse').value.trim(),
    capacite: parseInt(document.getElementById('setCapacite').value) || 0
  };
  DB.set(DB.keys.settings, data);
  updatePreview();
  renderUserInfo();
  toast('Paramètres enregistrés');
}

// ── CATÉGORIES ──
function renderCats() {
  const cats = DB.get(DB.keys.categories) || [];
  const el = document.getElementById('catList');
  if (!cats.length) {
    el.innerHTML = `<div class="empty" style="padding:2rem"><p>Aucune catégorie</p></div>`;
    return;
  }
  el.innerHTML = cats.map(c => `
    <div style="display:flex;align-items:center;gap:.75rem;padding:.85rem 1.25rem;border-bottom:1px solid var(--border)">
      <span style="width:14px;height:14px;border-radius:4px;background:${c.color};flex-shrink:0"></span>
      <span style="flex:1;font-weight:600;font-size:.875rem">${escHtml(c.name)}</span>
      <span class="badge" style="background:${c.color}22;color:${c.color}">${escHtml(c.name)}</span>
      <button class="btn btn-ghost btn-sm" onclick="editCat(${c.id})">Modifier</button>
    </div>`).join('');
}

function editCat(id) {
  const cats = DB.get(DB.keys.categories) || [];
  const c = cats.find(x => x.id === id);
  if (!c) return;
  document.getElementById('modalCatTitle').textContent = 'Modifier la catégorie';
  document.getElementById('catId').value = id;
  document.getElementById('catName').value = c.name;
  document.getElementById('catColor').value = c.color;
  document.getElementById('btnDeleteCat').style.display = '';
  openModal('modalCat');
}

function saveCat() {
  const name = document.getElementById('catName').value.trim();
  if (!name) { toast('Le nom est requis', 'error'); return; }
  const color = document.getElementById('catColor').value;
  let cats = DB.get(DB.keys.categories) || [];
  const id = document.getElementById('catId').value;
  if (id) {
    cats = cats.map(c => String(c.id) === String(id) ? { ...c, name, color } : c);
    toast('Catégorie mise à jour');
  } else {
    const newId = Math.max(0, ...cats.map(c => c.id)) + 1;
    cats.push({ id: newId, name, color });
    toast('Catégorie ajoutée');
  }
  DB.set(DB.keys.categories, cats);
  closeAllModals();
  resetCatForm();
  renderCats();
}

function deleteCat() {
  const id = document.getElementById('catId').value;
  confirmDialog('Supprimer cette catégorie ?', () => {
    let cats = DB.get(DB.keys.categories) || [];
    cats = cats.filter(c => String(c.id) !== String(id));
    DB.set(DB.keys.categories, cats);
    closeAllModals();
    resetCatForm();
    renderCats();
    toast('Catégorie supprimée', 'info');
  });
}

function resetCatForm() {
  document.getElementById('catId').value = '';
  document.getElementById('catName').value = '';
  document.getElementById('catColor').value = '#3b82f6';
  document.getElementById('modalCatTitle').textContent = 'Nouvelle catégorie';
  document.getElementById('btnDeleteCat').style.display = 'none';
}

// ── OBJECTIFS ──
function renderObjs() {
  const objs = DB.get(DB.keys.objectives) || [];
  const el = document.getElementById('objList');
  if (!objs.length) {
    el.innerHTML = `<div class="empty" style="padding:2rem"><p>Aucun objectif</p></div>`;
    return;
  }
  el.innerHTML = objs.map(o => `
    <div style="padding:.85rem 1.25rem;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-weight:700;font-size:.875rem">${escHtml(o.name)}</span>
        <button class="btn btn-ghost btn-sm" onclick="editObj(${o.id})">Modifier</button>
      </div>
      ${o.description ? `<div style="font-size:.78rem;color:var(--muted);margin-top:2px">${escHtml(o.description)}</div>` : ''}
    </div>`).join('');
}

function editObj(id) {
  const objs = DB.get(DB.keys.objectives) || [];
  const o = objs.find(x => x.id === id);
  if (!o) return;
  document.getElementById('modalObjTitle').textContent = 'Modifier l\'objectif';
  document.getElementById('objId').value = id;
  document.getElementById('objName').value = o.name;
  document.getElementById('objDesc').value = o.description || '';
  document.getElementById('btnDeleteObj').style.display = '';
  openModal('modalObj');
}

function saveObj() {
  const name = document.getElementById('objName').value.trim();
  if (!name) { toast('Le nom est requis', 'error'); return; }
  const description = document.getElementById('objDesc').value.trim();
  let objs = DB.get(DB.keys.objectives) || [];
  const id = document.getElementById('objId').value;
  if (id) {
    objs = objs.map(o => String(o.id) === String(id) ? { ...o, name, description } : o);
    toast('Objectif mis à jour');
  } else {
    const newId = Math.max(0, ...objs.map(o => o.id)) + 1;
    objs.push({ id: newId, name, description });
    toast('Objectif ajouté');
  }
  DB.set(DB.keys.objectives, objs);
  closeAllModals();
  resetObjForm();
  renderObjs();
}

function deleteObj() {
  const id = document.getElementById('objId').value;
  confirmDialog('Supprimer cet objectif ?', () => {
    let objs = DB.get(DB.keys.objectives) || [];
    objs = objs.filter(o => String(o.id) !== String(id));
    DB.set(DB.keys.objectives, objs);
    closeAllModals();
    resetObjForm();
    renderObjs();
    toast('Objectif supprimé', 'info');
  });
}

function resetObjForm() {
  document.getElementById('objId').value = '';
  document.getElementById('objName').value = '';
  document.getElementById('objDesc').value = '';
  document.getElementById('modalObjTitle').textContent = 'Nouvel objectif';
  document.getElementById('btnDeleteObj').style.display = 'none';
}

// ── FONCTIONS ──
const PERM_GROUPS = [
  { label: 'Général', keys: ['view_dashboard'] },
  { label: 'Résidents & projet', keys: ['view_residents', 'edit_residents', 'access_ppe', 'access_sante', 'access_medicaments', 'access_admissions'] },
  { label: 'Suivi quotidien', keys: ['access_journal', 'access_presences', 'access_repertoire', 'access_documents', 'access_vehicules', 'access_activites'] },
  { label: 'Planning équipe', keys: ['access_planning_equipe', 'edit_planning_equipe'] },
  { label: 'Portail employé', keys: ['access_conges', 'access_notes', 'access_messages', 'access_budget', 'access_paie', 'access_entretiens', 'access_annuaire', 'access_documentation', 'access_facturation', 'access_formations'] },
  { label: 'Incidents', keys: ['view_incidents', 'validate_incidents'] },
  { label: 'Instances', keys: ['access_cvs'] },
  { label: 'Administration', keys: ['access_interventions', 'access_employes', 'access_admin', 'manage_users'] }
];

// ── PAGE RÔLES & ACCÈS (maître-détail, enregistrement automatique) ──
let _permSel = null;
let _permFilter = '';

function getFonctions()  { return DB.get(DB.keys.fonctionColors) || DEFAULTS.fonctionColors; }
function setFonctions(l) {
  DB.set(DB.keys.fonctionColors, l);
  // Partage multi-appareil : on pousse aussi la config sur Supabase
  if (typeof sbSaveAppConfig === 'function') sbSaveAppConfig('fonction_colors', l).catch(e => console.warn('Sync permissions cloud', e));
}

// Droits recommandés pour un rôle, d'après les valeurs métier par défaut (par nom de fonction).
function permRecommendedFor(name) {
  const n = (name || '').toLowerCase().trim();
  const d = (DEFAULTS.fonctionColors || []).find(f => (f.fonction || '').toLowerCase().trim() === n);
  return d ? d.permissions : null;
}

// Applique les droits recommandés au rôle sélectionné.
function permApplyRecommended() {
  const list = getFonctions();
  const f = list.find(x => String(x.id) === String(_permSel));
  if (!f) return;
  const rec = permRecommendedFor(f.fonction);
  if (!rec) { toast('Aucun modèle recommandé pour ce rôle', 'error'); return; }
  f.permissions = [...rec];
  setFonctions(list);
  renderPermDetail();
  renderPermLeft();
  permFlashSaved();
}

// Applique les droits recommandés à tous les rôles reconnus.
function permApplyRecommendedAll() {
  confirmDialog('Appliquer les droits recommandés à tous les rôles reconnus ? Les personnalisations de ces rôles seront remplacées.', () => {
    const list = getFonctions();
    let n = 0;
    list.forEach(f => { const rec = permRecommendedFor(f.fonction); if (rec) { f.permissions = [...rec]; n++; } });
    setFonctions(list);
    renderPermissionsPage();
    toast(`${n} rôle(s) mis à jour`);
  });
}

// Crée le rôle "Comptable" s'il n'existe pas encore (modifiable ensuite dans cette page).
function ensureComptableRole() {
  const list = getFonctions();
  if (list.some(f => (f.fonction || '').toLowerCase().trim() === 'comptable')) return;
  const newId = Math.max(0, ...list.map(f => Number(f.id) || 0)) + 1;
  setFonctions([...list, {
    id: newId, fonction: 'Comptable', color: '#0d9488',
    permissions: permRecommendedFor('Comptable') || ['view_dashboard', 'access_paie', 'access_budget', 'access_facturation']
  }]);
}

function renderPermissionsPage() {
  ensureComptableRole();
  const list = getFonctions();
  if (_permSel == null || !list.find(f => String(f.id) === String(_permSel))) _permSel = list[0]?.id ?? null;
  renderPermLeft();
  renderPermDetail();
}

function renderPermLeft() {
  const el = document.getElementById('permRolesList');
  if (!el) return;
  const list = getFonctions();
  el.innerHTML = list.map(f => `<div class="perm2-role ${String(f.id) === String(_permSel) ? 'active' : ''}" onclick="permSelect(${f.id})">
    <span class="perm2-dot" style="background:${f.color || '#6366f1'}"></span>
    <span class="perm2-role-name">${escHtml(f.fonction)}</span>
    <span class="perm2-role-count">${(f.permissions || []).length}</span>
  </div>`).join('') || '<div style="font-size:.8rem;color:var(--muted);padding:1rem">Aucun rôle</div>';
}

function renderPermDetail() {
  const el = document.getElementById('permDetail');
  if (!el) return;
  const f = getFonctions().find(x => String(x.id) === String(_permSel));
  if (!f) { el.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted)">Cliquez sur « Nouveau rôle » pour commencer.</div>'; return; }
  const perms = f.permissions || [];
  const used = new Set();
  const swRow = k => `<div class="perm2-row" data-label="${escHtml((PERMISSION_LABELS[k] || k).toLowerCase())}">
      <span class="perm2-row-label">${escHtml(PERMISSION_LABELS[k] || k)}</span>
      <button class="perm2-sw ${perms.includes(k) ? 'on' : ''}" data-key="${k}" aria-label="${escHtml(PERMISSION_LABELS[k] || k)}" onclick="permToggle('${k}')"></button>
    </div>`;
  let groupsHtml = PERM_GROUPS.map((g, gi) => {
    const keys = g.keys.filter(k => PERMISSION_LABELS[k]);
    keys.forEach(k => used.add(k));
    if (!keys.length) return '';
    const allOn = keys.every(k => perms.includes(k));
    return `<div class="perm2-group">
      <div class="perm2-group-label"><span>${escHtml(g.label)}</span><span class="perm2-allbtn" onclick="permToggleGroup(${gi},${!allOn})">${allOn ? 'Tout désactiver' : 'Tout activer'}</span></div>
      ${keys.map(swRow).join('')}
    </div>`;
  }).join('');
  const others = Object.keys(PERMISSION_LABELS).filter(k => !used.has(k));
  if (others.length) groupsHtml += `<div class="perm2-group"><div class="perm2-group-label"><span>Autres</span></div>${others.map(swRow).join('')}</div>`;

  el.innerHTML = `
    <div class="perm2-head">
      <input type="color" value="${f.color || '#6366f1'}" style="width:30px;height:30px;padding:0;border:none;background:none;cursor:pointer" onchange="permSetColor(this.value)" title="Couleur du rôle"/>
      <input type="text" value="${escHtml(f.fonction)}" onchange="permRename(this.value)" style="flex:1;min-width:0;font-size:.92rem;font-weight:700;border:none;background:none;padding:.2rem 0;outline:none" aria-label="Nom du rôle"/>
      <span class="perm2-saved" id="permSaved">✓ Enregistré</span>
      ${permRecommendedFor(f.fonction) ? `<button class="btn btn-ghost btn-sm" onclick="permApplyRecommended()" title="Réappliquer les droits recommandés pour ce rôle">↺ Recommandés</button>` : ''}
      <button class="btn btn-ghost btn-sm" style="color:#dc2626" onclick="permDeleteRole()" title="Supprimer ce rôle">🗑</button>
    </div>
    <div class="perm2-body">
      <input type="text" placeholder="Filtrer un accès…" value="${escHtml(_permFilter)}" oninput="permSetFilter(this.value)" style="width:100%;box-sizing:border-box;margin-bottom:.3rem"/>
      ${groupsHtml}
    </div>`;
  applyPermFilter();
}

function permSelect(id) { _permSel = id; _permFilter = ''; renderPermissionsPage(); }

function permFlashSaved() {
  const s = document.getElementById('permSaved');
  if (!s) return;
  s.classList.add('show');
  clearTimeout(permFlashSaved._t);
  permFlashSaved._t = setTimeout(() => s.classList.remove('show'), 1300);
}

function permToggle(key) {
  const list = getFonctions();
  const f = list.find(x => String(x.id) === String(_permSel));
  if (!f) return;
  f.permissions = f.permissions || [];
  const i = f.permissions.indexOf(key);
  if (i >= 0) f.permissions.splice(i, 1); else f.permissions.push(key);
  setFonctions(list);
  const btn = document.querySelector(`#permDetail .perm2-sw[data-key="${key}"]`);
  if (btn) btn.classList.toggle('on', f.permissions.includes(key));
  renderPermLeft();
  permFlashSaved();
}

function permToggleGroup(idx, turnOn) {
  const g = PERM_GROUPS[idx];
  if (!g) return;
  const list = getFonctions();
  const f = list.find(x => String(x.id) === String(_permSel));
  if (!f) return;
  f.permissions = f.permissions || [];
  g.keys.filter(k => PERMISSION_LABELS[k]).forEach(k => {
    const has = f.permissions.includes(k);
    if (turnOn && !has) f.permissions.push(k);
    if (!turnOn && has) f.permissions.splice(f.permissions.indexOf(k), 1);
  });
  setFonctions(list);
  renderPermDetail();
  renderPermLeft();
  permFlashSaved();
}

function permSetColor(color) {
  const list = getFonctions();
  const f = list.find(x => String(x.id) === String(_permSel));
  if (!f) return;
  f.color = color;
  setFonctions(list);
  renderPermLeft();
  permFlashSaved();
}

function permRename(name) {
  name = (name || '').trim();
  if (!name) { renderPermDetail(); return; }
  const list = getFonctions();
  const f = list.find(x => String(x.id) === String(_permSel));
  if (!f) return;
  f.fonction = name;
  setFonctions(list);
  renderPermLeft();
  permFlashSaved();
}

function permAddRole() {
  const list = getFonctions();
  const newId = Math.max(0, ...list.map(f => Number(f.id) || 0)) + 1;
  list.push({ id: newId, fonction: 'Nouveau rôle', color: '#6366f1', permissions: [] });
  setFonctions(list);
  _permSel = newId;
  _permFilter = '';
  renderPermissionsPage();
  const nameInput = document.querySelector('#permDetail input[type="text"]');
  if (nameInput) { nameInput.focus(); nameInput.select(); }
}

function permDeleteRole() {
  const list = getFonctions();
  const f = list.find(x => String(x.id) === String(_permSel));
  if (!f) return;
  confirmDialog(`Supprimer le rôle « ${f.fonction} » ?`, () => {
    const next = list.filter(x => String(x.id) !== String(_permSel));
    setFonctions(next);
    _permSel = next[0]?.id ?? null;
    renderPermissionsPage();
    toast('Rôle supprimé', 'info');
  });
}

function permSetFilter(v) { _permFilter = v; applyPermFilter(); }

function applyPermFilter() {
  const q = (_permFilter || '').toLowerCase().trim();
  document.querySelectorAll('#permDetail .perm2-group').forEach(grp => {
    let anyVisible = false;
    grp.querySelectorAll('.perm2-row').forEach(r => {
      const match = !q || (r.dataset.label || '').includes(q);
      r.style.display = match ? '' : 'none';
      if (match) anyVisible = true;
    });
    grp.style.display = anyVisible ? '' : 'none';
  });
}

// ── UTILISATEURS ──
function getUserEtabs(userId) {
  return getEtabs().filter(e => {
    const users = JSON.parse(localStorage.getItem(`${DB.keys.users}__${e.id}`) || '[]');
    return users.find(u => String(u.id) === String(userId));
  }).map(e => String(e.id));
}

function renderEtabCheckboxes(userEtabIds = []) {
  const etabs = getEtabs();
  const group = document.getElementById('etabAssignGroup');
  const el = document.getElementById('etabAssignList');
  if (!el || !group) return;
  if (etabs.length <= 1) { group.style.display = 'none'; return; }
  group.style.display = '';
  el.innerHTML = `<select id="etabAssignSelect" class="form-control">
    <option value="">— Sélectionner un établissement —</option>
    ${etabs.map(e => `<option value="${e.id}" ${userEtabIds.includes(String(e.id)) ? 'selected' : ''}>${escHtml(e.nom)}</option>`).join('')}
  </select>`;
}

function renderEducateurs() {
  const users = DB.get(DB.keys.users) || [];
  const educateurs = users.filter(u => !u.super);
  const etabs = getEtabs();
  const el = document.getElementById('eduList');
  if (!el) return;
  if (!educateurs.length) {
    el.innerHTML = `<div class="empty" style="padding:2rem"><p>Aucun utilisateur enregistré</p></div>`;
    return;
  }
  el.innerHTML = educateurs.map(u => {
    const userEtabs = etabs.filter(e => {
      const list = JSON.parse(localStorage.getItem(`${DB.keys.users}__${e.id}`) || '[]');
      return list.find(x => String(x.id) === String(u.id));
    });
    return `
    <div style="display:flex;align-items:center;gap:.75rem;padding:.85rem 1.25rem;border-bottom:1px solid var(--border)">
      <div class="avatar sm" style="background:var(--blue)">${initials(u.prenom||'', u.nom||'') || u.username[0].toUpperCase()}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.875rem">${escHtml([u.prenom, u.nom].filter(Boolean).join(' ') || u.username)}</div>
        <div style="font-size:.75rem;color:var(--muted)">${u.fonction ? escHtml(u.fonction)+' · ' : ''}@${escHtml(u.username)}</div>
        ${userEtabs.length ? `<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.3rem">${userEtabs.map(e => `<span class="badge" style="background:${e.color||'#0f2b4a'}22;color:${e.color||'#0f2b4a'};font-size:.65rem">${escHtml(e.nom)}</span>`).join('')}</div>` : ''}
      </div>
      <button class="btn btn-ghost btn-sm" onclick="editEducateur(${u.id})">Modifier</button>
    </div>`;
  }).join('');
}

function editEducateur(id) {
  const users = DB.get(DB.keys.users) || [];
  const u = users.find(x => x.id === id);
  if (!u) return;
  document.getElementById('modalEduTitle').textContent = "Modifier l'utilisateur";
  document.getElementById('eduId').value = id;
  document.getElementById('eduPrenom').value = u.prenom || '';
  document.getElementById('eduNom').value = u.nom || '';
  document.getElementById('eduFonction').value = u.fonction || '';
  document.getElementById('eduUsername').value = u.username;
  document.getElementById('eduPassword').value = '';
  document.getElementById('eduPasswordLabel').textContent = 'Nouveau mot de passe (vide = inchangé)';
  document.getElementById('btnDeleteEdu').style.display = '';
  renderEtabCheckboxes(getUserEtabs(id));
  openModal('modalEdu');
}

async function saveEducateur() {
  const username = document.getElementById('eduUsername').value.trim();
  const password = document.getElementById('eduPassword').value;
  const prenom = document.getElementById('eduPrenom').value.trim();
  const nom = document.getElementById('eduNom').value.trim();
  const fonction = document.getElementById('eduFonction').value.trim();
  const id = document.getElementById('eduId').value;
  if (!username) { toast("L'identifiant est requis", 'error'); return; }
  if (password && password.length < 6) { toast('Mot de passe : 6 caractères minimum', 'error'); return; }
  let users = DB.get(DB.keys.users) || [];
  if (users.find(u => u.username === username && String(u.id) !== String(id))) {
    toast('Cet identifiant est déjà utilisé', 'error'); return;
  }
  const pwdHash = password ? await hashPassword(password) : null;
  if (id) {
    if (!password && !users.find(u => String(u.id) === String(id))?.password) {
      toast('Le mot de passe est requis', 'error'); return;
    }
    users = users.map(u => String(u.id) === String(id)
      ? { ...u, prenom, nom, fonction, username, ...(pwdHash ? { password: pwdHash } : {}) } : u);
    toast('Utilisateur mis à jour');
  } else {
    if (!password) { toast('Le mot de passe est requis', 'error'); return; }
    const newId = Math.max(0, ...users.map(u => u.id)) + 1;
    users.push({ id: newId, prenom, nom, fonction, username, password: pwdHash, role: 'educateur' });
    toast('Utilisateur ajouté');
  }
  DB.set(DB.keys.users, users);
  // Synchroniser avec les établissements sélectionnés
  const sel = document.getElementById('etabAssignSelect');
  const selectedEtabs = sel ? [...sel.selectedOptions].map(o => o.value) : [];
  const allEtabs = getEtabs();
  const savedUser = (DB.get(DB.keys.users) || []).find(u => u.username === username);
  allEtabs.forEach(e => {
    const k = `${DB.keys.users}__${e.id}`;
    let eUsers = JSON.parse(localStorage.getItem(k) || '[]');
    if (selectedEtabs.includes(String(e.id))) {
      const idx = eUsers.findIndex(u => String(u.id) === String(savedUser?.id));
      if (idx >= 0) eUsers[idx] = { ...eUsers[idx], ...savedUser };
      else if (savedUser) eUsers.push(savedUser);
    } else {
      eUsers = eUsers.filter(u => String(u.id) !== String(savedUser?.id));
    }
    localStorage.setItem(k, JSON.stringify(eUsers));
  });
  closeAllModals();
  resetEducateurForm();
  renderEducateurs();
}

function deleteEducateur() {
  const id = document.getElementById('eduId').value;
  confirmDialog('Supprimer cet éducateur ?', () => {
    let users = DB.get(DB.keys.users) || [];
    users = users.filter(u => String(u.id) !== String(id));
    DB.set(DB.keys.users, users);
    closeAllModals();
    resetEducateurForm();
    renderEducateurs();
    toast('Éducateur supprimé', 'info');
  });
}

function resetEducateurForm() {
  document.getElementById('eduId').value = '';
  document.getElementById('eduPrenom').value = '';
  document.getElementById('eduNom').value = '';
  document.getElementById('eduFonction').value = '';
  document.getElementById('eduUsername').value = '';
  document.getElementById('eduPassword').value = '';
  document.getElementById('modalEduTitle').textContent = 'Nouvel utilisateur';
  document.getElementById('eduPasswordLabel').textContent = 'Mot de passe';
  renderEtabCheckboxes([String(DB._id())].filter(Boolean));
  document.getElementById('btnDeleteEdu').style.display = 'none';
}

// ── COMPTE ──
function loadUser() {
  const session = Auth.getSession();
  const users = DB.get(DB.keys.users) || [];
  const adminUser = session ? users.find(u => u.id === session.userId) : null;
  const u = adminUser || DB.get(DB.keys.user) || {};
  document.getElementById('uPrenom').value = u.prenom || '';
  document.getElementById('uNom').value = u.nom || '';
  document.getElementById('uRole').value = (DB.get(DB.keys.user) || {}).role || '';
  const name = [u.prenom, u.nom].filter(Boolean).join(' ') || 'Administrateur';
  document.getElementById('accountName').textContent = name;
  document.getElementById('accountRole').textContent = 'Administrateur';
  document.getElementById('accountAvatar').textContent = initials(u.prenom||'', u.nom||'') || 'A';
  if (adminUser) document.getElementById('uUsername').value = adminUser.username;
}

function saveUser() {
  const prenom = document.getElementById('uPrenom').value.trim();
  const nom = document.getElementById('uNom').value.trim();
  const role = document.getElementById('uRole').value.trim();
  DB.set(DB.keys.user, { prenom, nom, role });
  const session = Auth.getSession();
  if (session) {
    let users = DB.get(DB.keys.users) || [];
    users = users.map(u => u.id === session.userId ? { ...u, prenom, nom } : u);
    DB.set(DB.keys.users, users);
    DB.set(DB.keys.session, { ...session, prenom, nom });
  }
  loadUser();
  renderUserInfo();
  toast('Compte mis à jour');
}

async function saveCredentials() {
  const username = document.getElementById('uUsername').value.trim();
  const password = document.getElementById('uPassword').value;
  const confirm = document.getElementById('uPasswordConfirm').value;
  if (!username) { toast("L'identifiant est requis", 'error'); return; }
  if (password && password.length < 6) { toast('Mot de passe : 6 caractères minimum', 'error'); return; }
  if (password && password !== confirm) { toast('Les mots de passe ne correspondent pas', 'error'); return; }
  const session = Auth.getSession();
  let users = DB.get(DB.keys.users) || [];
  if (users.find(u => u.username === username && u.id !== session.userId)) {
    toast('Cet identifiant est déjà utilisé', 'error'); return;
  }
  const pwdHash = password ? await hashPassword(password) : null;
  users = users.map(u => u.id === session.userId ? { ...u, username, ...(pwdHash ? { password: pwdHash } : {}) } : u);
  DB.set(DB.keys.users, users);
  DB.set(DB.keys.session, { ...session, username });
  document.getElementById('uPassword').value = '';
  document.getElementById('uPasswordConfirm').value = '';
  toast('Identifiants mis à jour');
}

// ── DONNÉES ──
// Clés DB.keys exclues du backup : état de session/navigateur, pas des données métier.
const BACKUP_EXCLUDE_KEYS = ['session', 'etablissements', 'onboarded'];

function exportData(type) {
  let data = {};
  const k = DB.keys;
  if (type === 'residents' || type === 'all') data.residents = DB.get(k.residents) || [];
  if (type === 'journal'   || type === 'all') data.journal   = DB.get(k.journal)   || [];
  if (type === 'all') {
    Object.keys(k).forEach(name => {
      if (BACKUP_EXCLUDE_KEYS.includes(name) || name in data) return;
      const val = DB.get(k[name]);
      if (val !== null) data[name] = val;
    });
    data.conversations = JSON.parse(localStorage.getItem('ftr_conversations') || '{}');
    data._exportedAt   = new Date().toISOString();
    data._version      = '2.0';
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ftr-backup-${type}-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Export téléchargé ✓');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        confirmDialog(
          `Restaurer la sauvegarde du ${data._exportedAt ? new Date(data._exportedAt).toLocaleString('fr-FR') : 'fichier sélectionné'} ?\n\nLes données actuelles seront écrasées.`,
          () => {
            const k = DB.keys;
            Object.keys(k).forEach(name => {
              if (BACKUP_EXCLUDE_KEYS.includes(name)) return;
              if (data[name] !== undefined) DB.set(k[name], data[name]);
            });
            if (data.conversations) localStorage.setItem('ftr_conversations', JSON.stringify(data.conversations));
            toast('Données restaurées avec succès — rechargement…', 'success');
            setTimeout(() => location.reload(), 1500);
          }
        );
      } catch {
        toast('Fichier invalide ou corrompu', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function resetData(type) {
  const messages = {
    journal: 'Vider tout le journal de bord ? Cette action est irréversible.',
    presences: 'Réinitialiser toutes les présences ? Cette action est irréversible.',
    all: '⚠️ ATTENTION : Supprimer TOUTES les données (résidents, journal, présences) ? Cette action est irréversible.'
  };
  confirmDialog(messages[type], () => {
    if (type === 'journal') DB.set(DB.keys.journal, []);
    else if (type === 'presences') DB.set(DB.keys.presences, {});
    else if (type === 'all') {
      DB.set(DB.keys.residents, []);
      DB.set(DB.keys.journal, []);
      DB.set(DB.keys.presences, {});
      DB.set(DB.keys.planning, []);
    }
    toast('Données réinitialisées', 'info');
  });
}

function renderLoginHistory() {
  const log = DB.get(DB.keys.loginHistory) || [];
  const tbody = document.getElementById('loginHistoryBody');
  if (!log.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--muted)">Aucune connexion enregistrée</td></tr>';
    return;
  }
  tbody.innerHTML = log.slice(0, 200).map(e => {
    const d = new Date(e.date);
    const dateStr = d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
    const timeStr = d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    const actionLabel = e.action === 'login' ? 'Connexion' : e.action === 'logout' ? 'Déconnexion' : e.action;
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:.6rem 1rem;white-space:nowrap">${escHtml(dateStr)} <span style="color:var(--muted)">${escHtml(timeStr)}</span></td>
      <td style="padding:.6rem 1rem">${escHtml(e.prenom||'')} ${escHtml(e.nom||'')} <span style="color:var(--muted);font-size:.75rem">(${escHtml(e.username)})</span></td>
      <td style="padding:.6rem 1rem"><span class="badge ${e.action === 'login' ? 'badge-green' : 'badge-gray'}">${actionLabel}</span></td>
      <td style="padding:.6rem 1rem">${escHtml(e.role||'—')}</td>
    </tr>`;
  }).join('');
}

// ── AUDIT LOG ──
const ACTION_LABELS = {
  resident_create: 'Résident ajouté',   resident_update: 'Résident modifié',  resident_delete: 'Résident supprimé',
  incident_create: 'Incident déclaré',  incident_update: 'Incident traité',
  journal_create:  'Entrée journal',
  ppe_create:      'Avenant créé',      ppe_update:      'Avenant modifié',
  user_create:     'Utilisateur créé',  user_update:     'Utilisateur modifié',
};
const ACTION_COLORS = {
  resident_create:'#10b981', resident_update:'#3b82f6', resident_delete:'#ef4444',
  incident_create:'#f59e0b', incident_update:'#10b981',
  journal_create: '#8b5cf6',
  ppe_create:     '#06b6d4', ppe_update:     '#3b82f6',
  user_create:    '#6366f1', user_update:    '#6366f1',
};

function renderAuditLog() {
  const tbody = document.getElementById('auditLogBody');
  if (!tbody) return;
  const log = JSON.parse(localStorage.getItem('ftr_audit_log') || '[]');
  if (!log.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--muted)">Aucune action enregistrée</td></tr>';
    return;
  }
  tbody.innerHTML = log.slice(0, 200).map(e => {
    const d = new Date(e.date);
    const dateStr = d.toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit', year:'numeric'});
    const timeStr = d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
    const label = ACTION_LABELS[e.action] || e.action;
    const color = ACTION_COLORS[e.action] || '#64748b';
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:.55rem 1rem;white-space:nowrap;font-size:.78rem">${dateStr} <span style="color:var(--muted)">${timeStr}</span></td>
      <td style="padding:.55rem 1rem;font-size:.78rem;font-weight:500">${escHtml(e.user||'—')} <span style="font-size:.68rem;color:var(--muted)">(${escHtml(e.role||'')})</span></td>
      <td style="padding:.55rem 1rem"><span style="display:inline-block;padding:1px 8px;border-radius:100px;font-size:.68rem;font-weight:700;background:${color}18;color:${color}">${label}</span></td>
      <td style="padding:.55rem 1rem;font-size:.75rem;color:var(--g600);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(e.details||'')}</td>
    </tr>`;
  }).join('');
}

function exportAuditLog() {
  const log = JSON.parse(localStorage.getItem('ftr_audit_log') || '[]');
  if (!log.length) { toast('Aucune action à exporter', 'info'); return; }
  const header = 'Date,Heure,Utilisateur,Rôle,Action,Détails\n';
  const rows = log.map(e => {
    const d = new Date(e.date);
    return [
      d.toLocaleDateString('fr-FR'),
      d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}),
      e.user || '',
      e.role || '',
      ACTION_LABELS[e.action] || e.action,
      (e.details || '').replace(/,/g, ';')
    ].map(v => `"${v}"`).join(',');
  }).join('\n');
  const blob = new Blob(['﻿' + header + rows], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `audit-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Audit exporté ✓');
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadUser();
  loadBranding();
  renderCats();
  renderObjs();
  renderPermissionsPage();
  initLogoUpload();
  renderLoginHistory();
  renderAuditLog();
  if (typeof applyEtabBackground === 'function') applyEtabBackground();

  ['setEtab','setVille','setFiness','setTel','setEmail'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updatePreview);
  });

  document.getElementById('modalCat').querySelector('.modal-close').addEventListener('click', resetCatForm);
  document.getElementById('modalObj').querySelector('.modal-close').addEventListener('click', resetObjForm);
});
