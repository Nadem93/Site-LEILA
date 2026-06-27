const EV_KEY = DB.keys.evaluations;

// ─── Grilles disponibles ──────────────────────────────────────────────────────
const EV_GRILLES = {
  mif: {
    label: 'MIF — Mesure de l\'Indépendance Fonctionnelle',
    short: 'MIF',
    icon: '🧠',
    color: '#6366f1',
    scoreMin: 18, scoreMax: 126,
    niveaux: [
      { min:18,  max:36,  label:'Dépendance totale',    color:'#dc2626' },
      { min:37,  max:72,  label:'Dépendance sévère',    color:'#ea580c' },
      { min:73,  max:108, label:'Dépendance modérée',   color:'#d97706' },
      { min:109, max:126, label:'Indépendance totale',  color:'#16a34a' }
    ],
    dimensions: [
      {
        id:'soins_perso', label:'Soins personnels', items:[
          { id:'alimentation',  label:'Alimentation' },
          { id:'toilette',      label:'Soins du visage/cheveux' },
          { id:'bain',          label:'Bain / douche' },
          { id:'habillage_haut',label:'Habillage — haut du corps' },
          { id:'habillage_bas', label:'Habillage — bas du corps' },
          { id:'soins_perinee', label:'Soins périnéaux' }
        ]
      },
      {
        id:'continence', label:'Contrôle des sphincters', items:[
          { id:'vesicale',  label:'Contrôle vésical' },
          { id:'anale',     label:'Contrôle anal' }
        ]
      },
      {
        id:'transferts', label:'Mobilité — transferts', items:[
          { id:'lit_chaise',  label:'Lit / chaise / fauteuil roulant' },
          { id:'toilettes',   label:'Toilettes' },
          { id:'bain_douche', label:'Baignoire / douche' }
        ]
      },
      {
        id:'locomotion', label:'Locomotion', items:[
          { id:'marche_fauteuil', label:'Marche / Fauteuil roulant' },
          { id:'escaliers',       label:'Escaliers' }
        ]
      },
      {
        id:'communication', label:'Communication', items:[
          { id:'comprehension', label:'Compréhension' },
          { id:'expression',    label:'Expression' }
        ]
      },
      {
        id:'social', label:'Conscience du monde extérieur', items:[
          { id:'interaction',   label:'Interactions sociales' },
          { id:'resolution',    label:'Résolution de problèmes' },
          { id:'memoire',       label:'Mémoire' }
        ]
      }
    ],
    scaleItems: [
      { val:7, label:'Indépendance complète' },
      { val:6, label:'Indépendance modifiée (aide technique)' },
      { val:5, label:'Supervision' },
      { val:4, label:'Aide minimale (≥75% effort)' },
      { val:3, label:'Aide modérée (50–74%)' },
      { val:2, label:'Aide maximale (25–49%)' },
      { val:1, label:'Aide totale (<25%)' }
    ]
  },
  barthel: {
    label: 'Indice de Barthel',
    short: 'Barthel',
    icon: '🚶',
    color: '#0891b2',
    scoreMin: 0, scoreMax: 100,
    niveaux: [
      { min:0,  max:20,  label:'Dépendance totale',  color:'#dc2626' },
      { min:21, max:60,  label:'Dépendance sévère',  color:'#ea580c' },
      { min:61, max:90,  label:'Dépendance légère',  color:'#d97706' },
      { min:91, max:100, label:'Indépendance',        color:'#16a34a' }
    ],
    dimensions: [
      {
        id:'barthel_items', label:'Activités de la vie quotidienne', items:[
          { id:'alimentation',   label:'Alimentation',             opts:[{v:0,l:'Dépendant'},{v:5,l:'Aide partielle'},{v:10,l:'Indépendant'}] },
          { id:'bain',           label:'Bain / toilette',          opts:[{v:0,l:'Dépendant'},{v:5,l:'Indépendant'}] },
          { id:'toilette',       label:'Entretien personnel',      opts:[{v:0,l:'Dépendant'},{v:5,l:'Indépendant'}] },
          { id:'habillage',      label:'Habillage',                opts:[{v:0,l:'Dépendant'},{v:5,l:'Aide partielle'},{v:10,l:'Indépendant'}] },
          { id:'intestin',       label:'Contrôle intestinal',      opts:[{v:0,l:'Incontinent'},{v:5,l:'Accident occasionnel'},{v:10,l:'Continent'}] },
          { id:'vesical',        label:'Contrôle vésical',         opts:[{v:0,l:'Incontinent'},{v:5,l:'Accident occasionnel'},{v:10,l:'Continent'}] },
          { id:'toilettes',      label:'Utilisation des toilettes', opts:[{v:0,l:'Dépendant'},{v:5,l:'Aide partielle'},{v:10,l:'Indépendant'}] },
          { id:'transfert',      label:'Transfert lit–chaise',     opts:[{v:0,l:'Incapable'},{v:5,l:'Grande aide'},{v:10,l:'Aide minime'},{v:15,l:'Indépendant'}] },
          { id:'marche',         label:'Déambulation',             opts:[{v:0,l:'Incapable'},{v:5,l:'Fauteuil roulant'},{v:10,l:'Aide 1 personne'},{v:15,l:'Indépendant'}] },
          { id:'escaliers',      label:'Escaliers',                opts:[{v:0,l:'Incapable'},{v:5,l:'Aide'},{v:10,l:'Indépendant'}] }
        ]
      }
    ]
  }
};

// Source = Supabase. Cache mémoire chargé au démarrage.
let _evCache = [];
function getEv()       { return _evCache; }
async function loadEvCache() { _evCache = await sbGetEvaluations(); }

let _evResidentId = '';
let _evGrille     = 'mif';
let _evEditId     = '';

// ─── Init ─────────────────────────────────────────────────────────────────────
async function initEvaluations() {
  const s = Auth.requireAuth();
  if (!s) return;
  await sbLoadResidentsCache();
  await loadEvCache();
  const params = new URLSearchParams(window.location.search);
  _evResidentId = params.get('residentId') || params.get('id') || '';

  _populateEvResidents();
  document.getElementById('evResident')?.addEventListener('change', e => {
    _evResidentId = e.target.value;
    renderEvList();
  });
  document.getElementById('evGrille')?.addEventListener('change', e => {
    _evGrille = e.target.value;
    renderEvList();
  });

  if (_evResidentId) {
    const sel = document.getElementById('evResident');
    if (sel) sel.value = _evResidentId;
  }
  const canEdit = (typeof canEditResidents === 'function') ? canEditResidents(s.userId) : Auth.isAdmin();
  if (!canEdit) { const b = document.getElementById('btnAddEv'); if (b) b.style.display = 'none'; }
  renderEvList();
}

function _populateEvResidents() {
  const residents = sbResidents();
  const el = document.getElementById('evResident');
  if (!el) return;
  el.innerHTML = '<option value="">Tous les résidents</option>' +
    residents.map(r => `<option value="${r.id}">${escHtml((r.prenom||'')+' '+(r.nom||''))}</option>`).join('');
  if (_evResidentId) el.value = _evResidentId;
}

// ─── Liste des évaluations ────────────────────────────────────────────────────
function renderEvList() {
  const container = document.getElementById('evList');
  if (!container) return;

  const grilleFilter = document.getElementById('evGrille')?.value || '';
  const residents    = sbResidents();
  let list = getEv();
  if (_evResidentId) list = list.filter(e => e.residentId === _evResidentId);
  if (grilleFilter)  list = list.filter(e => e.grille === grilleFilter);
  list = list.slice().sort((a,b) => b.date.localeCompare(a.date));

  const all = getEv();
  const monthPrefix = today().slice(0,7);
  const ceMois = all.filter(e => (e.date||'').slice(0,7) === monthPrefix).length;
  const avgPct = all.length ? Math.round(all.reduce((s,e) => {
    const g = EV_GRILLES[e.grille]; if (!g) return s;
    return s + (_evScore(e) / g.scoreMax * 100);
  }, 0) / all.length) : 0;

  document.getElementById('evStats').innerHTML = `
    <div class="chx-stat" style="--c:#2563eb"><div class="chx-stat-top"><span class="chx-stat-lbl">Évaluations</span></div><div class="chx-stat-num">${all.length}</div></div>
    <div class="chx-stat" style="--c:#7c3aed"><div class="chx-stat-top"><span class="chx-stat-lbl">Résidents évalués</span></div><div class="chx-stat-num">${new Set(all.map(e=>e.residentId).filter(Boolean)).size}</div></div>
    <div class="chx-stat" style="--c:#16a34a"><div class="chx-stat-top"><span class="chx-stat-lbl">Ce mois</span></div><div class="chx-stat-num">${ceMois}</div></div>
    <div class="chx-stat" style="--c:#0d9488"><div class="chx-stat-top"><span class="chx-stat-lbl">Score moyen</span></div><div class="chx-stat-bar"><i style="width:${avgPct}%"></i></div><div class="chx-stat-num">${avgPct}%</div></div>`;

  if (!list.length) {
    container.innerHTML = `<div class="empty" style="padding:2.5rem"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></div><h3>${_evResidentId?'Aucune évaluation pour ce résident':'Aucune évaluation'}</h3><p>Créez une évaluation MIF ou Barthel pour suivre l'autonomie des résidents.</p></div>`;
    return;
  }

  // Grouper par résident
  const byRes = {};
  list.forEach(e => {
    const k = e.residentId || '__';
    if (!byRes[k]) byRes[k] = [];
    byRes[k].push(e);
  });

  container.innerHTML = Object.entries(byRes).map(([rid, evals]) => {
    const r = residents.find(x => x.id === rid);
    const col = r?.color || '#6366f1';
    const nom = r ? `${r.prenom||''} ${r.nom||''}`.trim() : 'Inconnu';
    const av = r?.photo
      ? `<img src="${sanitizeUrl(r.photo)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid ${col}44" alt=""/>`
      : `<div style="width:32px;height:32px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.75rem;color:#fff;flex-shrink:0">${initials(r?.prenom,r?.nom)}</div>`;
    return `<div style="margin-bottom:1.75rem">
      <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.75rem;padding:.55rem .85rem;background:#fff;border-radius:10px;border:1.5px solid ${col}33">
        ${av}
        <a href="resident.html?id=${rid}" style="font-weight:700;font-size:.92rem;color:${col};text-decoration:none">${escHtml(nom)}</a>
        <span style="margin-left:auto;font-size:.75rem;color:var(--muted)">${evals.length} évaluation${evals.length>1?'s':''}</span>
        <button class="btn btn-accent btn-sm" onclick="openEvModal('','${rid}')">+ Évaluer</button>
      </div>
      <div class="grid grid-3" style="gap:.85rem">
        ${evals.map(e => _evCard(e, col)).join('')}
      </div>
    </div>`;
  }).join('');
}

function _evScore(e) {
  const g = EV_GRILLES[e.grille];
  if (!g) return 0;
  let total = 0;
  if (e.grille === 'mif') {
    g.dimensions.forEach(dim => dim.items.forEach(it => { total += Number(e.scores?.[it.id] || 0); }));
  } else if (e.grille === 'barthel') {
    g.dimensions[0].items.forEach(it => { total += Number(e.scores?.[it.id] || 0); });
  }
  return total;
}

function _evNiveau(grille, score) {
  const g = EV_GRILLES[grille];
  if (!g) return null;
  return g.niveaux.find(n => score >= n.min && score <= n.max) || g.niveaux[0];
}

function _evCard(e, resColor) {
  const g   = EV_GRILLES[e.grille];
  const col = g?.color || resColor;
  const icon = g?.icon || '📊';
  const score   = _evScore(e);
  const scoreMax = g?.scoreMax || 100;
  const niveau  = _evNiveau(e.grille, score);
  const pct     = Math.round(score / scoreMax * 100);
  const dateStr = e.date ? new Date(e.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}) : '—';
  const canEdit = (typeof canEditResidents === 'function') ? canEditResidents(Auth.getSession()?.userId) : Auth.isAdmin();
  const ringCol = niveau?.color || col;
  const R = 26, C = 2 * Math.PI * R;
  const donut = `<svg width="64" height="64" viewBox="0 0 64 64" style="flex-shrink:0;transform:rotate(-90deg)">
    <circle cx="32" cy="32" r="${R}" fill="none" stroke="var(--g100)" stroke-width="6"/>
    <circle cx="32" cy="32" r="${R}" fill="none" stroke="${ringCol}" stroke-width="6" stroke-linecap="round"
            stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}"
            style="transition:stroke-dashoffset .5s ease"/>
  </svg>`;
  return `<div style="background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(15,23,42,.06);border:1px solid var(--border);overflow:hidden;display:flex;flex-direction:column;transition:box-shadow .12s" onmouseover="this.style.boxShadow='0 6px 20px rgba(15,23,42,.1)'" onmouseout="this.style.boxShadow='0 2px 12px rgba(15,23,42,.06)'">
    <div style="background:linear-gradient(135deg,${col}22,${col}08);border-bottom:1px solid ${col}22;padding:.9rem 1rem .75rem;display:flex;align-items:center;gap:.65rem">
      <div style="width:38px;height:38px;border-radius:10px;background:${col}18;border:1.5px solid ${col}33;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">${icon}</div>
      <div style="min-width:0;flex:1">
        <div style="font-weight:700;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(g?.short||e.grille)}</div>
        <div style="font-size:.68rem;font-weight:600;color:${col};margin-top:1px">${dateStr}</div>
      </div>
    </div>
    <div style="padding:.85rem 1rem;flex:1;display:flex;flex-direction:column;gap:.4rem">
      <div style="display:flex;align-items:center;gap:.85rem">
        <div style="position:relative;width:64px;height:64px;flex-shrink:0">
          ${donut}
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <span style="font-size:1.05rem;font-weight:800;color:${ringCol};line-height:1">${pct}%</span>
          </div>
        </div>
        <div style="min-width:0;flex:1">
          <div><span style="font-size:1.25rem;font-weight:800;color:${ringCol}">${score}</span><span style="font-size:.76rem;color:var(--muted)"> / ${scoreMax}</span></div>
          <div style="font-size:.72rem;font-weight:600;color:${ringCol};margin-top:1px">${niveau?.label||''}</div>
        </div>
      </div>
      ${e.note ? `<div style="font-size:.73rem;color:var(--muted);line-height:1.5;margin-top:.1rem;font-style:italic">${escHtml(e.note.slice(0,80))}${e.note.length>80?'…':''}</div>` : ''}
      <div style="margin-top:auto;padding-top:.5rem;display:flex">
        <button class="btn btn-ghost btn-sm" onclick="openEvDetail('${e.id}')">👁 Détail</button>
      </div>
    </div>
    ${canEdit?`<div style="display:flex;gap:.3rem;justify-content:flex-end;border-top:1px solid var(--border);padding:.5rem .75rem;background:var(--g50)">
      <button class="btn btn-ghost btn-sm" onclick="openEvModal('${e.id}')">✎</button>
      <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteEv('${e.id}')">✕</button>
    </div>`:''}
  </div>`;
}

// ─── Modal saisie ─────────────────────────────────────────────────────────────
function openEvModal(id, presetRid) {
  _evEditId = id || '';
  const list = getEv();
  const ev   = id ? list.find(x => x.id === id) : null;
  const grille = ev?.grille || _evGrille || 'mif';
  _evGrille = grille;

  document.getElementById('evModalTitle').textContent = ev ? 'Modifier l\'évaluation' : 'Nouvelle évaluation';
  document.getElementById('evModalResidentSel').value = ev?.residentId || presetRid || _evResidentId || '';

  const grilleEl = document.getElementById('evModalGrille');
  if (grilleEl) { grilleEl.value = grille; grilleEl.addEventListener('change', () => _renderEvForm()); }

  document.getElementById('evModalDate').value  = ev?.date || new Date().toISOString().slice(0,10);
  document.getElementById('evModalNote').value  = ev?.note || '';

  _renderEvForm(ev?.scores);
  _populateEvModalResidents(ev?.residentId || presetRid || _evResidentId);
  openModal('modalEv');
}

function _populateEvModalResidents(selected) {
  const residents = sbResidents();
  const el = document.getElementById('evModalResidentSel');
  if (!el) return;
  el.innerHTML = '<option value="">— Choisir —</option>' +
    residents.map(r => `<option value="${r.id}"${r.id===selected?' selected':''}>${escHtml((r.prenom||'')+' '+(r.nom||''))}</option>`).join('');
}

function _renderEvForm(scores) {
  const grille = document.getElementById('evModalGrille')?.value || _evGrille || 'mif';
  const g = EV_GRILLES[grille];
  if (!g) return;
  const container = document.getElementById('evFormBody');
  if (!container) return;

  if (grille === 'mif') {
    const scaleHtml = `<div style="margin-bottom:1rem;padding:.6rem .8rem;background:#f8fafc;border-radius:8px;border:1px solid var(--border)">
      <div style="font-size:.72rem;font-weight:700;color:var(--muted);margin-bottom:.4rem;text-transform:uppercase;letter-spacing:.05em">Échelle de cotation</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:.2rem">${g.scaleItems.map(s=>`<div style="text-align:center;padding:.3rem .2rem;background:#fff;border-radius:4px;border:0.5px solid var(--border)"><div style="font-size:.85rem;font-weight:800;color:${g.color}">${s.val}</div><div style="font-size:.58rem;color:var(--muted);line-height:1.2">${s.label}</div></div>`).join('')}</div>
    </div>`;
    container.innerHTML = scaleHtml + g.dimensions.map(dim =>
      `<div style="margin-bottom:.85rem">
        <div style="font-size:.78rem;font-weight:700;color:${g.color};margin-bottom:.4rem;text-transform:uppercase;letter-spacing:.04em">${dim.label}</div>
        ${dim.items.map(it => {
          const val = scores?.[it.id] || '';
          return `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.3rem;padding:.35rem .5rem;background:#f8fafc;border-radius:6px">
            <label style="flex:1;font-size:.8rem;color:var(--text)">${it.label}</label>
            <select name="score_${it.id}" style="font-size:.8rem;padding:.2rem .4rem;border:1px solid var(--border);border-radius:6px;width:60px">
              <option value="">—</option>
              ${[7,6,5,4,3,2,1].map(v=>`<option value="${v}"${Number(val)===v?' selected':''}>${v}</option>`).join('')}
            </select>
          </div>`;
        }).join('')}
      </div>`
    ).join('');
  } else if (grille === 'barthel') {
    container.innerHTML = g.dimensions[0].items.map(it => {
      const val = scores?.[it.id] ?? '';
      return `<div style="margin-bottom:.55rem;padding:.5rem .65rem;background:#f8fafc;border-radius:8px;border:0.5px solid var(--border)">
        <div style="font-size:.8rem;font-weight:600;color:var(--text);margin-bottom:.35rem">${it.label}</div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap">
          ${it.opts.map(o=>`<label style="display:flex;align-items:center;gap:.3rem;font-size:.76rem;cursor:pointer;padding:.2rem .5rem;border-radius:6px;border:1px solid var(--border);background:#fff"><input type="radio" name="score_${it.id}" value="${o.v}"${Number(val)===o.v?' checked':''}> ${o.l} <b>(${o.v})</b></label>`).join('')}
        </div>
      </div>`;
    }).join('');
  }

  // Score live
  container.addEventListener('change', _updateEvLiveScore);
  _updateEvLiveScore();
}

function _updateEvLiveScore() {
  const grille = document.getElementById('evModalGrille')?.value || 'mif';
  const g = EV_GRILLES[grille];
  if (!g) return;
  let total = 0;
  document.querySelectorAll('#evFormBody [name^="score_"]').forEach(el => {
    if ((el.type === 'radio' && el.checked) || el.tagName === 'SELECT') {
      const v = Number(el.value);
      if (!isNaN(v) && v > 0) total += v;
    }
  });
  const niveau = _evNiveau(grille, total);
  const scoreEl = document.getElementById('evLiveScore');
  if (scoreEl) {
    scoreEl.innerHTML = `<span style="font-size:1.4rem;font-weight:800;color:${niveau?.color||g.color}">${total}</span><span style="color:var(--muted)"> / ${g.scoreMax}</span> — <span style="color:${niveau?.color||g.color};font-weight:600">${niveau?.label||''}</span>`;
  }
}

async function saveEvaluation() {
  const rid   = document.getElementById('evModalResidentSel').value;
  const grille = document.getElementById('evModalGrille').value;
  const date  = document.getElementById('evModalDate').value;
  const note  = document.getElementById('evModalNote').value.trim();
  if (!date) { toast('La date est obligatoire','error'); return; }

  const scores = {};
  document.querySelectorAll('#evFormBody [name^="score_"]').forEach(el => {
    if ((el.type === 'radio' && el.checked) || el.tagName === 'SELECT') {
      const itemId = el.name.replace('score_','');
      const v = Number(el.value);
      if (!isNaN(v) && el.value !== '') scores[itemId] = v;
    }
  });

  const data = { residentId: rid||null, grille, date, note, scores };

  try {
    if (_evEditId) {
      const old = _evCache.find(x => x.id === _evEditId) || {};
      const saved = await sbSaveEvaluation({ ...old, ...data, id: _evEditId });
      _evCache = _evCache.map(x => x.id === _evEditId ? saved : x);
      toast('Évaluation modifiée');
    } else {
      const saved = await sbSaveEvaluation(data);
      _evCache.unshift(saved);
      toast('Évaluation enregistrée', 'success');
    }
  } catch (e) { console.error('[saveEvaluation]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
  closeModal('modalEv');
  renderEvList();
}

// ─── Détail ───────────────────────────────────────────────────────────────────
function openEvDetail(id) {
  const ev = getEv().find(x => x.id === id);
  if (!ev) return;
  const g = EV_GRILLES[ev.grille];
  if (!g) return;
  const score  = _evScore(ev);
  const niveau = _evNiveau(ev.grille, score);
  const residents = sbResidents();
  const r = residents.find(x => x.id === ev.residentId);
  const nom = r ? `${r.prenom||''} ${r.nom||''}`.trim() : 'Résident inconnu';
  const dateStr = new Date(ev.date).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  let detailHtml = '';
  if (ev.grille === 'mif') {
    detailHtml = g.dimensions.map(dim => {
      const dimItems = dim.items.filter(it => ev.scores?.[it.id]);
      if (!dimItems.length) return '';
      return `<div style="margin-bottom:.75rem">
        <div style="font-size:.75rem;font-weight:700;color:${g.color};text-transform:uppercase;margin-bottom:.3rem">${dim.label}</div>
        ${dimItems.map(it => {
          const v = ev.scores[it.id];
          const sc = g.scaleItems.find(s=>s.val===v);
          return `<div style="display:flex;justify-content:space-between;padding:.25rem .5rem;border-radius:4px;background:#f8fafc;margin-bottom:.2rem">
            <span style="font-size:.78rem">${it.label}</span>
            <span style="font-size:.78rem;font-weight:700;color:${v>=5?'#16a34a':v>=3?'#d97706':'#dc2626'}">${v} — ${sc?.label||''}</span>
          </div>`;
        }).join('')}
      </div>`;
    }).join('');
  } else if (ev.grille === 'barthel') {
    detailHtml = g.dimensions[0].items.filter(it => ev.scores?.[it.id] !== undefined).map(it => {
      const v = ev.scores[it.id];
      const opt = it.opts.find(o=>o.v===v);
      return `<div style="display:flex;justify-content:space-between;padding:.3rem .5rem;border-radius:4px;background:#f8fafc;margin-bottom:.25rem">
        <span style="font-size:.78rem">${it.label}</span>
        <span style="font-size:.78rem;font-weight:700;color:${v>=10?'#16a34a':v>=5?'#d97706':'#dc2626'}">${v} — ${opt?.l||''}</span>
      </div>`;
    }).join('');
  }

  const pct = Math.round(score / g.scoreMax * 100);
  document.getElementById('evDetailBody').innerHTML = `
    <div style="text-align:center;margin-bottom:1rem">
      <div style="font-size:.8rem;color:var(--muted)">${dateStr}</div>
      <div style="font-size:.85rem;font-weight:600;color:var(--text);margin:.2rem 0">${nom} — ${g.label}</div>
      <div style="font-size:2.2rem;font-weight:800;color:${niveau?.color||g.color}">${score}<span style="font-size:1rem;font-weight:400;color:var(--muted)"> / ${g.scoreMax}</span></div>
      <div style="font-size:.85rem;font-weight:700;color:${niveau?.color||g.color};margin:.2rem 0">${niveau?.label||''}</div>
      <div style="height:8px;background:#f1f5f9;border-radius:999px;margin:.75rem auto;max-width:280px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${niveau?.color||g.color};border-radius:999px"></div></div>
    </div>
    ${detailHtml}
    ${ev.note ? `<div style="margin-top:.75rem;padding:.6rem .75rem;background:#f8fafc;border-radius:8px;border-left:3px solid ${g.color};font-size:.8rem;color:var(--muted);font-style:italic">${escHtml(ev.note)}</div>` : ''}`;
  openModal('modalEvDetail');
}

// ─── Delete ───────────────────────────────────────────────────────────────────
function deleteEv(id) {
  if (!confirm('Supprimer cette évaluation ?')) return;
  (async () => {
    try { await sbDeleteEvaluation(id); _evCache = _evCache.filter(x => x.id !== id); }
    catch (e) { console.error('[deleteEv]', e); toast('Erreur suppression : ' + (e?.message || e), 'error'); return; }
    renderEvList();
    toast('Évaluation supprimée');
  })();
}

document.addEventListener('DOMContentLoaded', initEvaluations);
