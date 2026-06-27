// ── RECRUTEMENT — pipeline candidats (Supabase) ──
const RC_STATUTS = [
  { id:'recu',              label:'Reçu',               color:'#6366f1' },
  { id:'entretien_planifie',label:'Entretien planifié', color:'#d97706' },
  { id:'entretien_fait',    label:'Entretien réalisé',  color:'#0891b2' },
  { id:'accepte',           label:'Accepté',            color:'#16a34a' },
  { id:'refuse',            label:'Refusé',             color:'#dc2626' }
];
const RC_COLONNES = ['recu','entretien_planifie','entretien_fait','accepte'];

let rcEditId = null;
let _rcCache = [];

function getCandidats()      { return _rcCache; }
function rcIsCanEdit()       { return Auth.isAdmin() || (typeof canEditResidents === 'function' && canEditResidents(Auth.getSession()?.userId)); }
function rcStatutInfo(id)    { return RC_STATUTS.find(s => s.id === id) || RC_STATUTS[0]; }

// Remplit un <select> avec les postes de référence (fonctions définies en Admin),
// en conservant le poste déjà saisi même s'il n'est pas dans la liste.
function rcFillPosteSelect(selectEl, currentPoste) {
  const fonctions = DB.get(DB.keys.fonctionColors) || [];
  const noms = fonctions.map(f => f.fonction);
  const poste = currentPoste || '';
  if (poste && !noms.includes(poste)) noms.unshift(poste);
  selectEl.innerHTML = '<option value="">— Sélectionner un poste —</option>'
    + noms.map(n => `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join('');
  selectEl.value = poste;
}

function renderRecrutement() {
  const all = getCandidats();

  document.getElementById('rcStats').innerHTML = `
    <div class="chx-stat" style="--c:#2563eb"><div class="chx-stat-top"><span class="chx-stat-lbl">Candidatures reçues</span></div><div class="chx-stat-num">${all.length}</div></div>
    <div class="chx-stat" style="--c:#e85d04"><div class="chx-stat-top"><span class="chx-stat-lbl">Entretiens planifiés</span></div><div class="chx-stat-num">${all.filter(c=>c.statut==='entretien_planifie').length}</div></div>
    <div class="chx-stat" style="--c:#16a34a"><div class="chx-stat-top"><span class="chx-stat-lbl">Acceptés</span></div><div class="chx-stat-num">${all.filter(c=>c.statut==='accepte').length}</div></div>
    <div class="chx-stat" style="--c:#ef4444"><div class="chx-stat-top"><span class="chx-stat-lbl">Refusés</span></div><div class="chx-stat-num">${all.filter(c=>c.statut==='refuse').length}</div></div>`;

  const board = document.getElementById('rcBoard');
  board.innerHTML = RC_COLONNES.map(colId => {
    const st = rcStatutInfo(colId);
    const items = all.filter(c => (c.statut||'recu') === colId).sort((a,b) => (b.date||'').localeCompare(a.date||''));
    return `<div>
      <div class="rc-col-head" style="color:${st.color}"><span style="width:8px;height:8px;border-radius:50%;background:${st.color}"></span>${st.label} (${items.length})</div>
      <div class="rc-col-body">
        ${items.map(c => rcCard(c, st.color)).join('') || `<div style="font-size:.74rem;color:var(--muted);font-style:italic;padding:.5rem .25rem">Aucun candidat</div>`}
      </div>
    </div>`;
  }).join('');
}

function rcCard(c, color) {
  const nom = `${c.prenom||''} ${nomMaj(c.nom)}`.trim();
  const nextStatut = RC_COLONNES[RC_COLONNES.indexOf(c.statut) + 1];
  return `<div style="background:#fff;border-radius:12px;border:1px solid var(--border);border-left:3px solid ${color};padding:.7rem .85rem;box-shadow:0 2px 8px rgba(15,23,42,.05)">
    <div style="font-weight:700;font-size:.85rem">${escHtml(nom)}</div>
    <div style="font-size:.74rem;color:var(--muted);margin:.15rem 0 .35rem">${escHtml(c.poste||'')}</div>
    ${c.dateEntretien?`<div style="font-size:.72rem;color:#d97706;margin-bottom:.3rem">📅 Entretien ${formatDate(c.dateEntretien)}</div>`:''}
    ${c.notes?`<div style="font-size:.72rem;color:var(--g600);margin-bottom:.4rem;line-height:1.4">${escHtml(c.notes.slice(0,90))}${c.notes.length>90?'…':''}</div>`:''}
    <div style="display:flex;gap:.3rem;justify-content:flex-end;flex-wrap:wrap">
      ${nextStatut && c.statut!=='refuse' ? `<button class="btn btn-ghost btn-sm" style="font-size:.7rem;color:#16a34a" onclick="rcSetStatut('${c.id}','${nextStatut}')">→ ${rcStatutInfo(nextStatut).label}</button>` : ''}
      ${c.statut!=='refuse' && c.statut!=='accepte' ? `<button class="btn btn-ghost btn-sm" style="font-size:.7rem;color:#dc2626" onclick="rcSetStatut('${c.id}','refuse')">✕ Refuser</button>` : ''}
      <button class="btn btn-ghost btn-sm" style="font-size:.7rem" onclick="openCandidatModal('${c.id}')">✎</button>
    </div>
    ${c.statut==='accepte' ? (
      c._compteCree
        ? `<div style="margin-top:.5rem;padding:.45rem .55rem;background:#f0fdf4;border-radius:6px;font-size:.7rem;color:#16a34a">✅ Compte de connexion créé</div>`
        : (Auth.isAdmin()
            ? `<button class="btn btn-primary btn-sm" style="margin-top:.55rem;width:100%;font-size:.72rem" onclick="rcCreateCompte('${c.id}')">🔑 Créer son compte utilisateur</button>`
            : `<div style="margin-top:.5rem;padding:.45rem .55rem;background:#f0fdf4;border-radius:6px;font-size:.7rem;color:#16a34a">✓ Créez sa fiche depuis <a href="admin.html" style="color:#16a34a;text-decoration:underline">Administration → Utilisateurs</a></div>`)
      ) : ''}
  </div>`;
}

// Mot de passe temporaire (identique à la logique de la page Admin)
function genPassword(len = 10) {
  const c = 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  return Array.from({ length: len }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

function rcCreateCompte(id) {
  const c = _rcCache.find(x => x.id === id);
  if (!c) return;
  document.getElementById('rcCompteCandId').value = id;
  document.getElementById('rcComptePrenom').value = c.prenom || '';
  document.getElementById('rcCompteNom').value    = c.nom || '';
  document.getElementById('rcCompteEmail').value  = c.email || '';
  rcFillPosteSelect(document.getElementById('rcComptePoste'), c.poste || '');
  document.getElementById('rcCompteRole').value   = 'educateur';
  const result = document.getElementById('rcCompteResult');
  result.style.display = 'none';
  result.innerHTML = '';
  document.getElementById('rcCompteBtn').disabled = false;
  openModal('modalRcCompte');
}

// Crée la fiche salarié + le compte de connexion (Edge Function create-user), puis les relie.
async function rcSaveCompte() {
  const id     = document.getElementById('rcCompteCandId').value;
  const c      = _rcCache.find(x => x.id === id);
  const prenom = document.getElementById('rcComptePrenom').value.trim();
  const nom    = document.getElementById('rcCompteNom').value.trim();
  const email  = document.getElementById('rcCompteEmail').value.trim();
  const poste  = document.getElementById('rcComptePoste').value.trim();
  const role   = document.getElementById('rcCompteRole').value || 'educateur';
  if (!prenom || !nom) { toast('Prénom et nom requis', 'error'); return; }
  if (!email)          { toast('Un email est requis pour créer le compte', 'error'); return; }

  const result = document.getElementById('rcCompteResult');
  const btn    = document.getElementById('rcCompteBtn');
  btn.disabled = true;
  result.style.display = '';
  result.innerHTML = '⏳ Création de la fiche et du compte…';
  const pw = genPassword();
  try {
    // 1. Compte de connexion d'abord (échoue tôt si l'email est déjà pris → pas de fiche orpheline)
    const { data, error } = await supabaseClient.functions.invoke('create-user', {
      body: { email, password: pw, prenom, nom, fonction: poste, role }
    });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || 'Échec de la création du compte');

    // 2. Fiche salarié, directement reliée au compte
    await sbSaveEmploye({
      prenom, nom, poste, email,
      telephone: c?.tel || '',
      statut: 'actif',
      dateEmbauche: today(),
      profileId: data.userId
    });

    if (c) c._compteCree = true;
    result.innerHTML = `✅ Compte créé pour <strong>${escHtml(prenom)} ${escHtml(nom)}</strong><br>
      Identifiant : <strong>${escHtml(email)}</strong><br>
      Mot de passe : <strong>${pw}</strong><br>
      <span style="opacity:.7">Notez-le : il devra le changer à la 1ʳᵉ connexion. Masqué à la fermeture.</span>`;
    toast('Fiche salarié + compte créés ✓', 'success');
    renderRecrutement();
  } catch (e) {
    let msg = e?.message || e?.error || JSON.stringify(e) || 'Erreur inconnue';
    if (/already been registered|already registered|already exists/i.test(msg)) {
      msg = 'Cet email a déjà un compte. Utilisez une autre adresse.';
    }
    result.innerHTML = `<span style="color:#dc2626">❌ ${escHtml(msg)}</span>`;
    toast('Erreur : ' + msg, 'error');
    console.error('[rcSaveCompte]', e);
  } finally {
    btn.disabled = false;
  }
}

async function rcSetStatut(id, statut) {
  const c = _rcCache.find(x => x.id === id);
  if (!c) return;
  const prev = c.statut;
  c.statut = statut;
  renderRecrutement();
  try {
    await sbSaveCandidat(c);
    toast(`Candidat → ${rcStatutInfo(statut).label}`);
  } catch (e) {
    console.error('[rcSetStatut]', e);
    c.statut = prev;
    renderRecrutement();
    toast('Erreur enregistrement : ' + (e?.message || e), 'error');
  }
}

function openCandidatModal(id) {
  rcEditId = id || null;
  const c = id ? _rcCache.find(x => x.id === id) : null;
  document.getElementById('rcModalTitle').textContent = c ? 'Modifier le candidat' : 'Nouveau candidat';
  document.getElementById('rcPrenom').value = c?.prenom || '';
  document.getElementById('rcNom').value    = c?.nom || '';
  rcFillPosteSelect(document.getElementById('rcPoste'), c?.poste || '');
  document.getElementById('rcTel').value    = c?.tel || '';
  document.getElementById('rcEmail').value  = c?.email || '';
  document.getElementById('rcDate').value   = c?.date || today();
  document.getElementById('rcDateEntretien').value = c?.dateEntretien || '';
  document.getElementById('rcNotes').value  = c?.notes || '';
  document.getElementById('rcDeleteBtn').style.display = c ? '' : 'none';
  openModal('modalCandidat');
}

async function saveCandidat() {
  const prenom = document.getElementById('rcPrenom').value.trim();
  const nom    = document.getElementById('rcNom').value.trim();
  const poste  = document.getElementById('rcPoste').value.trim();
  if (!prenom || !nom || !poste) { toast('Prénom, nom et poste obligatoires', 'error'); return; }

  const data = {
    prenom, nom, poste,
    tel: document.getElementById('rcTel').value.trim(),
    email: document.getElementById('rcEmail').value.trim(),
    date: document.getElementById('rcDate').value || today(),
    dateEntretien: document.getElementById('rcDateEntretien').value,
    notes: document.getElementById('rcNotes').value.trim()
  };

  try {
    if (rcEditId) {
      const existing = _rcCache.find(x => x.id === rcEditId) || {};
      const saved = await sbSaveCandidat({ ...existing, ...data, id: rcEditId });
      const idx = _rcCache.findIndex(x => x.id === rcEditId);
      if (idx >= 0) _rcCache[idx] = saved;
      toast('Candidat mis à jour');
    } else {
      const saved = await sbSaveCandidat({ ...data, statut: 'recu' });
      _rcCache.unshift(saved);
      toast('Candidat ajouté ✓', 'success');
    }
    closeModal('modalCandidat');
    renderRecrutement();
  } catch (e) {
    console.error('[saveCandidat]', e);
    toast('Erreur enregistrement : ' + (e?.message || e), 'error');
  }
}

function deleteCandidat() {
  if (!rcEditId) return;
  confirmDialog('Supprimer ce candidat ?', async () => {
    const id = rcEditId;
    try {
      await sbDeleteCandidat(id);
      _rcCache = _rcCache.filter(x => x.id !== id);
      closeModal('modalCandidat');
      renderRecrutement();
      toast('Candidat supprimé', 'info');
    } catch (e) {
      console.error('[deleteCandidat]', e);
      toast('Erreur suppression : ' + (e?.message || e), 'error');
    }
  });
}

async function initRecrutement() {
  const s = Auth.requireAuth();
  if (!s) return;
  if (!rcIsCanEdit()) { const b = document.getElementById('btnAddCandidat'); if (b) b.style.display = 'none'; }
  try {
    _rcCache = await sbGetCandidats();
  } catch (e) {
    console.error('[initRecrutement]', e);
    toast('Erreur chargement candidats', 'error');
  }
  renderRecrutement();
}
document.addEventListener('DOMContentLoaded', initRecrutement);
