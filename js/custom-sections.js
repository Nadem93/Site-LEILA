/* ============================================================
   custom-sections.js
   Affiche les sections personnalisées définies dans l'admin
   (pageContent.customSections) sur les pages services.
   Usage : appeler window.LeilaCustomSections.render(SVC) après
   chargement de FoyerDB. Les sections s'insèrent dans
   <div id="custom-sections-slot"></div>
   ============================================================ */
(function () {
  'use strict';
  if (typeof FoyerDB === 'undefined') return;

  const escapeHtml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function paragraphs(text) {
    if (!text) return '';
    return String(text).split(/\n\s*\n/).map(p =>
      `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`
    ).join('');
  }

  function renderTextSection(cs) {
    return `
      <section class="section cs-section cs-section-text">
        <div class="container">
          <div class="cs-content-wrap">
            ${cs.eyebrow ? `<span class="eyebrow">${escapeHtml(cs.eyebrow)}</span>` : ''}
            <h2>${escapeHtml(cs.title || '')}</h2>
            <div class="cs-paragraphs">${paragraphs(cs.content)}</div>
          </div>
        </div>
      </section>`;
  }

  function renderTextImageSection(cs) {
    const imgPos = cs.imagePosition === 'left' ? 'cs-img-left' : 'cs-img-right';
    return `
      <section class="section cs-section cs-section-text-image ${imgPos}">
        <div class="container">
          <div class="cs-flex">
            <div class="cs-flex-img">
              <img src="${escapeHtml(cs.imageUrl)}" alt="${escapeHtml(cs.imageAlt || cs.title || '')}" loading="lazy">
            </div>
            <div class="cs-flex-text">
              ${cs.eyebrow ? `<span class="eyebrow">${escapeHtml(cs.eyebrow)}</span>` : ''}
              <h2>${escapeHtml(cs.title || '')}</h2>
              <div class="cs-paragraphs">${paragraphs(cs.content)}</div>
            </div>
          </div>
        </div>
      </section>`;
  }

  function renderListSection(cs) {
    const items = Array.isArray(cs.items) ? cs.items : [];
    return `
      <section class="section cs-section cs-section-list">
        <div class="container">
          <div class="cs-content-wrap">
            ${cs.eyebrow ? `<span class="eyebrow">${escapeHtml(cs.eyebrow)}</span>` : ''}
            <h2>${escapeHtml(cs.title || '')}</h2>
            ${cs.content ? `<div class="cs-paragraphs">${paragraphs(cs.content)}</div>` : ''}
            ${items.length ? `
              <ul class="cs-list">
                ${items.map(it => `<li>${escapeHtml(it)}</li>`).join('')}
              </ul>` : ''}
          </div>
        </div>
      </section>`;
  }

  function renderOne(cs) {
    if (!cs || cs.published === false) return '';
    switch (cs.type) {
      case 'text-image': return renderTextImageSection(cs);
      case 'list':       return renderListSection(cs);
      case 'text':
      default:           return renderTextSection(cs);
    }
  }

  function render(svc) {
    const slot = document.getElementById('custom-sections-slot');
    if (!slot) return;
    const settings = FoyerDB.getSettings(svc);
    const list = (settings && settings.pageContent && Array.isArray(settings.pageContent.customSections))
      ? settings.pageContent.customSections : [];
    if (!list.length) { slot.innerHTML = ''; return; }
    slot.innerHTML = list.map(renderOne).join('');
  }

  // CSS injecté une seule fois
  function injectStyles() {
    if (document.getElementById('cs-styles')) return;
    const style = document.createElement('style');
    style.id = 'cs-styles';
    style.textContent = `
      .cs-section { background: white; }
      .cs-section:nth-of-type(even) { background: var(--bg-alt, #f7fafc); }
      .cs-content-wrap { max-width: 860px; margin: 0 auto; }
      .cs-content-wrap h2 { margin-bottom: 1.2rem; }
      .cs-paragraphs p { font-size: 1rem; line-height: 1.75; color: var(--text-light, #526370); margin-bottom: 1rem; }
      .cs-paragraphs p:last-child { margin-bottom: 0; }

      .cs-section-text-image .cs-flex {
        display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: center;
      }
      .cs-section-text-image.cs-img-right .cs-flex-img { order: 2; }
      .cs-section-text-image.cs-img-right .cs-flex-text { order: 1; }
      .cs-flex-img img {
        width: 100%; height: auto; border-radius: 14px; display: block;
        box-shadow: 0 8px 28px rgba(0,0,0,.1);
      }
      .cs-flex-text h2 { margin-bottom: 1.2rem; }
      @media (max-width: 800px) {
        .cs-section-text-image .cs-flex { grid-template-columns: 1fr; gap: 1.6rem; }
        .cs-section-text-image .cs-flex-img,
        .cs-section-text-image .cs-flex-text { order: unset !important; }
      }

      .cs-section-list .cs-list {
        list-style: none; padding: 0; margin-top: 1.4rem;
        display: grid; gap: .7rem;
      }
      .cs-section-list .cs-list li {
        background: white; border-left: 4px solid var(--primary, #256880);
        padding: .9rem 1.2rem; border-radius: 8px;
        font-size: .98rem; color: var(--text, #1a2530);
        box-shadow: 0 2px 8px rgba(0,0,0,.04);
        line-height: 1.55;
      }
    `;
    document.head.appendChild(style);
  }
  injectStyles();

  window.LeilaCustomSections = { render };
})();
