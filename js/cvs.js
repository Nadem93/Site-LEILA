// ── CONSEIL DE LA VIE SOCIALE (CVS) ──
let cvsTab = 'membres';
let cvsEditMembreId = null;
let cvsEditSeanceId = null;
let cvsResolutionsSeanceId = null;
let cvsEditThematiqueId = null;
let cvsCanEdit = false;

const CVS_SAT_CATS = [
  { id:'accueil',        label:'Accueil & intégration',    qIds:['accueil'],                         color:'#0369a1' },
  { id:'hebergement',    label:'Hébergement',               qIds:['chambre','parties_com'],            color:'#7c3aed' },
  { id:'restauration',   label:'Restauration',              qIds:['repas_qualite','repas_quantite'],   color:'#d97706' },
  { id:'activites',      label:'Activités',                 qIds:['activites'],                       color:'#16a34a' },
  { id:'equipe',         label:'Équipe & accompagnement',   qIds:['respect','disponibilite','soins'],  color:'#0891b2' },
  { id:'securite',       label:'Sécurité',                  qIds:['securite'],                        color:'#dc2626' },
  { id:'communication',  label:'Communication',             qIds:['communication'],                   color:'#6366f1' },
  { id:'global',         label:'Satisfaction globale',      qIds:['global'],                          color:'#0d9488' }
];

const CVS_THEM_STATUTS = {
  ouvert:   { label:'Ouvert',    color:'#0369a1' },
  en_cours: { label:'En cours',  color:'#d97706' },
  resolu:   { label:'Résolu',    color:'#16a34a' },
  clos:     { label:'Clos',      color:'#94a3b8' }
};

function _cvsThemSatScore(catIds) {
  const satAll = _cvsSatCache;
  if (!satAll.length || !catIds.length) return null;
  const qIds = catIds.flatMap(cid => (CVS_SAT_CATS.find(c => c.id === cid) || {}).qIds || []);
  if (!qIds.length) return null;
  let tot = 0, cnt = 0;
  satAll.forEach(s => qIds.forEach(q => { const v = s.reponses?.[q]; if (v != null) { tot += Number(v); cnt++; } }));
  return cnt ? Math.round(tot/cnt*25) : null;
}

function _cvsScoreColor(pct) {
  if (pct === null) return '#94a3b8';
  return pct >= 87 ? '#0d9488' : pct >= 62 ? '#16a34a' : pct >= 37 ? '#d97706' : '#dc2626';
}

const CVS_COLLEGES = {
  residents: { label: 'Résidents', icon: '🧑', color: '#16a34a' },
  familles: { label: 'Familles / représentants légaux', icon: '👪', color: '#0369a1' },
  personnel: { label: 'Personnel', icon: '🧑‍⚕️', color: '#8b5cf6' },
  direction: { label: 'Direction / organisme gestionnaire', icon: '🏛️', color: '#dc2626' },
  exterieur: { label: 'Personnes qualifiées / partenaires', icon: '🤝', color: '#64748b' }
};
const CVS_ROLES = { titulaire: 'Titulaire', suppleant: 'Suppléant' };
const CVS_RESOLUTION_STATUTS = {
  a_faire: { label: 'À faire', color: '#dc2626' },
  en_cours: { label: 'En cours', color: '#d97706' },
  fait: { label: 'Réalisé', color: '#16a34a' }
};

// Source = Supabase. Caches mémoire chargés au démarrage.
let _cvsCache = null;
let _cvsSatCache = []; // questionnaires de satisfaction (pour les scores par thématique)
function getCvs() {
  if (!_cvsCache || typeof _cvsCache !== 'object') _cvsCache = { membres: [], seances: [] };
  if (!_cvsCache.membres) _cvsCache.membres = [];
  if (!_cvsCache.seances) _cvsCache.seances = [];
  return _cvsCache;
}
function saveCvs(data) {
  _cvsCache = data;
  sbSaveCvs(data).catch(e => { console.error('[cvs]', e); toast('Erreur sauvegarde CVS', 'error'); });
}
async function loadCvsCache() {
  const d = await sbGetCvs();
  _cvsCache = (d && typeof d === 'object') ? d : { membres: [], seances: [] };
  _cvsSatCache = await sbGetSatisfaction();
}

function cvsMembres() {
  const data = getCvs();
  return [...(data.membres || [])].sort((a, b) =>
    (a.statut === 'ancien' ? 1 : 0) - (b.statut === 'ancien' ? 1 : 0) ||
    Object.keys(CVS_COLLEGES).indexOf(a.college) - Object.keys(CVS_COLLEGES).indexOf(b.college) ||
    (a.nom || '').localeCompare(b.nom || '', 'fr'));
}

function cvsSeances() {
  const data = getCvs();
  return [...(data.seances || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function cvsAllResolutions() {
  const out = [];
  cvsSeances().forEach(s => (s.resolutions || []).forEach(r => out.push({ ...r, seanceId: s.id, seanceDate: s.date })));
  return out;
}

function cvsProchaineSeance() {
  const td = today();
  return [...cvsSeances()].filter(s => s.date >= td).sort((a, b) => (a.date || '').localeCompare(b.date || ''))[0];
}

// ── RENDU PRINCIPAL ──
function renderCvs() {
  const membresActifs = cvsMembres().filter(m => m.statut !== 'ancien');
  const prochaine = cvsProchaineSeance();
  const resolutions = cvsAllResolutions();
  const enCours = resolutions.filter(r => r.statut !== 'fait');
  const ans = today().slice(0, 4);
  const seancesAnnee = cvsSeances().filter(s => (s.date || '').slice(0, 4) === ans);

  const satAllCvs = _cvsSatCache;
  let satScoreCvs = null;
  if (satAllCvs.length) {
    let st = 0, sc = 0;
    satAllCvs.forEach(s => { Object.values(s.reponses||{}).forEach(v => { if (v != null) { st += Number(v); sc++; } }); });
    satScoreCvs = sc ? Math.round(st/sc*25) : null;
  }
  const satColCvs = _cvsScoreColor(satScoreCvs);
  const themAll = getCvs().thematiques || [];
  const themOuverts = themAll.filter(t => t.statut === 'ouvert' || t.statut === 'en_cours').length;

  document.getElementById('cvsStats').innerHTML = `
    <div class="chx-stat" style="--c:#16a34a"><div class="chx-stat-top"><span class="chx-stat-lbl">Membres actifs</span></div><div class="chx-stat-num">${membresActifs.length}</div></div>
    <div class="chx-stat" style="--c:#2563eb"><div class="chx-stat-top"><span class="chx-stat-lbl">Prochaine séance</span></div><div class="chx-stat-num" style="font-size:1.1rem">${prochaine ? formatDate(prochaine.date) : '—'}</div></div>
    <div class="chx-stat" style="--c:#e85d04"><div class="chx-stat-top"><span class="chx-stat-lbl">Résolutions en cours</span></div><div class="chx-stat-num">${enCours.length}</div></div>
    <div class="chx-stat" style="--c:${satColCvs}"><div class="chx-stat-top"><span class="chx-stat-lbl">⭐ Satisfaction</span></div><div class="chx-stat-num" style="color:${satColCvs}">${satScoreCvs !== null ? satScoreCvs+'%' : '—'}</div>${satScoreCvs !== null ? `<div class="chx-stat-bar"><i style="width:${satScoreCvs}%"></i></div>` : ''}</div>
    <div class="chx-stat" style="--c:#7c3aed"><div class="chx-stat-top"><span class="chx-stat-lbl">🎯 Thématiques ouvertes</span></div><div class="chx-stat-num">${themOuverts}</div></div>`;

  // Compteur composition
  const countEl = document.getElementById('cvsMembresCount');
  if (countEl) countEl.textContent = membresActifs.length + ' membre' + (membresActifs.length !== 1 ? 's' : '') + ' actif' + (membresActifs.length !== 1 ? 's' : '');

  renderCvsMembresGallery();
  renderCvsMembres();
  renderCvsSeances();
  renderCvsResolutionsDash();
  renderCvsSatAnalysis();
  renderCvsThematiques();
}

// ── ANALYSE SATISFACTION (section dédiée) ──
function renderCvsSatAnalysis() {
  const el = document.getElementById('cvsSatAnalysis');
  if (!el) return;
  el.innerHTML = renderSatAnalysisPanel();
}

// ── GALERIE MEMBRES RÉSIDENTS ──
function renderCvsMembresGallery() {
  const el = document.getElementById('cvsMembresGallery');
  if (!el) return;
  const membres = cvsMembres().filter(m => m.statut !== 'ancien');
  if (!membres.length) { el.innerHTML = ''; return; }

  const allRes = sbResidents();
  el.innerHTML = `
    <div style="background:#eef4f9;border:1px solid #cddaea;border-radius:12px;padding:.9rem 1rem;margin-bottom:1.25rem">
      <div style="margin-bottom:.75rem;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">
        👥 Membres du CVS (${membres.length})
        ${cvsCanEdit ? `<button class="btn btn-ghost btn-sm no-cvs-edit" onclick="openMembreModal()" style="font-size:.7rem;float:right;margin-top:-.2rem">+ Ajouter</button>` : ''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:1rem">
        ${membres.map(m => {
          const c = CVS_COLLEGES[m.college] || CVS_COLLEGES.exterieur;
          const nom = escHtml(m.nom || '');
          let r = m.residentId ? allRes.find(x => x.id === m.residentId) : null;
          if (!r && m.college === 'residents' && m.nom) {
            const nomLow = m.nom.trim().toLowerCase();
            r = allRes.find(x => {
              const full1 = ((x.nom||'')+' '+(x.prenom||'')).trim().toLowerCase();
              const full2 = ((x.prenom||'')+' '+(x.nom||'')).trim().toLowerCase();
              return full1 === nomLow || full2 === nomLow;
            });
          }
          const photo = (m.college === 'residents' && r?.photo)
            ? `<img src="${escHtml(r.photo)}" alt="${nom}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid ${c.color}55"/>`
            : `<div style="width:80px;height:80px;border-radius:50%;background:#fff;border:3px solid ${c.color}44;display:flex;align-items:center;justify-content:center;font-size:1.7rem;font-weight:700;color:${c.color}">${(m.nom||'?')[0].toUpperCase()}</div>`;
          const mandat = (m.mandatDebut || m.mandatFin)
            ? `<span style="font-size:.63rem;color:var(--muted);line-height:1.3">${m.mandatDebut ? formatDate(m.mandatDebut) : '—'} → ${m.mandatFin ? formatDate(m.mandatFin) : 'en cours'}</span>`
            : '';
          const college = `<span style="font-size:.62rem;color:${c.color};font-weight:600">${c.label}</span>`;
          const actions = cvsCanEdit ? `<div style="display:flex;gap:.25rem;margin-top:.2rem">
            <button class="btn btn-ghost btn-sm" onclick="openMembreModal('${m.id}')" style="font-size:.62rem;padding:1px 6px">✎</button>
            <button class="btn btn-ghost btn-sm" style="font-size:.62rem;padding:1px 6px;color:var(--red)" onclick="deleteMembre('${m.id}')">✕</button>
          </div>` : '';
          return `<div style="display:flex;flex-direction:column;align-items:center;gap:.3rem;width:90px;text-align:center">
            ${photo}
            <div style="font-size:.75rem;font-weight:600;color:var(--text);line-height:1.2;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${nom}">${nom}</div>
            ${college}
            ${mandat}
            ${actions}
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ── MEMBRES ──
function renderCvsMembres() {
  const list = cvsMembres();
  const el = document.getElementById('cvsMembresList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `<div class="empty" style="padding:2.5rem"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><h3>Aucun membre</h3><p>Composez le CVS : résidents, familles, personnel et direction.</p></div>`;
    return;
  }
  el.innerHTML = `<div class="grid grid-3" style="gap:.85rem">${list.map(cvsMembreCard).join('')}</div>`;
}

function cvsMembreCard(m) {
  const c = CVS_COLLEGES[m.college] || CVS_COLLEGES.exterieur;
  const ancien = m.statut === 'ancien';
  const allRes = sbResidents();
  const r = m.residentId ? allRes.find(x => x.id === m.residentId) : null;
  const photoHtml = m.college === 'residents'
    ? (r?.photo
        ? `<img src="${escHtml(r.photo)}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid ${c.color}44;flex-shrink:0"/>`
        : `<div style="width:44px;height:44px;border-radius:50%;background:${c.color}22;border:2px solid ${c.color}44;display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:700;color:${c.color};flex-shrink:0">${(m.nom||'?')[0].toUpperCase()}</div>`)
    : `<span style="font-size:1.3rem;flex-shrink:0">${c.icon}</span>`;

  return `<div class="card" style="background:#fff;border:1px solid var(--border);border-left:3px solid ${c.color};${ancien ? 'opacity:.55' : ''}">
    <div class="card-body" style="display:flex;flex-direction:column;gap:.45rem">
      <div style="display:flex;align-items:flex-start;gap:.5rem">
        ${photoHtml}
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.9rem">${escHtml(m.nom || '')}</div>
          <div style="font-size:.72rem;color:var(--muted)">${c.label}${ancien ? ' · <span style="color:var(--red)">ancien membre</span>' : ''}</div>
        </div>
        ${m.role ? `<span class="badge badge-gray">${CVS_ROLES[m.role] || m.role}</span>` : ''}
      </div>
      <div style="font-size:.78rem;color:var(--text);display:flex;flex-direction:column;gap:.15rem">
        ${(m.mandatDebut || m.mandatFin) ? `<div>🗳️ Mandat ${m.mandatDebut ? formatDate(m.mandatDebut) : '—'} → ${m.mandatFin ? formatDate(m.mandatFin) : 'en cours'}</div>` : ''}
        ${m.contact ? `<div>✉️ ${escHtml(m.contact)}</div>` : ''}
      </div>
      ${cvsCanEdit ? `<div class="no-print" style="display:flex;gap:.3rem;justify-content:flex-end;border-top:1px solid var(--border);padding-top:.4rem">
        <button class="btn btn-ghost btn-sm" onclick="toggleMembreStatut('${m.id}')">${ancien ? '▶ Réactiver' : '⏸ Marquer ancien'}</button>
        <button class="btn btn-ghost btn-sm" onclick="openMembreModal('${m.id}')">✎</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteMembre('${m.id}')">✕</button>
      </div>` : ''}
    </div>
  </div>`;
}

function cvsOnCollegeChange(val) {
  const box = document.getElementById('cmResidentBox');
  if (box) box.style.display = val === 'residents' ? '' : 'none';
}

function cvsOnResidentSelect(residentId) {
  const preview = document.getElementById('cmResidentPreview');
  if (!preview) return;
  if (!residentId) { preview.innerHTML = ''; return; }
  const r = sbResidents().find(x => x.id === residentId);
  if (!r) { preview.innerHTML = ''; return; }
  const nom = escHtml(((r.nom||'')+' '+(r.prenom||'')).trim());
  const photo = r.photo
    ? `<img src="${escHtml(r.photo)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover"/>`
    : `<div style="width:40px;height:40px;border-radius:50%;background:#16a34a22;display:flex;align-items:center;justify-content:center;font-weight:700;color:#16a34a">${(r.nom||'?')[0]}</div>`;
  preview.innerHTML = `${photo}<span style="font-size:.83rem;font-weight:600">${nom}</span>`;
  // Pré-remplir le nom
  const nomInput = document.getElementById('cmNom');
  if (nomInput && !nomInput.value) nomInput.value = ((r.nom||'')+' '+(r.prenom||'')).trim();
}

function openMembreModal(id) {
  cvsEditMembreId = id || null;
  const m = id ? (getCvs().membres || []).find(x => x.id === id) || {} : {};
  document.getElementById('cmTitle').textContent = id ? 'Modifier le membre' : 'Nouveau membre';
  document.getElementById('cmNom').value = m.nom || '';

  const collegeEl = document.getElementById('cmCollege');
  collegeEl.value = m.college || 'residents';
  cvsOnCollegeChange(collegeEl.value);

  // Charger les résidents dans le sélecteur
  const resSelect = document.getElementById('cmResidentId');
  const residents = sbResidents()
    .filter(r => !r.dateSortie || r.dateSortie >= today())
    .sort((a,b) => (a.nom||'').localeCompare(b.nom||'','fr'));
  resSelect.innerHTML = '<option value="">— Sélectionner un résident —</option>'
    + residents.map(r => `<option value="${r.id}"${m.residentId===r.id?' selected':''}>${escHtml(((r.nom||'')+' '+(r.prenom||'')).trim())}</option>`).join('');
  if (m.residentId) cvsOnResidentSelect(m.residentId);

  document.getElementById('cmRole').value = m.role || 'titulaire';
  document.getElementById('cmContact').value = m.contact || '';
  document.getElementById('cmMandatDebut').value = m.mandatDebut || '';
  document.getElementById('cmMandatFin').value = m.mandatFin || '';
  openModal('modalCvsMembre');
}

async function _syncMandatEcheance(membreId, nom, mandatFin, residentId) {
  try {
    const all = await sbGetEcheances();
    const existing = all.find(e => e.sourceId === membreId && e.type === 'cvs_mandat');
    if (!mandatFin) {
      if (existing) await sbDeleteEcheance(existing.id);
      return;
    }
    const r = residentId ? (sbResidents().find(x => String(x.id) === String(residentId)) || {}) : {};
    const rName = `${r.prenom || ''} ${r.nom || ''}`.trim();
    const ecData = {
      type: 'cvs_mandat',
      libelle: `Fin de mandat CVS — ${nom}`,
      date: mandatFin,
      residentId: residentId || null,
      residentName: rName,
      notes: '',
      sourceId: membreId
    };
    if (existing) await sbSaveEcheance({ ...existing, ...ecData });
    else await sbSaveEcheance({ ...ecData, done: false, author: 'CVS' });
  } catch (e) { console.error('[_syncMandatEcheance]', e); }
}

async function saveMembre() {
  const nom = document.getElementById('cmNom').value.trim();
  if (!nom) { toast('Le nom est requis', 'error'); return; }
  const college = document.getElementById('cmCollege').value;
  const data = {
    nom,
    college,
    residentId: college === 'residents' ? (document.getElementById('cmResidentId').value || '') : '',
    role: document.getElementById('cmRole').value,
    contact: document.getElementById('cmContact').value.trim(),
    mandatDebut: document.getElementById('cmMandatDebut').value,
    mandatFin: document.getElementById('cmMandatFin').value
  };
  const cvs = getCvs();
  let membres = cvs.membres || [];
  let membreId;
  if (cvsEditMembreId) {
    membres = membres.map(x => x.id === cvsEditMembreId ? { ...x, ...data } : x);
    membreId = cvsEditMembreId;
    toast('Membre mis à jour');
  } else {
    membreId = genId();
    membres = [...membres, { id: membreId, ...data, statut: 'actif', createdAt: new Date().toISOString() }];
    toast('Membre ajouté ✓');
  }
  saveCvs({ ...cvs, membres });
  await _syncMandatEcheance(membreId, data.nom, data.mandatFin, data.residentId);
  if (typeof auditLog === 'function') auditLog('cvs_membre_save', `Membre CVS — ${nom}`);
  closeModal('modalCvsMembre');
  renderCvs();
}

function toggleMembreStatut(id) {
  const cvs = getCvs();
  const membres = (cvs.membres || []).map(x => x.id === id ? { ...x, statut: x.statut === 'ancien' ? 'actif' : 'ancien' } : x);
  saveCvs({ ...cvs, membres });
  renderCvs();
}

function deleteMembre(id) {
  confirmDialog('Supprimer ce membre du CVS ?', () => {
    const cvs = getCvs();
    saveCvs({ ...cvs, membres: (cvs.membres || []).filter(x => x.id !== id) });
    if (typeof sbDeleteEcheancesBySource === 'function') sbDeleteEcheancesBySource(id).catch(() => {});
    renderCvs();
    toast('Membre supprimé', 'info');
  });
}

// ── SÉANCES ──
function renderCvsSeances() {
  const list = cvsSeances();
  const el = document.getElementById('cvsSeancesList');
  if (!list.length) {
    el.innerHTML = `<div class="empty" style="padding:2.5rem"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><h3>Aucune séance</h3><p>Enregistrez les séances du Conseil de la Vie Sociale et leurs comptes-rendus.</p></div>`;
    return;
  }
  el.innerHTML = list.map(cvsSeanceCard).join('');
}

function cvsSeanceCard(s) {
  const resolutions = s.resolutions || [];
  const ouvertes = resolutions.filter(r => r.statut !== 'fait').length;
  const futur = s.date >= today();
  return `<div class="card" style="background:#fff;border:1px solid var(--border);border-left:3px solid ${futur ? '#0369a1' : '#6b7280'};margin-bottom:.85rem">
    <div class="card-body" style="display:flex;flex-direction:column;gap:.5rem">
      <div style="display:flex;align-items:flex-start;gap:.6rem;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="font-weight:700;font-size:.9rem">📅 ${formatDate(s.date)}${s.heure ? ' · ' + s.heure.slice(0,5) : ''}${futur ? ' <span class="badge badge-blue">à venir</span>' : ''}</div>
          ${s.lieu ? `<div style="font-size:.75rem;color:var(--muted)">📍 ${escHtml(s.lieu)}</div>` : ''}
        </div>
        ${resolutions.length ? `<span class="badge" style="background:${ouvertes ? '#fef3c7' : '#f0fdf4'};color:${ouvertes ? '#d97706' : '#16a34a'}">${resolutions.length - ouvertes} / ${resolutions.length} résolution(s) réalisée(s)</span>` : ''}
      </div>
      ${s.ordreDuJour ? `<div style="font-size:.78rem;color:var(--text)"><strong>Ordre du jour :</strong> ${escHtml(s.ordreDuJour)}</div>` : ''}
      ${s.compteRendu ? `<div style="font-size:.78rem;color:var(--muted)">${escHtml(s.compteRendu).slice(0, 220)}${s.compteRendu.length > 220 ? '…' : ''}</div>` : ''}
      ${futur ? (() => {
        const satCvs = _cvsSatCache;
        const recent = satCvs.filter(x => x.date >= (new Date(Date.now()-90*86400000).toISOString().slice(0,10)));
        if (!recent.length) return `<div style="font-size:.74rem;color:var(--muted);font-style:italic">⭐ Aucun questionnaire de satisfaction récent — <a href="satisfaction.html">en saisir un</a> avant la séance.</div>`;
        let st=0, sc=0;
        recent.forEach(x => { Object.values(x.reponses||{}).forEach(v => { if(v!=null){st+=Number(v);sc++;} }); });
        const pct = sc ? Math.round(st/sc*25) : null;
        const col = _cvsScoreColor(pct);
        // Scores par catégorie
        const catLines = CVS_SAT_CATS.map(cat => {
          let t2=0,c2=0;
          recent.forEach(x => cat.qIds.forEach(q => { const v=x.reponses?.[q]; if(v!=null){t2+=Number(v);c2++;} }));
          const p2 = c2 ? Math.round(t2/c2*25) : null;
          return p2 !== null ? { label:cat.label, pct:p2, col:_cvsScoreColor(p2) } : null;
        }).filter(Boolean);
        const alerts = catLines.filter(c=>c.pct<62).map(c=>`<span style="color:${c.col};font-weight:600">${c.label} ${c.pct}%</span>`).join(' · ');
        return `<div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:.5rem .75rem">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:${alerts?'.3rem':'0'}">
            <span style="font-size:.75rem;font-weight:600;color:${col}">⭐ Satisfaction ${pct!==null?pct+'%':'—'} · ${recent.length} questionnaire${recent.length>1?'s':''} (90j)</span>
            <a href="satisfaction.html" style="font-size:.7rem;color:var(--primary);text-decoration:none">Voir →</a>
          </div>
          ${alerts?`<div style="font-size:.71rem;color:var(--muted)">Points à aborder : ${alerts}</div>`:''}
        </div>`;
      })() : ''}
      <div class="no-print" style="display:flex;gap:.3rem;justify-content:flex-end;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:.4rem">
        <button class="btn btn-ghost btn-sm" onclick="openResolutionsModal('${s.id}')">📋 Résolutions</button>
        <button class="btn btn-ghost btn-sm" onclick="printCR('${s.id}')">🖨 Compte-rendu</button>
        ${cvsCanEdit ? `<button class="btn btn-ghost btn-sm" onclick="openSeanceModal('${s.id}')">✎</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteSeance('${s.id}')">✕</button>` : ''}
      </div>
    </div>
  </div>`;
}

function openSeanceModal(id) {
  cvsEditSeanceId = id || null;
  const s = id ? (getCvs().seances || []).find(x => x.id === id) || {} : {};
  document.getElementById('csTitle').textContent = id ? 'Modifier la séance' : 'Nouvelle séance';
  document.getElementById('csDate').value = s.date || today();
  document.getElementById('csHeure').value = s.heure || '';
  document.getElementById('csLieu').value = s.lieu || '';
  document.getElementById('csOrdreDuJour').value = s.ordreDuJour || '';
  document.getElementById('csPresents').value = s.presents || '';
  document.getElementById('csExcuses').value = s.excuses || '';
  document.getElementById('csCompteRendu').value = s.compteRendu || '';
  openModal('modalCvsSeance');
}

function saveSeance() {
  const date = document.getElementById('csDate').value;
  if (!date) { toast('La date est requise', 'error'); return; }
  const data = {
    date,
    heure: document.getElementById('csHeure').value,
    lieu: document.getElementById('csLieu').value.trim(),
    ordreDuJour: document.getElementById('csOrdreDuJour').value.trim(),
    presents: document.getElementById('csPresents').value.trim(),
    excuses: document.getElementById('csExcuses').value.trim(),
    compteRendu: document.getElementById('csCompteRendu').value.trim()
  };
  const cvs = getCvs();
  let seances = cvs.seances || [];
  if (cvsEditSeanceId) {
    seances = seances.map(x => x.id === cvsEditSeanceId ? { ...x, ...data } : x);
    toast('Séance mise à jour');
  } else {
    seances = [...seances, { id: genId(), ...data, resolutions: [], createdAt: new Date().toISOString() }];
    toast('Séance enregistrée ✓');
  }
  saveCvs({ ...cvs, seances });
  if (typeof auditLog === 'function') auditLog('cvs_seance_save', `Séance CVS — ${formatDate(date)}`);
  closeModal('modalCvsSeance');
  renderCvs();
}

function deleteSeance(id) {
  confirmDialog('Supprimer cette séance et son compte-rendu ?', () => {
    const cvs = getCvs();
    saveCvs({ ...cvs, seances: (cvs.seances || []).filter(x => x.id !== id) });
    renderCvs();
    toast('Séance supprimée', 'info');
  });
}

// ── RÉSOLUTIONS (par séance) ──
function openResolutionsModal(seanceId) {
  cvsResolutionsSeanceId = seanceId;
  const s = (getCvs().seances || []).find(x => x.id === seanceId);
  if (!s) return;
  document.getElementById('rmTitle').textContent = `Résolutions — séance du ${formatDate(s.date)}`;
  document.getElementById('rmTexte').value = '';
  document.getElementById('rmResponsable').value = '';
  document.getElementById('rmEcheance').value = '';
  const addBox = document.getElementById('rmAddBox');
  if (addBox) addBox.style.display = cvsCanEdit ? '' : 'none';
  renderResolutionsList(s);
  openModal('modalCvsResolutions');
}

function renderResolutionsList(s) {
  const box = document.getElementById('rmList');
  const resolutions = s.resolutions || [];
  if (!resolutions.length) { box.innerHTML = '<div style="font-size:.8rem;color:var(--g400);padding:.5rem 0">Aucune résolution pour cette séance.</div>'; return; }
  box.innerHTML = resolutions.map(r => {
    const st = CVS_RESOLUTION_STATUTS[r.statut] || CVS_RESOLUTION_STATUTS.a_faire;
    return `<div style="background:#fff;border:1px solid var(--border);border-radius:var(--r-sm);padding:.55rem .75rem">
      <div style="display:flex;align-items:flex-start;gap:.5rem;margin-bottom:.3rem">
        <div style="flex:1;min-width:0;font-size:.83rem;font-weight:600;word-break:break-word;white-space:normal">${escHtml(r.texte || '')}</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-wrap:wrap">
        <div style="font-size:.7rem;color:var(--muted)">
          ${r.responsable ? '👤 ' + escHtml(r.responsable) : ''}${r.echeance ? (r.responsable ? ' · ' : '') + '⏳ ' + formatDate(r.echeance) : ''}
        </div>
        <div style="display:flex;align-items:center;gap:.3rem;flex-shrink:0">
          ${cvsCanEdit
            ? `<select style="font-size:.72rem;padding:2px 6px;border-radius:6px;border:1px solid var(--border);background:#fff" onchange="setResolutionStatut('${s.id}','${r.id}',this.value)">
                ${Object.entries(CVS_RESOLUTION_STATUTS).map(([k,v]) => `<option value="${k}"${r.statut===k?' selected':''}>${v.label}</option>`).join('')}
               </select>
               <button class="btn btn-ghost btn-sm" style="color:var(--red);padding:2px 6px" onclick="deleteResolution('${s.id}','${r.id}')">✕</button>`
            : `<span class="badge" style="background:${st.color}1a;color:${st.color}">${st.label}</span>`}
        </div>
      </div>
    </div>`;
  }).join('');
}

function addResolution(seanceId) {
  const texte = document.getElementById('rmTexte').value.trim();
  if (!texte) { toast('Le texte de la résolution est requis', 'error'); return; }
  const cvs = getCvs();
  const seances = (cvs.seances || []).map(x => {
    if (x.id !== seanceId) return x;
    const r = {
      id: genId(), texte,
      responsable: document.getElementById('rmResponsable').value.trim(),
      echeance: document.getElementById('rmEcheance').value,
      statut: 'a_faire'
    };
    return { ...x, resolutions: [...(x.resolutions || []), r] };
  });
  saveCvs({ ...cvs, seances });
  document.getElementById('rmTexte').value = '';
  document.getElementById('rmResponsable').value = '';
  document.getElementById('rmEcheance').value = '';
  renderResolutionsList(seances.find(x => x.id === seanceId));
  renderCvs();
}

function setResolutionStatut(seanceId, resId, statut) {
  const cvs = getCvs();
  const seances = (cvs.seances || []).map(x => x.id === seanceId
    ? { ...x, resolutions: (x.resolutions || []).map(r => r.id === resId ? { ...r, statut } : r) }
    : x);
  saveCvs({ ...cvs, seances });
  renderCvs();
}

function deleteResolution(seanceId, resId) {
  const cvs = getCvs();
  const seances = (cvs.seances || []).map(x => x.id === seanceId
    ? { ...x, resolutions: (x.resolutions || []).filter(r => r.id !== resId) }
    : x);
  saveCvs({ ...cvs, seances });
  renderResolutionsList(seances.find(x => x.id === seanceId));
  renderCvs();
}

// ── RÉSOLUTIONS DASHBOARD (actives uniquement) ──
let _cvsShowAllRes = false;
function cvsToggleAllResolutions() {
  _cvsShowAllRes = !_cvsShowAllRes;
  renderCvsResolutionsDash();
}

function renderCvsResolutionsDash() {
  const el = document.getElementById('cvsResolutionsList');
  const btn = document.getElementById('cvsResAllBtn');
  if (!el) return;
  const td = today();
  const all = cvsAllResolutions();
  const active = all.filter(r => r.statut !== 'fait');
  const shown = _cvsShowAllRes ? all : active;

  if (btn) {
    const done = all.filter(r => r.statut === 'fait').length;
    btn.style.display = done ? '' : 'none';
    btn.textContent = _cvsShowAllRes ? '← Actives seulement' : `Voir tout (${done} réalisée${done>1?'s':''})`;
  }

  if (!all.length) {
    el.innerHTML = `<div class="cvs-card" style="text-align:center;padding:1.2rem;color:var(--muted);font-size:.8rem">Aucune résolution pour l'instant.</div>`;
    return;
  }
  if (!shown.length) {
    el.innerHTML = `<div class="cvs-card" style="text-align:center;padding:1.2rem;color:#16a34a;font-size:.8rem;font-weight:600">✅ Toutes les résolutions sont réalisées !</div>`;
    return;
  }

  el.innerHTML = shown.map(r => {
    const st = CVS_RESOLUTION_STATUTS[r.statut] || CVS_RESOLUTION_STATUTS.a_faire;
    const retard = r.statut !== 'fait' && r.echeance && r.echeance < td;
    return `<div style="display:flex;align-items:flex-start;gap:.55rem;padding:.5rem .7rem;background:#fff;border:1px solid var(--border);border-radius:8px;margin-bottom:.35rem">
      <div style="flex:1;min-width:0">
        <div style="font-size:.82rem;font-weight:600;color:var(--text)">${escHtml(r.texte||'')}</div>
        <div style="font-size:.7rem;color:var(--muted);margin-top:1px">
          ${formatDate(r.seanceDate)}${r.responsable?' · 👤 '+escHtml(r.responsable):''}${r.echeance?' · ⏳ '+formatDate(r.echeance):''}${retard?' · <span style="color:#dc2626;font-weight:600">retard</span>':''}
        </div>
      </div>
      <span class="badge" style="background:${st.color}18;color:${st.color};flex-shrink:0">${st.label}</span>
    </div>`;
  }).join('');
}

// ── SUIVI DES RÉSOLUTIONS (toutes séances) — conservé pour printCR ──
function renderCvsResolutions() {
  const all = cvsAllResolutions();
  const el = document.getElementById('cvsResolutionsList');
  if (!all.length) {
    el.innerHTML = `<div class="empty" style="padding:2.5rem"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div><h3>Aucune résolution</h3><p>Les résolutions adoptées en séance s'affichent ici, tous comptes-rendus confondus.</p></div>`;
    return;
  }
  const td = today();
  const groups = {
    a_faire: all.filter(r => r.statut === 'a_faire'),
    en_cours: all.filter(r => r.statut === 'en_cours'),
    fait: all.filter(r => r.statut === 'fait')
  };
  ['a_faire', 'en_cours'].forEach(k => groups[k].sort((a, b) => (a.echeance || '').localeCompare(b.echeance || '')));
  groups.fait.sort((a, b) => (b.seanceDate || '').localeCompare(a.seanceDate || ''));
  const row = r => {
    const st = CVS_RESOLUTION_STATUTS[r.statut] || CVS_RESOLUTION_STATUTS.a_faire;
    const retard = r.statut !== 'fait' && r.echeance && r.echeance < td;
    return `<div style="display:flex;align-items:flex-start;gap:.6rem;padding:.55rem .75rem;background:#fff;border:1px solid var(--border);border-radius:var(--r-sm);margin-bottom:.4rem">
      <div style="flex:1;min-width:0">
        <div style="font-size:.83rem;font-weight:600">${escHtml(r.texte || '')}</div>
        <div style="font-size:.7rem;color:var(--muted)">Séance du ${formatDate(r.seanceDate)}${r.responsable ? ' · 👤 ' + escHtml(r.responsable) : ''}${r.echeance ? ' · ⏳ ' + formatDate(r.echeance) : ''}${retard ? ' · <span style="color:#dc2626">en retard</span>' : ''}</div>
      </div>
      <span class="badge" style="background:${st.color}1a;color:${st.color}">${st.label}</span>
    </div>`;
  };
  const section = (title, arr, open) => arr.length ? `
    <details ${open ? 'open' : ''} style="margin-bottom:1rem">
      <summary class="section-label" style="cursor:pointer;list-style:none;margin-bottom:.6rem">${title} (${arr.length})</summary>
      ${arr.map(row).join('')}
    </details>` : '';
  el.innerHTML =
    section('À faire', groups.a_faire, true) +
    section('En cours', groups.en_cours, true) +
    section('Réalisées', groups.fait, false);
}

// ── IMPRESSION ──
function printCR(seanceId) {
  const s = (getCvs().seances || []).find(x => x.id === seanceId);
  if (!s) return;
  const settings = DB.get(DB.keys.settings) || {};
  const w = window.open('', '_blank');
  if (!w) { toast('Autorisez les fenêtres pop-up pour imprimer', 'error'); return; }
  const resolutions = s.resolutions || [];
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>CR CVS — ${formatDate(s.date)}</title>
    <style>
      body{font-family:'Inter','Segoe UI',sans-serif;max-width:780px;margin:1.5rem auto;padding:0 1.5rem;color:#1e293b;font-size:10pt;line-height:1.6}
      h1{font-size:15pt;color:#0f2b4a;border-bottom:2px solid #0f2b4a;padding-bottom:.3rem}
      h2{font-size:11pt;color:#0f2b4a;margin-top:1.4rem}
      .meta{color:#64748b;font-size:9pt;margin-bottom:1.2rem}
      .desc{white-space:pre-wrap;font-size:9.5pt;border:1px solid #e2e8f0;border-radius:6px;padding:.6rem .75rem;margin-top:.3rem}
      table{width:100%;border-collapse:collapse;margin-top:.4rem}
      th{text-align:left;font-size:8pt;text-transform:uppercase;letter-spacing:.04em;color:#0f2b4a;border-bottom:2px solid #0f2b4a;padding:.3rem .4rem}
      td{padding:.3rem .4rem;border-bottom:1px solid #e2e8f0;font-size:9pt;vertical-align:top}
      .sig{display:grid;grid-template-columns:1fr 1fr;gap:2rem;margin-top:2.5rem}
      .sig div{border-top:1px solid #94a3b8;padding-top:.4rem;font-size:9pt;color:#475569}
      @page{margin:1.5cm}
    </style></head><body>
    <h1>Conseil de la Vie Sociale — Compte-rendu</h1>
    <div class="meta">${escHtml(settings.etablissement || 'Établissement')} · Séance du ${formatDate(s.date)}${s.heure ? ' à ' + s.heure.slice(0,5) : ''}${s.lieu ? ' · ' + escHtml(s.lieu) : ''}</div>
    <h2>Présents</h2>
    <div class="desc">${escHtml(s.presents || '—')}</div>
    <h2>Excusés</h2>
    <div class="desc">${escHtml(s.excuses || '—')}</div>
    <h2>Ordre du jour</h2>
    <div class="desc">${escHtml(s.ordreDuJour || '—')}</div>
    <h2>Compte-rendu des échanges</h2>
    <div class="desc">${escHtml(s.compteRendu || '—')}</div>
    ${resolutions.length ? `<h2>Résolutions adoptées</h2>
    <table><thead><tr><th>Résolution</th><th>Responsable</th><th>Échéance</th><th>Statut</th></tr></thead>
    <tbody>${resolutions.map(r => `<tr><td>${escHtml(r.texte || '')}</td><td>${escHtml(r.responsable || '—')}</td><td>${r.echeance ? formatDate(r.echeance) : '—'}</td><td>${(CVS_RESOLUTION_STATUTS[r.statut] || CVS_RESOLUTION_STATUTS.a_faire).label}</td></tr>`).join('')}</tbody></table>` : ''}
    ${(() => {
      const satAll = _cvsSatCache;
      if (!satAll.length) return '';
      const catScores = CVS_SAT_CATS.map(cat => {
        let tot=0,cnt=0;
        satAll.forEach(x => cat.qIds.forEach(q => { const v=x.reponses?.[q]; if(v!=null){tot+=Number(v);cnt++;} }));
        return { label:cat.label, pct:cnt?Math.round(tot/cnt*25):null };
      }).filter(c=>c.pct!==null);
      if (!catScores.length) return '';
      return `<h2>Scores de satisfaction (référence)</h2>
      <table><thead><tr><th>Catégorie</th><th>Score</th><th>Appréciation</th></tr></thead>
      <tbody>${catScores.map(c=>`<tr><td>${escHtml(c.label)}</td><td style="font-weight:600">${c.pct}%</td><td>${c.pct>=87?'Très satisfaisant':c.pct>=62?'Satisfaisant':c.pct>=37?'À améliorer':'Insuffisant'}</td></tr>`).join('')}</tbody></table>`;
    })()}
    <div class="sig"><div>Le président de séance<br><br><br></div><div>Le secrétaire de séance<br><br><br></div></div>
    <script>window.onload=function(){window.print()}<\/script></body></html>`);
  w.document.close();
}

// ── PANNEAU ANALYSE SATISFACTION ──
function renderSatAnalysisPanel() {
  const satAll = _cvsSatCache;
  if (!satAll.length) {
    return `<div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:1rem 1.1rem;margin-bottom:1.25rem;display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap">
      <div style="font-size:.8rem;color:var(--muted)">Aucun questionnaire de satisfaction rempli pour le moment.</div>
      <a href="satisfaction.html" class="btn btn-outline btn-sm">Saisir un questionnaire →</a>
    </div>`;
  }
  const catScores = CVS_SAT_CATS.map(cat => {
    let tot=0,cnt=0;
    satAll.forEach(s => cat.qIds.forEach(q => { const v=s.reponses?.[q]; if(v!=null){tot+=Number(v);cnt++;} }));
    const pct = cnt ? Math.round(tot/cnt*25) : null;
    return { ...cat, pct, col: _cvsScoreColor(pct) };
  });
  const critical = catScores.filter(c => c.pct !== null && c.pct < 37);
  const weak     = catScores.filter(c => c.pct !== null && c.pct < 62 && c.pct >= 37);
  const existThemCats = new Set((getCvs().thematiques||[]).filter(t=>t.statut!=='clos'&&t.statut!=='resolu').flatMap(t=>t.catIds||[]));

  return `<div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:1rem 1.1rem;margin-bottom:1.25rem">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.85rem;gap:.5rem;flex-wrap:wrap">
      <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">
        ⭐ Scores de satisfaction — ${satAll.length} questionnaire${satAll.length>1?'s':''}
      </div>
      <a href="satisfaction.html" style="font-size:.73rem;color:var(--primary);text-decoration:none;font-weight:600">Voir le détail →</a>
    </div>
    ${critical.length ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:.45rem .75rem;margin-bottom:.7rem;font-size:.77rem;color:#dc2626;font-weight:600">⚠️ ${critical.map(c=>c.label).join(', ')} — score critique, action recommandée</div>` : ''}
    <div style="display:flex;flex-direction:column;gap:.35rem">
      ${catScores.map(c => {
        const alreadyLinked = existThemCats.has(c.id);
        const showBtn = cvsCanEdit && c.pct !== null && c.pct < 62 && !alreadyLinked;
        return `<div style="display:flex;align-items:center;gap:.55rem">
          <div style="width:155px;flex-shrink:0;font-size:.73rem;color:var(--text);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.label}</div>
          <div style="flex:1;height:14px;background:#f1f5f9;border-radius:4px;overflow:hidden">
            ${c.pct!==null?`<div style="height:100%;width:${c.pct}%;background:${c.col};border-radius:4px;transition:width .3s"></div>`:''}
          </div>
          <div style="width:38px;flex-shrink:0;font-size:.72rem;font-weight:700;color:${c.col}">${c.pct!==null?c.pct+'%':'—'}</div>
          <div style="width:100px;flex-shrink:0">
            ${showBtn?`<button onclick="openThematiqueModal(null,'${c.id}')" style="font-size:.67rem;padding:2px 7px;border-radius:5px;border:1px solid #d97706;background:#fff;color:#d97706;cursor:pointer;white-space:nowrap">+ Thématique</button>`:
              alreadyLinked&&c.pct!==null&&c.pct<62?`<span style="font-size:.67rem;color:#16a34a">✓ En cours</span>`:''}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ── THÉMATIQUES ──
function renderCvsThematiques() {
  const el = document.getElementById('cvsThematiquesList');
  if (!el) return;

  const list = (getCvs().thematiques || []).slice().sort((a,b) => {
    const order = { ouvert:0, en_cours:1, resolu:2, clos:3 };
    return (order[a.statut]||0) - (order[b.statut]||0);
  });

  if (!list.length) {
    el.innerHTML = `<div class="cvs-card" style="text-align:center;padding:1.5rem;color:var(--muted)">
      <div style="font-size:2rem;margin-bottom:.35rem">🎯</div>
      <div style="font-size:.83rem;font-weight:600;margin-bottom:.25rem">Aucune thématique</div>
      <div style="font-size:.75rem;margin-bottom:.75rem">Créez des thématiques pour structurer les sujets CVS et suivre les scores de satisfaction liés.</div>
      ${cvsCanEdit ? `<button class="btn btn-accent btn-sm" onclick="openThematiqueModal()">+ Nouvelle thématique</button>` : ''}
    </div>`;
    return;
  }

  el.innerHTML = list.map(t => {
    const st = CVS_THEM_STATUTS[t.statut] || CVS_THEM_STATUTS.ouvert;
    const cats = (t.catIds || []).map(cid => CVS_SAT_CATS.find(c => c.id === cid)).filter(Boolean);
    const score = _cvsThemSatScore(t.catIds || []);
    const scoreCol = _cvsScoreColor(score);
    const prio = t.priorite === 'haute' ? '🔴' : t.priorite === 'basse' ? '🟢' : '';
    const seance = t.seanceId ? cvsSeances().find(s => s.id === t.seanceId) : null;

    return `<div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:.85rem 1rem;margin-bottom:.6rem;border-left:4px solid ${st.color}">
      <div style="display:flex;align-items:flex-start;gap:.6rem;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.25rem">
            ${prio ? `<span>${prio}</span>` : ''}
            <span style="font-weight:700;font-size:.92rem">${escHtml(t.titre||'')}</span>
            <span class="badge" style="background:${st.color}18;color:${st.color};margin-left:.2rem">${st.label}</span>
          </div>
          ${t.description ? `<div style="font-size:.78rem;color:var(--muted);margin-bottom:.4rem">${escHtml(t.description)}</div>` : ''}
          ${cats.length ? `<div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.35rem">
            ${cats.map(c => `<span style="font-size:.68rem;padding:2px 8px;border-radius:999px;background:${c.color}18;color:${c.color};font-weight:600">${c.label}</span>`).join('')}
          </div>` : ''}
          ${seance ? `<div style="font-size:.73rem;color:var(--muted)">📅 Séance du ${formatDate(seance.date)}</div>` : ''}
        </div>
        ${score !== null ? `<div style="text-align:center;min-width:70px;padding:.4rem .6rem;background:${scoreCol}12;border-radius:8px;border:1px solid ${scoreCol}30">
          <div style="font-size:1.3rem;font-weight:800;color:${scoreCol};line-height:1">${score}%</div>
          <div style="font-size:.62rem;color:var(--muted);margin-top:1px">Score sat.</div>
        </div>` : ''}
      </div>
      ${cvsCanEdit ? `<div style="display:flex;gap:.3rem;justify-content:flex-end;border-top:1px solid var(--border);padding-top:.4rem;margin-top:.4rem">
        <select style="font-size:.72rem;padding:2px 6px;border-radius:6px;border:1px solid var(--border)" onchange="setThematiqueStatut('${t.id}',this.value)">
          ${Object.entries(CVS_THEM_STATUTS).map(([k,v])=>`<option value="${k}"${t.statut===k?' selected':''}>${v.label}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" onclick="openThematiqueModal('${t.id}')">✎</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteThematique('${t.id}')">✕</button>
      </div>` : ''}
    </div>`;
  }).join('');
}

function openThematiqueModal(id, preCatId) {
  cvsEditThematiqueId = id || null;
  const t = id ? (getCvs().thematiques || []).find(x => x.id === id) || {} : {};
  document.getElementById('ctTitle').textContent = id ? 'Modifier la thématique' : 'Nouvelle thématique';
  document.getElementById('ctTitre').value = t.titre || '';
  document.getElementById('ctDescription').value = t.description || '';
  document.getElementById('ctPriorite').value = t.priorite || 'normale';
  document.getElementById('ctStatut').value = t.statut || 'ouvert';

  // Chips catégories — data-active fiable
  const selCats = id ? (t.catIds || []) : (preCatId ? [preCatId] : []);
  document.getElementById('ctCatsBox').innerHTML = CVS_SAT_CATS.map(c => {
    const on = selCats.includes(c.id);
    return `<span class="cvs-cat-chip" data-cat="${c.id}" data-active="${on?'1':'0'}" onclick="cvsCatToggle(this,'${c.id}')"
      style="font-size:.75rem;padding:4px 10px;border-radius:999px;cursor:pointer;user-select:none;transition:all .15s;
      background:${on?c.color:'transparent'};color:${on?'#fff':c.color};border:1.5px solid ${c.color}">${c.label}</span>`;
  }).join('');

  // Score sat live par catégorie dans le modal
  const satAll = _cvsSatCache;
  const scoresHtml = satAll.length ? CVS_SAT_CATS.map(c => {
    let tot=0,cnt=0;
    satAll.forEach(s => c.qIds.forEach(q => { const v=s.reponses?.[q]; if(v!=null){tot+=Number(v);cnt++;} }));
    const pct = cnt ? Math.round(tot/cnt*25) : null;
    return pct !== null ? `<span style="font-size:.68rem;color:${_cvsScoreColor(pct)};font-weight:600">${c.label} ${pct}%</span>` : '';
  }).filter(Boolean).join(' · ') : '';
  const scoresDiv = document.getElementById('ctCatsBox').parentElement;
  let hint = scoresDiv.querySelector('.cvs-sat-hint');
  if (!hint) { hint = document.createElement('p'); hint.className = 'cvs-sat-hint'; hint.style.cssText='font-size:.68rem;color:var(--muted);margin:.4rem 0 0'; scoresDiv.appendChild(hint); }
  hint.innerHTML = scoresHtml ? `Scores actuels : ${scoresHtml}` : '';

  // Séances
  const seanceEl = document.getElementById('ctSeanceId');
  seanceEl.innerHTML = '<option value="">— Aucune —</option>'
    + cvsSeances().map(s => `<option value="${s.id}"${t.seanceId===s.id?' selected':''}>Séance du ${formatDate(s.date)}</option>`).join('');

  openModal('modalCvsThematique');
}

function cvsCatToggle(el, catId) {
  const cat = CVS_SAT_CATS.find(c => c.id === catId);
  if (!cat) return;
  const active = el.dataset.active === '1';
  el.dataset.active = active ? '0' : '1';
  el.style.background = active ? 'transparent' : cat.color;
  el.style.color = active ? cat.color : '#fff';
}

function saveThematique() {
  const titre = document.getElementById('ctTitre').value.trim();
  if (!titre) { toast('Le titre est requis', 'error'); return; }
  const catIds = [...document.querySelectorAll('#ctCatsBox .cvs-cat-chip')]
    .filter(el => el.dataset.active === '1')
    .map(el => el.dataset.cat);
  const data = {
    titre,
    description: document.getElementById('ctDescription').value.trim(),
    catIds,
    priorite: document.getElementById('ctPriorite').value,
    statut: document.getElementById('ctStatut').value,
    seanceId: document.getElementById('ctSeanceId').value || ''
  };
  const cvs = getCvs();
  let thems = cvs.thematiques || [];
  if (cvsEditThematiqueId) {
    thems = thems.map(x => x.id === cvsEditThematiqueId ? { ...x, ...data } : x);
    toast('Thématique mise à jour');
  } else {
    thems = [...thems, { id: genId(), ...data, createdAt: new Date().toISOString() }];
    toast('Thématique créée ✓', 'success');
  }
  saveCvs({ ...cvs, thematiques: thems });
  closeModal('modalCvsThematique');
  renderCvs();
}

function setThematiqueStatut(id, statut) {
  const cvs = getCvs();
  const thems = (cvs.thematiques || []).map(x => x.id === id ? { ...x, statut } : x);
  saveCvs({ ...cvs, thematiques: thems });
  renderCvsThematiques();
}

function deleteThematique(id) {
  confirmDialog('Supprimer cette thématique ?', () => {
    const cvs = getCvs();
    saveCvs({ ...cvs, thematiques: (cvs.thematiques || []).filter(x => x.id !== id) });
    renderCvs();
    toast('Thématique supprimée', 'info');
  });
}

// ── INIT ──
async function initCvs() {
  const s = Auth.requireAuth();
  if (!s) return;
  if (!requireModule('access_cvs')) return;
  await sbLoadResidentsCache();
  await loadCvsCache();
  cvsCanEdit = ((typeof canEditResidents === 'function') ? canEditResidents(s.userId) : false) || Auth.isAdmin();
  document.getElementById('cmCollege').innerHTML = Object.entries(CVS_COLLEGES).map(([k, c]) => `<option value="${k}">${c.icon} ${c.label}</option>`).join('');
  document.getElementById('cmRole').innerHTML = Object.entries(CVS_ROLES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
  if (!cvsCanEdit) {
    document.querySelectorAll('.no-cvs-edit').forEach(el => el.style.display = 'none');
  }
  renderCvs();
}
document.addEventListener('DOMContentLoaded', initCvs);
