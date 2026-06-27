const INV_KEY = DB.keys.inventaire;

const INV_CATS = [
  { id:'mobilier',    label:'Mobilier',            icon:'🪑', color:'#92400e' },
  { id:'medical',     label:'Matériel médical',    icon:'🩺', color:'#dc2626' },
  { id:'informatique',label:'Informatique',        icon:'💻', color:'#3b82f6' },
  { id:'electromenager',label:'Électroménager',   icon:'🔌', color:'#6366f1' },
  { id:'linge',       label:'Linge & literie',     icon:'🛏️', color:'#0d9488' },
  { id:'hygiene',     label:'Hygiène & produits',  icon:'🧴', color:'#059669' },
  { id:'securite',    label:'Sécurité',            icon:'🔒', color:'#7c3aed' },
  { id:'vehicule',    label:'Véhicules',           icon:'🚗', color:'#0891b2' },
  { id:'autre',       label:'Autre',               icon:'📦', color:'#64748b' }
];

const INV_ETATS = {
  bon:        { label:'Bon état',      color:'#16a34a' },
  usage:      { label:'Usagé',         color:'#d97706' },
  defaillant: { label:'Défaillant',    color:'#dc2626' },
  hors_usage: { label:'Hors d\'usage', color:'#64748b' }
};

// Source = Supabase. Cache mémoire chargé au démarrage.
let _invCache = [];
function getInv()       { return _invCache; }
async function loadInvCache() { _invCache = await sbGetInventaire(); }
function _invCat(id)    { return INV_CATS.find(c => c.id === id) || INV_CATS[8]; }

let _invEditId    = '';
let _invFilterCat = '';
let _invFilterEtat = '';
let _invSearch    = '';

async function initInventaire() {
  Auth.requireAuth();
  await loadInvCache();
  document.getElementById('invSearch')?.addEventListener('input', e => { _invSearch = e.target.value.toLowerCase(); renderInventaire(); });
  document.getElementById('invFilterCat')?.addEventListener('change', e => { _invFilterCat = e.target.value; renderInventaire(); });
  document.getElementById('invFilterEtat')?.addEventListener('change', e => { _invFilterEtat = e.target.value; renderInventaire(); });
  renderInventaire();
}

function renderInventaire() {
  let list = getInv();
  if (_invFilterCat)  list = list.filter(i => i.cat === _invFilterCat);
  if (_invFilterEtat) list = list.filter(i => i.etat === _invFilterEtat);
  if (_invSearch)     list = list.filter(i => `${i.nom||''} ${i.ref||''} ${i.lieu||''} ${i.notes||''}`.toLowerCase().includes(_invSearch));

  // Stats
  const all = getInv();
  document.getElementById('invStatTotal').textContent      = all.length;
  document.getElementById('invStatDefaillant').textContent = all.filter(i => i.etat === 'defaillant').length;
  document.getElementById('invStatHorsUsage').textContent  = all.filter(i => i.etat === 'hors_usage').length;

  const container = document.getElementById('invList');
  if (!container) return;

  if (!list.length) {
    container.innerHTML = `<div class="empty" style="padding:3rem;text-align:center">
      <div style="font-size:3rem;margin-bottom:.5rem">📦</div>
      <p style="font-weight:600">${_invSearch || _invFilterCat || _invFilterEtat ? 'Aucun équipement trouvé' : 'Aucun équipement enregistré'}</p>
      <button class="btn btn-outline btn-sm" onclick="openInvModal()">Ajouter un équipement</button>
    </div>`;
    return;
  }

  // Grouper par catégorie
  const byCat = {};
  INV_CATS.forEach(c => { byCat[c.id] = []; });
  list.forEach(i => { (byCat[i.cat] = byCat[i.cat] || []).push(i); });

  container.innerHTML = INV_CATS.map(cat => {
    const items = byCat[cat.id];
    if (!items?.length) return '';
    return `<div style="margin-bottom:1.25rem">
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.6rem;padding:.4rem .75rem;background:#fff;border-radius:8px;border-left:3px solid ${cat.color}">
        <span>${cat.icon}</span>
        <span style="font-size:.82rem;font-weight:700;color:${cat.color}">${cat.label}</span>
        <span style="font-size:.72rem;color:var(--muted);margin-left:auto">${items.length} article${items.length>1?'s':''}</span>
        <button class="btn btn-ghost btn-sm" style="font-size:.72rem" onclick="openInvModal('','${cat.id}')">+ Ajouter</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:.5rem">
        ${items.map(i => _invCard(i, cat)).join('')}
      </div>
    </div>`;
  }).join('');
}

function _invCard(i, cat) {
  const etat = INV_ETATS[i.etat] || INV_ETATS.bon;
  const maintenanceOk = !i.dateMaintenance || new Date(i.dateMaintenance) >= new Date(Date.now() - 365*86400000);
  return `<div style="background:#fff;border:1px solid var(--border);border-radius:9px;padding:.6rem .8rem;display:flex;align-items:flex-start;gap:.5rem">
    <div style="width:34px;height:34px;border-radius:8px;background:${cat.color}15;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">${cat.icon}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:.82rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(i.nom||'—')}</div>
      <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.2rem">
        <span style="font-size:.65rem;padding:1px 6px;border-radius:999px;background:${etat.color}18;color:${etat.color};font-weight:600">${etat.label}</span>
        ${i.quantite > 1 ? `<span style="font-size:.65rem;padding:1px 6px;border-radius:999px;background:#f1f5f9;color:var(--muted)">×${i.quantite}</span>` : ''}
        ${i.lieu ? `<span style="font-size:.65rem;color:var(--muted)">📍 ${escHtml(i.lieu)}</span>` : ''}
        ${!maintenanceOk ? `<span style="font-size:.65rem;padding:1px 6px;border-radius:999px;background:#fef2f2;color:#dc2626">⚠ Maintenance</span>` : ''}
      </div>
      ${i.ref ? `<div style="font-size:.68rem;color:var(--muted);margin-top:1px">Réf : ${escHtml(i.ref)}</div>` : ''}
    </div>
    <div style="display:flex;flex-direction:column;gap:.2rem;flex-shrink:0">
      <button class="btn btn-ghost btn-sm" style="padding:2px 5px" onclick="openInvModal('${i.id}')" title="Modifier">✎</button>
      <button class="btn btn-ghost btn-sm" style="padding:2px 5px;color:#dc2626" onclick="deleteInv('${i.id}')" title="Supprimer">✕</button>
    </div>
  </div>`;
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openInvModal(id, presetCat) {
  _invEditId = id || '';
  const list = getInv();
  const item = id ? list.find(x => x.id === id) : null;

  document.getElementById('invModalTitle').textContent = item ? 'Modifier l\'équipement' : 'Nouvel équipement';
  document.getElementById('invModalCat').value         = item?.cat  || presetCat || 'mobilier';
  document.getElementById('invModalNom').value         = item?.nom  || '';
  document.getElementById('invModalRef').value         = item?.ref  || '';
  document.getElementById('invModalQte').value         = item?.quantite || 1;
  document.getElementById('invModalEtat').value        = item?.etat || 'bon';
  document.getElementById('invModalLieu').value        = item?.lieu || '';
  document.getElementById('invModalAchat').value       = item?.dateAchat || '';
  document.getElementById('invModalMaintenance').value = item?.dateMaintenance || '';
  document.getElementById('invModalNotes').value       = item?.notes || '';
  openModal('modalInv');
}

async function saveInventaire() {
  const nom = document.getElementById('invModalNom').value.trim();
  if (!nom) { toast('Le nom est obligatoire', 'error'); return; }
  const data = {
    cat:             document.getElementById('invModalCat').value,
    nom,
    ref:             document.getElementById('invModalRef').value.trim(),
    quantite:        Number(document.getElementById('invModalQte').value) || 1,
    etat:            document.getElementById('invModalEtat').value,
    lieu:            document.getElementById('invModalLieu').value.trim(),
    dateAchat:       document.getElementById('invModalAchat').value,
    dateMaintenance: document.getElementById('invModalMaintenance').value,
    notes:           document.getElementById('invModalNotes').value.trim()
  };
  try {
    if (_invEditId) {
      const old = _invCache.find(x => x.id === _invEditId) || {};
      const saved = await sbSaveInventaire({ ...old, ...data, id: _invEditId });
      _invCache = _invCache.map(x => x.id === _invEditId ? saved : x);
      toast('Équipement modifié');
    } else {
      const saved = await sbSaveInventaire(data);
      _invCache.push(saved);
      toast('Équipement ajouté', 'success');
    }
  } catch (e) { console.error('[saveInventaire]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
  closeModal('modalInv');
  renderInventaire();
}

function deleteInv(id) {
  if (!confirm('Supprimer cet équipement ?')) return;
  (async () => {
    try { await sbDeleteInventaire(id); _invCache = _invCache.filter(x => x.id !== id); }
    catch (e) { console.error('[deleteInv]', e); toast('Erreur suppression : ' + (e?.message || e), 'error'); return; }
    renderInventaire();
    toast('Supprimé');
  })();
}

document.addEventListener('DOMContentLoaded', initInventaire);
