/* ============================================================
   leila.js — Comportements transverses (méga-menu, mode sombre,
   bouton flottant contact, etc.)
   ============================================================ */
(function(){
  'use strict';

  /* ── Méga-menu : ouverture / fermeture des dropdowns ── */
  const dropdowns = document.querySelectorAll('.nav-dropdown');
  dropdowns.forEach(dd => {
    const btn = dd.querySelector('.nav-dropdown-btn');
    if (!btn) return;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = dd.classList.contains('open');
      dropdowns.forEach(d => d.classList.remove('open'));
      if (!wasOpen) dd.classList.add('open');
      btn.setAttribute('aria-expanded', !wasOpen ? 'true' : 'false');
    });
  });
  document.addEventListener('click', () => {
    dropdowns.forEach(d => {
      d.classList.remove('open');
      const b = d.querySelector('.nav-dropdown-btn');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') dropdowns.forEach(d => d.classList.remove('open'));
  });

  /* ── Mode sombre / clair (persistant) ──────────────── */
  const themeKey = 'leila-theme';
  const savedTheme = localStorage.getItem(themeKey);
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  document.querySelectorAll('[data-tweak-key="theme"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.getAttribute('data-tweak-val');
      if (v === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem(themeKey, 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.removeItem(themeKey);
      }
    });
  });

  /* ── Bouton flottant contact (sur toutes les pages sauf admin & contact) ── */
  if (!document.body.classList.contains('admin-body')
      && !location.pathname.endsWith('contact.html')
      && !document.querySelector('.floating-contact')) {
    const fab = document.createElement('a');
    fab.href = 'contact.html';
    fab.className = 'floating-contact';
    fab.setAttribute('aria-label', 'Nous contacter');
    fab.title = 'Nous contacter';
    fab.textContent = '✉';
    document.body.appendChild(fab);
  }
})();
