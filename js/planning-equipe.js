let peWeekStart = peGetMonday(new Date());
let _peCtx = null;
let peViewMode = 'semaine'; // 'semaine' | 'mois'
let peMonthCursor = (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();
let peMetierFilter = ''; // '' = tous les métiers, sinon valeur de e.poste
let _peLastDays = [];

// Caches Supabase
let _peShiftsCache = [];
let _peEmployesCache = [];
let _peAbsencesCache = [];
let _peCongesCache = [];
let _pePointagesCache = [];

// ── Statut de pointage (synchro avec pointage.html) ──
// Le planning équipe identifie le personnel par l'ID du compte utilisateur, alors que les
// pointages sont stockés par ID de fiche employé (DB.keys.employes). On résout la correspondance
// par prénom+nom, comme dans pointage.js (ptResolveUserId), mais en sens inverse.
// Les fiches employé sont désormais la source unique : l'id du créneau = l'id de la fiche.
function peResolveEmployeFicheId(emp) {
  return emp ? emp.id : null;
}

function pePointageStatus(ficheId, dateStr) {
  if (!ficheId) return null;
  const entry = _pePointagesCache.find(p => String(p.employeId) === String(ficheId) && p.date === dateStr);
  if (!entry || !entry.arrivee || !entry.depart) return null;
  return entry.valide ? 'valide' : 'attente';
}

// ── Absences & AT (table Supabase absences_at) ──
function peIsAbsent(ficheId, dateStr) {
  if (!ficheId) return false;
  return _peAbsencesCache.some(a =>
    String(a.employeId) === String(ficheId) && dateStr >= a.debut && (!a.fin || dateStr <= a.fin)
  );
}

function getPeEmployes() {
  return _peEmployesCache
    .filter(e => e.statut !== 'inactif')
    .map(e => ({
      id: String(e.id),
      prenom: e.prenom || '',
      nom: e.nom || '',
      poste: e.poste || '',
      statut: e.statut || 'actif',
      heuresContrat: e.heuresContrat ?? 35,
      profileId: e.profileId || null
    }));
}

async function initPlanningEquipe() {
  const _s = Auth.requireAuth();
  if (!_s) return;
  if (!requireModule('access_planning_equipe')) return;
  peWeekStart = peGetMonday(new Date());
  try {
    [_peShiftsCache, _peEmployesCache, _peAbsencesCache, _peCongesCache, _pePointagesCache] = await Promise.all([
      sbGetPeShifts(),
      sbGetEmployes(),
      sbGetAbsences().catch(() => []),
      sbGetConges().catch(() => []),
      sbGetPointages().catch(() => [])
    ]);
  } catch (e) {
    console.error('[initPlanningEquipe]', e);
    toast('Erreur de chargement', 'error');
  }
  renderPlanningEquipe();
}

// ── HELPERS DATE ──
function peGetMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0,0,0,0);
  return date;
}

function peISO(d) {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function peFormatShort(d) {
  return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
}

function peFormatLong(d) {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function peDuration(debut, fin) {
  const [h1,m1] = debut.split(':').map(Number);
  const [h2,m2] = fin.split(':').map(Number);
  let mins = (h2*60+m2) - (h1*60+m1);
  if (mins <= 0) mins += 24*60;
  return mins;
}

function peFormatDuration(mins) {
  const h = Math.floor(mins/60), m = Math.round(mins%60);
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2,'0')}`;
}

function peFormatSigned(mins) {
  const sign = mins < 0 ? '-' : (mins > 0 ? '+' : '');
  return sign + peFormatDuration(Math.abs(mins));
}

// ── CODE COULEUR AUTOMATIQUE PAR TYPE DE CRÉNEAU ──
const PE_TYPES = {
  matin:       { label: 'Matin',       color: '#f59e0b' },
  apresmidi:   { label: 'Après-midi',  color: '#3b82f6' },
  journee:     { label: 'Journée',     color: '#10b981' },
  nuit:        { label: 'Nuit',        color: '#6366f1' }
};

function peShiftType(debut, fin) {
  const [h1,m1] = debut.split(':').map(Number);
  const [h2,m2] = fin.split(':').map(Number);
  const startMin = h1*60+m1, endMin = h2*60+m2;
  // Nuit : commence à 21h30+ ou passe minuit (≈ 21h30-22h → 7h30)
  if (endMin <= startMin || startMin >= 21*60+30) return 'nuit';
  // Journée : 10h ou plus
  if (peDuration(debut, fin) >= 600) return 'journee';
  // Matin : commence avant 13h30 (≈ 7h-14h)
  if (startMin < 13*60+30) return 'matin';
  // Après-midi : ≈ 13h30/14h-22h
  return 'apresmidi';
}

// ── DÉTECTION DE CHEVAUCHEMENTS ──
function peToRange(s) {
  const [h1,m1] = s.debut.split(':').map(Number);
  const [h2,m2] = s.fin.split(':').map(Number);
  let start = h1*60+m1, end = h2*60+m2;
  if (end <= start) end += 24*60;
  return [start, end];
}

function peOverlaps(a, b) {
  const [s1,e1] = peToRange(a);
  const [s2,e2] = peToRange(b);
  return s1 < e2 && s2 < e1;
}

// ── NAVIGATION SEMAINE / MOIS ──
function pePrevWeek() {
  if (peViewMode === 'mois') peMonthCursor.setMonth(peMonthCursor.getMonth()-1);
  else peWeekStart.setDate(peWeekStart.getDate()-7);
  renderPlanningEquipe();
}
function peNextWeek() {
  if (peViewMode === 'mois') peMonthCursor.setMonth(peMonthCursor.getMonth()+1);
  else peWeekStart.setDate(peWeekStart.getDate()+7);
  renderPlanningEquipe();
}
function peToday() {
  if (peViewMode === 'mois') { peMonthCursor = new Date(); peMonthCursor.setDate(1); peMonthCursor.setHours(0,0,0,0); }
  else peWeekStart = peGetMonday(new Date());
  renderPlanningEquipe();
}

function peSetView(mode) {
  peViewMode = mode;
  renderPlanningEquipe();
}

function peSetMetierFilter(val) {
  peMetierFilter = val;
  renderPlanningEquipe();
}

// ── EXPORT CSV ──
function peCsvCell(v) {
  const s = String(v ?? '');
  return /[,"\n;]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
}

function peExportCsv() {
  const days = _peLastDays;
  if (!days.length) return;
  const dayStrs = days.map(peISO);
  const allEmployes = getPeEmployes();
  const employes = peMetierFilter ? allEmployes.filter(e => e.poste === peMetierFilter) : allEmployes;
  const empIds = new Set(employes.map(e => e.id));
  const shifts = getPeShifts().filter(s => dayStrs.includes(s.date) && (!peMetierFilter || empIds.has(s.employeId)));
  const empById = {};
  employes.forEach(e => empById[e.id] = (e.prenom||'')+' '+(e.nom||''));
  shifts.sort((a,b) => a.date.localeCompare(b.date) || a.debut.localeCompare(b.debut));
  const rows = [['Employé','Date','Début','Fin','Type','Durée']];
  shifts.forEach(s => {
    const nom = empById[s.employeId] || s.employeNom || 'Non assigné';
    const type = PE_TYPES[peShiftType(s.debut,s.fin)].label;
    rows.push([nom, s.date, s.debut, s.fin, type, peFormatDuration(peDuration(s.debut,s.fin))]);
  });
  const csv = rows.map(r => r.map(peCsvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const suffix = peMetierFilter ? '_' + peMetierFilter.replace(/[^a-zA-Z0-9]+/g,'_') : '';
  a.download = `planning${suffix}_${peISO(days[0])}_${peISO(days[days.length-1])}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── COPIER LA SEMAINE PRÉCÉDENTE ──
async function peCopyPreviousWeek() {
  if (!peCanEditPlanning()) return;
  const prevDays = [], curDays = [];
  for (let i = 0; i < 7; i++) {
    const dPrev = new Date(peWeekStart); dPrev.setDate(dPrev.getDate() - 7 + i);
    const dCur = new Date(peWeekStart); dCur.setDate(dCur.getDate() + i);
    prevDays.push(peISO(dPrev));
    curDays.push(peISO(dCur));
  }
  const shifts = getPeShifts();
  const prevShifts = shifts.filter(s => prevDays.includes(s.date));
  if (!prevShifts.length) { toast('Aucun créneau à copier la semaine précédente', 'error'); return; }
  const curShifts = shifts.filter(s => curDays.includes(s.date));
  if (curShifts.length && !confirm(`La semaine actuelle contient déjà ${curShifts.length} créneau(x). Ajouter les ${prevShifts.length} créneau(x) de la semaine précédente quand même ?`)) return;
  const copies = prevShifts.map(s => ({
    employeId: s.employeId,
    employeNom: s.employeNom,
    date: curDays[prevDays.indexOf(s.date)],
    debut: s.debut, fin: s.fin
  }));
  try {
    const saved = await sbBulkInsertPeShifts(copies);
    _peShiftsCache = _peShiftsCache.concat(saved);
    if (typeof auditLog === 'function') auditLog('modification', `Planning équipe — copie de ${saved.length} créneau(x) depuis la semaine précédente`);
    toast(`${saved.length} créneau(x) copié(s) ✓`, 'success');
    renderPlanningEquipe();
  } catch (e) {
    toast('Erreur : ' + (e?.message || e), 'error');
    console.error('[peCopyPreviousWeek]', e);
  }
}

// ── DONNÉES ──
function getPeShifts() {
  return _peShiftsCache;
}

function peCanEditPlanning() {
  const _s = Auth.getSession();
  return !!(_s && (Auth.isAdmin() || hasPermission(_s.userId, 'edit_planning_equipe')));
}

// ── IMPORT CSV ──
function openImportPlanning() {
  const html = `<div class="modal-overlay" id="modalImportPe" style="display:flex" onclick="closeModal('modalImportPe')">
    <div class="modal" style="max-width:480px" onclick="event.stopPropagation()">
      <div class="modal-header"><span class="modal-title">📥 Importer le planning</span><button class="modal-close" onclick="closeModal('modalImportPe')">&times;</button></div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:.85rem">
        <div style="font-size:.78rem;color:var(--muted);line-height:1.5">
          Le fichier CSV doit contenir les colonnes : <strong>employé, date, début, fin</strong> (séparateur virgule ou point-virgule).
          Une ligne d'en-tête est ignorée. Les créneaux importés sont ajoutés au planning existant.<br/>
          <span style="display:block;margin-top:.5rem;padding:.5rem .75rem;background:#f1f5f9;border-radius:6px;font-family:monospace;font-size:.72rem">
            employé,date,début,fin<br/>
            Jean Martin,2026-06-10,08:00,16:00<br/>
            Sophie Dubois,2026-06-10,13:00,21:00
          </span>
        </div>
        <div class="photo-upload-zone" onclick="document.getElementById('peFileInput').click()" style="padding:1.5rem;text-align:center;cursor:pointer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:32px;height:32px;margin:0 auto .5rem;color:var(--muted)"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <div style="font-size:.82rem;color:var(--muted)">Cliquez pour sélectionner un fichier CSV</div>
        </div>
        <input type="file" id="peFileInput" accept=".csv,.tsv,.txt" style="display:none" onchange="handlePeImport(event)"/>
      </div>
    </div>
  </div>`;
  const old = document.getElementById('modalImportPe');
  if (old) old.remove();
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div);
  requestAnimationFrame(() => document.getElementById('modalImportPe')?.classList.add('open'));
}

function handlePeImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    const text = ev.target.result;
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { toast('Fichier vide ou invalide', 'error'); return; }
    const header = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase().replace(/['"]/g,''));
    const empIdx = header.findIndex(h => h.includes('employ') || h.includes('nom') || h.includes('prenom'));
    const dateIdx = header.findIndex(h => h === 'date');
    const debutIdx = header.findIndex(h => h.includes('début') || h.includes('debut') || h.includes('start'));
    const finIdx = header.findIndex(h => h.includes('fin') || h.includes('end'));
    if (empIdx === -1 || dateIdx === -1 || debutIdx === -1 || finIdx === -1) {
      toast('Format CSV incorrect. Colonnes attendues : employé, date, début, fin', 'error'); return;
    }
    const imported = [];
    const employes = getPeEmployes();
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(/[;,]/).map(c => c.trim().replace(/['"]/g,''));
      const nom = cols[empIdx];
      const date = cols[dateIdx];
      const debut = cols[debutIdx];
      const fin = cols[finIdx];
      if (!nom || !date || !debut || !fin) continue;
      const emp = employes.find(e => (e.prenom+' '+e.nom).toLowerCase() === nom.toLowerCase() || e.nom.toLowerCase() === nom.toLowerCase());
      imported.push({
        employeId: emp ? emp.id : null,
        employeNom: emp ? emp.prenom+' '+emp.nom : nom,
        date, debut, fin
      });
    }
    if (!imported.length) { toast('Aucune ligne valide trouvée', 'error'); return; }
    try {
      const saved = await sbBulkInsertPeShifts(imported);
      _peShiftsCache = _peShiftsCache.concat(saved);
      if (typeof auditLog === 'function') auditLog('import', 'Planning équipe — ' + saved.length + ' lignes depuis ' + file.name);
      closeModal('modalImportPe');
      toast('Planning importé : ' + saved.length + ' lignes ✓', 'success');
      renderPlanningEquipe();
    } catch (e) {
      toast('Erreur import : ' + (e?.message || e), 'error');
      console.error('[peImport]', e);
    }
  };
  reader.readAsText(file);
}

// ── MODALE CRÉNEAU ──
function openPeShiftModal(employeId, date, shiftId) {
  if (!peCanEditPlanning()) return;
  const shifts = getPeShifts();
  const employes = getPeEmployes();
  const shift = shiftId ? shifts.find(s => s.id === shiftId) : null;
  let finalEmployeId, finalDate, empNom;
  if (shift) {
    finalEmployeId = shift.employeId;
    finalDate = shift.date;
    const emp = employes.find(e => e.id === shift.employeId);
    empNom = emp ? (emp.prenom+' '+emp.nom) : (shift.employeNom || 'Non assigné');
  } else {
    finalEmployeId = employeId;
    finalDate = date;
    const emp = employes.find(e => e.id === employeId);
    empNom = emp ? (emp.prenom+' '+emp.nom) : 'Non assigné';
  }
  _peCtx = { employeId: finalEmployeId, date: finalDate, shiftId: shift ? shift.id : null, employeNom: empNom };
  document.getElementById('psTitle').textContent = shift ? 'Modifier le créneau' : 'Nouveau créneau';
  document.getElementById('psEmploye').textContent = empNom;
  document.getElementById('psDate').textContent = peFormatLong(new Date(finalDate + 'T00:00:00'));
  document.getElementById('psDebut').value = shift ? shift.debut : '08:00';
  document.getElementById('psFin').value = shift ? shift.fin : '16:00';
  document.getElementById('psDeleteBtn').style.display = shift ? '' : 'none';
  openModal('modalPeShift');
}

async function savePeShift() {
  const debut = document.getElementById('psDebut').value;
  const fin = document.getElementById('psFin').value;
  if (!debut || !fin) { toast('Veuillez renseigner les heures de début et de fin', 'error'); return; }
  try {
    if (_peCtx.shiftId) {
      const saved = await sbSavePeShift({ id: _peCtx.shiftId, employeId: _peCtx.employeId, employeNom: _peCtx.employeNom, date: _peCtx.date, debut, fin });
      const idx = _peShiftsCache.findIndex(x => x.id === _peCtx.shiftId);
      if (idx >= 0) _peShiftsCache[idx] = saved;
    } else {
      const saved = await sbSavePeShift({ employeId: _peCtx.employeId, employeNom: _peCtx.employeNom, date: _peCtx.date, debut, fin });
      _peShiftsCache.push(saved);
    }
    if (typeof auditLog === 'function') auditLog('modification', `Planning équipe — créneau ${_peCtx.employeNom} le ${_peCtx.date} (${debut}-${fin})`);
    closeModal('modalPeShift');
    toast('Créneau enregistré ✓');
    renderPlanningEquipe();
  } catch (e) {
    const msg = e?.message || e?.details || JSON.stringify(e) || 'Erreur inconnue';
    toast('Erreur : ' + msg, 'error');
    console.error('[savePeShift]', e);
  }
}

function deletePeShift() {
  if (!_peCtx || !_peCtx.shiftId) return;
  const ctx = _peCtx;
  confirmDialog('Supprimer ce créneau ?', async () => {
    try {
      await sbDeletePeShift(ctx.shiftId);
      _peShiftsCache = _peShiftsCache.filter(s => s.id !== ctx.shiftId);
      if (typeof auditLog === 'function') auditLog('suppression', `Planning équipe — créneau ${ctx.employeNom} le ${ctx.date} supprimé`);
      closeModal('modalPeShift');
      toast('Créneau supprimé', 'success');
      renderPlanningEquipe();
    } catch (e) {
      toast('Erreur : ' + (e?.message || e), 'error');
      console.error('[deletePeShift]', e);
    }
  });
}

// ── RENDU GRILLE ──
function renderPlanningEquipe() {
  const wBtn = document.getElementById('peViewWeekBtn');
  const mBtn = document.getElementById('peViewMonthBtn');
  if (wBtn && mBtn) {
    wBtn.classList.toggle('btn-primary', peViewMode === 'semaine');
    wBtn.classList.toggle('btn-outline', peViewMode !== 'semaine');
    mBtn.classList.toggle('btn-primary', peViewMode === 'mois');
    mBtn.classList.toggle('btn-outline', peViewMode !== 'mois');
  }
  if (peViewMode === 'mois') { renderPlanningEquipeMonth(); return; }
  renderPlanningEquipeWeek();
}

function renderPlanningEquipeWeek() {
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(peWeekStart);
    d.setDate(d.getDate() + i);
    weekDays.push(d);
  }
  document.getElementById('peWeekLabel').textContent =
    `Semaine du ${peFormatShort(weekDays[0])} au ${peFormatShort(weekDays[6])}/${weekDays[6].getFullYear()}`;
  renderPlanningGrid(weekDays, true);
}

// ── RENDU VUE MOIS ──
function renderPlanningEquipeMonth() {
  const monthStart = new Date(peMonthCursor);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth()+1, 0);
  const days = [];
  for (let day = 1; day <= monthEnd.getDate(); day++) {
    days.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day));
  }
  document.getElementById('peWeekLabel').textContent =
    monthStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  renderPlanningGrid(days, false);
}

// ── RENDU GRILLE (commun semaine / mois) ──
function renderPlanningGrid(days, isWeek) {
  _peLastDays = days;
  const DAYS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const dayStrs = days.map(peISO);
  const todayStr = today();
  const canEdit = peCanEditPlanning();
  const periodLabel = isWeek ? 'sem' : 'mois';
  const minWidth = isWeek ? 90 : 56;

  document.getElementById('peHint').textContent = canEdit ? 'Cliquez sur une case pour ajouter ou modifier un créneau' : '';
  document.getElementById('peCopyBtn').style.display = (canEdit && isWeek) ? '' : 'none';

  const allEmployes = getPeEmployes();

  const metierSelect = document.getElementById('peMetierFilter');
  if (metierSelect) {
    const metiers = [...new Set(allEmployes.map(e => e.poste).filter(Boolean))].sort((a,b) => a.localeCompare(b));
    metierSelect.innerHTML = '<option value="">Tous les métiers</option>' +
      metiers.map(m => `<option value="${escHtml(m)}"${m === peMetierFilter ? ' selected' : ''}>${escHtml(m)}</option>`).join('');
    metierSelect.value = peMetierFilter;
  }

  const employes = peMetierFilter ? allEmployes.filter(e => e.poste === peMetierFilter) : allEmployes;
  const empIds = new Set(employes.map(e => e.id));
  const shifts = getPeShifts();
  const shiftsPeriod = shifts.filter(s => dayStrs.includes(s.date));
  const shiftsStats = peMetierFilter ? shiftsPeriod.filter(s => empIds.has(s.employeId)) : shiftsPeriod;

  const byEmp = {};
  shiftsPeriod.forEach(s => {
    const key = s.employeId || 'NA';
    (byEmp[key] = byEmp[key] || []).push(s);
  });

  // ── CONGÉS VALIDÉS ──
  const congesAcceptes = _peCongesCache.filter(c => c.statut === 'accepte');
  const peIsOnConge = (employeId, dateStr) => congesAcceptes.some(c => String(c.employeId) === String(employeId) && dateStr >= c.debut && dateStr <= c.fin);

  const el = document.getElementById('peGrid');
  const body = el.querySelector('.card-body');

  if (!employes.length) {
    body.innerHTML = peMetierFilter
      ? `<div class="empty" style="padding:3rem;text-align:center"><p>Aucun employé pour le métier « ${escHtml(peMetierFilter)} ».</p></div>`
      : '<div class="empty" style="padding:3rem;text-align:center"><p>Aucun employé enregistré. Ajoutez des employés pour gérer le planning.</p></div>';
    return;
  }

  const dayHeader = days.map((d,i) => {
    const isToday = dayStrs[i] === todayStr;
    const dow = (d.getDay() + 6) % 7;
    const numStyle = isToday
      ? 'display:inline-block;width:22px;height:22px;line-height:22px;border-radius:50%;background:var(--primary);color:#fff;font-weight:700;margin-top:2px'
      : 'display:inline-block;margin-top:2px;font-weight:400';
    return `<th style="padding:.6rem .35rem;text-align:center;font-size:.67rem;font-weight:700;color:var(--muted);text-transform:uppercase;min-width:${minWidth}px">${DAYS[dow]}<br/><span style="${numStyle}">${d.getDate()}</span></th>`;
  }).join('');

  const coverageRow = `<tr style="border-top:1px solid var(--border)">
    <td style="padding:.4rem .75rem;font-size:.68rem;font-weight:700;color:var(--muted);text-transform:uppercase;white-space:nowrap">Couverture</td>
    ${days.map(d => {
      const dateStr = peISO(d);
      const counts = {};
      Object.keys(PE_TYPES).forEach(k => counts[k] = 0);
      shiftsStats.filter(s => s.date === dateStr).forEach(s => counts[peShiftType(s.debut,s.fin)]++);
      const badges = Object.entries(PE_TYPES).map(([k,t]) => {
        const n = counts[k];
        return `<span style="display:inline-flex;align-items:center;gap:2px;font-size:.62rem;font-weight:700;color:${n ? t.color : 'var(--g300)'}"><span style="width:7px;height:7px;border-radius:2px;background:${n ? t.color : 'var(--g200)'};display:inline-block"></span>${n}</span>`;
      }).join('');
      return `<td style="padding:.4rem .35rem;text-align:center"><div style="display:flex;justify-content:center;gap:.4rem;flex-wrap:wrap">${badges}</div></td>`;
    }).join('')}
    <td></td>
  </tr>`;

  const naShifts = byEmp['NA'] || [];
  const naRow = peMetierFilter ? '' : `<tr style="border-top:1px solid var(--border);background:var(--g50)">
    <td style="padding:.5rem .75rem;white-space:nowrap">
      <div style="display:flex;align-items:center;gap:.5rem">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--g200);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.65rem;color:var(--muted);flex-shrink:0">NA</div>
        <div style="font-weight:600;font-size:.8rem;color:var(--muted)">Non assignés</div>
      </div>
    </td>
    ${days.map(d => {
      const dateStr = peISO(d);
      const dayShifts = naShifts.filter(s => s.date === dateStr);
      const content = dayShifts.map(s => {
        const tc = PE_TYPES[peShiftType(s.debut,s.fin)].color;
        return `<div onclick="openPeShiftModal(null,'${dateStr}','${s.id}')" style="cursor:pointer;background:${tc}20;border:1px solid ${tc}55;border-radius:6px;padding:.3rem .4rem;margin-bottom:2px;font-size:.68rem;font-weight:600;color:${tc}">${escHtml(s.employeNom||'?')}<br/>${s.debut} - ${s.fin}</div>`;
      }).join('');
      return `<td style="padding:.35rem;vertical-align:top">${content || '<span style="color:var(--g300)">—</span>'}</td>`;
    }).join('')}
    <td></td>
  </tr>`;

  const empRows = employes.map(emp => {
    const empShifts = byEmp[emp.id] || [];
    const totalMins = empShifts.reduce((sum,s) => sum + peDuration(s.debut, s.fin), 0);
    const contractH = emp.heuresContrat ?? 35;
    const contractMins = Math.round(contractH * 60 * days.length / 7);
    const deltaMins = totalMins - contractMins;
    const deltaColor = deltaMins >= 0 ? 'var(--green)' : 'var(--red)';
    const ficheId = peResolveEmployeFicheId(emp);

    const cells = days.map(d => {
      const dateStr = peISO(d);
      const dayShifts = empShifts.filter(s => s.date === dateStr);
      const onConge = peIsOnConge(emp.id, dateStr);
      const onAbsence = peIsAbsent(ficheId, dateStr);
      const pStatut = pePointageStatus(ficheId, dateStr);
      const ptEntry = _pePointagesCache.find(p => String(p.employeId) === String(ficheId) && p.date === dateStr);
      const pointed = !!(ptEntry && ptEntry.arrivee && ptEntry.depart);
      const blocks = dayShifts.map((s,idx) => {
        // Couleur du créneau = type (matin / après-midi / journée / nuit)
        const tc = PE_TYPES[peShiftType(s.debut,s.fin)].color;
        // Écart = horaires pointés différents du créneau planifié (retard, départ anticipé…)
        const ecart = pointed && (ptEntry.arrivee !== s.debut || ptEntry.depart !== s.fin);
        // Statut de pointage = accent (bordure gauche) : rouge=absence · violet=écart · vert=validé · orange=à valider
        let sc = null;
        if (onAbsence) sc = '#dc2626';
        else if (ecart) sc = '#9333ea';
        else if (pStatut === 'valide') sc = '#16a34a';
        else if (pStatut === 'attente') sc = '#d97706';
        const conflict = dayShifts.some((s2,idx2) => idx !== idx2 && peOverlaps(s,s2)) || onConge || onAbsence;
        const baseBorder = conflict ? '2px solid var(--red)' : `1px solid ${tc}55`;
        const leftAccent = (!conflict && sc) ? `border-left:5px solid ${sc};` : '';
        const titleParts = [];
        if (dayShifts.some((s2,idx2) => idx !== idx2 && peOverlaps(s,s2))) titleParts.push('⚠ Chevauchement avec un autre créneau ce jour');
        if (onConge) titleParts.push('🏖 Cet employé est en congé ce jour');
        if (onAbsence) titleParts.push('🤒 Cet employé est absent (arrêt/AT) ce jour');
        if (ecart) titleParts.push(`⏱ Horaires différents du planning (pointé ${ptEntry.arrivee}–${ptEntry.depart})`);
        if (pStatut === 'attente') titleParts.push('⏳ Pointage en attente de validation');
        if (pStatut === 'valide') titleParts.push('✓ Pointage validé');
        const title = titleParts.length ? ` title="${titleParts.join(' / ')}"` : '';
        const statutBadge = onAbsence ? ' 🤒' : ecart ? ' ⏱' : pStatut === 'valide' ? ' ✓' : pStatut === 'attente' ? ' ⏳' : '';
        return `<div onclick="event.stopPropagation();openPeShiftModal('${emp.id}','${dateStr}','${s.id}')"${title} style="cursor:pointer;background:${tc}20;border:${baseBorder};${leftAccent}border-radius:6px;padding:.3rem .4rem;margin-bottom:2px">
          <div style="font-size:.7rem;font-weight:700;color:${tc}">${s.debut} - ${s.fin}${conflict ? ' ⚠️' : ''}${statutBadge}</div>
          ${ecart ? `<div style="font-size:.6rem;font-weight:600;color:#9333ea">pointé : ${ptEntry.arrivee}–${ptEntry.depart}</div>` : ''}
          <div style="font-size:.62rem;font-weight:500;color:${tc};opacity:.85">${peFormatDuration(peDuration(s.debut,s.fin))}</div>
        </div>`;
      }).join('');
      const absentBadge = (onAbsence && !dayShifts.length) ? '<div style="text-align:center;background:#fee2e2;color:#dc2626;border-radius:6px;padding:.3rem .4rem;font-size:.65rem;font-weight:700" title="Arrêt / accident du travail">🤒 Absent</div>' : '';
      const congeBadge = (onConge && !onAbsence && !dayShifts.length) ? '<div style="text-align:center;background:var(--g100);color:var(--muted);border-radius:6px;padding:.3rem .4rem;font-size:.65rem;font-weight:700" title="Congé accepté">🏖 Congé</div>' : '';
      const addBtn = (canEdit && !dayShifts.length && !onConge && !onAbsence) ? '<div style="text-align:center;color:var(--g300);font-size:.9rem;line-height:1.4">+</div>' : '';
      return `<td style="padding:.35rem;vertical-align:top"${canEdit ? ` onclick="openPeShiftModal('${emp.id}','${dateStr}')" style="cursor:pointer"` : ''}>${blocks}${absentBadge}${congeBadge}${addBtn}</td>`;
    }).join('');

    return `<tr style="border-top:1px solid var(--border)">
      <td style="padding:.5rem .75rem;white-space:nowrap">
        <div style="display:flex;align-items:center;gap:.5rem">
          ${residentPhoto(emp, 32)}
          <div>
            <div style="font-weight:600;font-size:.8rem">${escHtml((emp.prenom||'')+' '+(emp.nom||''))}</div>
            <div style="font-size:.68rem;color:var(--muted)">${contractH}h/sem</div>
          </div>
        </div>
      </td>
      ${cells}
      <td style="padding:.5rem .75rem;text-align:center;white-space:nowrap">
        <div style="font-weight:700;font-size:.78rem">${peFormatDuration(totalMins)}</div>
        <div style="font-size:.68rem;font-weight:600;color:${deltaColor}">${peFormatSigned(deltaMins)}</div>
      </td>
    </tr>`;
  }).join('');

  let grandTotal = 0;
  const footerCells = days.map(d => {
    const dateStr = peISO(d);
    const dayTotal = shiftsStats.filter(s => s.date === dateStr).reduce((sum,s) => sum + peDuration(s.debut,s.fin), 0);
    grandTotal += dayTotal;
    return `<td style="padding:.5rem .35rem;text-align:center;font-weight:700;font-size:.78rem">${peFormatDuration(dayTotal)}</td>`;
  }).join('');

  const legend = `<div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:center;padding:.6rem 1rem;border-bottom:1px solid var(--border);font-size:.72rem;color:var(--muted)">
    ${Object.values(PE_TYPES).map(t => `<span style="display:flex;align-items:center;gap:.35rem"><span style="width:10px;height:10px;border-radius:3px;background:${t.color};display:inline-block"></span>${t.label}</span>`).join('')}
    <span style="display:flex;align-items:center;gap:.35rem">🏖 Congé accepté</span>
    <span style="display:flex;align-items:center;gap:.35rem">⚠️ Conflit (chevauchement ou congé)</span>
  </div>`;

  body.innerHTML = legend + `<table style="width:100%;border-collapse:collapse;font-size:.82rem">
    <thead style="background:var(--g50)">
      <tr>
        <th style="padding:.6rem .75rem;text-align:left;font-size:.67rem;font-weight:700;color:var(--muted);text-transform:uppercase">Employé</th>
        ${dayHeader}
        <th style="padding:.6rem .75rem;text-align:center;font-size:.67rem;font-weight:700;color:var(--muted);text-transform:uppercase">Total (${periodLabel})</th>
      </tr>
    </thead>
    <tbody>
      ${coverageRow}
      ${naRow}
      ${empRows}
      <tr style="border-top:2px solid var(--border);background:var(--g50)">
        <td style="padding:.5rem .75rem;font-weight:700;font-size:.78rem;white-space:nowrap">Heures travaillées</td>
        ${footerCells}
        <td style="padding:.5rem .75rem;text-align:center;font-weight:800;font-size:.8rem">${peFormatDuration(grandTotal)}</td>
      </tr>
    </tbody>
  </table>`;
}

document.addEventListener('DOMContentLoaded', initPlanningEquipe);
if (typeof registerPageInit === 'function') registerPageInit('planning-equipe', initPlanningEquipe);
