// ── CAHIER DE NUIT & ASTREINTE ──
// Une fiche par nuit (datée du soir) : rondes, événements nocturnes, appels à l'astreinte, transmission du matin
let nuitDate = null;
let nuitEvtEditId = null;

const NUIT_AMBIANCES = {
  calme: { label: 'Nuit calme', color: '#16a34a' },
  agitee: { label: 'Nuit agitée', color: '#d97706' },
  tres_agitee: { label: 'Nuit très agitée', color: '#dc2626' }
};
const NUIT_EVT_TYPES = {
  reveil: { label: 'Réveil / insomnie', icon: '😴' },
  angoisse: { label: 'Angoisse / crise', icon: '😰' },
  soin: { label: 'Soin / santé', icon: '🩺' },
  conflit: { label: 'Conflit / agitation', icon: '⚡' },
  fugue: { label: 'Absence / fugue', icon: '🚨' },
  retour: { label: 'Retour tardif', icon: '🌙' },
  autre: { label: 'Autre', icon: '📌' }
};

// Source = Supabase. Cache mémoire chargé au démarrage.
let _nuitCache = [];
function getNuits() { return _nuitCache; }
async function loadNuitsCache() { _nuitCache = await sbGetNuits(); }
function getNuit(date) { return getNuits().find(n => n.date === date) || null; }
// Persiste une nuit précise (remonte une erreur via toast)
function persistNuit(n) {
  if (!n || !n.id) return;
  sbSaveNuit(n).catch(e => { console.error('[nuit]', e); toast('Erreur sauvegarde cahier de nuit', 'error'); });
}

function nuitLabel(date) {
  const d1 = new Date(date + 'T12:00');
  const d2 = new Date(d1.getTime() + 86400000);
  const fmt = d => d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  return `Nuit du ${fmt(d1)} au ${fmt(d2)}`;
}

function updateNuit(patch) {
  let list = getNuits();
  const idx = list.findIndex(n => n.date === nuitDate);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
  persistNuit(list[idx]);
}

// ── OUVERTURE / NAVIGATION ──
async function ouvrirNuit() {
  const s = Auth.getSession();
  if (!getNuit(nuitDate)) {
    // Effectif auto : présents pointés ce jour, sinon résidents actifs
    const pres = (DB.get(DB.keys.presences) || {})[nuitDate] || {};
    const actifs = sbResidents().filter(r => r.statut !== 'sorti');
    const presents = actifs.filter(r => (pres[r.id] || 'present') === 'present').length;
    try {
      const saved = await sbSaveNuit({
        date: nuitDate,
        veilleur: s ? [s.prenom, s.nom].filter(Boolean).join(' ') || s.username : '?',
        veilleurId: s?.userId,
        ambiance: 'calme', effectif: presents,
        rondes: [], evenements: [], astreintes: [],
        transmission: ''
      });
      _nuitCache.push(saved);
    } catch (e) { console.error('[ouvrirNuit]', e); toast('Erreur ouverture cahier : ' + (e?.message || e), 'error'); return; }
    if (typeof auditLog === 'function') auditLog('nuit_open', 'Cahier de nuit ' + nuitDate);
  }
  renderNuit();
}

function nuitShift(days) {
  const d = new Date(nuitDate + 'T12:00');
  d.setDate(d.getDate() + days);
  nuitDate = d.toISOString().slice(0, 10);
  renderNuit();
}

// ── RENDU ──
function renderNuit() {
  const dEl = document.getElementById('ntDate');
  if (dEl && dEl.value !== nuitDate) dEl.value = nuitDate;
  document.getElementById('ntLabel').textContent = nuitLabel(nuitDate);
  const n = getNuit(nuitDate);
  const body = document.getElementById('ntBody');
  const canWrite = !!Auth.getSession();

  if (!n) {
    body.innerHTML = `<div class="empty" style="padding:2.5rem">
      <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></div>
      <h3>Cahier non ouvert pour cette nuit</h3><p>Ouvrez le cahier pour consigner rondes, événements et appels.</p>
      ${canWrite ? '<button class="btn btn-accent" onclick="ouvrirNuit()">🌙 Ouvrir le cahier de cette nuit</button>' : ''}
    </div>`;
    renderNuitHisto();
    return;
  }

  const amb = NUIT_AMBIANCES[n.ambiance] || NUIT_AMBIANCES.calme;
  const rondes = [...(n.rondes || [])].sort((a, b) => (a.heure || '').localeCompare(b.heure || ''));
  const evts = [...(n.evenements || [])].sort((a, b) => (a.heure || '').localeCompare(b.heure || ''));
  const astr = [...(n.astreintes || [])].sort((a, b) => (a.heure || '').localeCompare(b.heure || ''));

  body.innerHTML = `
    <!-- En-tête de nuit -->
    <div class="card" style="margin-bottom:1.25rem;border-left:3px solid ${amb.color}">
      <div class="card-body" style="display:flex;align-items:center;gap:1.25rem;flex-wrap:wrap;padding:1rem 1.25rem">
        <div><div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--muted)">Veilleur</div><div style="font-weight:700">${escHtml(n.veilleur || '?')}</div></div>
        <div><div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--muted)">Effectif</div>
          <input type="number" value="${n.effectif || 0}" min="0" style="width:70px;padding:.25rem .5rem" onchange="updateNuit({effectif:parseInt(this.value)||0})"/></div>
        <div><div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--muted)">Ambiance</div>
          <select style="width:auto;padding:.25rem .5rem" onchange="updateNuit({ambiance:this.value});renderNuit()">
            ${Object.entries(NUIT_AMBIANCES).map(([k, a]) => `<option value="${k}"${n.ambiance === k ? ' selected' : ''}>${a.label}</option>`).join('')}
          </select></div>
        <div style="margin-left:auto;display:flex;gap:1.25rem;text-align:center">
          <div><div style="font-family:var(--display);font-size:1.4rem;font-weight:700;color:var(--primary)">${rondes.length}</div><div style="font-size:.66rem;color:var(--muted);text-transform:uppercase">Rondes</div></div>
          <div><div style="font-family:var(--display);font-size:1.4rem;font-weight:700;color:${evts.length ? '#d97706' : 'var(--primary)'}">${evts.length}</div><div style="font-size:.66rem;color:var(--muted);text-transform:uppercase">Événements</div></div>
          <div><div style="font-family:var(--display);font-size:1.4rem;font-weight:700;color:${astr.length ? '#dc2626' : 'var(--primary)'}">${astr.length}</div><div style="font-size:.66rem;color:var(--muted);text-transform:uppercase">Astreinte</div></div>
        </div>
      </div>
    </div>

    <div class="grid grid-2" style="gap:1.25rem;align-items:start">
      <!-- RONDES -->
      <div class="card">
        <div class="card-header"><span class="card-title">🚶 Rondes</span></div>
        <div class="card-body" style="padding:1rem 1.25rem;display:flex;flex-direction:column;gap:.5rem">
          ${rondes.length ? rondes.map(rd => `
            <div style="display:flex;align-items:center;gap:.6rem;padding:.45rem .7rem;background:var(--g50);border:1px solid var(--border);border-radius:var(--r-sm)">
              <strong style="font-family:var(--display)">${escHtml(rd.heure || '—')}</strong>
              ${rd.ras ? '<span class="badge badge-green">RAS</span>' : '<span class="badge badge-amber">À noter</span>'}
              <span style="flex:1;font-size:.8rem;color:var(--g700)">${escHtml(rd.note || '')}</span>
              <button class="btn btn-ghost btn-sm no-print" style="color:var(--red)" onclick="delRonde('${rd.id}')">✕</button>
            </div>`).join('') : '<div style="font-size:.78rem;color:var(--g400)">Aucune ronde consignée</div>'}
          <div class="no-print" style="display:flex;gap:.5rem;align-items:center;border-top:1px solid var(--border);padding-top:.65rem;flex-wrap:wrap">
            <input type="time" id="rdHeure" style="width:110px"/>
            <label style="display:flex;align-items:center;gap:.3rem;font-size:.78rem;text-transform:none;letter-spacing:0;margin:0"><input type="checkbox" id="rdRas" checked style="width:auto"/> RAS</label>
            <input type="text" id="rdNote" placeholder="Observation…" style="flex:1;min-width:120px"/>
            <button class="btn btn-accent btn-sm" onclick="addRonde()">+ Ronde</button>
          </div>
        </div>
      </div>

      <!-- ASTREINTE -->
      <div class="card">
        <div class="card-header"><span class="card-title">📞 Appels à l'astreinte</span></div>
        <div class="card-body" style="padding:1rem 1.25rem;display:flex;flex-direction:column;gap:.5rem">
          ${astr.length ? astr.map(a => `
            <div style="padding:.55rem .75rem;background:#fef2f2;border:1px solid #fecaca;border-radius:var(--r-sm)">
              <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                <strong style="font-family:var(--display)">${escHtml(a.heure || '—')}</strong>
                <span style="font-weight:600;font-size:.82rem">${escHtml(a.cadre || 'Cadre')}</span>
                <button class="btn btn-ghost btn-sm no-print" style="color:var(--red);margin-left:auto" onclick="delAstreinte('${a.id}')">✕</button>
              </div>
              <div style="font-size:.78rem;color:var(--g700)">Motif : ${escHtml(a.motif || '—')}</div>
              ${a.decision ? `<div style="font-size:.78rem;color:#0f2b4a;margin-top:2px"><strong>Consigne :</strong> ${escHtml(a.decision)}</div>` : ''}
            </div>`).join('') : '<div style="font-size:.78rem;color:var(--g400)">Aucun appel cette nuit</div>'}
          <div class="no-print" style="display:flex;flex-direction:column;gap:.4rem;border-top:1px solid var(--border);padding-top:.65rem">
            <div style="display:flex;gap:.5rem"><input type="time" id="asHeure" style="width:110px"/><input type="text" id="asCadre" placeholder="Cadre contacté" style="flex:1"/></div>
            <input type="text" id="asMotif" placeholder="Motif de l'appel"/>
            <input type="text" id="asDecision" placeholder="Décision / consigne donnée"/>
            <div style="text-align:right"><button class="btn btn-danger btn-sm" onclick="addAstreinte()">+ Appel astreinte</button></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ÉVÉNEMENTS -->
    <div class="card" style="margin-top:1.25rem">
      <div class="card-header"><span class="card-title">⚡ Événements de la nuit</span>
        <button class="btn btn-accent btn-sm no-print" style="margin-left:auto" onclick="openNuitEvtModal()">+ Événement</button></div>
      <div class="card-body" style="padding:1rem 1.25rem;display:flex;flex-direction:column;gap:.5rem">
        ${evts.length ? evts.map(e => {
          const t = NUIT_EVT_TYPES[e.type] || NUIT_EVT_TYPES.autre;
          return `<div style="display:flex;gap:.7rem;align-items:flex-start;padding:.55rem .75rem;background:var(--g50);border:1px solid var(--border);border-radius:var(--r-sm)">
            <span style="font-size:1.1rem">${t.icon}</span>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                <strong style="font-family:var(--display)">${escHtml(e.heure || '—')}</strong>
                <span class="badge badge-gray">${t.label}</span>
                ${e.residentName ? `<a href="resident.html?id=${e.residentId}" style="font-weight:600;font-size:.82rem;color:var(--accent);text-decoration:none">${escHtml(e.residentName)}</a>` : ''}
              </div>
              <div style="font-size:.8rem;color:var(--g700);margin-top:2px">${escHtml(e.description || '')}</div>
            </div>
            <span class="no-print" style="display:flex;gap:.2rem">
              <button class="btn btn-ghost btn-sm" onclick="openNuitEvtModal('${e.id}')">✎</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="delNuitEvt('${e.id}')">✕</button>
            </span>
          </div>`;
        }).join('') : '<div style="font-size:.78rem;color:var(--g400)">Rien à signaler — nuit sans événement particulier</div>'}
      </div>
    </div>

    <!-- TRANSMISSION DU MATIN -->
    <div class="card" style="margin-top:1.25rem">
      <div class="card-header"><span class="card-title">🌅 Transmission pour l'équipe du matin</span><span id="ntSaved" style="margin-left:auto;font-size:.72rem;color:#16a34a"></span></div>
      <div class="card-body" style="padding:1rem 1.25rem">
        <textarea id="ntTransmission" rows="3" placeholder="Synthèse de la nuit, points de vigilance pour la journée…" oninput="saveTransmission()">${escHtml(n.transmission || '')}</textarea>
      </div>
    </div>`;
  renderNuitHisto();
}

// ── ACTIONS ──
function addRonde() {
  const heure = document.getElementById('rdHeure').value;
  if (!heure) { toast("Indiquez l'heure de la ronde", 'error'); return; }
  const n = getNuit(nuitDate);
  updateNuit({ rondes: [...(n.rondes || []), { id: genId(), heure, ras: document.getElementById('rdRas').checked, note: document.getElementById('rdNote').value.trim() }] });
  renderNuit();
}
function delRonde(id) { const n = getNuit(nuitDate); updateNuit({ rondes: (n.rondes || []).filter(r => r.id !== id) }); renderNuit(); }

function addAstreinte() {
  const heure = document.getElementById('asHeure').value;
  const motif = document.getElementById('asMotif').value.trim();
  if (!heure || !motif) { toast('Heure et motif requis', 'error'); return; }
  const n = getNuit(nuitDate);
  updateNuit({ astreintes: [...(n.astreintes || []), { id: genId(), heure, cadre: document.getElementById('asCadre').value.trim(), motif, decision: document.getElementById('asDecision').value.trim() }] });
  if (typeof auditLog === 'function') auditLog('astreinte_call', `Appel astreinte ${nuitDate} ${heure}`);
  renderNuit();
}
function delAstreinte(id) { const n = getNuit(nuitDate); updateNuit({ astreintes: (n.astreintes || []).filter(a => a.id !== id) }); renderNuit(); }

let _ntTimer = null;
function saveTransmission() {
  clearTimeout(_ntTimer);
  _ntTimer = setTimeout(() => {
    updateNuit({ transmission: document.getElementById('ntTransmission').value });
    const el = document.getElementById('ntSaved');
    if (el) { el.textContent = '✓ Enregistré'; setTimeout(() => { el.textContent = ''; }, 1500); }
  }, 400);
}

// ── ÉVÉNEMENTS (modal) ──
function openNuitEvtModal(id) {
  nuitEvtEditId = id || null;
  const n = getNuit(nuitDate);
  const e = id ? (n.evenements || []).find(x => x.id === id) || {} : {};
  const residents = sbResidents().filter(r => r.statut !== 'sorti');
  document.getElementById('neResident').innerHTML = '<option value="">— Aucun / collectif —</option>' +
    residents.map(r => `<option value="${r.id}"${String(e.residentId) === String(r.id) ? ' selected' : ''}>${escHtml(`${r.prenom || ''} ${r.nom || ''}`.trim())}</option>`).join('');
  document.getElementById('neType').value = e.type || 'reveil';
  document.getElementById('neHeure').value = e.heure || '';
  document.getElementById('neDesc').value = e.description || '';
  openModal('modalNuitEvt');
}

function saveNuitEvt() {
  const desc = document.getElementById('neDesc').value.trim();
  if (!desc) { toast('Décrivez l\'événement', 'error'); return; }
  const rid = document.getElementById('neResident').value;
  const r = sbResidents().find(x => String(x.id) === String(rid));
  const data = {
    type: document.getElementById('neType').value,
    heure: document.getElementById('neHeure').value,
    residentId: rid || null,
    residentName: r ? `${r.prenom || ''} ${r.nom || ''}`.trim() : '',
    description: desc
  };
  const n = getNuit(nuitDate);
  let evts = n.evenements || [];
  if (nuitEvtEditId) evts = evts.map(x => x.id === nuitEvtEditId ? { ...x, ...data } : x);
  else evts = [...evts, { id: genId(), ...data }];
  updateNuit({ evenements: evts });
  closeModal('modalNuitEvt');
  toast('Événement consigné ✓');
  renderNuit();
}
function delNuitEvt(id) {
  confirmDialog('Supprimer cet événement ?', () => {
    const n = getNuit(nuitDate);
    updateNuit({ evenements: (n.evenements || []).filter(e => e.id !== id) });
    renderNuit();
  });
}

// ── HISTORIQUE ──
function renderNuitHisto() {
  const list = getNuits().filter(n => n.date !== nuitDate).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 20);
  const el = document.getElementById('ntHisto');
  el.innerHTML = list.length ? list.map(n => {
    const amb = NUIT_AMBIANCES[n.ambiance] || NUIT_AMBIANCES.calme;
    return `<div class="card" style="cursor:pointer" onclick="nuitDate='${n.date}';renderNuit();window.scrollTo({top:0,behavior:'smooth'})">
      <div class="card-body" style="padding:.6rem 1rem;display:flex;align-items:center;gap:.7rem;flex-wrap:wrap">
        <strong style="font-size:.84rem">${nuitLabel(n.date)}</strong>
        <span class="badge" style="background:${amb.color}1a;color:${amb.color}">${amb.label}</span>
        <span style="font-size:.74rem;color:var(--muted);margin-left:auto">${escHtml(n.veilleur || '?')} · ${(n.rondes || []).length} rondes · ${(n.evenements || []).length} évén. · ${(n.astreintes || []).length} astreinte</span>
      </div>
    </div>`;
  }).join('') : '<div style="font-size:.78rem;color:var(--g400);padding:.5rem 0">Aucune nuit dans l\'historique</div>';
}

// ── INIT ──
async function initNuit() {
  const s = Auth.requireAuth();
  if (!s) return;
  if (!requireModule('access_journal')) return;
  await sbLoadResidentsCache();
  await loadNuitsCache();
  // Avant 12 h, on est encore « sur » la nuit de la veille
  const now = new Date();
  if (now.getHours() < 12) now.setDate(now.getDate() - 1);
  nuitDate = now.toISOString().slice(0, 10);
  document.getElementById('ntDate')?.addEventListener('change', e => { if (e.target.value) { nuitDate = e.target.value; renderNuit(); } });
  renderNuit();
}
document.addEventListener('DOMContentLoaded', initNuit);
