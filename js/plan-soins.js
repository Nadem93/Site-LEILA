const PS_KEY = DB.keys.planSoins;

const PS_FREQS = [
  { id:'quotidien',  label:'Quotidien',    short:'J' },
  { id:'matin',      label:'Matin',        short:'M' },
  { id:'midi',       label:'Midi',         short:'Mi' },
  { id:'soir',       label:'Soir',         short:'S' },
  { id:'nuit',       label:'Nuit',         short:'N' },
  { id:'semaine',    label:'Hebdomadaire', short:'H' },
  { id:'mensuel',    label:'Mensuel',      short:'Mo' },
  { id:'si_besoin',  label:'Si besoin',    short:'SB' }
];

const PS_CATS = [
  { id:'hygiene',      label:'Hygiène corporelle',   color:'#0ea5e9', icon:'🚿' },
  { id:'medication',   label:'Médicaments',          color:'#ef4444', icon:'💊' },
  { id:'mobilite',     label:'Mobilité & posture',   color:'#f97316', icon:'🦽' },
  { id:'alimentation', label:'Alimentation & repas', color:'#f59e0b', icon:'🍽️' },
  { id:'soins_infirm', label:'Soins infirmiers',     color:'#8b5cf6', icon:'🩺' },
  { id:'psy',          label:'Accompagnement psy',   color:'#6366f1', icon:'🧠' },
  { id:'social',       label:'Accompagnement social',color:'#10b981', icon:'🤝' },
  { id:'autre',        label:'Autre',                color:'#64748b', icon:'📋' }
];

// Source = Supabase. Cache mémoire chargé au démarrage.
let _psCache = [];
function getPs()       { return _psCache; }
async function loadPsCache() { _psCache = await sbGetPlanSoins(); }

function _psCat(id)    { return PS_CATS.find(c => c.id === id) || PS_CATS[7]; }
function _psFreq(id)   { return PS_FREQS.find(f => f.id === id) || PS_FREQS[0]; }

let _psResidentId = '';
let _psEditId     = '';

async function initPlanSoins() {
  const s = Auth.requireAuth();
  if (!s) return;
  await sbLoadResidentsCache();
  await loadPsCache();
  _populatePsResidents();
  const params = new URLSearchParams(window.location.search);
  const rid = params.get('residentId') || params.get('id');
  if (rid) {
    _psResidentId = rid;
    const sel = document.getElementById('psResident');
    if (sel) sel.value = rid;
  }
  document.getElementById('psResident')?.addEventListener('change', e => {
    _psResidentId = e.target.value;
    renderPlanSoins();
  });
  document.getElementById('psFilterCat')?.addEventListener('change', renderPlanSoins);
  renderPlanSoins();
}

function _populatePsResidents() {
  const residents = sbResidents();
  ['psResident','psModalResident'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const allOpt = id === 'psResident' ? '<option value="">Tous les résidents</option>' : '<option value="">— Choisir —</option>';
    el.innerHTML = allOpt + residents.map(r =>
      `<option value="${r.id}">${escHtml((r.prenom||'') + ' ' + (r.nom||''))}</option>`
    ).join('');
    if (_psResidentId) el.value = _psResidentId;
  });
}

function renderPlanSoins() {
  const container = document.getElementById('psList');
  if (!container) return;
  const filterCat = document.getElementById('psFilterCat')?.value || '';
  const residents = sbResidents();

  let list = getPs();
  if (_psResidentId) list = list.filter(p => p.residentId === _psResidentId);
  if (filterCat)     list = list.filter(p => p.cat === filterCat);

  // Stats
  document.getElementById('psStatTotal').textContent = list.length;
  document.getElementById('psStatActifs').textContent = list.filter(p => p.actif !== false).length;
  document.getElementById('psStatResidents').textContent = new Set(list.map(p => p.residentId).filter(Boolean)).size;

  if (!list.length) {
    container.innerHTML = `<div class="empty" style="padding:3rem">
      <div class="empty-icon">🩺</div>
      <p>${_psResidentId ? 'Aucun soin défini pour ce résident' : 'Aucun plan de soins'}</p>
      <button class="btn btn-outline btn-sm" onclick="openPsModal()">Ajouter un soin</button>
    </div>`;
    return;
  }

  // Grouper par résident puis par catégorie
  const byResident = {};
  list.forEach(p => {
    const key = p.residentId || '__general';
    if (!byResident[key]) byResident[key] = [];
    byResident[key].push(p);
  });

  container.innerHTML = Object.entries(byResident).map(([rid, soins]) => {
    const r = residents.find(x => x.id === rid);
    const resColor = r?.color || '#0f2b4a';
    const resName  = r ? `${r.prenom||''} ${r.nom||''}`.trim() : 'Général';

    const byCat = {};
    PS_CATS.forEach(c => { byCat[c.id] = []; });
    soins.forEach(s => { if (byCat[s.cat]) byCat[s.cat].push(s); });

    return `<div style="margin-bottom:1.5rem">
      <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.75rem;padding:.6rem .85rem;background:#fff;border-radius:10px;border:1.5px solid ${resColor}33">
        <div style="width:34px;height:34px;border-radius:50%;background:${resColor};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.8rem;color:#fff;flex-shrink:0">${(resName.split(' ').map(w=>w[0]||'').join('').slice(0,2)).toUpperCase()}</div>
        <span style="font-weight:700;font-size:.95rem;color:${resColor}">${escHtml(resName)}</span>
        <span style="margin-left:auto;font-size:.75rem;color:var(--muted)">${soins.filter(s=>s.actif!==false).length} soin${soins.length>1?'s':''} actif${soins.length>1?'s':''}</span>
        <button class="btn btn-accent btn-sm" onclick="openPsModal('','${rid}')">+ Ajouter</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:.6rem">
        ${PS_CATS.map(cat => {
          const items = byCat[cat.id];
          if (!items.length) return '';
          return `<div style="background:#fff;border-radius:10px;border:1px solid ${cat.color}33;overflow:hidden">
            <div style="padding:.5rem .85rem;background:${cat.color}15;border-bottom:1px solid ${cat.color}22;display:flex;align-items:center;gap:.4rem">
              <span>${cat.icon}</span>
              <span style="font-size:.78rem;font-weight:700;color:${cat.color}">${cat.label}</span>
              <span style="margin-left:auto;font-size:.7rem;color:var(--muted)">${items.length}</span>
            </div>
            <div style="padding:.5rem .85rem;display:flex;flex-direction:column;gap:.4rem">
              ${items.map(s => _psRow(s)).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}

function _psRow(s) {
  const freq = _psFreq(s.freq);
  const isActif = s.actif !== false;
  return `<div style="display:flex;align-items:flex-start;gap:.5rem;padding:.45rem .55rem;border-radius:6px;background:${isActif?'#f8fafc':'#f1f5f9'};border:0.5px solid var(--border);opacity:${isActif?1:.6}">
    <div style="flex:1;min-width:0">
      <div style="font-size:.82rem;font-weight:600;color:var(--text)">${escHtml(s.libelle||'—')}</div>
      ${s.detail ? `<div style="font-size:.72rem;color:var(--muted);margin-top:1px">${escHtml(s.detail)}</div>` : ''}
      <div style="display:flex;gap:.3rem;margin-top:.3rem;flex-wrap:wrap">
        <span style="font-size:.66rem;background:var(--g100);color:var(--g700);padding:1px 6px;border-radius:999px;font-weight:600">${freq.label}</span>
        ${s.intervenant ? `<span style="font-size:.66rem;background:#e0f2fe;color:#0369a1;padding:1px 6px;border-radius:999px">${escHtml(s.intervenant)}</span>` : ''}
        ${!isActif ? '<span style="font-size:.66rem;background:#f1f5f9;color:#94a3b8;padding:1px 6px;border-radius:999px">Suspendu</span>' : ''}
      </div>
    </div>
    <div style="display:flex;gap:.2rem;flex-shrink:0">
      <button class="btn btn-ghost btn-sm" style="padding:2px 5px" onclick="openPsModal('${s.id}')" title="Modifier">✎</button>
      <button class="btn btn-ghost btn-sm" style="padding:2px 5px" onclick="togglePsActif('${s.id}')" title="${isActif?'Suspendre':'Réactiver'}">${isActif?'⏸':'▶'}</button>
      <button class="btn btn-ghost btn-sm" style="padding:2px 5px;color:#dc2626" onclick="deletePs('${s.id}')" title="Supprimer">✕</button>
    </div>
  </div>`;
}

function openPsModal(id, presetResidentId) {
  _psEditId = id || '';
  const list = getPs();
  const s = id ? list.find(x => x.id === id) : null;
  document.getElementById('psModalTitle').textContent = s ? 'Modifier le soin' : 'Nouveau soin';
  document.getElementById('psModalId').value = _psEditId;
  const rid = s?.residentId || presetResidentId || _psResidentId || '';
  document.getElementById('psModalResident').value = rid;
  document.getElementById('psModalCat').value = s?.cat || 'hygiene';
  document.getElementById('psModalFreq').value = s?.freq || 'quotidien';
  document.getElementById('psModalLibelle').value = s?.libelle || '';
  document.getElementById('psModalDetail').value = s?.detail || '';
  document.getElementById('psModalIntervenant').value = s?.intervenant || '';
  document.getElementById('psModalNote').value = s?.note || '';
  openModal('modalPlanSoins');
}

async function savePlanSoins() {
  const libelle = document.getElementById('psModalLibelle').value.trim();
  if (!libelle) { toast('Le libellé est obligatoire', 'error'); return; }
  const rid = document.getElementById('psModalResident').value;
  const list = getPs();
  const now = new Date().toISOString();
  const data = {
    residentId:   rid,
    cat:          document.getElementById('psModalCat').value,
    freq:         document.getElementById('psModalFreq').value,
    libelle,
    detail:       document.getElementById('psModalDetail').value.trim(),
    intervenant:  document.getElementById('psModalIntervenant').value.trim(),
    note:         document.getElementById('psModalNote').value.trim(),
    actif:        true
  };
  try {
    if (_psEditId) {
      const old = _psCache.find(x => x.id === _psEditId) || {};
      const saved = await sbSavePlanSoins({ ...old, ...data, id: _psEditId });
      _psCache = _psCache.map(x => x.id === _psEditId ? saved : x);
      toast('Soin modifié');
    } else {
      const saved = await sbSavePlanSoins(data);
      _psCache.unshift(saved);
      toast('Soin ajouté', 'success');
    }
  } catch (e) { console.error('[savePlanSoins]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
  closeModal('modalPlanSoins');
  renderPlanSoins();
}

async function togglePsActif(id) {
  const s = _psCache.find(x => x.id === id);
  if (!s) return;
  const newActif = s.actif === false;
  try {
    const saved = await sbSavePlanSoins({ ...s, actif: newActif, id });
    _psCache = _psCache.map(x => x.id === id ? saved : x);
  } catch (e) { console.error('[togglePsActif]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
  renderPlanSoins();
  toast(newActif ? 'Soin réactivé' : 'Soin suspendu');
}

function deletePs(id) {
  if (!confirm('Supprimer ce soin du plan ?')) return;
  (async () => {
    try {
      await sbDeletePlanSoins(id);
      _psCache = _psCache.filter(x => x.id !== id);
    } catch (e) { console.error('[deletePs]', e); toast('Erreur suppression : ' + (e?.message || e), 'error'); return; }
    renderPlanSoins();
    toast('Soin supprimé');
  })();
}

document.addEventListener('DOMContentLoaded', initPlanSoins);
if (typeof registerPageInit === 'function') registerPageInit('plan-soins', initPlanSoins);
