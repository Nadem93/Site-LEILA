// ── TABLEAU DE BORD RH UNIFIÉ ──
function rhRow(icon, title, sub, color, href) {
  return `<a href="${href}" style="display:flex;align-items:center;gap:.65rem;padding:.65rem 1rem;border-bottom:1px solid var(--border);text-decoration:none;color:inherit">
    <span style="font-size:1.1rem;flex-shrink:0">${icon}</span>
    <div style="flex:1;min-width:0">
      <div style="font-weight:600;font-size:.83rem">${title}</div>
      <div style="font-size:.74rem;color:var(--muted)">${sub}</div>
    </div>
  </a>`;
}
function rhEmpty(msg) { return `<div class="empty" style="padding:1.5rem;text-align:center"><p style="font-size:.82rem">${msg}</p></div>`; }

async function initRhDashboard() {
  const s = Auth.requireAuth();
  if (!s) return;

  let employes = [], contrats = [], absences = [], conges = [], entretiens = [], formations = [], candidats = [];
  try {
    [employes, contrats, absences, conges, entretiens, formations, candidats] = await Promise.all([
      sbGetEmployes(), sbGetContrats(), sbGetAbsences(), sbGetConges(),
      sbGetEntretiens(), sbGetFormations(), sbGetCandidats()
    ]);
  } catch (e) {
    console.error('[initRhDashboard]', e);
    toast('Erreur chargement du tableau de bord RH', 'error');
  }
  const todayStr = today();
  const in30 = (() => { const d = new Date(todayStr+'T00:00:00'); d.setDate(d.getDate()+30); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

  const contratsActifs = contrats.filter(c => (c.statut||'actif') === 'actif');
  const cddEcheance = contratsActifs.filter(c => c.type === 'cdd' && c.fin && c.fin >= todayStr && c.fin <= in30);
  const absencesEnCours = absences.filter(a => !a.fin || a.fin >= todayStr);
  const congesEnAttente = conges.filter(c => c.statut === 'en_attente');
  const entretiensAVenir = entretiens.filter(e => e.statut === 'planifie' && e.date && e.date >= todayStr && e.date <= in30);
  const formationsAVenir = formations.filter(f => f.statut === 'planifiee' && f.dateDebut >= todayStr).sort((a,b)=>a.dateDebut.localeCompare(b.dateDebut));
  const candidatsActifs = candidats.filter(c => !['accepte','refuse'].includes(c.statut));

  document.getElementById('rhStats').innerHTML = `
    <div class="chx-stat" style="--c:#2563eb"><div class="chx-stat-top"><span class="chx-stat-lbl">Effectif</span></div><div class="chx-stat-num">${employes.length}</div></div>
    <div class="chx-stat" style="--c:#ef4444"><div class="chx-stat-top"><span class="chx-stat-lbl">Absences en cours</span></div><div class="chx-stat-num">${absencesEnCours.length}</div></div>
    <div class="chx-stat" style="--c:#e85d04"><div class="chx-stat-top"><span class="chx-stat-lbl">CDD ≤30j</span></div><div class="chx-stat-num">${cddEcheance.length}</div></div>
    <div class="chx-stat" style="--c:#16a34a"><div class="chx-stat-top"><span class="chx-stat-lbl">Congés en attente</span></div><div class="chx-stat-num">${congesEnAttente.length}</div></div>`;

  // Contrats
  document.getElementById('rhContrats').innerHTML = cddEcheance.length
    ? cddEcheance.sort((a,b)=>a.fin.localeCompare(b.fin)).map(c => {
        const emp = employes.find(e => String(e.id) === String(c.employeId));
        const nom = emp ? `${emp.prenom||''} ${emp.nom||''}`.trim() : 'Inconnu';
        const j = Math.ceil((new Date(c.fin+'T00:00:00') - new Date(todayStr+'T00:00:00')) / 86400000);
        return rhRow('⚠️', escHtml(nom), `Fin de CDD le ${formatDate(c.fin)} (J-${j})`, '#dc2626', 'contrats.html');
      }).join('')
    : rhEmpty('Aucune échéance de CDD dans les 30 jours.');

  // Absences
  document.getElementById('rhAbsences').innerHTML = absencesEnCours.length
    ? absencesEnCours.map(a => {
        const emp = employes.find(e => String(e.id) === String(a.employeId));
        const nom = emp ? `${emp.prenom||''} ${emp.nom||''}`.trim() : 'Inconnu';
        const icon = a.type === 'at' ? '⚠️' : a.type === 'maladie_pro' ? '🏭' : '🤒';
        return rhRow(icon, escHtml(nom), `Depuis le ${formatDate(a.debut)}`, '#dc2626', 'absences.html');
      }).join('')
    : rhEmpty('Aucune absence en cours.');

  // Congés
  document.getElementById('rhConges').innerHTML = congesEnAttente.length
    ? congesEnAttente.sort((a,b)=>(a.debut||'').localeCompare(b.debut||'')).map(c => {
        const e = employes.find(x => String(x.id) === String(c.employeId));
        const nom = e ? `${e.prenom||''} ${e.nom||''}`.trim() : (c.employeNom||'Inconnu');
        return rhRow('🗓', escHtml(nom), `${formatDate(c.debut)} → ${formatDate(c.fin)}`, '#16a34a', 'conges.html');
      }).join('')
    : rhEmpty('Aucune demande en attente.');

  // Entretiens
  document.getElementById('rhEntretiens').innerHTML = entretiensAVenir.length
    ? entretiensAVenir.sort((a,b)=>a.date.localeCompare(b.date)).map(e =>
        rhRow('🧑‍💼', escHtml(e.employeNom||'Inconnu'), `Planifié le ${formatDate(e.date)}`, '#9333ea', 'entretiens.html')
      ).join('')
    : rhEmpty("Aucun entretien planifié dans les 30 jours.");

  // Formations
  document.getElementById('rhFormations').innerHTML = formationsAVenir.length
    ? formationsAVenir.slice(0,8).map(f =>
        rhRow('🎓', escHtml(f.titre||'Formation'), `Le ${formatDate(f.dateDebut)}`, '#7c3aed', 'formations.html')
      ).join('')
    : rhEmpty('Aucune formation planifiée.');

  // Recrutement
  document.getElementById('rhRecrutement').innerHTML = candidatsActifs.length
    ? candidatsActifs.map(c => {
        const nom = `${c.prenom||''} ${c.nom||''}`.trim();
        const lbl = { recu:'Reçu', entretien_planifie:'Entretien planifié', entretien_fait:'Entretien réalisé' }[c.statut] || c.statut;
        return rhRow('📋', escHtml(nom), `${escHtml(c.poste||'')} — ${lbl}`, '#6366f1', 'recrutement.html');
      }).join('')
    : rhEmpty('Aucun candidat en cours.');
}
document.addEventListener('DOMContentLoaded', initRhDashboard);
