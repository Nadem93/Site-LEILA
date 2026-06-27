// ── RAPPORT D'ACTIVITÉ ──
// Générateur partagé, utilisé à la fois par la page autonome rapport.html
// et par la carte « 📄 Rapport d'activité » de la page Statistiques (admin.html).
// Les deux pages doivent exposer les mêmes champs : #rapportType, #rapportMois, #rapportAnnee.

function initRapportDefaults() {
  const now = new Date();
  const mEl = document.getElementById('rapportMois');
  const yEl = document.getElementById('rapportAnnee');
  if (mEl && !mEl.value) mEl.value = now.toISOString().slice(0, 7);
  if (yEl && !yEl.value) yEl.value = now.getFullYear();
}

function toggleRapportPeriode() {
  const t = document.getElementById('rapportType').value;
  document.getElementById('rapportMoisWrap').style.display = t === 'mois' ? '' : 'none';
  document.getElementById('rapportAnneeWrap').style.display = t === 'annee' ? '' : 'none';
}

// ── CONTRIBUTIONS DE L'ÉQUIPE (qualitatif, saisi par les éducateurs etc.) ──
const RC_CATEGORIES = {
  fait_marquant: { icon: '📌', label: 'Fait marquant', color: '#0891b2' },
  point_fort: { icon: '✅', label: 'Point fort', color: '#16a34a' },
  difficulte: { icon: '⚠️', label: 'Difficulté rencontrée', color: '#d97706' },
  perspective: { icon: '🎯', label: 'Perspective / projet à venir', color: '#7c3aed' }
};

// Source = Supabase. Cache mémoire chargé au démarrage.
let _rcCache = [];
function getRapportContributions() { return _rcCache; }
async function loadRapportCache() { _rcCache = await sbGetRapportContributions(); }

async function ajouterContributionRapport() {
  const categorie = document.getElementById('rcCategorie').value;
  const mois = document.getElementById('rcMois').value || new Date().toISOString().slice(0, 7);
  const texte = document.getElementById('rcTexte').value.trim();
  if (!texte) { toast('Décrivez votre contribution', 'error'); return; }
  const session = Auth.getSession();
  try {
    const saved = await sbSaveRapportContribution({
      categorie, mois, texte,
      auteur: session ? ([session.prenom, session.nom].filter(Boolean).join(' ') || session.username) : 'Anonyme',
      authorId: session?.userId
    });
    _rcCache.unshift(saved);
  } catch (e) { console.error('[ajouterContributionRapport]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
  document.getElementById('rcTexte').value = '';
  toast('Contribution ajoutée ✓', 'success');
  renderContributionsRapport();
}

function supprimerContributionRapport(id) {
  const session = Auth.getSession();
  const item = _rcCache.find(c => c.id === id);
  if (!item) return;
  const isAdmin = typeof Auth.isAdmin === 'function' && Auth.isAdmin();
  if (!isAdmin && String(item.authorId) !== String(session?.userId)) { toast('Vous ne pouvez supprimer que vos propres contributions', 'error'); return; }
  (async () => {
    try { await sbDeleteRapportContribution(id); _rcCache = _rcCache.filter(c => c.id !== id); }
    catch (e) { console.error('[supprimerContributionRapport]', e); toast('Erreur suppression : ' + (e?.message || e), 'error'); return; }
    renderContributionsRapport();
  })();
}

function renderContributionsRapport() {
  const el = document.getElementById('rcList');
  if (!el) return;
  const mEl = document.getElementById('rcMois');
  if (mEl && !mEl.value) mEl.value = new Date().toISOString().slice(0, 7);
  const session = Auth.getSession();
  const isAdmin = typeof Auth.isAdmin === 'function' && Auth.isAdmin();
  const list = getRapportContributions().sort((a, b) => (b.mois || '').localeCompare(a.mois || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  if (!list.length) {
    el.innerHTML = '<p style="font-size:.82rem;color:var(--muted);font-style:italic;margin:0">Aucune contribution pour le moment.</p>';
    return;
  }
  el.innerHTML = list.map(c => {
    const cat = RC_CATEGORIES[c.categorie] || RC_CATEGORIES.fait_marquant;
    const canDelete = isAdmin || String(c.authorId) === String(session?.userId);
    const moisLabel = c.mois ? new Date(c.mois + '-01T12:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '';
    return `<div style="display:flex;gap:.65rem;padding:.65rem .85rem;background:#fff;border:1px solid var(--border);border-left:3px solid ${cat.color};border-radius:8px">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.25rem">
          <span style="font-size:.74rem;font-weight:700;padding:1px 9px;border-radius:99px;background:${cat.color}18;color:${cat.color}">${cat.icon} ${cat.label}</span>
          <span style="font-size:.72rem;color:var(--muted);text-transform:capitalize">${escHtml(moisLabel)}</span>
        </div>
        <div style="font-size:.85rem;color:var(--text);white-space:pre-wrap">${escHtml(c.texte)}</div>
        <div style="font-size:.7rem;color:var(--muted);margin-top:.3rem">Par ${escHtml(c.auteur)}</div>
      </div>
      ${canDelete ? `<button class="btn btn-ghost btn-sm" style="color:var(--red);flex-shrink:0" onclick="supprimerContributionRapport('${c.id}')">✕</button>` : ''}
    </div>`;
  }).join('');
}

// ── GRAPHIQUES SVG (partagés : rapport PDF + page Statistiques) ──
function svgLine(points, color, yMax, yLabel) {
  // points = [{label, value}], value 0..yMax
  if (!points.length) return '<p class="empty-line" style="font-size:.82rem;color:#94a3b8;font-style:italic">Aucune donnée.</p>';
  const W = 720, H = 190, padL = 38, padR = 14, padT = 20, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = points.length;
  const ticks = 4;
  let grid = '';
  for (let k = 0; k <= ticks; k++) {
    const y = padT + plotH - plotH * k / ticks;
    const val = Math.round(yMax * k / ticks);
    grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#e8edf2" stroke-width="1"/>`;
    grid += `<text x="${padL - 5}" y="${y + 3.5}" text-anchor="end" font-size="7.5" fill="#94a3b8">${val}${yLabel || ''}</text>`;
  }
  const xs = points.map((_, i) => padL + (n === 1 ? plotW / 2 : plotW * i / (n - 1)));
  const ys = points.map(p => padT + plotH - Math.min(1, Math.max(0, p.value / yMax)) * plotH);
  const area = `M${xs[0]},${padT + plotH} ` + xs.map((x, i) => `L${x},${ys[i]}`).join(' ') + ` L${xs[n-1]},${padT + plotH} Z`;
  const line = `M${xs[0]},${ys[0]} ` + xs.slice(1).map((x, i) => `L${x},${ys[i+1]}`).join(' ');
  let labels = '';
  points.forEach((p, i) => {
    labels += `<text x="${xs[i].toFixed(1)}" y="${H - padB + 13}" text-anchor="middle" font-size="7.5" fill="#475569">${escHtml(p.label)}</text>`;
    labels += `<circle cx="${xs[i]}" cy="${ys[i]}" r="4" fill="${color}" stroke="#fff" stroke-width="1.5"/>`;
    labels += `<text x="${xs[i].toFixed(1)}" y="${(ys[i] - 7).toFixed(1)}" text-anchor="middle" font-size="7.5" font-weight="700" fill="${color}">${p.value}${yLabel||''}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">
    <path d="${area}" fill="${color}" fill-opacity="0.08"/>
    <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#cbd5e1" stroke-width="1"/>
    ${grid}
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    ${labels}
  </svg>`;
}
function svgHBar(obj, color, keepOrder, colorMap, labelW) {
  let entries = Object.entries(obj).filter(([, v]) => v > 0);
  if (!keepOrder) entries = entries.sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '<p class="empty-line" style="font-size:.82rem;color:#94a3b8;font-style:italic">Aucune donnée.</p>';
  const max = Math.max(...entries.map(e => e[1]), 1);
  labelW = labelW || 150;
  const maxChars = Math.floor(labelW / 4.7);
  const rowH = 26, barMax = 470, padL = 6, padT = 6, padB = 16;
  const W = padL + labelW + barMax + 44, H = padT + entries.length * rowH + padB;
  let grid = '';
  for (let k = 0; k <= 4; k++) { const x = padL + labelW + barMax * k / 4; grid += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + entries.length * rowH}" stroke="#e8edf2" stroke-width="1"/><text x="${x}" y="${padT + entries.length * rowH + 12}" text-anchor="middle" font-size="7" fill="#94a3b8">${Math.round(max * k / 4)}</text>`; }
  const bars = entries.map(([label, v], i) => {
    const y = padT + i * rowH, bw = Math.max(2, Math.round(v / max * barMax));
    const col = (colorMap && colorMap[label]) || color;
    return `<text x="${padL + labelW - 6}" y="${y + rowH / 2 + 3}" text-anchor="end" font-size="9" fill="#334155">${escHtml(String(label)).slice(0, maxChars)}</text><rect x="${padL + labelW}" y="${y + 4}" width="${bw}" height="${rowH - 10}" rx="3" fill="${col}"/><text x="${padL + labelW + bw + 5}" y="${y + rowH / 2 + 3}" font-size="9" font-weight="700" fill="#0f2b4a">${v}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">${grid}${bars}</svg>`;
}
function svgColumns(labels, series) {
  const W = 720, H = 230, padL = 30, padR = 10, padT = 24, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  let max = Math.max(...series.flatMap(s => s.data), 1);
  const step = Math.max(1, Math.ceil(max / 4)); max = step * 4;
  const n = labels.length, groupW = plotW / n, barW = Math.max(4, Math.min(16, groupW / (series.length + 1)));
  let grid = '';
  for (let k = 0; k <= 4; k++) { const y = padT + plotH - plotH * k / 4; grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#e8edf2" stroke-width="1"/><text x="${padL - 4}" y="${y + 3}" text-anchor="end" font-size="7" fill="#94a3b8">${step * k}</text>`; }
  let bars = '';
  labels.forEach((lab, i) => {
    const gx = padL + groupW * i + groupW / 2;
    series.forEach((s, si) => {
      const v = s.data[i] || 0, bh = Math.round(v / max * plotH), x = gx - (series.length * barW) / 2 + si * barW;
      bars += `<rect x="${x}" y="${padT + plotH - bh}" width="${barW - 1.5}" height="${bh}" rx="2" fill="${s.color}"/>`;
      if (v > 0) bars += `<text x="${(x + (barW - 1.5) / 2).toFixed(1)}" y="${padT + plotH - bh - 2}" text-anchor="middle" font-size="6.5" fill="#475569">${v}</text>`;
    });
    bars += `<text x="${gx.toFixed(1)}" y="${H - padB + 12}" text-anchor="middle" font-size="7.5" fill="#475569">${escHtml(lab)}</text>`;
  });
  let legend = '';
  series.forEach((s, si) => { const lx = padL + si * 150; legend += `<rect x="${lx}" y="4" width="10" height="10" rx="2" fill="${s.color}"/><text x="${lx + 14}" y="13" font-size="8" fill="#334155">${escHtml(s.name)}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px"><line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#cbd5e1" stroke-width="1"/>${grid}${bars}${legend}</svg>`;
}
function svgDonut(segments, centerLabel) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (!total) return '<p class="empty-line" style="font-size:.82rem;color:#94a3b8;font-style:italic">Aucune donnée.</p>';
  const cx = 70, cy = 70, r = 50, sw = 22, circ = 2 * Math.PI * r;
  let off = 0, arcs = '';
  segments.forEach(s => { if (s.value <= 0) return; const dash = s.value / total * circ; arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}" stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`; off += dash; });
  const center = `<text x="${cx}" y="${cy - 1}" text-anchor="middle" font-size="20" font-weight="800" fill="#0f2b4a">${total}</text><text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="7.5" fill="#94a3b8">${centerLabel || ''}</text>`;
  const legend = segments.map(s => `<div style="display:flex;align-items:center;gap:5px;font-size:.78rem;margin-bottom:4px"><span style="width:11px;height:11px;border-radius:2px;background:${s.color};display:inline-block;flex-shrink:0"></span>${escHtml(s.label)} : <strong>${s.value}</strong> (${Math.round(s.value / total * 100)}%)</div>`).join('');
  return `<div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap"><svg viewBox="0 0 140 140" width="120" height="120" style="flex-shrink:0">${arcs}${center}</svg><div>${legend}</div></div>`;
}

function genererRapportPDF() {
  const type = document.getElementById('rapportType').value;
  let startStr, endStr, label;
  if (type === 'mois') {
    const m = document.getElementById('rapportMois').value;
    if (!m) { toast('Choisissez un mois', 'error'); return; }
    const [yy, mm] = m.split('-').map(Number);
    startStr = `${m}-01`;
    endStr = `${m}-${String(new Date(yy, mm, 0).getDate()).padStart(2, '0')}`;
    label = new Date(yy, mm - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  } else {
    const y = document.getElementById('rapportAnnee').value;
    if (!y) { toast('Choisissez une année', 'error'); return; }
    startStr = `${y}-01-01`; endStr = `${y}-12-31`;
    label = `Année ${y}`;
  }
  const inRange = d => { if (!d) return false; const s = String(d).slice(0, 10); return s >= startStr && s <= endStr; };
  const fmtD = d => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR');
  const _start = new Date(startStr + 'T00:00:00'), _end = new Date(endStr + 'T00:00:00');
  const _days = Math.round((_end - _start) / 86400000) + 1;

  const settings = DB.get(DB.keys.settings) || {};
  const session = Auth.getSession();
  const residents = sbResidents();
  const activeRes = residents.filter(r => r.statut !== 'sorti');
  const journal = DB.get(DB.keys.journal) || [];
  const incidents = DB.get(DB.keys.incidents) || [];
  const ppe = DB.get(DB.keys.ppe) || [];
  const presences = DB.get(DB.keys.presences) || {};
  const cats = DB.get(DB.keys.categories) || [];

  // Journal
  const jPeriod = journal.filter(e => inRange(e.date));
  const jByCat = {};
  jPeriod.forEach(e => { const c = cats.find(x => String(x.id) === String(e.categorie)); const name = c ? c.name : 'Sans catégorie'; jByCat[name] = (jByCat[name] || 0) + 1; });

  // Incidents
  const iPeriod = incidents.filter(i => inRange(i.date));
  const gravLabels = { grave: 'Grave', modere: 'Modéré', leger: 'Léger' };
  const iByGravite = { grave: 0, modere: 0, leger: 0 };
  iPeriod.forEach(i => { const g = i.gravite || 'leger'; iByGravite[g] = (iByGravite[g] || 0) + 1; });
  const iTraites = iPeriod.filter(i => i.statut === 'valide' || i.statut === 'classe').length;
  const typeLabels = { chute: 'Chute', agression: 'Agression', fugue: 'Fugue', violence: 'Violence', medical: 'Médical', materiel: 'Matériel', accident: 'Accident', autre: 'Autre' };
  const iByType = {};
  iPeriod.forEach(i => { const t = typeLabels[i.type] || i.type || 'Autre'; iByType[t] = (iByType[t] || 0) + 1; });

  // Avenants
  const avCrees = ppe.filter(p => inRange(p.dateRedaction)).length;
  const avActifs = ppe.filter(p => p.statut === 'actif').length;

  // Présences — taux moyen sur la période
  let rateSum = 0, rateDays = 0;
  Object.entries(presences).forEach(([d, day]) => {
    if (d < startStr || d > endStr) return;
    const vals = Object.values(day);
    const present = vals.filter(s => s === 'present').length;
    const counted = vals.filter(s => s === 'present' || s === 'absent').length;
    if (counted) { rateSum += present / counted * 100; rateDays++; }
  });
  const tauxPresence = rateDays ? Math.round(rateSum / rateDays) : null;

  // Entrées, sorties (permissions), évaluations, objectifs
  const entrees = residents.filter(r => inRange(r.entree)).length;
  let nbSorties = 0, nbEvals = 0, nbObjAtteints = 0;
  residents.forEach(r => {
    (r.sorties || []).forEach(s => { if (inRange(s.date)) nbSorties++; });
    (r.evaluations || []).forEach(ev => { if (inRange(ev.date)) nbEvals++; });
    const sv = r.objectifsSuivi || {};
    Object.values(sv).forEach(o => { if (o.statut === 'atteint' && inRange(o.dateMaj)) nbObjAtteints++; });
  });

  // ── INDICATEURS RÉGLEMENTAIRES ──
  // Taux d'occupation : journées réalisées / (capacité × jours avec données)
  const capacite = parseInt(settings.capacite) || 0;
  let joursReal = 0, joursData = 0;
  Object.entries(presences).forEach(([d, day]) => {
    if (d < startStr || d > endStr) return;
    joursReal += Object.values(day).filter(s => s === 'present' || s === 'absent').length;
    joursData++;
  });
  const tauxOccup = (capacite && joursData) ? Math.round(joursReal / (capacite * joursData) * 100) : null;
  // File active & mouvements
  const enFileActive = residents.filter(r => (r.entree || '0000') <= endStr && (!r.dateSortie || r.dateSortie >= startStr));
  const fileActive = enFileActive.length;
  const sortiesCount = residents.filter(r => r.dateSortie && inRange(r.dateSortie)).length;
  const dureesMois = enFileActive.filter(r => r.entree).map(r => {
    const fin = (r.dateSortie && r.dateSortie < endStr) ? new Date(r.dateSortie + 'T00:00:00') : _end;
    return (fin - new Date(r.entree + 'T00:00:00')) / (86400000 * 30.44);
  }).filter(x => x >= 0);
  const dureeMoyMois = dureesMois.length ? Math.round(dureesMois.reduce((a, b) => a + b, 0) / dureesMois.length) : null;
  // Taux de PPE actifs
  const residWithActivePpe = new Set(ppe.filter(p => p.statut === 'actif').map(p => String(p.residentId)));
  const tauxPpe = activeRes.length ? Math.round(activeRes.filter(r => residWithActivePpe.has(String(r.id))).length / activeRes.length * 100) : 0;
  // Profil du public
  const profilSexe = { Hommes: 0, Femmes: 0, Autre: 0 };
  activeRes.forEach(r => { profilSexe[r.genre === 'M' ? 'Hommes' : r.genre === 'F' ? 'Femmes' : 'Autre']++; });
  const ageTranches = { '< 18 ans': 0, '18-25 ans': 0, '26-40 ans': 0, '41-60 ans': 0, '60 ans et +': 0 };
  activeRes.forEach(r => { if (!r.dob) return; const a = Math.floor((Date.now() - new Date(r.dob)) / 31557600000); if (a < 18) ageTranches['< 18 ans']++; else if (a <= 25) ageTranches['18-25 ans']++; else if (a <= 40) ageTranches['26-40 ans']++; else if (a <= 60) ageTranches['41-60 ans']++; else ageTranches['60 ans et +']++; });
  const protLabels = { tutelle: 'Tutelle', curatelle: 'Curatelle', sauvegarde: 'Sauvegarde de justice', habilitation: 'Habilitation familiale', masp: 'MASP', accompagnement: 'Accompagnement', aucune: 'Aucune mesure', autre: 'Autre' };
  const protDist = {};
  activeRes.forEach(r => { const p = protLabels[r.protection] || r.protection || 'Non renseigné'; protDist[p] = (protDist[p] || 0) + 1; });

  // ── Satisfaction ──
  const satAll = DB.get(DB.keys.satisfaction) || [];
  const satPeriod = satAll.filter(s => inRange(s.date));
  const SAT_CATS_PDF = {
    'Accueil & intégration': ['accueil'],
    'Hébergement': ['chambre','parties_com'],
    'Restauration': ['repas_qualite','repas_quantite'],
    'Activités': ['activites'],
    'Équipe & accompagnement': ['respect','disponibilite','soins'],
    'Sécurité': ['securite'],
    'Communication': ['communication'],
    'Satisfaction globale': ['global']
  };
  const satAvgQ = {};
  Object.values(SAT_CATS_PDF).flat().forEach(qid => {
    const vals = satPeriod.map(s => s.reponses?.[qid]).filter(v => v != null);
    satAvgQ[qid] = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  });
  const satGlobalVals = Object.values(satAvgQ).filter(v => v !== null);
  const satScore = satGlobalVals.length ? satGlobalVals.reduce((a,b)=>a+b,0)/satGlobalVals.length : null;
  const satPct = satScore !== null ? Math.round(satScore*25) : null;
  const satCol = satScore === null ? '#94a3b8' : satScore >= 3.5 ? '#0d9488' : satScore >= 2.5 ? '#16a34a' : satScore >= 1.5 ? '#d97706' : '#dc2626';
  const satNiv = satScore === null ? '—' : satScore >= 3.5 ? 'Très satisfaisant' : satScore >= 2.5 ? 'Satisfaisant' : satScore >= 1.5 ? 'À améliorer' : 'Insuffisant';

  // ── ÉVOLUTION SATISFACTION PAR MOIS ──
  // Prend les 12 derniers mois glissants par rapport à la fin de période
  const satEvolMonths = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(endStr + 'T00:00:00');
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
    const label2 = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    const mSat = satAll.filter(s => s.date && s.date.startsWith(`${y}-${m}`));
    if (!mSat.length) { satEvolMonths.push({ label: label2, value: null, count: 0 }); continue; }
    const allVals = mSat.flatMap(s => Object.values(s.reponses || {}).filter(v => v != null));
    const avg = allVals.length ? allVals.reduce((a, b) => a + b, 0) / allVals.length : null;
    satEvolMonths.push({ label: label2, value: avg !== null ? Math.round(avg * 25) : null, count: mSat.length });
  }
  // Filtre les mois sans données aux deux extrémités
  const satEvolData = satEvolMonths.filter((_, i, arr) => {
    const firstData = arr.findIndex(p => p.value !== null);
    const lastData = arr.length - 1 - [...arr].reverse().findIndex(p => p.value !== null);
    return i >= firstData && i <= lastData;
  }).filter(p => p.value !== null);

  // ── SERAFIN-PH ──
  const withSp = activeRes.filter(r => (r.serafinph?.selected||[]).length > 0);
  const allScores = withSp.map(r => {
    const sp = r.serafinph || {};
    const selected = sp.selected || [];
    const prestations = {};
    selected.forEach(code => { prestations[code] = (sp.prestations?.[code]?.niveau) || 0; });
    return { total: Object.values(prestations).reduce((a, n) => a + n, 0), prestations, selected };
  });
  const gmps = allScores.length ? (allScores.reduce((a, s) => a + (s.selected.length ? s.total / s.selected.length : 0), 0) / allScores.length).toFixed(1) : null;
  const spNivRepart = [0, 0, 0, 0, 0];
  allScores.forEach(s => Object.values(s.prestations).forEach(n => spNivRepart[n]++));
  const spByPrest = {};
  SP_NOMENCLATURE.forEach(p => {
    const niveaux = allScores.filter(s => s.selected.includes(p.code)).map(s => s.prestations[p.code]);
    if (niveaux.length) {
      const moy = niveaux.reduce((a, n) => a + n, 0) / niveaux.length;
      spByPrest[p.label] = Math.round(moy * 10) / 10;
    }
  });

  // Tables HTML
  const barTable = (obj, color) => {
    const entries = Object.entries(obj).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return '<p class="empty-line">Aucune donnée sur la période.</p>';
    const max = Math.max(...entries.map(e => e[1]), 1);
    return `<table class="bars">${entries.map(([k, v]) => `<tr><td class="bl">${escHtml(k)}</td><td class="bb"><div class="bar" style="width:${Math.round(v / max * 100)}%;background:${color}"></div></td><td class="bv">${v}</td></tr>`).join('')}</table>`;
  };

  const kpi = (num, lbl) => `<div class="kpi"><div class="kpi-num">${num}</div><div class="kpi-lbl">${lbl}</div></div>`;

  // ── Découpage temporel (semaines si ≤ 45j, sinon mois) ──
  const MOIS_ABBR = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc'];
  const buckets = [];
  if (_days <= 45) {
    let cur = new Date(_start);
    while (cur <= _end) {
      const bs = new Date(cur), be = new Date(cur); be.setDate(be.getDate() + 6);
      buckets.push({ label: bs.getDate() + '/' + (bs.getMonth() + 1), start: bs.toISOString().slice(0, 10), end: be.toISOString().slice(0, 10) });
      cur.setDate(cur.getDate() + 7);
    }
  } else {
    let cur = new Date(_start.getFullYear(), _start.getMonth(), 1);
    while (cur <= _end) {
      const y = cur.getFullYear(), m = cur.getMonth();
      buckets.push({ label: MOIS_ABBR[m], start: new Date(y, m, 1).toISOString().slice(0, 10), end: new Date(y, m + 1, 0).toISOString().slice(0, 10) });
      cur.setMonth(cur.getMonth() + 1);
    }
  }
  const _inB = (d, b) => { const s = String(d || '').slice(0, 10); return s >= b.start && s <= b.end; };
  const jSeries = buckets.map(b => jPeriod.filter(e => _inB(e.date, b)).length);
  const iSeries = buckets.map(b => iPeriod.filter(i => _inB(i.date, b)).length);

  // ── TRANSMISSIONS ──
  const transmissions = DB.get(DB.keys.transmissions) || [];
  const trPeriod = transmissions.filter(t => t.date && t.date >= startStr && t.date <= endStr);
  const trByShift = { matin: 0, aprem: 0, soir: 0, nuit: 0 };
  const trByCat = {};
  const trUrgent = trPeriod.filter(t => t.priority === 'urgent' || t.cat === 'urgent').length;
  const trResidents = new Set(trPeriod.filter(t => t.residentId).map(t => t.residentId)).size;
  trPeriod.forEach(t => {
    if (trByShift[t.shift] !== undefined) trByShift[t.shift]++;
    const catLabel = { sante:'Santé', medicament:'Médicament', comportement:'Comportement', alimentation:'Alimentation', hygiene:'Hygiène', activite:'Activité', famille:'Famille', sortie:'Sortie / Retour', administratif:'Administratif', maintenance:'Maintenance', urgent:'Urgent' }[t.cat] || (t.cat || 'Autre');
    trByCat[catLabel] = (trByCat[catLabel] || 0) + 1;
  });
  const trByShiftLabel = { 'Matin (06h–14h)': trByShift.matin, 'Après-midi (14h–22h)': trByShift.aprem, 'Soir (18h–00h)': trByShift.soir, 'Nuit (00h–06h)': trByShift.nuit };
  const trSeries = buckets.map(b => trPeriod.filter(t => t.date >= b.start && t.date <= b.end).length);

  // ── ACTIVITÉS ÉDUCATIVES — bilan de chaque activité sur la période ──
  const ACT_CAT_LABELS = { sportive: 'Sportive', creative: 'Créative / Artistique', culturelle: 'Culturelle', scolaire: 'Scolaire / Soutien', autonomie: 'Autonomie / Vie quotidienne', sortie: 'Sortie / Extérieur', citoyennete: 'Citoyenneté / Expression', autre: 'Autre' };
  const activitesCatalogue = DB.get(DB.keys.activites) || [];
  const rapportAnnee = startStr.slice(0, 4);
  const activitesBilan = activitesCatalogue.map(act => {
    const inscriptionsActives = residents.filter(r => (r.activites || []).some(insc => String(insc.activiteId) === String(act.id) && insc.statut === 'active'));
    const bilanAnnuel = (act.bilansAnnuels || {})[rapportAnnee] || null;
    return { act, nbInscrits: inscriptionsActives.length, bilanAnnuel };
  }).filter(a => a.nbInscrits > 0 || a.bilanAnnuel);

  // ── CONTRIBUTIONS DE L'ÉQUIPE (saisies par les éducateurs etc., voir page rapport.html) ──
  const contribPeriod = getRapportContributions().filter(c => inRange((c.mois || '') + '-01'));
  const contribHtml = contribPeriod.length ? Object.entries(RC_CATEGORIES).map(([key, cat]) => {
    const items = contribPeriod.filter(c => c.categorie === key);
    if (!items.length) return '';
    return `<div style="margin-bottom:.25cm">
      <div style="font-size:10pt;font-weight:700;color:${cat.color};margin-bottom:.1cm">${cat.icon} ${cat.label}</div>
      ${items.map(c => `<p class="note" style="margin:.05cm 0 .1cm">${escHtml(c.texte)} <span style="font-size:8pt;color:#94a3b8">— ${escHtml(c.auteur)}</span></p>`).join('')}
    </div>`;
  }).join('') : '<p class="empty-line">Aucune contribution de l\'équipe enregistrée pour cette période.</p>';

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Rapport d'activité — ${escHtml(label)}</title>
<style>
  @page{margin:1.8cm 1.5cm}
  body{font-family:'Inter','Segoe UI',system-ui,sans-serif;font-size:11pt;line-height:1.6;color:#334155;max-width:820px;margin:0 auto}
  .top-stripe{height:6px;background:#0f2b4a;border-radius:0 0 4px 4px;margin-bottom:.5cm}
  .doc-header{margin-bottom:.6cm}
  .doc-header .etab{font-size:12pt;font-weight:300;color:#0f2b4a}
  .doc-header .etab strong{font-weight:700}
  .doc-header .doc-title{font-size:18pt;font-weight:800;color:#0f2b4a;margin-top:.05cm}
  .doc-header .doc-meta{font-size:9pt;color:#64748b;margin-top:.1cm}
  h2{font-size:13pt;color:#0f2b4a;border-bottom:2px solid #0f2b4a;padding-bottom:3px;margin:.6cm 0 .3cm}
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:.3cm;margin-bottom:.3cm}
  .kpi{border:1px solid #e2e8f0;border-radius:7px;padding:.35cm;text-align:center;page-break-inside:avoid}
  .kpi-num{font-size:18pt;font-weight:800;color:#0f2b4a;line-height:1.1}
  .kpi-lbl{font-size:9pt;color:#64748b;margin-top:3px}
  table.bars{width:100%;border-collapse:collapse}
  table.bars td{padding:3px 5px;vertical-align:middle}
  table.bars .bl{font-size:10pt;color:#334155;width:38%}
  table.bars .bb{width:52%}
  table.bars .bar{height:12px;border-radius:5px;min-width:2px}
  table.bars .bv{font-size:10pt;font-weight:700;color:#0f2b4a;text-align:right;width:10%}
  .grav-row{display:flex;gap:.3cm;margin-bottom:.2cm}
  .grav{flex:1;border-radius:6px;padding:.3cm;text-align:center;color:#fff;font-size:10pt;font-weight:600}
  .empty-line{font-size:10pt;color:#94a3b8;font-style:italic}
  .note{font-size:10pt;color:#475569;margin:.2cm 0;line-height:1.6}
  .methode{font-size:9.5pt;color:#2d4a62;background:#f0f5fa;border-left:3px solid #0369a1;padding:.25cm .4cm;border-radius:0 6px 6px 0;margin:.15cm 0 .3cm;line-height:1.55}
  svg{page-break-inside:avoid;max-width:100%}
  h2{page-break-after:avoid}
  .chart-title{font-size:10pt;font-weight:700;color:#0f2b4a;margin-bottom:.15cm}
  .sat-bar-row{display:flex;align-items:center;gap:.3cm;margin-bottom:.25cm}
  .sat-bar-label{width:5.5cm;font-size:10pt;color:#334155;text-align:right;flex-shrink:0}
  .sat-bar-track{flex:1;height:14px;background:#e2e8f0;border-radius:6px;overflow:hidden}
  .sat-bar-fill{height:100%;border-radius:6px}
  .sat-bar-val{width:2.5cm;font-size:10pt;font-weight:700;flex-shrink:0}
  .footer{margin-top:.8cm;padding-top:.3cm;border-top:1px solid #e2e8f0;text-align:center;font-size:9pt;color:#94a3b8}
  .actions{text-align:center;margin:.4cm 0}
  .actions button{padding:.35rem 1.1rem;border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc;cursor:pointer;font-size:9pt;margin:.2rem}
  @media print{.actions{display:none}}
</style></head><body>
<div class="top-stripe"></div>
<div class="doc-header">
  <div class="etab"><strong>${escHtml(settings.etablissement || 'Foyer d\'Hébergement')}</strong>${settings.ville ? ' — ' + escHtml(settings.ville) : ''}</div>
  <div class="doc-title">Rapport d'activité — ${escHtml(label)}</div>
  <div class="doc-meta">Période du ${fmtD(startStr)} au ${fmtD(endStr)} · Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${session ? ' · par ' + escHtml([session.prenom, session.nom].filter(Boolean).join(' ') || session.username) : ''}</div>
</div>
<div class="actions">
  <button onclick="window.print()">🖨 Imprimer / Enregistrer en PDF</button>
  <button onclick="window.close()">Fermer</button>
</div>

<h2>Synthèse</h2>
<div class="kpi-grid">
  ${kpi(tauxOccup != null ? tauxOccup + '%' : '—', "Taux d'occupation")}
  ${kpi(fileActive, 'File active')}
  ${kpi(activeRes.length, 'Résidents présents')}
  ${kpi(tauxPresence != null ? tauxPresence + '%' : '—', 'Taux de présence moyen')}
  ${kpi(entrees, 'Entrées (admissions)')}
  ${kpi(sortiesCount, 'Sorties')}
  ${kpi(dureeMoyMois != null ? dureeMoyMois + ' mois' : '—', 'Durée moy. de séjour')}
  ${kpi(tauxPpe + '%', 'Résidents avec PPE actif')}
  ${kpi(jPeriod.length, 'Entrées au journal')}
  ${kpi(trPeriod.length, 'Transmissions équipe')}
  ${kpi(iPeriod.length, 'Incidents déclarés')}
  ${kpi(avCrees, 'Avenants rédigés')}
  ${kpi(nbObjAtteints, 'Objectifs atteints')}
  ${kpi(gmps != null ? gmps : '—', 'GMPS moyen')}
  ${kpi(withSp.length + '/' + activeRes.length, 'Résidents évalués SERAFIN-PH')}
</div>
${capacite ? '' : '<p class="empty-line">ℹ Renseignez la « Capacité d\'accueil » dans Administration → Établissement pour calculer le taux d\'occupation.</p>'}

<h2>Public accompagné & mouvements</h2>
<p class="methode"><strong>📌 Méthode :</strong> La file active regroupe toutes les personnes dont la date d'entrée est antérieure ou égale à la fin de période et dont la date de sortie est postérieure ou égale au début de période. La durée moyenne de séjour est calculée sur les résidents présents ayant une date d'entrée renseignée. Le taux d'occupation rapporte les journées de présence effectivement enregistrées (module présences) à la capacité autorisée × les jours de la période.</p>
<p class="note">File active : <strong>${fileActive}</strong> personne${fileActive > 1 ? 's' : ''} · Entrées : <strong>${entrees}</strong> · Sorties : <strong>${sortiesCount}</strong> · Durée moy. de séjour : <strong>${dureeMoyMois != null ? dureeMoyMois + ' mois' : '—'}</strong>${capacite ? ` · Capacité : <strong>${capacite}</strong> places · Taux d'occupation : <strong>${tauxOccup != null ? tauxOccup + '%' : '—'}</strong>` : ''}.</p>
<div style="display:flex;gap:.8cm;flex-wrap:wrap;align-items:flex-start">
  <div style="flex:0 0 auto"><div class="chart-title">Répartition par sexe</div>${svgDonut([{ label: 'Hommes', value: profilSexe.Hommes, color: '#3b82f6' }, { label: 'Femmes', value: profilSexe.Femmes, color: '#ec4899' }, { label: 'Autre', value: profilSexe.Autre, color: '#94a3b8' }], 'résidents')}</div>
  <div style="flex:1;min-width:300px"><div class="chart-title">Par tranche d'âge</div>${svgHBar(ageTranches, '#0d9488', true)}</div>
</div>
<div style="margin-top:.35cm"><div class="chart-title">Mesures de protection juridique</div>${svgHBar(protDist, '#8b5cf6')}</div>

<h2>Évolution de l'activité</h2>
<p class="methode"><strong>📌 Méthode :</strong> Ce graphique croise sur le même axe temporel deux indicateurs d'activité : les entrées au journal de bord (transmissions d'équipe) et les incidents déclarés. Le découpage est hebdomadaire pour les périodes ≤ 45 jours, mensuel au-delà. Il permet d'identifier des pics d'activité ou de tension.</p>
<p class="note">Transmissions et incidents par ${_days <= 45 ? 'semaine' : 'mois'} sur la période.</p>
${svgColumns(buckets.map(b => b.label), [{ name: 'Transmissions journal', color: '#e85d04', data: jSeries }, { name: 'Incidents', color: '#dc2626', data: iSeries }])}

<h2>Activité du journal de bord</h2>
<p class="methode"><strong>📌 Méthode :</strong> Chaque entrée au journal correspond à une transmission enregistrée par l'équipe (observation, information, événement). Les entrées sont automatiquement classées selon les catégories paramétrées dans l'établissement. Le graphique montre la répartition par catégorie sur la période sélectionnée.</p>
<p class="note">${jPeriod.length} entrée${jPeriod.length > 1 ? 's' : ''} sur la période, réparties par catégorie :</p>
${svgHBar(jByCat, '#e85d04')}

<h2>Incidents & événements indésirables</h2>
<p class="methode"><strong>📌 Méthode :</strong> Les incidents sont déclarés manuellement par l'équipe dans le module dédié. Chaque déclaration précise le type (chute, agression, fugue…), la gravité (léger / modéré / grave) et le statut de traitement. Un incident est considéré comme « traité » lorsqu'il a été validé ou classé par un responsable.</p>
<p class="note">${iPeriod.length} incident${iPeriod.length > 1 ? 's' : ''} déclaré${iPeriod.length > 1 ? 's' : ''}, dont <strong>${iTraites}</strong> traité${iTraites > 1 ? 's' : ''} (validés ou classés).</p>
<div style="display:flex;gap:.8cm;flex-wrap:wrap;align-items:flex-start">
  <div style="flex:0 0 auto"><div class="chart-title">Par gravité</div>${svgDonut([{ label: 'Graves', value: iByGravite.grave, color: '#dc2626' }, { label: 'Modérés', value: iByGravite.modere, color: '#f59e0b' }, { label: 'Légers', value: iByGravite.leger, color: '#10b981' }], 'incidents')}</div>
  <div style="flex:1;min-width:300px"><div class="chart-title">Par type</div>${svgHBar(iByType, '#dc2626')}</div>
</div>

<h2>📡 Transmissions d'équipe</h2>
<p class="methode"><strong>📌 Méthode :</strong> Les transmissions sont les observations et consignes enregistrées par l'équipe à chaque vacation (Matin, Après-midi, Soir, Nuit). Elles permettent d'assurer la continuité du suivi entre les équipes. Une transmission est dite « urgente » si sa priorité ou sa catégorie est définie comme urgente. Ce module est distinct du journal de bord.</p>
<p class="note"><strong>${trPeriod.length}</strong> transmission${trPeriod.length > 1 ? 's' : ''} sur la période · <strong>${trUrgent}</strong> urgente${trUrgent > 1 ? 's' : ''} · <strong>${trResidents}</strong> résident${trResidents > 1 ? 's' : ''} concerné${trResidents > 1 ? 's' : ''}.</p>
${trPeriod.length ? `
<div style="display:flex;gap:.8cm;flex-wrap:wrap;align-items:flex-start;margin-bottom:.3cm">
  <div style="flex:1;min-width:260px"><div class="chart-title">Par vacation</div>${svgHBar(trByShiftLabel, '#3b82f6', true, {'Matin (06h–14h)':'#f59e0b','Après-midi (14h–22h)':'#3b82f6','Soir (18h–00h)':'#8b5cf6','Nuit (00h–06h)':'#1e293b'}, 200)}</div>
  <div style="flex:1;min-width:260px"><div class="chart-title">Par catégorie</div>${svgHBar(trByCat, '#6366f1')}</div>
</div>
<div class="chart-title">Évolution par ${_days <= 45 ? 'semaine' : 'mois'}</div>
${svgLine(buckets.map((b, i) => ({ label: b.label, value: trSeries[i] })), '#3b82f6', Math.max(...trSeries, 1))}
` : '<p class="empty-line">Aucune transmission enregistrée pour cette période.</p>'}

<h2>Projets personnalisés (PPE)</h2>
<p class="methode"><strong>📌 Méthode :</strong> Le PPE (Projet Personnalisé d'Établissement) est le document contractuel définissant les objectifs d'accompagnement de chaque résident. Le nombre d'avenants rédigés sur la période indique l'activité de révision des projets. Un avenant « actif » est en vigueur à la date de génération du rapport.</p>
<p class="note"><strong>${avCrees}</strong> avenant${avCrees > 1 ? 's' : ''} rédigé${avCrees > 1 ? 's' : ''} sur la période · <strong>${avActifs}</strong> avenant${avActifs > 1 ? 's' : ''} actuellement actif${avActifs > 1 ? 's' : ''} dans l'établissement.</p>

<h2>🎨 Activités éducatives</h2>
<p class="methode"><strong>📌 Méthode :</strong> Pour chaque activité du catalogue, ce bilan reprend le nombre de résidents actuellement inscrits et le bilan annuel rédigé par l'éducateur référent (depuis la page Activités éducatives, bouton « 📝 Bilan annuel ») pour l'année ${escHtml(rapportAnnee)}.</p>
${activitesBilan.length ? activitesBilan.map(({ act, nbInscrits, bilanAnnuel }) => {
  const catLabel = ACT_CAT_LABELS[act.categorie] || act.categorie || 'Autre';
  return `<div style="margin-bottom:.35cm;page-break-inside:avoid">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:.3cm">
      <span style="font-size:10.5pt;font-weight:700;color:#0f2b4a">${escHtml(act.nom || 'Activité')}</span>
      <span style="font-size:8.5pt;color:#64748b">${escHtml(catLabel)}${act.jour ? ' · ' + escHtml(act.jour) : ''}</span>
    </div>
    <p class="note" style="margin:.05cm 0 .15cm">${nbInscrits} résident${nbInscrits > 1 ? 's' : ''} inscrit${nbInscrits > 1 ? 's' : ''}</p>
    ${bilanAnnuel
      ? `<p style="font-size:9pt;color:#334155;margin:.05cm 0;padding-left:.3cm;border-left:2px solid #e2e8f0;white-space:pre-wrap">${escHtml(bilanAnnuel.texte)}<br><span style="font-size:8pt;color:#94a3b8">— ${escHtml(bilanAnnuel.auteur || '')}, ${fmtD(bilanAnnuel.date)}</span></p>`
      : `<p class="empty-line">Aucun bilan annuel rédigé pour ${escHtml(rapportAnnee)}.</p>`}
  </div>`;
}).join('') : '<p class="empty-line">Aucune activité avec inscrits ou bilan annuel pour cette année.</p>'}

<h2>Accompagnement individuel</h2>
<p class="methode"><strong>📌 Méthode :</strong> Les évaluations d'autonomie sont réalisées via des grilles standardisées renseignées par l'équipe. Les objectifs sont définis dans le PPE et leur suivi est mis à jour manuellement. Les sorties et permissions sont saisies dans le dossier résident à chaque occurrence.</p>
<p class="note"><strong>${nbEvals}</strong> évaluation${nbEvals > 1 ? 's' : ''} d'autonomie · <strong>${nbObjAtteints}</strong> objectif${nbObjAtteints > 1 ? 's' : ''} atteint${nbObjAtteints > 1 ? 's' : ''} · <strong>${nbSorties}</strong> sortie${nbSorties > 1 ? 's' : ''}/permission${nbSorties > 1 ? 's' : ''} enregistrée${nbSorties > 1 ? 's' : ''}.</p>

<h2>Profil SERAFIN-PH</h2>
<p class="note"><strong>${withSp.length}</strong> résident${withSp.length > 1 ? 's' : ''} évalué${withSp.length > 1 ? 's' : ''} sur <strong>${activeRes.length}</strong> résident${activeRes.length > 1 ? 's' : ''} présents · GMPS moyen : <strong>${gmps != null ? gmps : '—'}</strong> · Score total cumulé : <strong>${allScores.reduce((a, s) => a + s.total, 0)}</strong>.</p>
${withSp.length ? `<div style="display:flex;gap:.4cm;flex-wrap:wrap;margin-bottom:.3cm">
  <div style="flex:1;min-width:260px"><div class="chart-title">Moyenne par prestation</div>${svgHBar(spByPrest, '#8b5cf6', true, null, 330)}</div>
  <div style="flex:0 0 auto"><div class="chart-title">Répartition des niveaux</div>${svgDonut([{ label: 'Niveau 0 (Nul)', value: spNivRepart[0], color: '#d1d5db' }, { label: 'Niveau 1 (Faible)', value: spNivRepart[1], color: '#22c55e' }, { label: 'Niveau 2 (Modéré)', value: spNivRepart[2], color: '#eab308' }, { label: 'Niveau 3 (Important)', value: spNivRepart[3], color: '#f97316' }, { label: 'Niveau 4 (Très important)', value: spNivRepart[4], color: '#ef4444' }], 'niveaux')}</div>
</div>
<p class="note">Les niveaux SERAFIN-PH vont de 0 (aucun besoin) à 4 (besoin très important). Les prestations directes concernent la relation avec la personne accompagnée, les prestations indirectes le fonctionnement de l'établissement.</p>` : '<p class="empty-line">Aucune évaluation SERAFIN-PH renseignée pour la période.</p>'}

<h2>⭐ Satisfaction résidents</h2>
<p class="methode"><strong>📌 Méthode :</strong> La satisfaction est mesurée via des questionnaires remplis par les résidents ou leurs représentants légaux. Chaque question est notée de 0 à 4 (0 = Très insatisfait, 1 = Insatisfait, 2 = Neutre, 3 = Satisfait, 4 = Très satisfait). Le score est ensuite converti en pourcentage (score × 25). Les résultats sont regroupés en 8 catégories thématiques : Accueil & intégration, Hébergement, Restauration, Activités, Équipe & accompagnement, Sécurité, Communication, Satisfaction globale. Seuls les questionnaires dont la date de passation est comprise dans la période du rapport sont pris en compte.</p>
${satPeriod.length === 0 ? '<p class="empty-line">Aucun questionnaire de satisfaction enregistré pour cette période.</p>' : `
<div style="display:flex;align-items:center;gap:1cm;flex-wrap:wrap;margin-bottom:.45cm;padding:.4cm .5cm;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
  <div style="text-align:center;min-width:90px">
    <div style="font-size:28pt;font-weight:800;color:${satCol};line-height:1">${satPct !== null ? satPct + '%' : '—'}</div>
    <div style="font-size:8.5pt;color:#64748b;margin-top:2px">Score global</div>
    <div style="font-size:8pt;font-weight:700;color:${satCol};margin-top:2px">${satNiv}</div>
  </div>
  <div style="flex:1;min-width:200px">
    <div style="height:14px;border-radius:7px;background:#e2e8f0;overflow:hidden;margin-bottom:.15cm">
      <div style="height:100%;border-radius:7px;background:${satCol};width:${satPct !== null ? satPct : 0}%"></div>
    </div>
    <div style="font-size:8.5pt;color:#64748b">${satPeriod.length} questionnaire${satPeriod.length > 1 ? 's' : ''} analysé${satPeriod.length > 1 ? 's' : ''} sur la période</div>
  </div>
</div>
${satEvolData.length >= 2 ? `
<div class="chart-title" style="margin-top:.35cm">Évolution mensuelle du score de satisfaction (%)</div>
${svgLine(satEvolData, '#0ea5e9', 100, '%')}
<p style="font-size:8pt;color:#94a3b8;margin-top:.1cm;margin-bottom:.35cm">Moyenne de toutes les questions sur les 12 derniers mois glissants. Chaque point = score global du mois (0–100 %).</p>
` : ''}
<div class="chart-title" style="margin-top:.2cm">Scores par catégorie — période sélectionnée</div>
<table style="width:100%;border-collapse:collapse">
${Object.entries(SAT_CATS_PDF).map(([cat, qIds]) => {
  const vals = qIds.map(q => satAvgQ[q]).filter(v => v !== null);
  const avg = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  const pct2 = avg !== null ? Math.round(avg * 25) : null;
  const col2 = avg === null ? '#94a3b8' : avg >= 3.5 ? '#0d9488' : avg >= 2.5 ? '#16a34a' : avg >= 1.5 ? '#d97706' : '#dc2626';
  return `<tr>
    <td style="width:32%;font-size:9.5pt;padding:.12cm 0;color:#1e293b;font-weight:500">${cat}</td>
    <td style="width:52%;padding:.12cm .3cm">
      <div style="height:11px;border-radius:6px;background:#e2e8f0;overflow:hidden">
        <div style="height:100%;border-radius:6px;background:${col2};width:${pct2 !== null ? pct2 : 0}%"></div>
      </div>
    </td>
    <td style="width:8%;font-size:9.5pt;font-weight:700;color:${col2};text-align:right;padding:.12cm 0">${pct2 !== null ? pct2 + '%' : '—'}</td>
    <td style="width:8%;font-size:8pt;color:#94a3b8;text-align:right;padding:.12cm 0 .12cm .2cm">${avg !== null ? (avg >= 3.5 ? 'Très sat.' : avg >= 2.5 ? 'Satisf.' : avg >= 1.5 ? 'À amél.' : 'Insuff.') : 'N/A'}</td>
  </tr>`;
}).join('')}
</table>`}

<h2>✍️ Contributions de l'équipe</h2>
<p class="methode"><strong>📌 Méthode :</strong> Cette section reprend les apports qualitatifs saisis par les éducateurs et l'équipe (faits marquants, points forts, difficultés rencontrées, perspectives) via la page Rapport d'activité, pour les mois compris dans la période sélectionnée. Ce contenu n'est pas calculé automatiquement à partir des autres modules.</p>
${contribHtml}

<div class="footer">${escHtml(settings.etablissement || 'Établissement')} · Rapport d'activité ${escHtml(label)} · Document interne</div>
</body></html>`);
  w.document.close();
  if (typeof auditLog === 'function') auditLog('export', `Rapport d'activité — ${label}`);
}

document.addEventListener('DOMContentLoaded', async () => {
  await sbLoadResidentsCache();
  if (document.getElementById('rapportType')) {
    initRapportDefaults();
    toggleRapportPeriode();
  }
  if (document.getElementById('rcList')) { await loadRapportCache(); renderContributionsRapport(); }
});
