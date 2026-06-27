// ── Rendu partagé d'une carte de demande de congés (page RH + portail) ──
const CONGE_TYPE_META = {
  cp:            { label: 'Congés payés',  color: '#0891b2' },
  rtt:           { label: 'RTT',           color: '#6366f1' },
  maladie:       { label: 'Arrêt maladie', color: '#d97706' },
  enfant_malade: { label: 'Enfant malade', color: '#ec4899' },
  formation:     { label: 'Formation',     color: '#8b5cf6' },
  autre:         { label: 'Autre',         color: '#64748b' }
};
const CONGE_STAMP = {
  en_attente: { cls: 'attente', label: 'En attente' },
  accepte:    { cls: 'ok',      label: 'Accepté' },
  refuse:     { cls: 'ko',      label: 'Refusé' }
};
const _CG_MOIS = ['JANV', 'FÉVR', 'MARS', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'];

function congeJours(d) { return Math.ceil((new Date(d.fin) - new Date(d.debut)) / 86400000) + 1; }

function congeCalBlock(dateStr) {
  if (!dateStr) return '<div class="cgx-cal"></div>';
  const day = dateStr.slice(8, 10);
  const mois = _CG_MOIS[parseInt(dateStr.slice(5, 7), 10) - 1] || '';
  const annee = dateStr.slice(0, 4);
  return `<div class="cgx-cal"><div class="cgx-cal-m">${mois}</div><div class="cgx-cal-d">${day}</div><div class="cgx-cal-y">${annee}</div></div>`;
}

// mode : 'rh' (nom du salarié + actions admin) | 'portal' (vue salarié, annulation)
function congeCardHtml(d, mode, isAdmin) {
  const meta = CONGE_TYPE_META[d.type] || CONGE_TYPE_META.autre;
  const stamp = CONGE_STAMP[d.statut] || CONGE_STAMP.en_attente;
  const jours = congeJours(d);
  const refuse = d.statut === 'refuse';

  const titre = mode === 'rh' ? escHtml(d.employeNom || 'Salarié') : meta.label;
  const sousTitre = mode === 'rh' ? meta.label : '';

  let actions = '';
  if (mode === 'rh') {
    const parts = [];
    if (isAdmin && d.statut === 'en_attente') {
      parts.push(`<button class="cgx-btn ok" onclick="repondreConge('${d.id}','accepte')">✅ Accepter</button>`);
      parts.push(`<button class="cgx-btn ko" onclick="repondreConge('${d.id}','refuse')">❌ Refuser</button>`);
    }
    if (isAdmin) parts.push(`<button class="cgx-btn del" onclick="supprimerConge('${d.id}')" title="Supprimer">🗑</button>`);
    if (parts.length) actions = `<div class="cgx-actions">${parts.join('')}</div>`;
  } else if (d.statut === 'en_attente') {
    actions = `<div class="cgx-actions"><button class="cgx-btn ko del" onclick="cancelMesConge('${d.id}')">✕ Annuler la demande</button></div>`;
  }

  const meta2 = [];
  if (d.dateDemande) meta2.push(`Demandé le ${new Date(d.dateDemande).toLocaleDateString('fr-FR')}`);
  if (d.traitePar) meta2.push(`traité par ${escHtml(d.traitePar)}`);

  return `<article class="cgx-card ${refuse ? 'refuse' : ''}" style="--type:${meta.color}">
    ${congeCalBlock(d.debut)}
    <div class="cgx-body">
      <div class="cgx-top">
        <div style="min-width:0">
          <div class="cgx-name">${titre}</div>
          ${sousTitre ? `<div class="cgx-type">${sousTitre}</div>` : ''}
        </div>
        <span class="cgx-stamp ${stamp.cls}">${stamp.label}</span>
      </div>
      <div class="cgx-range">${formatDate(d.debut)} → ${formatDate(d.fin)} · <b>${jours} jour${jours > 1 ? 's' : ''}</b></div>
      ${d.motif ? `<div class="cgx-motif">${escHtml(d.motif)}</div>` : ''}
      ${refuse && d.reponseMotif ? `<div class="cgx-refus">Motif du refus : ${escHtml(d.reponseMotif)}</div>` : ''}
      ${meta2.length ? `<div class="cgx-meta">${meta2.join(' · ')}</div>` : ''}
      ${actions}
    </div>
  </article>`;
}
