/* ============================================================
   branding.js
   Applique les paramètres de marque (couleurs, logo, polices,
   favicon) définis depuis l'admin sur toutes les pages publiques.
   Lit FoyerDB.getBranding() et injecte un <style> avec les
   variables CSS surchargées.
   ============================================================ */
(function () {
  'use strict';
  if (typeof FoyerDB === 'undefined' || typeof FoyerDB.getBranding !== 'function') return;

  const STYLE_ID = 'leila-branding-vars';
  const FAVICON_ID = 'leila-branding-favicon';

  function apply() {
    const b = FoyerDB.getBranding();
    if (!b) return;

    // ── Variables CSS ──────────────────────────────────
    const c = b.colors || {};
    const F = b.fonts || {};
    const css = `
:root {
  --svc-foyer:       ${c.foyer && c.foyer.color || '#256880'};
  --svc-foyer-dark:  ${c.foyer && c.foyer.dark  || '#1d4f64'};
  --svc-foyer-bg:    ${c.foyer && c.foyer.bg    || '#e6f2f6'};
  --svc-saj:         ${c.saj && c.saj.color || '#d4880a'};
  --svc-saj-dark:    ${c.saj && c.saj.dark  || '#b97331'};
  --svc-saj-bg:      ${c.saj && c.saj.bg    || '#fff5e8'};
  --svc-savs:        ${c.savs && c.savs.color || '#4a8a37'};
  --svc-savs-dark:   ${c.savs && c.savs.dark  || '#2f6b22'};
  --svc-savs-bg:     ${c.savs && c.savs.bg    || '#ecf3e8'};
  --svc-emp:         ${c.emp && c.emp.color || '#7c4dab'};
  --svc-emp-dark:    ${c.emp && c.emp.dark  || '#5d3787'};
  --svc-emp-bg:      ${c.emp && c.emp.bg    || '#f3ebfa'};
  --primary:         ${c.primary || '#256880'};
  --primary-dark:    ${c.foyer && c.foyer.dark || '#1d4f64'};
  --primary-faint:   ${c.foyer && c.foyer.bg || '#e6f2f6'};
  --accent:          ${c.accent || '#d9924a'};
  --font-sans:       '${(F.sans || 'Inter').replace(/'/g, '')}', sans-serif;
  --font-serif:      '${(F.serif || 'Playfair Display').replace(/'/g, '')}', serif;
}
body, .nav, button, input, select, textarea {
  font-family: '${(F.sans || 'Inter').replace(/'/g, '')}', system-ui, sans-serif;
}
h1, h2, h3, h4, .accent, .hero h1 .accent {
  font-family: '${(F.serif || 'Playfair Display').replace(/'/g, '')}', Georgia, serif;
}
.nav-cta, .btn-primary { background: var(--primary); }
.btn-primary:hover { background: var(--primary-dark); }
`;

    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = css;

    // ── Favicon ────────────────────────────────────────
    if (b.favicon) {
      let link = document.getElementById(FAVICON_ID);
      if (!link) {
        link = document.createElement('link');
        link.id = FAVICON_ID;
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = b.favicon;
    } else if (b.logo && b.logo.emoji) {
      // Génère un favicon SVG depuis l'emoji
      const emoji = b.logo.emoji;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${emoji}</text></svg>`;
      const dataUrl = 'data:image/svg+xml,' + encodeURIComponent(svg);
      let link = document.getElementById(FAVICON_ID);
      if (!link) {
        link = document.createElement('link');
        link.id = FAVICON_ID;
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = dataUrl;
    }

    // ── Logo dans les .logo-name / .logo-icon ─────────
    if (b.logo) {
      const logoIcons = document.querySelectorAll('.logo-icon');
      const logoNames = document.querySelectorAll('.logo-name');
      const logoSubs  = document.querySelectorAll('.logo-sub');

      logoIcons.forEach(el => {
        if (b.logo.imageUrl) {
          el.innerHTML = `<img src="${b.logo.imageUrl}" alt="" style="width:100%;height:100%;object-fit:contain;display:block;">`;
        } else if (b.logo.emoji) {
          el.textContent = b.logo.emoji;
        }
      });
      // Optionnel : ne pas écraser le texte du logo car certains logos ont
      // un texte spécifique par page (ex: "EMP Henri Wallon"). On n'écrase
      // que si data-logo-asso est présent (page index/contact).
      logoNames.forEach(el => {
        if (el.dataset.logoAsso === 'true' && b.logo.text) el.textContent = b.logo.text;
      });
      logoSubs.forEach(el => {
        if (el.dataset.logoAsso === 'true' && b.logo.sub) el.textContent = b.logo.sub;
      });
    }
  }

  // Première application
  apply();

  // Réapplique si modification depuis l'admin (autre onglet)
  window.addEventListener('storage', e => {
    if (e.key === FoyerDB.KEYS.branding) apply();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) apply(); });
  window.addEventListener('focus', apply);

  window.LeilaBranding = { apply };
})();
