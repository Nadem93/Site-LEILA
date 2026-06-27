// ── SUIVI DES ABSENCES & ACCIDENTS DU TRAVAIL ──
const AB_TYPES = {
  maladie:        { label: 'Arrêt maladie',            icon: '🤒', color: '#d97706' },
  at:             { label: 'Accident du travail',      icon: '⚠️', color: '#dc2626' },
  maladie_pro:    { label: 'Maladie professionnelle',  icon: '🏭', color: '#9333ea' },
  maternite:      { label: 'Congé maternité/paternité', icon: '👶', color: '#8b5cf6' },
  longue_maladie: { label: 'Longue maladie',           icon: '🩺', color: '#b91c1c' },
  autre:          { label: 'Autre absence',            icon: '📋', color: '#64748b' }
};

let abEditId = null;
let _abCache = [];
let _abEmployesCache = [];

function getAbsences()      { return _abCache; }
function abEmployes()       { return _abEmployesCache; }
function abEmployeNom(id)   { const e = abEmployes().find(x => String(x.id) === String(id)); return e ? `${e.prenom||''} ${e.nom||''}`.trim() : 'Inconnu'; }
function abIsCanEdit()      { return Auth.isAdmin() || (typeof canEditResidents === 'function' && canEditResidents(Auth.getSession()?.userId)); }

function abDureeJours(a) {
  const fin = a.fin || today();
  return Math.ceil((new Date(fin + 'T00:00:00') - new Date(a.debut + 'T00:00:00')) / 86400000) + 1;
}

function abEnCours(a) { return !a.fin || a.fin >= today(); }

// ── RENDU PRINCIPAL ──
function renderAbsences() {
  const all = getAbsences();
  const fEmp  = document.getElementById('abFilterEmploye')?.value || '';
  const fType = document.getElementById('abFilterType')?.value || '';

  let list = all;
  if (fEmp)  list = list.filter(a => String(a.employeId) === fEmp);
  if (fType) list = list.filter(a => a.type === fType);
  list = [...list].sort((a,b) => (b.debut||'').localeCompare(a.debut||''));

  const monthPrefix = today().slice(0,7);
  const joursMois = all.reduce((s,a) => {
    const d0 = a.debut, d1 = a.fin || today();
    if (d0.slice(0,7) > monthPrefix || d1.slice(0,7) < monthPrefix) return s;
    return s + abDureeJours(a);
  }, 0);
  const enCours = all.filter(abEnCours);
  const ats = all.filter(a => a.type === 'at');
  // Visite de reprise obligatoire : arrêt terminé, non effectuée, et (visite déjà prévue OU ≥30 jours OU maladie pro)
  const visitesAFaire = all.filter(a => !abEnCours(a) && !a.visiteFaite && (a.visiteDate || abDureeJours(a) >= 30 || a.type === 'maladie_pro'));
  // Accidents du travail non encore déclarés à la CPAM (délai légal : 48 h)
  const atsADeclarer = all.filter(a => a.type === 'at' && !a.declareeCpam);

  document.getElementById('abStats').innerHTML = `
    <div class="chx-stat" style="--c:#e85d04"><div class="chx-stat-top"><span class="chx-stat-lbl">Arrêts en cours</span></div><div class="chx-stat-num">${enCours.length}</div></div>
    <div class="chx-stat" style="--c:#ef4444"><div class="chx-stat-top"><span class="chx-stat-lbl">AT à déclarer (CPAM)</span></div><div class="chx-stat-num">${atsADeclarer.length}</div></div>
    <div class="chx-stat" style="--c:#2563eb"><div class="chx-stat-top"><span class="chx-stat-lbl">Jours d'absence (mois)</span></div><div class="chx-stat-num">${joursMois}</div></div>
    <div class="chx-stat" style="--c:#8b5cf6"><div class="chx-stat-top"><span class="chx-stat-lbl">Visites reprise à faire</span></div><div class="chx-stat-num">${visitesAFaire.length}</div></div>`;

  const alertsEl = document.getElementById('abAlerts');
  const alerts = [];
  atsADeclarer.forEach(a => {
    const heures = Math.floor((Date.now() - new Date(a.debut + 'T00:00:00')) / 3600000);
    const reste = 48 - heures;
    const txt = reste > 0
      ? `Déclaration CPAM sous 48 h pour l'AT de ${escHtml(abEmployeNom(a.employeId))} — reste ${reste} h`
      : `Déclaration CPAM en retard pour l'AT de ${escHtml(abEmployeNom(a.employeId))}`;
    alerts.push({ id: a.id, icon: '⚠️', color: '#dc2626', txt });
  });
  visitesAFaire.forEach(a => alerts.push({
    id: a.id, icon: '🩺', color: '#8b5cf6',
    txt: `Visite de reprise à planifier/faire pour ${escHtml(abEmployeNom(a.employeId))}${a.fin ? ' (retour le ' + formatDate(a.fin) + ')' : ''}`
  }));
  alertsEl.innerHTML = alerts.map(al => `
    <div style="display:flex;align-items:center;gap:.6rem;padding:.6rem .85rem;background:${al.color}10;border:1px solid ${al.color}33;border-radius:10px;margin-bottom:.5rem;cursor:pointer" onclick="openAbsenceModal('${al.id}')">
      <span style="font-size:1rem">${al.icon}</span><span style="font-size:.82rem;font-weight:600;color:${al.color}">${al.txt}</span>
    </div>`).join('');

  const el = document.getElementById('abList');
  if (!list.length) {
    el.innerHTML = `<div class="empty" style="padding:2.5rem;text-align:center"><div style="font-size:2.5rem;margin-bottom:.5rem">🩺</div><h3>Aucune absence enregistrée</h3><p>Déclarez un arrêt maladie ou un accident du travail.</p></div>`;
    return;
  }

  el.innerHTML = `<div class="abx-grid">${list.map(abRow).join('')}</div>`;
}

function abRow(a) {
  const t = AB_TYPES[a.type] || AB_TYPES.maladie;
  const enCours = abEnCours(a);
  const duree = abDureeJours(a);
  const nom = escHtml(abEmployeNom(a.employeId));
  const canEdit = abIsCanEdit();
  const cpamLate = a.type === 'at' && !a.declareeCpam;

  const pills = [];
  pills.push(a.justifie
    ? `<span class="abx-pill abx-pill-ok">✓ Justifié</span>`
    : `<span class="abx-pill abx-pill-warn">À justifier</span>`);
  if (a.prolongation) pills.push(`<span class="abx-pill">↻ Prolongation</span>`);
  if (cpamLate)       pills.push(`<span class="abx-pill abx-pill-danger">⚠️ CPAM 48 h</span>`);

  return `<article class="abx-card" style="--type:${t.color}">
    <span class="abx-watermark">${t.icon}</span>
    <header class="abx-head">
      <div class="abx-badge">${t.icon}</div>
      <div class="abx-head-text">
        <div class="abx-name">${nom}</div>
        <div class="abx-type">${t.label}</div>
      </div>
      <span class="abx-state ${enCours ? 'abx-state-encours' : 'abx-state-fini'}">${enCours ? 'En cours' : 'Terminé'}</span>
    </header>

    <div class="abx-duration">
      <div class="abx-days"><span class="abx-days-num">${duree}</span><span class="abx-days-lbl">jour${duree > 1 ? 's' : ''}</span></div>
      <div class="abx-tl">
        <div class="abx-tl-track">
          <span class="abx-tl-dot"></span>
          <span class="abx-tl-line ${enCours ? 'encours' : ''}"></span>
          <span class="abx-tl-dot end ${enCours ? 'encours' : ''}"></span>
        </div>
        <div class="abx-tl-dates"><span>${formatDate(a.debut)}</span><span>${a.fin ? formatDate(a.fin) : 'en cours'}</span></div>
      </div>
    </div>

    <div class="abx-pills">${pills.join('')}</div>

    ${a.visiteDate ? `<div class="abx-info abx-info-visite ${a.visiteFaite ? 'done' : ''}">🩺 Visite de reprise ${formatDate(a.visiteDate)} — ${a.visiteFaite ? 'effectuée' : 'à faire'}</div>` : ''}
    ${a.justificatifPath ? `<div class="abx-info abx-info-piece" onclick="abOpenJustificatif('${a.id}')" title="Ouvrir la pièce jointe">📎 Justificatif joint<span class="u">voir</span></div>` : `<div class="abx-info" style="background:var(--g100);color:var(--muted)">📎 Aucun justificatif</div>`}
    ${a.notes ? `<div class="abx-notes">${escHtml(a.notes)}</div>` : ''}

    ${canEdit ? `<footer class="abx-foot">
      <button class="abx-btn abx-btn-just ${a.justifie ? 'on' : ''}" onclick="abMarkJustifie('${a.id}',${a.justifie ? 'false' : 'true'})" title="${a.justifie ? 'Justifié — cliquer pour annuler' : 'Marquer comme justifié'}">${a.justifie ? '✓ Justifié' : 'Justifier'}</button>
      <span class="abx-spacer"></span>
      <button class="abx-btn abx-icbtn" onclick="openAbsenceModal('${a.id}')" title="Modifier">✎</button>
      <button class="abx-btn abx-icbtn del" onclick="quickDeleteAbsence('${a.id}')" title="Supprimer">✕</button>
    </footer>` : ''}
  </article>`;
}

// ── MODAL ──
function openAbsenceModal(id) {
  abEditId = id || null;
  const a = id ? getAbsences().find(x => x.id === id) : null;

  document.getElementById('abModalTitle').textContent = a ? "Modifier l'absence" : 'Déclarer une absence';
  document.getElementById('abEmploye').value = a?.employeId || '';
  document.getElementById('abType').value    = a?.type || 'maladie';
  document.getElementById('abDebut').value   = a?.debut || today();
  document.getElementById('abFin').value     = a?.fin || '';
  document.getElementById('abProlongation').checked = !!a?.prolongation;
  document.getElementById('abVisiteDate').value  = a?.visiteDate || '';
  document.getElementById('abVisiteFaite').checked = !!a?.visiteFaite;
  const dc = document.getElementById('abDeclareeCpam'); if (dc) dc.checked = !!a?.declareeCpam;
  document.getElementById('abNotes').value   = a?.notes || '';
  const af = document.getElementById('abFichier'); if (af) af.value = '';
  const aj = document.getElementById('abJustifInfo');
  if (aj) aj.innerHTML = a?.justificatifPath ? `📎 Justificatif joint — <a href="#" onclick="abOpenJustificatif('${a.id}');return false">voir</a>` : '';
  document.getElementById('abDeleteBtn').style.display = a ? '' : 'none';
  _abToggleVisiteWrap();
  _abToggleDeclareeWrap();
  abModalSync();
  openModal('modalAbsence');
}

function _abToggleVisiteWrap() {
  const fin = document.getElementById('abFin').value;
  document.getElementById('abVisiteWrap').style.display = fin ? '' : 'none';
}

// La déclaration CPAM ne concerne que les accidents du travail
function _abToggleDeclareeWrap() {
  const wrap = document.getElementById('abDeclareeWrap');
  if (!wrap) return;
  wrap.style.display = document.getElementById('abType').value === 'at' ? '' : 'none';
}

// En-tête interactif : recolore selon le type d'arrêt + sous-titre « Type · Employé »
function abModalSync() {
  const modalEl = document.querySelector('#modalAbsence .modal');
  const sub = document.querySelector('#modalAbsence .mdx-sub');
  if (!modalEl || !sub) return;
  const t = AB_TYPES[document.getElementById('abType')?.value] || AB_TYPES.maladie;
  modalEl.style.setProperty('--mc', t.color);
  const empSel = document.getElementById('abEmploye');
  const empNom = (empSel && empSel.value && empSel.selectedIndex >= 0) ? empSel.options[empSel.selectedIndex].text : '';
  sub.textContent = empNom ? `${t.label} · ${empNom}` : t.label;
}

async function saveAbsence() {
  const employeId = document.getElementById('abEmploye').value;
  const debut = document.getElementById('abDebut').value;
  if (!employeId || !debut) { toast('Employé et date de début obligatoires', 'error'); return; }

  const type = document.getElementById('abType').value;
  const existing = abEditId ? _abCache.find(x => x.id === abEditId) : null;
  const file = document.getElementById('abFichier')?.files[0];
  if (file && file.size > 5 * 1024 * 1024) { toast('Fichier trop lourd (max 5 Mo)', 'error'); return; }

  const data = {
    id: abEditId || undefined,
    employeId,
    employeNom: abEmployeNom(employeId),
    type,
    debut,
    fin: document.getElementById('abFin').value,
    prolongation: document.getElementById('abProlongation').checked,
    visiteDate: document.getElementById('abVisiteDate').value,
    visiteFaite: document.getElementById('abVisiteFaite').checked,
    declareeCpam: type === 'at' ? document.getElementById('abDeclareeCpam')?.checked || false : false,
    justifie: existing?.justifie || false,
    justificatifPath: existing?.justificatifPath || '',
    notes: document.getElementById('abNotes').value.trim()
  };

  try {
    if (file) {
      const emp = _abEmployesCache.find(e => String(e.id) === String(employeId));
      const folder = (emp && emp.profileId) ? emp.profileId : Auth.getSession().userId;
      data.justificatifPath = await sbUploadJustificatif(file, folder);
    }
    const saved = await sbSaveAbsence(data);
    if (abEditId) {
      const idx = _abCache.findIndex(x => x.id === abEditId);
      if (idx >= 0) _abCache[idx] = saved;
      toast('Absence mise à jour');
    } else {
      _abCache.unshift(saved);
      toast('Absence enregistrée', 'success');
    }
    if (typeof auditLog === 'function') auditLog('absence_save', `Absence — ${abEmployeNom(employeId)}`);
    closeModal('modalAbsence');
    renderAbsences();
  } catch (e) {
    const msg = e?.message || e?.details || JSON.stringify(e) || 'Erreur inconnue';
    toast('Erreur : ' + msg, 'error');
    console.error('[saveAbsence]', e);
  }
}

async function _abRemove(id) {
  try {
    await sbDeleteAbsence(id);
    _abCache = _abCache.filter(x => x.id !== id);
    renderAbsences();
    toast('Absence supprimée', 'info');
  } catch (e) {
    toast('Erreur : ' + (e?.message || e), 'error');
    console.error('[deleteAbsence]', e);
  }
}

function deleteAbsence() {
  if (!abEditId) return;
  const id = abEditId;
  confirmDialog('Supprimer cette absence ?', async () => { closeModal('modalAbsence'); await _abRemove(id); });
}

function quickDeleteAbsence(id) {
  confirmDialog('Supprimer cette absence ?', () => _abRemove(id));
}

async function abOpenJustificatif(id) {
  const a = _abCache.find(x => x.id === id);
  if (!a || !a.justificatifPath) return;
  const url = await sbJustificatifUrl(a.justificatifPath);
  if (url) window.open(url, '_blank'); else toast('Justificatif introuvable', 'error');
}

// Marquer une absence comme justifiée (ou la repasser à « à justifier »)
async function abMarkJustifie(id, value = true) {
  const a = _abCache.find(x => x.id === id);
  if (!a) return;
  try {
    const saved = await sbSaveAbsence({ ...a, justifie: value });
    const i = _abCache.findIndex(x => x.id === id);
    if (i >= 0) _abCache[i] = saved;
    renderAbsences();
    toast(value ? 'Absence justifiée ✓' : 'Repassée à « à justifier »');
  } catch (e) {
    toast('Erreur : ' + (e?.message || e), 'error');
    console.error('[abMarkJustifie]', e);
  }
}

// ── INIT ──
async function initAbsences() {
  const s = Auth.requireAuth();
  if (!s) return;
  try {
    [_abCache, _abEmployesCache] = await Promise.all([sbGetAbsences(), sbGetEmployes()]);
  } catch (e) {
    console.error('[initAbsences]', e);
    toast('Erreur de chargement', 'error');
  }
  const employes = abEmployes();
  const opts = employes.map(e => `<option value="${e.id}">${escHtml((e.prenom||'')+' '+(e.nom||''))}</option>`).join('');
  document.getElementById('abFilterEmploye').innerHTML = '<option value="">Tous les employés</option>' + opts;
  document.getElementById('abEmploye').innerHTML = '<option value="">— Choisir —</option>' + opts;

  if (!abIsCanEdit()) { const b = document.getElementById('btnAddAbsence'); if (b) b.style.display = 'none'; }
  document.getElementById('abFin')?.addEventListener('change', _abToggleVisiteWrap);
  document.getElementById('abType')?.addEventListener('change', _abToggleDeclareeWrap);
  ['abType','abEmploye'].forEach(id => document.getElementById(id)?.addEventListener('change', abModalSync));
  ['abFilterEmploye','abFilterType'].forEach(id => document.getElementById(id)?.addEventListener('change', renderAbsences));
  renderAbsences();
}
document.addEventListener('DOMContentLoaded', initAbsences);
