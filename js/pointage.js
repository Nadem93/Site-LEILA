// ── POINTAGE / TEMPS DE TRAVAIL RÉEL ──
let _ptWeekOffset = 0;
let _ptCache = [];
let _ptEmployesCache = [];
let _ptContratsCache = [];
let _ptAbsencesCache = [];
let _ptPlanningCache = [];

function getPointages()      { return _ptCache; }
function ptEmployes()        { return _ptEmployesCache.filter(e => e.statut !== 'inactif'); }
function ptIsCanEdit()       { return Auth.isAdmin() || (typeof canEditResidents === 'function' && canEditResidents(Auth.getSession()?.userId)); }

function _ptLocalStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

function ptWeekDates() {
  const now = new Date(); now.setHours(0,0,0,0);
  const dow = (now.getDay() + 6) % 7; // lundi = 0
  const lun = new Date(now.getTime() - dow * 86400000 + _ptWeekOffset * 7 * 86400000);
  return Array.from({length:7}, (_,i) => _ptLocalStr(new Date(lun.getTime() + i * 86400000)));
}

function ptContractHeures(employeId) {
  const contrats = _ptContratsCache.filter(c => String(c.employeId) === String(employeId) && (c.statut||'actif') === 'actif');
  const c = contrats.sort((a,b) => (b.debut||'').localeCompare(a.debut||''))[0];
  return c?.heures || 35;
}

// ── Absences & AT (table Supabase absences_at) ──
function ptIsAbsent(employeId, date) {
  return _ptAbsencesCache.some(a =>
    String(a.employeId) === String(employeId) && date >= a.debut && (!a.fin || date <= a.fin)
  );
}

// ── Planning équipe : désormais identifié par l'ID de fiche employé (identité) ──
function ptResolveUserId(employe) {
  return employe ? String(employe.id) : null;
}

function ptPlannedShift(employeId, date) {
  if (!employeId) return null;
  return _ptPlanningCache.find(s => String(s.employeId) === String(employeId) && s.date === date) || null;
}

function ptPlannedHeures(userId, date) {
  const s = ptPlannedShift(userId, date);
  return s ? ptCalcHeures(s.debut, s.fin, 0) : 0;
}

function ptCalcHeures(arrivee, depart, pauseMin) {
  if (!arrivee || !depart) return 0;
  const [h1,m1] = arrivee.split(':').map(Number);
  const [h2,m2] = depart.split(':').map(Number);
  let mins = (h2*60+m2) - (h1*60+m1);
  if (mins < 0) mins += 24*60;
  mins -= Number(pauseMin || 0);
  return Math.max(0, Math.round(mins/6)/10); // arrondi .1h
}

function ptGetEntry(employeId, date) {
  return getPointages().find(p => String(p.employeId) === String(employeId) && p.date === date);
}

function _ptEnsureEntry(employeId, date) {
  let entry = _ptCache.find(p => String(p.employeId) === String(employeId) && p.date === date);
  if (!entry) { entry = { employeId, date, arrivee:'', depart:'', pauseMin:0, valide:false }; _ptCache.push(entry); }
  return entry;
}

async function _ptPersist(entry) {
  try {
    const saved = await sbUpsertPointage(entry);
    Object.assign(entry, saved);
  } catch (e) {
    toast('Erreur : ' + (e?.message || e), 'error');
    console.error('[pointage]', e);
  }
  renderPointage();
}

async function ptSetField(employeId, date, field, value) {
  const entry = _ptEnsureEntry(employeId, date);
  entry[field] = field === 'pauseMin' ? (Number(value)||0) : value;
  entry.valide = false; // toute modification repasse le pointage en attente de validation
  await _ptPersist(entry);
}

async function ptToggleValidation(employeId, date) {
  const entry = _ptCache.find(p => String(p.employeId) === String(employeId) && p.date === date);
  if (!entry || !entry.arrivee || !entry.depart) { toast('Saisissez les horaires avant de valider', 'error'); return; }
  entry.valide = !entry.valide;
  await _ptPersist(entry);
}

async function ptCopyFromPlanning(employeId, date, peUserId) {
  const shift = ptPlannedShift(peUserId, date);
  if (!shift) { toast('Aucun créneau planifié ce jour', 'error'); return; }
  const entry = _ptEnsureEntry(employeId, date);
  entry.arrivee = shift.debut;
  entry.depart  = shift.fin;
  entry.valide  = false;
  await _ptPersist(entry);
}

function ptPopulatePosteFilter(employes) {
  const sel = document.getElementById('ptFilterPoste');
  if (!sel) return;
  const current = sel.value;
  const postes = [...new Set(employes.map(e => e.poste).filter(Boolean))].sort((a,b) => a.localeCompare(b,'fr'));
  sel.innerHTML = '<option value="">Tous les métiers</option>' + postes.map(p => `<option value="${escHtml(p)}">${escHtml(p)}</option>`).join('');
  sel.value = current;
}

// ── RENDU ──
function renderPointage() {
  const days = ptWeekDates();
  const allEmployes = ptEmployes();
  ptPopulatePosteFilter(allEmployes);
  const search = (document.getElementById('ptSearch')?.value || '').trim().toLowerCase();
  const posteFilter = document.getElementById('ptFilterPoste')?.value || '';
  const employes = allEmployes
    .filter(e => !posteFilter || e.poste === posteFilter)
    .filter(e => !search || `${e.prenom||''} ${e.nom||''}`.toLowerCase().includes(search))
    .sort((a,b) => `${a.nom||''}`.localeCompare(`${b.nom||''}`,'fr'));
  const JOURS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const todayStr = today();
  const canEdit = ptIsCanEdit();

  const lun = new Date(days[0]).toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
  const dim = new Date(days[6]).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
  document.getElementById('ptWeekLabel').textContent = `Semaine du ${lun} au ${dim}`;

  // Stats
  let totalHeures = 0, totalSup = 0, totalPrevu = 0, nonPointes = 0;
  const empTotaux = employes.map(e => {
    const peUserId = ptResolveUserId(e);
    const heuresSemaine = days.reduce((s,d) => { const en = ptGetEntry(e.id,d); return s + (en && en.valide ? ptCalcHeures(en.arrivee,en.depart,en.pauseMin) : 0); }, 0);
    const prevuSemaine = days.reduce((s,d) => { const en = ptGetEntry(e.id,d); return s + (en && en.valide ? ptPlannedHeures(peUserId,d) : 0); }, 0);
    const contractuel = ptContractHeures(e.id);
    const sup = Math.max(0, heuresSemaine - contractuel);
    days.forEach(d => { if (d <= todayStr && ptPlannedShift(peUserId,d) && !ptGetEntry(e.id,d) && !ptIsAbsent(e.id,d)) nonPointes++; });
    totalHeures += heuresSemaine; totalSup += sup; totalPrevu += prevuSemaine;
    return { e, peUserId, heuresSemaine, contractuel, sup, prevuSemaine, ecart: heuresSemaine - prevuSemaine };
  });

  document.getElementById('ptStats').innerHTML = `
    <div class="chx-stat" style="--c:#2563eb"><div class="chx-stat-top"><span class="chx-stat-lbl">Employés</span></div><div class="chx-stat-num">${employes.length}</div></div>
    <div class="chx-stat" style="--c:#16a34a"><div class="chx-stat-top"><span class="chx-stat-lbl">Heures travaillées (semaine)</span></div><div class="chx-stat-num">${totalHeures.toFixed(1)}h</div></div>
    <div class="chx-stat" style="--c:#0d9488"><div class="chx-stat-top"><span class="chx-stat-lbl">Heures prévues (planning équipe)</span></div><div class="chx-stat-num">${totalPrevu.toFixed(1)}h</div></div>
    <div class="chx-stat" style="--c:#e85d04"><div class="chx-stat-top"><span class="chx-stat-lbl">Heures sup (vs contrat)</span></div><div class="chx-stat-num">${totalSup.toFixed(1)}h</div></div>
    <div class="chx-stat" style="--c:${nonPointes?'#dc2626':'#7c3aed'}"><div class="chx-stat-top"><span class="chx-stat-lbl">Créneaux non pointés</span></div><div class="chx-stat-num">${nonPointes}</div></div>`;

  const wrap = document.getElementById('ptTableWrap');
  if (!employes.length) {
    wrap.innerHTML = allEmployes.length
      ? `<div class="empty" style="padding:2.5rem;text-align:center"><h3>Aucun résultat</h3><p>Aucun employé ne correspond à la recherche/filtre.</p></div>`
      : `<div class="empty" style="padding:2.5rem;text-align:center"><h3>Aucun employé</h3><p>Ajoutez des employés dans le module Employés.</p></div>`;
    return;
  }

  wrap.innerHTML = `<table class="pt-table">
    <thead><tr>
      <th style="text-align:left;padding-left:.85rem">Employé</th>
      ${days.map((d,i) => `<th style="${d===todayStr?'color:#2563eb':''}">${JOURS[i]}<br/><span style="font-weight:400">${new Date(d).getDate()}</span></th>`).join('')}
      <th>Total</th><th>Prévu</th><th>Écart</th>
    </tr></thead>
    <tbody>
      ${empTotaux.map(({e,peUserId,heuresSemaine,contractuel,sup,prevuSemaine,ecart}) => `<tr>
        <td class="pt-name">${escHtml((e.prenom||'')+' '+(e.nom||''))}<div style="font-size:.65rem;color:var(--muted);font-weight:400">${contractuel}h contrat</div></td>
        ${days.map(d => {
          if (ptIsAbsent(e.id, d)) {
            return `<td style="background:#fef2f2"><div style="text-align:center;color:#dc2626;font-weight:700;font-size:.72rem" title="Arrêt / accident du travail en cours">🤒 Absent</div></td>`;
          }
          const en = ptGetEntry(e.id, d);
          const h = en ? ptCalcHeures(en.arrivee,en.depart,en.pauseMin) : 0;
          const shift = ptPlannedShift(peUserId, d);
          const prevuLabel = shift ? `${shift.debut}–${shift.fin}` : '';
          const manque = shift && !en && d <= todayStr;
          const valide = !!(en && en.valide);
          const hColor = h<=0 ? 'var(--muted)' : (valide ? '#16a34a' : '#d97706');
          if (!canEdit) {
            return `<td>${prevuLabel?`<div style="font-size:.6rem;color:#0891b2">📋 ${prevuLabel}</div>`:''}<strong style="color:${hColor}">${h}h</strong>${h>0?`<div style="font-size:.6rem;color:${hColor}">${valide?'✓ validé':'en attente'}</div>`:''}</td>`;
          }
          return `<td style="${manque?'background:#fef2f2':''}">
            <div style="display:flex;flex-direction:column;gap:2px;align-items:center">
              ${shift ? `<div style="font-size:.6rem;color:#0891b2;display:flex;align-items:center;gap:2px;cursor:pointer" onclick="ptCopyFromPlanning('${e.id}','${d}','${peUserId}')" title="Copier le créneau prévu">📋 ${prevuLabel}</div>` : ''}
              <input type="time" class="pt-input" value="${en?.arrivee||''}" onchange="ptSetField('${e.id}','${d}','arrivee',this.value)" title="Arrivée"/>
              <input type="time" class="pt-input" value="${en?.depart||''}" onchange="ptSetField('${e.id}','${d}','depart',this.value)" title="Départ"/>
              <div style="display:flex;align-items:center;gap:4px">
                <span style="font-size:.7rem;font-weight:700;color:${hColor}">${h}h</span>
                ${h>0 ? `<button type="button" onclick="ptToggleValidation('${e.id}','${d}')" title="${valide?'Cliquer pour repasser en attente':'Cliquer pour valider'}" style="font-size:.62rem;font-weight:700;padding:1px 6px;border-radius:99px;border:1px solid ${valide?'#16a34a':'#d97706'};background:${valide?'#16a34a18':'#d9770618'};color:${valide?'#16a34a':'#d97706'};cursor:pointer;white-space:nowrap">${valide?'✓ Validé':'Valider'}</button>` : ''}
              </div>
            </div>
          </td>`;
        }).join('')}
        <td style="font-weight:700">${heuresSemaine.toFixed(1)}h</td>
        <td style="color:var(--muted)">${prevuSemaine?prevuSemaine.toFixed(1)+'h':'—'}</td>
        <td style="font-weight:700;color:${ecart>0?'#d97706':ecart<0?'#dc2626':'var(--muted)'}">${ecart!==0 && prevuSemaine ? (ecart>0?'+':'')+ecart.toFixed(1)+'h' : '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function ptShiftWeek(n) { _ptWeekOffset += n; renderPointage(); }
function ptGoToday()    { _ptWeekOffset = 0; renderPointage(); }

// ── INIT ──
async function initPointage() {
  const s = Auth.requireAuth();
  if (!s) return;
  try {
    [_ptCache, _ptEmployesCache, _ptContratsCache, _ptAbsencesCache, _ptPlanningCache] = await Promise.all([
      sbGetPointages(),
      sbGetEmployes(),
      sbGetContrats().catch(() => []),
      sbGetAbsences().catch(() => []),
      sbGetPeShifts().catch(() => [])
    ]);
  } catch (e) {
    console.error('[initPointage]', e);
    toast('Erreur de chargement', 'error');
  }
  renderPointage();
}
document.addEventListener('DOMContentLoaded', initPointage);
