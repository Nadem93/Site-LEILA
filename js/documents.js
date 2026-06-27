const DOCUMENTS_KEY = DB.keys.documents;

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

function getAllDocuments() {
  const residents = sbResidents();
  return docResAll().map(d => {
    if (String(d.residentId) === '_resources') return { ...d, residentName: '📁 Ressource', type: 'resource' };
    const r = residents.find(x => String(x.id) === String(d.residentId));
    return { ...d, residentName: r ? `${r.prenom||''} ${r.nom||''}` : 'Inconnu', type: d.type || 'resident' };
  }).sort((a, b) => (b.docDate || b.date || '').localeCompare(a.docDate || a.date || ''));
}

function initDocuments() {
  const session = Auth.requireAuth();
  if (!session) return;
  if (!requireModule('access_documents')) return;
  populateDocResidentSelect();
  renderDocuments();
}

function populateDocResidentSelect() {
  const sel = document.getElementById('docFilterResident');
  if (!sel) return;
  const residents = sbResidents();
  sel.innerHTML = '<option value="">Tous les résidents</option>' + residents.map(r =>
    `<option value="${r.id}">${escHtml(r.prenom||'')} ${escHtml(r.nom||'')}</option>`
  ).join('');
}

function renderDocuments() {
  const container = document.getElementById('documentList');
  if (!container) return;
  const list = getAllDocuments();
  const search = (document.getElementById('docSearchInput')?.value || '').toLowerCase();
  const filterRes = document.getElementById('docFilterResident')?.value || '';
  const filterCat = document.getElementById('docFilterCategory')?.value || '';
  const filterType = document.getElementById('docFilterType')?.value || '';

  let filtered = list;
  if (filterRes) filtered = filtered.filter(d => d.residentId === filterRes);
  if (filterType) filtered = filtered.filter(d => (d.type || 'resident') === filterType);
  if (filterCat) filtered = filtered.filter(d => d.category === filterCat);
  if (search) filtered = filtered.filter(d =>
    (d.residentName||'').toLowerCase().includes(search) ||
    (d.name||'').toLowerCase().includes(search) ||
    (d.category||'').toLowerCase().includes(search)
  );

  if (!filtered.length) {
    container.innerHTML = '<div class="empty" style="padding:3rem"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:48px;height:48px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div><p>Aucun document trouvé</p><button class="btn btn-outline btn-sm" onclick="openDocModal()">Ajouter un document</button></div>';
    return;
  }

  container.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:.82rem">
    <thead>
      <tr style="text-align:left;border-bottom:2px solid var(--border);font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">
        <th style="padding:.5rem .75rem">Document</th>
        <th style="padding:.5rem .75rem">Résident</th>
        <th style="padding:.5rem .75rem">Catégorie</th>
        <th style="padding:.5rem .75rem">Date</th>
        <th style="padding:.5rem .75rem">Échéance</th>
        <th style="padding:.5rem .75rem;text-align:center">Télécharger</th>
      </tr>
    </thead>
    <tbody>${(() => {
    const filterRes = document.getElementById('docFilterResident')?.value;
    const groupByCat = !!filterRes;
    let catRows = '';
    if (groupByCat) {
      const groups = {};
      filtered.forEach(d => { const c = d.category || 'autre'; if(!groups[c]) groups[c] = []; groups[c].push(d); });
      const catOrder = ['administratif','medical','scolaire','judiciaire','contrat','autre'];
      const catLabels = {administratif:'Administratif',medical:'Médical',scolaire:'Scolaire',judiciaire:'Judiciaire',contrat:'Contrat',autre:'Autre'};
      let idx = 0;
      catOrder.forEach(cat => {
        const docs = groups[cat]; if(!docs) return;
        catRows += `<tr style="background:var(--g300);font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)"><td colspan="6" style="padding:.3rem .75rem;text-align:center">${catLabels[cat]||cat}</td></tr>`;
        docs.forEach(d => {
          const overdue = d.dueDate && d.dueDate < today() && !d.done;
          catRows += `<tr style="border-bottom:1px solid var(--border);background:${idx%2===0?'var(--g50)':'var(--g100)'};transition:background .1s" onmouseover="this.style.background='var(--g200)'" onmouseout="this.style.background='${idx%2===0?'var(--g50)':'var(--g100)'}'">
        <td style="padding:.35rem .75rem">
          <div style="display:flex;align-items:center;gap:.5rem">
            <span style="font-size:1.2rem">${docTypeIcon(d.mimeType)}</span>
            <span style="font-weight:600;color:${overdue?'#ef4444':'inherit'}">${escHtml(d.name)}</span>
          </div>
        </td>
        <td style="padding:.35rem .75rem;color:var(--muted)">${escHtml(d.residentName)}</td>
        <td style="padding:.35rem .75rem;color:var(--muted)">${catLabels[cat]||d.category||'—'}</td>
        <td style="padding:.35rem .75rem;color:var(--muted)">${d.docDate ? formatDate(d.docDate) : '—'}</td>
        <td style="padding:.35rem .75rem;color:${overdue?'#ef4444':'var(--muted)'};font-weight:${overdue?'600':'400'}">${d.dueDate ? formatDate(d.dueDate)+(overdue ? ' ⚠️' : '') : '—'}</td>
        <td style="padding:.35rem .75rem;text-align:center;white-space:nowrap">
          <button class="btn-dl" onclick="downloadDoc('${d.id}','${d.residentId}')" title="Télécharger"><svg class="dl-svg" width="20" height="20" viewBox="0 0 40 40"><path class="dl-arrow" d="m20 4 v14 m-5 -5 l5 5 5 -5"></path><path class="dl-base" d="m10 28 v4 h 20 v-4"></path></svg></button>
        </td>
      </tr>`;
          idx++;
        });
      });
    } else {
      filtered.forEach((d, i) => {
        const overdue = d.dueDate && d.dueDate < today() && !d.done;
        catRows += `<tr style="border-bottom:1px solid var(--border);background:${i%2===0?'var(--g50)':'var(--g100)'};transition:background .1s" onmouseover="this.style.background='var(--g200)'" onmouseout="this.style.background='${i%2===0?'var(--g50)':'var(--g100)'}'">
        <td style="padding:.35rem .75rem">
          <div style="display:flex;align-items:center;gap:.5rem">
            <span style="font-size:1.2rem">${docTypeIcon(d.mimeType)}</span>
            <span style="font-weight:600;color:${overdue?'#ef4444':'inherit'}">${escHtml(d.name)}</span>
          </div>
        </td>
        <td style="padding:.35rem .75rem;color:var(--muted)">${escHtml(d.residentName)}</td>
        <td style="padding:.35rem .75rem;color:var(--muted)">${d.category ? escHtml(d.category.charAt(0).toUpperCase()+d.category.slice(1)) : '—'}</td>
        <td style="padding:.35rem .75rem;color:var(--muted)">${d.docDate ? formatDate(d.docDate) : '—'}</td>
        <td style="padding:.35rem .75rem;color:${overdue?'#ef4444':'var(--muted)'};font-weight:${overdue?'600':'400'}">${d.dueDate ? formatDate(d.dueDate)+(overdue ? ' ⚠️' : '') : '—'}</td>
        <td style="padding:.35rem .75rem;text-align:center;white-space:nowrap">
          <button class="btn-dl" onclick="downloadDoc('${d.id}','${d.residentId}')" title="Télécharger"><svg class="dl-svg" width="20" height="20" viewBox="0 0 40 40"><path class="dl-arrow" d="m20 4 v14 m-5 -5 l5 5 5 -5"></path><path class="dl-base" d="m10 28 v4 h 20 v-4"></path></svg></button>
        </td>
      </tr>`;
      });
    }
    return catRows;
  })()}</tbody></table>`;
}

function openDocModal(residentId) {
  resetDocForm();
  const sel = document.getElementById('docFormResident');
  if (sel) {
    const residents = sbResidents();
    sel.innerHTML = '<option value="">— Sélectionner —</option>' + residents.map(r =>
      `<option value="${r.id}">${escHtml(r.prenom||'')} ${escHtml(r.nom||'')}</option>`
    ).join('');
    const id = residentId || new URLSearchParams(window.location.search).get('residentId');
    if (id) sel.value = id;
  }
  toggleDocType('resident');
  document.getElementById('docFormDate').value = today();
  document.getElementById('docModalTitle').textContent = 'Ajouter un document';
  document.getElementById('docFormId').value = '';
  openModal('docModal');
}

function toggleDocType(type) {
  const resGroup = document.getElementById('docFormResidentGroup');
  if (resGroup) resGroup.style.display = type === 'resource' ? 'none' : '';
}

function editDocModal(docId, resId) {
  const doc = docResAll().find(d => d.id === docId);
  if (!doc) return;
  toggleDocType(doc.type === 'resource' ? 'resource' : 'resident');
  document.getElementById('docModalTitle').textContent = 'Modifier le document';
  document.getElementById('docFormId').value = docId;
  document.getElementById('docFormResident').value = resId === '_resources' ? '' : resId;
  document.getElementById('docFormName').value = doc.name || '';
  document.getElementById('docFormDate').value = doc.docDate || '';
  document.getElementById('docFormDueDate').value = doc.dueDate || '';
  document.getElementById('docFormCategory').value = doc.category || '';
  const radio = document.querySelector(`[name="docType"][value="${doc.type === 'resource' ? 'resource' : 'resident'}"]`);
  if (radio) radio.checked = true;
  openModal('docModal');
}

function resetDocForm() {
  document.getElementById('docFormId').value = '';
  document.getElementById('docFormResident').value = '';
  document.getElementById('docFormName').value = '';
  document.getElementById('docFormDate').value = '';
  document.getElementById('docFormDueDate').value = '';
  document.getElementById('docFormCategory').value = '';
  document.getElementById('docFileInput').value = '';
  document.getElementById('docFilePending').style.display = 'none';
  window._pendingDocFile = null;
}

async function saveDocument() {
  const id = document.getElementById('docFormId').value;
  const docType = document.querySelector('[name="docType"]:checked')?.value || 'resident';
  const residentId = docType === 'resource' ? '_resources' : document.getElementById('docFormResident').value;
  const name = document.getElementById('docFormName').value.trim();
  const docDate = document.getElementById('docFormDate').value;
  const dueDate = document.getElementById('docFormDueDate').value;
  const category = document.getElementById('docFormCategory').value;

  if (!residentId) { toast('Veuillez sélectionner un résident', 'error'); return; }
  if (!name && !window._pendingDocFile) { toast('Veuillez entrer un nom ou sélectionner un fichier', 'error'); return; }

  try {
    if (id) {
      const old = docResAll().find(d => d.id === id);
      if (!old) return;
      const saved = await sbSaveDocumentResident({ ...old, name: name || old.name, docDate, dueDate, category, id });
      _docResCache = _docResCache.map(d => d.id === id ? saved : d);
    } else {
      if (!window._pendingDocFile) { toast('Veuillez sélectionner un fichier', 'error'); return; }
      const file = window._pendingDocFile;
      const path = await sbUploadJustificatif(file, residentId);
      const saved = await sbSaveDocumentResident({
        residentId, name: name || file.name, fileName: file.name,
        size: file.size, mimeType: file.type, category, docDate, dueDate,
        fichierPath: path, type: docType
      });
      _docResCache.unshift(saved);
      window._pendingDocFile = null;
    }
  } catch (e) { console.error('[saveDocument]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }

  toast(id ? 'Document modifié' : 'Document ajouté', 'success');
  closeModal('docModal');
  renderDocuments();
}

async function handleDocFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) { toast('Fichier trop lourd (max 3 Mo)', 'error'); return; }
  window._pendingDocFile = file;
  document.getElementById('docFilePendingName').textContent = file.name;
  document.getElementById('docFilePendingSize').textContent = fmtSize(file.size);
  document.getElementById('docFilePending').style.display = 'flex';
  if (!document.getElementById('docFormName').value) document.getElementById('docFormName').value = file.name.replace(/\.[^.]+$/, '');
}

function cancelDocFile() {
  window._pendingDocFile = null;
  document.getElementById('docFileInput').value = '';
  document.getElementById('docFilePending').style.display = 'none';
}

function deleteDocument(docId, resId) {
  if (!confirm('Supprimer ce document ?')) return;
  const doc = docResAll().find(d => d.id === docId);
  (async () => {
    try {
      await sbDeleteDocumentResident(docId);
      if (doc?.fichierPath && typeof sbDeleteJustificatif === 'function') sbDeleteJustificatif(doc.fichierPath).catch(() => {});
      _docResCache = _docResCache.filter(d => d.id !== docId);
    } catch (e) { console.error('[deleteDocument]', e); toast('Erreur suppression : ' + (e?.message || e), 'error'); return; }
    toast('Document supprimé', 'success');
    renderDocuments();
  })();
}

async function initDocumentsPage() {
  await sbLoadResidentsCache();
  await loadDocResCache();
  initDocuments();
  document.getElementById('docSearchInput')?.addEventListener('input', renderDocuments);
  document.getElementById('docFilterResident')?.addEventListener('change', renderDocuments);
  document.getElementById('docFilterCategory')?.addEventListener('change', renderDocuments);
  document.getElementById('docFilterType')?.addEventListener('change', renderDocuments);
  const params = new URLSearchParams(window.location.search);
  const residentId = params.get('residentId');
  if (residentId) {
    const sel = document.getElementById('docFilterResident');
    if (sel) { sel.value = residentId; }
    renderDocuments();
  }
}
document.addEventListener('DOMContentLoaded', initDocumentsPage);
if (typeof registerPageInit === 'function') registerPageInit('documents', initDocumentsPage);
