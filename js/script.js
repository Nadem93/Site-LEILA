/* ==========================================================
   Foyer Les Trois Rivières — Script principal
   Version améliorée — mai 2026
   ========================================================== */

'use strict';

/* ── Mobile menu ─────────────────────────────────────── */
const burger = document.getElementById('burger');
const nav    = document.getElementById('nav');

if (burger && nav) {
  burger.addEventListener('click', () => {
    const open = burger.classList.toggle('open');
    nav.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  });

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      burger.classList.remove('open');
      nav.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });

  // Fermer sur clic extérieur
  document.addEventListener('click', e => {
    if (nav.classList.contains('open') && !nav.contains(e.target) && !burger.contains(e.target)) {
      burger.classList.remove('open');
      nav.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  });
}

/* ── Header shadow on scroll ─────────────────────────── */
const header = document.querySelector('.header');
if (header) {
  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ── Scroll animations (Intersection Observer) ───────── */
const animateObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

const animateSelectors = [
  '.card', '.timeline-item', '.activity-card', '.team-card',
  '.stat-block', '.visual-card', '.section-head', '.gallery-item',
  '.news-card', '.testimonial', '.doc-card', '.hero-stats > div',
  '.two-col-text', '.two-col-visual', '.info-box', '.content-block'
].join(', ');

document.querySelectorAll(animateSelectors).forEach(el => {
  el.classList.add('fade-up');
  animateObserver.observe(el);
});

/* ── Tabs ─────────────────────────────────────────────── */
document.querySelectorAll('.tabs').forEach(tabsContainer => {
  const tabs     = tabsContainer.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      contents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const content = document.getElementById('tab-' + target);
      if (content) {
        content.classList.add('active');
        // Re-trigger animations on newly revealed cards
        content.querySelectorAll('.fade-up').forEach(el => {
          el.classList.remove('visible');
          requestAnimationFrame(() => setTimeout(() => animateObserver.observe(el), 50));
        });
      }
    });
  });
});

/* ── Contact form ─────────────────────────────────────── */
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    const btn = contactForm.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    const get = id => (document.getElementById(id)?.value || '').trim();

    // Sauvegarde dans FoyerDB
    if (typeof FoyerDB !== 'undefined' && typeof FoyerDB.saveMessage === 'function') {
      const name    = get('name');
      const email   = get('email');
      const message = get('message');
      const subject = get('subject');
      if (name && email && message && subject) {
        try {
          FoyerDB.saveMessage({
            name,
            email,
            phone:   get('phone'),
            service: get('service'),
            subject,
            subjectLabel: document.querySelector('#subject option:checked')?.textContent || subject,
            serviceLabel: document.querySelector('#service option:checked')?.textContent || '',
            message,
            source: 'contact-form',
            status: 'new'
          });
        } catch (err) { console.warn('Erreur enregistrement message:', err); }
      }
    }

    btn.textContent = '✓ Message envoyé';
    btn.disabled = true;
    btn.style.background = '#3a8a52';
    const ok = document.getElementById('contact-success');
    if (ok) {
      ok.style.display = 'block';
      ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => {
      contactForm.reset();
      btn.textContent = orig;
      btn.disabled = false;
      btn.style.background = '';
      if (ok) ok.style.display = 'none';
    }, 5000);
  });
}

/* ── Admission form (multi-step) ──────────────────────── */
const admissionForm = document.getElementById('admission-form');
if (admissionForm) {
  const steps      = Array.from(admissionForm.querySelectorAll('.admission-step'));
  const indicators = Array.from(document.querySelectorAll('.step-indicator'));
  let current = 0;

  const showStep = (idx) => {
    steps.forEach((s, i) => {
      s.style.display = i === idx ? 'block' : 'none';
    });
    indicators.forEach((ind, i) => {
      ind.classList.toggle('active', i === idx);
      ind.classList.toggle('done',   i < idx);
    });
    // Scroll to top of form smoothly
    admissionForm.closest('.container').scrollTop = 0;
  };

  admissionForm.querySelectorAll('[data-next]').forEach(btn => {
    btn.addEventListener('click', () => {
      const stepEl = steps[current];
      const fields = stepEl.querySelectorAll('input[required], select[required], textarea[required]');
      let valid = true;
      fields.forEach(f => {
        if (!f.value.trim()) {
          f.style.borderColor = '#d14444';
          f.style.boxShadow   = '0 0 0 3px rgba(209,68,68,0.12)';
          valid = false;
          f.addEventListener('input', () => {
            f.style.borderColor = '';
            f.style.boxShadow   = '';
          }, { once: true });
        }
      });
      if (valid && current < steps.length - 1) {
        current++;
        showStep(current);
      }
    });
  });

  admissionForm.querySelectorAll('[data-prev]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (current > 0) { current--; showStep(current); }
    });
  });

  admissionForm.addEventListener('submit', e => {
    e.preventDefault();
    const btn  = admissionForm.querySelector('[type="submit"]');
    const orig = btn.textContent;
    btn.textContent = '✓ Demande envoyée';
    btn.disabled = true;
    btn.style.background = '#3a8a52';
    // Show success panel
    const success = document.getElementById('admission-success');
    if (success) {
      admissionForm.style.display = 'none';
      success.style.display = 'block';
    }
  });

  showStep(0);
}

/* ── Tweaks panel ─────────────────────────────────────── */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "fontSize": "normal",
  "contrast": "normal"
}/*EDITMODE-END*/;

let tweaks = { ...TWEAK_DEFAULTS };

// Restore saved tweaks
try {
  const saved = JSON.parse(localStorage.getItem('3rivieres-tweaks') || '{}');
  tweaks = { ...tweaks, ...saved };
} catch (_) {}

function applyTweaks() {
  document.body.classList.toggle('text-large',    tweaks.fontSize === 'large');
  document.body.classList.toggle('high-contrast', tweaks.contrast === 'high');
  document.documentElement.style.setProperty('--font-size-base',
    tweaks.fontSize === 'large' ? '19px' : '16px');

  // Update tweak buttons UI
  document.querySelectorAll('[data-tweak-key]').forEach(btn => {
    const key = btn.dataset.tweakKey;
    const val = btn.dataset.tweakVal;
    btn.classList.toggle('active', tweaks[key] === val);
  });
}

function setTweak(key, val) {
  tweaks[key] = val;
  try { localStorage.setItem('3rivieres-tweaks', JSON.stringify(tweaks)); } catch (_) {}
  applyTweaks();
  window.parent.postMessage({ type: '__edit_mode_set_keys', edits: tweaks }, '*');
}

// Build tweaks panel
const panelEl = document.getElementById('tweaks-panel');
if (panelEl) {
  panelEl.querySelectorAll('[data-tweak-key]').forEach(btn => {
    btn.addEventListener('click', () => setTweak(btn.dataset.tweakKey, btn.dataset.tweakVal));
  });

  document.getElementById('tweaks-close')?.addEventListener('click', () => {
    panelEl.classList.remove('visible');
    window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
  });
}

// Listen for host messages
window.addEventListener('message', e => {
  if (e.data?.type === '__activate_edit_mode')   panelEl?.classList.add('visible');
  if (e.data?.type === '__deactivate_edit_mode') panelEl?.classList.remove('visible');
});

// Signal availability
window.parent.postMessage({ type: '__edit_mode_available' }, '*');

applyTweaks();

/* ── FAQ accordion ────────────────────────────────────── */
document.querySelectorAll('.faq-item').forEach(item => {
  const trigger = item.querySelector('.faq-question');
  const body    = item.querySelector('.faq-answer');
  if (!trigger || !body) return;

  trigger.addEventListener('click', () => {
    const open = item.classList.toggle('open');
    body.style.maxHeight   = open ? body.scrollHeight + 'px' : '0';
    body.style.opacity     = open ? '1' : '0';
    trigger.setAttribute('aria-expanded', String(open));
  });
});

/* ── Smooth number counter for stats ─────────────────── */
function animateNumber(el) {
  const text = el.textContent.trim();
  const match = text.match(/^([\d,.]+)/);
  if (!match) return;
  const raw   = parseFloat(match[1].replace(',', '.'));
  const suffix = text.slice(match[0].length);
  const dur    = 1200;
  const start  = performance.now();

  const tick = (now) => {
    const t   = Math.min((now - start) / dur, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const val  = raw * ease;
    const disp = Number.isInteger(raw)
      ? Math.round(val).toLocaleString('fr-FR')
      : val.toFixed(1).replace('.', ',');
    el.textContent = disp + suffix;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('.stat-block strong, .hero-stats strong').forEach(animateNumber);
      statsObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.4 });

document.querySelectorAll('.stats-row, .hero-stats').forEach(el => statsObserver.observe(el));
