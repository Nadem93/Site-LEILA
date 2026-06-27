let _presResidentsCache = [];
let _presCache = {};

function getDateStr() { return document.getElementById('presenceDate').value || today(); }

async function loadPresenceData() {
  _presResidentsCache = await sbGetResidents();
  _presCache = await sbGetPresencesForDate(getDateStr());
}

function getPresencesForDate(date) {
  return _presCache;
}

async function setPresence(residentId, status) {
  const date = getDateStr();
  try {
    await sbSetPresence(residentId, date, status);
    _presCache[residentId] = status;
    renderStats();
    renderPresenceTable();
  } catch (e) {
    toast('Erreur lors de l\'enregistrement', 'error');
    console.error(e);
  }
}

async function markAllPresent() {
  const residents = _presResidentsCache.filter(r => r.statut !== 'sorti');
  const date = getDateStr();
  try {
    await sbSetPresencesBulk(residents.map(r => r.id), date, 'present');
    residents.forEach(r => { _presCache[r.id] = 'present'; });
    renderStats();
    renderPresenceTable();
    toast('Tous les résidents marqués présents');
  } catch (e) {
    toast('Erreur lors de l\'enregistrement', 'error');
    console.error(e);
  }
}

async function cycleStatus(residentId) {
  const presences = getPresencesForDate(getDateStr());
  const current = presences[residentId] || 'unknown';
  const next = { unknown:'present', present:'absent', absent:'sortie', sortie:'unknown' };
  await setPresence(residentId, next[current] || 'present');
}

function renderStats() {
  const residents = _presResidentsCache.filter(r => r.statut !== 'sorti');
  const presences = getPresencesForDate(getDateStr());
  let present=0, absent=0, sortie=0, unknown=0;
  const dateStr = getDateStr();
  residents.forEach(r => {
    const s = presences[r.id] || (getPlanningAbsenceJour(r, dateStr) ? 'sortie' : 'unknown');
    if (s==='present') present++;
    else if (s==='absent') absent++;
    else if (s==='sortie') sortie++;
    else unknown++;
  });
  document.getElementById('countPresent').textContent = present;
  document.getElementById('countAbsent').textContent = absent;
  document.getElementById('countSortie').textContent = sortie;
  document.getElementById('countUnknown').textContent = unknown;
}

const JOURS_SEMAINE = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

function getPlanningAbsenceJour(r, date) {
  if (!r.planningHebdo) return null;
  const dow = new Date(date + 'T00:00:00').getDay();
  const jour = JOURS_SEMAINE[dow];
  const d = r.planningHebdo[jour];
  return (d && d.actif) ? d : null;
}

function renderPresenceTable() {
  const residents = _presResidentsCache.filter(r => r.statut !== 'sorti');
  const presences = getPresencesForDate(getDateStr());
  const el = document.getElementById('presenceTable');

  if (!residents.length) {
    el.innerHTML = `<div class="empty" style="padding:2rem"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div><h3>Aucun résident actif</h3><p><a href="residents.html">Ajouter des résidents</a></p></div>`;
    return;
  }

  const BTNS = [
    { key: 'present', label: 'Présent', letter: 'P', active: 'background:#16a34a;color:#fff;border-color:#16a34a', inactive: 'background:#f0fdf4;color:#16a34a;border-color:#bbf7d0' },
    { key: 'absent',  label: 'Absent',  letter: 'A', active: 'background:#dc2626;color:#fff;border-color:#dc2626', inactive: 'background:#fef2f2;color:#dc2626;border-color:#fecaca' },
    { key: 'sortie',  label: 'Sortie',  letter: 'S', active: 'background:#d97706;color:#fff;border-color:#d97706', inactive: 'background:#fffbeb;color:#d97706;border-color:#fde68a' },
    { key: 'unknown', label: 'N/R',     letter: 'X', active: 'background:#6b7280;color:#fff;border-color:#6b7280', inactive: 'background:#f9fafb;color:#9ca3af;border-color:#e5e7eb' },
  ];

  const dateStr = getDateStr();
  const cards = residents.map(r => {
    const manualStatus = presences[r.id];
    const planningJour = getPlanningAbsenceJour(r, dateStr);
    const s = manualStatus || (planningJour ? 'sortie' : 'unknown');
    const isPlanningDefault = !manualStatus && planningJour;
    const color = r.color || '#6b7280';
    const avatar = r.photo
      ? `<img src="${sanitizeUrl(r.photo)}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid ${color}44;flex-shrink:0" alt=""/>`
      : `<div style="width:64px;height:64px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:700;flex-shrink:0">${initials(r.prenom,r.nom)}</div>`;

    const planningTag = isPlanningDefault
      ? `<div style="font-size:.65rem;color:#0369a1;background:#e0f2fe;border-radius:5px;padding:1px 5px;margin-top:2px;display:inline-block">📅 ${escHtml(planningJour.label||'Absence planifiée')}${planningJour.debut ? ' · '+planningJour.debut : ''}</div>`
      : '';

    const isFuture = dateStr > today();
    const btns = BTNS.map(b => {
      const isActive = s === b.key;
      return `<button ${isFuture ? 'disabled' : `onclick="setPresence('${r.id}','${b.key}')"`} style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:.55rem .25rem;border-radius:10px;border:1.5px solid;cursor:${isFuture?'not-allowed':'pointer'};transition:all .15s;font-family:inherit;opacity:${isFuture?'.5':'1'};${isActive ? b.active : b.inactive}">
        <span style="font-size:.9rem;font-weight:800;line-height:1">${b.letter}</span>
        <span style="font-size:.6rem;font-weight:500;line-height:1;opacity:${isActive?'1':'.7'}">${b.label}</span>
      </button>`;
    }).join('');

    return `<div style="background:${color}0d;border:1.5px solid ${color}44;border-top:3px solid ${color};border-radius:14px;padding:1rem;display:flex;flex-direction:column;gap:.85rem;transition:box-shadow .12s" onmouseover="this.style.boxShadow='0 4px 16px ${color}22'" onmouseout="this.style.boxShadow='none'">
      <div style="display:flex;align-items:center;gap:.7rem">
        ${avatar}
        <div style="min-width:0">
          <div style="font-weight:600;font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(r.prenom||'')} ${escHtml(r.nom||'')}</div>
          <div style="font-size:.74rem;color:var(--muted);margin-top:1px">Chambre ${escHtml(r.chambre||'—')}</div>
          ${planningTag}
        </div>
      </div>
      <div style="display:flex;gap:.35rem">${btns}</div>
    </div>`;
  }).join('');

  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.85rem;padding:1.25rem">${cards}</div>`;
}

function updateDateLabel() {
  const d = new Date(getDateStr() + 'T00:00:00');
  document.getElementById('presenceDateLabel').textContent = d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function openExportModal() {
  const start = today();
  const end = new Date(); end.setDate(end.getDate()+1);
  document.getElementById('exportStart').value = start;
  document.getElementById('exportEnd').value = end.toISOString().slice(0,10);
  openModal('modalExportAbs');
}

async function exportPresencesPDF() {
  try {
    const start = document.getElementById('exportStart').value;
    const end   = document.getElementById('exportEnd').value;
    if (!start || !end) { toast('Sélectionnez une période', 'error'); return; }

    const allPresences = await sbGetPresencesRange(start, end);
    const residents    = (await sbGetResidents()).filter(r => r.statut !== 'sorti');
    const settings     = DB.get(DB.keys.settings)  || {};
    const brand        = DB.get(DB.keys.branding)  || {};
    const pc = brand.primaryColor || '#0f2b4a';
    const ac = brand.accentColor  || '#e85d04';
    const etab = settings.etablissement || 'FTR';

    // Build list of dates in range
    const dates = [];
    for (let d = new Date(start+'T00:00:00'); d <= new Date(end+'T00:00:00'); d.setDate(d.getDate()+1)) {
      dates.push(d.toISOString().slice(0,10));
    }
    if (!dates.length) { toast('Période invalide', 'error'); return; }

    const statusLetter = { present:'P', absent:'A', sortie:'S', permission:'Pe', malade:'M', unknown:'' };
    const statusColor  = { present:'#16a34a', absent:'#dc2626', sortie:'#ca8a04', permission:'#2563eb', malade:'#9333ea' };
    const statusLabel  = { present:'Présent', absent:'Absent', sortie:'Sorti', permission:'Permission', malade:'Malade' };

    // Summary per resident
    const summaryRows = residents.map(r => {
      const name = `${r.prenom||''} ${r.nom||''}`.trim();
      let present=0, absent=0, sortie=0, autre=0;
      dates.forEach(ds => {
        const s = (allPresences[ds]||{})[r.id] || 'unknown';
        if (s==='present') present++;
        else if (s==='absent') absent++;
        else if (s==='sortie') sortie++;
        else if (s && s!=='unknown') autre++;
      });
      const cells = dates.map(ds => {
        const s = (allPresences[ds]||{})[r.id] || '';
        const letter = statusLetter[s] || '';
        const color  = statusColor[s]  || '#94a3b8';
        return `<td style="text-align:center;padding:3px 4px;font-size:9px;font-weight:700;color:${letter?color:'#cbd5e1'}">${letter||'·'}</td>`;
      }).join('');
      const pct = dates.length ? Math.round(present/dates.length*100) : 0;
      return { name, cells, present, absent, sortie, autre, pct };
    });

    const now = new Date().toLocaleDateString('fr-FR');
    const dateHeaders = dates.map(ds => {
      const d = new Date(ds+'T12:00:00');
      return `<th style="text-align:center;padding:4px 2px;font-size:8px;font-weight:700;min-width:22px;writing-mode:vertical-rl;transform:rotate(180deg);height:50px">${d.getDate()}/${d.getMonth()+1}</th>`;
    }).join('');

    const tableRows = summaryRows.map((r, i) => `
      <tr style="background:${i%2===0?'#f8fafc':'#fff'}">
        <td style="padding:5px 10px;font-weight:600;white-space:nowrap;border-right:1px solid #e2e8f0">${escHtml(r.name)}</td>
        ${r.cells}
        <td style="text-align:center;padding:4px 6px;font-size:9px;font-weight:700;color:#16a34a;border-left:1px solid #e2e8f0">${r.present}</td>
        <td style="text-align:center;padding:4px 6px;font-size:9px;font-weight:700;color:#dc2626">${r.absent}</td>
        <td style="text-align:center;padding:4px 6px;font-size:9px;font-weight:700;color:#ca8a04">${r.sortie}</td>
        <td style="text-align:center;padding:4px 6px;font-size:9px;font-weight:700;color:#0f2b4a">${r.pct}%</td>
      </tr>`).join('');

    const legendHtml = Object.entries(statusLabel).map(([k,v]) =>
      `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;font-size:10px"><span style="font-weight:800;color:${statusColor[k]}">${statusLetter[k]}</span> = ${v}</span>`
    ).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Présences — ${etab}</title>
<style>
  @page{margin:1cm 1.2cm;size:A4 landscape}
  body{margin:0;font-family:Inter,system-ui,sans-serif;font-size:10px;color:#1e293b}
  .top-stripe{height:5px;background:linear-gradient(90deg,${pc},${ac})}
  .doc-header{display:flex;align-items:flex-start;justify-content:space-between;padding:12px 20px 10px;border-bottom:2px solid #e2e8f0}
  .doc-header h1{margin:0;font-size:16px;font-weight:800;color:${pc}}
  .doc-header .sub{font-size:10px;color:#64748b;margin-top:2px}
  .doc-meta{font-size:9px;color:#64748b;text-align:right}
  .wrap{padding:12px 20px}
  table{width:100%;border-collapse:collapse;font-size:9px}
  thead th{background:${pc};color:#fff;padding:5px 4px;text-align:left;font-size:9px;font-weight:700}
  thead th:first-child{text-align:left;min-width:120px}
  td{border:1px solid #e8ecf0}
  .legend{margin-top:10px;padding:8px 12px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0}
  .actions{margin-bottom:12px}
  .actions button{padding:6px 16px;border:none;border-radius:6px;background:${pc};color:#fff;font-weight:600;cursor:pointer;font-size:10px;margin-right:6px}
  @media print{.actions{display:none}}
</style></head><body>
<div class="top-stripe"></div>
<div class="doc-header">
  <div><h1>${escHtml(etab)}</h1><div class="sub">Registre des présences</div></div>
  <div class="doc-meta">Période : ${start} → ${end}<br>${dates.length} jour${dates.length>1?'s':''} · ${residents.length} résident${residents.length>1?'s':''}<br>Généré le ${now}</div>
</div>
<div class="wrap">
  <div class="actions"><button onclick="window.print()">🖨 Imprimer / Enregistrer PDF</button><button onclick="window.close()">Fermer</button></div>
  <table>
    <thead>
      <tr>
        <th style="min-width:130px;vertical-align:bottom;padding:6px 10px">Résident</th>
        ${dateHeaders}
        <th style="text-align:center;padding:4px 6px;min-width:25px;background:#1e3a5f">P</th>
        <th style="text-align:center;padding:4px 6px;min-width:25px;background:#7f1d1d">A</th>
        <th style="text-align:center;padding:4px 6px;min-width:25px;background:#78350f">S</th>
        <th style="text-align:center;padding:4px 6px;min-width:30px;background:#1e3a5f">%</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="legend">${legendHtml}</div>
</div>
</body></html>`;

    closeModal('modalExportAbs');
    const w = window.open('', '_blank', 'width=1100,height=750');
    if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 600); }
    else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([html], { type:'text/html' }));
      a.download = `presences-${start}-${end}.html`;
      a.click();
    }
    toast('Export généré ✓');
  } catch(e) { toast('Erreur : '+e.message, 'error'); console.error(e); }
}

async function refreshPresenceDay() {
  await loadPresenceData();
  updateDateLabel();
  renderStats();
  renderPresenceTable();
}

async function initPresences() {
  if (!requireModule('access_presences')) return;
  const dateInput = document.getElementById('presenceDate');
  dateInput.max = today();
  dateInput.value = today();
  dateInput.addEventListener('change', () => {
    if (dateInput.value > today()) dateInput.value = today();
    refreshPresenceDay();
  });
  await refreshPresenceDay();
  document.getElementById('prevDay').addEventListener('click', () => {
    const d = new Date(getDateStr()); d.setDate(d.getDate()-1);
    dateInput.value = d.toISOString().slice(0,10);
    refreshPresenceDay();
  });
  document.getElementById('nextDay').addEventListener('click', () => {
    if (getDateStr() >= today()) return;
    const d = new Date(getDateStr()); d.setDate(d.getDate()+1);
    dateInput.value = d.toISOString().slice(0,10);
    refreshPresenceDay();
  });
  document.getElementById('todayBtn').addEventListener('click', () => {
    document.getElementById('presenceDate').value = today();
    refreshPresenceDay();
  });
}
document.addEventListener('DOMContentLoaded', initPresences);
if (typeof registerPageInit === 'function') registerPageInit('presences', initPresences);
