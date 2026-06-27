// ── FINANCE — synchronisé avec Budget, Paie, Contrats ──
function finEnveloppes()  { return DB.get(DB.keys.budgetEnveloppes) || []; }
function finDemandes()    { return DB.get(DB.keys.budgetDemandes) || []; }
function finFichesPaie()  { return DB.get(DB.keys.fichesPaie) || []; }
function finContrats()    { return DB.get(DB.keys.contrats) || []; }
function finEmployes()    { return DB.get(DB.keys.employes) || []; }
function finFmt(n) { return (Number(n)||0).toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:0}) + ' €'; }

const FIN_MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

function finLast12Months() {
  const out = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  return out;
}

function finPopulatePeriode() {
  const sel = document.getElementById('finPeriode');
  const months = finLast12Months();
  sel.innerHTML = months.map(m => {
    const [y, mo] = m.split('-');
    return `<option value="${m}">${FIN_MOIS[Number(mo)-1]} ${y}</option>`;
  }).join('');
  sel.value = months[0];
}

// ── GRAPHIQUE COURBE (aire dégradée, lissée) ──
function finSmoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0,y0] = pts[Math.max(0,i-1)], [x1,y1] = pts[i], [x2,y2] = pts[i+1], [x3,y3] = pts[Math.min(pts.length-1,i+2)];
    const cp1x = x1 + (x2-x0)/6, cp1y = y1 + (y2-y0)/6;
    const cp2x = x2 - (x3-x1)/6, cp2y = y2 - (y3-y1)/6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`;
  }
  return d;
}

function finRenderLineChart(containerId, labels, series) {
  const W = 980, H = 220, padL = 10, padR = 10, padT = 16, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const maxVal = Math.max(1, ...series.flatMap(s => s.data));
  const stepX = innerW / Math.max(1, labels.length - 1);
  const yOf = v => padT + innerH - (v / maxVal) * innerH;
  const xOf = i => padL + i * stepX;

  const gridLines = [0,.25,.5,.75,1].map(f => {
    const y = padT + innerH * (1-f);
    return `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="var(--border)" stroke-width="1" stroke-dasharray="${f===0?'0':'3,4'}"/>`;
  }).join('');

  const labelEls = labels.map((l,i) => `<text x="${xOf(i)}" y="${H-8}" font-size="10" fill="var(--muted)" text-anchor="middle">${l}</text>`).join('');

  const seriesEls = series.map((s, si) => {
    const pts = s.data.map((v,i) => [xOf(i), yOf(v)]);
    const linePath = finSmoothPath(pts);
    const areaPath = `${linePath} L ${xOf(pts.length-1)},${padT+innerH} L ${xOf(0)},${padT+innerH} Z`;
    const gid = `finGrad${si}_${containerId}`;
    const dots = pts.map((p,i) => `<circle class="fin-dot" cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${s.color}" stroke="#fff" stroke-width="1.5"><title>${labels[i]} — ${s.name} : ${finFmt(s.data[i])}</title></circle>`).join('');
    return `
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${s.color}" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="${s.color}" stop-opacity="0.02"/>
      </linearGradient></defs>
      <path d="${areaPath}" fill="url(#${gid})" stroke="none"/>
      <path class="fin-line-path" d="${linePath}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1200" stroke-dashoffset="0"/>
      ${dots}`;
  }).join('');

  document.getElementById(containerId).innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:560px;height:${H}px">${gridLines}${seriesEls}${labelEls}</svg>`;
}

// ── GRAPHIQUE BARRES GROUPÉES ──
function finRenderBarChart(containerId, labels, series, H) {
  H = H || 220;
  const W = 980, padL = 10, padR = 10, padT = 16, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const maxVal = Math.max(1, ...series.flatMap(s => s.data));
  const groupW = innerW / Math.max(1, labels.length);
  const barGap = 4, barW = Math.max(6, (groupW - barGap * (series.length+1)) / series.length);

  const gridLines = [0,.25,.5,.75,1].map(f => {
    const y = padT + innerH * (1-f);
    return `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="var(--border)" stroke-width="1" stroke-dasharray="${f===0?'0':'3,4'}"/>`;
  }).join('');

  const bars = labels.map((l, gi) => {
    const groupX = padL + gi * groupW;
    const barsHtml = series.map((s, si) => {
      const v = s.data[gi] || 0;
      const h = (v / maxVal) * innerH;
      const x = groupX + barGap + si * (barW + barGap);
      const y = padT + innerH - h;
      return `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(h,1)}" rx="3" fill="${s.color}"><title>${l} — ${s.name} : ${finFmt(v)}</title></rect>`;
    }).join('');
    const labelEl = `<text x="${groupX + groupW/2}" y="${H-8}" font-size="10" fill="var(--muted)" text-anchor="middle">${l}</text>`;
    return barsHtml + labelEl;
  }).join('');

  document.getElementById(containerId).innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:560px;height:${H}px">${gridLines}${bars}</svg>`;
}

function renderFinance() {
  const periode = document.getElementById('finPeriode').value || today().slice(0,7);
  const enveloppes = finEnveloppes();
  const demandes = finDemandes();
  const fichesPaie = finFichesPaie();
  const contrats = finContrats();
  const employes = finEmployes();

  const demandesAcceptees = demandes.filter(d => d.statut === 'accepte' || d.statut === 'justifie');
  const depensesPeriode = demandesAcceptees.filter(d => (d.dateDepense||'').slice(0,7) === periode)
    .reduce((s,d) => s + (Number(d.montant)||0), 0);
  const depensesTotal = demandesAcceptees.reduce((s,d) => s + (Number(d.montant)||0), 0);
  const budgetTotal = enveloppes.reduce((s,e) => s + (Number(e.montant)||0), 0);
  const solde = budgetTotal - depensesTotal;

  const paiePeriode = fichesPaie.filter(f => f.periode === periode);
  const masseSalariale = paiePeriode.reduce((s,f) => s + (Number(f.net)||0), 0);

  // ── Stats ──
  const residentsActifs = sbResidents().filter(r => r.statut !== 'sorti');
  const coutParResident = residentsActifs.length ? budgetTotal / residentsActifs.length : 0;

  document.getElementById('finStats').innerHTML = `
    <div class="chx-stat" style="--c:#16a34a"><div class="chx-stat-top"><span class="chx-stat-lbl">Budget alloué (total)</span></div><div class="chx-stat-num">${finFmt(budgetTotal)}</div></div>
    <div class="chx-stat" style="--c:#dc2626"><div class="chx-stat-top"><span class="chx-stat-lbl">Dépenses validées (période)</span></div><div class="chx-stat-num">${finFmt(depensesPeriode)}</div></div>
    <div class="chx-stat" style="--c:#7c3aed"><div class="chx-stat-top"><span class="chx-stat-lbl">Masse salariale (période)</span></div><div class="chx-stat-num">${finFmt(masseSalariale)}</div></div>
    <div class="chx-stat" style="--c:${solde<0?'#dc2626':'#0d9488'}"><div class="chx-stat-top"><span class="chx-stat-lbl">Solde budget disponible</span></div><div class="chx-stat-num">${finFmt(solde)}</div></div>
    <div class="chx-stat" style="--c:#e85d04"><div class="chx-stat-top"><span class="chx-stat-lbl">Coût moyen / résident</span></div><div class="chx-stat-num">${finFmt(coutParResident)}</div></div>`;

  // ── Demandes en attente de validation ──
  const enAttente = demandes.filter(d => d.statut === 'en_attente');
  const pendingCard = document.getElementById('finPendingCard');
  if (enAttente.length) {
    pendingCard.style.display = '';
    const totalAttente = enAttente.reduce((s,d) => s + (Number(d.montant)||0), 0);
    document.getElementById('finPendingBody').innerHTML = `
      <div style="display:flex;gap:1.5rem;margin-bottom:.75rem">
        <div><div style="font-size:.66rem;color:var(--muted);font-weight:700;text-transform:uppercase">En attente</div><div style="font-size:1.3rem;font-weight:800;color:#b45309">${enAttente.length}</div></div>
        <div><div style="font-size:.66rem;color:var(--muted);font-weight:700;text-transform:uppercase">Montant cumulé</div><div style="font-size:1.3rem;font-weight:800;color:#b45309">${finFmt(totalAttente)}</div></div>
      </div>
      ${enAttente.slice(0,6).map(d => `<div class="fin-top-row">
        <span style="flex:1">${escHtml(d.motif||'—')} <span style="color:var(--muted)">— ${escHtml(d.employeNom||'')}</span></span>
        <span style="font-weight:700;color:#b45309">${finFmt(d.montant)}</span>
      </div>`).join('')}`;
  } else {
    pendingCard.style.display = 'none';
  }

  // ── Taux de consommation du budget (vs avancement de l'année) ──
  const yearStr = String(new Date().getFullYear());
  const depensesAnnee = demandesAcceptees.filter(d => (d.dateDepense||'').startsWith(yearStr)).reduce((s,d) => s + (Number(d.montant)||0), 0);
  const pctBudget = budgetTotal > 0 ? Math.min(100, Math.round(depensesAnnee / budgetTotal * 100)) : 0;
  const now = new Date();
  const pctAnnee = Math.round((now - new Date(now.getFullYear(),0,1)) / (new Date(now.getFullYear()+1,0,1) - new Date(now.getFullYear(),0,1)) * 100);
  const ecartConso = pctBudget - pctAnnee;
  document.getElementById('finGauge').innerHTML = `
    <div class="fin-gauge-wrap">
      <svg width="120" height="120" viewBox="0 0 120 120" style="flex-shrink:0">
        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--g100)" stroke-width="12"/>
        <circle cx="60" cy="60" r="50" fill="none" stroke="${ecartConso>10?'#dc2626':ecartConso>0?'#d97706':'#16a34a'}" stroke-width="12" stroke-linecap="round"
          stroke-dasharray="${2*Math.PI*50}" stroke-dashoffset="${2*Math.PI*50*(1-pctBudget/100)}" transform="rotate(-90 60 60)"/>
        <text x="60" y="56" text-anchor="middle" font-size="22" font-weight="800" fill="var(--text)">${pctBudget}%</text>
        <text x="60" y="74" text-anchor="middle" font-size="9" fill="var(--muted)">consommé</text>
      </svg>
      <div style="flex:1">
        <p style="font-size:.82rem;margin-bottom:.5rem">Budget ${yearStr} consommé à <strong>${pctBudget}%</strong>, pour une année écoulée à <strong>${pctAnnee}%</strong>.</p>
        <div class="fin-badge" style="background:${ecartConso>10?'#fee2e2':ecartConso>0?'#fef9c3':'#dcfce7'};color:${ecartConso>10?'#dc2626':ecartConso>0?'#b45309':'#16a34a'}">
          ${ecartConso>10?'⚠️ Rythme de dépense trop rapide':ecartConso>0?'À surveiller':'✓ Rythme maîtrisé'} (${ecartConso>0?'+':''}${ecartConso} pts)
        </div>
      </div>
    </div>`;

  // ── Comparaison année sur année ──
  const lastYearStr = String(new Date().getFullYear()-1);
  const depensesAnPrec = demandesAcceptees.filter(d => (d.dateDepense||'').startsWith(lastYearStr)).reduce((s,d) => s + (Number(d.montant)||0), 0);
  const salaireAnnee = fichesPaie.filter(f => (f.periode||'').startsWith(yearStr)).reduce((s,f) => s + (Number(f.net)||0), 0);
  const salaireAnPrec = fichesPaie.filter(f => (f.periode||'').startsWith(lastYearStr)).reduce((s,f) => s + (Number(f.net)||0), 0);
  const pctChange = (cur, prev) => prev > 0 ? Math.round((cur-prev)/prev*100) : (cur>0?100:0);
  const yoyRow = (label, cur, prev) => {
    const pct = pctChange(cur, prev);
    return `<div class="fin-yoy-row">
      <div><div style="font-size:.78rem;font-weight:600">${label}</div><div style="font-size:.7rem;color:var(--muted)">${lastYearStr} : ${finFmt(prev)}</div></div>
      <div style="text-align:right"><div style="font-size:1rem;font-weight:800">${finFmt(cur)}</div><div style="font-size:.72rem;font-weight:700;color:${pct>=0?'#dc2626':'#16a34a'}">${pct>=0?'▲':'▼'} ${Math.abs(pct)}%</div></div>
    </div>`;
  };
  document.getElementById('finYoy').innerHTML = `<div class="fin-yoy">
    ${yoyRow('Dépenses validées · '+yearStr, depensesAnnee, depensesAnPrec)}
    ${yoyRow('Masse salariale · '+yearStr, salaireAnnee, salaireAnPrec)}
  </div>`;

  // ── Top dépenses ──
  const topDep = [...demandesAcceptees].sort((a,b) => (Number(b.montant)||0)-(Number(a.montant)||0)).slice(0,5);
  document.getElementById('finTopDepenses').innerHTML = topDep.length ? topDep.map((d,i) => `<div class="fin-top-row">
      <span class="fin-top-rank">${i+1}</span>
      <span style="flex:1;min-width:0">
        <div style="font-size:.82rem;font-weight:600">${escHtml(d.motif||'—')}</div>
        <div style="font-size:.7rem;color:var(--muted)">${escHtml(d.employeNom||'')} · ${formatDate(d.dateDepense)}</div>
      </span>
      <span style="font-weight:800;color:#dc2626">${finFmt(d.montant)}</span>
    </div>`).join('') : `<div class="empty" style="padding:1.5rem;text-align:center"><p>Aucune dépense validée.</p></div>`;

  // ── Top dépensiers ──
  const parEmploye = {};
  demandesAcceptees.forEach(d => { const k = d.employeNom||'—'; parEmploye[k] = (parEmploye[k]||0) + (Number(d.montant)||0); });
  const topEmp = Object.entries(parEmploye).sort((a,b) => b[1]-a[1]).slice(0,5);
  const maxEmp = Math.max(1, ...topEmp.map(([,v]) => v));
  document.getElementById('finTopEmployes').innerHTML = topEmp.length ? topEmp.map(([nom,montant],i) => `<div class="fin-top-row">
      <span class="fin-top-rank">${i+1}</span>
      <span style="flex:1;min-width:0">
        <div style="font-size:.82rem;font-weight:600">${escHtml(nom)}</div>
        <div class="fin-env-bar" style="margin-top:.3rem"><div class="fin-env-fill" style="width:${Math.round(montant/maxEmp*100)}%;background:#6366f1"></div></div>
      </span>
      <span style="font-weight:800">${finFmt(montant)}</span>
    </div>`).join('') : `<div class="empty" style="padding:1.5rem;text-align:center"><p>Aucune donnée.</p></div>`;

  // ── Courbe de tendance 12 mois (dépenses vs masse salariale) ──
  const months12 = finLast12Months().reverse();
  const trendLabels = months12.map(m => { const [y,mo] = m.split('-'); return FIN_MOIS[Number(mo)-1]; });
  const trendDep = months12.map(m => demandesAcceptees.filter(d => (d.dateDepense||'').slice(0,7) === m).reduce((s,d) => s + (Number(d.montant)||0), 0));
  const trendSal = months12.map(m => fichesPaie.filter(f => f.periode === m).reduce((s,f) => s + (Number(f.net)||0), 0));
  finRenderLineChart('finTrendChart', trendLabels, [
    { name: 'Dépenses validées', color: '#16a34a', data: trendDep },
    { name: 'Masse salariale', color: '#6366f1', data: trendSal }
  ]);

  // ── Barres groupées : budget alloué vs dépensé par enveloppe ──
  const envLabels = enveloppes.map(e => e.nom.length > 10 ? e.nom.slice(0,9)+'…' : e.nom);
  const envBudget = enveloppes.map(e => Number(e.montant) || 0);
  const envSpent = enveloppes.map(e => demandesAcceptees.filter(d => d.enveloppeId === e.id).reduce((s,d) => s + (Number(d.montant)||0), 0));
  if (enveloppes.length) {
    finRenderBarChart('finBarChart', envLabels, [
      { name: 'Budget alloué', color: '#0891b2', data: envBudget },
      { name: 'Dépensé', color: '#dc2626', data: envSpent }
    ]);
  } else {
    document.getElementById('finBarChart').innerHTML = `<div class="empty" style="padding:1.5rem;text-align:center"><p>Aucune enveloppe budgétaire définie.</p></div>`;
  }

  // ── Répartition par enveloppe ──
  const envEl = document.getElementById('finEnveloppes');
  if (!enveloppes.length) {
    envEl.innerHTML = `<div class="empty" style="padding:1.5rem;text-align:center"><p>Aucune enveloppe budgétaire définie.</p></div>`;
  } else {
    envEl.innerHTML = enveloppes.map(env => {
      const spent = demandesAcceptees.filter(d => d.enveloppeId === env.id).reduce((s,d) => s + (Number(d.montant)||0), 0);
      const pct = env.montant > 0 ? Math.min(100, Math.round(spent / env.montant * 100)) : 0;
      const over = spent > env.montant;
      return `<div class="fin-env-row">
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:.25rem">
            <span style="font-weight:600">${escHtml(env.nom)}</span>
            <span style="color:${over?'#dc2626':'var(--muted)'}">${finFmt(spent)} / ${finFmt(env.montant)}</span>
          </div>
          <div class="fin-env-bar"><div class="fin-env-fill" style="width:${pct}%;background:${over?'#dc2626':pct>80?'#d97706':'#16a34a'}"></div></div>
        </div>
      </div>`;
    }).join('');
  }

  // ── Masse salariale détail ──
  const msEl = document.getElementById('finMasseSalariale');
  if (!paiePeriode.length) {
    msEl.innerHTML = `<div class="empty" style="padding:1.5rem;text-align:center"><p>Aucune fiche de paie pour cette période.</p></div>`;
  } else {
    const moyenne = masseSalariale / paiePeriode.length;
    msEl.innerHTML = `
      <div style="display:flex;gap:1.5rem;margin-bottom:.85rem">
        <div><div style="font-size:.66rem;color:var(--muted);font-weight:700;text-transform:uppercase">Total net</div><div style="font-size:1.3rem;font-weight:800;color:#6366f1">${finFmt(masseSalariale)}</div></div>
        <div><div style="font-size:.66rem;color:var(--muted);font-weight:700;text-transform:uppercase">Bulletins</div><div style="font-size:1.3rem;font-weight:800">${paiePeriode.length}</div></div>
        <div><div style="font-size:.66rem;color:var(--muted);font-weight:700;text-transform:uppercase">Moyenne</div><div style="font-size:1.3rem;font-weight:800">${finFmt(moyenne)}</div></div>
      </div>
      ${paiePeriode.slice(0,5).map(f => `<div style="display:flex;justify-content:space-between;padding:.35rem 0;border-top:1px solid var(--border);font-size:.8rem">
        <span>${escHtml(f.employeNom||'—')}</span><span style="font-weight:600">${finFmt(f.net)}</span>
      </div>`).join('')}`;
  }

  // ── Contrats & effectif ──
  const ctEl = document.getElementById('finContrats');
  const contratsActifs = contrats.filter(c => (c.statut||'actif') === 'actif');
  const parType = {};
  contratsActifs.forEach(c => { parType[c.type] = (parType[c.type]||0) + 1; });
  const typeLabels = { cdi:'CDI', cdd:'CDD', vacation:'Vacation', stage:'Stage', alternance:'Alternance' };
  const typeColors = { cdi:'#16a34a', cdd:'#d97706', vacation:'#6366f1', stage:'#0891b2', alternance:'#8b5cf6' };
  ctEl.innerHTML = `
    <div style="display:flex;gap:1.5rem;margin-bottom:.85rem">
      <div><div style="font-size:.66rem;color:var(--muted);font-weight:700;text-transform:uppercase">Effectif</div><div style="font-size:1.3rem;font-weight:800">${employes.length}</div></div>
      <div><div style="font-size:.66rem;color:var(--muted);font-weight:700;text-transform:uppercase">Contrats actifs</div><div style="font-size:1.3rem;font-weight:800;color:#16a34a">${contratsActifs.length}</div></div>
    </div>
    ${Object.entries(parType).map(([type,count]) => `<div style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0">
      <span style="width:8px;height:8px;border-radius:50%;background:${typeColors[type]||'#94a3b8'}"></span>
      <span style="flex:1;font-size:.8rem">${typeLabels[type]||type}</span>
      <span style="font-weight:700;font-size:.8rem">${count}</span>
    </div>`).join('') || '<p style="font-size:.8rem;color:var(--muted)">Aucun contrat actif.</p>'}`;

  // ── Tableau des opérations ──
  const ops = [];
  demandes.forEach(d => ops.push({ date: d.dateDepense, type: 'Dépense', label: `${d.motif||'—'} (${escHtml(d.employeNom||'')})`, montant: -Number(d.montant||0), statut: d.statut }));
  fichesPaie.forEach(f => ops.push({ date: f.dateAjout ? f.dateAjout.slice(0,10) : '', type: 'Paie', label: `Fiche de paie — ${escHtml(f.employeNom||'')} (${f.periode||''})`, montant: -Number(f.net||0), statut: 'accepte' }));
  ops.sort((a,b) => (b.date||'').localeCompare(a.date||''));

  const statutStyle = { accepte: {bg:'#dbeafe',c:'#0891b2',l:'Justif. attendu'}, justifie: {bg:'#dcfce7',c:'#16a34a',l:'Justifié'}, en_attente: {bg:'#fef9c3',c:'#b45309',l:'En attente'}, refuse: {bg:'#fee2e2',c:'#dc2626',l:'Refusé'} };
  document.getElementById('finOpsBody').innerHTML = ops.slice(0,20).map(o => {
    const st = statutStyle[o.statut] || statutStyle.accepte;
    return `<tr>
      <td>${o.date ? formatDate(o.date) : '—'}</td>
      <td><span class="fin-badge" style="background:${o.type==='Paie'?'#ede9fe':'#fee2e2'};color:${o.type==='Paie'?'#6366f1':'#dc2626'}">${o.type}</span></td>
      <td>${o.label}</td>
      <td style="text-align:right;font-weight:700;color:${o.montant<0?'#dc2626':'#16a34a'}">${o.montant<0?'−':'+'}${finFmt(Math.abs(o.montant))}</td>
      <td><span class="fin-badge" style="background:${st.bg};color:${st.c}">${st.l}</span></td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--muted)">Aucune opération enregistrée.</td></tr>`;

  window._finOps = ops;
}

function finExportCsv() {
  const ops = window._finOps || [];
  const rows = [['Date','Type','Libellé','Montant','Statut']];
  ops.forEach(o => rows.push([o.date||'', o.type, o.label.replace(/<[^>]+>/g,''), o.montant, o.statut]));
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `finance_${document.getElementById('finPeriode').value}.csv`;
  a.click();
}

async function initFinance() {
  const s = Auth.requireAuth();
  if (!s) return;
  if (!Auth.isAdmin()) {
    document.querySelector('.content').innerHTML = `<div class="empty" style="padding:3rem;text-align:center"><h3>Accès réservé</h3><p>Ce module est réservé aux administrateurs.</p><a href="accueil.html" class="btn btn-accent">← Accueil</a></div>`;
    return;
  }
  await sbLoadResidentsCache();
  finPopulatePeriode();
  document.getElementById('finPeriode').addEventListener('change', renderFinance);
  renderFinance();
}
document.addEventListener('DOMContentLoaded', initFinance);
