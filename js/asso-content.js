/* ============================================================
   asso-content.js
   Applique le contenu éditable de la page d'accueil
   association (index.html) défini depuis l'admin.
   Lit FoyerDB.getAssociation().pageContent et met à jour
   le DOM dynamiquement.
   ============================================================ */
(function () {
  'use strict';
  if (typeof FoyerDB === 'undefined') return;

  const escapeHtml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function setText(sel, val) {
    if (val == null) return;
    const el = document.querySelector(sel);
    if (el) el.textContent = val;
  }

  function setAttr(sel, attr, val) {
    if (val == null) return;
    const el = document.querySelector(sel);
    if (el) el.setAttribute(attr, val);
  }

  function apply() {
    const asso = FoyerDB.getAssociation();
    if (!asso) return;
    const pc = asso.pageContent || {};

    // Hero
    setText('.hero-asso .hero-tag', pc.heroTag);
    const h1 = document.querySelector('.hero-asso h1');
    if (h1 && (pc.heroTitle || pc.heroAccent || pc.heroSuffix)) {
      h1.innerHTML = `${escapeHtml(pc.heroTitle || 'Association')} <span class="accent">${escapeHtml(pc.heroAccent || 'LEILA')}</span>${escapeHtml(pc.heroSuffix || '')}`;
    }
    setText('.hero-asso .hero-lead', pc.heroLead);

    // Boutons hero
    const heroBtns = document.querySelectorAll('.hero-asso .hero-actions a');
    if (heroBtns[0] && pc.heroBtn1Label) heroBtns[0].textContent = pc.heroBtn1Label;
    if (heroBtns[0] && pc.heroBtn1Href)  heroBtns[0].setAttribute('href', pc.heroBtn1Href);
    if (heroBtns[1] && pc.heroBtn2Label) heroBtns[1].textContent = pc.heroBtn2Label;
    if (heroBtns[1] && pc.heroBtn2Href)  heroBtns[1].setAttribute('href', pc.heroBtn2Href);

    // Stats hero
    if (Array.isArray(asso.stats)) {
      document.querySelectorAll('.hero-asso .hero-stats > div').forEach((div, i) => {
        const stat = asso.stats[i];
        if (!stat) return;
        const strong = div.querySelector('strong');
        const span   = div.querySelector('span');
        if (strong && stat.value) strong.textContent = stat.value;
        if (span   && stat.label) span.textContent   = stat.label;
      });
    }

    // Section présentation asso
    setText('[aria-labelledby="asso-title"] .eyebrow', pc.assoEyebrow);
    setText('#asso-title', pc.assoTitle);
    setText('[aria-labelledby="asso-title"] .lead', pc.assoLead);

    // Section services intro
    setText('[aria-labelledby="services-title"] .eyebrow', pc.servicesEyebrow);
    setText('#services-title', pc.servicesTitle);
    setText('[aria-labelledby="services-title"] .lead', pc.servicesLead);

    // Section valeurs
    setText('[aria-labelledby="valeurs-title"] .eyebrow', pc.valeursEyebrow);
    setText('#valeurs-title', pc.valeursTitle);
    if (Array.isArray(pc.valeurs)) {
      const cards = document.querySelectorAll('[aria-labelledby="valeurs-title"] .grid-3 .card');
      cards.forEach((card, i) => {
        const v = pc.valeurs[i];
        if (!v) return;
        const ic = card.querySelector('.card-icon');
        const tt = card.querySelector('h3');
        const tx = card.querySelector('p');
        if (ic && v.icon)  ic.textContent  = v.icon;
        if (tt && v.title) tt.textContent  = v.title;
        if (tx && v.text)  tx.textContent  = v.text;
      });
    }

    // Section CTA finale
    const ctaSection = document.querySelector('.cta-section');
    if (ctaSection) {
      const t = ctaSection.querySelector('h2');
      const p = ctaSection.querySelector('p');
      const btns = ctaSection.querySelectorAll('a.btn');
      if (t && pc.ctaTitle) t.textContent = pc.ctaTitle;
      if (p && pc.ctaLead)  p.textContent = pc.ctaLead;
      if (btns[0] && pc.ctaBtn1Label) btns[0].textContent = pc.ctaBtn1Label;
      if (btns[0] && pc.ctaBtn1Href)  btns[0].setAttribute('href', pc.ctaBtn1Href);
      if (btns[1] && pc.ctaBtn2Label) btns[1].textContent = pc.ctaBtn2Label;
      if (btns[1] && pc.ctaBtn2Href)  btns[1].setAttribute('href', pc.ctaBtn2Href);
    }
  }

  apply();

  window.addEventListener('storage', e => {
    if (e.key === FoyerDB.KEYS.association) apply();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) apply(); });
  window.addEventListener('focus', apply);

  window.LeilaAssoContent = { apply };
})();
