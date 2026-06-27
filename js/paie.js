let _fpCache = [];
let _fpEmployesCache = [];
let _fpPointagesCache = [];

function getFichesPaie() { return _fpCache; }

// ── Jours fériés français (fixes + mobiles liés à Pâques) ──
function _frEaster(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function _frHolidays(year) {
  const pad = n => String(n).padStart(2, '0');
  const iso = dt => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const set = new Set([
    `${year}-01-01`, `${year}-05-01`, `${year}-05-08`, `${year}-07-14`,
    `${year}-08-15`, `${year}-11-01`, `${year}-11-11`, `${year}-12-25`
  ]);
  const easter = _frEaster(year);
  [1, 39, 50].forEach(off => { const d = new Date(easter); d.setDate(d.getDate() + off); set.add(iso(d)); });
  return set;
}
function _isFerie(dateStr) {
  const y = Number((dateStr || '').slice(0, 4));
  return y ? _frHolidays(y).has(dateStr) : false;
}

function _ptEntryHours(p) {
  if (!p.arrivee || !p.depart) return 0;
  const [h1, m1] = p.arrivee.split(':').map(Number);
  const [h2, m2] = p.depart.split(':').map(Number);
  let d = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (d < 0) d += 24 * 60;
  d -= Number(p.pauseMin || 0);
  return Math.max(0, d) / 60;
}

// Heures validées du mois, ventilées : total, dimanche, jour férié, 1er mai
function _pieHoursBreakdown(employeId, periode) {
  let total = 0, dimanche = 0, ferie = 0, mai1 = 0;
  _fpPointagesCache.forEach(p => {
    if (String(p.employeId) !== String(employeId)) return;
    if (!p.valide || !p.arrivee || !p.depart || !(p.date || '').startsWith(periode)) return;
    const h = _ptEntryHours(p);
    total += h;
    if ((p.date || '').slice(5) === '05-01') mai1 += h;               // 1er mai (férié payé double, légal)
    if (_isFerie(p.date)) ferie += h;                                  // un férié prime sur le dimanche
    else if (new Date(p.date + 'T00:00:00').getDay() === 0) dimanche += h;
  });
  return { total, dimanche, ferie, mai1 };
}

// Taux horaire approximatif (annualisation) : salaire mensuel / heures mensuelles
function _pieTauxHoraire(emp) {
  const heuresContrat = emp.heuresContrat ?? 35;
  const base = Number(emp.salaireBase) || 0;
  return (base && heuresContrat) ? base / (heuresContrat * 52 / 12) : 0;
}

// Indemnité légale du 1er mai : les heures travaillées ce jour-là sont payées DOUBLE
// → on ajoute l'équivalent d'une journée (heures × taux horaire) en plus du salaire.
function _pieMai1(emp, brk) {
  if (!brk.mai1) return 0;
  return brk.mai1 * _pieTauxHoraire(emp);
}

function _pieHoursForMonth(employeId, periode) {
  return _pieHoursBreakdown(employeId, periode).total;
}

// Config de majoration CCN 66 (points/heure + valeur du point) — à saisir depuis l'avenant salaires
function paieMajoration() {
  const def = { ptsDimanche: 0, ptsFerie: 0, valeurPoint: 0, tauxCotisations: 22 };
  try { return { ...def, ...(JSON.parse(localStorage.getItem('ftr_paie_majoration') || '{}')) }; }
  catch { return def; }
}
function _pieIndemnite(brk) {
  const c = paieMajoration();
  return (brk.dimanche * (c.ptsDimanche || 0) + brk.ferie * (c.ptsFerie || 0)) * (c.valeurPoint || 0);
}

function openPaieMajorationConfig() {
  if (!Auth.isAdmin()) { toast('Réservé aux administrateurs', 'error'); return; }
  const c = paieMajoration();
  const old = document.getElementById('modalMajoration'); if (old) old.remove();
  const div = document.createElement('div');
  div.innerHTML = `<div class="modal-overlay" id="modalMajoration" style="display:flex" onclick="closeModal('modalMajoration')">
    <div class="modal" style="max-width:460px" onclick="event.stopPropagation()">
      <div class="modal-header"><span class="modal-title">⚙️ Paramètres de paie (CCN 66)</span><button class="modal-close" onclick="closeModal('modalMajoration')">&times;</button></div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:.75rem">
        <div style="font-size:.78rem;color:var(--muted);background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:.55rem .7rem">
          Saisis les valeurs de <strong>ton dernier avenant salaires CCN 66</strong>. Indemnité = heures × points/heure × valeur du point.
        </div>
        <div class="section-label">Majoration dimanche / jours fériés</div>
        <div class="form-row">
          <div class="form-group"><label>Points/heure — dimanche</label><input type="number" id="majPtsDim" class="form-input" min="0" step="0.01" value="${c.ptsDimanche || ''}"/></div>
          <div class="form-group"><label>Points/heure — jour férié</label><input type="number" id="majPtsFer" class="form-input" min="0" step="0.01" value="${c.ptsFerie || ''}"/></div>
        </div>
        <div class="form-group"><label>Valeur du point (€)</label><input type="number" id="majValeur" class="form-input" min="0" step="0.0001" value="${c.valeurPoint || ''}"/></div>
        <div class="section-label" style="margin-top:.4rem">Net estimé</div>
        <div class="form-group">
          <label>Taux de cotisations salariales (%)</label>
          <input type="number" id="majCotis" class="form-input" min="0" max="100" step="0.1" value="${c.tauxCotisations ?? 22}"/>
          <span style="font-size:.72rem;color:var(--muted)">≈ 22 % pour un non‑cadre. Déduit du brut pour estimer le net (indicatif — le net officiel reste celui du bulletin).</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('modalMajoration')">Annuler</button>
        <button class="btn btn-primary" onclick="savePaieMajoration()">Enregistrer</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(div);
  requestAnimationFrame(() => document.getElementById('modalMajoration')?.classList.add('open'));
}

function savePaieMajoration() {
  const cfg = {
    ptsDimanche:     Number(document.getElementById('majPtsDim').value) || 0,
    ptsFerie:        Number(document.getElementById('majPtsFer').value) || 0,
    valeurPoint:     Number(document.getElementById('majValeur').value) || 0,
    tauxCotisations: Number(document.getElementById('majCotis').value) || 0
  };
  localStorage.setItem('ftr_paie_majoration', JSON.stringify(cfg));
  // Partage multi-appareil
  if (typeof sbSaveAppConfig === 'function') sbSaveAppConfig('paie_majoration', cfg).catch(e => console.warn('Sync majoration cloud', e));
  closeModal('modalMajoration');
  toast('Taux de majoration enregistrés', 'success');
}

// Heures contractuelles théoriques du mois (heuresContrat hebdo proratisé sur les jours ouvrés)
function _pieContractMonthHours(emp, periode) {
  const heuresContrat = emp.heuresContrat ?? 35;
  const [y, m] = periode.split('-').map(Number);
  if (!y || !m) return 0;
  const daysInMonth = new Date(y, m, 0).getDate();
  let weekdays = 0;
  for (let i = 1; i <= daysInMonth; i++) { const d = new Date(y, m-1, i).getDay(); if (d > 0 && d < 6) weekdays++; }
  return (heuresContrat / 5) * weekdays;
}

// Pré-remplit le brut (salaire de base, annualisation) + affiche les heures du mois et la récup
function pieAutofill() {
  const employeId = document.getElementById('pieFormEmploye').value;
  const periode = document.getElementById('pieFormPeriode').value;
  const emp = _fpEmployesCache.find(e => String(e.id) === String(employeId));
  const info = document.getElementById('pieAutoInfo');
  if (!emp) { if (info) info.style.display = 'none'; return; }
  // Toujours refléter le salarié sélectionné (vide s'il n'a pas de salaire de base)
  document.getElementById('pieBrut').value = emp.salaireBase ? Number(emp.salaireBase).toFixed(2) : '';
  if (info && periode) {
    const brk = _pieHoursBreakdown(employeId, periode);
    const contract = _pieContractMonthHours(emp, periode);
    const recup = brk.total - contract;
    const rc = recup >= 0 ? '#16a34a' : '#dc2626';
    const c = paieMajoration();
    const indemnite = _pieIndemnite(brk);
    const mai1Indem = _pieMai1(emp, brk);
    const configured = (c.valeurPoint > 0) && ((c.ptsDimanche > 0) || (c.ptsFerie > 0));
    // Prime pré-remplie = indemnité dim./fériés (si taux configurés) + indemnité légale 1er mai
    const totalPrime = (configured ? indemnite : 0) + mai1Indem;
    document.getElementById('piePrimes').value = totalPrime > 0 ? totalPrime.toFixed(2) : '';

    let majLine;
    if (!configured) {
      majLine = `<br>📅 Dimanche : <strong>${brk.dimanche.toFixed(1)}h</strong> · Jours fériés : <strong>${brk.ferie.toFixed(1)}h</strong> <span style="color:#dc2626">— configure les taux CCN 66 (⚙️) pour calculer l'indemnité</span>`;
    } else {
      majLine = `<br>📅 Indemnité dim./fériés : <strong style="color:#16a34a">${indemnite.toFixed(2)} €</strong> `
        + `<span style="color:var(--muted)">(${brk.dimanche.toFixed(1)}h dim × ${c.ptsDimanche}pt + ${brk.ferie.toFixed(1)}h fér × ${c.ptsFerie}pt × ${c.valeurPoint} €) → ajoutée aux primes</span>`;
    }
    const mai1Line = brk.mai1 > 0
      ? `<br>🔴 <strong>1er mai</strong> : <strong>${brk.mai1.toFixed(1)}h</strong> travaillées ${mai1Indem > 0 ? `→ payé double : <strong style="color:#16a34a">+${mai1Indem.toFixed(2)} €</strong> <span style="color:var(--muted)">(ajouté aux primes)</span>` : `<span style="color:#dc2626">— renseigne le salaire de base pour calculer le doublement</span>`}`
      : '';
    info.style.display = '';
    info.innerHTML = `💶 <strong>Salaire de base</strong> : ${emp.salaireBase ? Number(emp.salaireBase).toFixed(2) + ' €' : '<span style="color:#dc2626">non renseigné sur la fiche</span>'} <span style="color:var(--muted)">(annualisation — salaire fixe)</span>`
      + `<br>⏱ Heures validées ${paieFmtPeriode(periode)} : <strong>${brk.total.toFixed(1)}h</strong> · contractuel ≈ ${contract.toFixed(1)}h · récup : <strong style="color:${rc}">${recup >= 0 ? '+' : ''}${recup.toFixed(1)}h</strong>`
      + majLine + mai1Line;
  }
  pieModalSync();
  pieUpdateNet();
}

// En-tête interactif : sous-titre « Employé · Période » selon la sélection
function pieModalSync() {
  const sub = document.querySelector('#modalFichePaie .mdx-sub');
  if (!sub) return;
  const empSel = document.getElementById('pieFormEmploye');
  const empNom = (empSel && empSel.value && empSel.selectedIndex >= 0) ? empSel.options[empSel.selectedIndex].text : '';
  const per = document.getElementById('pieFormPeriode')?.value;
  sub.textContent = [empNom, per ? paieFmtPeriode(per) : ''].filter(Boolean).join(' · ') || 'Bulletin de salaire';
}

function paieFmtSize(b) {
  if (!b) return '';
  if (b < 1024) return b + ' o';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' Ko';
  return (b / (1024 * 1024)).toFixed(1) + ' Mo';
}

function paieCurrentUser() {
  const session = Auth.getSession();
  if (!session) return { employeId: 'anon', employeNom: 'Inconnu' };
  const emp = _fpEmployesCache.find(e => String(e.profileId) === String(session.userId));
  return {
    employeId: emp ? emp.id : 'u' + session.userId,
    employeNom: emp ? `${emp.prenom || ''} ${emp.nom || ''}`.trim() : ([session.prenom, session.nom].filter(Boolean).join(' ') || session.username)
  };
}

function paieFmtPeriode(p) {
  if (!p) return '';
  const [y, m] = p.split('-');
  const mois = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  return `${mois[parseInt(m, 10) - 1] || m} ${y}`;
}

async function initPaie() {
  const s = Auth.requireAuth();
  if (!s) return;
  if (!requireModule('access_paie')) return;
  // Multi-appareil : récupère les taux de majoration partagés depuis Supabase
  if (typeof hydrateConfigFromCloud === 'function') await hydrateConfigFromCloud();
  try {
    [_fpCache, _fpEmployesCache, _fpPointagesCache] = await Promise.all([sbGetFichesPaie(), sbGetEmployes(), sbGetPointages().catch(() => [])]);
  } catch (e) {
    console.error('[initPaie]', e);
    toast('Erreur de chargement', 'error');
  }
  if (Auth.isAdmin()) {
    const empSel = document.getElementById('pieFiltreEmploye');
    if (empSel) empSel.style.display = '';
  }
  renderPaie();
}

function openFichePaieModal() {
  const employes = _fpEmployesCache;
  const sel = document.getElementById('pieFormEmploye');
  sel.innerHTML = employes.map(e => `<option value="${e.id}">${escHtml(e.prenom + ' ' + e.nom)}</option>`).join('');
  document.getElementById('pieFormPeriode').value = today().slice(0, 7);
  document.getElementById('pieFormFile').value = '';
  ['pieBrut','piePrimes','pieHeuresSup','pieRetenues'].forEach(id => document.getElementById(id).value = '');
  _pieExtracted = {};
  const _rd = document.getElementById('pieFileRead');
  if (_rd) _rd.style.display = 'none';
  pieUpdateNet();
  pieAutofill();
  openModal('modalFichePaie');
}

function pieUpdateNet() {
  const brut   = Number(document.getElementById('pieBrut').value) || 0;
  const primes = Number(document.getElementById('piePrimes').value) || 0;
  const hs     = Number(document.getElementById('pieHeuresSup').value) || 0;
  const ret    = Number(document.getElementById('pieRetenues').value) || 0;
  const el = document.getElementById('pieNetLive');
  if (!brut && !primes && !hs && !ret) { el.innerHTML = '<span style="color:var(--muted);font-size:.82rem">Net estimé = Brut + Primes + Heures sup − cotisations − Retenues</span>'; return; }
  const taux = paieMajoration().tauxCotisations || 0;
  const assiette = brut + primes + hs;
  const cotis = assiette * taux / 100;
  const net = assiette - cotis - ret;
  el.innerHTML = `<span style="font-size:1.3rem;font-weight:800;color:#16a34a">${net.toFixed(2)} €</span><span style="color:var(--muted);font-size:.78rem"> net estimé</span>`
    + (taux ? `<div style="font-size:.72rem;color:var(--muted);margin-top:.15rem">− cotisations salariales ${taux}% : ${cotis.toFixed(2)} €</div>` : '');
}

// ── Lecture automatique du bulletin PDF ──
// Lit la couche texte du PDF en local (pdf.js) et extrait les infos clés du bulletin
// (brut, net, heures, majorations, cotisations, impôt…). Brut/Primes pré-remplissent
// les champs ; le reste est stocké dans `_pieExtracted` (sauvé dans details) et affiché
// sur la carte. Tout reste à vérifier avant d'enregistrer.
let _pieExtracted = {};

// Libellés + type d'affichage de chaque info (utilisés par la note ET la carte)
const PIE_DETAIL_META = {
  brut:         { label: 'Brut',             type: 'eur' },
  primes:       { label: 'Primes',           type: 'eur' },
  netReel:      { label: 'Net à payer',      type: 'eur' },
  netImposable: { label: 'Net imposable',    type: 'eur' },
  impot:        { label: 'Prélèv. source',   type: 'eur', neg: true },
  cotisations:  { label: 'Cotisations',      type: 'eur', neg: true },
  majoration:   { label: 'Maj. dim./fériés', type: 'eur' },
  heures:       { label: 'Heures',           type: 'h' }
};

// Règles de détection (libellés du plus spécifique au plus général).
// fill = pré-remplit un champ du formulaire ; sinon stocké dans les détails.
const PIE_EXTRACT = [
  { key: 'brut',         fill: 'pieBrut',   pick: 'last',  inc: [/total\s+brut/i, /salaire\s+brut/i, /r[ée]mun[ée]ration\s+brute/i, /\bbrut\b/i], exc: [/imposable/i] },
  { key: 'primes',       fill: 'piePrimes', pick: 'last',  inc: [/\bprime\b/i], exc: [/dimanche/i, /f[ée]ri/i] },
  { key: 'majoration',                      pick: 'last',  inc: [/indemnit[ée]\s+(?:dimanche|f[ée]ri)/i, /majoration\s+(?:dimanche|f[ée]ri|nuit)/i, /dimanche\s*\/?\s*f[ée]ri/i], exc: [] },
  { key: 'cotisations',                     pick: 'last',  inc: [/total\s+(?:des\s+)?cotisations(?:\s+et\s+contributions)?/i, /total\s+retenues\s+salarial/i], exc: [/patronal/i, /employeur/i] },
  { key: 'netImposable',                    pick: 'last',  inc: [/net\s+imposable/i, /net\s+fiscal/i], exc: [] },
  { key: 'impot',                           pick: 'last',  inc: [/pr[ée]l[èe]vement\s+(?:à|a)\s+la\s+source/i, /imp[oô]t\s+sur\s+le\s+revenu/i], exc: [/net\s+(?:à|a)\s+payer/i] },
  { key: 'netReel',                         pick: 'last',  inc: [/net\s+pay[ée]\b/i, /net\s+(?:à|a)\s+payer/i, /net\s+vers[ée]/i], exc: [/imposable/i, /fiscal/i, /social/i, /cotisation/i] },
  { key: 'heures',                          pick: 'first', inc: [/nombre\s+d.?heures/i, /heures\s+travaill/i], exc: [] }
];

function _pieFmtVal(key, v) {
  const m = PIE_DETAIL_META[key] || {};
  if (m.type === 'h') return v.toFixed(2).replace('.', ',') + ' h';
  return (m.neg ? '-' : '') + v.toFixed(2).replace('.', ',') + ' €';
}
function _frAmount(s) {
  s = String(s).replace(/[\s ]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); // FR : point = milliers, virgule = décimale
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}
function _amountsIn(line) {
  const out = [];
  const re = /\d[\d  .]*,\d{2}/g; // montants au format français : 1 234,56
  let m; while ((m = re.exec(line))) { const v = _frAmount(m[0]); if (v != null) out.push(v); }
  return out;
}
function _findLabeledAmount(lines, includeRes, excludeRes, pick) {
  for (const re of includeRes) { // libellés du plus spécifique au plus général
    for (const line of lines) {
      if (!re.test(line)) continue;
      if (excludeRes.some(ex => ex.test(line))) continue;
      const amts = _amountsIn(line);
      if (amts.length) return pick === 'first' ? amts[0] : amts[amts.length - 1];
    }
  }
  return null;
}
function _pieSetRead(note, bg, border, color, html) {
  if (!note) return;
  note.style.display = 'block';
  note.style.background = bg; note.style.border = '1px solid ' + border; note.style.color = color;
  note.innerHTML = html;
}
async function pieReadPdf(input) {
  const note = document.getElementById('pieFileRead');
  _pieExtracted = {};
  const file = input.files && input.files[0];
  if (!file) { if (note) note.style.display = 'none'; return; }
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) { _pieSetRead(note, '#fffbeb', '#fde68a', '#92400e', '📄 Lecture automatique réservée aux PDF — saisis le Brut manuellement.'); return; }
  if (typeof pdfjsLib === 'undefined') { _pieSetRead(note, '#fffbeb', '#fde68a', '#92400e', '⚠️ Lecteur PDF indisponible (connexion ?) — saisis le Brut manuellement.'); return; }
  _pieSetRead(note, '#eff6ff', '#bfdbfe', '#1e40af', '⏳ Lecture du bulletin…');
  try {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const lines = [];
    const maxPages = Math.min(pdf.numPages, 4);
    for (let p = 1; p <= maxPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const byRow = {};
      tc.items.forEach(it => {
        if (!it.str) return;
        const y = Math.round(it.transform[5]);
        (byRow[y] = byRow[y] || []).push({ x: it.transform[4], s: it.str });
      });
      Object.keys(byRow).forEach(y => lines.push(byRow[y].sort((a, b) => a.x - b.x).map(o => o.s).join(' ')));
    }
    const parts = [];
    for (const e of PIE_EXTRACT) {
      const v = _findLabeledAmount(lines, e.inc, e.exc, e.pick);
      if (v == null) continue;
      if (e.fill) document.getElementById(e.fill).value = v.toFixed(2);
      else _pieExtracted[e.key] = v;
      parts.push(`${PIE_DETAIL_META[e.key].label} <strong>${_pieFmtVal(e.key, v)}</strong>`);
    }
    if (!parts.length) { _pieSetRead(note, '#fffbeb', '#fde68a', '#92400e', '⚠️ Aucune information reconnue automatiquement sur ce bulletin — saisis les montants manuellement.'); return; }
    pieUpdateNet();
    _pieSetRead(note, '#f0fdf4', '#bbf7d0', '#166534',
      '📄 <strong>Lu sur le bulletin :</strong> ' + parts.join(' · ') + ' <span style="color:#64748b">— à vérifier avant d\'enregistrer.</span>');
  } catch (e) {
    console.error('[pieReadPdf]', e);
    _pieSetRead(note, '#fffbeb', '#fde68a', '#92400e', '⚠️ Lecture du PDF impossible (peut-être un scan/image) — saisis le Brut manuellement.');
  }
}

async function saveFichePaie() {
  const employeId = document.getElementById('pieFormEmploye').value;
  const emp = _fpEmployesCache.find(e => String(e.id) === String(employeId));
  const periode = document.getElementById('pieFormPeriode').value;
  const fileInput = document.getElementById('pieFormFile');
  const file = fileInput.files[0];
  if (!employeId || !emp) { toast('Employé requis', 'error'); return; }
  if (!periode) { toast('Période requise', 'error'); return; }
  if (!file) { toast('Veuillez joindre le bulletin de paie (PDF ou image)', 'error'); return; }
  if (file.size > 3 * 1024 * 1024) { toast('Fichier trop lourd (max 3 Mo)', 'error'); return; }

  const brut   = Number(document.getElementById('pieBrut').value) || 0;
  const primes = Number(document.getElementById('piePrimes').value) || 0;
  const heuresSup = Number(document.getElementById('pieHeuresSup').value) || 0;
  const retenues  = Number(document.getElementById('pieRetenues').value) || 0;
  const _tauxCotis = paieMajoration().tauxCotisations || 0;
  const _cotis = (brut + primes + heuresSup) * _tauxCotis / 100;
  const net = (brut || primes || heuresSup || retenues) ? (brut + primes + heuresSup - _cotis - retenues) : 0;
  const session = Auth.getSession();

  try {
    let fichierPath = '', fichierNom = '';
    if (file) {
      // Dépose le bulletin dans le dossier du salarié (pour qu'il puisse le consulter)
      const folder = emp.profileId ? emp.profileId : session.userId;
      fichierPath = await sbUploadJustificatif(file, folder);
      fichierNom = file.name;
    }
    const saved = await sbSaveFichePaie({
      employeId: emp.id, employeNom: `${emp.prenom || ''} ${emp.nom || ''}`.trim(),
      periode, brut, primes, heuresSup, retenues, net,
      details: _pieExtracted || {},
      fichierPath, fichierNom,
      ajoutePar: session ? [session.prenom, session.nom].filter(Boolean).join(' ') || session.username : ''
    });
    _fpCache.unshift(saved);
    if (typeof auditLog === 'function') auditLog('fiche_paie', `${emp.prenom} ${emp.nom} — ${paieFmtPeriode(periode)}`);
    toast('Fiche de paie ajoutée', 'success');
    closeModal('modalFichePaie');
    renderPaie();
  } catch (e) {
    const msg = e?.message || e?.details || JSON.stringify(e) || 'Erreur inconnue';
    toast('Erreur : ' + msg, 'error');
    console.error('[saveFichePaie]', e);
  }
}

function supprimerFichePaie(id) {
  confirmDialog('Supprimer cette fiche de paie ?', async () => {
    const f = _fpCache.find(x => x.id === id);
    try {
      if (f?.fichierPath) await sbDeleteJustificatif(f.fichierPath);
      await sbDeleteFichePaie(id);
      _fpCache = _fpCache.filter(x => x.id !== id);
      toast('Fiche de paie supprimée', 'info');
      renderPaie();
    } catch (e) {
      toast('Erreur : ' + (e?.message || e), 'error');
      console.error('[supprimerFichePaie]', e);
    }
  });
}

async function voirFichePaie(id) {
  const f = getFichesPaie().find(x => x.id === id);
  if (!f || !f.fichierPath) return;
  const url = await sbJustificatifUrl(f.fichierPath);
  if (url) window.open(url, '_blank'); else toast('Bulletin introuvable', 'error');
}

// Net estimé recalculé à l'affichage = (brut + primes + h.sup) − cotisations − retenues
function pieNetEstime(f) {
  const assiette = (Number(f.brut) || 0) + (Number(f.primes) || 0) + (Number(f.heuresSup) || 0);
  if (!assiette) return Number(f.net) || 0;
  const taux = paieMajoration().tauxCotisations || 0;
  return assiette - assiette * taux / 100 - (Number(f.retenues) || 0);
}

function paieBreakdown(f) {
  const items = [];
  if (f.brut) items.push(`<div class="pyx-stat"><div class="v">${moneyMask(Math.round(f.brut) + ' €')}</div><div class="l">Brut</div></div>`);
  if (f.primes) items.push(`<div class="pyx-stat"><div class="v">${moneyMask(Math.round(f.primes) + ' €')}</div><div class="l">Primes</div></div>`);
  if (f.heuresSup) items.push(`<div class="pyx-stat"><div class="v">${moneyMask(Math.round(f.heuresSup) + ' €')}</div><div class="l">H. sup</div></div>`);
  const taux = paieMajoration().tauxCotisations || 0;
  const cotis = ((Number(f.brut) || 0) + (Number(f.primes) || 0) + (Number(f.heuresSup) || 0)) * taux / 100;
  if (cotis) items.push(`<div class="pyx-stat neg"><div class="v">${moneyMask('-' + Math.round(cotis) + ' €')}</div><div class="l">Cotis. ${taux}%</div></div>`);
  if (f.retenues) items.push(`<div class="pyx-stat neg"><div class="v">${moneyMask('-' + Math.round(f.retenues) + ' €')}</div><div class="l">Retenues</div></div>`);
  return items.length ? `<div class="pyx-break">${items.join('')}</div>` : '';
}

// Détails lus sur le bulletin PDF (en plus des champs saisis) — affichés sur la carte
function paieDetailsHtml(f) {
  const d = f.details || {};
  const order = ['heures', 'majoration', 'netImposable', 'impot', 'cotisations'];
  const tiles = order.filter(k => d[k] != null).map(k => {
    const m = PIE_DETAIL_META[k] || { label: k, type: 'eur' };
    const disp = m.type === 'h'
      ? (Math.round(d[k] * 100) / 100).toFixed(2).replace('.', ',') + ' h'
      : moneyMask((m.neg ? '-' : '') + Math.round(d[k]) + ' €');
    return `<div class="pyx-stat${m.neg ? ' neg' : ''}"><div class="v">${disp}</div><div class="l">${m.label}</div></div>`;
  });
  if (!tiles.length) return '';
  return `<div style="font-size:.62rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:.55rem 0 .3rem">📄 Détails du bulletin</div><div class="pyx-break">${tiles.join('')}</div>`;
}

function paieItemHtml(f, isAdmin) {
  const real = (f.details && f.details.netReel != null) ? Number(f.details.netReel) : null;
  const net = real != null ? real : pieNetEstime(f);
  const netLbl = real != null ? 'Net à payer' : 'Net estimé';
  const _emp = _fpEmployesCache.find(x => String(x.id) === String(f.employeId));
  const nomAff = _emp ? `${_emp.prenom || ''} ${_emp.nom || ''}`.trim() : (f.employeNom || '');
  return `<article class="pyx-card">
    <div class="pyx-head">
      <div class="pyx-ico">🧾</div>
      <div class="pyx-h-txt">
        <div class="pyx-period">${paieFmtPeriode(f.periode)}</div>
        ${isAdmin ? `<div class="pyx-emp">${escHtml(nomAff)}</div>` : ''}
      </div>
    </div>
    ${net > 0
      ? `<div class="pyx-net"><div class="pyx-net-lbl">${netLbl}</div><div class="pyx-net-val">${moneyMask(net.toFixed(2) + ' €', 'lead')}</div></div>`
      : `<div class="pyx-nofile">Bulletin déposé — montant non saisi</div>`}
    ${paieBreakdown(f)}
    ${paieDetailsHtml(f)}
    <div class="pyx-meta">${f.fichierNom ? escHtml(f.fichierNom) + ' · ' : ''}Ajouté le ${f.createdAt ? new Date(f.createdAt).toLocaleDateString('fr-FR') : '—'}${f.ajoutePar ? ' par ' + escHtml(f.ajoutePar) : ''}</div>
    <div class="pyx-foot">
      ${f.fichierPath ? `<button class="pyx-btn dl" onclick="voirFichePaie('${f.id}')">⬇ Télécharger</button>` : `<span class="pyx-meta">Aucun fichier joint</span>`}
      <span class="sp"></span>
      ${isAdmin ? `<button class="pyx-ibtn" onclick="supprimerFichePaie('${f.id}')" title="Supprimer">✕</button>` : ''}
    </div>
  </article>`;
}

function renderRecapAnnuel(list, isAdmin) {
  const card = document.getElementById('pieRecapCard');
  if (!card) return;
  if (!isAdmin) { card.style.display = 'none'; return; }
  const withSalaire = list.filter(f => f.net > 0);
  if (!withSalaire.length) { card.style.display = 'none'; return; }
  card.style.display = '';

  const byEmp = {};
  withSalaire.forEach(f => {
    const k = f.employeId;
    if (!byEmp[k]) byEmp[k] = { nom: f.employeNom, brut:0, net:0, primes:0, heuresSup:0, count:0 };
    byEmp[k].brut += f.brut||0; byEmp[k].net += pieNetEstime(f); byEmp[k].primes += f.primes||0; byEmp[k].heuresSup += f.heuresSup||0; byEmp[k].count++;
  });

  document.getElementById('pieRecapBody').innerHTML = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.8rem">
    <thead><tr style="border-bottom:2px solid var(--border)">
      <th style="text-align:left;padding:.4rem .5rem">Employé</th>
      <th style="text-align:right;padding:.4rem .5rem">Bulletins</th>
      <th style="text-align:right;padding:.4rem .5rem">Total brut</th>
      <th style="text-align:right;padding:.4rem .5rem">Primes</th>
      <th style="text-align:right;padding:.4rem .5rem">Heures sup</th>
      <th style="text-align:right;padding:.4rem .5rem">Total net</th>
    </tr></thead>
    <tbody>${Object.values(byEmp).map(e => `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:.4rem .5rem;font-weight:600">${escHtml(e.nom)}</td>
      <td style="text-align:right;padding:.4rem .5rem">${e.count}</td>
      <td style="text-align:right;padding:.4rem .5rem">${e.brut.toFixed(2)} €</td>
      <td style="text-align:right;padding:.4rem .5rem">${e.primes.toFixed(2)} €</td>
      <td style="text-align:right;padding:.4rem .5rem">${e.heuresSup.toFixed(2)} €</td>
      <td style="text-align:right;padding:.4rem .5rem;font-weight:700;color:#16a34a">${e.net.toFixed(2)} €</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function renderPaie() {
  const isAdmin = Auth.isAdmin();
  const cu = paieCurrentUser();
  const list = getFichesPaie();

  if (isAdmin) {
    const empSel = document.getElementById('pieFiltreEmploye');
    if (empSel) {
      const current = empSel.value;
      const employesMap = new Map();
      list.forEach(f => { if (f.employeId && !employesMap.has(f.employeId)) employesMap.set(f.employeId, f.employeNom); });
      empSel.innerHTML = '<option value="">Tous les employés</option>' + Array.from(employesMap.entries()).map(([id, nom]) => `<option value="${id}">${escHtml(nom)}</option>`).join('');
      empSel.value = current;
    }
  }

  const anneeSel = document.getElementById('pieFiltreAnnee');
  if (anneeSel) {
    const current = anneeSel.value;
    const annees = [...new Set(list.map(f => (f.periode || '').slice(0, 4)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
    anneeSel.innerHTML = '<option value="">Toutes les années</option>' + annees.map(a => `<option value="${a}">${a}</option>`).join('');
    anneeSel.value = current;
  }

  const filtreEmploye = isAdmin ? (document.getElementById('pieFiltreEmploye')?.value || '') : '';
  const filtreAnnee = document.getElementById('pieFiltreAnnee')?.value || '';

  const session = Auth.getSession();
  let filtered = list;
  if (!isAdmin) filtered = filtered.filter(f =>
    f.employeId === cu.employeId || f.employeId === String(session?.userId)
  );
  if (filtreEmploye) filtered = filtered.filter(f => f.employeId === filtreEmploye);
  if (filtreAnnee) filtered = filtered.filter(f => (f.periode || '').slice(0, 4) === filtreAnnee);

  renderRecapAnnuel(filtered, isAdmin);

  const el = document.getElementById('pieList');
  if (!filtered.length) {
    el.innerHTML = '<div class="empty" style="padding:3rem;text-align:center"><p>Aucune fiche de paie trouvée.</p></div>';
    return;
  }
  el.innerHTML = `<div class="pyx-grid">` + filtered.sort((a, b) => (b.periode || '').localeCompare(a.periode || '')).map(f => paieItemHtml(f, isAdmin)).join('') + `</div>`;
}

document.addEventListener('DOMContentLoaded', initPaie);
if (typeof registerPageInit === 'function') registerPageInit('paie', initPaie);
