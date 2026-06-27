let _vehiculesPlanningCache = [];

// Formate une date en heure LOCALE "AAAA-MM-JJTHH:MM" (toISOString() renvoie de l'UTC,
// ce qui décale les horaires et inverse les comparaisons de créneaux).
function toLocalDateTimeStr(d) {
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function initVehicules() {
  const _session = Auth.requireAuth();
  if (!_session) return;
  if (!requireModule('access_vehicules')) return;
  const now = new Date();
  document.getElementById('vDateAller').value = toLocalDateTimeStr(now);
  document.getElementById('vDuree').value = '60';
  document.getElementById('vVehicule').value = '';
  document.getElementById('vDestination').value = '';
  document.getElementById('vMotif').value = '';
  const vehicules = DB.get(DB.keys.vehicules) || [];
  document.getElementById('vehiculesList').innerHTML = vehicules.map(v => `<option value="${escapeAttr(v)}"/>`).join('');
  const session = Auth.getSession();
  const name = session ? [session.prenom, session.nom].filter(Boolean).join(' ') || session.username : '';
  document.getElementById('vReservataire').textContent = `Réservation au nom de : ${name}`;
  _vehiculesPlanningCache = await sbGetPlanningEvents();
  renderReservations();
}

function getVehiculeConflit(vehicule, dateAller, dateRetour, excludeId) {
  const planning = _vehiculesPlanningCache;
  const newStart = new Date(dateAller).getTime();
  const newEnd = new Date(dateRetour).getTime();
  return planning.find(e => {
    if (e.type !== 'vehicule' || e.vehicule !== vehicule) return false;
    if (excludeId && e.id === excludeId) return false;
    const existStart = new Date(e.date + 'T' + (e.time || e.heure || '00:00')).getTime();
    if (isNaN(existStart)) return false;
    // Si la date/heure de retour n'a pas été enregistrée (anciennes réservations), on se base
    // sur la durée, sinon 1h par défaut, pour ne pas ignorer le conflit silencieusement.
    let existEnd = new Date((e.dateEnd || e.date) + 'T' + (e.timeEnd || '23:59')).getTime();
    if (isNaN(existEnd) || !e.dateEnd) existEnd = existStart + (parseInt(e.duree) || 60) * 60000;
    return newStart < existEnd && newEnd > existStart;
  });
}

async function reserverVehicule() {
  const dateAller  = document.getElementById('vDateAller').value;
  const dureeVal   = document.getElementById('vDuree').value;
  const vehicule   = document.getElementById('vVehicule').value.trim();
  const destination = document.getElementById('vDestination').value.trim();
  const motif      = document.getElementById('vMotif').value.trim();
  if (!dateAller || !vehicule || !destination) {
    toast('Veuillez remplir tous les champs obligatoires', 'error'); return;
  }
  let dateRetour;
  if (dureeVal === 'journee') {
    dateRetour = dateAller.slice(0,10) + 'T23:59';
  } else {
    const d = new Date(new Date(dateAller).getTime() + parseInt(dureeVal) * 60000);
    dateRetour = toLocalDateTimeStr(d);
  }
  const conflit = getVehiculeConflit(vehicule, dateAller, dateRetour);
  if (conflit) {
    toast(`❌ Véhicule déjà réservé sur ce créneau horaire (du ${formatDateTime(conflit.date+'T'+conflit.time)} au ${formatDateTime(conflit.dateEnd+'T'+conflit.timeEnd)}${conflit.reservedBy ? ' par '+conflit.reservedBy : ''})`, 'error');
    return;
  }
  const session = Auth.getSession();
  const prenom = session?.prenom || '';
  const nom = session?.nom || '';
  const userName = [prenom, nom].filter(Boolean).join(' ') || session?.username || 'Inconnu';
  try {
    const saved = await sbSavePlanningEvent({
      titre: `Véhicule — ${vehicule}`,
      date: dateAller.slice(0,10),
      dateEnd: dateRetour.slice(0,10),
      time: dateAller.slice(11,16),
      timeEnd: dateRetour.slice(11,16),
      desc: `Réservé par : ${userName}${motif ? '\nMotif : '+motif : ''}\nVéhicule : ${vehicule}\nDestination : ${destination}`,
      color: '#6366f1',
      type: 'vehicule',
      vehicule, destination, reservedBy: userName, reservedPrenom: prenom
    });
    _vehiculesPlanningCache.push(saved);
  } catch (e) {
    toast('Erreur lors de la réservation', 'error');
    console.error(e);
    return;
  }
  toast(`🚗 ${vehicule} réservé par ${prenom || userName} vers ${destination}`);
  initVehicules();
}

async function annulerReservation(id) {
  if (!confirm('Annuler cette réservation ?')) return;
  try {
    await sbDeletePlanningEvent(id);
  } catch (e) {
    toast('Erreur lors de l\'annulation', 'error');
    console.error(e);
    return;
  }
  _vehiculesPlanningCache = _vehiculesPlanningCache.filter(e => e.id !== id);
  toast('Réservation annulée', 'success');
  renderReservations();
}

function renderReservations() {
  const planning = _vehiculesPlanningCache;
  const today = new Date().toISOString().slice(0,10);
  const now = new Date();

  const upcoming = planning
    .filter(e => e.type === 'vehicule' && (e.date > today || (e.date === today && e.time >= now.toTimeString().slice(0,5))))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||''));

  const past = planning
    .filter(e => e.type === 'vehicule' && (e.date < today || (e.date === today && e.time < now.toTimeString().slice(0,5))))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.time||'').localeCompare(a.time||''));

  const users = DB.get(DB.keys.users) || [];

  function renderRow(e) {
    const u = users.find(x => x.prenom === e.reservedPrenom);
    return `<div style="display:flex;align-items:center;gap:.75rem;padding:.75rem 1.25rem;border-bottom:1px solid var(--border)">
      <div style="width:36px;height:36px;border-radius:50%;background:#eef2ff;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" style="width:18px;height:18px"><rect x="2" y="7" width="20" height="12" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/></svg>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.85rem">${escHtml(e.vehicule||'')}</div>
        <div style="font-size:.78rem;color:var(--muted)">
          ${e.date ? formatDate(e.date) : '?'} ${e.time ? '· '+e.time.slice(0,5) : ''}
          ${e.destination ? '→ '+escHtml(e.destination) : ''}
          ${e.reservedBy ? '· '+escHtml(e.reservedBy) : ''}
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="annulerReservation('${e.id}')">✕</button>
    </div>`;
  }

  const upcomingEl = document.getElementById('vReservationsList');
  if (upcoming.length) {
    upcomingEl.innerHTML = upcoming.map(renderRow).join('');
  } else {
    upcomingEl.innerHTML = '<div class="empty" style="padding:2rem"><p>Aucune réservation à venir.</p></div>';
  }

  const pastEl = document.getElementById('vPastReservationsList');
  if (past.length) {
    document.getElementById('pastReservationsCard').style.display = '';
    pastEl.innerHTML = past.map(renderRow).join('');
  } else {
    document.getElementById('pastReservationsCard').style.display = 'none';
  }
}



function escapeAttr(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

document.addEventListener('DOMContentLoaded', initVehicules);
if (typeof registerPageInit === 'function') registerPageInit('vehicules', initVehicules);
