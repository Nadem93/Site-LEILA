const DOCU_CATEGORIE_ICONS = {
  "Projet d'établissement": '🏛️',
  'Notes de service': '📌',
  'Règlement intérieur': '📜',
  'Procédures': '🧭',
  'Comptes-rendus de réunion': '📝',
  'Autre': '📄'
};

// Source = Supabase. Cache mémoire chargé au démarrage. Fichiers dans le bucket justificatifs.
let _docuCache = [];
function getDocumentation() { return _docuCache; }
async function loadDocumentationCache() { _docuCache = await sbGetDocumentation(); }

function docuFmtSize(b) {
  if (!b) return '';
  if (b < 1024) return b + ' o';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' Ko';
  return (b / (1024 * 1024)).toFixed(1) + ' Mo';
}

function openDocumentationModal() {
  document.getElementById('docuFormTitre').value = '';
  document.getElementById('docuFormCategorie').value = "Projet d'établissement";
  document.getElementById('docuFormFile').value = '';
  openModal('modalDocumentation');
}

async function saveDocumentation() {
  const titre = document.getElementById('docuFormTitre').value.trim();
  const categorie = document.getElementById('docuFormCategorie').value;
  const fileInput = document.getElementById('docuFormFile');
  const file = fileInput.files[0];
  if (!titre) { toast('Titre requis', 'error'); return; }
  if (!file) { toast('Fichier requis', 'error'); return; }
  if (file.size > 3 * 1024 * 1024) { toast('Fichier trop lourd (max 3 Mo)', 'error'); return; }
  const session = Auth.getSession();
  try {
    const path = await sbUploadJustificatif(file, 'documentation');
    const saved = await sbSaveDocumentation({
      titre, categorie,
      fichierNom: file.name, fichierMime: file.type, fichierTaille: file.size, fichierPath: path,
      ajoutePar: session ? [session.prenom, session.nom].filter(Boolean).join(' ') || session.username : ''
    });
    _docuCache.unshift(saved);
  } catch (e) { console.error('[saveDocumentation]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
  if (typeof auditLog === 'function') auditLog('documentation', titre + ' (' + categorie + ')');
  toast('Document ajouté', 'success');
  closeModal('modalDocumentation');
  renderDocumentation();
}

function supprimerDocumentation(id) {
  if (!confirm('Supprimer ce document ?')) return;
  const d = _docuCache.find(x => x.id === id);
  (async () => {
    try {
      await sbDeleteDocumentation(id);
      if (d?.fichierPath && typeof sbDeleteJustificatif === 'function') sbDeleteJustificatif(d.fichierPath).catch(() => {});
      _docuCache = _docuCache.filter(x => x.id !== id);
    } catch (e) { console.error('[supprimerDocumentation]', e); toast('Erreur suppression : ' + (e?.message || e), 'error'); return; }
    toast('Document supprimé', 'info');
    renderDocumentation();
  })();
}

async function voirDocumentation(id) {
  const d = _docuCache.find(x => x.id === id);
  if (!d || !d.fichierPath) return;
  const url = await sbJustificatifUrl(d.fichierPath);
  if (url) window.open(url, '_blank'); else toast('Fichier introuvable', 'error');
}

function docuItemHtml(d, isAdmin) {
  return `<div style="display:flex;align-items:center;gap:.75rem;padding:.85rem 1rem;background:#fff;border-radius:10px;margin-bottom:6px;box-shadow:0 2px 6px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04)">
    <span style="font-size:1.2rem;flex-shrink:0">${DOCU_CATEGORIE_ICONS[d.categorie] || '📄'}</span>
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
        <span style="font-weight:600;font-size:.85rem">${escHtml(d.titre)}</span>
        <span class="badge">${escHtml(d.categorie)}</span>
      </div>
      <div style="font-size:.74rem;color:var(--muted);margin-top:.2rem">
        ${escHtml(d.fichierNom)} · ${docuFmtSize(d.fichierTaille)} · Ajouté le ${new Date(d.dateAjout).toLocaleDateString('fr-FR')}${d.ajoutePar ? ' par ' + escHtml(d.ajoutePar) : ''}
      </div>
    </div>
    <div style="display:flex;gap:.25rem;flex-shrink:0">
      <button class="btn btn-outline btn-sm" onclick="voirDocumentation('${d.id}')">⬇ Télécharger</button>
      ${isAdmin ? `<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="supprimerDocumentation('${d.id}')">✕</button>` : ''}
    </div>
  </div>`;
}

function renderDocumentation() {
  const isAdmin = Auth.isAdmin();
  const list = getDocumentation();
  const q = (document.getElementById('docuSearch')?.value || '').trim().toLowerCase();
  const categorie = document.getElementById('docuFiltreCategorie')?.value || '';

  let filtered = list;
  if (q) filtered = filtered.filter(d => (d.titre+'').toLowerCase().includes(q) || (d.categorie+'').toLowerCase().includes(q));
  if (categorie) filtered = filtered.filter(d => d.categorie === categorie);

  const el = document.getElementById('docuList');
  if (!filtered.length) {
    el.innerHTML = '<div class="empty" style="padding:3rem;text-align:center"><p>Aucun document trouvé.</p></div>';
    return;
  }

  const categories = Object.keys(DOCU_CATEGORIE_ICONS);
  el.innerHTML = categories.map(cat => {
    const items = filtered.filter(d => d.categorie === cat).sort((a, b) => (b.dateAjout || '').localeCompare(a.dateAjout || ''));
    if (!items.length) return '';
    return `<div style="margin-bottom:1.25rem">
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;padding-bottom:.25rem;border-bottom:1px solid var(--border)">
        <span style="font-size:1.1rem">${DOCU_CATEGORIE_ICONS[cat] || '📄'}</span>
        <span style="font-weight:700;font-size:.85rem">${escHtml(cat)}</span>
        <span style="font-size:.72rem;color:var(--muted)">(${items.length})</span>
      </div>
      ${items.map(d => docuItemHtml(d, isAdmin)).join('')}
    </div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', async () => { if (requireModule('access_documentation')) { await loadDocumentationCache(); renderDocumentation(); } });
if (typeof registerPageInit === 'function') registerPageInit('documentation', async () => { await loadDocumentationCache(); renderDocumentation(); });
