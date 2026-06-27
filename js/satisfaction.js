const SAT_KEY = DB.keys.satisfaction;

const SAT_QUESTIONS = [
  { id:'accueil',       cat:'Accueil & intégration',    label:'Qualité de l\'accueil lors de l\'arrivée' },
  { id:'chambre',       cat:'Hébergement',              label:'Confort et propreté de la chambre' },
  { id:'parties_com',   cat:'Hébergement',              label:'Qualité des parties communes' },
  { id:'repas_qualite', cat:'Restauration',             label:'Qualité des repas' },
  { id:'repas_quantite',cat:'Restauration',             label:'Quantité et horaires des repas' },
  { id:'activites',     cat:'Activités',                label:'Diversité des activités proposées' },
  { id:'respect',       cat:'Équipe & accompagnement',  label:'Respect et écoute de la part de l\'équipe' },
  { id:'disponibilite', cat:'Équipe & accompagnement',  label:'Disponibilité du personnel' },
  { id:'soins',         cat:'Équipe & accompagnement',  label:'Qualité des soins et de l\'accompagnement' },
  { id:'securite',      cat:'Sécurité',                 label:'Sentiment de sécurité au sein de l\'établissement' },
  { id:'communication', cat:'Communication',            label:'Information et communication avec la famille' },
  { id:'global',        cat:'Satisfaction globale',     label:'Satisfaction globale de votre séjour' }
];

const SAT_LABELS = ['Très insatisfait', 'Insatisfait', 'Neutre', 'Satisfait', 'Très satisfait'];
const SAT_COLORS = ['#dc2626','#ea580c','#d97706','#16a34a','#0d9488'];

// Source = Supabase. Caches mémoire chargés au démarrage.
let _satCache = [];
let _satqCache = [];
function getSat()      { return _satCache; }
async function loadSatCache() { _satCache = await sbGetSatisfaction(); }
function getCustomQuestions()      { return _satqCache; }
async function loadSatQuestionsCache() { _satqCache = await sbGetSatQuestions(); }

function getAllQuestions() {
  return [...SAT_QUESTIONS, ...getCustomQuestions()];
}

let _satEditId  = '';
let _satViewMode = 'resultats'; // 'resultats' | 'formulaires' | 'questions'

async function initSatisfaction() {
  Auth.requireAuth();
  await sbLoadResidentsCache();
  await Promise.all([loadSatCache(), loadSatQuestionsCache()]);
  document.getElementById('satTabResultats')?.addEventListener('click',   () => { _satViewMode = 'resultats';   renderSat(); _setTab('resultats'); });
  document.getElementById('satTabFormulaires')?.addEventListener('click', () => { _satViewMode = 'formulaires'; renderSat(); _setTab('formulaires'); });
  document.getElementById('satTabQuestions')?.addEventListener('click',   () => { _satViewMode = 'questions';   renderSat(); _setTab('questions'); });

  // Onglet "Questions" visible uniquement pour les admins
  const tabQ = document.getElementById('satTabQuestions');
  if (tabQ) tabQ.style.display = Auth.isAdmin() ? '' : 'none';

  renderSat();
}

function _setTab(t) {
  ['resultats','formulaires','questions'].forEach(k => {
    document.getElementById('satTab' + k.charAt(0).toUpperCase() + k.slice(1))?.classList.toggle('active', k === t);
  });
}

// ─── Dispatch ────────────────────────────────────────────────────────────────
function renderSat() {
  if      (_satViewMode === 'resultats')   renderSatResultats();
  else if (_satViewMode === 'formulaires') renderSatFormulaires();
  else                                     renderSatQuestions();
}

// ─── Vue résultats ────────────────────────────────────────────────────────────
function renderSatResultats() {
  const list = getSat();
  const allQ = getAllQuestions();
  const container = document.getElementById('satContent');
  if (!container) return;

  document.getElementById('satStatTotal').textContent = list.length;
  document.getElementById('satStatMois').textContent  = list.filter(s => s.date >= new Date(Date.now()-30*86400000).toISOString().slice(0,10)).length;

  if (!list.length) {
    container.innerHTML = `<div class="empty" style="padding:4rem;text-align:center">
      <div style="font-size:3rem;margin-bottom:.5rem">⭐</div>
      <p style="font-weight:600">Aucun questionnaire rempli</p>
      <button class="btn btn-accent btn-sm" onclick="openSatModal()">Saisir un questionnaire</button>
    </div>`;
    return;
  }

  const avgQ = {};
  allQ.forEach(q => {
    const vals = list.map(s => s.reponses?.[q.id]).filter(v => v !== undefined && v !== null);
    avgQ[q.id] = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
  });
  const globalAvg = Object.values(avgQ).filter(v => v !== null);
  const scoreGlobal = globalAvg.length ? globalAvg.reduce((a,b)=>a+b,0)/globalAvg.length : null;

  const cats = [...new Set(allQ.map(q => q.cat))];
  document.getElementById('satStatScore').textContent = scoreGlobal !== null ? (scoreGlobal*25).toFixed(0)+'%' : '—';

  container.innerHTML = `
    <div style="margin-bottom:1.25rem;padding:.85rem 1rem;background:#fff;border-radius:12px;border:1px solid var(--border);display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap">
      <div style="text-align:center;min-width:90px">
        <div style="font-size:2rem;font-weight:800;color:${_satColor(scoreGlobal)}">${scoreGlobal !== null ? scoreGlobal.toFixed(1)+'/4' : '—'}</div>
        <div style="font-size:.72rem;color:var(--muted)">Score global</div>
        <div style="font-size:.75rem;font-weight:600;color:${_satColor(scoreGlobal)};margin-top:2px">${scoreGlobal !== null ? SAT_LABELS[Math.round(scoreGlobal)] : ''}</div>
      </div>
      <div style="flex:1;min-width:200px">
        <div style="height:10px;background:var(--border);border-radius:999px;overflow:hidden">
          <div style="height:100%;width:${scoreGlobal!==null?scoreGlobal/4*100:0}%;background:${_satColor(scoreGlobal)};border-radius:999px;transition:width .4s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:.3rem">
          ${SAT_LABELS.map(l => `<span style="font-size:.6rem;color:var(--muted)">${l}</span>`).join('')}
        </div>
      </div>
    </div>

    ${cats.map(cat => {
      const qs = allQ.filter(q => q.cat === cat);
      return `<div style="background:#fff;border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:.75rem">
        <div style="padding:.5rem .85rem;background:var(--g50);border-bottom:1px solid var(--border);font-size:.78rem;font-weight:700;color:var(--text)">${cat}</div>
        <div style="padding:.5rem .85rem;display:flex;flex-direction:column;gap:.4rem">
          ${qs.map(q => {
            const avg = avgQ[q.id];
            const pct = avg !== null ? Math.round(avg/4*100) : 0;
            const col = _satColor(avg);
            return `<div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem">
                <span style="font-size:.79rem;color:var(--text)">${q.label}</span>
                <span style="font-size:.78rem;font-weight:700;color:${col};min-width:32px;text-align:right">${avg!==null?avg.toFixed(1):'-'}</span>
              </div>
              <div style="height:6px;background:var(--border);border-radius:999px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${col};border-radius:999px"></div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }).join('')}`;
}

function _satColor(v) {
  if (v === null) return '#94a3b8';
  if (v >= 3.5) return '#0d9488';
  if (v >= 2.5) return '#16a34a';
  if (v >= 1.5) return '#d97706';
  return '#dc2626';
}

// ─── Vue formulaires ──────────────────────────────────────────────────────────
function renderSatFormulaires() {
  const list = getSat().slice().sort((a,b) => b.date.localeCompare(a.date));
  const allQ = getAllQuestions();
  const container = document.getElementById('satContent');
  if (!container) return;

  document.getElementById('satStatTotal').textContent = list.length;
  document.getElementById('satStatMois').textContent  = list.filter(s => s.date >= new Date(Date.now()-30*86400000).toISOString().slice(0,10)).length;

  if (!list.length) {
    container.innerHTML = '<div class="empty" style="padding:3rem;text-align:center"><p>Aucun questionnaire</p></div>';
    return;
  }

  container.innerHTML = list.map(s => {
    const vals = allQ.map(q => s.reponses?.[q.id]).filter(v => v != null);
    const avg  = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
    const dateStr = new Date(s.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'});
    return `<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:.75rem .9rem;margin-bottom:.5rem;display:flex;align-items:center;gap:.75rem">
      <div style="width:42px;height:42px;border-radius:50%;background:${_satColor(avg)}15;border:2px solid ${_satColor(avg)}44;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <span style="font-size:1rem;font-weight:800;color:${_satColor(avg)}">${avg!==null?avg.toFixed(1):'-'}</span>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.83rem;font-weight:600;color:var(--text)">${escHtml(s.repondant||'Anonyme')}</div>
        <div style="font-size:.74rem;color:var(--muted)">${dateStr}${(() => {
          let sub = '';
          if (s.residentId) {
            const r = sbResidents().find(x => x.id === s.residentId);
            if (r) sub += ' · ' + escHtml(((r.nom||'')+' '+(r.prenom||'')).trim());
          } else if (s.lienResident) {
            sub += ' · ' + escHtml(s.lienResident);
          }
          return sub;
        })()}</div>
        ${s.commentaire ? `<div style="font-size:.74rem;color:var(--muted);margin-top:2px;font-style:italic">"${escHtml(s.commentaire.slice(0,80))}${s.commentaire.length>80?'…':''}"</div>` : ''}
      </div>
      <div style="display:flex;gap:.3rem;flex-shrink:0">
        <button class="btn btn-ghost btn-sm" style="font-size:.72rem" onclick="openSatModal('${s.id}')">Modifier</button>
        <button class="btn btn-ghost btn-sm" style="font-size:.72rem;color:#dc2626" onclick="deleteSat('${s.id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

// ─── Vue questions (admin) ────────────────────────────────────────────────────
function renderSatQuestions() {
  const container = document.getElementById('satContent');
  if (!container) return;

  const custom = getCustomQuestions();
  const allCats = [...new Set(SAT_QUESTIONS.map(q => q.cat)), 'Autre'];

  container.innerHTML = `
    <!-- Formulaire d'ajout -->
    <div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1.25rem">
      <div style="font-size:.82rem;font-weight:700;color:var(--text);margin-bottom:.75rem">➕ Ajouter une question</div>
      <div style="display:grid;grid-template-columns:1fr auto;gap:.6rem;margin-bottom:.6rem">
        <input type="text" id="satNewQLabel" placeholder="Libellé de la question…" style="font-size:.84rem"/>
        <button class="btn btn-primary btn-sm" onclick="addCustomQuestion()">Ajouter</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">
        <div>
          <label style="font-size:.72rem;color:var(--muted);display:block;margin-bottom:.2rem">Catégorie existante</label>
          <select id="satNewQCatSelect" style="font-size:.82rem;width:100%" onchange="document.getElementById('satNewQCatCustom').style.display=this.value==='__new'?'':'none'">
            ${allCats.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('')}
            <option value="__new">+ Nouvelle catégorie…</option>
          </select>
        </div>
        <div>
          <label style="font-size:.72rem;color:var(--muted);display:block;margin-bottom:.2rem">Ou nouvelle catégorie</label>
          <input type="text" id="satNewQCatCustom" placeholder="Nom de la catégorie" style="font-size:.82rem;display:none"/>
        </div>
      </div>
    </div>

    <!-- Questions par défaut -->
    <div style="margin-bottom:1rem">
      <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.5rem">
        Questions par défaut (${SAT_QUESTIONS.length}) — non modifiables
      </div>
      ${[...new Set(SAT_QUESTIONS.map(q=>q.cat))].map(cat => `
        <div style="margin-bottom:.5rem">
          <div style="font-size:.72rem;font-weight:600;color:var(--primary);padding:.2rem 0">${cat}</div>
          ${SAT_QUESTIONS.filter(q=>q.cat===cat).map(q=>`
            <div style="display:flex;align-items:center;gap:.5rem;padding:.35rem .6rem;background:var(--g50);border-radius:7px;margin-bottom:.25rem">
              <span style="font-size:.8rem;color:var(--text);flex:1">${escHtml(q.label)}</span>
              <span style="font-size:.68rem;color:var(--muted);background:var(--border);padding:1px 7px;border-radius:999px">défaut</span>
            </div>`).join('')}
        </div>`).join('')}
    </div>

    <!-- Questions personnalisées -->
    <div>
      <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.5rem">
        Questions personnalisées (${custom.length})
      </div>
      ${custom.length ? [...new Set(custom.map(q=>q.cat))].map(cat => `
        <div style="margin-bottom:.5rem">
          <div style="font-size:.72rem;font-weight:600;color:var(--primary);padding:.2rem 0">${escHtml(cat)}</div>
          ${custom.filter(q=>q.cat===cat).map(q=>`
            <div style="display:flex;align-items:center;gap:.5rem;padding:.35rem .6rem;background:#fff;border:1px solid var(--border);border-radius:7px;margin-bottom:.25rem">
              <span style="font-size:.8rem;color:var(--text);flex:1">${escHtml(q.label)}</span>
              <button class="btn btn-ghost btn-sm" style="color:#dc2626;font-size:.72rem;padding:2px 7px" onclick="deleteCustomQuestion('${q.id}')">✕ Supprimer</button>
            </div>`).join('')}
        </div>`).join('')
      : `<div style="font-size:.8rem;color:var(--muted);font-style:italic;padding:.5rem 0">Aucune question personnalisée pour l'instant.</div>`}
    </div>`;
}

function addCustomQuestion() {
  const label = document.getElementById('satNewQLabel')?.value.trim();
  if (!label) { toast('Le libellé est requis', 'error'); return; }

  const catSelect = document.getElementById('satNewQCatSelect')?.value;
  const catCustom = document.getElementById('satNewQCatCustom')?.value.trim();
  const cat = catSelect === '__new' ? (catCustom || 'Autre') : catSelect;

  (async () => {
    try {
      const saved = await sbSaveSatQuestion({ label, cat });
      _satqCache.push(saved);
    } catch (e) { console.error('[addCustomQuestion]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
    toast('Question ajoutée ✓', 'success');
    renderSatQuestions();
  })();
}

function deleteCustomQuestion(id) {
  if (!confirm('Supprimer cette question ? Les réponses existantes ne seront plus affichées.')) return;
  (async () => {
    try { await sbDeleteSatQuestion(id); _satqCache = _satqCache.filter(q => q.id !== id); }
    catch (e) { console.error('[deleteCustomQuestion]', e); toast('Erreur suppression : ' + (e?.message || e), 'error'); return; }
    toast('Question supprimée', 'info');
    renderSatQuestions();
  })();
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openSatModal(id) {
  _satEditId = id || '';
  const list = getSat();
  const s = id ? list.find(x => x.id === id) : null;
  const allQ = getAllQuestions();

  document.getElementById('satModalTitle').textContent = s ? 'Modifier le questionnaire' : 'Nouveau questionnaire';
  document.getElementById('satModalRepondant').value = s?.repondant || '';
  document.getElementById('satModalLien').value = s?.lienResident || '';
  document.getElementById('satModalDate').value  = s?.date || new Date().toISOString().slice(0,10);
  document.getElementById('satModalCommentaire').value = s?.commentaire || '';

  // Peupler le sélecteur de résident
  const resSelect = document.getElementById('satModalResidentId');
  if (resSelect) {
    const residents = sbResidents()
      .filter(r => !r.dateSortie || r.dateSortie >= new Date().toISOString().slice(0,10))
      .sort((a,b) => (a.nom||'').localeCompare(b.nom||'', 'fr'));
    resSelect.innerHTML = '<option value="">— Non spécifié —</option>'
      + residents.map(r => `<option value="${r.id}"${s?.residentId===r.id?' selected':''}>${escHtml(((r.nom||'')+' '+(r.prenom||'')).trim())}</option>`).join('');
  }

  // Générer les questions (défaut + personnalisées)
  const body = document.getElementById('satModalQuestions');
  const cats = [...new Set(allQ.map(q => q.cat))];
  body.innerHTML = cats.map(cat => {
    const qs = allQ.filter(q => q.cat === cat);
    return `<div style="margin-bottom:.85rem">
      <div style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem">${cat}</div>
      ${qs.map(q => {
        const val = s?.reponses?.[q.id] ?? '';
        return `<div style="margin-bottom:.5rem">
          <div style="font-size:.79rem;font-weight:500;color:var(--text);margin-bottom:.25rem">${q.label}</div>
          <div style="display:flex;gap:.3rem">
            ${[0,1,2,3,4].map(v => `<label style="flex:1;cursor:pointer">
              <input type="radio" name="sat_${q.id}" value="${v}" style="display:none"${Number(val)===v?' checked':''}/>
              <div class="sat-opt" style="text-align:center;padding:.3rem .2rem;border-radius:6px;border:1px solid ${Number(val)===v?SAT_COLORS[v]:'var(--border)'};background:${Number(val)===v?SAT_COLORS[v]+'18':'#fff'};cursor:pointer;transition:all .15s" onclick="this.parentElement.querySelector('input').checked=true;document.querySelectorAll('[name=sat_${q.id}] + div').forEach(el=>{el.style.borderColor='var(--border)';el.style.background='#fff'});this.style.borderColor='${SAT_COLORS[v]}';this.style.background='${SAT_COLORS[v]}18'">
                <div style="font-size:.68rem;color:var(--muted);line-height:1.2">${SAT_LABELS[v].split(' ')[0]}</div>
                ${'⭐'.repeat(v+1)}
              </div>
            </label>`).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');

  openModal('modalSat');
}

async function saveSatisfaction() {
  const repondant = document.getElementById('satModalRepondant').value.trim();
  const date = document.getElementById('satModalDate').value;
  if (!date) { toast('La date est obligatoire', 'error'); return; }

  const reponses = {};
  getAllQuestions().forEach(q => {
    const checked = document.querySelector(`[name="sat_${q.id}"]:checked`);
    if (checked) reponses[q.id] = Number(checked.value);
  });

  const residentId = document.getElementById('satModalResidentId')?.value || '';
  const data = {
    repondant: repondant || 'Anonyme',
    lienResident: document.getElementById('satModalLien').value.trim(),
    residentId,
    date,
    commentaire: document.getElementById('satModalCommentaire').value.trim(),
    reponses
  };

  let eigWarn = false;
  try {
    if (_satEditId) {
      const old = _satCache.find(x => x.id === _satEditId) || {};
      const saved = await sbSaveSatisfaction({ ...old, ...data, id: _satEditId });
      _satCache = _satCache.map(x => x.id === _satEditId ? saved : x);
      toast('Questionnaire modifié');
    } else {
      const saved = await sbSaveSatisfaction(data);
      _satCache.unshift(saved);
      toast('Questionnaire enregistré', 'success');
      const vals = Object.values(reponses).filter(v => v != null);
      if (vals.length && vals.reduce((a,b)=>a+b,0)/vals.length < 1.5) eigWarn = true;
    }
  } catch (e) { console.error('[saveSatisfaction]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
  closeModal('modalSat');
  renderSat();
  if (eigWarn) {
    const avg = Object.values(reponses).filter(v=>v!=null);
    setTimeout(() => {
      if (confirm('⚠️ Score de satisfaction très faible (' + Math.round(avg.reduce((a,b)=>a+b,0)/avg.length*25) + '%).\n\nVoulez-vous créer un signalement / EIG ?')) {
        location.href = 'eig.html';
      }
    }, 350);
  }
}

function deleteSat(id) {
  if (!confirm('Supprimer ce questionnaire ?')) return;
  (async () => {
    try { await sbDeleteSatisfaction(id); _satCache = _satCache.filter(x => x.id !== id); }
    catch (e) { console.error('[deleteSat]', e); toast('Erreur suppression : ' + (e?.message || e), 'error'); return; }
    renderSat();
    toast('Supprimé');
  })();
}

document.addEventListener('DOMContentLoaded', initSatisfaction);
