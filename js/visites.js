// ── DROITS DE VISITE & HÉBERGEMENTS FAMILLE ──
let visEditId = null;
let droitsResidentId = null;

const VIS_TYPES = {
  libre: { label: 'Visite libre', icon: '👪', color: '#16a34a' },
  mediatisee: { label: 'Visite médiatisée', icon: '🛡️', color: '#d97706' },
  hebergement: { label: 'Hébergement famille', icon: '🏠', color: '#7c3aed' },
  telephone: { label: 'Appel téléphonique', icon: '📞', color: '#0891b2' }
};
const VIS_STATUTS = {
  prevue: { label: 'Prévue', cls: 'badge-blue' },
  realisee: { label: 'Réalisée', cls: 'badge-green' },
  annulee: { label: 'Annulée', cls: 'badge-gray' },
  absent: { label: 'Non présenté', cls: 'badge-red' }
};
const VIS_LIENS = ['Mère', 'Père', 'Parents', 'Grand-mère', 'Grand-père', 'Sœur', 'Frère', 'Tante', 'Oncle', 'Famille d\'accueil', 'Tiers digne de confiance', 'Autre'];

// Source = Supabase. Cache mémoire chargé au démarrage.
let _visCache = [];
function getVisites() { return _visCache; }
async function loadVisitesCache() { _visCache = await sbGetVisites(); }

// ── Résidents : source = Supabase (lecture via sbGetResidents, écriture via sbSaveResident) ──
let _residentsCache = [];
function residentsList() { return _residentsCache; }
async function loadResidentsCache() { _residentsCache = await sbGetResidents(); }
async function persistResident(r) {
  const saved = await sbSaveResident(r);
  const i = _residentsCache.findIndex(x => String(x.id) === String(saved.id));
  if (i >= 0) _residentsCache[i] = saved; else _residentsCache.push(saved);
  return saved;
}

function visResidents() {
  return residentsList().filter(r => r.statut !== 'sorti')
    .sort((a, b) => `${a.nom || ''}`.localeCompare(`${b.nom || ''}`, 'fr'));
}

// ── RENDU PRINCIPAL ──
function renderVisites() {
  const all = getVisites();
  const td = today();
  const fRes = document.getElementById('vFilterResident')?.value || '';
  const fType = document.getElementById('vFilterType')?.value || '';
  let list = all;
  if (fRes) list = list.filter(v => String(v.residentId) === String(fRes));
  if (fType) list = list.filter(v => v.type === fType);

  // Stats (non filtrées)
  const enCours = all.filter(v => v.type === 'hebergement' && v.statut === 'prevue' && (v.date || '') <= td && (v.dateRetour || v.date || '') >= td);
  const aujourdhui = all.filter(v => v.date === td && v.statut === 'prevue');
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const semaine = all.filter(v => v.statut === 'prevue' && v.date > td && v.date <= in7);
  const mediatisees = all.filter(v => v.type === 'mediatisee' && v.statut === 'prevue' && v.date >= td);
  document.getElementById('vStats').innerHTML = `
    <div class="chx-stat" style="--c:#16a34a"><div class="chx-stat-top"><span class="chx-stat-lbl">Aujourd'hui</span></div><div class="chx-stat-num">${aujourdhui.length}</div></div>
    <div class="chx-stat" style="--c:#0d9488"><div class="chx-stat-top"><span class="chx-stat-lbl">7 prochains jours</span></div><div class="chx-stat-num">${semaine.length}</div></div>
    <div class="chx-stat" style="--c:#7c3aed"><div class="chx-stat-top"><span class="chx-stat-lbl">Hébergements en cours</span></div><div class="chx-stat-num">${enCours.length}</div></div>
    <div class="chx-stat" style="--c:#e85d04"><div class="chx-stat-top"><span class="chx-stat-lbl">Médiatisées à venir</span></div><div class="chx-stat-num">${mediatisees.length}</div></div>`;

  // Groupes : en cours / aujourd'hui / à venir / historique
  const groups = { encours: [], today: [], avenir: [], histo: [] };
  list.forEach(v => {
    if (v.type === 'hebergement' && v.statut === 'prevue' && (v.date || '') <= td && (v.dateRetour || v.date || '') >= td) groups.encours.push(v);
    else if (v.date === td && v.statut === 'prevue') groups.today.push(v);
    else if (v.statut === 'prevue' && v.date > td) groups.avenir.push(v);
    else groups.histo.push(v);
  });
  groups.avenir.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.heure || '').localeCompare(b.heure || ''));
  groups.histo.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const el = document.getElementById('vList');
  if (!list.length) {
    el.innerHTML = `<div class="empty" style="padding:2.5rem"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg></div><h3>Aucune visite</h3><p>Planifiez les visites et hébergements famille des résidents.</p></div>`;
    return;
  }
  const section = (title, arr, open) => arr.length ? `
    <details ${open ? 'open' : ''} style="margin-bottom:1rem">
      <summary class="section-label" style="cursor:pointer;list-style:none;margin-bottom:.6rem">${title} (${arr.length})</summary>
      <div style="display:flex;flex-direction:column;gap:.55rem">${arr.map(visRow).join('')}</div>
    </details>` : '';
  el.innerHTML =
    section('🏠 Hébergements en cours', groups.encours, true) +
    section("📅 Aujourd'hui", groups.today, true) +
    section('🔜 À venir', groups.avenir, true) +
    section('🗂 Historique', groups.histo.slice(0, 40), false);
}

function visRow(v) {
  const t = VIS_TYPES[v.type] || VIS_TYPES.libre;
  const st = VIS_STATUTS[v.statut] || VIS_STATUTS.prevue;
  const canEdit = (typeof canEditResidents === 'function') ? canEditResidents(Auth.getSession()?.userId) : Auth.isAdmin();
  const retard = v.type === 'hebergement' && v.statut === 'prevue' && v.dateRetour && v.dateRetour < today();
  return `<div class="card" style="border-left:3px solid ${t.color}">
    <div class="card-body" style="padding:.75rem 1rem;display:flex;align-items:center;gap:.8rem;flex-wrap:wrap">
      <span style="font-size:1.25rem;flex-shrink:0">${t.icon}</span>
      <div style="flex:1;min-width:220px">
        <div style="display:flex;align-items:center;gap:.45rem;flex-wrap:wrap">
          <a href="resident.html?id=${v.residentId}" style="font-weight:700;font-size:.88rem;color:var(--text);text-decoration:none">${escHtml(v.residentName || '—')}</a>
          <span class="badge" style="background:${t.color}1a;color:${t.color}">${t.label}</span>
          <span class="badge ${st.cls}">${st.label}</span>
          ${retard ? '<span class="badge badge-red">Retour dépassé</span>' : ''}
        </div>
        <div style="font-size:.75rem;color:var(--muted);margin-top:2px">
          ${escHtml(v.personne || '?')}${v.lien ? ' (' + escHtml(v.lien) + ')' : ''}
          ${v.lieu ? ' · ' + escHtml(v.lieu) : ''}
          ${v.notes ? ' · 📝 ' + escHtml(v.notes.slice(0, 90)) : ''}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-family:var(--display);font-weight:700;color:${t.color}">${formatDate(v.date)}${v.heure ? ' · ' + v.heure : ''}</div>
        ${v.type === 'hebergement' && v.dateRetour ? `<div style="font-size:.7rem;color:var(--muted)">retour ${formatDate(v.dateRetour)}${v.heureRetour ? ' à ' + v.heureRetour : ''}</div>` : ''}
      </div>
      ${canEdit ? `<div class="no-print" style="display:flex;gap:.2rem;flex-shrink:0">
        ${v.statut === 'prevue' ? `
          <button class="btn btn-ghost btn-sm" style="color:var(--green)" title="Marquer réalisée" onclick="setVisiteStatut('${v.id}','realisee')">✓</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--amber)" title="Non présenté" onclick="setVisiteStatut('${v.id}','absent')">∅</button>
          <button class="btn btn-ghost btn-sm" title="Annuler" onclick="setVisiteStatut('${v.id}','annulee')">⊘</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="openVisiteModal('${v.id}')">✎</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteVisite('${v.id}')">✕</button>
      </div>` : ''}
    </div>
  </div>`;
}

// ── CRUD VISITE ──
function openVisiteModal(id) {
  visEditId = id || null;
  const v = id ? getVisites().find(x => x.id === id) || {} : {};
  document.getElementById('vmTitle').textContent = id ? 'Modifier la visite' : 'Nouvelle visite';
  document.getElementById('vmResident').value = v.residentId || '';
  document.getElementById('vmType').value = v.type || 'libre';
  document.getElementById('vmPersonne').value = v.personne || '';
  document.getElementById('vmLien').value = v.lien || '';
  document.getElementById('vmDate').value = v.date || today();
  document.getElementById('vmHeure').value = v.heure || '';
  document.getElementById('vmDateRetour').value = v.dateRetour || '';
  document.getElementById('vmHeureRetour').value = v.heureRetour || '';
  document.getElementById('vmLieu').value = v.lieu || '';
  document.getElementById('vmNotes').value = v.notes || '';
  vmTypeChanged();
  vmShowDroits();
  openModal('modalVisite');
}

function vmTypeChanged() {
  const heb = document.getElementById('vmType').value === 'hebergement';
  document.getElementById('vmRetourWrap').style.display = heb ? '' : 'none';
}

// Affiche le cadre des droits du résident sélectionné dans le modal
function vmShowDroits() {
  const rid = document.getElementById('vmResident').value;
  const box = document.getElementById('vmDroitsInfo');
  const r = residentsList().find(x => String(x.id) === String(rid));
  const droits = (r && r.droitsVisite) || [];
  if (!rid) { box.innerHTML = ''; return; }
  box.innerHTML = droits.length
    ? `<div style="font-size:.72rem;color:var(--muted);margin-bottom:.25rem">Cadre défini pour ce résident :</div>` +
      droits.map(d => `<span class="badge" style="background:${(VIS_TYPES[d.type] || VIS_TYPES.libre).color}1a;color:${(VIS_TYPES[d.type] || VIS_TYPES.libre).color};margin:0 .25rem .25rem 0;cursor:pointer" onclick="vmUseDroit('${escHtml(d.personne)}','${escHtml(d.lien || '')}','${d.type}')" title="${escHtml(d.modalites || '')}">${(VIS_TYPES[d.type] || VIS_TYPES.libre).icon} ${escHtml(d.personne)}${d.lien ? ' (' + escHtml(d.lien) + ')' : ''}</span>`).join('')
    : `<div style="font-size:.72rem;color:#d97706;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:.35rem .6rem">Aucun droit de visite défini pour ce résident — pensez à renseigner le cadre (bouton « Droits de visite »).</div>`;
}

function vmUseDroit(personne, lien, type) {
  document.getElementById('vmPersonne').value = personne;
  document.getElementById('vmLien').value = lien;
  document.getElementById('vmType').value = type;
  vmTypeChanged();
}

async function saveVisite() {
  const rid = document.getElementById('vmResident').value;
  const personne = document.getElementById('vmPersonne').value.trim();
  const date = document.getElementById('vmDate').value;
  if (!rid) { toast('Choisissez un résident', 'error'); return; }
  if (!personne) { toast('Indiquez le visiteur / la famille', 'error'); return; }
  if (!date) { toast('La date est requise', 'error'); return; }
  const r = residentsList().find(x => String(x.id) === String(rid));
  const type = document.getElementById('vmType').value;
  const s = Auth.getSession();
  const data = {
    residentId: rid,
    residentName: r ? `${r.prenom || ''} ${r.nom || ''}`.trim() : '',
    type, personne,
    lien: document.getElementById('vmLien').value.trim(),
    date,
    heure: document.getElementById('vmHeure').value,
    dateRetour: type === 'hebergement' ? document.getElementById('vmDateRetour').value : '',
    heureRetour: type === 'hebergement' ? document.getElementById('vmHeureRetour').value : '',
    lieu: document.getElementById('vmLieu').value.trim(),
    notes: document.getElementById('vmNotes').value.trim()
  };
  try {
    if (visEditId) {
      const old = _visCache.find(x => x.id === visEditId) || {};
      const saved = await sbSaveVisite({ ...old, ...data, id: visEditId });
      _visCache = _visCache.map(x => x.id === visEditId ? saved : x);
      toast('Visite mise à jour');
    } else {
      const saved = await sbSaveVisite({ ...data, statut: 'prevue', createdBy: s ? `${s.prenom || ''} ${s.nom || ''}`.trim() || s.username : '?' });
      _visCache.unshift(saved);
      toast('Visite planifiée ✓');
      // Hébergement = absence du résident → proposer la sortie liée
      if (type === 'hebergement' && r && confirm('Créer aussi la sortie correspondante sur la fiche du résident (retour suivi sur la fiche et la relève) ?')) {
        const sorties = r.sorties || [];
        sorties.push({
          id: genId(), date, heure: data.heure || '',
          destination: `Famille — ${personne}`, motif: 'Hébergement famille',
          accompagnement: '', retourPrevuDate: data.dateRetour || date, retourPrevuHeure: data.heureRetour || '',
          autorisePar: '', notes: 'Créée depuis le module Visites', retourEffectif: null
        });
        await persistResident({ ...r, sorties });
        toast('Sortie créée sur la fiche du résident');
      }
    }
  } catch (e) {
    console.error('[saveVisite]', e);
    toast('Erreur enregistrement : ' + (e?.message || e), 'error');
    return;
  }
  if (typeof auditLog === 'function') auditLog('visite_save', `${VIS_TYPES[type].label} — ${data.residentName}`);
  closeModal('modalVisite');
  renderVisites();
}

async function setVisiteStatut(id, statut) {
  try {
    const saved = await sbUpdateVisiteField(id, { statut, statut_at: new Date().toISOString() });
    _visCache = _visCache.map(x => x.id === id ? saved : x);
  } catch (e) { console.error('[setVisiteStatut]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
  renderVisites();
}

function deleteVisite(id) {
  confirmDialog('Supprimer cette visite ?', async () => {
    try {
      await sbDeleteVisite(id);
      _visCache = _visCache.filter(x => x.id !== id);
    } catch (e) { console.error('[deleteVisite]', e); toast('Erreur suppression : ' + (e?.message || e), 'error'); return; }
    renderVisites();
    toast('Visite supprimée', 'info');
  });
}

// ── DROITS DE VISITE (cadre par résident, stocké sur la fiche) ──
function openDroitsModal() {
  const sel = document.getElementById('drResident');
  sel.innerHTML = '<option value="">— Choisir un résident —</option>' +
    visResidents().map(r => `<option value="${r.id}">${escHtml(`${r.prenom || ''} ${r.nom || ''}`.trim())}</option>`).join('');
  if (droitsResidentId) sel.value = droitsResidentId;
  renderDroitsList();
  openModal('modalDroits');
}

function renderDroitsList() {
  droitsResidentId = document.getElementById('drResident').value || null;
  const box = document.getElementById('drList');
  if (!droitsResidentId) { box.innerHTML = '<div style="font-size:.8rem;color:var(--g400);padding:.5rem 0">Sélectionnez un résident pour gérer son cadre de visites.</div>'; return; }
  const r = residentsList().find(x => String(x.id) === String(droitsResidentId));
  const droits = (r && r.droitsVisite) || [];
  box.innerHTML = (droits.length ? droits.map(d => {
    const t = VIS_TYPES[d.type] || VIS_TYPES.libre;
    return `<div style="display:flex;align-items:flex-start;gap:.6rem;padding:.55rem .75rem;background:var(--g50);border:1px solid var(--border);border-radius:var(--r-sm)">
      <span>${t.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.83rem">${escHtml(d.personne)}${d.lien ? ` <span class="badge badge-gray">${escHtml(d.lien)}</span>` : ''} <span class="badge" style="background:${t.color}1a;color:${t.color}">${t.label}</span></div>
        ${d.modalites ? `<div style="font-size:.73rem;color:var(--muted)">${escHtml(d.modalites)}</div>` : ''}
        ${d.decision ? `<div style="font-size:.7rem;color:var(--g400)">⚖️ ${escHtml(d.decision)}</div>` : ''}
      </div>
      <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteDroit('${d.id}')">✕</button>
    </div>`;
  }).join('') : '<div style="font-size:.8rem;color:var(--g400);padding:.5rem 0">Aucun droit défini.</div>');
}

async function addDroit() {
  if (!droitsResidentId) { toast('Sélectionnez un résident', 'error'); return; }
  const personne = document.getElementById('drPersonne').value.trim();
  if (!personne) { toast('Indiquez la personne autorisée', 'error'); return; }
  const droit = {
    id: genId(), personne,
    lien: document.getElementById('drLien').value,
    type: document.getElementById('drType').value,
    modalites: document.getElementById('drModalites').value.trim(),
    decision: document.getElementById('drDecision').value.trim()
  };
  const r = residentsList().find(x => String(x.id) === String(droitsResidentId));
  if (r) await persistResident({ ...r, droitsVisite: [...(r.droitsVisite || []), droit] });
  if (typeof auditLog === 'function') auditLog('droit_visite_save', `Droit de visite — ${personne}`);
  ['drPersonne', 'drModalites', 'drDecision'].forEach(id => { document.getElementById(id).value = ''; });
  toast('Droit de visite ajouté ✓');
  renderDroitsList();
}

function deleteDroit(id) {
  confirmDialog('Retirer ce droit de visite ?', async () => {
    const r = residentsList().find(x => String(x.id) === String(droitsResidentId));
    if (r) await persistResident({ ...r, droitsVisite: (r.droitsVisite || []).filter(d => d.id !== id) });
    renderDroitsList();
    toast('Droit retiré', 'info');
  });
}

// ── INIT ──
async function initVisites() {
  const s = Auth.requireAuth();
  if (!s) return;
  if (!requireModule('view_residents')) return;
  await loadResidentsCache();
  await loadVisitesCache();
  const opts = visResidents().map(r => `<option value="${r.id}">${escHtml(`${r.prenom || ''} ${r.nom || ''}`.trim())}</option>`).join('');
  document.getElementById('vFilterResident').innerHTML = '<option value="">Tous les résidents</option>' + opts;
  document.getElementById('vmResident').innerHTML = '<option value="">— Choisir —</option>' + opts;
  document.getElementById('vFilterType').innerHTML = '<option value="">Tous les types</option>' + Object.entries(VIS_TYPES).map(([k, t]) => `<option value="${k}">${t.icon} ${t.label}</option>`).join('');
  document.getElementById('drLien').innerHTML = VIS_LIENS.map(l => `<option>${l}</option>`).join('');
  const canEdit = (typeof canEditResidents === 'function') ? canEditResidents(s.userId) : Auth.isAdmin();
  if (!canEdit) {
    const b1 = document.getElementById('btnAddVisite'); if (b1) b1.style.display = 'none';
    const b2 = document.getElementById('btnDroits'); if (b2) b2.style.display = 'none';
  }
  ['vFilterResident', 'vFilterType'].forEach(id => document.getElementById(id)?.addEventListener('change', renderVisites));
  document.getElementById('vmType')?.addEventListener('change', vmTypeChanged);
  document.getElementById('vmResident')?.addEventListener('change', vmShowDroits);
  document.getElementById('drResident')?.addEventListener('change', renderDroitsList);
  renderVisites();
}
document.addEventListener('DOMContentLoaded', initVisites);
