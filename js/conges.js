let _cgCache = [];
let _cgEmployesCache = [];

async function initConges() {
  const _s = Auth.requireAuth();
  if (!_s) return;
  if (!requireModule('access_conges')) return;
  try {
    [_cgCache, _cgEmployesCache] = await Promise.all([sbGetConges(), sbGetEmployes()]);
  } catch (e) {
    console.error('[initConges]', e);
    toast('Erreur de chargement', 'error');
  }
  const sel = document.getElementById('cgFiltreEmploye');
  sel.innerHTML = '<option value="">Tous les employés</option>' + _cgEmployesCache.map(e => `<option value="${e.id}">${escHtml(e.prenom+' '+e.nom)}</option>`).join('');
  renderConges();
}

function getConges() { return _cgCache; }

// Renvoie une copie de la demande avec le nom du salarié résolu depuis le cache
// (nom de famille déjà en MAJUSCULES via le mapper employés).
function cgWithNom(d) {
  const e = _cgEmployesCache.find(x => String(x.id) === String(d.employeId));
  return e ? { ...d, employeNom: `${e.prenom || ''} ${e.nom || ''}`.trim() } : d;
}

function openDemandeConge(data) {
  const employes = _cgEmployesCache;
  const eOpts = employes.map(e => `<option value="${e.id}"${data && data.employeId === e.id ? ' selected' : ''}>${escHtml(e.prenom+' '+e.nom)}</option>`).join('');
  const types = [
    { v:'cp', l:'Congés payés' }, { v:'rtt', l:'RTT' }, { v:'maladie', l:'Arrêt maladie' },
    { v:'enfant_malade', l:'Enfant malade' }, { v:'formation', l:'Formation' }, { v:'autre', l:'Autre' }
  ];
  const tOpts = types.map(t => `<option value="${t.v}"${data && data.type === t.v ? ' selected' : ''}>${t.l}</option>`).join('');
  const html = `<div class="modal-overlay" id="modalConge" style="display:flex" onclick="closeModal('modalConge')">
    <div class="modal" style="max-width:480px;--mc:#0891b2" onclick="event.stopPropagation()">
      <div class="mdx-hero">
        <button class="mdx-close" onclick="closeModal('modalConge')" aria-label="Fermer">✕</button>
        <div class="mdx-badge">🗓</div>
        <div class="mdx-hero-txt">
          <div class="mdx-title">${data ? 'Modifier la demande' : 'Nouvelle demande de congés'}</div>
          <div class="mdx-sub">Congés · RTT · absences</div>
        </div>
      </div>
      <div class="modal-body mdx-body">
        <div class="mdx-section">
          <div class="mdx-sec-head"><span>📋</span> Demande</div>
          <div class="form-group"><label>Employé *</label><select id="cgEmploye" class="form-input" onchange="cgModalSync()">${eOpts}</select></div>
          <div class="form-group"><label>Type *</label><select id="cgType" class="form-input" onchange="cgModalSync()">${tOpts}</select></div>
        </div>
        <div class="mdx-section">
          <div class="mdx-sec-head"><span>📅</span> Période &amp; motif</div>
          <div class="form-row">
            <div class="form-group"><label>Date début *</label><input type="date" id="cgDebut" class="form-input" value="${data ? data.debut : ''}"/></div>
            <div class="form-group"><label>Date fin *</label><input type="date" id="cgFin" class="form-input" value="${data ? data.fin : ''}"/></div>
          </div>
          <div class="form-group"><label>Motif</label><textarea id="cgMotif" class="form-input" rows="2" placeholder="Raison de la demande…">${escHtml(data ? data.motif||'' : '')}</textarea></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('modalConge')">Annuler</button>
        <button class="btn btn-primary" onclick="saveConge('${data ? data.id : ''}')">${data ? 'Enregistrer' : 'Envoyer la demande'}</button>
      </div>
    </div>
  </div>`;
  const old = document.getElementById('modalConge');
  if (old) old.remove();
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div);
  // Un non-admin ne peut déclarer que pour lui-même
  if (!Auth.isAdmin()) {
    const own = _cgEmployesCache.find(e => String(e.profileId) === String(Auth.getSession()?.userId));
    const sel = document.getElementById('cgEmploye');
    if (own && sel) { sel.value = own.id; sel.disabled = true; }
  }
  cgModalSync();
  requestAnimationFrame(() => document.getElementById('modalConge')?.classList.add('open'));
}

// En-tête interactif du modal congés : recolore selon le type + sous-titre « Type · Employé »
function cgModalSync() {
  const modalEl = document.querySelector('#modalConge .modal');
  const sub = document.querySelector('#modalConge .mdx-sub');
  if (!modalEl || !sub) return;
  const type = document.getElementById('cgType')?.value || 'cp';
  const meta = (typeof CONGE_TYPE_META !== 'undefined' && CONGE_TYPE_META[type]) ? CONGE_TYPE_META[type] : { label: type, color: '#0891b2' };
  modalEl.style.setProperty('--mc', meta.color);
  const empSel = document.getElementById('cgEmploye');
  const empNom = (empSel && empSel.value && empSel.selectedIndex >= 0) ? empSel.options[empSel.selectedIndex].text : '';
  sub.textContent = empNom ? `${meta.label} · ${empNom}` : meta.label;
}

async function saveConge(id) {
  const employeId = document.getElementById('cgEmploye').value;
  const type = document.getElementById('cgType').value;
  const debut = document.getElementById('cgDebut').value;
  const fin = document.getElementById('cgFin').value;
  const motif = document.getElementById('cgMotif').value.trim();
  if (!employeId || !debut || !fin) { toast('Champs obligatoires manquants', 'error'); return; }
  if (debut > fin) { toast('La date de fin doit être après la date de début', 'error'); return; }
  const emp = _cgEmployesCache.find(e => String(e.id) === String(employeId));
  try {
    if (id) {
      const existing = _cgCache.find(d => d.id === id) || {};
      const saved = await sbSaveConge({ ...existing, id, employeId, employeNom: emp ? emp.prenom+' '+emp.nom : existing.employeNom, type, debut, fin, motif });
      const idx = _cgCache.findIndex(d => d.id === id);
      if (idx !== -1) _cgCache[idx] = saved;
      toast('Demande mise à jour', 'success');
    } else {
      const saved = await sbSaveConge({ employeId, employeNom: emp ? emp.prenom+' '+emp.nom : '', type, debut, fin, motif, statut: 'en_attente' });
      _cgCache.unshift(saved);
      if (typeof auditLog === 'function') auditLog('conge', 'Nouvelle demande — '+(emp?.prenom||'')+' '+(emp?.nom||''));
      toast('Demande de congés envoyée ✓', 'success');
    }
    closeModal('modalConge');
    renderConges();
  } catch (e) {
    const msg = e?.message || e?.details || JSON.stringify(e) || 'Erreur inconnue';
    toast('Erreur : ' + msg, 'error');
    console.error('[saveConge]', e);
  }
}

async function repondreConge(id, statut) {
  const item = _cgCache.find(d => d.id === id);
  if (!item) return;
  let reponseMotif = '';
  if (statut === 'refuse') {
    const motif = prompt('Motif du refus :');
    if (motif === null) return;
    reponseMotif = motif.trim() || '';
  }
  const s = Auth.getSession();
  try {
    const saved = await sbUpdateConge(id, {
      statut,
      reponse_motif: reponseMotif,
      approuve_par: s ? [s.prenom,s.nom].filter(Boolean).join(' ') || s.username : '',
      approuve_par_id: s ? String(s.userId) : null,
      approuve_at: new Date().toISOString()
    });
    const idx = _cgCache.findIndex(d => d.id === id);
    if (idx !== -1) _cgCache[idx] = saved;
    toast('Demande ' + (statut === 'accepte' ? 'acceptée' : 'refusée'), 'success');
    if (typeof auditLog === 'function') auditLog('conge_' + statut, item.employeNom + ' — ' + item.type);
    renderConges();
  } catch (e) {
    toast('Erreur : ' + (e?.message || e), 'error');
    console.error('[repondreConge]', e);
  }
}

function supprimerConge(id) {
  confirmDialog('Supprimer cette demande ?', async () => {
    try {
      await sbDeleteConge(id);
      _cgCache = _cgCache.filter(d => d.id !== id);
      toast('Demande supprimée', 'info');
      renderConges();
    } catch (e) {
      toast('Erreur : ' + (e?.message || e), 'error');
      console.error('[supprimerConge]', e);
    }
  });
}

function renderConges() {
  const list = getConges();
  const filtreStatut = document.getElementById('cgFiltreStatut').value;
  const filtreEmploye = document.getElementById('cgFiltreEmploye').value;

  let filtered = list;
  if (filtreStatut) filtered = filtered.filter(d => d.statut === filtreStatut);
  if (filtreEmploye) filtered = filtered.filter(d => d.employeId === filtreEmploye);

  const enAttente = list.filter(d => d.statut === 'en_attente');
  const acceptes = list.filter(d => d.statut === 'accepte').length;
  const refuses = list.filter(d => d.statut === 'refuse').length;

  document.getElementById('cgStatEnAttente').textContent = enAttente.length;
  document.getElementById('cgStatAcceptes').textContent = acceptes;
  document.getElementById('cgStatRefuses').textContent = refuses;

  const isAdmin = Auth.isAdmin();

  const pendingCard = document.getElementById('cgPendingCard');
  if (pendingCard) {
    if (isAdmin && enAttente.length) {
      pendingCard.style.display = '';
      document.getElementById('cgPendingList').innerHTML = `<div class="cgx-grid">` + enAttente
        .sort((a,b) => (a.dateDemande||'').localeCompare(b.dateDemande||''))
        .map(d => congeCardHtml(cgWithNom(d), 'rh', isAdmin)).join('') + `</div>`;
    } else {
      pendingCard.style.display = 'none';
    }
  }

  // Les demandes en attente sont déjà dans la carte « à traiter » → on les retire de la liste principale (admin)
  const showPending = isAdmin && enAttente.length;
  const mainList = (showPending && filtreStatut !== 'en_attente')
    ? filtered.filter(d => d.statut !== 'en_attente')
    : filtered;

  const el = document.getElementById('cgList');
  if (!mainList.length) {
    el.innerHTML = showPending
      ? '<div class="empty" style="padding:2rem;text-align:center"><p>Aucune demande traitée — voir « à traiter » ci-dessus.</p></div>'
      : '<div class="empty" style="padding:3rem;text-align:center"><p>Aucune demande trouvée.</p></div>';
    return;
  }

  el.innerHTML = `<div class="cgx-grid">` + mainList.sort((a,b) => (b.dateDemande||'').localeCompare(a.dateDemande||'')).map(d => congeCardHtml(cgWithNom(d), 'rh', isAdmin)).join('') + `</div>`;
}

document.addEventListener('DOMContentLoaded', initConges);
if (typeof registerPageInit === 'function') registerPageInit('conges', initConges);
