const CE_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];
const CE_TYPES = {
  vacataire: 'Vacataire',
  intervenant: 'Intervenant',
  benevole: 'Bénévole',
  prestataire: 'Prestataire',
  autre: 'Autre'
};

// Source = Supabase. Cache mémoire chargé au démarrage.
let _ceCache = [];
function getContactsExternes() { return _ceCache; }
async function loadContactsExternesCache() { _ceCache = await sbGetContactsExternes(); }

function ceColor(type) {
  let h = 0; const s = type || 'autre';
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return CE_COLORS[h % CE_COLORS.length];
}

function ceCardVars(hex) {
  const r = parseInt(hex.slice(1,3),16)||99, g = parseInt(hex.slice(3,5),16)||102, b = parseInt(hex.slice(5,7),16)||241;
  return `--accent:${hex};--accent-text:${hex};--accent-hover:rgba(${r},${g},${b},.06);--avatar-a:rgba(${r},${g},${b},.45);--avatar-b:${hex}`;
}

let ceEditId = null;

function renderContactsExternes() {
  const all = getContactsExternes().sort((a,b) => (a.nom||'').localeCompare(b.nom||''));
  const q = (document.getElementById('ceSearch')?.value || '').trim().toLowerCase();
  const list = q
    ? all.filter(c =>
        (c.prenom+' '+c.nom).toLowerCase().includes(q) ||
        (c.fonction+'').toLowerCase().includes(q) ||
        (CE_TYPES[c.type]||'').toLowerCase().includes(q) ||
        (c.telephone+'').includes(q) ||
        (c.email+'').toLowerCase().includes(q)
      )
    : all;

  const countEl = document.getElementById('ceCount');
  if (countEl) countEl.textContent = q ? list.length+'/'+all.length+' contacts' : list.length+' contact'+(list.length>1?'s':'');

  const container = document.getElementById('ceList');
  if (!list.length) {
    container.innerHTML = `<div class="empty"><h3>${q?'Aucun résultat':'Aucun contact'}</h3><p>${q?'Aucun contact ne correspond à votre recherche.':'Ajoutez vos vacataires, intervenants et autres contacts ponctuels.'}</p></div>`;
    return;
  }

  container.innerHTML = `<div class="ce-cards-grid">${list.map(c => {
    const hex = ceColor(c.type);
    const vars = ceCardVars(hex);
    const initiales = (((c.prenom||'')[0]||'') + ((c.nom||'')[0]||'')).toUpperCase();
    const nom = `${c.prenom||''} ${c.nom||''}`.trim();
    return `<div class="card-c" style="${vars}">
      <div class="c-banner">
        <div class="c-watermark">${escHtml(initiales)}</div>
        <div class="c-head">
          <div class="c-avatar">${escHtml(initiales)}</div>
          <div>
            <p class="c-name">${escHtml(nom)}</p>
            <span class="c-role-badge">${escHtml(c.fonction || CE_TYPES[c.type] || 'Sans fonction')}</span>
          </div>
        </div>
      </div>
      <div class="c-body">
        <span class="c-status" style="color:${hex};background-color:${hex}18">${CE_TYPES[c.type] || 'Autre'}</span>
        <div class="c-info">
          <div class="row-field"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span class="${!c.telephone?'empty':''}">${c.telephone?escHtml(c.telephone):'—'}</span></div>
          <div class="row-field"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg><span class="${!c.email?'empty':''}">${c.email?escHtml(c.email):'—'}</span></div>
          ${c.notes ? `<div class="row-field" style="align-items:flex-start"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top:2px;flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span style="white-space:normal;word-break:break-word">${escHtml(c.notes)}</span></div>` : ''}
        </div>
        <div class="c-actions">
          ${c.email ? `<a href="mailto:${escHtml(c.email)}" title="Envoyer un email" class="c-action-icon" style="color:var(--muted);display:flex"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6 12 13 2 6"/></svg></a>` : `<span style="color:#d1d5db;display:flex"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6 12 13 2 6"/></svg></span>`}
          ${c.telephone ? `<a href="tel:${escHtml(c.telephone)}" title="Appeler" class="c-action-icon" style="color:var(--muted);display:flex"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></a>` : `<span style="color:#d1d5db;display:flex"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></span>`}
          <button onclick="deleteContactExterneCard('${c.id}','${escHtml(nom)}')" title="Supprimer" class="c-action-icon" style="color:var(--muted);background:none;border:none;cursor:pointer;display:flex"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
        </div>
        <button class="c-btn" onclick="openCeModal('${c.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg> Modifier</button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function openCeModal(id) {
  ceEditId = id || null;
  const c = id ? getContactsExternes().find(x => x.id === id) : null;
  document.getElementById('ceModalTitle').textContent = c ? 'Modifier le contact' : 'Nouveau contact';
  document.getElementById('ceId').value = id || '';
  document.getElementById('cePrenom').value = c?.prenom || '';
  document.getElementById('ceNom').value = c?.nom || '';
  document.getElementById('ceType').value = c?.type || 'vacataire';
  document.getElementById('ceFonction').value = c?.fonction || '';
  document.getElementById('ceTel').value = c?.telephone || '';
  document.getElementById('ceEmail').value = c?.email || '';
  document.getElementById('ceNotes').value = c?.notes || '';
  document.getElementById('ceBtnDelete').style.display = c ? '' : 'none';
  openModal('modalContactExterne');
}

async function saveContactExterne() {
  const prenom = document.getElementById('cePrenom').value.trim();
  const nom = document.getElementById('ceNom').value.trim();
  if (!prenom || !nom) { toast('Prénom et nom requis', 'error'); return; }
  const data = {
    prenom, nom,
    type: document.getElementById('ceType').value,
    fonction: document.getElementById('ceFonction').value.trim(),
    telephone: document.getElementById('ceTel').value.trim(),
    email: document.getElementById('ceEmail').value.trim(),
    notes: document.getElementById('ceNotes').value.trim()
  };
  try {
    if (ceEditId) {
      const old = _ceCache.find(c => c.id === ceEditId) || {};
      const saved = await sbSaveContactExterne({ ...old, ...data, id: ceEditId });
      _ceCache = _ceCache.map(c => c.id === ceEditId ? saved : c);
      toast('Contact mis à jour', 'success');
    } else {
      const saved = await sbSaveContactExterne(data);
      _ceCache.push(saved);
      toast('Contact ajouté ✓', 'success');
    }
  } catch (e) { console.error('[saveContactExterne]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
  if (typeof auditLog === 'function') auditLog('contact_externe_save', `${prenom} ${nom}`);
  closeModal('modalContactExterne');
  renderContactsExternes();
}

function deleteContactExterne() {
  const id = document.getElementById('ceId').value;
  if (!id) return;
  deleteContactExterneCard(id);
  closeModal('modalContactExterne');
}

function deleteContactExterneCard(id, nom) {
  if (!confirm(`Supprimer ${nom || 'ce contact'} ?`)) return;
  (async () => {
    try { await sbDeleteContactExterne(id); _ceCache = _ceCache.filter(c => c.id !== id); }
    catch (e) { console.error('[deleteContactExterneCard]', e); toast('Erreur suppression : ' + (e?.message || e), 'error'); return; }
    toast('Contact supprimé', 'info');
    renderContactsExternes();
  })();
}

function seedDemoContactsExternes() {
  const demo = [
    { prenom:'Camille', nom:'Roussel', type:'vacataire', fonction:'Animatrice sportive', telephone:'06 12 34 56 78', email:'camille.roussel@example.fr', notes:'Disponible les mercredis après-midi' },
    { prenom:'Karim', nom:'Benali', type:'intervenant', fonction:'Psychologue', telephone:'06 23 45 67 89', email:'karim.benali@example.fr', notes:'Suivi individuel, sur RDV uniquement' },
    { prenom:'Élodie', nom:'Mercier', type:'benevole', fonction:'Soutien scolaire', telephone:'06 34 56 78 90', email:'elodie.mercier@example.fr', notes:'Vient deux soirs par semaine' },
    { prenom:'Thomas', nom:'Lefebvre', type:'prestataire', fonction:'Maintenance informatique', telephone:'06 45 67 89 01', email:'contact@tlinformatique.fr', notes:'Intervention sous 48h en cas de panne' },
    { prenom:'Nadia', nom:'Cherif', type:'vacataire', fonction:'Atelier cuisine', telephone:'06 56 78 90 12', email:'nadia.cherif@example.fr', notes:'' },
    { prenom:'Julien', nom:'Faure', type:'intervenant', fonction:'Éducateur sportif', telephone:'06 67 89 01 23', email:'julien.faure@example.fr', notes:'Spécialisé activités de plein air' },
    { prenom:'Sophie', nom:'Marchand', type:'benevole', fonction:'Bibliothèque / lecture', telephone:'06 78 90 12 34', email:'sophie.marchand@example.fr', notes:'' },
    { prenom:'Mehdi', nom:'Ouahabi', type:'prestataire', fonction:'Entretien des espaces verts', telephone:'06 89 01 23 45', email:'contact@espacesverts-mo.fr', notes:'Passage chaque vendredi matin' },
    { prenom:'Laura', nom:'Petit', type:'autre', fonction:'Médiatrice familiale', telephone:'06 90 12 34 56', email:'laura.petit@example.fr', notes:'' },
    { prenom:'Yann', nom:'Le Goff', type:'vacataire', fonction:'Atelier théâtre', telephone:'06 01 23 45 67', email:'yann.legoff@example.fr', notes:'Intervient une fois par mois' }
  ];
  // Données de démo désactivées : la base de prod doit rester sans données fictives.
  void demo;
  toast('Ajout de contacts de démo désactivé (base de production)', 'info');
}

document.addEventListener('DOMContentLoaded', async () => { await loadContactsExternesCache(); renderContactsExternes(); });
if (typeof registerPageInit === 'function') registerPageInit('contacts-externes', async () => { await loadContactsExternesCache(); renderContactsExternes(); });
