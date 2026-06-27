// Génère des alertes automatiques depuis les données existantes (PPE, échéances, planning, médicaments)
// Pas de stockage propre : recalcul à chaque visite

const AL_TYPES = {
  ppe_revision:   { icon:'📋', color:'#f97316', label:'Révision avenant' },
  echeance:       { icon:'⏰', color:'#ef4444', label:'Échéance' },
  planning:       { icon:'📅', color:'#3b82f6', label:'Rendez-vous' },
  medicament:     { icon:'💊', color:'#8b5cf6', label:'Médicament' },
  admission:      { icon:'🏠', color:'#10b981', label:'Admission' },
  eig:            { icon:'⚡', color:'#dc2626', label:'EIG' },
  plan_soins:     { icon:'🩺', color:'#0891b2', label:'Soin planifié' },
  satisfaction:   { icon:'⭐', color:'#6366f1', label:'Satisfaction' },
  budget_remboursement: { icon:'💶', color:'#b45309', label:'Remboursement budget' }
};

const AL_PRIOS = {
  critique: { label:'Critique', color:'#dc2626', bg:'#fef2f2', border:'#fecaca' },
  urgent:   { label:'Urgent',   color:'#ea580c', bg:'#fff7ed', border:'#fed7aa' },
  info:     { label:'Info',     color:'#0369a1', bg:'#eff6ff', border:'#bfdbfe' }
};

let _alDismissed = [];
const AL_DISMISS_KEY = 'ftr_alertes_dismissed';

function _alLoadDismissed() {
  try { _alDismissed = JSON.parse(localStorage.getItem(AL_DISMISS_KEY) || '[]'); } catch { _alDismissed = []; }
}
function _alSaveDismissed() {
  localStorage.setItem(AL_DISMISS_KEY, JSON.stringify(_alDismissed));
}

function _alId(type, ref) {
  return `${type}::${ref}`;
}

// ─── Génération des alertes ───────────────────────────────────────────────────
function generateAlertes() {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = today.toISOString().slice(0,10);
  const alerts = [];

  const residents = sbResidents();
  const resMap = {};
  residents.forEach(r => { resMap[r.id] = r; });

  // ── 1. Avenants (PPE) ── révision dépassée ou dans les 30 jours ───────────
  const ppe = DB.get(DB.keys.ppe) || [];
  ppe.forEach(p => {
    if (!p.dateRevision) return;
    const rev = new Date(p.dateRevision); rev.setHours(0,0,0,0);
    const diffJ = Math.round((rev - today) / 86400000);
    if (diffJ > 30) return;
    const r = resMap[p.residentId];
    const resName = r ? `${r.prenom||''} ${r.nom||''}`.trim() : 'Résident inconnu';
    const id = _alId('ppe_revision', p.id);
    let prio = 'info';
    let msg = '';
    if (diffJ < 0)       { prio = 'critique'; msg = `Révision en retard de ${-diffJ} jour${-diffJ>1?'s':''}`; }
    else if (diffJ <= 7) { prio = 'urgent';   msg = `Révision dans ${diffJ} jour${diffJ>1?'s':''}` }
    else                 { prio = 'info';     msg = `Révision dans ${diffJ} jours`; }
    alerts.push({ id, type:'ppe_revision', prio, residentId:p.residentId, resName, titre:`Avenant — ${resName}`, msg, date:p.dateRevision, link:`ppe.html?id=${p.residentId}`, diffJ });
  });

  // ── 2. Échéances ── dépassées ou dans les 14 jours ─────────────────────────
  const echeances = DB.get(DB.keys.echeances) || [];
  echeances.forEach(e => {
    if (e.statut === 'termine' || e.statut === 'annule') return;
    if (!e.dateEcheance) return;
    const ech = new Date(e.dateEcheance); ech.setHours(0,0,0,0);
    const diffJ = Math.round((ech - today) / 86400000);
    if (diffJ > 14) return;
    const r = e.residentId ? resMap[e.residentId] : null;
    const resName = r ? `${r.prenom||''} ${r.nom||''}`.trim() : '';
    const id = _alId('echeance', e.id);
    let prio = 'info';
    if (diffJ < 0)       prio = 'critique';
    else if (diffJ <= 3) prio = 'urgent';
    const label = diffJ < 0 ? `En retard de ${-diffJ}j` : diffJ === 0 ? 'Aujourd\'hui' : `Dans ${diffJ}j`;
    alerts.push({ id, type:'echeance', prio, residentId:e.residentId||null, resName, titre: e.titre||'Échéance', msg:`${label}${resName?' — '+resName:''}`, date:e.dateEcheance, link:'echeances.html', diffJ });
  });

  // ── 3. Planning — événements aujourd'hui ou demain ────────────────────────
  const planning = DB.get(DB.keys.planning) || [];
  planning.forEach(ev => {
    if (!ev.date) return;
    const evD = new Date(ev.date); evD.setHours(0,0,0,0);
    const diffJ = Math.round((evD - today) / 86400000);
    if (diffJ < 0 || diffJ > 1) return;
    const id = _alId('planning', ev.id);
    const prio = diffJ === 0 ? 'urgent' : 'info';
    const quand = diffJ === 0 ? "Aujourd'hui" : 'Demain';
    alerts.push({ id, type:'planning', prio, residentId:null, resName:'', titre:ev.titre||'Événement', msg:`${quand}${ev.time?' à '+ev.time:''}${ev.destination?' — '+ev.destination:''}`, date:ev.date, link:'planning.html', diffJ });
  });

  // ── 4. Admissions récentes (dans les 7 prochains jours) ───────────────────
  const admissions = DB.get(DB.keys.admissions) || [];
  admissions.forEach(a => {
    if (a.statut === 'annule') return;
    if (!a.dateEntree) return;
    const entree = new Date(a.dateEntree); entree.setHours(0,0,0,0);
    const diffJ = Math.round((entree - today) / 86400000);
    if (diffJ < 0 || diffJ > 7) return;
    const id = _alId('admission', a.id);
    const prio = diffJ <= 1 ? 'urgent' : 'info';
    const quand = diffJ === 0 ? "Aujourd'hui" : diffJ === 1 ? 'Demain' : `Dans ${diffJ}j`;
    const nom = [a.prenom, a.nom].filter(Boolean).join(' ') || 'Nouveau résident';
    alerts.push({ id, type:'admission', prio, residentId:a.residentId||null, resName:nom, titre:`Admission — ${nom}`, msg:`Arrivée prévue : ${quand}`, date:a.dateEntree, link:'admissions.html', diffJ });
  });

  // ── 5. EIG non classés depuis plus de 48h ─────────────────────────────────
  const eigs = DB.get(DB.keys.incidents) || [];
  eigs.forEach(e => {
    if (e.statut === 'classe') return;
    const created = new Date(e.createdAt || e.date || '');
    if (isNaN(created)) return;
    const ageH = (Date.now() - created.getTime()) / 3600000;
    if (ageH < 24) return;
    const id = _alId('eig', e.id);
    const prio = ageH > 72 ? 'critique' : 'urgent';
    alerts.push({ id, type:'eig', prio, residentId:e.residentId||null, resName:e.residentName||'', titre:e.titre||'Incident', msg:`Non classé depuis ${Math.floor(ageH)}h`, date:(e.createdAt||'').slice(0,10), link:'eig.html', diffJ:0 });
  });

  // ── 6. Plan de soins — soins du jour ──────────────────────────────────────
  const soins = DB.get(DB.keys.planSoins) || [];
  const soinsDuJour = soins.filter(s => s.actif !== false && ['quotidien','matin','midi','soir'].includes(s.freq));
  if (soinsDuJour.length) {
    const byRes = {};
    soinsDuJour.forEach(s => { (byRes[s.residentId||'__'] = byRes[s.residentId||'__'] || []).push(s); });
    Object.entries(byRes).forEach(([rid, list]) => {
      const r = resMap[rid];
      const resName = r ? `${r.prenom||''} ${r.nom||''}`.trim() : '';
      const id = _alId('plan_soins', rid + '_' + todayStr);
      alerts.push({ id, type:'plan_soins', prio:'info', residentId:rid==='__'?null:rid, resName, titre:`Plan de soins${resName?' — '+resName:''}`, msg:`${list.length} soin${list.length>1?'s':''} à réaliser aujourd'hui`, date:todayStr, link:'plan-soins.html?residentId='+rid, diffJ:0 });
    });
  }

  // ── 7. Satisfaction — score global faible (<50%) ──────────────────────────
  const satAll = DB.get(DB.keys.satisfaction) || [];
  if (satAll.length >= 3) {
    let satTotal = 0, satCount = 0;
    satAll.forEach(s => { Object.values(s.reponses || {}).forEach(v => { if (v != null) { satTotal += Number(v); satCount++; } }); });
    const satScore = satCount ? satTotal / satCount : null;
    if (satScore !== null && satScore < 2.0) {
      const pct = Math.round(satScore * 25);
      const prio = satScore < 1.5 ? 'critique' : 'urgent';
      const id = _alId('satisfaction', 'global');
      alerts.push({ id, type:'satisfaction', prio, residentId:null, resName:'', titre:'Score de satisfaction faible', msg:`Score global : ${pct}% sur ${satAll.length} questionnaire${satAll.length>1?'s':''}`, date:todayStr, link:'satisfaction.html', diffJ:0 });
    }
  }

  // ── 8. Budget — partage 50/50 en attente (remboursement et/ou ticket manquant depuis ≥7j) ──
  const budgetDemandes = DB.get(DB.keys.budgetDemandes) || [];
  budgetDemandes.forEach(d => {
    if (d.statut !== 'accepte' || !d.partage50) return;
    const remboursements = d.remboursements || [];
    const tousRembourses = remboursements.length > 0 && remboursements.every(r => r.paye);
    const hasJustif = (d.justificatifs || []).length > 0;
    if (tousRembourses && hasJustif) return;
    const refDateStr = d.dateTraitement || d.dateDemande;
    if (!refDateStr) return;
    const refDate = new Date(refDateStr);
    if (isNaN(refDate)) return;
    const ageJ = Math.floor((Date.now() - refDate.getTime()) / 86400000);
    if (ageJ < 7) return;
    const manque = [];
    if (!tousRembourses) manque.push('remboursement résident(s)');
    if (!hasJustif) manque.push('ticket/justificatif');
    const id = _alId('budget_remboursement', d.id);
    const prio = ageJ >= 21 ? 'critique' : 'urgent';
    alerts.push({ id, type:'budget_remboursement', prio, residentId:null, resName:d.employeNom||'', titre:`Demande de budget — ${d.employeNom||'Employé'}`, msg:`En attente depuis ${ageJ}j : ${manque.join(' et ')}`, date:refDateStr, link:'budget.html', diffJ:0 });
  });

  // Trier : critique → urgent → info, puis par diffJ croissant
  const ORDER = { critique:0, urgent:1, info:2 };
  alerts.sort((a,b) => ORDER[a.prio] - ORDER[b.prio] || a.diffJ - b.diffJ);

  return alerts;
}

// ─── Rendu ────────────────────────────────────────────────────────────────────
function renderAlertes(filterType) {
  _alLoadDismissed();
  let list = generateAlertes().filter(a => !_alDismissed.includes(a.id));
  if (filterType) list = list.filter(a => a.type === filterType);

  const counts = { all:list.length };
  Object.keys(AL_TYPES).forEach(t => { counts[t] = list.filter(a => a.type === t).length; });

  // Stats
  const statEl = document.getElementById('alStats');
  if (statEl) {
    statEl.innerHTML = `
      <div class="chx-stat" style="--c:#ef4444"><div class="chx-stat-top"><span class="chx-stat-lbl">Critiques</span></div><div class="chx-stat-num">${list.filter(a=>a.prio==='critique').length}</div></div>
      <div class="chx-stat" style="--c:#f97316"><div class="chx-stat-top"><span class="chx-stat-lbl">Urgentes</span></div><div class="chx-stat-num">${list.filter(a=>a.prio==='urgent').length}</div></div>
      <div class="chx-stat" style="--c:#3b82f6"><div class="chx-stat-top"><span class="chx-stat-lbl">Informations</span></div><div class="chx-stat-num">${list.filter(a=>a.prio==='info').length}</div></div>
      <div class="chx-stat" style="--c:#7c3aed"><div class="chx-stat-top"><span class="chx-stat-lbl">Total</span></div><div class="chx-stat-num">${list.length}</div></div>`;
  }

  // Filtres
  const filtersEl = document.getElementById('alFilters');
  if (filtersEl) {
    filtersEl.innerHTML = `<button class="al-filter-btn ${!filterType?'active':''}" onclick="renderAlertes('')">Toutes <span>(${counts.all})</span></button>`
      + Object.entries(AL_TYPES).map(([t,cfg]) => counts[t] ? `<button class="al-filter-btn ${filterType===t?'active':''}" onclick="renderAlertes('${t}')">${cfg.icon} ${cfg.label} <span>(${counts[t]})</span></button>` : '').join('');
  }

  const container = document.getElementById('alList');
  if (!container) return;

  if (!list.length) {
    container.innerHTML = `<div class="empty" style="padding:4rem 2rem;text-align:center">
      <div style="font-size:3.5rem;margin-bottom:.75rem">✅</div>
      <div style="font-weight:700;font-size:1.05rem;color:var(--text);margin-bottom:.3rem">Tout est à jour</div>
      <div style="font-size:.83rem;color:var(--muted)">Aucune alerte active pour le moment.</div>
    </div>`;
    return;
  }

  // Grouper par priorité
  const groups = [
    { prio:'critique', list:list.filter(a=>a.prio==='critique') },
    { prio:'urgent',   list:list.filter(a=>a.prio==='urgent') },
    { prio:'info',     list:list.filter(a=>a.prio==='info') }
  ].filter(g => g.list.length);

  container.innerHTML = groups.map(g => {
    const p = AL_PRIOS[g.prio];
    return `<div style="margin-bottom:1.5rem">
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.6rem">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color}"></span>
        <span style="font-size:.8rem;font-weight:700;color:${p.color};text-transform:uppercase;letter-spacing:.05em">${p.label}</span>
        <span style="font-size:.75rem;color:var(--muted)">(${g.list.length})</span>
        ${g.prio !== 'info' ? `<button class="btn btn-ghost btn-sm" style="margin-left:auto;font-size:.7rem" onclick="dismissGroupAl('${g.prio}')">Tout ignorer</button>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:.5rem">
        ${g.list.map(a => _alCard(a, p)).join('')}
      </div>
    </div>`;
  }).join('');

  _updateAlBadges(list.length);
}

function _alCard(a, p) {
  const t = AL_TYPES[a.type] || AL_TYPES.echeance;
  return `<div style="display:flex;align-items:stretch;gap:0;background:#fff;border-radius:10px;border:1px solid ${p.border};overflow:hidden">
    <div style="width:4px;background:${p.color};flex-shrink:0"></div>
    <div style="padding:.65rem .85rem;flex:1;display:flex;align-items:center;gap:.7rem">
      <div style="width:34px;height:34px;border-radius:8px;background:${t.color}15;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">${t.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:.85rem;color:var(--text)">${escHtml(a.titre)}</div>
        <div style="font-size:.77rem;color:var(--muted);margin-top:1px">${escHtml(a.msg)}</div>
        ${a.date ? `<div style="font-size:.7rem;color:${p.color};margin-top:2px;font-weight:600">${_alFormatDate(a.date)}</div>` : ''}
      </div>
      <div style="display:flex;gap:.3rem;flex-shrink:0">
        ${a.link ? `<a href="${a.link}" class="btn btn-ghost btn-sm" style="font-size:.72rem;padding:3px 8px">Voir</a>` : ''}
        <button class="btn btn-ghost btn-sm" style="font-size:.72rem;padding:3px 8px;color:var(--muted)" onclick="dismissAl('${a.id}')" title="Ignorer">✕</button>
      </div>
    </div>
  </div>`;
}

function _alFormatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'long' });
}

// ─── Actions ─────────────────────────────────────────────────────────────────
function dismissAl(id) {
  if (!_alDismissed.includes(id)) { _alDismissed.push(id); _alSaveDismissed(); }
  const btn = event?.target;
  const card = btn?.closest('[style*="border-radius:10px"]');
  if (card) { card.style.opacity='0'; card.style.transition='opacity .2s'; setTimeout(() => renderAlertes(_alCurrentFilter()), 250); }
  else renderAlertes(_alCurrentFilter());
}

function dismissGroupAl(prio) {
  _alLoadDismissed();
  generateAlertes().filter(a => a.prio === prio && !_alDismissed.includes(a.id)).forEach(a => _alDismissed.push(a.id));
  _alSaveDismissed();
  renderAlertes(_alCurrentFilter());
}

function resetAlDismissed() {
  _alDismissed = [];
  _alSaveDismissed();
  renderAlertes();
  toast('Alertes réinitialisées');
}

function _alCurrentFilter() {
  const active = document.querySelector('.al-filter-btn.active');
  if (!active) return '';
  const text = active.textContent.trim();
  for (const [t, cfg] of Object.entries(AL_TYPES)) {
    if (text.startsWith(cfg.icon)) return t;
  }
  return '';
}

// ─── Badge accueil ────────────────────────────────────────────────────────────
function _updateAlBadges(count) {
  document.querySelectorAll('.al-badge').forEach(el => {
    el.textContent = count > 0 ? (count > 99 ? '99+' : String(count)) : '';
    el.classList.toggle('hidden', count === 0);
  });
}

function getAlerteCount() {
  _alLoadDismissed();
  return generateAlertes().filter(a => !_alDismissed.includes(a.id)).length;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function initAlertes() {
  const s = Auth.requireAuth();
  if (!s) return;
  await sbLoadResidentsCache();
  renderAlertes();
}

document.addEventListener('DOMContentLoaded', initAlertes);
