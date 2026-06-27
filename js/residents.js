let currentView = 'grid';
let editingId = null;
let pendingPhoto = null;
let pendingDocFile = null;
let _residentsCache = [];

async function loadAndRenderResidents() {
  _residentsCache = await sbGetResidents();
  renderResidents();
}

const DOC_CAT_LABELS = {
  mdph:'MDPH', cmu:'CMU/CSS', contrat:'Contrat de séjour', avenant:'Avenant',
  jugement:'Jugement/Tutelle', ordonnance:'Ordonnance', attestation:'Attestation',
  rapport:'Rapport social', ase:'ASE', pjj:'PJJ', identite:"Pièce d'identité", autre:'Autre'
};

const PROTECTION_LABELS = {
  tutelle:'Tutelle', curatelle:'Curatelle', sauvegarde:'Sauvegarde de justice',
  habilitation:'Habilitation familiale', masp:'MASP', autre:'Autre'
};

function docTypeIcon(mime) {
  if (!mime) return '📎';
  if (mime.includes('pdf')) return '📄';
  if (mime.includes('image')) return '🖼️';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  return '📎';
}
function fmtSize(b) {
  if (b < 1024) return b + ' o';
  if (b < 1024*1024) return Math.round(b/1024) + ' Ko';
  return (b/1024/1024).toFixed(1) + ' Mo';
}

// ── SECTIONS ADAPTABLES ──
function updateAdaptiveSections() {
  const type = getStructureType();
  const sE = document.getElementById('sectionEnfant');
  const sA = document.getElementById('sectionAdulte');
  if (!sE || !sA) return;
  sE.style.display = (type === 'enfants' || type === 'mixte') ? '' : 'none';
  sA.style.display = (type === 'adultes' || type === 'mixte') ? '' : 'none';
}

// ── PHOTO ──
function initPhotoUpload() {
  const input = document.getElementById('rPhotoInput');
  if (!input) return;
  input.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('Photo trop lourde (max 2 Mo)', 'error'); return; }
    try {
      pendingPhoto = await fileToBase64(file);
      updatePhotoPreview(pendingPhoto);
    } catch { toast('Erreur lors du chargement de la photo', 'error'); }
  });
}

function updatePhotoPreview(src) {
  const preview = document.getElementById('photoPreview');
  const removeBtn = document.getElementById('photoRemoveBtn');
  if (!preview) return;
  if (src) {
    preview.innerHTML = `<img src="${src}" alt="Photo" style="width:72px;height:72px;border-radius:8px;object-fit:cover;border:2px solid var(--border)"/>`;
    if (removeBtn) removeBtn.style.display = '';
  } else {
    preview.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--g400)" stroke-width="1.5" style="width:32px;height:32px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

function removePhoto() {
  pendingPhoto = null;
  document.getElementById('rPhotoInput').value = '';
  updatePhotoPreview(null);
}

// ── DOCUMENTS ──
function initDocUpload() {
  const input = document.getElementById('docFileInput');
  if (!input) return;
  input.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast('Fichier trop lourd (max 3 Mo)', 'error'); input.value=''; return; }
    pendingDocFile = file;
    document.getElementById('docPendingName').textContent = file.name;
    document.getElementById('docPendingSize').textContent = fmtSize(file.size);
    document.getElementById('docPendingRow').style.display = '';
    input.value = '';
  });
}

function cancelPendingDoc() {
  pendingDocFile = null;
  document.getElementById('docPendingRow').style.display = 'none';
}

async function uploadDocument() {
  if (!pendingDocFile) return;
  const residentId = document.getElementById('residentId').value || editingId;
  if (!residentId) { toast('Enregistrez d\'abord le résident', 'error'); return; }
  const category = document.getElementById('docCategory').value;
  const session = Auth.getSession();
  const uploader = session ? ([session.prenom, session.nom].filter(Boolean).join(' ') || session.username) : '—';
  try {
    const path = await sbUploadJustificatif(pendingDocFile, residentId);
    const saved = await sbSaveDocumentResident({
      residentId, name: pendingDocFile.name, category,
      size: pendingDocFile.size, mimeType: pendingDocFile.type,
      fichierPath: path, uploadedBy: uploader, type: 'resident'
    });
    _docResCache.unshift(saved);
    cancelPendingDoc();
    renderDocList(residentId);
    toast('Document joint');
  } catch (e) { console.error('[uploadDocument]', e); toast('Erreur lors du chargement', 'error'); }
}

function renderDocList(residentId) {
  const docs = docResByResident(residentId);
  const el = document.getElementById('docList');
  if (!el) return;
  const badge = document.getElementById('tabDocCount');
  if (badge) { badge.textContent = docs.length; badge.style.display = docs.length ? '' : 'none'; }
  if (!docs.length) {
    el.innerHTML = '<div class="empty" style="padding:1.5rem;text-align:center"><p style="color:var(--muted);font-size:.875rem">Aucun document joint</p></div>';
    return;
  }
  const isAdmin = Auth.isAdmin();
  el.innerHTML = docs.map(d => `
    <div class="doc-item">
      <div class="doc-type-icon">${docTypeIcon(d.mimeType)}</div>
      <div class="doc-info">
        <div class="doc-name">${escHtml(d.name)}</div>
        <div class="doc-meta">
          <span class="badge badge-gray" style="font-size:.68rem">${DOC_CAT_LABELS[d.category]||escHtml(d.category)}</span>
          ${fmtSize(d.size)} · ${formatDate(d.uploadedAt)} · ${escHtml(d.uploadedBy)}
        </div>
      </div>
      <div class="doc-actions">
        <button class="btn btn-ghost btn-sm" onclick="downloadDoc('${d.id}','${residentId}')">↓ Télécharger</button>
        ${isAdmin ? `<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteDoc('${d.id}','${residentId}')">✕</button>` : ''}
      </div>
    </div>`).join('');
}

async function downloadDoc(docId, residentId) {
  const doc = _docResCache.find(d => d.id === docId);
  if (!doc || !doc.fichierPath) return;
  const url = await sbJustificatifUrl(doc.fichierPath);
  if (url) window.open(url, '_blank'); else toast('Document introuvable', 'error');
}

function deleteDoc(docId, residentId) {
  confirmDialog('Supprimer ce document ?', async () => {
    const doc = _docResCache.find(d => d.id === docId);
    try {
      await sbDeleteDocumentResident(docId);
      if (doc?.fichierPath && typeof sbDeleteJustificatif === 'function') sbDeleteJustificatif(doc.fichierPath).catch(() => {});
      _docResCache = _docResCache.filter(d => d.id !== docId);
    } catch (e) { console.error('[deleteDoc]', e); toast('Erreur suppression : ' + (e?.message || e), 'error'); return; }
    renderDocList(residentId);
    toast('Document supprimé', 'info');
  });
}

// ── OBJECTIFS ──
function renderObjectifsCheckboxes(selected = []) {
  const objs = DB.get(DB.keys.objectives) || [];
  const el = document.getElementById('objectifsList');
  if (!el) return;
  if (!objs.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:.875rem">Aucun objectif configuré. <a href="admin.html?tab=fonctions" style="color:var(--blue)">Créer des objectifs</a></p>';
    return;
  }
  el.innerHTML = objs.map(o => `
    <label class="checkbox-wrap" style="padding:.65rem .75rem;border:1px solid var(--border);border-radius:var(--r-sm);cursor:pointer;transition:background var(--t)">
      <input type="checkbox" name="objectif" value="${o.id}" ${selected.includes(String(o.id)) ? 'checked' : ''}/>
      <div><div style="font-weight:600;font-size:.875rem">${escHtml(o.name)}</div><div style="font-size:.75rem;color:var(--muted)">${escHtml(o.description||'')}</div></div>
    </label>`).join('');
}

function populateFilterObjectifs() {
  const objs = DB.get(DB.keys.objectives) || [];
  const sel = document.getElementById('filterObjectif');
  if (!sel) return;
  sel.innerHTML = '<option value="">Tous les objectifs</option>';
  objs.forEach(o => { const opt = document.createElement('option'); opt.value = o.id; opt.textContent = o.name; sel.appendChild(opt); });
}

// ── FILTRES ──
function getResidents() {
  const q       = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const objectif = document.getElementById('filterObjectif')?.value || '';
  const sortBy  = document.getElementById('sortResidents')?.value || 'nom';
  let list = _residentsCache;
  if (q) list = list.filter(r => `${r.prenom} ${r.nom}`.toLowerCase().includes(q) || (r.chambre||'').toLowerCase().includes(q));
  if (objectif) list = list.filter(r => (r.objectifs || []).includes(String(objectif)));

  list.sort((a, b) => {
    // Sortis toujours en dernier
    const sortedA = a.statut === 'sorti' ? 1 : 0;
    const sortedB = b.statut === 'sorti' ? 1 : 0;
    if (sortedA !== sortedB) return sortedA - sortedB;
    switch (sortBy) {
      case 'prenom':  return (a.prenom||'').localeCompare(b.prenom||'');
      case 'chambre': return (a.chambre||'').localeCompare(b.chambre||'', undefined, {numeric:true});
      case 'entree':  return (a.entree||'').localeCompare(b.entree||'');
      case 'age':     return (b.dob||'').localeCompare(a.dob||''); // plus âgé en premier
      default:        return (a.nom||'').localeCompare(b.nom||'');
    }
  });
  return list;
}

// ── RENDER ──
function renderResidents() {
  const list = getResidents();
  const container = document.getElementById('residentsContainer');
  const countEl = document.getElementById('residentCount');
  countEl.textContent = `${list.length} résident${list.length > 1 ? 's' : ''}`;

  if (!list.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div><h3>Aucun résident trouvé</h3><p>Ajoutez votre premier résident ou modifiez vos filtres.</p><button class="btn btn-accent" onclick="openModal('modalResident')">+ Nouveau résident</button></div>`;
    return;
  }

  if (currentView === 'grid') {
    container.innerHTML = `<div class="res-grid" style="gap:.5rem">${list.map(residentCard).join('')}</div>`;
  } else {
    container.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Résident</th><th>Âge / Naissance</th><th>Entrée</th><th>Chambre</th><th>Actions</th><th>Statut</th><th>Objectifs</th></tr></thead><tbody>${list.map(residentRow).join('')}</tbody></table></div>`;
  }
}

function statusBadge(s) {
  const colors = { urgence:'#ef4444', stage:'#f97316', temporaire:'#3b82f6', permanent:'#10b981', present:'#10b981', absent:'#ef4444', sortie:'#f59e0b', sorti:'#94a3b8' };
  const labels = { present:'Présent', absent:'Absent', sortie:'Sortie temp.', sorti:'Sorti', urgence:'Urgence', stage:'Stage', temporaire:'Temporaire', permanent:'Permanent' };
  const c = colors[s] || '#94a3b8';
  return `<span class="badge" style="background:${c}22;color:${c};border:1px solid ${c}44">${labels[s]||s||'—'}</span>`;
}

function residentCard(r) {
  const coverColor = r.color || 'var(--primary)';
  const photoEl = r.photo
    ? `<img src="${sanitizeUrl(r.photo)}" class="res-card-photo" alt="${escHtml(r.prenom||'')} ${escHtml(r.nom||'')}"/>`
    : `<div class="res-card-photo" style="background:${coverColor};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.2rem;color:#fff">${initials(r.prenom,r.nom)}</div>`;

  const todayPresences = (DB.get(DB.keys.presences)||{})[today()] || {};
  const presenceStatus = todayPresences[r.id] || (r.statut === 'sorti' ? 'sorti' : r.statut);
  return `<div class="res-card" style="--card-color:${coverColor}" onclick="window.location.href='resident.html?id=${r.id}'">
    <div class="res-card-body">
      ${photoEl}
      <div class="res-card-info">
        <div class="res-card-name">${escHtml(r.prenom||'')} ${escHtml(r.nom||'')}</div>
        <div class="res-card-meta">${r.dob ? age(r.dob)+' ans' : ''}${r.chambre ? ' · Ch. '+escHtml(r.chambre) : ''}</div>
        ${r.protection ? `<div class="res-card-ref">${PROTECTION_LABELS[r.protection] || r.protection}</div>` : ''}
        <div>${statusBadge(presenceStatus)}</div>
      </div>
    </div>
  </div>`;
}

function residentRow(r) {
  const objs = DB.get(DB.keys.objectives) || [];
  const resObjs = (r.objectifs || []).map(id => objs.find(o => String(o.id) === String(id))?.name).filter(Boolean);
  const photoEl = r.photo
    ? `<img src="${sanitizeUrl(r.photo)}" style="width:32px;height:32px;border-radius:8px;object-fit:cover;border:2px solid var(--border)" alt=""/>`
    : `<div style="width:32px;height:32px;border-radius:8px;background:${r.color||'var(--blue)'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.65rem;color:#fff;flex-shrink:0">${initials(r.prenom,r.nom)}</div>`;
  const session = Auth.getSession();
  const canEdit = session && (session.role === 'admin' || session.role === 'moderator' || canEditResidents(session.userId));
  return `<tr>
    <td><div style="display:flex;align-items:center;gap:.6rem">${photoEl}<span style="font-weight:600">${escHtml(r.prenom||'')} ${escHtml(r.nom||'')}</span></div></td>
    <td>${r.dob ? age(r.dob)+' ('+formatDate(r.dob)+')' : '—'}</td>
    <td>${r.entree ? formatDate(r.entree) : '—'}</td>
    <td>${escHtml(r.chambre||'—')}</td>
    <td><div class="table-actions">
      <button class="btn btn-ghost btn-sm" onclick="window.location.href='resident.html?id=${r.id}'">Voir</button>
      <button class="btn btn-ghost btn-sm" onclick="window.location.href='resident.html?id=${r.id}'" title="Dashboard">📊</button>
      ${canEdit ? `<button class="btn btn-ghost btn-sm" onclick="quickEditResident('${r.id}')">Modifier</button>` : ''}
    </div></td>
    <td>${statusBadge(r.statut)}</td>
    <td><div style="display:flex;gap:.3rem;flex-wrap:wrap">${resObjs.map(o=>`<span class="badge badge-gray">${escHtml(o)}</span>`).join('')||'—'}</div></td>
  </tr>`;
}

// ── DÉTAIL ──
function showDetail(id) {
  const r = _residentsCache.find(x => x.id === id);
  if (!r) return;
  const objs = DB.get(DB.keys.objectives) || [];
  const resObjs = (r.objectifs || []).map(id => objs.find(o => String(o.id) === String(id))).filter(Boolean);
  const type = getStructureType();

  const photoEl = r.photo
    ? `<img src="${sanitizeUrl(r.photo)}" style="width:80px;height:80px;border-radius:8px;object-fit:cover;border:3px solid var(--border);box-shadow:var(--shadow-md)" alt=""/>`
    : `<div style="width:80px;height:80px;border-radius:8px;background:${r.color||'var(--blue)'};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.5rem;color:#fff">${initials(r.prenom,r.nom)}</div>`;

  let extraFields = '';
  if (type === 'enfants' || type === 'mixte') {
    extraFields += `
      ${(r.tuteur||r.tuteurTel||r.ecole) ? `<div class="divider"></div>
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--purple);margin-bottom:.75rem">Informations enfant</div>
      <div class="grid grid-2" style="gap:.75rem">
        ${r.tuteur ? `<div><div style="font-size:.72rem;font-weight:700;color:var(--muted);margin-bottom:2px">Tuteur légal</div><div style="font-weight:600;font-size:.875rem">${escHtml(r.tuteur)}</div></div>` : ''}
        ${r.tuteurTel ? `<div><div style="font-size:.72rem;font-weight:700;color:var(--muted);margin-bottom:2px">Tél. tuteur</div><div style="font-weight:600;font-size:.875rem">${escHtml(r.tuteurTel)}</div></div>` : ''}
        ${r.ecole ? `<div><div style="font-size:.72rem;font-weight:700;color:var(--muted);margin-bottom:2px">Établissement scolaire</div><div style="font-weight:600;font-size:.875rem">${escHtml(r.ecole)}</div></div>` : ''}
        ${r.classe ? `<div><div style="font-size:.72rem;font-weight:700;color:var(--muted);margin-bottom:2px">Classe</div><div style="font-weight:600;font-size:.875rem">${escHtml(r.classe)}</div></div>` : ''}
        ${r.organisme ? `<div><div style="font-size:.72rem;font-weight:700;color:var(--muted);margin-bottom:2px">Organisme</div><div style="font-weight:600;font-size:.875rem">${escHtml(r.organisme).toUpperCase()}</div></div>` : ''}
        ${r.dossier ? `<div><div style="font-size:.72rem;font-weight:700;color:var(--muted);margin-bottom:2px">N° dossier</div><div style="font-weight:600;font-size:.875rem">${escHtml(r.dossier)}</div></div>` : ''}
      </div>` : ''}`;
  }
  if (type === 'adultes' || type === 'mixte') {
    extraFields += `
      ${(r.situationPro||r.ressources||r.organismeA) ? `<div class="divider"></div>
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--blue);margin-bottom:.75rem">Informations adulte</div>
      <div class="grid grid-2" style="gap:.75rem">
        ${r.situationPro ? `<div><div style="font-size:.72rem;font-weight:700;color:var(--muted);margin-bottom:2px">Situation pro.</div><div style="font-weight:600;font-size:.875rem">${escHtml(r.situationPro)}</div></div>` : ''}
        ${r.ressources ? `<div><div style="font-size:.72rem;font-weight:700;color:var(--muted);margin-bottom:2px">Ressources</div><div style="font-weight:600;font-size:.875rem">${escHtml(r.ressources).toUpperCase()}</div></div>` : ''}
        ${r.organismeA ? `<div><div style="font-size:.72rem;font-weight:700;color:var(--muted);margin-bottom:2px">Organisme</div><div style="font-weight:600;font-size:.875rem">${escHtml(r.organismeA).toUpperCase()}</div></div>` : ''}
        ${r.situationAdmin ? `<div><div style="font-size:.72rem;font-weight:700;color:var(--muted);margin-bottom:2px">Situation admin.</div><div style="font-weight:600;font-size:.875rem">${escHtml(r.situationAdmin)}</div></div>` : ''}
        ${r.protection ? `<div><div style="font-size:.72rem;font-weight:700;color:var(--muted);margin-bottom:2px">Mesure de protection</div><div style="font-weight:600;font-size:.875rem">${PROTECTION_LABELS[r.protection] || r.protection}</div></div>` : ''}
      </div>` : ''}`;
  }

  document.getElementById('detailName').textContent = `${r.prenom||''} ${r.nom||''}`;
  document.getElementById('detailBody').innerHTML = `
    <div style="display:flex;gap:1.25rem;align-items:flex-start">
      ${photoEl}
      <div style="flex:1">
        <h3 style="font-size:1.25rem;font-weight:800">${escHtml(r.prenom||'')} ${escHtml(r.nom||'')}</h3>
        <div style="display:flex;gap:.5rem;margin-top:.5rem;flex-wrap:wrap">
          ${statusBadge(r.statut)}
          ${r.genre ? `<span class="badge badge-gray">${r.genre==='M'?'Masculin':r.genre==='F'?'Féminin':'Autre'}</span>` : ''}
          ${r.dob ? `<span class="badge badge-gray">${age(r.dob)}</span>` : ''}
        </div>
        ${r.referent ? `<div style="font-size:.78rem;color:var(--muted);margin-top:.4rem">Référent : <strong>${escHtml(r.referent)}</strong></div>` : ''}
      </div>
    </div>
    <div class="divider"></div>
    <div class="grid grid-2" style="gap:.75rem">
      <div><div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:2px">Date de naissance</div><div style="font-weight:600;font-size:.875rem">${r.dob ? formatDate(r.dob) : '—'}</div></div>
      <div><div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:2px">Date d'entrée</div><div style="font-weight:600;font-size:.875rem">${r.entree ? formatDate(r.entree) : '—'}</div></div>
      <div><div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:2px">Chambre / Unité</div><div style="font-weight:600;font-size:.875rem">${escHtml(r.chambre||'—')}</div></div>
    </div>
    ${extraFields}
    ${resObjs.length ? `<div class="divider"></div><div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.75rem">Objectifs assignés</div><div style="display:flex;flex-direction:column;gap:.4rem">${resObjs.map(o=>`<div style="padding:.5rem .75rem;background:var(--g50);border-radius:var(--r-sm);border:1px solid var(--border)"><div style="font-weight:600;font-size:.875rem">${escHtml(o.name)}</div>${o.description?`<div style="font-size:.75rem;color:var(--muted)">${escHtml(o.description)}</div>`:''}</div>`).join('')}</div>` : ''}
    ${r.notes ? `<div class="divider"></div><div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.5rem">Notes</div><p style="font-size:.875rem;white-space:pre-wrap;line-height:1.7">${escHtml(r.notes)}</p>` : ''}
    ${r.contacts ? `<div class="divider"></div><div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.5rem">Contacts d'urgence</div><p style="font-size:.875rem;white-space:pre-wrap">${escHtml(r.contacts)}</p>` : ''}
    ${(r.medecin||r.allergies||r.nss) ? `<div class="divider"></div>
    <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#16a34a;margin-bottom:.75rem">Informations médicales</div>
    <div class="grid grid-2" style="gap:.75rem">
      ${r.medecin ? `<div><div style="font-size:.72rem;font-weight:700;color:var(--muted);margin-bottom:2px">Médecin traitant</div><div style="font-weight:600;font-size:.875rem">${escHtml(r.medecin)}${r.medecinTel?' · '+escHtml(r.medecinTel):''}</div></div>` : ''}
      ${r.allergies ? `<div><div style="font-size:.72rem;font-weight:700;color:var(--muted);margin-bottom:2px">Allergies / CI</div><div style="font-weight:600;font-size:.875rem;color:var(--red)">${escHtml(r.allergies)}</div></div>` : ''}
      ${r.nss ? `<div><div style="font-size:.72rem;font-weight:700;color:var(--muted);margin-bottom:2px">N° Sécurité sociale</div><div style="font-weight:600;font-size:.875rem;font-family:monospace">${escHtml(r.nss)}</div></div>` : ''}
    </div>` : ''}
    ${(() => { const docs = docResByResident(id); return docs.length ? `<div class="divider"></div><div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.75rem">Documents joints (${docs.length})</div><div style="display:flex;flex-direction:column;gap:.4rem">${docs.map(d=>`<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem .75rem;background:var(--g50);border-radius:var(--r-sm);border:1px solid var(--border)"><span style="font-size:1.1rem">${docTypeIcon(d.mimeType)}</span><div style="flex:1;min-width:0"><div style="font-weight:600;font-size:.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(d.name)}</div><div style="font-size:.7rem;color:var(--muted)">${DOC_CAT_LABELS[d.category]||escHtml(d.category)} · ${fmtSize(d.size)}</div></div><button class="btn btn-ghost btn-sm" onclick="downloadDoc('${d.id}','${id}')">↓</button></div>`).join('')}</div>` : ''; })()}
  `;
  document.getElementById('detailEditBtn').onclick = () => { closeAllModals(); editResident(id); };
  openModal('modalDetail');
}

// ── EDIT ──
function editResident(id) {
  const r = _residentsCache.find(x => x.id === id);
  if (!r) return;
  editingId = id;
  pendingPhoto = r.photo || null;
  document.getElementById('modalResidentTitle').textContent = 'Modifier le résident';
  document.getElementById('residentId').value = id;
  document.getElementById('rNom').value = r.nom || '';
  document.getElementById('rPrenom').value = r.prenom || '';
  document.getElementById('rDob').value = r.dob || '';
  document.getElementById('rGenre').value = r.genre || '';
  document.getElementById('rEntree').value = r.entree || '';
  document.getElementById('rStatut').value = r.statut || 'permanent';
  document.getElementById('rChambre').value = r.chambre || '';
  document.getElementById('rReferent').value = r.referent || '';
  document.getElementById('rColor').value = r.color || '#3b82f6';
  document.getElementById('rNotes').value = r.notes || '';
  document.getElementById('rContacts').value = r.contacts || '';
  // enfant
  const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  setV('rMedecin', r.medecin); setV('rMedecinTel', r.medecinTel);
  setV('rAllergies', r.allergies); setV('rNSS', r.nss);
  setV('rTuteur', r.tuteur); setV('rTuteurTel', r.tuteurTel); setV('rEcole', r.ecole);
  setV('rClasse', r.classe); setV('rOrganisme', r.organisme); setV('rDossier', r.dossier);
  setV('rSituationPro', r.situationPro); setV('rRessources', r.ressources);
  setV('rOrganismeA', r.organismeA); setV('rDossierA', r.dossierA); setV('rSituationAdmin', r.situationAdmin); setV('rProtection', r.protection);
  document.getElementById('btnDelete').style.display = '';
  updatePhotoPreview(pendingPhoto);
  renderObjectifsCheckboxes(r.objectifs || []);
  renderDocList(id);
  activateTab('infos');
  openModal('modalResident');
}

// ── SAVE ──
async function saveResident() {
  const nom = document.getElementById('rNom').value.trim();
  const prenom = document.getElementById('rPrenom').value.trim();
  if (!nom && !prenom) { toast('Le nom ou prénom est requis', 'error'); return; }
  const checked = [...document.querySelectorAll('input[name="objectif"]:checked')].map(el => el.value);
  const gV = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const id = document.getElementById('residentId').value;
  const data = {
    id: id || undefined,
    nom, prenom, photo: pendingPhoto,
    dob: gV('rDob'), genre: gV('rGenre'), entree: gV('rEntree'),
    statut: gV('rStatut'), chambre: gV('rChambre'), referent: gV('rReferent'),
    color: document.getElementById('rColor').value,
    notes: gV('rNotes'), contacts: gV('rContacts'), objectifs: checked,
    medecin: gV('rMedecin'), medecinTel: gV('rMedecinTel'),
    allergies: gV('rAllergies'), nss: gV('rNSS'), ins: gV('rINS'),
    dmp: gV('rDMP'), dmpDate: gV('rDMPDate'),
    consent: gV('rConsent'), consentDate: gV('rConsentDate'),
    tuteur: gV('rTuteur'), tuteurTel: gV('rTuteurTel'), ecole: gV('rEcole'),
    classe: gV('rClasse'), organisme: gV('rOrganisme'), dossier: gV('rDossier'),
    situationPro: gV('rSituationPro'), ressources: gV('rRessources'),
    organismeA: gV('rOrganismeA'), dossierA: gV('rDossierA'), situationAdmin: gV('rSituationAdmin'),
    protection: gV('rProtection')
  };
  try {
    await sbSaveResident(data);
    toast(id ? 'Résident mis à jour' : 'Résident ajouté');
    if (typeof auditLog === 'function') auditLog(id ? 'resident_update' : 'resident_create', `${data.prenom} ${data.nom}`);
    closeAllModals(); resetForm();
    await loadAndRenderResidents();
  } catch (e) {
    toast('Erreur lors de l\'enregistrement', 'error');
    console.error(e);
  }
}

// ── DELETE ──
function deleteResident() {
  const id = document.getElementById('residentId').value;
  if (!id) return;
  confirmDialog('Supprimer ce résident définitivement ?', async () => {
    const r = _residentsCache.find(x => x.id === id);
    try {
      await sbDeleteResident(id);
      if (typeof auditLog === 'function') auditLog('resident_delete', r ? `${r.prenom} ${r.nom}` : id);
      closeAllModals(); resetForm();
      await loadAndRenderResidents();
      toast('Résident supprimé', 'info');
    } catch (e) {
      toast('Erreur lors de la suppression', 'error');
      console.error(e);
    }
  });
}

// ── RESET ──
function resetForm() {
  editingId = null; pendingPhoto = null;
  document.getElementById('residentId').value = '';
  document.getElementById('modalResidentTitle').textContent = 'Nouveau résident';
  ['rNom','rPrenom','rDob','rChambre','rReferent','rNotes','rContacts',
   'rMedecin','rMedecinTel','rAllergies','rNSS',
   'rTuteur','rTuteurTel','rEcole','rClasse','rDossier','rDossierA'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  cancelPendingDoc();
  const docListEl = document.getElementById('docList');
  if (docListEl) docListEl.innerHTML = '';
  const badge = document.getElementById('tabDocCount');
  if (badge) badge.style.display = 'none';
  ['rGenre','rOrganisme','rOrganismeA','rSituationPro','rRessources','rSituationAdmin','rProtection'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('rEntree').value = today();
  document.getElementById('rStatut').value = 'permanent';
  document.getElementById('rColor').value = '#3b82f6';
  document.getElementById('btnDelete').style.display = 'none';
  document.getElementById('rPhotoInput').value = '';
  updatePhotoPreview(null);
  renderObjectifsCheckboxes([]);
  activateTab('infos');
}

function activateTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  ['infos','objectifs','documents','notes'].forEach(n => {
    const el = document.getElementById('tab-'+n);
    if (el) el.style.display = n === name ? '' : 'none';
  });
}

// ── INIT ──
async function initResidents() {
  if (!requireModule('view_residents')) return;
  const entree = document.getElementById('rEntree');
  if (entree) entree.value = today();
  updateAdaptiveSections();
  populateFilterObjectifs();
  renderObjectifsCheckboxes([]);
  initPhotoUpload();
  initDocUpload();
  await loadDocResCache();
  await loadAndRenderResidents();

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.addEventListener('input', renderResidents);
  const filterObj = document.getElementById('filterObjectif');
  if (filterObj) filterObj.addEventListener('change', renderResidents);
  const sortSel = document.getElementById('sortResidents');
  if (sortSel) sortSel.addEventListener('change', renderResidents);
  const viewGrid = document.getElementById('viewGrid');
  if (viewGrid) viewGrid.addEventListener('click', () => { currentView='grid'; renderResidents(); });
  const viewList = document.getElementById('viewList');
  if (viewList) viewList.addEventListener('click', () => { currentView='list'; renderResidents(); });
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => activateTab(t.dataset.tab)));
  const modalRes = document.getElementById('modalResident');
  if (modalRes) modalRes.addEventListener('click', e => {
    if (e.target.id === 'modalResident') { closeAllModals(); resetForm(); }
  });

  // Ouvrir directement l'édition si ?edit=xxx
  const params = new URLSearchParams(window.location.search);
  const editId = params.get('edit');
  if (editId) {
    setTimeout(() => editResident(editId), 100);
  } else if (params.get('new') === 'true') {
    setTimeout(() => openModal('modalResident'), 100);
  }
}

document.addEventListener('DOMContentLoaded', initResidents);
if (typeof registerPageInit === 'function') registerPageInit('residents', initResidents);

// ── ÉDITION RAPIDE (CARTE) ──
let qePendingPhoto = null;

function qeUpdatePhotoPreview(src) {
  const el = document.getElementById('qePhotoPreview');
  if (!el) return;
  if (src) {
    el.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:8px"/>`;
    document.getElementById('qePhotoRemove').style.display = '';
  } else {
    el.innerHTML = '—';
    document.getElementById('qePhotoRemove').style.display = 'none';
  }
}

function removeQePhoto() {
  qePendingPhoto = null;
  qeUpdatePhotoPreview(null);
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('qePhotoInput');
  if (input) {
    input.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { toast('Photo trop lourde (max 2 Mo)', 'error'); return; }
      try {
        qePendingPhoto = await fileToBase64(file);
        qeUpdatePhotoPreview(qePendingPhoto);
      } catch { toast('Erreur lors du chargement', 'error'); }
    });
  }
});

function quickEditResident(id) {
  qePendingPhoto = null;
  const r = _residentsCache.find(x => String(x.id) === String(id));
  if (!r) return toast('Résident introuvable', 'error');
  document.getElementById('qeId').value = r.id;
  document.getElementById('qeNom').value = r.nom || '';
  document.getElementById('qePrenom').value = r.prenom || '';
  document.getElementById('qeDob').value = r.dob || '';
  document.getElementById('qeStatut').value = r.statut || 'permanent';
  document.getElementById('qeEntree').value = r.entree || '';
  document.getElementById('qeChambre').value = r.chambre || '';
  document.getElementById('qeColor').value = r.color || '#3b82f6';
  qeUpdatePhotoPreview(r.photo || null);
  document.getElementById('qePhotoInput').value = '';
  openModal('modalQuickEdit');
}

async function saveQuickEdit() {
  const id = document.getElementById('qeId').value;
  if (!id) return;
  const r = _residentsCache.find(x => String(x.id) === String(id));
  if (!r) return toast('Résident introuvable', 'error');
  const nom = document.getElementById('qeNom').value.trim();
  const prenom = document.getElementById('qePrenom').value.trim();
  if (!nom || !prenom) return toast('Nom et prénom sont requis', 'error');
  const data = {
    ...r, id, nom, prenom,
    dob: document.getElementById('qeDob').value,
    statut: document.getElementById('qeStatut').value,
    entree: document.getElementById('qeEntree').value,
    chambre: document.getElementById('qeChambre').value,
    color: document.getElementById('qeColor').value
  };
  if (qePendingPhoto !== null) { data.photo = qePendingPhoto; qePendingPhoto = null; }
  try {
    await sbSaveResident(data);
    closeModal('modalQuickEdit');
    await loadAndRenderResidents();
    toast('Carte mise à jour');
  } catch (e) {
    toast('Erreur lors de l\'enregistrement', 'error');
    console.error(e);
  }
}
