const ADM_STATUT_LABELS = {
  en_attente: 'En attente',
  etude: 'En étude',
  admis: 'Admis',
  refuse: 'Refusé',
  abandon: 'Désistement'
};
const ADM_STATUT_COLORS = {
  en_attente: '#d97706',
  etude: '#0284c7',
  admis: '#16a34a',
  refuse: '#dc2626',
  abandon: '#6b7280'
};

// Source = Supabase. Cache mémoire chargé au démarrage.
let _admCache = [];
function getAdmissions() { return _admCache; }
async function loadAdmissionsCache() { _admCache = await sbGetAdmissions(); }

function openAdmissionModal(id) {
  const isAdmin = Auth.isAdmin();
  document.getElementById('admModalTitle').textContent = id ? '📥 Modifier la demande' : '📥 Nouvelle demande d\'admission';
  document.getElementById('admDeleteBtn').style.display = (id && isAdmin) ? '' : 'none';
  document.getElementById('admDeleteBtn').dataset.id = id || '';
  document.getElementById('modalAdmission').dataset.id = id || '';

  if (id) {
    const a = getAdmissions().find(x => x.id === id);
    if (!a) return;
    document.getElementById('admFormPrenom').value = a.prenom || '';
    document.getElementById('admFormNom').value = a.nom || '';
    document.getElementById('admFormDateNaissance').value = a.dateNaissance || '';
    document.getElementById('admFormDateDemande').value = a.dateDemande || '';
    document.getElementById('admFormOrigine').value = a.origine || 'MDPH';
    document.getElementById('admFormStatut').value = a.statut || 'en_attente';
    document.getElementById('admFormDateEntree').value = a.dateEntree || '';
    document.getElementById('admFormDossier').value = a.dossier || '';
    document.getElementById('admFormContactNom').value = a.contactNom || '';
    document.getElementById('admFormContactTel').value = a.contactTel || '';
    document.getElementById('admFormNotes').value = a.notes || '';
  } else {
    document.getElementById('admFormPrenom').value = '';
    document.getElementById('admFormNom').value = '';
    document.getElementById('admFormDateNaissance').value = '';
    document.getElementById('admFormDateDemande').value = today();
    document.getElementById('admFormOrigine').value = 'MDPH';
    document.getElementById('admFormStatut').value = 'en_attente';
    document.getElementById('admFormDateEntree').value = '';
    document.getElementById('admFormDossier').value = '';
    document.getElementById('admFormContactNom').value = '';
    document.getElementById('admFormContactTel').value = '';
    document.getElementById('admFormNotes').value = '';
  }
  openModal('modalAdmission');
}

async function saveAdmission() {
  const prenom = document.getElementById('admFormPrenom').value.trim();
  const nom = document.getElementById('admFormNom').value.trim();
  if (!prenom && !nom) { toast('Le nom ou prénom est requis', 'error'); return; }

  const data = {
    prenom, nom,
    dateNaissance: document.getElementById('admFormDateNaissance').value,
    dateDemande: document.getElementById('admFormDateDemande').value,
    dateEntree: document.getElementById('admFormDateEntree').value,
    dossier: document.getElementById('admFormDossier').value.trim(),
    origine: document.getElementById('admFormOrigine').value,
    statut: document.getElementById('admFormStatut').value,
    contactNom: document.getElementById('admFormContactNom').value.trim(),
    contactTel: document.getElementById('admFormContactTel').value.trim(),
    notes: document.getElementById('admFormNotes').value.trim()
  };

  const id = document.getElementById('modalAdmission').dataset.id;
  try {
    if (id) {
      const old = _admCache.find(a => a.id === id) || {};
      const saved = await sbSaveAdmission({ ...old, ...data, id });
      _admCache = _admCache.map(a => a.id === id ? saved : a);
      toast('Demande mise à jour');
      if (typeof auditLog === 'function') auditLog('admission_update', `${prenom} ${nom}`);
    } else {
      const saved = await sbSaveAdmission(data);
      _admCache.push(saved);
      toast('Demande ajoutée');
      if (typeof auditLog === 'function') auditLog('admission_create', `${prenom} ${nom}`);
    }
  } catch (e) { console.error('[saveAdmission]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
  closeModal('modalAdmission');
  renderAdmissions();
}

function supprimerAdmission(id) {
  id = id || document.getElementById('admDeleteBtn').dataset.id;
  if (!id) return;
  if (!confirm('Supprimer cette demande ?')) return;
  const a = _admCache.find(x => x.id === id);
  (async () => {
    try { await sbDeleteAdmission(id); _admCache = _admCache.filter(x => x.id !== id); }
    catch (e) { console.error('[supprimerAdmission]', e); toast('Erreur suppression : ' + (e?.message || e), 'error'); return; }
    if (typeof auditLog === 'function' && a) auditLog('admission_delete', `${a.prenom} ${a.nom}`);
    toast('Demande supprimée', 'info');
    closeModal('modalAdmission');
    renderAdmissions();
  })();
}

async function admettreCandidat(id) {
  const list = getAdmissions();
  const a = list.find(x => x.id === id);
  if (!a) return;
  if (!confirm(`Admettre ${a.prenom} ${a.nom} comme résident ?`)) return;

  // Lecture depuis Supabase (uniquement pour choisir une couleur d'avatar)
  const residents = await sbGetResidents();
  const colors = ['#3b82f6', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0d9488', '#db2777'];
  // Pas de champ id : Supabase génère l'identifiant (insert)
  const resident = {
    nom: a.nom, prenom: a.prenom, photo: null,
    dob: a.dateNaissance || '',
    genre: '', entree: a.dateEntree || today(),
    statut: 'permanent', chambre: '', referent: '',
    color: colors[residents.length % colors.length],
    notes: a.notes || '', contacts: a.contactNom ? `${a.contactNom}${a.contactTel ? ' — ' + a.contactTel : ''}` : '',
    objectifs: [], medecin: '', medecinTel: '', allergies: '', nss: '', ins: '',
    dmp: '', dmpDate: '', consent: '', consentDate: '',
    tuteur: '', tuteurTel: '', ecole: '', classe: '',
    organisme: a.origine || '', dossier: '', situationPro: '', ressources: '',
    organismeA: '', dossierA: '', situationAdmin: '', protection: ''
  };
  let saved;
  try {
    saved = await sbSaveResident(resident);
  } catch (e) {
    console.error(e);
    toast('Erreur lors de la création de la fiche résident', 'error');
    return;
  }

  try {
    const saved2 = await sbSaveAdmission({ ...a, statut: 'admis', dateDecision: today(), residentId: saved.id });
    _admCache = _admCache.map(x => x.id === id ? saved2 : x);
  } catch (e) { console.error('[admettreCandidat]', e); toast('Fiche créée mais erreur de mise à jour de la demande', 'error'); }

  if (typeof auditLog === 'function') auditLog('admission_admis', `${a.prenom} ${a.nom}`);
  toast(`${a.prenom} ${a.nom} admis(e) — fiche résident créée`, 'success');
  renderAdmissions();
}

function admissionItemHtml(a, isAdmin) {
  const color = ADM_STATUT_COLORS[a.statut] || '#6b7280';
  const label = ADM_STATUT_LABELS[a.statut] || a.statut;
  return `<div style="display:flex;align-items:center;gap:.75rem;padding:.85rem 1rem;background:#fff;border-radius:10px;margin-bottom:6px;box-shadow:0 2px 6px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04);cursor:pointer" onclick="openAdmissionModal('${a.id}')">
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
        <span style="font-weight:600;font-size:.85rem">${escHtml(a.prenom)} ${escHtml(a.nom)}</span>
        <span class="badge" style="background:${color}20;color:${color}">${escHtml(label)}</span>
      </div>
      <div style="font-size:.74rem;color:var(--muted);margin-top:.2rem">
        ${a.dateNaissance ? 'Né(e) le ' + formatDate(a.dateNaissance) + ' · ' : ''}Orientation : ${escHtml(a.origine || '—')}${a.dateDemande ? ' · Demande du ' + formatDate(a.dateDemande) : ''}
        ${a.dateEntree ? ' · <span style="color:#16a34a;font-weight:600">Entrée prévue : ' + formatDate(a.dateEntree) + '</span>' : ''}
        ${a.dossier ? ' · Dossier : ' + escHtml(a.dossier) : ''}
        ${a.contactNom ? ' · Contact : ' + escHtml(a.contactNom) + (a.contactTel ? ' (' + escHtml(a.contactTel) + ')' : '') : ''}
      </div>
      ${a.notes ? `<div style="font-size:.74rem;color:var(--muted);margin-top:.2rem">${escHtml(a.notes)}</div>` : ''}
    </div>
    <div style="display:flex;gap:.25rem;flex-shrink:0" onclick="event.stopPropagation()">
      ${isAdmin && a.statut !== 'admis' ? `<button class="btn btn-outline btn-sm" onclick="admettreCandidat('${a.id}')">✓ Admettre</button>` : ''}
    </div>
  </div>`;
}

function renderAdmissions() {
  const isAdmin = Auth.isAdmin();
  const list = getAdmissions();
  const q = (document.getElementById('admSearch')?.value || '').trim().toLowerCase();
  const statut = document.getElementById('admFiltreStatut')?.value || '';

  document.getElementById('admStatEnAttente').textContent = list.filter(a => a.statut === 'en_attente').length;
  document.getElementById('admStatEtude').textContent = list.filter(a => a.statut === 'etude').length;
  document.getElementById('admStatAdmis').textContent = list.filter(a => a.statut === 'admis').length;
  document.getElementById('admStatTotal').textContent = list.length;

  let filtered = list;
  if (q) filtered = filtered.filter(a => `${a.prenom} ${a.nom}`.toLowerCase().includes(q));
  if (statut) filtered = filtered.filter(a => a.statut === statut);

  const el = document.getElementById('admList');
  if (!filtered.length) {
    el.innerHTML = '<div class="empty" style="padding:3rem;text-align:center"><p>Aucune demande d\'admission</p></div>';
    return;
  }
  el.innerHTML = filtered
    .sort((a, b) => (b.dateDemande || '').localeCompare(a.dateDemande || ''))
    .map(a => admissionItemHtml(a, isAdmin)).join('');
}

document.addEventListener('DOMContentLoaded', async () => { if (requireModule('access_admissions')) { await loadAdmissionsCache(); renderAdmissions(); } });
if (typeof registerPageInit === 'function') registerPageInit('admissions', async () => { await loadAdmissionsCache(); renderAdmissions(); });
