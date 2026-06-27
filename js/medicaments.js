// ── TRAÇABILITÉ DE LA DISTRIBUTION DES MÉDICAMENTS ──
let medCanEdit = false;
let medNoteCtx = null;
let medSearch = '';
let medFilterPresent = false;

function medSetSearch(v) { medSearch = v.toLowerCase().trim(); renderMedicaments(); }
function medTogglePresent() { medFilterPresent = !medFilterPresent; renderMedicaments(); }

const MED_MOMENTS = {
  matin: { label: 'Matin', icon: '🌅' },
  midi: { label: 'Midi', icon: '☀️' },
  soir: { label: 'Soir', icon: '🌆' },
  coucher: { label: 'Coucher', icon: '🌙' }
};
const MED_STATUTS = {
  donne:  { label: 'Donné',   icon: '✅', color: '#16a34a' },
  confie: { label: 'Confié',  icon: '🤝', color: '#2563eb' },
  refuse: { label: 'Refusé',  icon: '🚫', color: '#dc2626' },
  absent: { label: 'Absent',  icon: '➖', color: '#6b7280' },
  report: { label: 'Reporté', icon: '⏭️', color: '#d97706' }
};

// Source = Supabase. Cache mémoire chargé au démarrage.
let _medCache = [];
function getMedDistrib() { return _medCache; }
async function loadMedCache() { _medCache = await sbGetMedDistrib(); }

function medResidents() {
  return sbResidents().filter(r => r.statut !== 'sorti')
    .sort((a, b) => `${a.nom || ''}`.localeCompare(`${b.nom || ''}`, 'fr'));
}

// Traitements avec moments de prise, actifs pour une date donnée
function medPrevues(date) {
  const out = [];
  medResidents().forEach(r => {
    const traitements = (r.sante?.traitements || []).filter(t =>
      (t.moments || []).length && (!t.debut || t.debut <= date) && (!t.fin || t.fin >= date));
    traitements.forEach(t => (t.moments || []).forEach(moment => {
      out.push({
        residentId: r.id, residentName: `${r.prenom || ''} ${r.nom || ''}`.trim(),
        traitementId: t.id, medicament: t.nom, posologie: t.posologie, moment
      });
    }));
  });
  return out;
}

function medRecord(date, residentId, traitementId, moment) {
  return getMedDistrib().find(x => x.date === date && String(x.residentId) === String(residentId) && x.traitementId === traitementId && x.moment === moment);
}

// ── RENDU PRINCIPAL ──
function renderMedicaments() {
  const date = document.getElementById('medDate').value || today();
  const prevues = medPrevues(date);
  const records = getMedDistrib();
  const enriched = prevues.map(p => ({ ...p, record: records.find(x => x.date === date && String(x.residentId) === String(p.residentId) && x.traitementId === p.traitementId && x.moment === p.moment) }));

  const nbDonne    = enriched.filter(e => e.record?.statut === 'donne').length;
  const nbIncident = enriched.filter(e => e.record?.statut && ['refuse','absent','report'].includes(e.record.statut)).length;
  const nbAttente  = enriched.filter(e => !e.record?.statut).length;

  document.getElementById('medStats').innerHTML = `
    <div class="chx-stat" style="--c:#2563eb"><div class="chx-stat-top"><span class="chx-stat-lbl">Prises prévues</span></div><div class="chx-stat-num">${enriched.length}</div></div>
    <div class="chx-stat" style="--c:#16a34a"><div class="chx-stat-top"><span class="chx-stat-lbl">Données</span></div><div class="chx-stat-num">${nbDonne}</div></div>
    <div class="chx-stat" style="--c:#dc2626"><div class="chx-stat-top"><span class="chx-stat-lbl">Refus / absences / reports</span></div><div class="chx-stat-num">${nbIncident}</div></div>
    <div class="chx-stat" style="--c:#d97706"><div class="chx-stat-top"><span class="chx-stat-lbl">En attente</span></div><div class="chx-stat-num">${nbAttente}</div></div>`;

  const el = document.getElementById('medList');
  if (!enriched.length) {
    el.innerHTML = `<div style="background:rgba(255,255,255,.9);border-radius:18px;padding:2.5rem;text-align:center">
      <div style="font-size:2rem;margin-bottom:.75rem">💊</div>
      <div style="font-weight:700;font-size:1rem;color:#1e293b;margin-bottom:.4rem">Aucun traitement à distribuer</div>
      <div style="font-size:.83rem;color:#64748b">Renseignez les moments de prise depuis la fiche médicale de chaque résident.</div>
    </div>`;
    return;
  }

  const residents = sbResidents();
  const resMap = {};
  residents.forEach(r => { resMap[String(r.id)] = r; });

  const presencesAujourdhui = (DB.get(DB.keys.presences) || {})[date] || {};

  el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">
    <div style="flex:1;min-width:180px;display:flex;align-items:center;gap:8px;background:#fff;border-radius:20px;padding:7px 14px;border:1.5px solid #e2e8f0">
      <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="width:15px;height:15px;flex-shrink:0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input id="medSearchInput" type="text" placeholder="Rechercher un résident…" value="${escHtml(medSearch)}" oninput="medSetSearch(this.value)" style="border:none;outline:none;background:none;font-size:13px;color:#1e293b;width:100%;font-family:inherit"/>
    </div>
    <button onclick="medTogglePresent()" style="padding:7px 16px;border-radius:20px;border:1.5px solid ${medFilterPresent?'#16a34a':'#e2e8f0'};background:${medFilterPresent?'#f0fdf4':'#fff'};color:${medFilterPresent?'#16a34a':'#64748b'};font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px">
      <span style="width:8px;height:8px;border-radius:50%;background:${medFilterPresent?'#16a34a':'#cbd5e1'};display:inline-block"></span>
      Présents seulement
    </button>
  </div>
  <div id="medResidentList"></div>`;

  const listEl = document.getElementById('medResidentList');

  const MOMENT_STYLE = {
    matin:   { bg:'#faeeda', color:'#633806' },
    midi:    { bg:'#e6f1fb', color:'#0c447c' },
    soir:    { bg:'#eeedfe', color:'#3c3489' },
    coucher: { bg:'#f1efe8', color:'#444441' },
  };

  const momentOrder = Object.keys(MED_MOMENTS);
  const byResident = {};
  enriched.forEach(e => {
    if (!byResident[e.residentId]) byResident[e.residentId] = { name: e.residentName, items: [] };
    byResident[e.residentId].items.push(e);
  });

  let entries = Object.entries(byResident);

  if (medSearch) {
    entries = entries.filter(([, g]) => g.name.toLowerCase().includes(medSearch));
  }
  const JOURS_MED = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  const dowMed = new Date(date + 'T00:00:00').getDay();
  const jourMed = JOURS_MED[dowMed];

  function isResidentPresent(residentId) {
    const manual = presencesAujourdhui[residentId];
    if (manual) return manual === 'present';
    const r = resMap[residentId];
    if (r?.planningHebdo?.[jourMed]?.actif) return false;
    return true;
  }

  if (medFilterPresent) {
    entries = entries.filter(([residentId]) => isResidentPresent(residentId));
  }

  if (!entries.length) {
    listEl.innerHTML = `<div style="background:rgba(255,255,255,.85);border-radius:16px;padding:2rem;text-align:center;font-size:13px;color:#64748b;font-style:italic">Aucun résident correspondant aux filtres.</div>`;
    return;
  }

  listEl.innerHTML = entries.map(([residentId, g]) => {
    g.items.sort((a,b) => momentOrder.indexOf(a.moment) - momentOrder.indexOf(b.moment));
    const r = resMap[String(residentId)];
    const color = r?.color || '#2563eb';
    const av = r?.photo
      ? `<img src="${sanitizeUrl(r.photo)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid ${color}33" alt=""/>`
      : `<div class="med-avatar" style="background:${color}15;color:${color}">${initials(r?.prenom||'',r?.nom||'')}</div>`;

    const rows = g.items.map(e => {
      const mom = MED_MOMENTS[e.moment] || {};
      const rec = e.record;
      const mc  = MOMENT_STYLE[e.moment] || { bg:'#f1efe8', color:'#444441' };

      const btnDonne  = `<button class="med-btn med-btn-ok${rec?.statut==='donne'?' on':''}"  onclick="setMedStatut('${date}','${residentId}','${e.traitementId}','${e.moment}','donne')">✓ Donné</button>`;
      const btnConfie = `<button class="med-btn${rec?.statut==='confie'?' on':''}" style="${rec?.statut==='confie'?'background:#2563eb;color:#fff;border-color:#2563eb':'background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe'};padding:7px 16px;border-radius:20px;border:1.5px solid;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:5px" onclick="setMedStatut('${date}','${residentId}','${e.traitementId}','${e.moment}','confie')">🤝 Confié</button>`;
      const btnRefuse = `<button class="med-btn med-btn-ref${rec?.statut==='refuse'?' on':''}" onclick="setMedStatutRefuse('${date}','${residentId}','${e.traitementId}','${e.moment}')">✕ Refus</button>`;
      const btnAbsent = `<button class="med-btn med-btn-abs${rec?.statut==='absent'?' on':''}" onclick="setMedStatut('${date}','${residentId}','${e.traitementId}','${e.moment}','absent')">— Absent</button>`;
      const btnReport = `<button class="med-btn med-btn-rep${rec?.statut==='report'?' on':''}" onclick="setMedStatut('${date}','${residentId}','${e.traitementId}','${e.moment}','report')">⏭ Reporté</button>`;
      const btnNote   = `<button class="med-note-btn" title="Observation" onclick="openMedNote('${date}','${residentId}','${e.traitementId}','${e.moment}')">📝</button>`;

      const statusBadge = rec?.statut ? MED_STATUTS[rec.statut] : null;

      return `<div class="med-med-row">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px">
            <span style="font-size:11px;font-weight:600;padding:2px 9px;border-radius:20px;background:${mc.bg};color:${mc.color}">${mom.icon||''} ${mom.label||e.moment}</span>
            ${rec?.heure?`<span style="font-size:11px;color:#94a3b8">${rec.heure.slice(11,16)}</span>`:''}
          </div>
          <div class="med-med-name">${escHtml(e.medicament||'')}</div>
          <div class="med-med-meta">${e.posologie?escHtml(e.posologie):''}${rec?.auteur?' · '+escHtml(rec.auteur):''}</div>
        </div>
        ${medCanEdit
          ? `<div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center">${btnDonne}${btnConfie}${btnRefuse}${btnAbsent}${btnReport}${btnNote}</div>`
          : statusBadge ? `<span style="font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;background:${statusBadge.color}15;color:${statusBadge.color};border:1.5px solid ${statusBadge.color}33">${statusBadge.icon} ${statusBadge.label}</span>` : '<span style="font-size:12px;color:#94a3b8">En attente</span>'}
      </div>
      ${rec?.observation?`<div class="med-alert">📝 ${escHtml(rec.observation)}</div>`:''}`;
    }).join('');

    const planningJourMed = r?.planningHebdo?.[jourMed];
    const planningTag = planningJourMed?.actif
      ? `<span style="font-size:11px;color:#0369a1;background:#e0f2fe;border-radius:5px;padding:2px 7px;font-weight:600">📅 ${escHtml(planningJourMed.label||'Absent')}${planningJourMed.debut?' · '+planningJourMed.debut:''}</span>`
      : '';

    return `<div class="med-patient-section">
      <div class="med-patient-header">
        ${av}
        <div>
          <a href="resident.html?id=${residentId}" style="text-decoration:none"><div class="med-patient-name">${escHtml(g.name)}</div></a>
          ${planningTag}
        </div>
      </div>
      ${rows}
    </div>`;
  }).join('');
}

function medRow(date, e) {
  const mom = MED_MOMENTS[e.moment] || {};
  const r = e.record;
  const st = r?.statut ? MED_STATUTS[r.statut] : null;
  return `<div style="display:flex;align-items:center;gap:.7rem;padding:.6rem .85rem;border-bottom:1px solid var(--border);flex-wrap:wrap">
    <span style="font-size:1.1rem;width:28px;text-align:center" title="${escHtml(mom.label || e.moment)}">${mom.icon || ''}</span>
    <div style="flex:1;min-width:160px">
      <div style="font-weight:600;font-size:.83rem">${escHtml(e.medicament || '')}</div>
      <div style="font-size:.72rem;color:var(--muted)">${escHtml(mom.label || e.moment)}${e.posologie ? ' · ' + escHtml(e.posologie) : ''}${r?.heure ? ' · ' + r.heure.slice(0,5) : ''}${r?.auteur ? ' · ' + escHtml(r.auteur) : ''}</div>
      ${r?.observation ? `<div style="font-size:.72rem;color:var(--muted);margin-top:1px">📝 ${escHtml(r.observation)}</div>` : ''}
    </div>
    ${medCanEdit ? `<div class="no-print" style="display:flex;gap:.25rem;flex-wrap:wrap">
      ${Object.entries(MED_STATUTS).map(([k, v]) => `<button class="btn btn-sm ${r?.statut === k ? 'btn-primary' : 'btn-ghost'}" style="${r?.statut === k ? `background:${v.color};border-color:${v.color}` : ''}" title="${v.label}" onclick="setMedStatut('${date}','${e.residentId}','${e.traitementId}','${e.moment}','${k}')">${v.icon}</button>`).join('')}
      <button class="btn btn-ghost btn-sm" title="Observation" onclick="openMedNote('${date}','${e.residentId}','${e.traitementId}','${e.moment}')">📝</button>
    </div>` : st ? `<span class="badge" style="background:${st.color}1a;color:${st.color}">${st.icon} ${st.label}</span>` : '<span class="badge badge-gray">En attente</span>'}
  </div>`;
}

async function setMedStatut(date, residentId, traitementId, moment, statut) {
  const list = getMedDistrib();
  const session = Auth.getSession();
  const auteur = [session?.prenom, session?.nom].filter(Boolean).join(' ') || session?.username || '';
  const i = list.findIndex(x => x.date === date && String(x.residentId) === String(residentId) && x.traitementId === traitementId && x.moment === moment);
  const prevue = medPrevues(date).find(p => String(p.residentId) === String(residentId) && p.traitementId === traitementId && p.moment === moment);
  try {
    if (i >= 0) {
      if (list[i].statut === statut) {
        const id = list[i].id;
        list.splice(i, 1); // re-clic sur le même statut → réinitialise
        await sbDeleteMedDistrib(id);
      } else {
        list[i] = await sbSaveMedDistrib({ ...list[i], statut, heure: new Date().toISOString(), auteur });
      }
    } else if (prevue) {
      const saved = await sbSaveMedDistrib({ date, residentId, residentName: prevue.residentName, traitementId, medicament: prevue.medicament, posologie: prevue.posologie, moment, statut, heure: new Date().toISOString(), auteur, observation: '' });
      list.push(saved);
    }
  } catch (e) { console.error('[setMedStatut]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
  if (typeof auditLog === 'function' && prevue) auditLog('med_distrib', `${prevue.medicament} (${MED_MOMENTS[moment]?.label || moment}) — ${prevue.residentName} → ${MED_STATUTS[statut]?.label || statut}`);
  renderMedicaments();
}

async function setMedStatutRefuse(date, residentId, traitementId, moment) {
  const list = getMedDistrib();
  const rec = list.find(x => x.date === date && String(x.residentId) === String(residentId) && x.traitementId === traitementId && x.moment === moment);
  if (rec?.statut === 'refuse') {
    // re-clic → réinitialise sans ouvrir le modal
    await setMedStatut(date, residentId, traitementId, moment, 'refuse');
    return;
  }
  await setMedStatut(date, residentId, traitementId, moment, 'refuse');
  openMedNote(date, residentId, traitementId, moment);
}

function openMedNote(date, residentId, traitementId, moment) {
  medNoteCtx = { date, residentId, traitementId, moment };
  const r = medRecord(date, residentId, traitementId, moment);
  document.getElementById('mnTexte').value = r?.observation || '';
  openModal('modalMedNote');
}

async function saveMedNote() {
  const { date, residentId, traitementId, moment } = medNoteCtx;
  const observation = document.getElementById('mnTexte').value.trim();
  const list = getMedDistrib();
  const i = list.findIndex(x => x.date === date && String(x.residentId) === String(residentId) && x.traitementId === traitementId && x.moment === moment);
  try {
    if (i >= 0) {
      list[i] = await sbSaveMedDistrib({ ...list[i], observation });
    } else {
      const prevue = medPrevues(date).find(p => String(p.residentId) === String(residentId) && p.traitementId === traitementId && p.moment === moment);
      if (!prevue) return;
      const session = Auth.getSession();
      const auteur = [session?.prenom, session?.nom].filter(Boolean).join(' ') || session?.username || '';
      const saved = await sbSaveMedDistrib({ date, residentId, residentName: prevue.residentName, traitementId, medicament: prevue.medicament, posologie: prevue.posologie, moment, statut: '', heure: '', auteur, observation });
      list.push(saved);
    }
  } catch (e) { console.error('[saveMedNote]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
  closeModal('modalMedNote');
  renderMedicaments();
}

// ── IMPRESSION ──
function printMedSheet() {
  const date = document.getElementById('medDate').value || today();
  const prevues = medPrevues(date);
  if (!prevues.length) { toast('Aucun traitement à distribuer pour cette date', 'error'); return; }
  const records = getMedDistrib();
  const settings = DB.get(DB.keys.settings) || {};
  const w = window.open('', '_blank');
  if (!w) { toast('Autorisez les fenêtres pop-up pour imprimer', 'error'); return; }
  const momentOrder = Object.keys(MED_MOMENTS);
  const sorted = [...prevues].sort((a, b) => a.residentName.localeCompare(b.residentName, 'fr') || momentOrder.indexOf(a.moment) - momentOrder.indexOf(b.moment));
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Feuille de distribution — ${formatDate(date)}</title>
    <style>
      body{font-family:'Inter','Segoe UI',sans-serif;max-width:1000px;margin:1.5rem auto;padding:0 1.5rem;color:#1e293b;font-size:9pt;line-height:1.5}
      h1{font-size:15pt;color:#0f2b4a;border-bottom:2px solid #0f2b4a;padding-bottom:.3rem}
      .meta{color:#64748b;font-size:9pt;margin-bottom:1.2rem}
      table{width:100%;border-collapse:collapse}
      th{text-align:left;font-size:7.5pt;text-transform:uppercase;letter-spacing:.04em;color:#0f2b4a;border-bottom:2px solid #0f2b4a;padding:.3rem .4rem}
      td{padding:.4rem;border-bottom:1px solid #e2e8f0;font-size:8.5pt;vertical-align:top}
      @page{margin:1.5cm;size:landscape}
    </style></head><body>
    <h1>Feuille de distribution des médicaments</h1>
    <div class="meta">${escHtml(settings.etablissement || 'Établissement')} · ${formatDate(date)} · ${sorted.length} prise(s) prévue(s)</div>
    <table><thead><tr><th>Résident</th><th>Moment</th><th>Médicament</th><th>Posologie</th><th>Statut</th><th>Heure</th><th>Observation</th><th>Signature</th></tr></thead>
    <tbody>${sorted.map(p => {
      const r = records.find(x => x.date === date && String(x.residentId) === String(p.residentId) && x.traitementId === p.traitementId && x.moment === p.moment);
      const st = r?.statut ? MED_STATUTS[r.statut] : null;
      return `<tr>
        <td>${escHtml(p.residentName)}</td>
        <td>${MED_MOMENTS[p.moment]?.icon || ''} ${MED_MOMENTS[p.moment]?.label || p.moment}</td>
        <td>${escHtml(p.medicament || '')}</td>
        <td>${escHtml(p.posologie || '')}</td>
        <td>${st ? st.label : '—'}</td>
        <td>${r?.heure ? r.heure.slice(11,16) : ''}</td>
        <td>${escHtml(r?.observation || '')}</td>
        <td></td>
      </tr>`;
    }).join('')}</tbody></table>
    <script>window.onload=function(){window.print()}<\/script></body></html>`);
  w.document.close();
}

// ── INIT ──
async function initMedicaments() {
  const s = Auth.requireAuth();
  if (!s) return;
  if (!requireModule('access_medicaments')) return;
  await sbLoadResidentsCache();
  await loadMedCache();
  medCanEdit = ((typeof canEditResidents === 'function') ? canEditResidents(s.userId) : false) || Auth.isAdmin();
  const dateInput = document.getElementById('medDate');
  dateInput.value = today();
  dateInput.addEventListener('change', renderMedicaments);
  renderMedicaments();
}
document.addEventListener('DOMContentLoaded', initMedicaments);
