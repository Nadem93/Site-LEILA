function getResidentFromUrl() {
  const p = new URLSearchParams(window.location.search);
  return p.get('id');
}

async function loadResidentDashboard() {
  const id = getResidentFromUrl();
  if (!id) {
    document.getElementById('drContent').innerHTML = '<div class="empty"><div class="empty-icon">⚠</div><h3>Résident non spécifié</h3></div>';
    return;
  }
  await sbLoadResidentsCache();
  const r = sbResidents().find(x => String(x.id) === String(id));
  if (!r) {
    document.getElementById('drContent').innerHTML = '<div class="empty"><div class="empty-icon">⚠</div><h3>Résident introuvable</h3></div>';
    return;
  }

  document.getElementById('drTitle').textContent = `${r.prenom||''} ${r.nom||''}`;
  document.getElementById('drSub').textContent = `Dashboard · ${r.dob ? age(r.dob)+' ans' : ''}${r.chambre ? ' · Ch. '+r.chambre : ''}`;

  const presences = DB.get(DB.keys.presences) || {};
  const journal = DB.get(DB.keys.journal) || [];
  const planning = DB.get(DB.keys.planning) || [];
  const ppeList = DB.get(DB.keys.ppe) || [];
  const incidents = DB.get(DB.keys.incidents) || [];
  const categories = DB.get(DB.keys.categories) || [];

  const now = new Date();
  const todayStr = today();
  const monthStart = todayStr.slice(0,7)+'-01';

  // Stats cartes
  let monthAbsences = 0, monthTotal = 0;
  for (const [d,day] of Object.entries(presences)) {
    if (d < monthStart) continue;
    const s = day[id];
    if (s) { monthTotal++; if (s === 'absent') monthAbsences++; }
  }

  const rEvents = planning.filter(e =>
    String(e.residentId) === String(id) ||
    e.residentName === `${r.prenom||''} ${r.nom||''}`
  );
  const upcomingEvents = rEvents.filter(e => {
    const start = new Date(e.date + 'T' + (e.time||'09:00'));
    return start.getTime() > now.getTime() - 3600000;
  }).sort((a,b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||'')).slice(0,5);

  const rJournal = journal.filter(e =>
    String(e.residentId) === String(id) ||
    e.resident === `${r.prenom||''} ${r.nom||''}`
  ).slice(-5).reverse();

  const rIncidents = incidents.filter(e => String(e.residentId) === String(id)).slice(-5).reverse();
  const rPpe = ppeList.filter(p => String(p.residentId) === String(id) && p.statut !== 'termine');

  const docCount = ((DB.get(DB.keys.documents)||{})[id]||[]).length;

  const html = `
    <div class="grid grid-4" style="margin-bottom:1.5rem">
      <div class="chx-stat" style="--c:#ef4444"><div class="chx-stat-top"><span class="chx-stat-lbl">Absences (mois)</span><span class="chx-stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></span></div><div class="chx-stat-num">${monthAbsences}</div>${monthTotal ? `<div class="chx-stat-bar"><i style="width:${Math.round(monthAbsences/monthTotal*100)}%"></i></div>` : ''}<div class="chx-stat-sub">${monthTotal ? Math.round(monthAbsences/monthTotal*100)+'%' : '—'}</div></div>
      <div class="chx-stat" style="--c:#2563eb"><div class="chx-stat-top"><span class="chx-stat-lbl">Événements à venir</span><span class="chx-stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span></div><div class="chx-stat-num">${upcomingEvents.length}</div><div class="chx-stat-sub">Sur le planning</div></div>
      <div class="chx-stat" style="--c:#16a34a"><div class="chx-stat-top"><span class="chx-stat-lbl">Avenants actifs</span><span class="chx-stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg></span></div><div class="chx-stat-num">${rPpe.length}</div><div class="chx-stat-sub">${rPpe.length ? (rPpe.filter(p=>p.statut==='actif').length)+' en cours' : 'Aucun'}</div></div>
      <div class="chx-stat" style="--c:#7c3aed"><div class="chx-stat-top"><span class="chx-stat-lbl">Documents</span><span class="chx-stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span></div><div class="chx-stat-num">${docCount}</div><div class="chx-stat-sub">Fichiers attachés</div></div>
    </div>

    <div class="grid grid-2" style="gap:1.5rem">
      <!-- Événements à venir -->
      <div class="card">
        <div class="card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:var(--accent)"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span class="card-title">Événements à venir</span><a href="planning.html" class="btn btn-ghost btn-sm" style="margin-left:auto">Voir tout</a></div>
        <div class="card-body" style="padding:0">
          ${upcomingEvents.length ? upcomingEvents.map(e => `
            <div style="display:flex;align-items:center;gap:.75rem;padding:.75rem 1.25rem;border-bottom:1px solid var(--border)">
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:.875rem">${escHtml(e.titre||'Événement')}</div>
                <div style="font-size:.75rem;color:var(--muted)">${formatDate(e.date)} · ${e.time ? e.time.slice(0,5) : '—'}${e.timeEnd ? ' → '+e.timeEnd.slice(0,5) : ''}</div>
              </div>
              <span class="badge">${e.type||'—'}</span>
            </div>
          `).join('') : '<div class="empty" style="padding:2rem"><p>Aucun événement planifié</p></div>'}
        </div>
      </div>

      <!-- Journal récent -->
      <div class="card">
        <div class="card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:var(--accent)"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><span class="card-title">Journal de bord</span><a href="journal.html" class="btn btn-ghost btn-sm" style="margin-left:auto">Voir tout</a></div>
        <div class="card-body" style="padding:0">
          ${rJournal.length ? rJournal.map(e => {
            const cat = categories.find(c=>String(c.id)===String(e.categorie));
            return `<div style="padding:.75rem 1.25rem;border-bottom:1px solid var(--border)">
              <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:3px">
                ${cat?`<span class="badge" style="background:${escHtml(cat.color)}22;color:${escHtml(cat.color)}">${escHtml(cat.name)}</span>`:''}
                <span style="font-size:.72rem;color:var(--muted)">${formatDateTime(e.date)}</span>
              </div>
              <div style="font-size:.8rem;color:var(--g700)">${escHtml(e.contenu||'')}</div>
            </div>`;
          }).join('') : '<div class="empty" style="padding:2rem"><p>Aucune entrée journal</p></div>'}
        </div>
      </div>

      <!-- Avenants -->
      <div class="card">
        <div class="card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:var(--accent)"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><span class="card-title">Avenants (PPE)</span><a href="ppe.html" class="btn btn-ghost btn-sm" style="margin-left:auto">Voir tout</a></div>
        <div class="card-body" style="padding:0">
          ${rPpe.length ? rPpe.map(p => {
            const totalObj = Object.values(p.sections||{}).reduce((a, s) => a + (s.objectifs?.length||0), 0);
            return `<div style="display:flex;align-items:center;gap:.75rem;padding:.75rem 1.25rem;border-bottom:1px solid var(--border)">
              <div style="flex:1;min-width:0;cursor:pointer" onclick="window.location='ppe.html'">
                <div style="font-weight:600;font-size:.875rem">${escHtml(p.dateRedaction||'?')}</div>
                <div style="font-size:.75rem;color:var(--muted)">${totalObj} objectifs</div>
              </div>
              <span class="badge-ppe ${p.statut}">${STATUT_PPE_LABEL[p.statut]||p.statut}</span>
            </div>`;
          }).join('') : '<div class="empty" style="padding:2rem"><p>Aucun avenant actif</p></div>'}
        </div>
      </div>

      <!-- Incidents -->
      <div class="card">
        <div class="card-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:var(--accent)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span class="card-title">Incidents récents</span><a href="incidents.html" class="btn btn-ghost btn-sm" style="margin-left:auto">Voir tout</a></div>
        <div class="card-body" style="padding:0">
          ${rIncidents.length ? rIncidents.map(e => `
            <div style="display:flex;align-items:center;gap:.75rem;padding:.75rem 1.25rem;border-bottom:1px solid var(--border)">
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:.875rem">${escHtml(e.type||'Incident')}</div>
                <div style="font-size:.75rem;color:var(--muted)">${formatDate(e.date)} · ${escHtml(e.description||'').slice(0,80)}</div>
              </div>
              <span class="badge ${e.gravite === 'grave' ? 'badge-red' : e.gravite === 'modere' ? 'badge-amber' : 'badge-green'}">${e.gravite||'—'}</span>
            </div>
          `).join('') : '<div class="empty" style="padding:2rem"><p>Aucun incident</p></div>'}
        </div>
      </div>
    </div>
  `;

  document.getElementById('drContent').innerHTML = html;
}

document.addEventListener('DOMContentLoaded', loadResidentDashboard);
