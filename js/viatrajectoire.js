// Données de démo désactivées : la base de prod doit rester sans données fictives.
function seedVTExemples() { /* no-op */ }

async function initViaTrajectoire() {
  const _s = Auth.requireAuth();
  if (!_s) return;
  if (!Auth.isAdmin()) return;
  await sbLoadResidentsCache();
  await loadVTCache();
  renderVT();
}

// Source = Supabase. Cache mémoire chargé au démarrage.
let _vtCache = [];
function getVT() { return _vtCache; }
async function loadVTCache() { _vtCache = await sbGetViaTrajectoire(); }

const VT_STATUTS = {
  brouillon: { label: 'Brouillon', color: '#94a3b8' },
  envoye: { label: 'Envoyé à la MDPH', color: '#3b82f6' },
  en_cours: { label: 'En cours d\'instruction', color: '#d97706' },
  info_requise: { label: 'Information complémentaire requise', color: '#f97316' },
  accepte: { label: 'Accepté', color: '#16a34a' },
  refuse: { label: 'Refusé', color: '#ef4444' },
  cloture: { label: 'Clôturé', color: '#64748b' }
};

function renderVT() {
  const list = getVT();
  const residents = sbResidents();

  const enCours = list.filter(d => ['envoye','en_cours','info_requise'].includes(d.statut)).length;
  const acceptees = list.filter(d => d.statut === 'accepte').length;
  const refusees = list.filter(d => d.statut === 'refuse').length;

  document.getElementById('vtStatEnCours').textContent = enCours;
  document.getElementById('vtStatAcceptees').textContent = acceptees;
  document.getElementById('vtStatRefusees').textContent = refusees;

  const el = document.getElementById('vtList');
  if (!list.length) {
    el.innerHTML = '<div class="empty" style="padding:3rem;text-align:center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;margin:0 auto .75rem;color:var(--g300)"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg><p>Aucune demande ViaTrajectoire</p></div>';
    return;
  }

  el.innerHTML = list.sort((a,b) => (b.date||'').localeCompare(a.date||'')).map(d => {
    const st = VT_STATUTS[d.statut] || VT_STATUTS.brouillon;
    const resident = residents.find(r => r.id === d.residentId);
    const nomResident = resident ? `${resident.prenom} ${resident.nom}` : '—';
    const mdph = d.mdph === 'mape' ? 'MDPH Maison Départementale des Personnes Handicapées'
      : d.mdph === 'cdaph' ? 'CDAPH'
      : d.mdph ? escHtml(d.mdph) : '—';
    return `<div style="display:flex;align-items:flex-start;gap:.75rem;padding:.85rem 1rem;background:#fff;border-radius:10px;margin-bottom:6px;box-shadow:0 2px 6px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04)">
      <span style="font-size:1.2rem;margin-top:2px;flex-shrink:0">🔀</span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
          <span style="font-weight:600;font-size:.85rem">${escHtml(nomResident)}</span>
          <span style="padding:1px 8px;border-radius:99px;font-size:.68rem;font-weight:700;background:${st.color}18;color:${st.color}">${st.label}</span>
        </div>
        <div style="font-size:.76rem;color:var(--muted);margin-top:.2rem">
          ${d.type === 'orientation' ? 'Demande d\'orientation' : d.type === 'renouvellement' ? 'Renouvellement' : 'Réorientation'} · ${d.date ? formatDate(d.date) : 'Date inconnue'}
          · ${escHtml(mdph)}
        </div>
        ${d.commentaire ? `<div style="font-size:.73rem;color:var(--g600);margin-top:.25rem;line-height:1.4">${escHtml(d.commentaire)}</div>` : ''}
      </div>
      <div style="display:flex;gap:.25rem;flex-shrink:0">
        <button class="btn btn-ghost btn-sm" onclick="editVTDemande('${d.id}')" title="Modifier">✎</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteVTDemande('${d.id}')" title="Supprimer">✕</button>
      </div>
    </div>`;
  }).join('');
}

function openVTDemande(data) {
  try {
  const residents = sbResidents();
  const rOpts = residents.map(r => `<option value="${r.id}"${data && data.residentId === r.id ? ' selected' : ''}>${escHtml(r.prenom+' '+r.nom)}</option>`).join('');

  const statutOpts = Object.entries(VT_STATUTS).map(([k,v]) => `<option value="${k}"${data && data.statut === k ? ' selected' : ''}>${v.label}</option>`).join('');

  const html = `<div class="modal-overlay" id="modalVTDemande" style="display:flex" onclick="closeModal('modalVTDemande')">
    <div class="modal" style="max-width:520px" onclick="event.stopPropagation()">
      <div class="modal-header"><span class="modal-title">${data ? '✎ Modifier la demande' : '🔀 Nouvelle demande ViaTrajectoire'}</span><button class="modal-close" onclick="closeModal('modalVTDemande')">&times;</button></div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:.75rem">
        <div class="form-group"><label>Résident *</label><select id="vtResident" class="form-input">${rOpts}</select></div>
        <div class="form-row">
          <div class="form-group"><label>Type de demande *</label>
            <select id="vtType" class="form-input">
              <option value="orientation"${data && data.type === 'orientation' ? ' selected' : ''}>Demande d'orientation</option>
              <option value="renouvellement"${data && data.type === 'renouvellement' ? ' selected' : ''}>Renouvellement</option>
              <option value="reorientation"${data && data.type === 'reorientation' ? ' selected' : ''}>Réorientation</option>
            </select>
          </div>
          <div class="form-group"><label>MDPH *</label>
            <select id="vtMdph" class="form-input">
              <option value="mape"${!data || data.mdph === 'mape' ? ' selected' : ''}>MDPH (Maison Départementale)</option>
              <option value="cdaph"${data && data.mdph === 'cdaph' ? ' selected' : ''}>CDAPH</option>
              <option value="autre"${data && data.mdph === 'autre' ? ' selected' : ''}>Autre</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Date d'envoi</label><input type="date" id="vtDate" class="form-input" value="${data ? data.date.split('T')[0] : new Date().toISOString().slice(0,10)}"/></div>
          <div class="form-group"><label>Statut</label><select id="vtStatut" class="form-input">${statutOpts}</select></div>
        </div>
        <div class="form-group"><label>Commentaire / observations</label>
          <textarea id="vtCommentaire" class="form-input" rows="3" placeholder="Informations complémentaires…">${escHtml(data ? data.commentaire||'' : '')}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal('modalVTDemande')">Annuler</button>
        <button class="btn btn-primary" onclick="saveVTDemande('${data ? data.id : ''}')">${data ? 'Enregistrer' : 'Créer la demande'}</button>
      </div>
    </div>
  </div>`;
  const old = document.getElementById('modalVTDemande');
  if (old) old.remove();
  const div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div);
  requestAnimationFrame(() => document.getElementById('modalVTDemande')?.classList.add('open'));
  } catch(e) { console.error('openVTDemande error:', e); toast('Erreur : ' + e.message, 'error'); }
}

function editVTDemande(id) {
  const list = getVT();
  const data = list.find(d => d.id === id);
  if (data) openVTDemande(data);
}

function saveVTDemande(id) {
  const resident = document.getElementById('vtResident').value;
  const type = document.getElementById('vtType').value;
  const mdph = document.getElementById('vtMdph').value;
  const date = document.getElementById('vtDate').value;
  const statut = document.getElementById('vtStatut').value;
  const commentaire = document.getElementById('vtCommentaire').value.trim();

  if (!resident || !type || !date) {
    toast('Veuillez remplir les champs obligatoires', 'error'); return;
  }

  (async () => {
    try {
      if (id) {
        const old = _vtCache.find(d => d.id === id) || {};
        const saved = await sbSaveViaTrajectoire({ ...old, residentId: resident, type, mdph, date, statut, commentaire, id });
        _vtCache = _vtCache.map(d => d.id === id ? saved : d);
        toast('Demande mise à jour', 'success');
      } else {
        const saved = await sbSaveViaTrajectoire({ residentId: resident, type, mdph, date, statut, commentaire });
        _vtCache.push(saved);
        toast('Demande ViaTrajectoire créée', 'success');
      }
    } catch (e) { console.error('[saveVTDemande]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
    closeModal('modalVTDemande');
    renderVT();
  })();
}

function deleteVTDemande(id) {
  if (!confirm('Supprimer cette demande ViaTrajectoire ?')) return;
  (async () => {
    try { await sbDeleteViaTrajectoire(id); _vtCache = _vtCache.filter(d => d.id !== id); }
    catch (e) { console.error('[deleteVTDemande]', e); toast('Erreur suppression : ' + (e?.message || e), 'error'); return; }
    toast('Demande supprimée', 'info');
    renderVT();
  })();
}

document.addEventListener('DOMContentLoaded', initViaTrajectoire);
if (typeof registerPageInit === 'function') registerPageInit('viatrajectoire', initViaTrajectoire);
