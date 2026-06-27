let currentView = 'week';
let currentDate = new Date();
// Mois affiché en premier dans les mini-calendriers (indépendant de la date sélectionnée)
let sidebarBase = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
let _planningEventsCache = [];
let _planningResidentsCache = [];

async function loadPlanningData() {
  [_planningEventsCache, _planningResidentsCache] = await Promise.all([
    sbGetPlanningEvents(), sbGetResidents()
  ]);
}

const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const TYPE_COLORS = { activite:'#3b82f6', rdv:'#ef4444', sortie:'#10b981', reunion:'#8b5cf6', avenant:'#f59e0b', projet:'#06b6d4', evaluation:'#9333ea', autre:'#f59e0b', vehicule:'#6366f1' };
const TYPE_LABELS = { activite:'Activité', rdv:'Rendez-vous', sortie:'Sortie', reunion:'Réunion', avenant:'Avenant', projet:'Projet personnalisé', evaluation:'Évaluation', autre:'Autre', vehicule:'Véhicule' };

function eventOnDay(event, dayStr) {
  if (!event.date) return false;
  if (event.date === dayStr) return true;
  if (event.dateEnd && event.dateEnd >= dayStr && event.date < dayStr) return true;
  return false;
}

function getMondayOf(d) {
  const date = new Date(d);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date;
}

function sameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

function dateStr(d) {
  // Date locale (évite le décalage d'un jour dû à toISOString qui passe en UTC)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Heure locale "AAAA-MM-JJTHH:MM" (toISOString() renvoie de l'UTC, ce qui décale les horaires)
function toLocalDateTimeStr(d) {
  const p = n => String(n).padStart(2,'0');
  return `${dateStr(d)}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Types désactivés dans la légende (vide = tout afficher)
let hiddenTypes = new Set();
let searchQuery = '';

// Détecte un conflit de réservation pour un véhicule sur un créneau donné
// (dateAllerISO/dateRetourISO au format "AAAA-MM-JJTHH:MM"), partagé avec vehicules.js
// puisque les deux pages écrivent dans la même table planning_events.
function getVehiculeConflit(vehicule, dateAllerISO, dateRetourISO, excludeId) {
  const newStart = new Date(dateAllerISO).getTime();
  const newEnd = new Date(dateRetourISO).getTime();
  return _planningEventsCache.find(e => {
    if (e.type !== 'vehicule' || e.vehicule !== vehicule) return false;
    if (excludeId && e.id === excludeId) return false;
    const existStart = new Date(e.date + 'T' + (e.heure || e.time || '00:00')).getTime();
    if (isNaN(existStart)) return false;
    let existEnd = new Date((e.dateEnd || e.date) + 'T' + (e.timeEnd || '23:59')).getTime();
    if (isNaN(existEnd) || !e.dateEnd) existEnd = existStart + (parseInt(e.duree) || 60) * 60000;
    return newStart < existEnd && newEnd > existStart;
  });
}

function getFilteredEvents() {
  const res = document.getElementById('filterEventResident')?.value || '';
  let events = _planningEventsCache;
  if (res) events = events.filter(e => e.residentId === res || !e.residentId);
  if (hiddenTypes.size) events = events.filter(e => !hiddenTypes.has(e.type || 'autre'));
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    events = events.filter(e =>
      (e.titre || '').toLowerCase().includes(q) ||
      (e.residentName || '').toLowerCase().includes(q)
    );
  }
  return events;
}

// Légende cliquable servant aussi de filtre par type
function renderTypeLegend() {
  const el = document.getElementById('typeLegend');
  if (!el) return;
  const types = Object.keys(TYPE_LABELS).filter(t => t !== 'vehicule');
  el.innerHTML = types.map(t => {
    const off = hiddenTypes.has(t);
    return `<span class="lg-chip${off?' off':''}" onclick="toggleType('${t}')">
      <span class="lg-dot" style="background:${TYPE_COLORS[t]||'#3b82f6'}"></span>${TYPE_LABELS[t]}
    </span>`;
  }).join('');
}

function toggleType(t) {
  if (hiddenTypes.has(t)) hiddenTypes.delete(t); else hiddenTypes.add(t);
  render();
}

const PL_DAY_START = 7;   // 7h
const PL_DAY_END = 21;    // 21h
const PL_HOUR_H = 52;     // px par heure
const PL_BAND_W = 5;      // largeur d'une bande latérale (px)
const PL_CONTENT_MIN = 55;// durée (min) considérée pour le chevauchement des blocs de contenu

function evStartMin(ev) {
  const t = (ev.heure || ev.time || '09:00');
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function evDurMin(ev) {
  if (ev.duree === 'journee') return (PL_DAY_END - PL_DAY_START) * 60;
  const d = parseInt(ev.duree);
  return isNaN(d) ? 60 : d;
}

// Assigne des colonnes (col/ncols) à un ensemble d'items selon le chevauchement
// de l'intervalle [sKey, eKey], en regroupant par grappes.
function assignColumns(items, sKey, eKey, colKey, nKey) {
  const sorted = [...items].sort((a, b) => a[sKey] - b[sKey] || a[eKey] - b[eKey]);
  let clusters = [], cur = [], curEnd = -1;
  sorted.forEach(it => {
    if (cur.length && it[sKey] >= curEnd) { clusters.push(cur); cur = []; curEnd = -1; }
    cur.push(it); curEnd = Math.max(curEnd, it[eKey]);
  });
  if (cur.length) clusters.push(cur);
  clusters.forEach(cluster => {
    const colEnds = [];
    cluster.forEach(it => {
      let placed = false;
      for (let i = 0; i < colEnds.length; i++) {
        if (colEnds[i] <= it[sKey]) { it[colKey] = i; colEnds[i] = it[eKey]; placed = true; break; }
      }
      if (!placed) { it[colKey] = colEnds.length; colEnds.push(it[eKey]); }
    });
    cluster.forEach(it => it[nKey] = colEnds.length);
  });
}

// Répartit les événements d'une journée :
//  - bandCol/bandN : empilement des fines bandes latérales (selon la durée totale)
//  - contentCol/contentN : colonnes des blocs de contenu (selon la hauteur du texte seulement)
// Ainsi un événement qui ne chevauche que la « traîne » (bande) d'un autre prend toute la largeur.
function layoutDayEvents(evs) {
  const items = evs.map(ev => {
    const start = evStartMin(ev);
    return { ev, start, end: start + evDurMin(ev), cStart: start, cEnd: start + PL_CONTENT_MIN };
  });
  assignColumns(items, 'start', 'end', 'bandCol', 'bandN');       // bandes (durée réelle)
  assignColumns(items, 'cStart', 'cEnd', 'contentCol', 'contentN'); // blocs (hauteur de texte)
  return items.sort((a, b) => a.start - b.start);
}

function getRecurDates(startDate, freq, until) {
  const dates = [];
  const cur = new Date(startDate + 'T12:00:00');
  const end = new Date(until + 'T12:00:00');
  let guard = 0;
  while (cur <= end && guard++ < 200) {
    dates.push(dateStr(cur));
    if (freq === 'daily')     cur.setDate(cur.getDate() + 1);
    else if (freq === 'weekly')    cur.setDate(cur.getDate() + 7);
    else if (freq === 'biweekly')  cur.setDate(cur.getDate() + 14);
    else if (freq === 'monthly')   cur.setMonth(cur.getMonth() + 1);
    else break;
  }
  return dates;
}

function getConflictIds(dayEvents) {
  const ids = new Set();
  for (let i = 0; i < dayEvents.length; i++) {
    if (!dayEvents[i].residentId) continue;
    for (let j = i + 1; j < dayEvents.length; j++) {
      if (dayEvents[j].residentId !== dayEvents[i].residentId) continue;
      const si = evStartMin(dayEvents[i]), ei = si + evDurMin(dayEvents[i]);
      const sj = evStartMin(dayEvents[j]), ej = sj + evDurMin(dayEvents[j]);
      if (si < ej && ei > sj) { ids.add(dayEvents[i].id); ids.add(dayEvents[j].id); }
    }
  }
  return ids;
}

function renderWeek() {
  const monday = getMondayOf(currentDate);
  const days = Array.from({length:7}, (_,i) => { const d=new Date(monday); d.setDate(d.getDate()+i); return d; });
  document.getElementById('calTitle').textContent = `${monday.getDate()} ${MONTHS[monday.getMonth()]} — ${days[6].getDate()} ${MONTHS[days[6].getMonth()]} ${days[6].getFullYear()}`;
  renderTimeline(days);
}

function renderDay() {
  const d = new Date(currentDate);
  document.getElementById('calTitle').textContent = `${DAYS[d.getDay()===0?6:d.getDay()-1]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  renderTimeline([d]);
}

// Rendu générique de la timeline (1 jour ou 7 jours)
function renderTimeline(days) {
  const todayD = new Date();
  const events = getFilteredEvents();
  const nHours = PL_DAY_END - PL_DAY_START;
  const bodyH = nHours * PL_HOUR_H;
  const gridBg = `repeating-linear-gradient(to bottom, var(--g100) 0 1px, transparent 1px ${PL_HOUR_H}px)`;
  const headCols = `56px repeat(${days.length},1fr)`;
  const daysCols = `repeat(${days.length},1fr)`;

  // Position de la ligne « maintenant »
  const nowMin = todayD.getHours()*60 + todayD.getMinutes();
  const showNow = nowMin >= PL_DAY_START*60 && nowMin <= PL_DAY_END*60;
  const nowTop = (nowMin - PL_DAY_START*60) / 60 * PL_HOUR_H;
  const weekHasToday = days.some(d => sameDay(d, todayD));

  // En-tête : année + jours
  const head = `<div class="pl-week-head" style="grid-template-columns:${headCols}">
    <div class="plh-year">${days[0].getFullYear()}</div>
    ${days.map(d => {
      const isTod = sameDay(d, todayD);
      return `<div class="plh-day${isTod?' is-today':''}">
        <div class="plh-dow">${DAYS[d.getDay()===0?6:d.getDay()-1].slice(0, days.length===1?20:3)}</div>
        <div class="plh-num">${d.getDate()}</div>
      </div>`;
    }).join('')}
  </div>`;

  // Colonne des heures
  const timeCol = `<div class="pl-time-col" style="height:${bodyH}px">
    ${Array.from({length:nHours+1}, (_,i) => {
      const h = PL_DAY_START + i;
      return `<div class="plt-label" style="top:${i*PL_HOUR_H}px">${h} h</div>`;
    }).join('')}
  </div>`;

  // Colonnes des jours avec événements positionnés
  const dayCols = days.map(d => {
    const dStr = dateStr(d);
    const dayEvents = events.filter(e => eventOnDay(e, dStr) && (e.heure || e.time));
    const conflictIds = getConflictIds(dayEvents);
    const laid = layoutDayEvents(dayEvents);
    const blocks = laid.map(it => {
      const ev = it.ev;
      const isConflict = conflictIds.has(ev.id);
      const top = Math.max(0, (it.start - PL_DAY_START*60) / 60 * PL_HOUR_H);
      const fullH = Math.max(20, (it.end - it.start) / 60 * PL_HOUR_H - 2);
      const bg = escHtml(ev.color) || TYPE_COLORS[ev.type] || '#3b82f6';
      const veh = ev.vehicule ? '🚗 ' : '';
      const bandLeft = it.bandCol * PL_BAND_W;
      const inset = it.bandN * PL_BAND_W + 2;
      const colW = `((100% - ${inset + 2}px) / ${it.contentN})`;
      const cLeft = `calc(${inset}px + ${it.contentCol} * ${colW})`;
      const cWidth = `calc(${colW} - 2px)`;
      return `<div class="pl-ev-wrap" style="top:${top}px;height:${fullH}px;left:0;width:100%" onclick="event.stopPropagation();viewEvent('${ev.id}')" title="${ev.residentName?escHtml(ev.residentName)+' — ':''}${escHtml(ev.titre)}${ev.vehicule?' — 🚗 '+escHtml(ev.vehicule):''}">
        <div class="pl-ev-band" style="left:${bandLeft}px;background:${bg}"></div>
        <div class="pl-ev${isConflict?' pl-ev-conflict':''}" style="left:${cLeft};width:${cWidth};background:${bg}">
          ${isConflict?'<span class="pl-ev-conflict-ic">⚠</span>':''}
          <div class="pl-ev-time">${veh}${(ev.heure||ev.time||'').slice(0,5)}${ev.recurId?' <span style="opacity:.75;font-size:.55rem">↻</span>':''}</div>
          <div class="pl-ev-title">${escHtml(ev.titre)}</div>
        </div>
      </div>`;
    }).join('');
    const nowLine = (sameDay(d, todayD) && showNow) ? `<div class="pl-now" style="top:${nowTop}px"></div>` : '';
    return `<div class="pl-day" style="height:${bodyH}px;background:${gridBg}" onclick="quickAddFromClick(event,'${dStr}')">${nowLine}${blocks}</div>`;
  }).join('');

  const html = `<div class="pl-week">
    ${head}
    <div class="pl-week-body">
      ${timeCol}
      <div class="pl-days" style="grid-template-columns:${daysCols}">${dayCols}</div>
    </div>
  </div>`;
  document.getElementById('calContainer').innerHTML = html;

  // Défilement auto : vers l'heure actuelle si la période contient aujourd'hui, sinon vers 8 h
  const body = document.querySelector('.pl-week-body');
  if (body) {
    const target = (weekHasToday && showNow) ? nowTop : (8 - PL_DAY_START) * PL_HOUR_H;
    body.scrollTop = Math.max(0, target - 90);
  }
}

// Clic sur une zone vide d'une journée → pré-remplit l'heure d'après la position verticale
function quickAddFromClick(e, dStr) {
  const rect = e.currentTarget.getBoundingClientRect();
  const y = e.clientY - rect.top;
  let h = PL_DAY_START + Math.floor(y / PL_HOUR_H);
  h = Math.max(PL_DAY_START, Math.min(PL_DAY_END - 1, h));
  quickAddEvent(dStr, String(h).padStart(2,'0') + ':00');
}

// ── Mini-calendriers (barre latérale) ──
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function renderMiniCalendars() {
  const el = document.getElementById('planningSidebar');
  if (!el) return;
  const base = sidebarBase;
  let html = '';
  for (let k = 0; k < 3; k++) {
    html += miniMonth(new Date(base.getFullYear(), base.getMonth() + k, 1), k === 0);
  }
  el.innerHTML = html;
}

function miniMonth(monthDate, withNav) {
  const y = monthDate.getFullYear(), m = monthDate.getMonth();
  const todayD = new Date();
  const weekMon = getMondayOf(currentDate);
  const weekDays = Array.from({length:7}, (_,i) => { const d=new Date(weekMon); d.setDate(d.getDate()+i); return dateStr(d); });
  const first = new Date(y, m, 1);
  const startDay = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const gridStart = new Date(y, m, 1 - startDay);

  let cells = '';
  const dows = ['Lu','Ma','Me','Je','Ve','Sa','Di'];
  cells += `<div class="mg-cell mg-wh"></div>` + dows.map(d => `<div class="mg-cell mg-wh">${d}</div>`).join('');
  for (let w = 0; w < 6; w++) {
    const rowStart = new Date(gridStart); rowStart.setDate(gridStart.getDate() + w*7);
    if (w > 0 && rowStart.getMonth() !== m && !(w === 0)) { /* keep simple */ }
    cells += `<div class="mg-cell mg-wk">${isoWeek(rowStart)}</div>`;
    for (let i = 0; i < 7; i++) {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + w*7 + i);
      const ds = dateStr(d);
      const out = d.getMonth() !== m;
      const isTod = sameDay(d, todayD);
      const inWeek = weekDays.includes(ds);
      const cls = ['mg-cell','mg-day', out?'mg-out':'', inWeek?'mg-inweek':'', isTod?'mg-today':''].filter(Boolean).join(' ');
      cells += `<div class="${cls}" onclick="goToDate('${ds}')">${d.getDate()}</div>`;
    }
    // arrêter si la semaine suivante déborde entièrement du mois
    const nextRow = new Date(gridStart); nextRow.setDate(gridStart.getDate() + (w+1)*7);
    if (nextRow.getMonth() !== m && nextRow > new Date(y, m+1, 0)) break;
  }

  const nav = withNav
    ? `<button onclick="event.stopPropagation();shiftSidebar(-1)" title="Mois précédent">‹</button>
       <span class="mc-title">${MONTHS[m]} ${y}</span>
       <button onclick="event.stopPropagation();shiftSidebar(1)" title="Mois suivant">›</button>`
    : `<span style="width:20px"></span><span class="mc-title">${MONTHS[m]} ${y}</span><span style="width:20px"></span>`;

  return `<div class="mini-cal">
    <div class="mini-cal-head">${nav}</div>
    <div class="mini-grid">${cells}</div>
  </div>`;
}

function goToDate(ds) {
  // Sélectionne la date sans déplacer les 3 mois affichés dans la barre latérale
  currentDate = new Date(ds + 'T12:00:00');
  if (currentView === 'week') renderWeek();
  else renderMonth();
  renderMiniCalendars(); // met à jour le surlignage de la semaine, sans changer sidebarBase
}

// Fait défiler les mini-calendriers d'un mois (flèches), sans changer la date sélectionnée
function shiftSidebar(dir) {
  sidebarBase = new Date(sidebarBase.getFullYear(), sidebarBase.getMonth() + dir, 1);
  renderMiniCalendars();
}

function renderMonth() {
  const y = currentDate.getFullYear(), m = currentDate.getMonth();
  document.getElementById('calTitle').textContent = `${MONTHS[m]} ${y}`;
  const first = new Date(y, m, 1);
  const last = new Date(y, m+1, 0);
  const startDay = first.getDay() === 0 ? 6 : first.getDay()-1;
  const events = getFilteredEvents();
  const todayD = new Date();

  let cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(y, m, d));

  const head = DAYS.map(d => `<div class="plm-dow">${d.slice(0,3)}</div>`).join('');

  const grid = cells.map(d => {
    if (!d) return `<div class="plm-cell plm-empty"></div>`;
    const isTod = sameDay(d, todayD);
    const dayEvs = events.filter(e => eventOnDay(e, dateStr(d)));
    const num = `<div class="plm-num${isTod?' is-today':''}">${d.getDate()}</div>`;
    const evHtml = dayEvs.map(ev => {
      const bg = escHtml(ev.color) || TYPE_COLORS[ev.type] || '#3b82f6';
      const time = (ev.heure || ev.time || '').slice(0, 5);
      const label = (time ? time + ' ' : '') + escHtml(ev.titre);
      return '<div class="plm-ev" onclick="event.stopPropagation();viewEvent(\'' + ev.id + '\')">'
        + '<span class="plm-ev-band" style="background:' + bg + '"></span>'
        + '<span class="plm-ev-txt">' + label + '</span>'
        + '</div>';
    }).join('');
    const more = '';
    return `<div class="plm-cell${isTod ? ' plm-today' : ''}" onclick="quickAddEvent('${dateStr(d)}','')">
      ${num}${evHtml}${more}
    </div>`;
  }).join('');

  document.getElementById('calContainer').innerHTML =
    '<div class="card" style="overflow:hidden;padding:0">'
    + '<div class="plm-head">' + head + '</div>'
    + '<div class="plm-grid">' + grid + '</div>'
    + '</div>';
}

function renderListView() {
  const events = (getFilteredEvents()).sort((a,b) => ((a.date||'')+(a.heure||a.time||'')) > ((b.date||'')+(b.heure||b.time||'')) ? 1 : -1);
  document.getElementById('calTitle').textContent = 'Tous les événements';
  document.getElementById('calContainer').style.display = 'none';
  const listEl = document.getElementById('listContainer');
  listEl.style.display = '';
  const tbody = document.getElementById('eventTableBody');
  if (!events.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--muted)">Aucun événement planifié</td></tr>`;
    return;
  }
  tbody.innerHTML = events.map(ev => `<tr>
    <td><span style="display:inline-flex;align-items:center;gap:.4rem"><span style="width:10px;height:10px;border-radius:50%;background:${escHtml(ev.color)||TYPE_COLORS[ev.type]||'#3b82f6'};flex-shrink:0"></span><strong>${ev.vehicule?'🚗 ':''}${ev.residentName?escHtml(ev.residentName)+' — ':''}${escHtml(ev.titre)}</strong></span></td>
    <td>${escHtml(ev.residentName)||'Tous'}</td>
    <td>${ev.date ? formatDate(ev.date) : '—'}</td>
    <td>${ev.heure||ev.time||'—'}</td>
    <td><span class="badge badge-gray">${TYPE_LABELS[ev.type]||ev.type||'—'}</span></td>
    <td><div class="table-actions"><button class="btn btn-ghost btn-sm" onclick="editEvent('${ev.id}')">Modifier</button></div></td>
  </tr>`).join('');
}

function render() {
  document.getElementById('calContainer').style.display = '';
  document.getElementById('listContainer').style.display = 'none';
  const sidebar = document.getElementById('planningSidebar');
  if (sidebar) {
    if (currentView === 'list') { sidebar.style.display = 'none'; }
    else { sidebar.style.display = ''; renderMiniCalendars(); }
  }
  const legend = document.getElementById('typeLegend');
  if (legend) { legend.style.display = currentView === 'list' ? 'none' : ''; renderTypeLegend(); }
  if (currentView === 'day') renderDay();
  else if (currentView === 'week') renderWeek();
  else if (currentView === 'month') renderMonth();
  else renderListView();
}

function navigate(dir) {
  if (currentView === 'day') currentDate.setDate(currentDate.getDate() + dir);
  else if (currentView === 'week') currentDate.setDate(currentDate.getDate() + dir*7);
  else if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() + dir);
  sidebarBase = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  render();
}

function quickAddEvent(date, heure) {
  document.getElementById('evDate').value = date;
  document.getElementById('evHeure').value = heure || '09:00';
  document.getElementById('btnDeleteEvent').style.display = 'none';
  document.getElementById('modalEventTitle').textContent = 'Nouvel événement';
  document.getElementById('eventId').value = '';
  resetVehiculeFields();
  const recurRow = document.getElementById('evRecurRow');
  if (recurRow) recurRow.style.display = '';
  const evRecur = document.getElementById('evRecur');
  if (evRecur) evRecur.value = '';
  const recurUntilWrap = document.getElementById('evRecurUntilWrap');
  if (recurUntilWrap) recurUntilWrap.style.display = 'none';
  openModal('modalEvent');
}

function resetVehiculeFields() {
  const cb = document.getElementById('evVehiculeCheck');
  if (cb) { cb.checked = false; document.getElementById('evVehiculeFields').style.display = 'none'; }
  const veh = document.getElementById('evVehicule'); if (veh) veh.value = '';
  const dest = document.getElementById('evDestination'); if (dest) dest.value = '';
  const mot = document.getElementById('evMotif'); if (mot) mot.value = '';
}

// Affiche les détails d'un événement en lecture seule (fenêtre flipYIn)
function viewEvent(id) {
  const ev = _planningEventsCache.find(e => e.id === id);
  if (!ev) return;
  const color = escHtml(ev.color) || TYPE_COLORS[ev.type] || '#3b82f6';
  const dureeLabels = { '30':'30 min', '60':'1h', '90':'1h30', '120':'2h', '180':'3h', 'journee':'Journée' };
  const dureeLabel = dureeLabels[ev.duree] || (ev.duree ? ev.duree + ' min' : '');
  const heure = (ev.heure || ev.time || '').slice(0,5);
  const row = (ic, lbl, val) => val ? `<div class="ev-detail-row"><div class="ev-detail-ic">${ic}</div><div style="min-width:0"><div class="ev-detail-lbl">${lbl}</div><div class="ev-detail-val">${val}</div></div></div>` : '';

  let body = `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.25rem"><span style="width:14px;height:14px;border-radius:4px;background:${color};flex-shrink:0"></span><span class="badge badge-gray">${TYPE_LABELS[ev.type] || ev.type || '—'}</span></div>`;
  body += row('👤', 'Résident', ev.residentName ? escHtml(ev.residentName) : 'Tous / Groupe');
  body += row('📅', 'Date', ev.date ? formatDate(ev.date) : '—');
  body += row('🕒', 'Horaire', [heure, dureeLabel].filter(Boolean).join(' · '));
  body += row('📝', 'Description', ev.desc ? escHtml(ev.desc) : '');
  if (ev.vehicule) {
    body += row('🚗', 'Véhicule', escHtml(ev.vehicule));
    body += row('📍', 'Destination', ev.destination ? escHtml(ev.destination) : '');
    body += row('🎯', 'Motif', ev.motif ? escHtml(ev.motif) : '');
  }

  document.getElementById('evViewTitle').textContent = ev.titre || 'Détails du rendez-vous';
  document.getElementById('evViewBody').innerHTML = body;
  document.getElementById('evViewEdit').onclick = () => { closeModal('modalEventView'); editEvent(id); };
  document.getElementById('evViewDelete').onclick = () => { document.getElementById('eventId').value = id; deleteEvent(); };
  const seriesBtn = document.getElementById('evViewDeleteSeries');
  if (seriesBtn) {
    if (ev.recurId) {
      const cnt = _planningEventsCache.filter(e => e.recurId === ev.recurId).length;
      seriesBtn.style.display = '';
      seriesBtn.textContent = `↻ Série (${cnt})`;
      seriesBtn.onclick = () => deleteEventSeries(ev.recurId);
    } else { seriesBtn.style.display = 'none'; }
  }
  openModal('modalEventView');
}

function editEvent(id) {
  const ev = _planningEventsCache.find(e => e.id === id);
  if (!ev) return;
  document.getElementById('modalEventTitle').textContent = 'Modifier l\'événement';
  document.getElementById('eventId').value = id;
  document.getElementById('evTitre').value = ev.titre || '';
  document.getElementById('evResident').value = ev.residentId || '';
  document.getElementById('evType').value = ev.type || 'activite';
  document.getElementById('evDate').value = ev.date || '';
  document.getElementById('evHeure').value = ev.heure || ev.time || '09:00';
  document.getElementById('evDuree').value = ev.duree || '60';
  document.getElementById('evColor').value = ev.color || '#3b82f6';
  document.getElementById('evDesc').value = ev.desc || '';
  document.getElementById('btnDeleteEvent').style.display = '';
  // Masquer la récurrence en mode édition (on édite un seul événement)
  const recurRow = document.getElementById('evRecurRow');
  if (recurRow) recurRow.style.display = 'none';
  const cb = document.getElementById('evVehiculeCheck');
  const hasVeh = ev.vehicule;
  if (cb) cb.checked = !!hasVeh;
  const vf = document.getElementById('evVehiculeFields');
  if (vf) vf.style.display = hasVeh ? 'flex' : 'none';
  const veh = document.getElementById('evVehicule'); if (veh) veh.value = ev.vehicule || '';
  const dest = document.getElementById('evDestination'); if (dest) dest.value = ev.destination || '';
  const mot = document.getElementById('evMotif'); if (mot) mot.value = ev.motif || '';
  openModal('modalEvent');
}

async function saveEvent() {
  const titre = document.getElementById('evTitre').value.trim();
  if (!titre) { toast('Le titre est requis', 'error'); return; }
  const residentId = document.getElementById('evResident').value;
  const residents = _planningResidentsCache;
  const res = residents.find(r => r.id === residentId);
  const id = document.getElementById('eventId').value;
  const recur = document.getElementById('evRecur')?.value || '';
  const recurUntil = document.getElementById('evRecurUntil')?.value || '';
  const data = {
    titre,
    residentId,
    residentName: res ? `${res.prenom||''} ${res.nom||''}`.trim() : '',
    type: document.getElementById('evType').value,
    date: document.getElementById('evDate').value,
    time: document.getElementById('evHeure').value,
    heure: document.getElementById('evHeure').value,
    duree: document.getElementById('evDuree').value,
    color: document.getElementById('evColor').value,
    desc: document.getElementById('evDesc').value.trim()
  };
  const vehCb = document.getElementById('evVehiculeCheck');
  if (vehCb && vehCb.checked) {
    const vehicule = document.getElementById('evVehicule').value.trim();
    const destination = document.getElementById('evDestination').value.trim();
    if (!vehicule || !destination) {
      toast('Veuillez remplir le véhicule et la destination', 'error');
      return;
    }
    const dateAllerISO = data.date + 'T' + (data.heure || '00:00');
    let dateRetourISO;
    if (data.duree === 'journee') {
      dateRetourISO = data.date + 'T23:59';
    } else {
      const d = new Date(dateAllerISO);
      d.setMinutes(d.getMinutes() + (parseInt(data.duree) || 60));
      dateRetourISO = toLocalDateTimeStr(d);
    }
    const conflit = getVehiculeConflit(vehicule, dateAllerISO, dateRetourISO, id || undefined);
    if (conflit) {
      toast(`❌ Véhicule déjà réservé sur ce créneau horaire (du ${formatDateTime(conflit.date+'T'+(conflit.heure||conflit.time||'00:00'))} au ${formatDateTime((conflit.dateEnd||conflit.date)+'T'+(conflit.timeEnd||'23:59'))}${conflit.reservedBy ? ' par '+conflit.reservedBy : ''})`, 'error');
      return;
    }
    const session = Auth.getSession();
    data.vehicule = vehicule;
    data.destination = destination;
    data.motif = document.getElementById('evMotif').value.trim();
    data.type = 'vehicule'; // pour apparaître dans les réservations (page Véhicules)
    data.dateEnd = dateRetourISO.slice(0,10);
    data.timeEnd = dateRetourISO.slice(11,16);
    data.reservedBy = session ? ([session.prenom, session.nom].filter(Boolean).join(' ') || session.username) : '';
    data.reservedPrenom = session?.prenom || '';
  } else {
    delete data.vehicule;
    delete data.destination;
    delete data.motif;
  }
  try {
    // Création d'une série récurrente
    if (!id && recur && recurUntil && recurUntil >= data.date) {
      const dates = getRecurDates(data.date, recur, recurUntil);
      if (!dates.length) { toast('Plage de dates invalide', 'error'); return; }
      const recurId = genId();
      const newEvs = dates.map(date => ({ ...data, date, recurId, recurFreq: recur, recurUntil }));
      const saved = await sbSavePlanningEventsBulk(newEvs);
      _planningEventsCache.push(...saved);
      for (const ev of saved) await syncEventToResidentRdv(ev);
      toast(`${dates.length} événement${dates.length > 1 ? 's créés' : ' créé'}`);
      closeAllModals(); render(); return;
    }

    let finalEvent;
    if (id) {
      finalEvent = await sbSavePlanningEvent({ ...data, id });
      const idx = _planningEventsCache.findIndex(e => e.id === id);
      if (idx !== -1) _planningEventsCache[idx] = finalEvent;
      toast('Événement mis à jour');
    } else {
      finalEvent = await sbSavePlanningEvent(data);
      _planningEventsCache.push(finalEvent);
      toast('Événement ajouté');
    }
    await syncEventToResidentRdv(finalEvent);
    if (finalEvent.residentId && finalEvent.date) {
      const sameDayEvs = _planningEventsCache.filter(e => e.id !== finalEvent.id && e.residentId === finalEvent.residentId && e.date === finalEvent.date && e.type !== 'vehicule');
      const fStart = evStartMin(finalEvent), fEnd = fStart + evDurMin(finalEvent);
      const conflicts = sameDayEvs.filter(e => { const s = evStartMin(e), en = s + evDurMin(e); return fStart < en && fEnd > s; });
      if (conflicts.length) toast('⚠️ Conflit détecté : ' + conflicts.map(c => c.titre).join(', '), 'error');
    }
  } catch (e) {
    toast('Erreur lors de l\'enregistrement', 'error');
    console.error(e);
    return;
  }
  closeAllModals();
  render();
}

// Synchronise un événement planning de type "rdv" vers la fiche du résident (sante.rdv)
async function syncEventToResidentRdv(event) {
  if (!event) return;
  const setEventLink = async (santeRdvId) => {
    const ev = _planningEventsCache.find(e => e.id === event.id);
    if (!ev) return;
    if (santeRdvId) ev.santeRdvId = santeRdvId; else delete ev.santeRdvId;
    const saved = await sbSavePlanningEvent(ev);
    const idx = _planningEventsCache.findIndex(e => e.id === event.id);
    if (idx !== -1) _planningEventsCache[idx] = saved;
  };

  // Pas (ou plus) un RDV → retirer le lien éventuel
  if (event.type !== 'rdv' || !event.residentId) {
    if (event.santeRdvId && event.residentId) {
      const r = _planningResidentsCache.find(x => String(x.id) === String(event.residentId));
      if (r && r.sante && Array.isArray(r.sante.rdv)) {
        r.sante.rdv = r.sante.rdv.filter(x => x.id !== event.santeRdvId);
        const saved = await sbSaveResident(r);
        const idx = _planningResidentsCache.findIndex(x => x.id === r.id);
        if (idx !== -1) _planningResidentsCache[idx] = saved;
      }
    }
    if (event.santeRdvId) await setEventLink(null);
    return;
  }

  const r = _planningResidentsCache.find(x => String(x.id) === String(event.residentId));
  if (!r) return;
  if (!r.sante) r.sante = {};
  if (!Array.isArray(r.sante.rdv)) r.sante.rdv = [];

  const rdvData = {
    date: event.date,
    heure: event.time || event.heure || '',
    type: event.titre || 'Rendez-vous',
    lieu: event.destination || '',
    notes: event.desc || '',
    planningId: event.id
  };

  let santeRdvId = event.santeRdvId;
  let idx = santeRdvId ? r.sante.rdv.findIndex(x => x.id === santeRdvId) : -1;
  if (idx < 0) { idx = r.sante.rdv.findIndex(x => x.planningId === event.id); if (idx >= 0) santeRdvId = r.sante.rdv[idx].id; }
  if (idx >= 0) {
    r.sante.rdv[idx] = { ...r.sante.rdv[idx], ...rdvData };
  } else {
    santeRdvId = genId();
    r.sante.rdv.push({ id: santeRdvId, fait: false, ...rdvData });
  }
  const savedR = await sbSaveResident(r);
  const rIdx = _planningResidentsCache.findIndex(x => x.id === r.id);
  if (rIdx !== -1) _planningResidentsCache[rIdx] = savedR;
  if (event.santeRdvId !== santeRdvId) await setEventLink(santeRdvId);
}

function deleteEventSeries(recurId) {
  const seriesEvs = _planningEventsCache.filter(e => e.recurId === recurId);
  confirmDialog(`Supprimer les ${seriesEvs.length} événements de cette série ?`, async () => {
    try {
      for (const ev of seriesEvs) {
        if (ev.santeRdvId && ev.residentId) {
          const r = _planningResidentsCache.find(x => String(x.id) === String(ev.residentId));
          if (r?.sante?.rdv) {
            r.sante.rdv = r.sante.rdv.filter(x => x.id !== ev.santeRdvId);
            const saved = await sbSaveResident(r);
            const idx = _planningResidentsCache.findIndex(x => x.id === r.id);
            if (idx !== -1) _planningResidentsCache[idx] = saved;
          }
        }
      }
      await sbDeletePlanningEventSeries(recurId);
    } catch (e) { toast('Erreur lors de la suppression', 'error'); console.error(e); return; }
    _planningEventsCache = _planningEventsCache.filter(e => e.recurId !== recurId);
    closeAllModals(); render();
    toast(`${seriesEvs.length} événements supprimés`, 'info');
  });
}

function deleteEvent() {
  const id = document.getElementById('eventId').value;
  confirmDialog('Supprimer cet événement ?', async () => {
    const ev = _planningEventsCache.find(e => e.id === id);
    try {
      await sbDeletePlanningEvent(id);
      // Retirer le RDV lié dans la fiche résident
      if (ev && ev.santeRdvId && ev.residentId) {
        const r = _planningResidentsCache.find(x => String(x.id) === String(ev.residentId));
        if (r && r.sante && Array.isArray(r.sante.rdv)) {
          r.sante.rdv = r.sante.rdv.filter(x => x.id !== ev.santeRdvId);
          const saved = await sbSaveResident(r);
          const idx = _planningResidentsCache.findIndex(x => x.id === r.id);
          if (idx !== -1) _planningResidentsCache[idx] = saved;
        }
      }
    } catch (e) { toast('Erreur lors de la suppression', 'error'); console.error(e); return; }
    _planningEventsCache = _planningEventsCache.filter(e => e.id !== id);
    closeAllModals();
    render();
    toast('Événement supprimé', 'info');
  });
}

function populateResidentSelect() {
  const residents = _planningResidentsCache.filter(r=>r.statut!=='sorti');
  [document.getElementById('evResident'), document.getElementById('filterEventResident')].forEach(sel => {
    if (!sel) return;
    residents.forEach(r => { const o=document.createElement('option'); o.value=r.id; o.textContent=`${r.prenom||''} ${r.nom||''}`.trim(); sel.appendChild(o); });
  });
}

function populateVehiculeList() {
  const list = document.getElementById('evVehiculeList');
  if (!list) return;
  const vehicules = DB.get(DB.keys.vehicules) || [];
  list.innerHTML = vehicules.map(v => `<option value="${escHtml(v)}"/>`).join('');
}

async function initPlanning() {
  if (!requireModule('access_presences')) return;
  document.getElementById('evDate').value = today();
  await loadPlanningData();
  populateResidentSelect();
  populateVehiculeList();
  render();
  document.getElementById('prevBtn').onclick = () => navigate(-1);
  document.getElementById('nextBtn').onclick = () => navigate(1);
  document.getElementById('todayBtn').onclick = () => { currentDate = new Date(); sidebarBase = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1); render(); };
  document.getElementById('filterEventResident').onchange = render;
  const searchEl = document.getElementById('searchEvent');
  if (searchEl) searchEl.oninput = () => { searchQuery = searchEl.value.trim(); render(); };
  if (window.innerWidth < 640) { currentView = 'day'; setViewBtn('viewDay'); }
  window.addEventListener('resize', () => {
    if (window.innerWidth < 640 && currentView !== 'day') { currentView = 'day'; setViewBtn('viewDay'); render(); }
  });
  document.getElementById('viewDay').onclick = () => { currentView='day'; setViewBtn('viewDay'); document.getElementById('listContainer').style.display='none'; render(); };
  document.getElementById('viewWeek').onclick = () => { currentView='week'; setViewBtn('viewWeek'); document.getElementById('listContainer').style.display='none'; render(); };
  document.getElementById('viewMonth').onclick = () => { currentView='month'; setViewBtn('viewMonth'); document.getElementById('listContainer').style.display='none'; render(); };
  document.getElementById('viewList').onclick = () => { currentView='list'; setViewBtn('viewList'); render(); };
}
document.addEventListener('DOMContentLoaded', initPlanning);
if (typeof registerPageInit === 'function') registerPageInit('planning', initPlanning);

function setViewBtn(active) {
  ['viewDay','viewWeek','viewMonth','viewList'].forEach(id => {
    const btn = document.getElementById(id);
    if (id === active) { btn.style.background='#fff'; btn.style.boxShadow='var(--shadow-sm)'; btn.classList.remove('btn-ghost'); }
    else { btn.style.background=''; btn.style.boxShadow=''; btn.classList.add('btn-ghost'); }
  });
}
