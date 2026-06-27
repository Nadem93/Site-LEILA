// ── Masquage des montants sensibles (confidentialité paie) ──
// Le montant s'affiche en •••• ; un clic (ou Entrée) le révèle puis il se
// re-masque automatiquement après 5 s. Un clic révèle tous les montants
// de la même carte (.pyx-card) à la fois.
const MONEY_REVEAL_MS = 5000;

function moneyDots(v) { return String(v).includes('€') ? '•••• €' : '••••'; }

// value : chaîne déjà formatée (ex. "1 847,32 €"). extraClass : 'lead' ajoute l'icône 👁.
function moneyMask(value, extraClass) {
  const v = String(value);
  return `<span class="moneyx${extraClass ? ' ' + extraClass : ''}" data-money="${escHtml(v)}" tabindex="0" role="button" aria-label="Montant masqué — cliquer pour afficher" title="Cliquer pour afficher (se remasque après 5 s)">${moneyDots(v)}</span>`;
}

function _moneyReveal(el) {
  const scope = el.closest('.pyx-card') || el.parentElement || el;
  scope.querySelectorAll('.moneyx').forEach(t => {
    const real = t.getAttribute('data-money');
    if (real == null) return;
    t.textContent = real;
    t.classList.add('on');
    clearTimeout(t._moneyTimer);
    t._moneyTimer = setTimeout(() => { t.textContent = moneyDots(real); t.classList.remove('on'); }, MONEY_REVEAL_MS);
  });
}

document.addEventListener('click', e => {
  const el = e.target.closest('.moneyx');
  if (el) { e.preventDefault(); e.stopPropagation(); _moneyReveal(el); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    const el = document.activeElement;
    if (el && el.classList && el.classList.contains('moneyx')) { e.preventDefault(); _moneyReveal(el); }
  }
});
