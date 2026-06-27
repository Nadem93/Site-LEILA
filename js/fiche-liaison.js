let _flResidentId = '';
let _flData = {};

async function initFicheLiaison() {
  Auth.requireAuth();
  await sbLoadResidentsCache();
  const params = new URLSearchParams(window.location.search);
  _flResidentId = params.get('residentId') || params.get('id') || '';

  _populateFlResidents();
  document.getElementById('flResident')?.addEventListener('change', e => {
    _flResidentId = e.target.value;
    loadFicheLiaison();
  });

  if (_flResidentId) loadFicheLiaison();
}

function _populateFlResidents() {
  const residents = sbResidents();
  const el = document.getElementById('flResident');
  if (!el) return;
  el.innerHTML = '<option value="">— Choisir un résident —</option>' +
    residents.map(r => `<option value="${r.id}">${escHtml((r.prenom||'')+' '+(r.nom||''))}</option>`).join('');
  if (_flResidentId) el.value = _flResidentId;
}

function loadFicheLiaison() {
  if (!_flResidentId) {
    document.getElementById('flContent').innerHTML = `<div class="empty" style="padding:4rem;text-align:center">
      <div style="font-size:3rem;margin-bottom:.5rem">🏥</div>
      <p style="font-weight:600;color:var(--text)">Sélectionnez un résident</p>
      <p style="font-size:.83rem;color:var(--muted)">La fiche de liaison sera générée automatiquement depuis son dossier.</p>
    </div>`;
    return;
  }

  const residents = sbResidents();
  const r = residents.find(x => x.id === _flResidentId);
  if (!r) { document.getElementById('flContent').innerHTML = '<p class="error">Résident introuvable.</p>'; return; }

  // Dernière évaluation MIF ou Barthel
  const evals = (DB.get(DB.keys.evaluations) || []).filter(e => e.residentId === _flResidentId).sort((a,b) => b.date.localeCompare(a.date));
  const lastEval = evals[0] || null;

  // Médicaments
  const medData = DB.get(DB.keys.medicaments) || {};
  const meds = medData[_flResidentId] || [];

  // Plan de soins
  const soins = (DB.get(DB.keys.planSoins) || []).filter(s => s.residentId === _flResidentId && s.actif !== false);

  // Contacts
  const contacts = r.contacts || r.famille || [];

  // Prénom / Nom de l'utilisateur connecté
  const session = Auth.getSession();
  const redacteur = session ? `${session.prenom||''} ${session.nom||''}`.trim() || session.username : 'Inconnu';

  _flData = { r, lastEval, meds, soins, contacts, redacteur };
  renderFicheLiaison();
}

function renderFicheLiaison() {
  const { r, lastEval, meds, soins, contacts, redacteur } = _flData;
  if (!r) return;

  const col = r.color || '#dc2626';
  const age = r.dateNaissance ? Math.floor((Date.now() - new Date(r.dateNaissance)) / 31557600000) : null;
  const today = new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  const section = (title, icon, content, borderColor) => `
    <div style="margin-bottom:1.1rem;border:1px solid ${borderColor||'#e2e8f0'};border-radius:10px;overflow:hidden">
      <div style="padding:.55rem .85rem;background:${borderColor||'#e2e8f0'}22;border-bottom:1px solid ${borderColor||'#e2e8f0'};display:flex;align-items:center;gap:.4rem">
        <span>${icon}</span>
        <span style="font-size:.8rem;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:.05em">${title}</span>
      </div>
      <div style="padding:.75rem .9rem">${content}</div>
    </div>`;

  const row = (label, value) => value ? `<div style="display:flex;gap:.5rem;padding:.2rem 0;border-bottom:.5px solid #f1f5f9">
    <span style="font-size:.78rem;color:#64748b;min-width:140px;flex-shrink:0">${label}</span>
    <span style="font-size:.8rem;font-weight:600;color:#1e293b">${escHtml(String(value))}</span>
  </div>` : '';

  const evalHtml = lastEval ? (() => {
    if (typeof EV_GRILLES !== 'undefined' && EV_GRILLES[lastEval.grille]) {
      const g = EV_GRILLES[lastEval.grille];
      let score = 0;
      if (lastEval.grille === 'mif') g.dimensions.forEach(d => d.items.forEach(it => { score += Number(lastEval.scores?.[it.id]||0); }));
      else if (lastEval.grille === 'barthel') g.dimensions[0].items.forEach(it => { score += Number(lastEval.scores?.[it.id]||0); });
      const niv = g.niveaux.find(n => score >= n.min && score <= n.max);
      const dateEval = new Date(lastEval.date).toLocaleDateString('fr-FR');
      return row(`${g.short} (${dateEval})`, `${score}/${g.scoreMax} — ${niv?.label||''}`) + (lastEval.note ? row('Note clinique', lastEval.note) : '');
    }
    return '';
  })() : '<span style="font-size:.78rem;color:#94a3b8;font-style:italic">Aucune évaluation enregistrée</span>';

  const medsHtml = meds.length
    ? meds.map(m => `<div style="display:flex;justify-content:space-between;padding:.25rem .4rem;background:#fff;border-radius:5px;margin-bottom:.2rem;border:.5px solid #e2e8f0">
        <span style="font-size:.78rem;font-weight:600">${escHtml(m.nom||m.name||'—')}</span>
        <span style="font-size:.74rem;color:#64748b">${escHtml(m.posologie||m.dose||'')} ${m.moment?'· '+escHtml(m.moment):''}</span>
      </div>`).join('')
    : '<span style="font-size:.78rem;color:#94a3b8;font-style:italic">Aucun médicament enregistré</span>';

  const soinsHtml = soins.length
    ? soins.slice(0,8).map(s => `<span style="display:inline-block;font-size:.72rem;background:#f1f5f9;border:.5px solid #e2e8f0;border-radius:5px;padding:2px 8px;margin:2px">${escHtml(s.libelle)}</span>`).join('')
    : '<span style="font-size:.78rem;color:#94a3b8;font-style:italic">Aucun soin défini</span>';

  const contactsHtml = contacts.length
    ? contacts.map(c => `<div style="padding:.3rem .4rem;background:#fff;border-radius:5px;margin-bottom:.2rem;border:.5px solid #e2e8f0">
        <span style="font-size:.78rem;font-weight:600">${escHtml(c.prenom||'')} ${escHtml(c.nom||'')} <span style="font-weight:400;color:#64748b">${c.lien?'('+escHtml(c.lien)+')':''}</span></span>
        ${c.tel ? `<span style="font-size:.75rem;color:#0369a1;margin-left:.5rem">📞 ${escHtml(c.tel)}</span>` : ''}
      </div>`).join('')
    : '<span style="font-size:.78rem;color:#94a3b8;font-style:italic">Aucun contact renseigné dans le dossier</span>';

  document.getElementById('flContent').innerHTML = `
    <div id="flPrintZone" style="background:#fff;border-radius:12px;border:2px solid ${col}33;overflow:hidden">

      <!-- En-tête -->
      <div style="background:${col};padding:1rem 1.25rem;display:flex;align-items:center;gap:1rem">
        <div style="width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:800;color:#fff;flex-shrink:0;border:2px solid rgba(255,255,255,.4)">
          ${(((r.prenom||'?')[0])+(r.nom||'?')[0]).toUpperCase()}
        </div>
        <div style="flex:1">
          <div style="font-size:1.15rem;font-weight:800;color:#fff">${escHtml((r.prenom||'')+' '+(r.nom||'').toUpperCase())}</div>
          <div style="font-size:.8rem;color:rgba(255,255,255,.8)">
            ${age !== null ? age + ' ans — ' : ''}${r.dateNaissance ? 'né(e) le ' + new Date(r.dateNaissance).toLocaleDateString('fr-FR') : ''}
            ${r.chambre ? ' · Chambre ' + escHtml(r.chambre) : ''}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:.65rem;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.06em">Fiche de liaison</div>
          <div style="font-size:.7rem;color:rgba(255,255,255,.85);margin-top:2px">${today}</div>
          <div style="font-size:.65rem;color:rgba(255,255,255,.7);margin-top:2px">Rédigée par : ${escHtml(redacteur)}</div>
        </div>
      </div>

      <div style="padding:1rem 1.1rem">

        ${section('Identité & administrative', '🪪', `
          ${row('Nom complet', (r.prenom||'')+' '+(r.nom||''))}
          ${row('Date de naissance', r.dateNaissance ? new Date(r.dateNaissance).toLocaleDateString('fr-FR') : null)}
          ${row('Âge', age !== null ? age + ' ans' : null)}
          ${row('N° Sécurité sociale', r.nss || r.securiteSociale || null)}
          ${row('Chambre', r.chambre || null)}
          ${row('Date d\'entrée', r.dateEntree ? new Date(r.dateEntree).toLocaleDateString('fr-FR') : null)}
          ${row('Tuteur / Représentant légal', r.tuteur || r.representantLegal || null)}
          ${row('Médecin référent', r.medecinReferent || r.medecin || null)}
          ${row('Référent établissement', r.referent || null)}
        `, col)}

        ${section('Informations médicales', '🩺', `
          ${row('Pathologies principales', r.pathologies || r.diagnostics || null)}
          ${row('Allergies', r.allergies || '⚠️ Non renseigné')}
          ${row('Groupe sanguin', r.groupeSanguin || null)}
          ${row('Antécédents', r.antecedents || null)}
          ${row('Observations', r.observations || null)}
          <div style="height:.5rem"></div>
          <div style="font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:.4rem">Niveau d'autonomie</div>
          ${evalHtml}
        `, '#dc2626')}

        ${section('Traitements en cours', '💊', medsHtml, '#8b5cf6')}

        ${section('Plan de soins actif', '📋', soinsHtml, '#0891b2')}

        ${section('Contacts à prévenir', '📞', contactsHtml, '#10b981')}

        ${section('Régime alimentaire & préférences', '🍽️', `
          ${row('Régime', r.regime || r.regimeAlimentaire || null)}
          ${row('Allergies alimentaires', r.allergiesAlimentaires || null)}
          ${row('Texture', r.texture || null)}
          ${row('Autres préférences', r.preferences || null)}
          ${!r.regime && !r.regimeAlimentaire ? '<span style="font-size:.78rem;color:#94a3b8;font-style:italic">Non renseigné</span>' : ''}
        `, '#f59e0b')}

        <!-- Zone signatures -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1.25rem;border-top:1px solid #e2e8f0;padding-top:1rem">
          <div>
            <div style="font-size:.72rem;font-weight:700;color:#64748b;margin-bottom:.35rem">Signature de l'infirmier(e) / rédacteur</div>
            <div style="height:50px;border-bottom:1px solid #cbd5e1;margin-bottom:.25rem"></div>
            <div style="font-size:.68rem;color:#94a3b8">${escHtml(redacteur)}</div>
          </div>
          <div>
            <div style="font-size:.72rem;font-weight:700;color:#64748b;margin-bottom:.35rem">Signature médecin / responsable</div>
            <div style="height:50px;border-bottom:1px solid #cbd5e1;margin-bottom:.25rem"></div>
            <div style="font-size:.68rem;color:#94a3b8">Nom et qualité :</div>
          </div>
        </div>

        <div style="text-align:center;margin-top:.75rem;font-size:.68rem;color:#94a3b8;font-style:italic">
          Document confidentiel — à transmettre uniquement aux professionnels de santé habilités · Généré le ${today}
        </div>
      </div>
    </div>`;
}

function printFiche() {
  if (!_flResidentId) { toast('Sélectionnez d\'abord un résident', 'error'); return; }
  const zone = document.getElementById('flPrintZone');
  if (!zone) return;
  const w = window.open('', '_blank', 'width=900,height=700');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Fiche de liaison</title>
    <style>
      body{font-family:'Inter',sans-serif;margin:0;padding:1.5rem;color:#1e293b;font-size:13px}
      *{box-sizing:border-box}
      @media print{body{padding:.5cm}}
    </style>
    </head><body>${zone.innerHTML}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

document.addEventListener('DOMContentLoaded', initFicheLiaison);
