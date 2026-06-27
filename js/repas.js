// ── REPAS & RÉGIMES ──
// Inscriptions midi/soir par jour + régimes alimentaires (stockés sur la fiche résident)
let repasDate = null;
let regimeEditId = null;
let rpView = 'cartes';

function rpSetView(v) {
  rpView = v;
  document.getElementById('rpBtnCartes')?.classList.toggle('active', v === 'cartes');
  document.getElementById('rpBtnTableau')?.classList.toggle('active', v === 'tableau');
  document.getElementById('rpBtnSemaine')?.classList.toggle('active', v === 'semaine');
  renderRepas();
}

function rpWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d.toISOString().slice(0, 10);
}

function rpWeekDays(dateStr) {
  const start = rpWeekStart(dateStr);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start + 'T00:00:00');
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

const REGIME_TYPES = {
  normal: { label: 'Normal', color: '#64748b' },
  vegetarien: { label: 'Végétarien', color: '#16a34a' },
  sansporc: { label: 'Sans porc', color: '#0891b2' },
  halal: { label: 'Halal', color: '#0d9488' },
  casher: { label: 'Casher', color: '#7c3aed' },
  diabetique: { label: 'Diabétique', color: '#d97706' },
  hyposode: { label: 'Hyposodé', color: '#0369a1' },
  hypocalorique: { label: 'Hypocalorique', color: '#be185d' },
  autre: { label: 'Autre', color: '#dc2626' }
};
const TEXTURES = { normale: 'Normale', hachee: 'Hachée', mixee: 'Mixée' };

// Source = Supabase. Cache mémoire (objet indexé par date) chargé au démarrage.
let _repasCache = {};
function getRepas() { return _repasCache; }
async function loadRepasCache() { _repasCache = await sbGetRepasAll(); }
// Persiste un jour précis dans Supabase (remonte une erreur via toast)
function persistRepasJour(date) {
  if (!date) return;
  sbSaveRepasJour(date, _repasCache[date] || {}).catch(e => { console.error('[repas]', e); toast('Erreur sauvegarde repas', 'error'); });
}

// ── Résidents : source = Supabase (lecture via sbGetResidents, écriture via sbSaveResident) ──
let _residentsCache = [];
function residentsList() { return _residentsCache; }
async function loadResidentsCache() { _residentsCache = await sbGetResidents(); }
async function persistResident(r) {
  const saved = await sbSaveResident(r);
  const i = _residentsCache.findIndex(x => String(x.id) === String(saved.id));
  if (i >= 0) _residentsCache[i] = saved; else _residentsCache.push(saved);
  return saved;
}

function getMenuChoice(date, rid, meal) {
  return ((getRepas()[date] || {})['choixMenu'] || {})[rid]?.[meal] || null;
}
function setMenuChoice(date, rid, meal, choice) {
  const all = getRepas();
  if (!all[date]) all[date] = {};
  if (!all[date]['choixMenu']) all[date]['choixMenu'] = {};
  if (!all[date]['choixMenu'][rid]) all[date]['choixMenu'][rid] = {};
  if (all[date]['choixMenu'][rid][meal] === choice) {
    delete all[date]['choixMenu'][rid][meal]; // re-clic → efface
  } else {
    all[date]['choixMenu'][rid][meal] = choice;
  }
  persistRepasJour(date);
  renderRepas();
}

// Contenu réel des deux menus proposés par le foyer (texte libre par jour/repas)
function getMenuTexte(date, meal, choice) {
  return ((getRepas()[date] || {})['menus'] || {})[meal]?.[choice] || '';
}
function setMenuTexte(date, meal, choice, texte) {
  const all = getRepas();
  if (!all[date]) all[date] = {};
  if (!all[date]['menus']) all[date]['menus'] = {};
  if (!all[date]['menus'][meal]) all[date]['menus'][meal] = {};
  all[date]['menus'][meal][choice] = texte;
  persistRepasJour(date);
  renderRepas();
}

function repasResidents() {
  return residentsList().filter(r => r.statut !== 'sorti')
    .sort((a, b) => `${a.nom || ''} ${a.prenom || ''}`.localeCompare(`${b.nom || ''} ${b.prenom || ''}`, 'fr'));
}

// Inscrit par défaut : tout résident actif, sauf décoché explicitement
function isInscrit(day, meal, rid) {
  const v = ((day || {})[meal] || {})[rid];
  return v === undefined ? true : !!v;
}

function rgOf(r) { return r.regime || {}; }
function rgBadge(r) {
  const rg = rgOf(r);
  const t = REGIME_TYPES[rg.type] || REGIME_TYPES.normal;
  const parts = [];
  if (rg.type && rg.type !== 'normal') parts.push(`<span class="badge" style="background:${t.color}1a;color:${t.color};border:1px solid ${t.color}44">${t.label}${rg.type === 'autre' && rg.autreLabel ? ' : ' + escHtml(rg.autreLabel) : ''}</span>`);
  if (rg.texture && rg.texture !== 'normale') parts.push(`<span class="badge badge-purple">${TEXTURES[rg.texture]}</span>`);
  const allerg = (rg.allergiesAlim || r.allergies || '').trim();
  if (allerg) parts.push(`<span class="badge badge-red" title="${escHtml(allerg)}">⚠ Allergie</span>`);
  return parts.join(' ') || '<span style="font-size:.72rem;color:var(--g400)">Normal</span>';
}

function rpResidentCard(r, day, canEdit) {
  const rg = rgOf(r);
  const color = r.color || '#6b7280';
  const nom = escHtml(`${r.prenom || ''} ${r.nom || ''}`.trim());
  const chambre = r.chambre ? escHtml(r.chambre) : '—';
  const avatar = r.photo
    ? `<img src="${sanitizeUrl(r.photo)}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid ${color}44;flex-shrink:0" alt=""/>`
    : `<div style="width:44px;height:44px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:.82rem;font-weight:700;flex-shrink:0">${initials(r.prenom, r.nom)}</div>`;

  const t = REGIME_TYPES[rg.type] || REGIME_TYPES.normal;
  const badges = [];
  if (!rg.type || rg.type === 'normal') {
    badges.push(`<span style="display:inline-flex;align-items:center;padding:2px 9px;border-radius:20px;font-size:.7rem;font-weight:600;background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0">Normal</span>`);
  } else {
    const lbl = t.label + (rg.type === 'autre' && rg.autreLabel ? ' : ' + escHtml(rg.autreLabel) : '');
    badges.push(`<span style="display:inline-flex;align-items:center;padding:2px 9px;border-radius:20px;font-size:.7rem;font-weight:600;background:${t.color}18;color:${t.color};border:1px solid ${t.color}44">${lbl}</span>`);
  }
  if (rg.texture && rg.texture !== 'normale') {
    badges.push(`<span style="display:inline-flex;align-items:center;padding:2px 9px;border-radius:20px;font-size:.7rem;font-weight:600;background:#ede9fe;color:#7c3aed;border:1px solid #c4b5fd">${TEXTURES[rg.texture]}</span>`);
  }
  const allerg = (rg.allergiesAlim || r.allergies || '').trim();
  if (allerg) {
    badges.push(`<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 9px;border-radius:20px;font-size:.7rem;font-weight:600;background:#fef2f2;color:#dc2626;border:1px solid #fecaca">⚠ ${escHtml(allerg)}</span>`);
  }

  const matin = isInscrit(day, 'matin', r.id);
  const midi  = isInscrit(day, 'midi',  r.id);
  const soir  = isInscrit(day, 'soir',  r.id);

  const menuMidi = getMenuChoice(repasDate, r.id, 'midi');
  const menuSoir = getMenuChoice(repasDate, r.id, 'soir');

  const MEALS = [
    { key:'matin', icon:'🌅', label:'Matin',  active:'background:#0891b2;color:#fff;border-color:#0891b2', inactive:'background:#ecfeff;color:#0891b2;border-color:#a5f3fc', hasMenu: false },
    { key:'midi',  icon:'☀️', label:'Midi',   active:'background:#d97706;color:#fff;border-color:#d97706', inactive:'background:#fffbeb;color:#d97706;border-color:#fde68a', hasMenu: true  },
    { key:'soir',  icon:'🌙', label:'Soir',   active:'background:#7c3aed;color:#fff;border-color:#7c3aed', inactive:'background:#f5f3ff;color:#7c3aed;border-color:#ddd6fe', hasMenu: true  },
  ];
  const mealBtns = MEALS.map(m => {
    const on = m.key === 'matin' ? matin : m.key === 'midi' ? midi : soir;
    const menuChoice = m.key === 'midi' ? menuMidi : m.key === 'soir' ? menuSoir : null;
    const menuBtns = m.hasMenu ? `
      <div style="display:flex;gap:3px;margin-top:4px">
        <button onclick="event.stopPropagation();setMenuChoice('${repasDate}','${r.id}','${m.key}','1')" title="${escHtml(getMenuTexte(repasDate, m.key, '1')) || 'Menu 1'}"
          style="flex:1;font-size:.58rem;font-weight:700;padding:2px 4px;border-radius:6px;border:1.5px solid;cursor:pointer;font-family:inherit;transition:.12s;${menuChoice==='1'?'background:#16a34a;color:#fff;border-color:#16a34a':'background:#f0fdf4;color:#16a34a;border-color:#bbf7d0'}">Menu1</button>
        <button onclick="event.stopPropagation();setMenuChoice('${repasDate}','${r.id}','${m.key}','2')" title="${escHtml(getMenuTexte(repasDate, m.key, '2')) || 'Menu 2'}"
          style="flex:1;font-size:.58rem;font-weight:700;padding:2px 4px;border-radius:6px;border:1.5px solid;cursor:pointer;font-family:inherit;transition:.12s;${menuChoice==='2'?'background:#2563eb;color:#fff;border-color:#2563eb':'background:#eff6ff;color:#2563eb;border-color:#bfdbfe'}">Menu2</button>
      </div>` : '';
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center">
      <button onclick="toggleRepas('${r.id}','${m.key}',${!on})" style="width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:.5rem .25rem;border-radius:10px;border:1.5px solid;cursor:pointer;transition:all .15s;font-family:inherit;${on ? m.active : m.inactive}">
        <span style="font-size:.9rem;line-height:1">${m.icon}</span>
        <span style="font-size:.62rem;font-weight:600;line-height:1">${m.label}</span>
      </button>
      ${menuBtns}
    </div>`;
  }).join('');

  return `<div style="background:#fff;border-radius:18px;box-shadow:0 2px 12px rgba(15,23,42,.06);border:1px solid var(--border);border-top:3px solid ${color};padding:1.15rem 1.2rem;display:flex;flex-direction:column;gap:.85rem">
    <div style="display:flex;align-items:center;gap:.65rem">
      ${avatar}
      <div style="min-width:0;flex:1">
        <div style="font-weight:700;font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nom}</div>
        <div style="font-size:.74rem;color:var(--muted);margin-top:1px">Ch. ${chambre}</div>
      </div>
      ${canEdit ? `<button onclick="openRegimeModal('${r.id}')" title="Modifier le régime" style="flex-shrink:0;padding:4px 8px;border-radius:7px;border:1px solid var(--border);background:#f8fafc;color:var(--muted);font-size:.72rem;cursor:pointer">🍽</button>` : ''}
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:.35rem">${badges.join('')}</div>
    <div style="border-top:1px solid var(--border);padding-top:.85rem;display:flex;gap:.4rem">${mealBtns}</div>
  </div>`;
}

function renderRepas() {
  const residents = repasResidents();
  const all = getRepas();
  const day = all[repasDate] || {};
  const canEdit = (typeof canEditResidents === 'function') ? canEditResidents(Auth.getSession()?.userId) : Auth.isAdmin();

  const dEl = document.getElementById('rpDate');
  if (dEl && dEl.value !== repasDate) dEl.value = repasDate;
  renderDateStrip();
  const lbl = document.getElementById('rpDateLabel');
  if (lbl) lbl.textContent = new Date(repasDate + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Effectifs
  let matin = 0, midi = 0, soir = 0;
  residents.forEach(r => { if (isInscrit(day, 'matin', r.id)) matin++; if (isInscrit(day, 'midi', r.id)) midi++; if (isInscrit(day, 'soir', r.id)) soir++; });
  const regimesPart = residents.filter(r => { const rg = rgOf(r); return (rg.type && rg.type !== 'normal') || (rg.texture && rg.texture !== 'normale'); }).length;
  const allergies = residents.filter(r => ((rgOf(r).allergiesAlim || r.allergies || '').trim())).length;
  document.getElementById('rpStats').innerHTML = `
    <div class="chx-stat" style="--c:#06b6d4"><div class="chx-stat-top"><span class="chx-stat-lbl">Matin</span><span class="chx-stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/></svg></span></div><div class="chx-stat-num">${matin}</div><div class="chx-stat-sub">couverts</div></div>
    <div class="chx-stat" style="--c:#e85d04"><div class="chx-stat-top"><span class="chx-stat-lbl">Midi</span><span class="chx-stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg></span></div><div class="chx-stat-num">${midi}</div><div class="chx-stat-sub">couverts</div></div>
    <div class="chx-stat" style="--c:#8b5cf6"><div class="chx-stat-top"><span class="chx-stat-lbl">Soir</span><span class="chx-stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></span></div><div class="chx-stat-num">${soir}</div><div class="chx-stat-sub">couverts</div></div>
    <div class="chx-stat" style="--c:#16a34a"><div class="chx-stat-top"><span class="chx-stat-lbl">Régimes particuliers</span><span class="chx-stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg></span></div><div class="chx-stat-num">${regimesPart}</div></div>
    <div class="chx-stat" style="--c:#ef4444"><div class="chx-stat-top"><span class="chx-stat-lbl">Allergies alim.</span><span class="chx-stat-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span></div><div class="chx-stat-num">${allergies}</div></div>`;

  // Menus du jour proposés par le foyer (texte libre, 2 choix par repas)
  const menusEl = document.getElementById('rpMenusDuJour');
  if (menusEl) {
    const menuField = (meal, choice, color) => `
      <div style="flex:1;min-width:160px">
        <label style="font-size:.68rem;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:.25rem">Menu ${choice}</label>
        <input type="text" value="${escHtml(getMenuTexte(repasDate, meal, choice))}" placeholder="Ex : Poulet rôti, pommes vapeur…"
          onchange="setMenuTexte('${repasDate}','${meal}','${choice}',this.value)" class="form-input" style="font-size:.82rem"/>
      </div>`;
    menusEl.innerHTML = `
      <div style="display:flex;gap:1.5rem;flex-wrap:wrap">
        <div style="flex:1;min-width:280px">
          <div style="font-size:.78rem;font-weight:700;margin-bottom:.5rem">☀️ Midi</div>
          <div style="display:flex;gap:.75rem;flex-wrap:wrap">${menuField('midi', '1', '#16a34a')}${menuField('midi', '2', '#2563eb')}</div>
        </div>
        <div style="flex:1;min-width:280px">
          <div style="font-size:.78rem;font-weight:700;margin-bottom:.5rem">🌙 Soir</div>
          <div style="display:flex;gap:.75rem;flex-wrap:wrap">${menuField('soir', '1', '#16a34a')}${menuField('soir', '2', '#2563eb')}</div>
        </div>
      </div>
      <p style="font-size:.72rem;color:var(--muted);margin-top:.65rem">Renseignez les deux menus proposés par la cuisine pour ce jour — les résidents/équipes choisissent ensuite via les boutons Menu1/Menu2 sur chaque fiche.</p>`;
  }

  // Synthèse cuisine par régime (sur les inscrits du jour)
  const cuisine = { matin: {}, midi: {}, soir: {} };
  residents.forEach(r => {
    const rg = rgOf(r);
    const key = (rg.type && rg.type !== 'normal') ? rg.type : 'normal';
    ['matin', 'midi', 'soir'].forEach(m => { if (isInscrit(day, m, r.id)) cuisine[m][key] = (cuisine[m][key] || 0) + 1; });
  });
  const cuisineRow = m => Object.entries(cuisine[m]).sort((a, b) => b[1] - a[1]).map(([k, n]) => {
    const t = REGIME_TYPES[k] || REGIME_TYPES.autre;
    return `<span style="font-size:.78rem;color:${t.color};font-weight:600">${t.label} × ${n}</span>`;
  }).join(' · ') || '<span style="color:var(--g400);font-size:.78rem">aucun inscrit</span>';

  // Compteurs de choix de menus par repas
  const choixMenu = (day['choixMenu'] || {});
  const menuCount = { midi: { '1': 0, '2': 0, none: 0 }, soir: { '1': 0, '2': 0, none: 0 } };
  residents.forEach(r => {
    ['midi', 'soir'].forEach(m => {
      if (!isInscrit(day, m, r.id)) return;
      const c = choixMenu[r.id]?.[m];
      if (c === '1') menuCount[m]['1']++;
      else if (c === '2') menuCount[m]['2']++;
      else menuCount[m].none++;
    });
  });
  const menuTag = (m) => {
    const t = menuCount[m];
    const total = t['1'] + t['2'] + t.none;
    if (!total) return '';
    const txt1 = getMenuTexte(repasDate, m, '1');
    const txt2 = getMenuTexte(repasDate, m, '2');
    return `<span style="font-size:.78rem;color:#16a34a;font-weight:600" title="${escHtml(txt1)}">Menu1${txt1 ? ' — ' + escHtml(txt1) : ''} × ${t['1']}</span>
            <span style="font-size:.78rem;color:#2563eb;font-weight:600" title="${escHtml(txt2)}"> · Menu2${txt2 ? ' — ' + escHtml(txt2) : ''} × ${t['2']}</span>
            ${t.none ? `<span style="font-size:.78rem;color:var(--muted)"> · sans choix × ${t.none}</span>` : ''}`;
  };

  document.getElementById('rpCuisine').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:.5rem">
      <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap"><strong style="font-size:.8rem;width:52px">🌅 Matin</strong>${cuisineRow('matin')}</div>
      <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap"><strong style="font-size:.8rem;width:52px">☀️ Midi</strong>${cuisineRow('midi')} ${menuTag('midi')}</div>
      <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap"><strong style="font-size:.8rem;width:52px">🌙 Soir</strong>${cuisineRow('soir')} ${menuTag('soir')}</div>
    </div>`;

  // Sync toggle buttons
  document.getElementById('rpBtnCartes')?.classList.toggle('active', rpView === 'cartes');
  document.getElementById('rpBtnTableau')?.classList.toggle('active', rpView === 'tableau');
  document.getElementById('rpBtnSemaine')?.classList.toggle('active', rpView === 'semaine');

  // Résidents filtrés
  const q = (document.getElementById('rpSearch')?.value || '').toLowerCase();
  let list = residents;
  if (q) list = list.filter(r => `${r.prenom || ''} ${r.nom || ''} ${r.chambre || ''}`.toLowerCase().includes(q));
  const el = document.getElementById('rpList');
  if (!list.length) {
    el.innerHTML = '<div class="empty" style="padding:2rem"><p>Aucun résident trouvé.</p></div>';
    return;
  }

  if (rpView === 'semaine') {
    el.innerHTML = renderSemaineView(list, canEdit);
    return;
  }

  if (rpView === 'cartes') {
    el.innerHTML = `<div class="rp-card-grid">${list.map(r => rpResidentCard(r, day, canEdit)).join('')}</div>`;
  } else {
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Résident</th><th>Chambre</th><th>Régime & allergies</th><th style="text-align:center">🌅 Matin</th><th style="text-align:center">☀️ Midi</th><th style="text-align:center">🌙 Soir</th><th class="no-print"></th></tr></thead>
      <tbody>${list.map(r => {
        const allerg = (rgOf(r).allergiesAlim || r.allergies || '').trim();
        return `<tr>
          <td style="font-weight:600">${escHtml(`${r.prenom || ''} ${r.nom || ''}`.trim())}</td>
          <td>${r.chambre ? 'Ch. ' + escHtml(r.chambre) : '—'}</td>
          <td><div style="display:flex;gap:.3rem;flex-wrap:wrap;align-items:center">${rgBadge(r)}</div>${allerg ? `<div style="font-size:.7rem;color:#dc2626;margin-top:2px">⚠ ${escHtml(allerg)}</div>` : ''}</td>
          <td style="text-align:center"><input type="checkbox" style="width:18px;height:18px;cursor:pointer;accent-color:#2563eb" ${isInscrit(day, 'matin', r.id) ? 'checked' : ''} onchange="toggleRepas('${r.id}','matin',this.checked)"/></td>
          <td style="text-align:center"><input type="checkbox" style="width:18px;height:18px;cursor:pointer;accent-color:#2563eb" ${isInscrit(day, 'midi', r.id) ? 'checked' : ''} onchange="toggleRepas('${r.id}','midi',this.checked)"/></td>
          <td style="text-align:center"><input type="checkbox" style="width:18px;height:18px;cursor:pointer;accent-color:#2563eb" ${isInscrit(day, 'soir', r.id) ? 'checked' : ''} onchange="toggleRepas('${r.id}','soir',this.checked)"/></td>
          <td class="no-print" style="text-align:right">${canEdit ? `<button class="btn btn-ghost btn-sm" onclick="openRegimeModal('${r.id}')">🍽 Régime</button>` : ''}</td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }
}

function toggleRepas(rid, meal, checked, dateOverride) {
  const d = dateOverride || repasDate;
  const all = getRepas();
  if (!all[d]) all[d] = {};
  if (!all[d][meal]) all[d][meal] = {};
  all[d][meal][rid] = checked ? 1 : 0;
  persistRepasJour(d);
  renderRepas();
}

function rpCopyWeek(fromStart, toStart) {
  const all  = getRepas();
  const fromDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(fromStart + 'T00:00:00'); d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const toDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(toStart + 'T00:00:00'); d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
  fromDays.forEach((fd, i) => {
    if (all[fd]) all[toDays[i]] = JSON.parse(JSON.stringify(all[fd]));
  });
  toDays.forEach(persistRepasJour);
  repasDate = toStart;
  toast('Semaine copiée ✓', 'success');
  renderRepas();
}

function rpShiftDate(days) {
  const shift = rpView === 'semaine' ? (days > 0 ? 7 : -7) : days;
  const d = new Date(repasDate + 'T12:00');
  d.setDate(d.getDate() + shift);
  repasDate = d.toISOString().slice(0, 10);
  renderRepas();
}

// Saut direct (ignore le pas hebdomadaire de la vue Semaine) — utilisé par les raccourcis et la frise de dates
function rpJumpDays(days) {
  const d = new Date(repasDate + 'T12:00');
  d.setDate(d.getDate() + days);
  repasDate = d.toISOString().slice(0, 10);
  renderRepas();
}

function rpJumpTo(dateStr) {
  repasDate = dateStr;
  renderRepas();
}

function rpGoToday() {
  repasDate = today();
  renderRepas();
}

// Frise de dates sur 1 mois (commande des repas à l'avance)
function renderDateStrip() {
  const el = document.getElementById('rpDateStrip');
  if (!el) return;
  const todayS = today();
  const DOW = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const MOIS = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
  const repasAll = getRepas();
  let html = '';
  for (let i = 0; i < 35; i++) {
    const d = new Date(todayS + 'T12:00');
    d.setDate(d.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    const isToday = ds === todayS;
    const isSelected = ds === repasDate;
    const dayData = repasAll[ds];
    const hasMenu = !!(dayData && dayData.menus && Object.values(dayData.menus).some(m => m && (m['1'] || m['2'])));
    html += `<button class="rp-date-chip${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}" onclick="rpJumpTo('${ds}')" title="${escHtml(d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}">
      ${hasMenu ? '<span class="ddot"></span>' : ''}
      <span class="dow">${DOW[d.getDay()]}</span>
      <span class="dnum">${d.getDate()}</span>
      <span class="dmonth">${MOIS[d.getMonth()]}</span>
    </button>`;
  }
  el.innerHTML = html;
  const sel = el.querySelector('.rp-date-chip.selected');
  if (sel) sel.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function renderSemaineView(residents, canEdit) {
  const days   = rpWeekDays(repasDate);
  const all    = getRepas();
  const todayS = today();
  const JOURS  = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const MOIS   = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];

  // En-tête semaine
  const start = new Date(days[0] + 'T00:00:00');
  const end   = new Date(days[6] + 'T00:00:00');
  const lbl   = `Semaine du ${start.getDate()} ${MOIS[start.getMonth()]} au ${end.getDate()} ${MOIS[end.getMonth()]} ${end.getFullYear()}`;
  const lbEl  = document.getElementById('rpDateLabel');
  if (lbEl) lbEl.textContent = lbl;

  // Totaux par jour
  const totals = days.map(ds => {
    const day = all[ds] || {};
    let m = 0, d = 0, s = 0;
    residents.forEach(r => {
      if (isInscrit(day, 'matin', r.id)) m++;
      if (isInscrit(day, 'midi',  r.id)) d++;
      if (isInscrit(day, 'soir',  r.id)) s++;
    });
    return { m, d, s };
  });

  // Colonnes d'en-tête jours
  const headCols = days.map((ds, i) => {
    const dt = new Date(ds + 'T00:00:00');
    const isTod = ds === todayS;
    const isPast = ds < todayS;
    const t = totals[i];
    return `<th style="text-align:center;padding:.5rem .3rem;min-width:90px;background:${isTod ? '#eff6ff' : 'transparent'}">
      <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:${isTod ? '#2563eb' : isPast ? '#94a3b8' : 'var(--text)'}">${JOURS[i]} ${dt.getDate()}</div>
      <div style="font-size:.65rem;color:var(--muted);margin-top:2px">${t.m}M · ${t.d}D · ${t.s}S</div>
    </th>`;
  }).join('');

  // Lignes résidents
  const rows = residents.map(r => {
    const color = r.color || '#6b7280';
    const nom   = `${r.prenom || ''} ${r.nom || ''}`.trim();
    const av    = r.photo
      ? `<img src="${sanitizeUrl(r.photo)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1.5px solid ${color}44;flex-shrink:0" alt=""/>`
      : `<div style="width:28px;height:28px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:700;flex-shrink:0">${initials(r.prenom, r.nom)}</div>`;

    const cells = days.map((ds, i) => {
      const day  = all[ds] || {};
      const isTod = ds === todayS;
      const isPast = ds < todayS;
      const matin = isInscrit(day, 'matin', r.id);
      const midi  = isInscrit(day, 'midi',  r.id);
      const soir  = isInscrit(day, 'soir',  r.id);
      const menuM = ((day['choixMenu'] || {})[r.id] || {})['midi'];
      const menuS = ((day['choixMenu'] || {})[r.id] || {})['soir'];

      const dot = (meal, on, mealColor, icon) =>
        `<button title="${icon}" onclick="toggleRepas('${r.id}','${meal}',${!on},'${ds}')"
             style="width:22px;height:22px;border-radius:50%;border:2px solid ${on ? mealColor : '#e2e8f0'};background:${on ? mealColor : 'transparent'};cursor:pointer;font-size:.6rem;line-height:1;transition:.12s;color:${on ? '#fff' : '#cbd5e1'};flex-shrink:0">${icon}</button>`;

      const menuBtns = (midi || soir) ? `
        <div style="display:flex;gap:2px;margin-top:3px;justify-content:center">
          ${midi ? `<button onclick="setMenuChoice('${ds}','${r.id}','midi','1')"
            style="font-size:.52rem;font-weight:700;padding:1px 4px;border-radius:4px;border:1.5px solid;cursor:pointer;font-family:inherit;${menuM==='1'?'background:#16a34a;color:#fff;border-color:#16a34a':'background:#f0fdf4;color:#16a34a;border-color:#bbf7d0'}">Menu1</button>` : ''}
          ${midi ? `<button onclick="setMenuChoice('${ds}','${r.id}','midi','2')"
            style="font-size:.52rem;font-weight:700;padding:1px 4px;border-radius:4px;border:1.5px solid;cursor:pointer;font-family:inherit;${menuM==='2'?'background:#2563eb;color:#fff;border-color:#2563eb':'background:#eff6ff;color:#2563eb;border-color:#bfdbfe'}">Menu2</button>` : ''}
        </div>` : (menuM || menuS) ? `<div style="font-size:.52rem;font-weight:600;color:${(menuM||menuS)==='1'?'#16a34a':'#2563eb'};margin-top:2px;text-align:center">Menu${menuM||menuS}</div>` : '';

      return `<td style="text-align:center;padding:.4rem .25rem;background:${isTod ? '#eff6ff' : 'transparent'};${isPast ? 'opacity:.6' : ''}">
        <div style="display:flex;gap:3px;justify-content:center">
          ${dot('matin', matin, '#0891b2', '🌅')}
          ${dot('midi',  midi,  '#d97706', '☀️')}
          ${dot('soir',  soir,  '#7c3aed', '🌙')}
        </div>
        ${menuBtns}
      </td>`;
    }).join('');

    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:.5rem .75rem;white-space:nowrap;position:sticky;left:0;background:#fff;z-index:1;border-right:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:.5rem">
          ${av}
          <div>
            <div style="font-weight:600;font-size:.8rem">${escHtml(nom)}</div>
            ${r.chambre ? `<div style="font-size:.68rem;color:var(--muted)">Ch. ${escHtml(r.chambre)}</div>` : ''}
          </div>
        </div>
      </td>
      ${cells}
    </tr>`;
  }).join('');

  // Bouton "Copier vers semaine suivante"
  const nextWeek = (() => {
    const d = new Date(days[0] + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();

  const copyBtn = canEdit
    ? `<button class="btn btn-outline btn-sm" onclick="rpCopyWeek('${days[0]}','${nextWeek}')" style="margin-top:.75rem">📋 Copier vers semaine suivante</button>`
    : '';

  return `<div style="overflow-x:auto;border-radius:12px;border:1px solid var(--border);background:#fff">
    <table style="width:100%;border-collapse:collapse;min-width:700px">
      <thead>
        <tr style="border-bottom:2px solid var(--border)">
          <th style="text-align:left;padding:.6rem .75rem;position:sticky;left:0;background:#f8fafc;z-index:2;font-size:.75rem;color:var(--muted);border-right:1px solid var(--border);min-width:140px">Résident</th>
          ${headCols}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  ${copyBtn}`;
}

// ── Régime (stocké sur la fiche résident) ──
function openRegimeModal(rid) {
  const r = residentsList().find(x => String(x.id) === String(rid));
  if (!r) return;
  regimeEditId = rid;
  const rg = rgOf(r);
  document.getElementById('rgTitle').textContent = `Régime alimentaire — ${`${r.prenom || ''} ${r.nom || ''}`.trim()}`;
  document.getElementById('rgType').value = rg.type || 'normal';
  document.getElementById('rgAutre').value = rg.autreLabel || '';
  document.getElementById('rgTexture').value = rg.texture || 'normale';
  document.getElementById('rgAllergies').value = rg.allergiesAlim !== undefined ? rg.allergiesAlim : (r.allergies || '');
  document.getElementById('rgNotes').value = rg.notes || '';
  rgToggleAutre();
  openModal('modalRegime');
}

function rgToggleAutre() {
  document.getElementById('rgAutreWrap').style.display = document.getElementById('rgType').value === 'autre' ? '' : 'none';
}

async function saveRegime() {
  const regime = {
    type: document.getElementById('rgType').value,
    autreLabel: document.getElementById('rgAutre').value.trim(),
    texture: document.getElementById('rgTexture').value,
    allergiesAlim: document.getElementById('rgAllergies').value.trim(),
    notes: document.getElementById('rgNotes').value.trim()
  };
  const r = residentsList().find(x => String(x.id) === String(regimeEditId));
  if (r) await persistResident({ ...r, regime });
  if (typeof auditLog === 'function') auditLog('regime_save', `Régime — ${(r || {}).nom || ''}`);
  toast('Régime enregistré ✓');
  closeModal('modalRegime');
  renderRepas();
}

async function initRepas() {
  const s = Auth.requireAuth();
  if (!s) return;
  if (!requireModule('view_residents')) return;
  await loadResidentsCache();
  await loadRepasCache();
  repasDate = today();
  document.getElementById('rpDate')?.addEventListener('change', e => { if (e.target.value) { repasDate = e.target.value; renderRepas(); } });
  document.getElementById('rpSearch')?.addEventListener('input', renderRepas);
  document.getElementById('rgType')?.addEventListener('change', rgToggleAutre);
  renderRepas();
}
document.addEventListener('DOMContentLoaded', initRepas);
