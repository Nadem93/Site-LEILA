// ── ACTIVITÉS ÉDUCATIVES — catalogue, inscriptions, bilans ──
let actEditId = null;
let actParticipantsId = null;

const ACT_CATEGORIES = {
  sportive: { label: 'Sportive', icon: '⚽', color: '#16a34a' },
  creative: { label: 'Créative / Artistique', icon: '🎨', color: '#db2777' },
  culturelle: { label: 'Culturelle', icon: '🎭', color: '#8b5cf6' },
  scolaire: { label: 'Scolaire / Soutien', icon: '📚', color: '#0369a1' },
  autonomie: { label: 'Autonomie / Vie quotidienne', icon: '🧺', color: '#d97706' },
  sortie: { label: 'Sortie / Extérieur', icon: '🚌', color: '#0d9488' },
  citoyennete: { label: 'Citoyenneté / Expression', icon: '🗳️', color: '#6366f1' },
  autre: { label: 'Autre', icon: '✨', color: '#64748b' }
};
const ACT_JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche', 'Ponctuel'];
const ACT_JOUR_AUJOURDHUI = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][new Date().getDay()];

// Source = Supabase. Cache mémoire chargé au démarrage.
let _actCache = [];
function getActivites() { return _actCache; }
async function loadActivitesCache() { _actCache = await sbGetActivites(); }

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

function actResidents() {
  return residentsList().filter(r => r.statut !== 'sorti')
    .sort((a, b) => `${a.nom || ''}`.localeCompare(`${b.nom || ''}`, 'fr'));
}

// Inscriptions actives pour une activité donnée, tous résidents confondus
function actInscriptions(activiteId) {
  const out = [];
  actResidents().forEach(r => {
    (r.activites || []).filter(i => String(i.activiteId) === String(activiteId) && i.statut === 'active')
      .forEach(i => out.push({ resident: r, inscription: i }));
  });
  return out;
}

function actBilansCeMois() {
  const ym = today().slice(0, 7);
  let n = 0;
  actResidents().forEach(r => (r.activites || []).forEach(i => (i.bilans || []).forEach(b => { if ((b.date || '').slice(0, 7) === ym) n++; })));
  return n;
}

// ── RENDU PRINCIPAL ──
function renderActivites() {
  const all = getActivites();
  const fCat = document.getElementById('aFilterCat')?.value || '';
  const fJour = document.getElementById('aFilterJour')?.value || '';
  let list = all;
  if (fCat) list = list.filter(a => a.categorie === fCat);
  if (fJour) list = list.filter(a => a.jour === fJour);
  list = [...list].sort((a, b) => (b.actif ? 1 : 0) - (a.actif ? 1 : 0) || (a.nom || '').localeCompare(b.nom || '', 'fr'));

  const actives = all.filter(a => a.actif !== false);
  const totalInscrits = actResidents().reduce((n, r) => n + (r.activites || []).filter(i => i.statut === 'active').length, 0);
  const aujourdhui = actives.filter(a => a.jour === ACT_JOUR_AUJOURDHUI);
  document.getElementById('aStats').innerHTML = `
    <div class="chx-stat" style="--c:#2563eb"><div class="chx-stat-top"><span class="chx-stat-lbl">Activités actives</span></div><div class="chx-stat-num">${actives.length}</div></div>
    <div class="chx-stat" style="--c:#16a34a"><div class="chx-stat-top"><span class="chx-stat-lbl">Aujourd'hui (${ACT_JOUR_AUJOURDHUI})</span></div><div class="chx-stat-num">${aujourdhui.length}</div></div>
    <div class="chx-stat" style="--c:#0d9488"><div class="chx-stat-top"><span class="chx-stat-lbl">Inscriptions actives</span></div><div class="chx-stat-num">${totalInscrits}</div></div>
    <div class="chx-stat" style="--c:#e85d04"><div class="chx-stat-top"><span class="chx-stat-lbl">Bilans ce mois</span></div><div class="chx-stat-num">${actBilansCeMois()}</div></div>`;

  const el = document.getElementById('aGrid');
  if (!list.length) {
    el.innerHTML = `<div class="empty" style="padding:2.5rem"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></div><h3>Aucune activité</h3><p>Créez le catalogue des activités éducatives proposées aux résidents.</p></div>`;
    return;
  }
  el.innerHTML = `<div class="grid grid-3" style="gap:.85rem">${list.map(activiteCardGrille).join('')}</div>`;
}

// ── MODÈLE 1 — Grille premium (3 colonnes) ──
function activiteCardGrille(a) {
  const c = ACT_CATEGORIES[a.categorie] || ACT_CATEGORIES.autre;
  const inscrits = actInscriptions(a.id).length;
  const canEdit = (typeof canEditResidents === 'function') ? canEditResidents(Auth.getSession()?.userId) : Auth.isAdmin();
  const plein = a.placesMax > 0 && inscrits >= a.placesMax;
  const pct = a.placesMax > 0 ? Math.min(100, Math.round(inscrits / a.placesMax * 100)) : null;
  return `<div style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(15,23,42,.06);border:1px solid var(--border);overflow:hidden;display:flex;flex-direction:column;${a.actif===false?'opacity:.55':''}transition:box-shadow .12s" onmouseover="this.style.boxShadow='0 6px 20px rgba(15,23,42,.1)'" onmouseout="this.style.boxShadow='0 2px 12px rgba(15,23,42,.06)'">
    <div style="background:linear-gradient(135deg,${c.color}22,${c.color}08);border-bottom:1px solid ${c.color}22;padding:.9rem 1rem .75rem;display:flex;align-items:center;gap:.65rem">
      <div style="width:38px;height:38px;border-radius:10px;background:${c.color}18;border:1.5px solid ${c.color}33;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">${c.icon}</div>
      <div style="min-width:0;flex:1">
        <div style="font-weight:700;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(a.nom||'Activité')}</div>
        <div style="font-size:.68rem;font-weight:600;color:${c.color};margin-top:1px">${c.label}${a.actif===false?' · <span style="color:#dc2626">inactive</span>':''}</div>
      </div>
    </div>
    <div style="padding:.85rem 1rem;flex:1;display:flex;flex-direction:column;gap:.4rem">
      <div style="font-size:.78rem;color:var(--text);display:flex;flex-direction:column;gap:.2rem">
        ${a.jour?`<div style="display:flex;align-items:center;gap:.4rem">📅 <span>${escHtml(a.jour)}${a.heureDebut?' · '+a.heureDebut+(a.heureFin?'–'+a.heureFin:''):''}</span></div>`:''}
        ${a.lieu?`<div style="display:flex;align-items:center;gap:.4rem">📍 <span>${escHtml(a.lieu)}</span></div>`:''}
        ${a.animateur?`<div style="display:flex;align-items:center;gap:.4rem">👤 <span>${escHtml(a.animateur)}</span></div>`:''}
      </div>
      ${a.description?`<div style="font-size:.73rem;color:var(--muted);line-height:1.5;margin-top:.1rem">${escHtml(a.description)}</div>`:''}
      <div style="margin-top:auto;padding-top:.5rem">
        ${pct!==null?`<div style="height:4px;background:var(--g100);border-radius:2px;margin-bottom:.45rem;overflow:hidden"><div style="height:100%;width:${pct}%;background:${plein?'#dc2626':c.color};border-radius:2px;transition:width .3s"></div></div>`:''}
        <div style="display:flex;align-items:center;gap:.4rem">
          <span style="display:inline-flex;align-items:center;padding:2px 9px;border-radius:20px;font-size:.7rem;font-weight:600;background:${plein?'#fee2e2':c.color+'1a'};color:${plein?'#dc2626':c.color};border:1px solid ${plein?'#fecaca':c.color+'33'}">${inscrits}${a.placesMax>0?' / '+a.placesMax:''} inscrit${inscrits>1?'s':''}${plein?' · complet':''}</span>
          <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="openParticipantsModal('${a.id}')">👥 Participants</button>
          <button class="btn btn-ghost btn-sm" onclick="openBilanAnnuelModal('${a.id}')" title="Bilan annuel">📝${(a.bilansAnnuels||{})[new Date().getFullYear()]?' ✓':''}</button>
        </div>
      </div>
    </div>
    ${canEdit?`<div style="display:flex;gap:.3rem;justify-content:flex-end;border-top:1px solid var(--border);padding:.5rem .75rem;background:var(--g50)">
      <button class="btn btn-ghost btn-sm" onclick="toggleActiviteActif('${a.id}')">${a.actif===false?'▶ Réactiver':'⏸ Suspendre'}</button>
      <button class="btn btn-ghost btn-sm" onclick="openActiviteModal('${a.id}')">✎</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteActivite('${a.id}')">✕</button>
    </div>`:''}
  </div>`;
}

// ── CRUD CATALOGUE ──
function openActiviteModal(id) {
  actEditId = id || null;
  const a = id ? getActivites().find(x => x.id === id) || {} : {};
  document.getElementById('amTitle').textContent = id ? "Modifier l'activité" : 'Nouvelle activité';
  document.getElementById('amNom').value = a.nom || '';
  document.getElementById('amCategorie').value = a.categorie || 'sportive';
  document.getElementById('amJour').value = a.jour || 'Ponctuel';
  document.getElementById('amHeureDebut').value = a.heureDebut || '';
  document.getElementById('amHeureFin').value = a.heureFin || '';
  document.getElementById('amLieu').value = a.lieu || '';
  document.getElementById('amAnimateur').value = a.animateur || '';
  document.getElementById('amPlacesMax').value = a.placesMax || '';
  document.getElementById('amDescription').value = a.description || '';
  openModal('modalActivite');
}

async function saveActivite() {
  const nom = document.getElementById('amNom').value.trim();
  if (!nom) { toast('Le nom est requis', 'error'); return; }
  const data = {
    nom,
    categorie: document.getElementById('amCategorie').value,
    jour: document.getElementById('amJour').value,
    heureDebut: document.getElementById('amHeureDebut').value,
    heureFin: document.getElementById('amHeureFin').value,
    lieu: document.getElementById('amLieu').value.trim(),
    animateur: document.getElementById('amAnimateur').value.trim(),
    placesMax: parseInt(document.getElementById('amPlacesMax').value, 10) || 0,
    description: document.getElementById('amDescription').value.trim()
  };
  try {
    if (actEditId) {
      const old = _actCache.find(x => x.id === actEditId) || {};
      const saved = await sbSaveActivite({ ...old, ...data, id: actEditId });
      _actCache = _actCache.map(x => x.id === actEditId ? saved : x);
      toast('Activité mise à jour');
    } else {
      const saved = await sbSaveActivite({ ...data, actif: true });
      _actCache.push(saved);
      toast('Activité créée ✓');
    }
  } catch (e) { console.error('[saveActivite]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
  if (typeof auditLog === 'function') auditLog('activite_save', `Activité — ${nom}`);
  closeModal('modalActivite');
  renderActivites();
}

async function toggleActiviteActif(id) {
  const old = _actCache.find(x => x.id === id);
  if (!old) return;
  try {
    const saved = await sbSaveActivite({ ...old, actif: old.actif === false, id });
    _actCache = _actCache.map(x => x.id === id ? saved : x);
  } catch (e) { console.error('[toggleActiviteActif]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
  renderActivites();
}

// ── BILAN ANNUEL (rédigé par l'éducateur, repris dans le rapport d'activité) ──
let baActiviteId = null;

function openBilanAnnuelModal(activiteId) {
  baActiviteId = activiteId;
  const annee = document.getElementById('baAnnee');
  const nowY = new Date().getFullYear();
  annee.innerHTML = Array.from({ length: 6 }, (_, i) => nowY - 4 + i).map(y => `<option value="${y}">${y}</option>`).join('');
  annee.value = nowY;
  const a = getActivites().find(x => x.id === activiteId);
  document.getElementById('baTitle').textContent = '📝 Bilan annuel — ' + (a?.nom || 'Activité');
  renderBilanAnnuelForm();
  openModal('modalBilanAnnuel');
}

function renderBilanAnnuelForm() {
  const a = getActivites().find(x => x.id === baActiviteId);
  const annee = document.getElementById('baAnnee').value;
  const bilan = (a?.bilansAnnuels || {})[annee];
  document.getElementById('baTexte').value = bilan?.texte || '';
  document.getElementById('baMeta').textContent = bilan ? `Dernière mise à jour par ${bilan.auteur || '?'} le ${formatDate(bilan.date)}` : 'Aucun bilan rédigé pour cette année.';
}

async function saveBilanAnnuel() {
  const annee = document.getElementById('baAnnee').value;
  const texte = document.getElementById('baTexte').value.trim();
  if (!texte) { toast('Le bilan est vide', 'error'); return; }
  const session = Auth.getSession();
  const auteur = session ? ([session.prenom, session.nom].filter(Boolean).join(' ') || session.username) : 'Anonyme';
  const old = _actCache.find(x => x.id === baActiviteId);
  if (!old) return;
  const bilansAnnuels = { ...(old.bilansAnnuels || {}), [annee]: { texte, auteur, authorId: session?.userId, date: today() } };
  try {
    const saved = await sbSaveActivite({ ...old, bilansAnnuels, id: baActiviteId });
    _actCache = _actCache.map(x => x.id === baActiviteId ? saved : x);
  } catch (e) { console.error('[saveBilanAnnuel]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
  if (typeof auditLog === 'function') auditLog('activite_bilan_annuel', `Bilan annuel ${annee} — ${old.nom || ''}`);
  toast('Bilan annuel enregistré ✓', 'success');
  closeModal('modalBilanAnnuel');
  renderActivites();
}

function deleteActivite(id) {
  confirmDialog('Supprimer cette activité du catalogue ? Les inscriptions existantes seront conservées sur les fiches résidents.', async () => {
    try {
      await sbDeleteActivite(id);
      _actCache = _actCache.filter(x => x.id !== id);
    } catch (e) { console.error('[deleteActivite]', e); toast('Erreur suppression : ' + (e?.message || e), 'error'); return; }
    renderActivites();
    toast('Activité supprimée', 'info');
  });
}

// ── PARTICIPANTS & INSCRIPTIONS ──
function openParticipantsModal(id) {
  actParticipantsId = id;
  const a = getActivites().find(x => x.id === id);
  if (!a) return;
  const c = ACT_CATEGORIES[a.categorie] || ACT_CATEGORIES.autre;
  document.getElementById('pmTitle').textContent = `${c.icon} ${a.nom}`;
  const inscrits = actInscriptions(id);
  const inscritIds = new Set(inscrits.map(x => String(x.resident.id)));
  const opts = actResidents().filter(r => !inscritIds.has(String(r.id)))
    .map(r => `<option value="${r.id}">${escHtml(`${r.prenom || ''} ${r.nom || ''}`.trim())}</option>`).join('');
  document.getElementById('pmAddResident').innerHTML = '<option value="">— Inscrire un résident —</option>' + opts;
  renderParticipantsList(inscrits, a);
  openModal('modalParticipants');
}

function renderParticipantsList(inscrits, activite) {
  const box = document.getElementById('pmList');
  const stats = document.getElementById('pmStats');

  const totalBilans = inscrits.reduce((n, { inscription: i }) => n + (i.bilans || []).length, 0);
  const places = activite?.placesMax || 0;
  const placesColor = places>0&&inscrits.length>=places ? '#dc2626' : '#16a34a';
  const placesBg   = places>0&&inscrits.length>=places ? '#fee2e2' : '#f0fdf4';
  if (stats) stats.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
      <div style="background:#eef2ff;border:1.5px solid #c7d2fe;border-radius:12px;padding:14px 10px;text-align:center">
        <div style="font-size:26px;font-weight:700;color:#4338ca;line-height:1">${inscrits.length}</div>
        <div style="font-size:12px;font-weight:600;color:#6366f1;margin-top:5px">Inscrits</div>
      </div>
      <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:14px 10px;text-align:center">
        <div style="font-size:26px;font-weight:700;color:#15803d;line-height:1">${totalBilans}</div>
        <div style="font-size:12px;font-weight:600;color:#16a34a;margin-top:5px">Bilans</div>
      </div>
      <div style="background:${placesBg};border:1.5px solid ${placesColor}44;border-radius:12px;padding:14px 10px;text-align:center">
        <div style="font-size:26px;font-weight:700;color:${placesColor};line-height:1">${places>0?inscrits.length+'/'+places:'∞'}</div>
        <div style="font-size:12px;font-weight:600;color:${placesColor};margin-top:5px">Places</div>
      </div>
    </div>`;

  if (!inscrits.length) {
    box.innerHTML = '<div style="font-size:.8rem;color:var(--muted);padding:.75rem 0;text-align:center;font-style:italic">Aucun résident inscrit pour le moment.</div>';
    return;
  }

  box.innerHTML = `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">${inscrits.map(({ resident: r, inscription: i }) => {
    const lastBilan = (i.bilans || []).slice().sort((x, y) => (y.date || '').localeCompare(x.date || ''))[0];
    const nbBilans = (i.bilans || []).length;
    const color = r.color || '#6366f1';
    const name = `${r.prenom || ''} ${r.nom || ''}`.trim();
    const av = r.photo
      ? `<img src="${sanitizeUrl(r.photo)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid ${color}44" alt=""/>`
      : `<div style="width:28px;height:28px;border-radius:50%;background:${color}18;color:${color};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;flex-shrink:0">${initials(r.prenom,r.nom)}</div>`;
    return `<div style="border-radius:12px;border:1px solid var(--border);overflow:hidden">
      <div style="height:3px;background:${color}"></div>
      <div style="padding:10px 12px">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px">
          ${av}
          <a href="resident.html?id=${r.id}" style="font-size:13px;font-weight:600;color:var(--text);text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(name)}</a>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:6px">Depuis ${formatDate(i.dateInscription)}${nbBilans?` · <span style="background:#eef2ff;color:#4338ca;padding:1px 6px;border-radius:20px;font-weight:500">${nbBilans} bilan${nbBilans>1?'s':''}</span>`:''}</div>
        ${lastBilan
          ? `<div style="font-size:11px;color:var(--muted);padding:5px 7px;border-radius:7px;background:var(--g50)"><span style="color:#6366f1;font-weight:600">${formatDate(lastBilan.date)}</span> — ${escHtml((lastBilan.texte||'').slice(0,80))}${(lastBilan.texte||'').length>80?'…':''}</div>`
          : `<div style="font-size:11px;color:var(--muted);font-style:italic;opacity:.65">Aucun bilan rédigé</div>`}
        <div style="margin-top:8px;text-align:right">
          <button class="btn btn-ghost btn-sm" style="color:var(--red);font-size:.7rem;padding:2px 8px" title="Mettre fin à l'inscription" onclick="desinscrireResident('${r.id}','${i.id}')">↩ Désinscrire</button>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

async function inscrireResident() {
  const rid = document.getElementById('pmAddResident').value;
  if (!rid) { toast('Choisissez un résident', 'error'); return; }
  const r = residentsList().find(x => String(x.id) === String(rid));
  if (!r) return;
  const inscription = { id: genId(), activiteId: actParticipantsId, dateInscription: today(), statut: 'active', bilans: [] };
  await persistResident({ ...r, activites: [...(r.activites || []), inscription] });
  if (typeof auditLog === 'function') auditLog('activite_inscription', `Inscription — ${(r.prenom || '') + ' ' + (r.nom || '')} → ${(getActivites().find(a => a.id === actParticipantsId) || {}).nom || ''}`);
  toast('Résident inscrit ✓');
  openParticipantsModal(actParticipantsId);
  renderActivites();
}

function desinscrireResident(residentId, inscriptionId) {
  confirmDialog("Mettre fin à l'inscription de ce résident à l'activité ?", async () => {
    const r = residentsList().find(x => String(x.id) === String(residentId));
    if (!r) return;
    const activites = (r.activites || []).map(i => i.id === inscriptionId ? { ...i, statut: 'terminee', dateFin: today() } : i);
    await persistResident({ ...r, activites });
    toast('Inscription terminée', 'info');
    openParticipantsModal(actParticipantsId);
    renderActivites();
  });
}

// ── INIT ──
async function initActivites() {
  const s = Auth.requireAuth();
  if (!s) return;
  if (!requireModule('access_activites')) return;
  await loadResidentsCache();
  await loadActivitesCache();
  document.getElementById('aFilterCat').innerHTML = '<option value="">Toutes catégories</option>' + Object.entries(ACT_CATEGORIES).map(([k, c]) => `<option value="${k}">${c.icon} ${c.label}</option>`).join('');
  document.getElementById('aFilterJour').innerHTML = '<option value="">Tous les jours</option>' + ACT_JOURS.map(j => `<option value="${j}">${j}</option>`).join('');
  document.getElementById('amCategorie').innerHTML = Object.entries(ACT_CATEGORIES).map(([k, c]) => `<option value="${k}">${c.icon} ${c.label}</option>`).join('');
  document.getElementById('amJour').innerHTML = ACT_JOURS.map(j => `<option value="${j}">${j}</option>`).join('');
  const canEdit = (typeof canEditResidents === 'function') ? canEditResidents(s.userId) : Auth.isAdmin();
  if (!canEdit) { const b = document.getElementById('btnAddActivite'); if (b) b.style.display = 'none'; }
  ['aFilterCat', 'aFilterJour'].forEach(id => document.getElementById(id)?.addEventListener('change', renderActivites));
  renderActivites();
}
document.addEventListener('DOMContentLoaded', initActivites);
