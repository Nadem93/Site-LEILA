/* ============================================================
   Association LEILA — Personnalisation des sections
   Lit FoyerDB.getSectionStyles() et applique :
     - backgroundColor       (couleur unie)
     - backgroundImage (URL) (image de fond)
     - overlay (0..1)        (voile sombre pour lisibilité du texte)
   aux sections de la page courante, matchant par id.
   ============================================================ */

(function () {
  'use strict';

  if (typeof FoyerDB === 'undefined' || typeof FoyerDB.getSectionStyles !== 'function') return;

  function currentPageName() {
    const path = location.pathname.split('/').pop();
    return path && path.length ? path : 'index.html';
  }

  function applyOne(el, val) {
    if (!val) return;
    const hasImg = !!val.backgroundImage;
    const overlay = typeof val.overlay === 'number' ? val.overlay : 0;

    if (hasImg) {
      const base = `url('${val.backgroundImage.replace(/'/g, "%27")}') center / cover no-repeat`;
      if (overlay > 0) {
        const a = Math.min(0.9, Math.max(0, overlay));
        el.style.background = `linear-gradient(rgba(0,0,0,${a}), rgba(0,0,0,${a})), ${base}`;
      } else {
        el.style.background = base;
      }
      // Pour les sections avec image, on force la couleur de fond éventuelle
      if (val.backgroundColor) {
        el.style.backgroundColor = val.backgroundColor;
      }
    } else if (val.backgroundColor) {
      el.style.background = '';
      el.style.backgroundColor = val.backgroundColor;
    }
    el.setAttribute('data-section-styled', '1');
  }

  function applyStyles() {
    const styles = FoyerDB.getSectionStyles() || {};
    const page = currentPageName();
    // Reset des sections précédemment stylées
    document.querySelectorAll('section[data-section-styled="1"]').forEach(s => {
      s.style.background = '';
      s.style.backgroundColor = '';
      s.removeAttribute('data-section-styled');
    });
    Object.entries(styles).forEach(([key, val]) => {
      const idx = key.indexOf(':');
      if (idx < 0) return;
      const pageKey = key.slice(0, idx);
      const sectionId = key.slice(idx + 1);
      if (pageKey !== page) return;
      const el = document.getElementById(sectionId);
      if (el) applyOne(el, val);
    });
  }

  applyStyles();

  // Mise à jour temps réel
  window.addEventListener('storage', e => {
    if (e.key === FoyerDB.KEYS.sectionStyles) applyStyles();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) applyStyles(); });
  window.addEventListener('focus', applyStyles);
})();
