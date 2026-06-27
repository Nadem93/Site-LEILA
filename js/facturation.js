const FACT_CATEGORIES_DEFAULT = [
  { id: 'internat_complet', label: 'Internat complet (7j/7)', prixJour: 120 },
  { id: 'internat_sequentiel', label: 'Internat séquentiel', prixJour: 95 },
  { id: 'externat', label: 'Accueil de jour / externat', prixJour: 60 },
  { id: 'accueil_temporaire', label: 'Accueil temporaire / urgence', prixJour: 140 }
];
const FACT_ORGANISMES = ['ASE', 'MDPH / Conseil départemental', 'Sécurité sociale', 'Famille', 'Autre'];
const FACT_STATUT_LABELS = { brouillon: 'Brouillon', envoyee: 'Envoyée', payee: 'Payée' };
const FACT_STATUT_COLORS = { brouillon: '#6b7280', envoyee: '#0284c7', payee: '#16a34a' };

function eur(n) { return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }

// Source = Supabase. Caches mémoire chargés au démarrage.
let _factTarifs = null;
let _factCache = [];
async function loadFactCaches() {
  const t = await sbGetTarifs();
  _factTarifs = (t && Array.isArray(t.categories)) ? t : null;
  _factCache = await sbGetFactures();
}
function getTarifs() {
  if (!_factTarifs || !Array.isArray(_factTarifs.categories)) {
    _factTarifs = { categories: FACT_CATEGORIES_DEFAULT.map(c => ({ ...c })), affectations: {} };
  }
  if (!_factTarifs.affectations) _factTarifs.affectations = {};
  return _factTarifs;
}
function setTarifs(t) {
  _factTarifs = t;
  sbSaveTarifs(t).catch(e => { console.error('[tarifs]', e); toast('Erreur sauvegarde tarifs', 'error'); });
}

function getFactures() { return _factCache; }

// ── TARIFS (catégories de prise en charge) ──
function openTarifModal(id) {
  document.getElementById('modalTarif').dataset.id = id || '';
  document.getElementById('tarifModalTitle').textContent = id ? '💶 Modifier la catégorie' : '💶 Nouvelle catégorie de tarif';
  if (id) {
    const cat = getTarifs().categories.find(c => c.id === id);
    if (!cat) return;
    document.getElementById('tarifFormLabel').value = cat.label;
    document.getElementById('tarifFormPrix').value = cat.prixJour;
  } else {
    document.getElementById('tarifFormLabel').value = '';
    document.getElementById('tarifFormPrix').value = '';
  }
  openModal('modalTarif');
}

function saveTarif() {
  const label = document.getElementById('tarifFormLabel').value.trim();
  const prixJour = parseFloat(document.getElementById('tarifFormPrix').value);
  if (!label) { toast('Libellé requis', 'error'); return; }
  if (isNaN(prixJour) || prixJour < 0) { toast('Prix par jour invalide', 'error'); return; }

  const t = getTarifs();
  const id = document.getElementById('modalTarif').dataset.id;
  if (id) {
    t.categories = t.categories.map(c => c.id === id ? { ...c, label, prixJour } : c);
    toast('Catégorie mise à jour');
  } else {
    t.categories.push({ id: genId(), label, prixJour });
    toast('Catégorie ajoutée');
  }
  setTarifs(t);
  closeModal('modalTarif');
  renderFacturation();
}

function supprimerTarif(id) {
  if (!confirm('Supprimer cette catégorie de tarif ?')) return;
  const t = getTarifs();
  t.categories = t.categories.filter(c => c.id !== id);
  Object.keys(t.affectations).forEach(rid => {
    if (t.affectations[rid] && t.affectations[rid].categorieId === id) t.affectations[rid].categorieId = '';
  });
  setTarifs(t);
  toast('Catégorie supprimée', 'info');
  renderFacturation();
}

function renderTarifs() {
  const isAdmin = Auth.isAdmin();
  const t = getTarifs();
  const el = document.getElementById('tarifsList');
  if (!t.categories.length) {
    el.innerHTML = '<div style="font-size:.78rem;color:var(--muted)">Aucune catégorie de tarif définie.</div>';
    return;
  }
  el.innerHTML = t.categories.map(c => `
    <div style="display:flex;align-items:center;gap:.75rem;padding:.6rem .85rem;background:#fff;border-radius:10px;margin-bottom:6px;box-shadow:0 2px 6px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04)">
      <div style="flex:1;font-weight:600;font-size:.85rem">${escHtml(c.label)}</div>
      <div style="font-weight:700;color:#be185d;font-size:.85rem">${eur(c.prixJour)} / jour</div>
      ${isAdmin ? `<div style="display:flex;gap:.25rem">
        <button class="btn btn-ghost btn-sm" onclick="openTarifModal('${c.id}')">✎</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="supprimerTarif('${c.id}')">✕</button>
      </div>` : ''}
    </div>`).join('');
}

// ── AFFECTATION DES RÉSIDENTS ──
function setAffectation(residentId, field, value) {
  const t = getTarifs();
  if (!t.affectations[residentId]) t.affectations[residentId] = { categorieId: '', organisme: '' };
  t.affectations[residentId][field] = value;
  setTarifs(t);
}

function renderAffectations() {
  const isAdmin = Auth.isAdmin();
  const t = getTarifs();
  const residents = sbResidents().filter(r => r.statut !== 'sorti');
  const el = document.getElementById('affectationsList');
  if (!residents.length) {
    el.innerHTML = '<div style="font-size:.78rem;color:var(--muted)">Aucun résident actif.</div>';
    return;
  }
  el.innerHTML = residents.map(r => {
    const aff = t.affectations[r.id] || { categorieId: '', organisme: '' };
    const catOptions = '<option value="">— Non affecté —</option>' + t.categories.map(c => `<option value="${c.id}"${aff.categorieId === c.id ? ' selected' : ''}>${escHtml(c.label)}</option>`).join('');
    const orgOptions = '<option value="">— Organisme payeur —</option>' + FACT_ORGANISMES.map(o => `<option value="${escHtml(o)}"${aff.organisme === o ? ' selected' : ''}>${escHtml(o)}</option>`).join('');
    return `<div style="display:flex;align-items:center;gap:.75rem;padding:.6rem .85rem;background:#fff;border-radius:10px;margin-bottom:6px;box-shadow:0 2px 6px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04);flex-wrap:wrap">
      <div style="flex:1;min-width:140px;font-weight:600;font-size:.85rem">${escHtml(r.prenom)} ${escHtml(r.nom)}</div>
      <select class="form-input" style="width:220px" ${isAdmin ? '' : 'disabled'} onchange="setAffectation('${r.id}','categorieId',this.value)">${catOptions}</select>
      <select class="form-input" style="width:200px" ${isAdmin ? '' : 'disabled'} onchange="setAffectation('${r.id}','organisme',this.value)">${orgOptions}</select>
    </div>`;
  }).join('');
}

// ── GÉNÉRATION DES FACTURES ──
async function genererFactures() {
  const periode = document.getElementById('factPeriode').value;
  if (!periode) { toast('Choisissez une période', 'error'); return; }
  const t = getTarifs();
  const residents = sbResidents().filter(r => r.statut !== 'sorti');
  const presences = DB.get(DB.keys.presences) || {};
  let nb = 0;

  try {
    for (const r of residents) {
      const aff = t.affectations[r.id];
      if (!aff || !aff.categorieId) continue;
      const cat = t.categories.find(c => c.id === aff.categorieId);
      if (!cat) continue;
      const nbJours = Object.keys(presences).filter(date => date.startsWith(periode) && presences[date][r.id] === 'present').length;
      const montant = nbJours * cat.prixJour;
      const data = {
        periode, residentId: r.id, residentNom: `${r.prenom} ${r.nom}`,
        organisme: aff.organisme || 'Non renseigné',
        categorieId: cat.id, categorieLabel: cat.label,
        nbJours, prixJour: cat.prixJour, montant
      };
      const existing = _factCache.find(f => f.periode === periode && String(f.residentId) === String(r.id));
      if (existing) {
        const saved = await sbSaveFacture({ ...existing, ...data });
        _factCache = _factCache.map(f => f.id === saved.id ? saved : f);
      } else {
        const saved = await sbSaveFacture({ statut: 'brouillon', ...data });
        _factCache.push(saved);
      }
      nb++;
    }
  } catch (e) { console.error('[genererFactures]', e); toast('Erreur génération : ' + (e?.message || e), 'error'); return; }

  if (typeof auditLog === 'function') auditLog('facturation_generation', `${nb} facture(s) pour ${periode}`);
  toast(`${nb} facture(s) générée(s) pour ${periode}`, 'success');
  renderFacturation();
}

function changerStatutFacture(id, statut) {
  const f = _factCache.find(x => x.id === id);
  if (!f) return;
  const upd = { ...f, statut };
  if (statut === 'envoyee') upd.dateEnvoi = today();
  if (statut === 'payee') upd.datePaiement = today();
  (async () => {
    try { const saved = await sbSaveFacture(upd); _factCache = _factCache.map(x => x.id === id ? saved : x); }
    catch (e) { console.error('[changerStatutFacture]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
    toast('Statut mis à jour');
    renderFacturation();
  })();
}

function supprimerFacture(id) {
  if (!confirm('Supprimer cette facture ?')) return;
  (async () => {
    try { await sbDeleteFacture(id); _factCache = _factCache.filter(f => f.id !== id); }
    catch (e) { console.error('[supprimerFacture]', e); toast('Erreur suppression : ' + (e?.message || e), 'error'); return; }
    toast('Facture supprimée', 'info');
    renderFacturation();
  })();
}

// ── LISTE & STATS ──
function factureItemHtml(f, isAdmin) {
  const color = FACT_STATUT_COLORS[f.statut] || '#6b7280';
  const label = FACT_STATUT_LABELS[f.statut] || f.statut;
  return `<div style="display:flex;align-items:center;gap:.75rem;padding:.85rem 1rem;background:#fff;border-radius:10px;margin-bottom:6px;box-shadow:0 2px 6px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04);flex-wrap:wrap">
    <div style="flex:1;min-width:180px">
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
        <span style="font-weight:600;font-size:.85rem">${escHtml(f.residentNom)}</span>
        <span class="badge" style="background:${color}20;color:${color}">${escHtml(label)}</span>
      </div>
      <div style="font-size:.74rem;color:var(--muted);margin-top:.2rem">
        Période ${escHtml(f.periode)} · ${escHtml(f.categorieLabel)} · ${escHtml(f.organisme)} · ${f.nbJours} j × ${eur(f.prixJour)}
        ${f.dateEnvoi ? ' · Envoyée le ' + formatDate(f.dateEnvoi) : ''}${f.datePaiement ? ' · Payée le ' + formatDate(f.datePaiement) : ''}
      </div>
    </div>
    <div style="font-weight:800;font-size:1rem;color:#0f2b4a;min-width:90px;text-align:right">${eur(f.montant)}</div>
    ${isAdmin ? `<div style="display:flex;gap:.25rem;flex-shrink:0">
      ${f.statut === 'brouillon' ? `<button class="btn btn-outline btn-sm" onclick="changerStatutFacture('${f.id}','envoyee')">Marquer envoyée</button>` : ''}
      ${f.statut === 'envoyee' ? `<button class="btn btn-outline btn-sm" onclick="changerStatutFacture('${f.id}','payee')">Marquer payée</button>` : ''}
      <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="supprimerFacture('${f.id}')">✕</button>
    </div>` : ''}
  </div>`;
}

function renderFactures() {
  const isAdmin = Auth.isAdmin();
  const list = getFactures();
  const periode = document.getElementById('factFiltrePeriode')?.value || '';
  const statut = document.getElementById('factFiltreStatut')?.value || '';
  const organisme = document.getElementById('factFiltreOrganisme')?.value || '';

  // Filtre période
  const periodeSel = document.getElementById('factFiltrePeriode');
  if (periodeSel) {
    const periodes = [...new Set(list.map(f => f.periode))].sort().reverse();
    const current = periodeSel.value;
    periodeSel.innerHTML = '<option value="">Toutes les périodes</option>' + periodes.map(p => `<option value="${p}"${current === p ? ' selected' : ''}>${p}</option>`).join('');
  }
  // Filtre organisme
  const orgSel = document.getElementById('factFiltreOrganisme');
  if (orgSel) {
    const organismes = [...new Set(list.map(f => f.organisme))].sort();
    const current = orgSel.value;
    orgSel.innerHTML = '<option value="">Tous les organismes</option>' + organismes.map(o => `<option value="${escHtml(o)}"${current === o ? ' selected' : ''}>${escHtml(o)}</option>`).join('');
  }

  let filtered = list;
  if (periode) filtered = filtered.filter(f => f.periode === periode);
  if (statut) filtered = filtered.filter(f => f.statut === statut);
  if (organisme) filtered = filtered.filter(f => f.organisme === organisme);

  // Stats (sur la liste filtrée)
  document.getElementById('factStatTotal').textContent = eur(filtered.reduce((a, f) => a + f.montant, 0));
  document.getElementById('factStatBrouillon').textContent = filtered.filter(f => f.statut === 'brouillon').length;
  document.getElementById('factStatEnvoyee').textContent = filtered.filter(f => f.statut === 'envoyee').length;
  document.getElementById('factStatPayee').textContent = filtered.filter(f => f.statut === 'payee').length;

  const el = document.getElementById('factList');
  if (!filtered.length) {
    el.innerHTML = '<div class="empty" style="padding:3rem;text-align:center"><p>Aucune facture pour ces critères.</p></div>';
    return;
  }
  el.innerHTML = filtered
    .sort((a, b) => b.periode.localeCompare(a.periode) || a.residentNom.localeCompare(b.residentNom))
    .map(f => factureItemHtml(f, isAdmin)).join('');
}

function renderFacturation() {
  renderTarifs();
  renderAffectations();
  renderFactures();
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireModule('access_facturation')) return;
  await sbLoadResidentsCache();
  await loadFactCaches();
  const periodeInput = document.getElementById('factPeriode');
  if (periodeInput) periodeInput.value = new Date().toISOString().slice(0, 7);
  renderFacturation();
});
if (typeof registerPageInit === 'function') registerPageInit('facturation', renderFacturation);
