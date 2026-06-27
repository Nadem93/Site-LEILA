// ── ÉCHÉANCIER ADMINISTRATIF ──
// Renouvellements MDPH, jugements, CNI, CSS, contrats… avec alertes J-90 / J-30
let ecEditId = null;

const EC_TYPES = {
  mdph: { label: 'Notification MDPH', icon: '🧾' },
  jugement: { label: 'Jugement / mesure', icon: '⚖️' },
  identite: { label: "Pièce d'identité", icon: '🪪' },
  css: { label: 'CSS / mutuelle', icon: '🏥' },
  contrat: { label: 'Contrat de séjour', icon: '📜' },
  ppe: { label: 'Révision PPE', icon: '📄' },
  medical: { label: 'Visite médicale', icon: '🩺' },
  cvs_mandat: { label: 'Fin de mandat CVS', icon: '🗳️' },
  autre: { label: 'Autre', icon: '📌' }
};

// Source = Supabase. Cache mémoire chargé au démarrage.
let _ecCache = [];
function getEcheances() { return _ecCache; }
async function loadEcheancesCache() { _ecCache = await sbGetEcheances(); }

// Urgence d'une échéance : retard / 30 j / 90 j / ok
function ecUrgency(e) {
  if (e.done) return 'done';
  const d = (e.date || '') ;
  const td = today();
  if (d < td) return 'late';
  const diff = Math.ceil((new Date(d) - new Date(td)) / 86400000);
  if (diff <= 30) return 'soon';
  if (diff <= 90) return 'watch';
  return 'ok';
}
const EC_URG = {
  late: { label: 'En retard', color: '#dc2626', bg: '#fef2f2', bd: '#fecaca' },
  soon: { label: 'Sous 30 jours', color: '#d97706', bg: '#fffbeb', bd: '#fde68a' },
  watch: { label: 'Sous 90 jours', color: '#0891b2', bg: '#ecfeff', bd: '#a5f3fc' },
  ok: { label: 'À venir', color: '#16a34a', bg: '#f0fdf4', bd: '#bbf7d0' },
  done: { label: 'Fait', color: '#64748b', bg: '#f8fafc', bd: '#e2e8f0' }
};

function ecDaysLabel(e) {
  if (e.done) return 'traité';
  const diff = Math.ceil((new Date(e.date) - new Date(today())) / 86400000);
  if (diff < 0) return `${Math.abs(diff)} j de retard`;
  if (diff === 0) return "aujourd'hui";
  return `dans ${diff} j`;
}

function renderEcheances() {
  const all = getEcheances();
  const showDone = document.getElementById('ecShowDone')?.checked;
  const fRes = document.getElementById('ecFilterResident')?.value || '';
  const fType = document.getElementById('ecFilterType')?.value || '';

  let list = all.filter(e => showDone || !e.done);
  if (fRes) list = list.filter(e => String(e.residentId) === String(fRes));
  if (fType) list = list.filter(e => e.type === fType);

  // Stats sur l'ensemble (non filtré, hors faits)
  const active = all.filter(e => !e.done);
  const counts = { late: 0, soon: 0, watch: 0, ok: 0 };
  active.forEach(e => { counts[ecUrgency(e)] = (counts[ecUrgency(e)] || 0) + 1; });
  const st = document.getElementById('ecStats');
  if (st) st.innerHTML = ['late', 'soon', 'watch', 'ok'].map(k => `
    <div class="chx-stat" style="--c:${EC_URG[k].color}">
      <div class="chx-stat-top"><span class="chx-stat-lbl">${EC_URG[k].label}</span></div>
      <div class="chx-stat-num">${counts[k]}</div>
    </div>`).join('');

  // Tri : retard d'abord puis par date croissante ; faits à la fin
  const order = { late: 0, soon: 1, watch: 2, ok: 3, done: 4 };
  list.sort((a, b) => (order[ecUrgency(a)] - order[ecUrgency(b)]) || (a.date || '').localeCompare(b.date || ''));

  const canEdit = (typeof canEditResidents === 'function') ? canEditResidents(Auth.getSession()?.userId) : Auth.isAdmin();
  const el = document.getElementById('ecList');
  if (!list.length) {
    el.innerHTML = `<div class="empty" style="padding:2.5rem"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><h3>Aucune échéance</h3><p>Ajoutez les renouvellements à suivre (MDPH, jugements, CNI…).</p>${canEdit ? '<button class="btn btn-accent" onclick="openEcheanceModal()">+ Nouvelle échéance</button>' : ''}</div>`;
    return;
  }
  el.innerHTML = list.map(e => {
    const u = ecUrgency(e), c = EC_URG[u], t = EC_TYPES[e.type] || EC_TYPES.autre;
    return `<div class="card" style="border-left:3px solid ${c.color};${e.done ? 'opacity:.65' : ''}">
      <div class="card-body" style="padding:.8rem 1rem;display:flex;align-items:center;gap:.85rem;flex-wrap:wrap">
        <span style="font-size:1.3rem;flex-shrink:0">${t.icon}</span>
        <div style="flex:1;min-width:200px">
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
            <span style="font-weight:700;font-size:.88rem">${escHtml(e.libelle || t.label)}</span>
            <span class="badge" style="background:${c.bg};color:${c.color};border:1px solid ${c.bd}">${c.label}</span>
          </div>
          <div style="font-size:.75rem;color:var(--muted);margin-top:2px">
            ${t.label}${e.residentName ? ` · <a href="resident.html?id=${e.residentId}" style="color:var(--accent);text-decoration:none">${escHtml(e.residentName)}</a>` : ''}
            ${e.notes ? ` · ${escHtml(e.notes)}` : ''}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:var(--display);font-weight:700;color:${c.color}">${formatDate(e.date)}</div>
          <div style="font-size:.7rem;color:var(--muted)">${ecDaysLabel(e)}</div>
        </div>
        ${canEdit ? `<div class="no-print" style="display:flex;gap:.25rem;flex-shrink:0">
          ${!e.done ? `<button class="btn btn-ghost btn-sm" style="color:var(--green)" title="Marquer comme traité" onclick="toggleEcheanceDone('${e.id}')">✓</button>` : `<button class="btn btn-ghost btn-sm" title="Réactiver" onclick="toggleEcheanceDone('${e.id}')">↩</button>`}
          <button class="btn btn-ghost btn-sm" onclick="openEcheanceModal('${e.id}')">✎</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteEcheance('${e.id}')">✕</button>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function openEcheanceModal(id) {
  ecEditId = id || null;
  const e = id ? getEcheances().find(x => x.id === id) || {} : {};
  document.getElementById('ecModalTitle').textContent = id ? "Modifier l'échéance" : 'Nouvelle échéance';
  document.getElementById('ecType').value = e.type || 'mdph';
  document.getElementById('ecLibelle').value = e.libelle || '';
  document.getElementById('ecDate').value = e.date || '';
  document.getElementById('ecResident').value = e.residentId || '';
  document.getElementById('ecNotes').value = e.notes || '';
  openModal('modalEcheance');
}

async function saveEcheance() {
  const date = document.getElementById('ecDate').value;
  if (!date) { toast("La date d'échéance est requise", 'error'); return; }
  const rid = document.getElementById('ecResident').value;
  const r = sbResidents().find(x => String(x.id) === String(rid));
  const s = Auth.getSession();
  const data = {
    type: document.getElementById('ecType').value,
    libelle: document.getElementById('ecLibelle').value.trim(),
    date,
    residentId: rid || null,
    residentName: r ? `${r.prenom || ''} ${r.nom || ''}`.trim() : '',
    notes: document.getElementById('ecNotes').value.trim()
  };
  try {
    if (ecEditId) {
      const old = _ecCache.find(x => x.id === ecEditId) || {};
      const saved = await sbSaveEcheance({ ...old, ...data, id: ecEditId });
      _ecCache = _ecCache.map(x => x.id === ecEditId ? saved : x);
      toast('Échéance mise à jour');
    } else {
      const saved = await sbSaveEcheance({ ...data, done: false, author: s ? `${s.prenom || ''} ${s.nom || ''}`.trim() || s.username : '?' });
      _ecCache.push(saved);
      toast('Échéance ajoutée');
    }
  } catch (e) { console.error('[saveEcheance]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
  if (typeof auditLog === 'function') auditLog('echeance_save', `${EC_TYPES[data.type]?.label || data.type} — ${data.residentName || data.libelle}`);
  closeModal('modalEcheance');
  renderEcheances();
}

async function toggleEcheanceDone(id) {
  const cur = _ecCache.find(x => x.id === id);
  if (!cur) return;
  try {
    const saved = await sbUpdateEcheanceField(id, { done: !cur.done, done_at: !cur.done ? new Date().toISOString() : null });
    _ecCache = _ecCache.map(x => x.id === id ? saved : x);
  } catch (e) { console.error('[toggleEcheanceDone]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
  renderEcheances();
}

function deleteEcheance(id) {
  confirmDialog('Supprimer cette échéance ?', async () => {
    try { await sbDeleteEcheance(id); _ecCache = _ecCache.filter(x => x.id !== id); }
    catch (e) { console.error('[deleteEcheance]', e); toast('Erreur suppression : ' + (e?.message || e), 'error'); return; }
    renderEcheances();
    toast('Échéance supprimée', 'info');
  });
}

// Compteur d'alertes (utilisable par d'autres pages)
function ecAlertCount() {
  return getEcheances().filter(e => !e.done && ['late', 'soon'].includes(ecUrgency(e))).length;
}

async function initEcheances() {
  const s = Auth.requireAuth();
  if (!s) return;
  if (!requireModule('view_residents')) return;
  await sbLoadResidentsCache();
  await loadEcheancesCache();
  // Remplir les sélecteurs résident
  const residents = sbResidents().filter(r => r.statut !== 'sorti');
  const opts = residents.map(r => `<option value="${r.id}">${escHtml(`${r.prenom || ''} ${r.nom || ''}`.trim())}</option>`).join('');
  const fSel = document.getElementById('ecFilterResident');
  if (fSel) fSel.innerHTML = '<option value="">Tous les résidents</option>' + opts;
  const mSel = document.getElementById('ecResident');
  if (mSel) mSel.innerHTML = '<option value="">— Aucun (échéance établissement) —</option>' + opts;
  const tSel = document.getElementById('ecFilterType');
  if (tSel) tSel.innerHTML = '<option value="">Tous les types</option>' + Object.entries(EC_TYPES).map(([k, t]) => `<option value="${k}">${t.icon} ${t.label}</option>`).join('');
  const mtSel = document.getElementById('ecType');
  if (mtSel) mtSel.innerHTML = Object.entries(EC_TYPES).map(([k, t]) => `<option value="${k}">${t.icon} ${t.label}</option>`).join('');
  const canEdit = (typeof canEditResidents === 'function') ? canEditResidents(s.userId) : Auth.isAdmin();
  const addBtn = document.getElementById('btnAddEcheance');
  if (addBtn && !canEdit) addBtn.style.display = 'none';
  ['ecFilterResident', 'ecFilterType', 'ecShowDone'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderEcheances);
  });
  renderEcheances();
}
document.addEventListener('DOMContentLoaded', initEcheances);
