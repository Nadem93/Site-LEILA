/* ============================================================
   admin-services.js
   Ajoute la gestion multi-services à l'admin :
   - mémorise le service sélectionné (sessionStorage)
   - patch les fonctions FoyerDB pour filtrer automatiquement par service
   - ajoute un service automatique aux objets sauvegardés
   - ajoute des badges de service dans les listes
   ============================================================ */
(function () {
  'use strict';
  if (typeof FoyerDB === 'undefined') { console.warn('admin-services: FoyerDB introuvable'); return; }

  const KEY = 'leila-admin-service';
  const SERVICES = ['all','foyer','saj','savs','emp','global'];

  function getCurrentService() {
    const v = sessionStorage.getItem(KEY) || 'foyer';
    return SERVICES.includes(v) ? v : 'foyer';
  }
  function setCurrentService(v) {
    if (!SERVICES.includes(v)) v = 'foyer';
    sessionStorage.setItem(KEY, v);
    document.documentElement.setAttribute('data-admin-service', v);
  }

  // Expose
  window.AdminScope = { getCurrentService, setCurrentService, SERVICES };

  /* ── Patch des fonctions de lecture pour ajouter automatiquement ── */
  const LIST_METHODS = [
    'getArticles','getTestimonials','getDocuments','getApplications',
    'getPhotos','getEvents','getTeam','getPartners','getFaq','getAlerts','getMedia','getAdmissions'
  ];
  LIST_METHODS.forEach(name => {
    if (typeof FoyerDB[name] !== 'function') return;
    const orig = FoyerDB[name];
    FoyerDB[name] = function (opts) {
      opts = Object.assign({}, opts || {});
      // Si l'appelant n'a PAS précisé de service, on injecte le service courant
      if (opts.service === undefined) {
        const svc = getCurrentService();
        if (svc && svc !== 'all') opts.service = svc;
      }
      return orig.call(FoyerDB, opts);
    };
  });

  /* ── Patch des fonctions de sauvegarde pour ajouter le service automatique ── */
  const SAVE_METHODS = [
    ['saveArticle','foyer'], ['saveTestimonial','foyer'], ['saveDocument','foyer'],
    ['saveApplication','foyer'], ['savePhoto','foyer'], ['saveEvent','foyer'],
    ['saveTeamItem','foyer'], ['savePartner','foyer'], ['saveFaqItem','foyer'],
    ['saveAlert','global'], ['saveMediaItem','foyer'], ['saveAdmission','foyer']
  ];
  SAVE_METHODS.forEach(([name, fallback]) => {
    if (typeof FoyerDB[name] !== 'function') return;
    const orig = FoyerDB[name];
    FoyerDB[name] = function (obj) {
      if (obj && !obj.service) {
        const cur = getCurrentService();
        obj.service = (cur === 'all') ? fallback : cur;
      }
      return orig.call(FoyerDB, obj);
    };
  });

  /* ── Initialisation : connecter le sélecteur ── */
  document.addEventListener('DOMContentLoaded', () => {
    const sel = document.getElementById('admin-service-select');
    if (!sel) return;
    sel.value = getCurrentService();
    setCurrentService(sel.value);
    sel.addEventListener('change', () => {
      setCurrentService(sel.value);
      // Re-render la page courante
      if (typeof window.refreshPage === 'function') {
        const active = document.querySelector('.admin-sidebar .nav-item.active');
        const page = active ? active.getAttribute('data-page') : 'dashboard';
        window.refreshPage(page);
      }
      // Toast
      if (typeof window.toast === 'function') {
        const labels = { all:'Tous services', foyer:'Foyer', saj:'SAJ', savs:'SAVS', emp:'EMP Henri Wallon', global:'Association' };
        window.toast('Service actif : ' + (labels[sel.value] || sel.value), 'success');
      }
    });
  });

  /* ── Helper public pour générer un badge de service ── */
  window.svcBadge = function (svc) {
    if (!svc) return '';
    const lbl = { foyer:'Foyer', saj:'SAJ', savs:'SAVS', emp:'EMP', global:'Asso' }[svc] || svc;
    return `<span class="svc-badge ${svc}">${lbl}</span>`;
  };
})();
