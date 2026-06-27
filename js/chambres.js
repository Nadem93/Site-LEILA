// ── PLAN DES CHAMBRES ──
let chEditId = null;
let edlChambreId = null;

// Source = Supabase. Cache mémoire chargé au démarrage (lecture synchrone pour le rendu).
let _chCache = [];
let _edlCache = [];
function getChambres() { return _chCache; }
function getEdl() { return _edlCache; }
async function loadChambresCache() { _chCache = await sbGetChambres(); }
async function loadEdlCache() { _edlCache = await sbGetEdl(); }

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

// Crée automatiquement les chambres présentes sur les fiches résidents
async function seedChambresFromResidents() {
  const known = new Set(getChambres().map(c => (c.nom || '').toLowerCase()));
  const residents = residentsList();
  const manquantes = [...new Set(residents.map(r => (r.chambre || '').trim()).filter(Boolean))]
    .filter(nom => !known.has(nom.toLowerCase()));
  for (const nom of manquantes) {
    const saved = await sbSaveChambre({ nom, unite: '', capacite: 1, notes: '' });
    _chCache.push(saved);
  }
  return manquantes.length;
}

function chOccupants(room) {
  const residents = residentsList();
  return residents.filter(r => r.statut !== 'sorti' && (r.chambre || '').trim().toLowerCase() === (room.nom || '').trim().toLowerCase());
}

function renderChambres() {
  const rooms = getChambres();
  const canEdit = (typeof canEditResidents === 'function') ? canEditResidents(Auth.getSession()?.userId) : Auth.isAdmin();
  const totalLits = rooms.reduce((a, c) => a + (parseInt(c.capacite) || 1), 0);
  let occupes = 0;
  rooms.forEach(c => { occupes += chOccupants(c).length; });

  const st = document.getElementById('chStats');
  if (st) {
    const nbUnites = new Set(rooms.map(c => (c.unite || '').trim() || 'Sans unité')).size;
    const libres = Math.max(totalLits - occupes, 0);
    const occRate = totalLits ? Math.round(occupes / totalLits * 100) : 0;
    const freeRate = totalLits ? Math.round(libres / totalLits * 100) : 0;
    const ico = {
      ch:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
      lit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/></svg>',
      occ: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      lib: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
    };
    st.innerHTML = `
      <div class="chx-stat" style="--c:#2563eb"><div class="chx-stat-top"><span class="chx-stat-lbl">Chambres</span><span class="chx-stat-ico">${ico.ch}</span></div><div class="chx-stat-num">${rooms.length}</div><div class="chx-stat-sub">${nbUnites} unité${nbUnites > 1 ? 's' : ''}</div></div>
      <div class="chx-stat" style="--c:#7c3aed"><div class="chx-stat-top"><span class="chx-stat-lbl">Lits</span><span class="chx-stat-ico">${ico.lit}</span></div><div class="chx-stat-num">${totalLits}</div><div class="chx-stat-sub">Capacité d'accueil</div></div>
      <div class="chx-stat" style="--c:#16a34a"><div class="chx-stat-top"><span class="chx-stat-lbl">Occupés</span><span class="chx-stat-ico">${ico.occ}</span></div><div class="chx-stat-num">${occupes}</div><div class="chx-stat-bar"><i style="width:${occRate}%"></i></div><div class="chx-stat-sub">${occRate}% d'occupation</div></div>
      <div class="chx-stat" style="--c:#0d9488"><div class="chx-stat-top"><span class="chx-stat-lbl">Libres</span><span class="chx-stat-ico">${ico.lib}</span></div><div class="chx-stat-num">${libres}</div><div class="chx-stat-bar"><i style="width:${freeRate}%"></i></div><div class="chx-stat-sub">${freeRate}% disponibles</div></div>`;
  }

  const el = document.getElementById('chGrid');
  if (!rooms.length) {
    el.innerHTML = `<div class="empty" style="padding:2.5rem;grid-column:1/-1"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div><h3>Aucune chambre</h3><p>Créez vos chambres ou importez-les depuis les fiches résidents.</p>${canEdit ? '<button class="btn btn-accent" onclick="openChambreModal()">+ Nouvelle chambre</button>' : ''}</div>`;
    return;
  }

  // Regroupement par unité
  const groups = {};
  rooms.forEach(c => { const u = (c.unite || '').trim() || 'Sans unité'; (groups[u] = groups[u] || []).push(c); });
  const sortRooms = (a, b) => String(a.nom).localeCompare(String(b.nom), 'fr', { numeric: true });

  el.innerHTML = Object.keys(groups).sort().map(unite => `
    <div style="grid-column:1/-1">
      <div class="section-label" style="margin:1rem 0 .6rem">🏢 ${escHtml(unite)} <span class="badge badge-gray">${groups[unite].length}</span></div>
      <div class="grid grid-4" style="gap:.8rem">
        ${groups[unite].sort(sortRooms).map(c => chRoomCard(c, canEdit)).join('')}
      </div>
    </div>`).join('');
}

function chRoomCard(c, canEdit) {
  const occ = chOccupants(c);
  const cap = parseInt(c.capacite) || 1;
  const full = occ.length >= cap;
  const over = occ.length > cap;
  const stateColor = over ? '#dc2626' : full ? '#d97706' : '#16a34a';
  const stateLabel = over ? 'Sur-occupée' : full ? 'Complète' : occ.length ? `${cap - occ.length} lit(s) libre(s)` : 'Libre';
  const chips = occ.map(r => `
    <div onclick="event.stopPropagation();location.href='resident.html?id=${r.id}'" title="Ouvrir la fiche" style="display:flex;align-items:center;gap:.4rem;padding:.25rem .55rem .25rem .3rem;border-radius:99px;background:${(r.color || '#3b82f6')}14;border:1px solid ${(r.color || '#3b82f6')}33;cursor:pointer;max-width:100%">
      <span style="width:20px;height:20px;border-radius:50%;background:${r.color || '#3b82f6'};color:#fff;font-size:.6rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${initials(r.prenom, r.nom)}</span>
      <span style="font-size:.72rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(`${r.prenom || ''} ${r.nom || ''}`.trim())}</span>
    </div>`).join('');
  return `<div class="card" style="border-left:3px solid ${stateColor}">
    <div class="card-body" style="padding:.9rem 1rem;display:flex;flex-direction:column;gap:.55rem">
      <div style="display:flex;align-items:center;gap:.5rem">
        <span style="font-family:var(--display);font-weight:700;font-size:1.05rem;color:var(--primary)">Ch. ${escHtml(c.nom)}</span>
        <span class="badge" style="margin-left:auto;background:${stateColor}1a;color:${stateColor}">${occ.length}/${cap}</span>
      </div>
      <div style="font-size:.72rem;color:${stateColor};font-weight:600">${stateLabel}</div>
      <div style="display:flex;flex-direction:column;gap:.3rem;min-height:26px">${chips || '<span style="font-size:.74rem;color:var(--g400)">Aucun occupant</span>'}</div>
      ${c.notes ? `<div style="font-size:.7rem;color:var(--muted)">📌 ${escHtml(c.notes)}</div>` : ''}
      ${canEdit ? `<div class="no-print" style="display:flex;gap:.3rem;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:.5rem">
        <button class="btn btn-ghost btn-sm" onclick="openAssignModal('${c.id}')" title="Attribuer un lit">＋ Attribuer</button>
        <button class="btn btn-ghost btn-sm" onclick="openEdlModal('${c.id}')" title="États des lieux">📋 EDL</button>
        <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="openChambreModal('${c.id}')">✎</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteChambre('${c.id}')">✕</button>
      </div>` : ''}
    </div>
  </div>`;
}

// ── CRUD chambre ──
function openChambreModal(id) {
  chEditId = id || null;
  const c = id ? getChambres().find(x => x.id === id) || {} : {};
  document.getElementById('chModalTitle').textContent = id ? `Modifier la chambre ${c.nom || ''}` : 'Nouvelle chambre';
  document.getElementById('chNom').value = c.nom || '';
  document.getElementById('chUnite').value = c.unite || '';
  document.getElementById('chCapacite').value = c.capacite || 1;
  document.getElementById('chNotes').value = c.notes || '';
  openModal('modalChambre');
}

async function saveChambre() {
  const nom = document.getElementById('chNom').value.trim();
  if (!nom) { toast('Le numéro / nom de la chambre est requis', 'error'); return; }
  const data = {
    nom,
    unite: document.getElementById('chUnite').value.trim(),
    capacite: Math.max(parseInt(document.getElementById('chCapacite').value) || 1, 1),
    notes: document.getElementById('chNotes').value.trim()
  };
  try {
    if (chEditId) {
      const old = getChambres().find(x => x.id === chEditId);
      // Si renommage : suivre les résidents affectés
      if (old && old.nom !== data.nom) {
        const cible = residentsList().filter(r => (r.chambre || '').trim().toLowerCase() === old.nom.trim().toLowerCase());
        for (const r of cible) await persistResident({ ...r, chambre: data.nom });
      }
      const saved = await sbSaveChambre({ id: chEditId, ...data });
      _chCache = _chCache.map(x => x.id === chEditId ? saved : x);
      toast('Chambre mise à jour');
    } else {
      const saved = await sbSaveChambre(data);
      _chCache.push(saved);
      toast('Chambre créée');
    }
  } catch (e) {
    console.error('[saveChambre]', e);
    toast('Erreur enregistrement : ' + (e?.message || e), 'error');
    return;
  }
  if (typeof auditLog === 'function') auditLog('chambre_save', `Chambre ${data.nom}`);
  closeModal('modalChambre');
  renderChambres();
}

function deleteChambre(id) {
  const c = getChambres().find(x => x.id === id);
  if (!c) return;
  const occ = chOccupants(c);
  confirmDialog(`Supprimer la chambre ${c.nom} ?${occ.length ? `\n${occ.length} résident(s) y sont affectés — leur champ chambre sera vidé.` : ''}`, async () => {
    try {
      if (occ.length) {
        for (const o of occ) {
          const r = residentsList().find(x => String(x.id) === String(o.id));
          if (r) await persistResident({ ...r, chambre: '' });
        }
      }
      await sbDeleteChambre(id);
      _chCache = _chCache.filter(x => x.id !== id);
    } catch (e) {
      console.error('[deleteChambre]', e);
      toast('Erreur suppression : ' + (e?.message || e), 'error');
      return;
    }
    if (typeof auditLog === 'function') auditLog('chambre_delete', `Chambre ${c.nom}`);
    renderChambres();
    toast('Chambre supprimée', 'info');
  });
}

// ── Attribution ──
function openAssignModal(id) {
  const c = getChambres().find(x => x.id === id);
  if (!c) return;
  chEditId = id;
  const residents = residentsList().filter(r => r.statut !== 'sorti');
  const occ = chOccupants(c).map(o => o.id);
  document.getElementById('asTitle').textContent = `Attribuer un lit — Chambre ${c.nom}`;
  document.getElementById('asResident').innerHTML = '<option value="">— Choisir un résident —</option>' +
    residents.filter(r => !occ.includes(r.id)).map(r => {
      const cur = (r.chambre || '').trim();
      return `<option value="${r.id}">${escHtml(`${r.prenom || ''} ${r.nom || ''}`.trim())}${cur ? ` (act. Ch. ${escHtml(cur)})` : ' (sans chambre)'}</option>`;
    }).join('');
  // Liste des occupants avec retrait
  const occList = chOccupants(c);
  document.getElementById('asOccupants').innerHTML = occList.length ? occList.map(r => `
    <div style="display:flex;align-items:center;gap:.6rem;padding:.5rem .7rem;background:var(--g50);border:1px solid var(--border);border-radius:var(--r-sm)">
      <span style="flex:1;font-size:.85rem;font-weight:600">${escHtml(`${r.prenom || ''} ${r.nom || ''}`.trim())}</span>
      <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="unassignResident('${r.id}')">Retirer</button>
    </div>`).join('') : '<div style="font-size:.8rem;color:var(--g400);padding:.4rem 0">Aucun occupant</div>';
  openModal('modalAssign');
}

async function assignResident() {
  const rid = document.getElementById('asResident').value;
  const c = getChambres().find(x => x.id === chEditId);
  if (!rid || !c) { toast('Choisissez un résident', 'error'); return; }
  const r = residentsList().find(x => String(x.id) === String(rid));
  if (r) await persistResident({ ...r, chambre: c.nom });
  if (typeof auditLog === 'function') auditLog('chambre_assign', `Attribution Ch. ${c.nom}`);
  toast('Lit attribué ✓');
  openAssignModal(chEditId);
  renderChambres();
}

async function unassignResident(rid) {
  const r = residentsList().find(x => String(x.id) === String(rid));
  if (r) await persistResident({ ...r, chambre: '' });
  toast('Résident retiré de la chambre', 'info');
  openAssignModal(chEditId);
  renderChambres();
}

// ── États des lieux ──
const EDL_ITEMS = [['murs', 'Murs / peinture'], ['sol', 'Sol'], ['mobilier', 'Mobilier'], ['literie', 'Literie'], ['sanitaires', 'Sanitaires']];
const EDL_NIVEAUX = ['Bon', 'Moyen', 'Dégradé'];

function openEdlModal(id) {
  const c = getChambres().find(x => x.id === id);
  if (!c) return;
  edlChambreId = id;
  document.getElementById('edlTitle').textContent = `États des lieux — Chambre ${c.nom}`;
  const residents = residentsList().filter(r => r.statut !== 'sorti');
  document.getElementById('edlResident').innerHTML = '<option value="">— Résident concerné —</option>' +
    residents.map(r => `<option value="${r.id}">${escHtml(`${r.prenom || ''} ${r.nom || ''}`.trim())}</option>`).join('');
  document.getElementById('edlItems').innerHTML = EDL_ITEMS.map(([k, label]) => `
    <div style="display:flex;align-items:center;gap:.6rem">
      <label style="flex:1;margin:0;font-size:.8rem">${label}</label>
      <select id="edl_${k}" class="form-input" style="width:140px">${EDL_NIVEAUX.map(n => `<option>${n}</option>`).join('')}</select>
    </div>`).join('');
  document.getElementById('edlObs').value = '';
  renderEdlHistory(c);
  openModal('modalEdl');
}

function renderEdlHistory(c) {
  const hist = getEdl().filter(e => e.chambreId === c.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  document.getElementById('edlHistory').innerHTML = hist.length ? hist.map(e => `
    <details style="border:1px solid var(--border);border-radius:var(--r-sm);padding:.45rem .7rem">
      <summary style="cursor:pointer;font-size:.8rem;font-weight:600;list-style:none;display:flex;gap:.5rem;align-items:center">
        <span class="badge ${e.type === 'entree' ? 'badge-green' : 'badge-amber'}">${e.type === 'entree' ? 'Entrée' : 'Sortie'}</span>
        ${formatDate(e.date)} · ${escHtml(e.residentName || '—')}
      </summary>
      <div style="font-size:.76rem;color:var(--g700);margin-top:.4rem;line-height:1.7">
        ${EDL_ITEMS.map(([k, label]) => `${label} : <strong>${escHtml((e.etat || {})[k] || '—')}</strong>`).join(' · ')}
        ${e.observations ? `<br>📝 ${escHtml(e.observations)}` : ''}
        <br><span style="color:var(--muted)">Par ${escHtml(e.author || '?')}</span>
      </div>
    </details>`).join('') : '<div style="font-size:.78rem;color:var(--g400)">Aucun état des lieux enregistré</div>';
}

async function saveEdlEntry() {
  const c = getChambres().find(x => x.id === edlChambreId);
  if (!c) return;
  const rid = document.getElementById('edlResident').value;
  const residents = residentsList();
  const r = residents.find(x => String(x.id) === String(rid));
  const s = Auth.getSession();
  const etat = {};
  EDL_ITEMS.forEach(([k]) => { etat[k] = document.getElementById('edl_' + k).value; });
  try {
    const saved = await sbSaveEdl({
      chambreId: c.id, chambreNom: c.nom,
      residentId: rid || null, residentName: r ? `${r.prenom || ''} ${r.nom || ''}`.trim() : '',
      type: document.getElementById('edlType').value,
      date: document.getElementById('edlDate').value || today(),
      etat, observations: document.getElementById('edlObs').value.trim(),
      author: s ? `${s.prenom || ''} ${s.nom || ''}`.trim() || s.username : '?'
    });
    _edlCache.unshift(saved);
  } catch (e) {
    console.error('[saveEdlEntry]', e);
    toast('Erreur enregistrement EDL : ' + (e?.message || e), 'error');
    return;
  }
  if (typeof auditLog === 'function') auditLog('edl_save', `EDL Ch. ${c.nom}`);
  toast('État des lieux enregistré ✓');
  renderEdlHistory(c);
  document.getElementById('edlObs').value = '';
}

// ── INIT ──
async function initChambres() {
  const s = Auth.requireAuth();
  if (!s) return;
  if (!requireModule('view_residents')) return;
  await loadResidentsCache();
  await Promise.all([loadChambresCache(), loadEdlCache()]);
  const added = await seedChambresFromResidents();
  if (added) toast(`${added} chambre(s) importée(s) depuis les fiches résidents`, 'info');
  const canEdit = (typeof canEditResidents === 'function') ? canEditResidents(s.userId) : Auth.isAdmin();
  const addBtn = document.getElementById('btnAddChambre');
  if (addBtn && !canEdit) addBtn.style.display = 'none';
  const d = document.getElementById('edlDate');
  if (d) d.value = today();
  renderChambres();
}
document.addEventListener('DOMContentLoaded', initChambres);
