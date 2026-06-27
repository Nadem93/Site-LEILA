// ── REGISTRE DES ÉVÉNEMENTS INDÉSIRABLES GRAVES (EIG / ARS) ──
let eigEditId = null;
let eigCanEdit = false;

const EIG_DESTINATAIRES = {
  ars: 'ARS (Agence Régionale de Santé)',
  cd: 'Conseil départemental / ASE',
  mdph: 'MDPH',
  famille: 'Famille / représentant légal',
  procureur: 'Procureur de la République',
  assurance: 'Assurance'
};

function eigList() {
  return getIncidents().filter(i => i.eig && i.eig.declarable);
}

function eigStatut(i) {
  if (i.eig.cloture) return 'cloture';
  if (i.eig.declareARS) return 'encours';
  return 'adeclarer';
}

// ── RENDU PRINCIPAL ──
function renderEig() {
  const all = eigList();
  const td = today();
  const ans = td.slice(0, 4);

  const aDeclarer = all.filter(i => eigStatut(i) === 'adeclarer');
  const enCours = all.filter(i => eigStatut(i) === 'encours');
  const clotures = all.filter(i => eigStatut(i) === 'cloture');
  const clotureesAnnee = clotures.filter(i => (i.eig.dateCloture || '').slice(0, 4) === ans);
  const enRetard = aDeclarer.filter(i => i.date && i.date < td);

  document.getElementById('eStats').innerHTML = `
    <div class="chx-stat" style="--c:#2563eb"><div class="chx-stat-top"><span class="chx-stat-lbl">À déclarer</span></div><div class="chx-stat-num">${aDeclarer.length}</div>${enRetard.length ? `<div style="font-size:.7rem;color:#dc2626;margin-top:.2rem">${enRetard.length} en retard</div>` : ''}</div>
    <div class="chx-stat" style="--c:#7c3aed"><div class="chx-stat-top"><span class="chx-stat-lbl">Déclarés, en cours</span></div><div class="chx-stat-num">${enCours.length}</div></div>
    <div class="chx-stat" style="--c:#16a34a"><div class="chx-stat-top"><span class="chx-stat-lbl">Clôturés (${ans})</span></div><div class="chx-stat-num">${clotureesAnnee.length}</div></div>
    <div class="chx-stat" style="--c:#0d9488"><div class="chx-stat-top"><span class="chx-stat-lbl">Total registre</span></div><div class="chx-stat-num">${all.length}</div></div>`;

  aDeclarer.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  enCours.sort((a, b) => (b.eig.dateDeclarationARS || '').localeCompare(a.eig.dateDeclarationARS || ''));
  clotures.sort((a, b) => (b.eig.dateCloture || '').localeCompare(a.eig.dateCloture || ''));

  const el = document.getElementById('eList');
  if (!all.length) {
    el.innerHTML = `<div class="empty" style="padding:2.5rem"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><h3>Aucun EIG enregistré</h3><p>Marquez un incident comme « Événement indésirable grave » depuis le module Incidents pour l'ajouter à ce registre.</p></div>`;
    return;
  }
  const section = (title, arr, open) => arr.length ? `
    <details ${open ? 'open' : ''} style="margin-bottom:1rem">
      <summary class="section-label" style="cursor:pointer;list-style:none;margin-bottom:.6rem">${title} (${arr.length})</summary>
      <div style="display:flex;flex-direction:column;gap:.55rem">${arr.map(eigRow).join('')}</div>
    </details>` : '';
  el.innerHTML =
    section('🚨 À déclarer', aDeclarer, true) +
    section('📨 Déclarés — suivi en cours', enCours, true) +
    section('✅ Clôturés', clotures, false);
}

function eigRow(i) {
  const td = today();
  const st = eigStatut(i);
  const stBadge = { adeclarer: '<span class="badge badge-red">À déclarer</span>', encours: '<span class="badge badge-blue">Déclaré — suivi</span>', cloture: '<span class="badge badge-green">Clôturé</span>' }[st];
  const retard = st === 'adeclarer' && i.date && i.date < td;
  return `<div class="card" style="border-left:3px solid ${graviteColor(i.gravite)}">
    <div class="card-body" style="padding:.75rem 1rem;display:flex;align-items:center;gap:.8rem;flex-wrap:wrap">
      <div style="flex:1;min-width:220px">
        <div style="display:flex;align-items:center;gap:.45rem;flex-wrap:wrap">
          <span style="font-weight:700;font-size:.88rem">${escHtml(i.titre)}</span>
          <span class="badge-incident ${GRAVITE_CLASSES[i.gravite] || ''}">${GRAVITE_LABELS[i.gravite] || i.gravite}</span>
          ${stBadge}
          ${retard ? '<span class="badge badge-red">Délai dépassé</span>' : ''}
        </div>
        <div style="font-size:.75rem;color:var(--muted);margin-top:2px">
          📅 ${formatDate(i.date)}${i.heure ? ' · ' + i.heure.slice(0,5) : ''}
          ${i.residentName ? ' · 👤 ' + escHtml(i.residentName) : ''}
          ${i.eig.dateDeclarationARS ? ' · déclaré le ' + formatDate(i.eig.dateDeclarationARS) : ''}
          ${i.eig.numeroSignalement ? ' · n° ' + escHtml(i.eig.numeroSignalement) : ''}
        </div>
      </div>
      <div class="no-print" style="display:flex;gap:.2rem;flex-shrink:0">
        <button class="btn btn-ghost btn-sm" onclick="printEigFiche('${i.id}')">🖨</button>
        ${eigCanEdit ? `<button class="btn btn-outline btn-sm" onclick="openEigModal('${i.id}')">Gérer</button>` : ''}
      </div>
    </div>
  </div>`;
}

// ── MODAL DE GESTION ──
function openEigModal(id) {
  eigEditId = id;
  const i = getIncidents().find(x => x.id === id);
  if (!i) return;
  const e = i.eig || {};
  document.getElementById('emTitle').textContent = `Déclaration EIG — ${i.titre}`;
  document.getElementById('emDestinataires').innerHTML = Object.entries(EIG_DESTINATAIRES).map(([k, label]) =>
    `<label style="display:flex;align-items:center;gap:.4rem;font-size:.82rem;font-weight:400"><input type="checkbox" value="${k}" ${(e.destinataires || []).includes(k) ? 'checked' : ''}/> ${label}</label>`
  ).join('');
  document.getElementById('emDeclareARS').checked = !!e.declareARS;
  document.getElementById('emDateDeclaration').value = e.dateDeclarationARS || '';
  document.getElementById('emNumero').value = e.numeroSignalement || '';
  document.getElementById('emMesuresImmediates').value = e.mesuresImmediates || '';
  document.getElementById('emMesuresCorrectives').value = e.mesuresCorrectives || '';
  document.getElementById('emCloture').checked = !!e.cloture;
  document.getElementById('emDateCloture').value = e.dateCloture || '';
  document.getElementById('emSuites').value = e.suites || '';
  openModal('modalEig');
}

function saveEig() {
  const list = getIncidents();
  const i = list.find(x => x.id === eigEditId);
  if (!i) return;
  const destinataires = [...document.querySelectorAll('#emDestinataires input:checked')].map(c => c.value);
  i.eig = {
    declarable: true,
    declareARS: document.getElementById('emDeclareARS').checked,
    dateDeclarationARS: document.getElementById('emDateDeclaration').value,
    numeroSignalement: document.getElementById('emNumero').value.trim(),
    destinataires,
    mesuresImmediates: document.getElementById('emMesuresImmediates').value.trim(),
    mesuresCorrectives: document.getElementById('emMesuresCorrectives').value.trim(),
    cloture: document.getElementById('emCloture').checked,
    dateCloture: document.getElementById('emDateCloture').value,
    suites: document.getElementById('emSuites').value.trim()
  };
  saveIncidents(list);
  if (typeof auditLog === 'function') auditLog('eig_save', `EIG — ${i.titre}`);
  toast('Déclaration EIG enregistrée ✓');
  closeModal('modalEig');
  renderEig();
}

// ── IMPRESSION ──
function printEigFiche(id) {
  const i = getIncidents().find(x => x.id === id);
  if (!i) return;
  const e = i.eig || {};
  const settings = DB.get(DB.keys.settings) || {};
  const w = window.open('', '_blank');
  if (!w) { toast('Autorisez les fenêtres pop-up pour imprimer', 'error'); return; }
  const row = (label, val) => `<tr><th>${label}</th><td>${val || '—'}</td></tr>`;
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Fiche EIG — ${escHtml(i.titre)}</title>
    <style>
      body{font-family:'Inter','Segoe UI',sans-serif;max-width:780px;margin:1.5rem auto;padding:0 1.5rem;color:#1e293b;font-size:10pt;line-height:1.6}
      h1{font-size:15pt;color:#dc2626;border-bottom:2px solid #dc2626;padding-bottom:.3rem}
      h2{font-size:11pt;color:#0f2b4a;margin-top:1.4rem}
      .meta{color:#64748b;font-size:9pt;margin-bottom:1.2rem}
      table{width:100%;border-collapse:collapse;margin-bottom:.6rem}
      th{text-align:left;width:240px;font-size:9pt;color:#475569;padding:.3rem .5rem;vertical-align:top;background:#f8fafc}
      td{padding:.3rem .5rem;font-size:9.5pt;border-bottom:1px solid #e2e8f0}
      .desc{white-space:pre-wrap;font-size:9.5pt;border:1px solid #e2e8f0;border-radius:6px;padding:.6rem .75rem;margin-top:.3rem}
      .sig{display:grid;grid-template-columns:1fr 1fr;gap:2rem;margin-top:2.5rem}
      .sig div{border-top:1px solid #94a3b8;padding-top:.4rem;font-size:9pt;color:#475569}
      @page{margin:1.5cm}
    </style></head><body>
    <h1>🚨 Fiche de signalement — Événement indésirable grave</h1>
    <div class="meta">${escHtml(settings.etablissement || 'Établissement')} · Édité le ${formatDate(today())}</div>
    <h2>Identification de l'événement</h2>
    <table>
      ${row('Titre', escHtml(i.titre))}
      ${row('Type', INCIDENT_TYPES[i.type] || i.type)}
      ${row('Gravité', GRAVITE_LABELS[i.gravite] || i.gravite)}
      ${row('Date / heure', formatDate(i.date) + (i.heure ? ' à ' + i.heure.slice(0,5) : ''))}
      ${row('Résident concerné', escHtml(i.residentName || '—'))}
      ${row('Lieu', escHtml(i.lieu || '—'))}
      ${row('Déclaré par', escHtml(i.declaredBy || '—'))}
    </table>
    <h2>Description des faits</h2>
    <div class="desc">${escHtml(i.description || '—')}</div>
    <h2>Mesures immédiates prises</h2>
    <div class="desc">${escHtml(e.mesuresImmediates || '—')}</div>
    <h2>Déclaration</h2>
    <table>
      ${row('Déclaré à l\'ARS', e.declareARS ? 'Oui' : 'Non')}
      ${row('Date de déclaration', e.dateDeclarationARS ? formatDate(e.dateDeclarationARS) : '—')}
      ${row('N° de signalement (portail)', escHtml(e.numeroSignalement || '—'))}
      ${row('Destinataires informés', (e.destinataires || []).map(d => EIG_DESTINATAIRES[d] || d).join(', ') || '—')}
    </table>
    <h2>Mesures correctives / suivi</h2>
    <div class="desc">${escHtml(e.mesuresCorrectives || '—')}</div>
    <h2>Clôture</h2>
    <table>
      ${row('Statut', e.cloture ? 'Clôturé' : 'En cours')}
      ${row('Date de clôture', e.dateCloture ? formatDate(e.dateCloture) : '—')}
      ${row('Suites données', escHtml(e.suites || '—'))}
    </table>
    <div class="sig"><div>Direction / référent qualité<br><br><br></div><div>Date<br><br><br></div></div>
    <script>window.onload=function(){window.print()}<\/script></body></html>`);
  w.document.close();
}

function printRegistreEig() {
  const all = eigList();
  if (!all.length) { toast('Aucun EIG à exporter', 'error'); return; }
  const settings = DB.get(DB.keys.settings) || {};
  const w = window.open('', '_blank');
  if (!w) { toast('Autorisez les fenêtres pop-up pour imprimer', 'error'); return; }
  const sorted = [...all].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Registre des EIG</title>
    <style>
      body{font-family:'Inter','Segoe UI',sans-serif;max-width:1000px;margin:1.5rem auto;padding:0 1.5rem;color:#1e293b;font-size:9pt;line-height:1.5}
      h1{font-size:15pt;color:#dc2626;border-bottom:2px solid #dc2626;padding-bottom:.3rem}
      .meta{color:#64748b;font-size:9pt;margin-bottom:1.2rem}
      table{width:100%;border-collapse:collapse}
      th{text-align:left;font-size:7.5pt;text-transform:uppercase;letter-spacing:.04em;color:#dc2626;border-bottom:2px solid #dc2626;padding:.3rem .4rem}
      td{padding:.3rem .4rem;border-bottom:1px solid #e2e8f0;font-size:8.5pt;vertical-align:top}
      @page{margin:1.5cm;size:landscape}
    </style></head><body>
    <h1>Registre des événements indésirables graves (EIG)</h1>
    <div class="meta">${escHtml(settings.etablissement || 'Établissement')} · Édité le ${formatDate(today())} · ${sorted.length} événement(s)</div>
    <table><thead><tr><th>Date</th><th>Événement</th><th>Type</th><th>Gravité</th><th>Résident</th><th>Déclaration ARS</th><th>N° signalement</th><th>Statut</th></tr></thead>
    <tbody>${sorted.map(i => `<tr>
      <td>${formatDate(i.date)}</td>
      <td>${escHtml(i.titre)}</td>
      <td>${INCIDENT_TYPES[i.type] || i.type}</td>
      <td>${GRAVITE_LABELS[i.gravite] || i.gravite}</td>
      <td>${escHtml(i.residentName || '—')}</td>
      <td>${i.eig.dateDeclarationARS ? formatDate(i.eig.dateDeclarationARS) : '—'}</td>
      <td>${escHtml(i.eig.numeroSignalement || '—')}</td>
      <td>${i.eig.cloture ? 'Clôturé' : i.eig.declareARS ? 'En cours' : 'À déclarer'}</td>
    </tr>`).join('')}</tbody></table>
    <script>window.onload=function(){window.print()}<\/script></body></html>`);
  w.document.close();
}

// ── INIT ──
async function initEig() {
  const s = Auth.requireAuth();
  if (!s) return;
  if (!requireModule('view_incidents')) return;
  eigCanEdit = ((typeof canValidateIncidents === 'function') ? canValidateIncidents(s.userId) : false) || Auth.isAdmin();
  try { _incCache = await sbGetIncidents(); } catch (e) { console.error('[initEig]', e); }
  renderEig();
}
document.addEventListener('DOMContentLoaded', initEig);
