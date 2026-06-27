// ── Résidents : source = Supabase (lecture via sbGetResidents, écriture via sbSaveResident) ──
let _residentsCache = [];
function residentsList() { return _residentsCache; }
async function loadResidentsCache() { _residentsCache = await sbGetResidents(); }

// ⚠️ CAS PARTICULIER — données de démonstration.
// Cette fonction générait des profils SERAFIN-PH ALÉATOIRES puis les écrivait dans
// DB.set(DB.keys.residents). Contrainte projet : aucune donnée fictive ne doit être
// écrite dans les tables prod. On ne persiste donc plus rien : le seeding reste
// uniquement en mémoire (cache) pour conserver l'aperçu de démonstration locale.
// Les vraies évaluations SERAFIN-PH arrivent via ppe.js → syncSerafinToResident().
function seedSpExemples() {
  const residents = residentsList();
  residents.forEach(r => {
    if (r.serafinph && Array.isArray(r.serafinph.selected) && r.serafinph.selected.length > 0) return;
    const codes = SP_NOMENCLATURE.map(p => p.code);
    for (let i = codes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [codes[i], codes[j]] = [codes[j], codes[i]];
    }
    const selected = codes.slice(0, 5 + Math.floor(Math.random() * 6));
    const prestations = {};
    selected.forEach(c => { prestations[c] = { niveau: 1 + Math.floor(Math.random() * 4) }; });
    r.serafinph = {
      selected,
      prestations,
      dateEvaluation: new Date(Date.now() - Math.random() * 180 * 86400000).toISOString().slice(0,10),
      notes: Math.random() < 0.3 ? 'Profil établi en équipe pluridisciplinaire.' : ''
    };
  });
  // Volontairement AUCUNE persistance ici (ni DB.set, ni sbSaveResident) : données fictives.
}

function getSpJournalStats() {
  const journal = DB.get(DB.keys.journal) || [];
  const direct = journal.filter(e => e.serafinphType === 'direct').length;
  const indirect = journal.filter(e => e.serafinphType === 'indirect').length;
  return { direct, indirect, total: direct + indirect };
}

async function initSerafinph() {
  const _s = Auth.requireAuth();
  if (!_s) return;
  if (!requireModule('access_serafinph')) return;
  await loadResidentsCache();
  seedSpExemples();
  renderSerafinph();
}

function renderSerafinph() {
  const residents = residentsList();
  const withSp = residents.filter(r => getSpData(r).selected.length > 0);
  const total = residents.length;

  // Stats
  const allScores = withSp.map(r => {
    const sp = getSpData(r);
    const sum = Object.values(sp.prestations).reduce((a,p) => a + p.niveau, 0);
    return { resident: r, sp, total: sum, gmpsResident: sp.selected.length ? sum / sp.selected.length : 0 };
  });

  const gmps = allScores.length ? (allScores.reduce((a,s) => a + s.gmpsResident, 0) / allScores.length).toFixed(1) : '—';
  const totalScore = allScores.reduce((a,s) => a + s.total, 0);
  const nbEleves = allScores.filter(s => Object.values(s.sp.prestations).some(p => p.niveau >= 3)).length;

  document.getElementById('spStatGmps').textContent = gmps;
  document.getElementById('spStatTotal').textContent = totalScore;
  document.getElementById('spStatEvalues').textContent = withSp.length + '/' + total;
  document.getElementById('spStatEleves').textContent = nbEleves;

  // Journal SERAFIN-PH
  const jStats = getSpJournalStats();
  const jEl = document.getElementById('spJournalStats');
  if (jEl) {
    jEl.innerHTML = jStats.total > 0
      ? `<div style="display:flex;gap:1rem;align-items:center;padding:.25rem 0">
          <span style="font-size:.78rem;color:var(--muted)">Entrées au journal :</span>
          <span style="font-weight:700;color:#8b5cf6">${jStats.direct} directe${jStats.direct>1?'s':''}</span>
          <span style="color:var(--g400)">·</span>
          <span style="font-weight:700;color:#f97316">${jStats.indirect} indirecte${jStats.indirect>1?'s':''}</span>
          <span style="color:var(--g400)">· Total : ${jStats.total}</span>
        </div>`
      : '<div style="font-size:.75rem;color:var(--muted);padding:.25rem 0">Aucune entrée de journal associée au SERAFIN-PH. Utilisez le champ « SERAFIN-PH » dans le journal pour taguer vos transmissions.</div>';
  }

  // Vue par prestation (uniquement les résidents ayant sélectionné chaque prestation)
  const prestStats = SP_NOMENCLATURE.map(p => {
    const niveaux = allScores.filter(s => s.sp.selected.includes(p.code)).map(s => s.sp.prestations[p.code].niveau);
    const moy = niveaux.length ? (niveaux.reduce((a,n) => a + n, 0) / niveaux.length).toFixed(1) : '—';
    const repart = [0,0,0,0,0];
    niveaux.forEach(n => repart[n]++);
    return { ...p, moy, repart, count: niveaux.length };
  });

  document.getElementById('spPrestationsList').innerHTML = prestStats.map(p => {
    const nivLabel = ['0','Faible','Modéré','Important','Très important'];
    const cols = p.count ? p.repart.map((c, i) => {
      const pct = (c / p.count * 100).toFixed(0);
      return `<div style="display:flex;align-items:center;gap:.25rem;font-size:.68rem">
        <span style="width:14px;text-align:center;font-weight:700;color:${['#94a3b8','#16a34a','#d97706','#f97316','#ef4444'][i]}">${i}</span>
        <div style="flex:1;height:8px;border-radius:99px;background:#e2e8f0;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${['#94a3b8','#16a34a','#d97706','#f97316','#ef4444'][i]};border-radius:99px"></div>
        </div>
        <span style="width:20px;text-align:right;color:var(--g400)">${c}</span>
      </div>`;
    }).join('') : '<div style="font-size:.7rem;color:var(--g400)">Aucun résident ne suit cette prestation</div>';
    return `<div style="display:flex;align-items:center;gap:.75rem;padding:.7rem 1.25rem;border-bottom:1px solid var(--border)">
      <span style="font-size:1rem">${p.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.82rem">${p.label} <span style="color:var(--g400);font-weight:400;font-size:.7rem">${p.code}</span></div>
        <div style="font-size:.7rem;color:var(--muted)">${p.cat} · ${p.count} résident${p.count>1?'s':''} suivi${p.count>1?'s':''}</div>
      </div>
      <div style="width:140px;display:flex;flex-direction:column;gap:2px">${cols}</div>
      <div style="font-weight:700;font-size:.85rem;color:#8b5cf6;width:40px;text-align:right">${p.moy}</div>
    </div>`;
  }).join('') || '<div class="empty" style="padding:2rem"><p>Aucune donnée SERAFIN-PH</p></div>';

  // Detail par resident
  const nivColors = ['#d1d5db','#22c55e','#eab308','#f97316','#ef4444'];
  document.getElementById('spResidentsList').innerHTML = allScores.sort((a,b) => b.total - a.total).map(s => {
    const prestItems = SP_NOMENCLATURE.filter(p => s.sp.selected.includes(p.code)).map(p => {
      const n = s.sp.prestations[p.code].niveau;
      return `<span style="display:inline-flex;align-items:center;gap:3px;margin:1px;background:#f8fafc;border-radius:5px;padding:1px 5px;border:1px solid #e2e8f0">
        <span style="font-size:.68rem">${p.icon}</span>
        <span style="display:inline-flex;align-items:center;justify-content:center;min-width:13px;height:13px;border-radius:3px;background:${nivColors[n]};color:#fff;font-size:.58rem;font-weight:700;padding:0 2px">${n}</span>
        <span style="color:#334155;font-size:.6rem;font-weight:500">${p.label}</span>
      </span>`;
    }).join('');
    return `<div style="display:flex;align-items:center;gap:.75rem;padding:.65rem 1.25rem;border-bottom:1px solid var(--border)">
      <span style="width:32px;height:32px;border-radius:50%;background:${s.resident.color||'#3b82f6'}20;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.72rem;color:${s.resident.color||'#3b82f6'};flex-shrink:0">${(s.resident.prenom||'')[0]}${(s.resident.nom||'')[0]}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.8rem">${escHtml(s.resident.prenom+' '+s.resident.nom)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:2px;margin-top:3px">${prestItems}</div>
      </div>
      <div style="font-weight:700;font-size:.85rem;color:#8b5cf6">${s.total}</div>
    </div>`;
  }).join('') || '<div class="empty" style="padding:2rem"><p>Aucun résident évalué</p></div>';
}

function printSerafinph() {
  const settings = DB.get(DB.keys.settings) || {};
  const phEtab = document.getElementById('phEtab');
  const phTitle = document.getElementById('phTitle');
  const phMeta = document.getElementById('phMeta');
  if (phEtab) phEtab.textContent = settings.etablissement || 'Foyer d\'Hébergement';
  if (phTitle) phTitle.textContent = 'Rapport SERAFIN-PH';
  if (phMeta) phMeta.textContent = `Imprimé le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`;

  const body = document.getElementById('spResidentsBody');
  const wasHidden = body && body.style.display === 'none';
  if (wasHidden) body.style.display = '';

  document.title = 'Rapport SERAFIN-PH';
  window.print();
  document.title = 'SERAFIN-PH — FTR';
  if (wasHidden) body.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', initSerafinph);
if (typeof registerPageInit === 'function') registerPageInit('serafinph', initSerafinph);
