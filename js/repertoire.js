let editingContactId = null;
const CONTACT_COLORS = ['#0891b2','#059669','#d97706','#dc2626','#7c3aed','#0284c7','#16a34a','#e11d48','#6366f1','#0ea5e9','#84cc16','#ec4899','#14b8a6','#f97316','#8b5cf6'];

// Source = Supabase. Cache mémoire chargé au démarrage.
let _repCache = [];
function getContacts() { return _repCache; }
async function loadRepertoireCache() { _repCache = await sbGetRepertoire(); }

function contactColor(org) {
  let h = 0;
  for (let i = 0; i < (org||'').length; i++) h = (h * 31 + org.charCodeAt(i)) | 0;
  return CONTACT_COLORS[Math.abs(h) % CONTACT_COLORS.length];
}

function renderContacts() {
  const all = getContacts().sort((a,b) => a.organisme.localeCompare(b.organisme));
  const q = (document.getElementById('searchRepertoire')?.value || '').trim().toLowerCase();
  const contacts = q
    ? all.filter(c =>
        (c.organisme+'').toLowerCase().includes(q) ||
        (c.nom+'').toLowerCase().includes(q) ||
        (c.fonction+'').toLowerCase().includes(q) ||
        (c.tel+'').includes(q) ||
        (c.email+'').toLowerCase().includes(q) ||
        (c.adresse+'').toLowerCase().includes(q) ||
        (c.notes+'').toLowerCase().includes(q)
      )
    : all;
  const countEl = document.getElementById('contactCount');
  if (countEl) countEl.textContent = q ? contacts.length+'/'+all.length+' contacts' : contacts.length+' contact'+(contacts.length>1?'s':'');
  const container = document.getElementById('contactList');
  if (!contacts.length) {
    container.innerHTML = '<div class="empty"><h3>'+(q?'Aucun résultat':'Aucun contact')+'</h3><p>'+(q?'Aucun contact ne correspond à votre recherche.':'Ajoutez votre premier contact partenaire.')+'</p>'+(q?'': '<button class="btn btn-accent" onclick="openAddContact()">+ Nouveau contact</button>')+'</div>';
    return;
  }
  container.innerHTML = `<div class="grid grid-5" style="gap:.75rem">${contacts.map(c => {
    const col = contactColor(c.organisme);
    const initiale = (c.organisme||'?')[0].toUpperCase();
    return `<div style="cursor:pointer;background:#fff;border:1px solid #cbd5e1;border-radius:16px;padding:1.5rem 1.25rem;text-align:center;transition:box-shadow .2s,transform .2s;display:flex;flex-direction:column;align-items:center;gap:.5rem" onmouseenter="this.style.boxShadow='0 4px 12px rgba(0,0,0,.1)';this.style.transform='translateY(-2px)'" onmouseleave="this.style.boxShadow='none';this.style.transform='none'" onclick="openEditContact('${c.id}')">
      <div style="font-weight:700;font-size:.95rem;color:${col};border:2px solid ${col}66;border-radius:8px;padding:.2rem .75rem;display:inline-block">${escHtml(c.organisme)}</div>
      <div style="font-size:.82rem;color:var(--muted)">${escHtml(c.nom)}${c.fonction ? ' · '+escHtml(c.fonction) : ''}</div>
      <div style="font-size:.75rem;color:var(--muted);display:flex;align-items:center;justify-content:center;gap:.5rem;flex-wrap:wrap">
        ${c.tel ? `<span>📞 ${escHtml(c.tel)}</span>` : ''}
        ${c.email ? `<span>✉️ ${escHtml(c.email)}</span>` : ''}
      </div>
      ${c.adresse ? `<div style="font-size:.7rem;color:#94a3b8">${escHtml(c.adresse).slice(0,40)+(c.adresse.length>40?'…':'')}</div>` : ''}
    </div>`;
  }).join('')}</div>`;
}

function initialsOrg(name) {
  return (name||'?').split(' ').map(w=>w[0]).filter(Boolean).slice(0,2).join('').toUpperCase() || '?';
}

function openAddContact() {
  editingContactId = null;
  document.getElementById('modalContactTitle').textContent = 'Nouveau contact';
  document.getElementById('contactId').value = '';
  document.getElementById('cOrganisme').value = '';
  document.getElementById('cNom').value = '';
  document.getElementById('cTel').value = '';
  document.getElementById('cEmail').value = '';
  document.getElementById('cFonction').value = '';
  document.getElementById('cAdresse').value = '';
  document.getElementById('cNotes').value = '';
  document.getElementById('btnDeleteContact').style.display = 'none';
  openModal('modalContact');
}

function openEditContact(id) {
  const contacts = getContacts();
  const c = contacts.find(x => x.id === id);
  if (!c) return;
  editingContactId = id;
  document.getElementById('modalContactTitle').textContent = 'Modifier le contact';
  document.getElementById('contactId').value = id;
  document.getElementById('cOrganisme').value = c.organisme || '';
  document.getElementById('cNom').value = c.nom || '';
  document.getElementById('cTel').value = c.tel || '';
  document.getElementById('cEmail').value = c.email || '';
  document.getElementById('cFonction').value = c.fonction || '';
  document.getElementById('cAdresse').value = c.adresse || '';
  document.getElementById('cNotes').value = c.notes || '';
  document.getElementById('btnDeleteContact').style.display = '';
  openModal('modalContact');
}

async function saveContact() {
  const organisme = document.getElementById('cOrganisme').value.trim();
  const nom = document.getElementById('cNom').value.trim();
  if (!organisme || !nom) { toast('Organisme et nom du contact requis', 'error'); return; }

  const data = {
    organisme,
    nom,
    tel: document.getElementById('cTel').value.trim(),
    email: document.getElementById('cEmail').value.trim(),
    fonction: document.getElementById('cFonction').value.trim(),
    adresse: document.getElementById('cAdresse').value.trim(),
    notes: document.getElementById('cNotes').value.trim()
  };

  try {
    if (editingContactId) {
      const old = _repCache.find(x => x.id === editingContactId) || {};
      const saved = await sbSaveRepertoire({ ...old, ...data, id: editingContactId });
      _repCache = _repCache.map(x => x.id === editingContactId ? saved : x);
      toast('Contact modifié', 'success');
    } else {
      const saved = await sbSaveRepertoire(data);
      _repCache.push(saved);
      toast('Contact ajouté', 'success');
    }
  } catch (e) { console.error('[saveContact]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
  closeAllModals();
  renderContacts();
}

function deleteContact() {
  if (!editingContactId || !confirm('Supprimer ce contact ?')) return;
  const id = editingContactId;
  (async () => {
    try { await sbDeleteRepertoire(id); _repCache = _repCache.filter(x => x.id !== id); }
    catch (e) { console.error('[deleteContact]', e); toast('Erreur suppression : ' + (e?.message || e), 'error'); return; }
    closeAllModals();
    toast('Contact supprimé', 'success');
    renderContacts();
  })();
}

document.addEventListener('DOMContentLoaded', async () => { if (requireModule('access_repertoire')) { await loadRepertoireCache(); renderContacts(); } });
if (typeof registerPageInit === 'function') registerPageInit('repertoire', async () => { await loadRepertoireCache(); renderContacts(); });
