let selectedEntryId = null;
let filterUnread = false;
let _journalCache = [];
let _journalResidentsCache = [];

async function loadJournalEntries() {
  _journalCache = await sbGetJournalEntries();
}

function toggleUnreadFilter() {
  filterUnread = !filterUnread;
  const btn = document.getElementById('btnUnreadFilter');
  if (btn) btn.style.background = filterUnread ? 'rgba(59,130,246,.12)' : '';
  renderEntries();
}

function updateUnreadBadge() {
  const session = Auth.getSession();
  if (!session) return;
  const count = _journalCache.filter(e => !e.readBy || !e.readBy.includes(session.userId)).length;
  const el = document.getElementById('unreadCount');
  const dot = document.getElementById('unreadDot');
  if (el) { el.textContent = count; el.style.display = count > 0 ? '' : 'none'; }
  if (dot) dot.style.display = count > 0 ? '' : 'none';
}

function showJournalList() {
  document.getElementById('journalListView').style.display = '';
  document.getElementById('journalFormView').style.display = 'none';
}

function showNewEntryForm() {
  selectedEntryId = null;
  inlineAttachments = [];
  renderEntryForm();
  document.getElementById('journalListView').style.display = 'none';
  document.getElementById('journalFormView').style.display = '';
}

function populateSelects() {
  const residents = _journalResidentsCache.filter(r => r.statut !== 'sorti');
  const cats = DB.get(DB.keys.categories) || [];
  const objs = DB.get(DB.keys.objectives) || [];

  const rSel = document.getElementById('eResident');
  const rFilter = document.getElementById('jFilterResident');
  residents.forEach(r => {
    const name = `${r.prenom || ''} ${r.nom || ''}`.trim();
    [rSel, rFilter].forEach(sel => { const o = document.createElement('option'); o.value = r.id; o.textContent = name; sel.appendChild(o); });
  });

  const cSel = document.getElementById('eCategorie');
  const cFilter = document.getElementById('jFilterCat');
  cats.forEach(c => {
    [cSel, cFilter].forEach(sel => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o); });
  });

  const oSel = document.getElementById('eObjectif');
  objs.forEach(o => { const opt = document.createElement('option'); opt.value = o.id; opt.textContent = o.name; oSel.appendChild(opt); });
}

function jrGoStep(step, sectionId) {
  for (let i = 1; i <= 6; i++) {
    const nav = document.getElementById('jrStep' + i + 'Nav');
    if (!nav) continue;
    const circle = nav.querySelector('span');
    if (i === step) {
      nav.style.background = 'rgba(255,255,255,.18)';
      nav.style.opacity = '1';
      if (circle) { circle.style.background = '#fff'; circle.style.color = '#059669'; }
    } else {
      nav.style.background = 'transparent';
      nav.style.opacity = '.6';
      if (circle) { circle.style.background = 'rgba(255,255,255,.2)'; circle.style.color = '#fff'; }
    }
  }
  if (sectionId) {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function _sectionCard(iconSvg, label, content) {
  return `<div style="background:var(--surface,var(--bg));border:1px solid var(--border);border-radius:var(--r);padding:1rem 1.25rem">
    <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem">
      ${iconSvg}
      <span style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">${label}</span>
    </div>
    ${content}
  </div>`;
}
const _ico = (d,extra='') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;color:var(--muted);flex-shrink:0${extra?';'+extra:''}"><${d}/></svg>`;

function renderEntryForm() {
  const residents = _journalResidentsCache.filter(r => r.statut !== 'sorti');
  const cats = DB.get(DB.keys.categories) || [];
  const currentCat = (document.getElementById('iCategorie')?.value || '').split(',').filter(Boolean);
  const currentRes = (document.getElementById('iResident')?.value || '').split(',').filter(Boolean);
  const currentDate = document.getElementById('iDate')?.value || new Date().toISOString().slice(0,16);
  const currentContenu = document.getElementById('iContenu')?.value || '';
  const currentObjectif = document.getElementById('iObjectif')?.value || '';
  const currentVis = document.querySelector('input[name="iVisibilite"]:checked')?.value || 'equipe';

  const CARD = 'background:#fff;border-radius:20px;padding:1.75rem 2rem;box-shadow:0 2px 16px rgba(0,0,0,.05);border:1px solid #f1f5f9';
  const HDR_ICON = 'width:16px;height:16px;color:#94a3b8;flex-shrink:0';
  const HDR_LABEL = 'font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8';

  function catPillStyle(isActive, color) {
    if (isActive) {
      const bg = color ? color + '22' : '#F3E8FF';
      const fg = color || '#7C3AED';
      return `style="height:30px;border-radius:8px;display:flex;align-items:center;padding:0 12px;cursor:pointer;border:1.5px solid ${fg};background:${bg};color:${fg};font-size:.78rem;font-weight:600;transition:all .15s"`;
    }
    return `style="height:30px;border-radius:8px;display:flex;align-items:center;padding:0 12px;cursor:pointer;border:1.5px solid #e2e8f0;background:#f8fafc;color:#374151;font-size:.78rem;font-weight:500;transition:all .15s"`;
  }

  function visPillStyle(isActive) {
    return isActive
      ? `style="padding:.45rem 1rem;border-radius:10px;cursor:pointer;border:1.5px solid #7C4DFF;background:#F3E8FF;color:#7C3AED;font-size:.8rem;font-weight:600;transition:all .15s"`
      : `style="padding:.45rem 1rem;border-radius:10px;cursor:pointer;border:1.5px solid #e2e8f0;background:#f8fafc;color:#374151;font-size:.8rem;font-weight:500;transition:all .15s"`;
  }

  function spPillStyle(val, isActive) {
    const palettes = { '': ['#64748b','#e2e8f0','#f8fafc'], direct: ['#8b5cf6','#ddd6fe','#f5f3ff'], indirect: ['#f97316','#fed7aa','#fff7ed'] };
    const [fg, border, bg] = palettes[val] || palettes[''];
    return isActive
      ? `style="padding:.45rem 1rem;border-radius:10px;cursor:pointer;border:1.5px solid ${border};background:${bg};color:${fg};font-size:.8rem;font-weight:600;transition:all .15s"`
      : `style="padding:.45rem 1rem;border-radius:10px;cursor:pointer;border:1.5px solid #e2e8f0;background:#f8fafc;color:#374151;font-size:.8rem;font-weight:500;transition:all .15s"`;
  }

  const residentDropdownItems = residents.map(r => {
    const name = `${r.prenom||''} ${r.nom||''}`.trim();
    const on = currentRes.includes(r.id);
    return `<div class="res-drop-item${on?' res-drop-sel':''}" data-id="${r.id}" data-name="${escHtml(name)}" onclick="selectResidentDropdown('${r.id}')" style="display:flex;align-items:center;justify-content:space-between;padding:.55rem 1rem;font-size:.82rem;cursor:pointer;border-bottom:1px solid #f1f5f9;transition:background .1s${on?';background:#faf5ff;color:#7C3AED':';color:#374151'}">
      <span>${escHtml(name)}</span>
      ${on ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:13px;height:13px;color:#7C4DFF;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
    </div>`;
  }).join('');

  const residentChips = currentRes.map(id => {
    const r = residents.find(x => x.id === id);
    if (!r) return '';
    const name = `${r.prenom||''} ${r.nom||''}`.trim();
    const color = r.color || '#7C4DFF';
    return `<span style="display:inline-flex;align-items:center;gap:4px;background:${color}18;color:${color};border:1.5px solid ${color}44;border-radius:20px;font-size:.72rem;padding:3px 10px 3px 9px;font-weight:600">${escHtml(name)}<span onclick="selectResidentDropdown('${id}')" style="cursor:pointer;opacity:.5;margin-left:2px;font-size:.9em">×</span></span>`;
  }).join('');

  const html = `
    <div class="entry-form-design" style="display:grid;grid-template-columns:7fr 3fr;gap:1.5rem;align-items:start">
      <input type="hidden" id="iCategorie" value="${currentCat.join(',')}"/>
      <input type="hidden" id="iResident" value="${currentRes.join(',')}"/>
      <input type="hidden" id="iObjectif" value="${currentObjectif}"/>
      <input type="hidden" id="iPeriode" value=""/>

      <!-- Colonne gauche -->
      <div style="display:flex;flex-direction:column;gap:1.5rem">

        <!-- Catégorie -->
        <div style="${CARD}">
          <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1.1rem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${HDR_ICON}"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
            <span style="${HDR_LABEL}">Catégorie</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:.5rem">
            ${cats.length ? cats.map(c => {
              const isActive = currentCat.includes(c.id);
              return `<div class="cat-pill${isActive?' active':''}" data-id="${c.id}" ${catPillStyle(isActive, c.color)} onclick="selectCatPill('${c.id}')">${escHtml(c.name)}</div>`;
            }).join('') : '<span style="font-size:.82rem;color:#94a3b8">Aucune catégorie — définissez-en dans Admin</span>'}
          </div>
        </div>

        <!-- Observation / Contenu -->
        <div style="${CARD}">
          <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1.1rem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${HDR_ICON}"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span style="${HDR_LABEL}">Observation / Contenu</span>
          </div>
          <input type="datetime-local" id="iDate" class="form-control" value="${currentDate}" style="margin-bottom:1rem"/>
          <div style="display:flex;gap:.5rem;margin-bottom:.75rem">
            <button class="btn btn-ghost btn-sm" onclick="aiAssistJournalInline('redaction')">✍ Rédiger</button>
            <button class="btn btn-ghost btn-sm" onclick="aiAssistJournalInline('correction')">✓ Corriger</button>
            <button class="btn btn-ghost btn-sm" onclick="aiAssistJournalInline('reformulation')">✨ Reformuler</button>
          </div>
          <textarea id="iContenu" class="form-control" placeholder="Décrivez l'événement, l'observation ou l'intervention…" style="height:220px;resize:vertical">${escHtml(currentContenu)}</textarea>
        </div>
      </div>

      <!-- Colonne droite -->
      <div style="display:flex;flex-direction:column;gap:1.5rem">

        <!-- Résident(s) -->
        <div style="${CARD}">
          <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1.1rem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${HDR_ICON}"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span style="${HDR_LABEL}">Résident(s) concerné(s)</span>
          </div>
          <div style="position:relative">
            <div style="display:flex;align-items:center;border:1.5px solid #e2e8f0;border-radius:12px;background:#f8fafc;overflow:hidden;height:44px">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;color:#94a3b8;flex-shrink:0;margin-left:12px;pointer-events:none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="residentSearch" placeholder="Rechercher un résident…" oninput="filterResidentDropdown()" onfocus="showResidentDropdown()" autocomplete="off" style="flex:1;padding:0 .5rem;border:none;outline:none;background:transparent;font-size:.82rem;color:#111827"/>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" onclick="toggleResidentDropdown()" style="width:15px;height:15px;color:#94a3b8;flex-shrink:0;margin-right:12px;cursor:pointer"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div id="residentDropdown" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1px solid #e2e8f0;border-radius:14px;max-height:220px;overflow-y:auto;z-index:200;box-shadow:0 8px 24px rgba(0,0,0,.1)">
              ${residentDropdownItems}
            </div>
          </div>
          <div id="selectedResidentChips" style="display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.75rem">${residentChips}</div>
        </div>

        <!-- Visibilité -->
        <div style="${CARD}">
          <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1.1rem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${HDR_ICON}"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span style="${HDR_LABEL}">Visibilité</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:.5rem">
            <div class="vis-pill${currentVis==='equipe'?' active':''}" data-vis="equipe" onclick="selectVisPill('equipe')" ${visPillStyle(currentVis==='equipe')}>Équipe uniquement</div>
            <div class="vis-pill${currentVis==='tous'?' active':''}" data-vis="tous" onclick="selectVisPill('tous')" ${visPillStyle(currentVis==='tous')}>Tous</div>
            <div class="vis-pill${currentVis==='confidentiel'?' active':''}" data-vis="confidentiel" onclick="selectVisPill('confidentiel')" ${visPillStyle(currentVis==='confidentiel')}>Confidentiel</div>
          </div>
          <div class="vis-radios" style="display:none">
            <input type="radio" name="iVisibilite" value="equipe" ${currentVis==='equipe'?'checked':''}/>
            <input type="radio" name="iVisibilite" value="tous" ${currentVis==='tous'?'checked':''}/>
            <input type="radio" name="iVisibilite" value="confidentiel" ${currentVis==='confidentiel'?'checked':''}/>
          </div>
        </div>

        <!-- SERAFIN-PH -->
        <div style="${CARD}">
          <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1.1rem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${HDR_ICON}"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span style="${HDR_LABEL}">SERAFIN-PH <span style="font-weight:400;opacity:.6">(optionnel)</span></span>
          </div>
          <div style="display:flex;flex-direction:column;gap:.5rem">
            <div class="sp-pill" data-sp="" onclick="selectSpPill('')" ${spPillStyle('', !document.getElementById('iSerafinph')?.value)}>Aucun</div>
            <div class="sp-pill" data-sp="direct" onclick="selectSpPill('direct')" ${spPillStyle('direct', false)}>Direct</div>
            <div class="sp-pill" data-sp="indirect" onclick="selectSpPill('indirect')" ${spPillStyle('indirect', false)}>Indirect</div>
          </div>
          <input type="hidden" id="iSerafinph" value=""/>
        </div>

        <!-- Pièces jointes -->
        <div style="${CARD}">
          <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1.1rem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${HDR_ICON}"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            <span style="${HDR_LABEL}">Pièces jointes <span style="font-weight:400;opacity:.6">(optionnel)</span></span>
          </div>
          <label style="display:inline-flex;align-items:center;gap:.4rem;padding:.5rem 1rem;border:1.5px dashed #cbd5e1;border-radius:10px;cursor:pointer;font-size:.8rem;color:#64748b;background:#f8fafc">
            📎 Ajouter un fichier
            <input type="file" accept="image/*,application/pdf" style="display:none" onchange="addInlineAttachment(this)"/>
          </label>
          <div id="inlineAttachList" style="display:flex;flex-direction:column;gap:.35rem;margin-top:.6rem"></div>
        </div>

        <!-- Bouton -->
        <button onclick="saveInlineEntry()" style="width:100%;height:48px;background:#7C4DFF;color:#fff;border:none;border-radius:12px;font-size:.9rem;font-weight:600;cursor:pointer;transition:opacity .15s;letter-spacing:.01em" onmouseover="this.style.opacity='.88'" onmouseout="this.style.opacity='1'">
          Enregistrer l'entrée
        </button>
      </div>
    </div>`;

  document.getElementById('entryFormContainer').innerHTML = html;
  renderInlineAttachList();
  document.addEventListener('click', function _closeRes(e) {
    if (!e.target.closest('#residentSearch') && !e.target.closest('#residentDropdown') && !e.target.closest('[onclick*="toggleResidentDropdown"]')) {
      const dd = document.getElementById('residentDropdown');
      if (dd) dd.style.display = 'none';
      document.removeEventListener('click', _closeRes);
    }
  });
}

function selectSpPill(val) {
  const isp = document.getElementById('iSerafinph');
  if (isp) isp.value = val;
  const palettes = { '': ['#64748b','#e2e8f0','#f8fafc'], direct: ['#8b5cf6','#ddd6fe','#f5f3ff'], indirect: ['#f97316','#fed7aa','#fff7ed'] };
  const BASE = 'padding:.45rem 1rem;border-radius:10px;cursor:pointer;font-size:.8rem;transition:all .15s';
  document.querySelectorAll('.sp-pill').forEach(el => {
    const on = el.dataset.sp === val;
    el.classList.toggle('active', on);
    const [fg, border, bg] = palettes[el.dataset.sp] || palettes[''];
    el.style.cssText = on
      ? `${BASE};border:1.5px solid ${border};background:${bg};color:${fg};font-weight:600`
      : `${BASE};border:1.5px solid #e2e8f0;background:#f8fafc;color:#374151;font-weight:500`;
  });
}

function selectCatPill(id) {
  const hid = document.getElementById('iCategorie');
  if (!hid) return;
  let ids = hid.value ? hid.value.split(',').filter(Boolean) : [];
  const idx = ids.indexOf(id);
  if (idx >= 0) ids.splice(idx, 1); else ids.push(id);
  hid.value = ids.join(',');
  const cats = DB.get(DB.keys.categories) || [];
  const BASE = 'height:30px;border-radius:8px;display:flex;align-items:center;padding:0 12px;cursor:pointer;font-size:.78rem;transition:all .15s';
  document.querySelectorAll('.cat-pill').forEach(el => {
    const on = ids.includes(el.dataset.id);
    el.classList.toggle('active', on);
    const cat = cats.find(c => String(c.id) === String(el.dataset.id));
    const color = cat?.color || '#7C3AED';
    el.style.cssText = on
      ? `${BASE};border:1.5px solid ${color};background:${color}22;color:${color};font-weight:600`
      : `${BASE};border:1.5px solid #e2e8f0;background:#f8fafc;color:#374151;font-weight:500`;
  });
}

function selectResidentPill(id) { selectResidentDropdown(id); }

function selectResidentDropdown(id) {
  const hid = document.getElementById('iResident');
  if (!hid) return;
  let ids = hid.value ? hid.value.split(',').filter(Boolean) : [];
  const idx = ids.indexOf(id);
  if (idx >= 0) ids.splice(idx, 1); else ids.push(id);
  hid.value = ids.join(',');
  renderResidentChips(ids);
  document.querySelectorAll('.res-drop-item').forEach(el => {
    const on = ids.includes(el.dataset.id);
    el.classList.toggle('res-drop-sel', on);
    let chk = el.querySelector('svg');
    if (on && !chk) {
      el.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:13px;height:13px;color:var(--accent);flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>`);
    } else if (!on && chk) { chk.remove(); }
  });
}

function renderResidentChips(ids) {
  const container = document.getElementById('selectedResidentChips');
  if (!container) return;
  const residents = _journalResidentsCache.filter(r => r.statut !== 'sorti');
  container.innerHTML = ids.map(id => {
    const r = residents.find(x => x.id === id);
    if (!r) return '';
    const name = `${r.prenom||''} ${r.nom||''}`.trim();
    const color = r.color || 'var(--accent)';
    return `<span style="display:inline-flex;align-items:center;gap:4px;background:${color}18;color:${color};border:1px solid ${color};border-radius:20px;font-size:.72rem;padding:2px 8px 2px 7px;font-weight:500">${escHtml(name)}<span onclick="selectResidentDropdown('${id}')" style="cursor:pointer;opacity:.55;margin-left:1px">×</span></span>`;
  }).join('');
}

function showResidentDropdown() {
  const dd = document.getElementById('residentDropdown');
  if (dd) { dd.style.display = 'block'; filterResidentDropdown(); }
}

function toggleResidentDropdown() {
  const dd = document.getElementById('residentDropdown');
  if (!dd) return;
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

function filterResidentDropdown() {
  const q = (document.getElementById('residentSearch')?.value || '').toLowerCase();
  document.querySelectorAll('.res-drop-item').forEach(el => {
    el.style.display = !q || (el.dataset.name || '').toLowerCase().includes(q) ? '' : 'none';
  });
}

function filterResidentPills() { filterResidentDropdown(); }

function updateResidentCount() {}

function selectVisPill(vis) {
  const radio = document.querySelector('input[name="iVisibilite"][value="'+vis+'"]');
  if (radio) radio.checked = true;
  const BASE = 'padding:.45rem 1rem;border-radius:10px;cursor:pointer;font-size:.8rem;transition:all .15s';
  document.querySelectorAll('.vis-pill').forEach(el => {
    const on = el.dataset.vis === vis;
    el.classList.toggle('active', on);
    el.style.cssText = on
      ? `${BASE};border:1.5px solid #7C4DFF;background:#F3E8FF;color:#7C3AED;font-weight:600`
      : `${BASE};border:1.5px solid #e2e8f0;background:#f8fafc;color:#374151;font-weight:500`;
  });
}

async function saveInlineEntry() {
  const session = Auth.getSession();
  const userName = session ? [session.prenom, session.nom].filter(Boolean).join(' ') || session.username : 'Utilisateur';
  const residentIds = document.getElementById('iResident').value ? document.getElementById('iResident').value.split(',').filter(Boolean) : [];
  const contenu = document.getElementById('iContenu').value.trim();
  if (!residentIds.length) { toast('Sélectionnez au moins un résident', 'error'); return; }
  if (!contenu) { toast('Le contenu est requis', 'error'); return; }
  const residents = _journalResidentsCache;
  const visEl = document.querySelector('input[name="iVisibilite"]:checked');
  // Détection de doublon : même résident, < 3h, contenu très similaire
  const candDate = document.getElementById('iDate').value || new Date().toISOString();
  for (const residentId of residentIds) {
    const dup = findJournalDuplicate({ residentId, contenu, date: candDate }, _journalCache);
    if (dup) {
      const e = dup.entry;
      const extrait = (e.contenu || '').slice(0, 140) + ((e.contenu || '').length > 140 ? '…' : '');
      if (!confirm(`⚠️ Doublon possible pour ${e.resident || 'ce résident'} :\n\n« ${extrait} »\n${formatDateTime(e.date)} · ${getJournalAuthor ? getJournalAuthor(e) : (e.author || '')}\n\nEnregistrer quand même cette transmission ?`)) return;
      break;
    }
  }
  const newNames = [];
  try {
    for (const residentId of residentIds) {
      const res = residents.find(r => r.id === residentId);
      const name = res ? `${res.prenom||''} ${res.nom||''}`.trim() : '';
      newNames.push(name);
      await sbSaveJournalEntry({
        residentId,
        resident: name,
        residentColor: res?.color || 'var(--blue)',
        categorie: document.getElementById('iCategorie').value,
        date: document.getElementById('iDate').value || new Date().toISOString(),
        objectif: document.getElementById('iObjectif').value,
        contenu, visibilite: visEl?.value || 'equipe',
        serafinphType: document.getElementById('iSerafinph')?.value || '',
        attachments: inlineAttachments.slice(),
        author: userName, authorId: session?.userId,
        replies: [], readBy: [session?.userId],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
    }
  } catch (e) {
    toast('Erreur lors de l\'enregistrement', 'error');
    console.error(e);
    return;
  }
  inlineAttachments = [];
  await loadJournalEntries();
  if (typeof auditLog === 'function') auditLog('journal_create', `${residentIds.length} entrée(s) pour ${newNames.join(', ')}`);
  toast(residentIds.length + ' entrée' + (residentIds.length>1?'s':'') + ' ajoutée' + (residentIds.length>1?'s':'') + ' ✓');
  showJournalList();
  renderEntries();
}

async function aiAssistJournalInline(action) {
  const ta = document.getElementById('iContenu');
  if (!ta) return;
  const current = ta.value || '';
  const residentIds = (document.getElementById('iResident')?.value || '').split(',').filter(Boolean);
  const residents = _journalResidentsCache;
  const firstRes = residents.find(r => r.id === residentIds[0]);
  const residentName = firstRes ? `${firstRes.prenom||''} ${firstRes.nom||''}`.trim() : (residentIds.length > 1 ? 'plusieurs résidents' : '');
  const hasKey = !!getAiKey();
  const labels = { redaction: 'Rédaction', correction: 'Correction', reformulation: 'Reformulation' };
  if (hasKey) {
    const customSystem = getAiPrompt('journal', action);
    let system = '', prompt = '';
    if (action === 'redaction') {
      system = customSystem || 'Tu es un éducateur rédigeant une observation. Écris en français, professionnel et factuel.';
      prompt = `Rédige une courte observation${residentName ? ' pour ' + residentName : ''}.` + (current ? '\n\nTexte à compléter :\n' + current : '');
    } else if (action === 'correction') {
      if (!current) { toast('Écrivez d\'abord un texte', 'error'); return; }
      system = customSystem || 'Corrige les fautes sans changer le style.';
      prompt = 'Corrige :\n\n' + current;
    } else if (action === 'reformulation') {
      if (!current) { toast('Écrivez d\'abord un texte', 'error'); return; }
      system = customSystem || 'Reformule de manière professionnelle.';
      prompt = 'Reformule :\n\n' + current;
    }
    const result = await callMistral(prompt, system);
    if (result) { ta.value = result; toast('✓ ' + labels[action], 'success'); return; }
    toast('API indisponible, mode local', 'warning');
  }
  let result = '';
  if (action === 'redaction') {
    const tpl = ['Observation : le résident a participé activement.','Suivi : bonne intégration et interactions positives.','Point d\'étape : autonomie croissante.'];
    result = current ? current + '\n\n' + tpl[Math.floor(Math.random()*tpl.length)] : tpl[Math.floor(Math.random()*tpl.length)];
  } else if (action === 'correction') {
    if (!current) { toast('Écrivez d\'abord un texte', 'error'); return; }
    result = current.replace(/\bils on\b/g,'ils ont').replace(/\bil a étais\b/g,'il a été');
  } else if (action === 'reformulation') {
    if (!current) { toast('Écrivez d\'abord un texte', 'error'); return; }
    result = current.replace(/\bgère\b/g,'assure la gestion de').replace(/\bveut\b/g,'souhaite');
  }
  if (result) { ta.value = result; toast('✓ ' + labels[action] + ' (local)', 'success'); }
}

function getEntries() {
  const session = Auth.getSession();
  const q = (document.getElementById('jSearch')?.value || '').toLowerCase();
  const res = document.getElementById('jFilterResident')?.value || '';
  const cat = document.getElementById('jFilterCat')?.value || '';
  const dateFrom = document.getElementById('jFilterDate')?.value || '';
  const dateTo = document.getElementById('jFilterDateEnd')?.value || '';
  let list = _journalCache.slice();
  // Filtrer selon la visibilité : confidentiel → uniquement admin ou auteur
  const isAdmin = session?.role === 'admin';
  list = list.filter(e => {
    if (e.visibilite !== 'confidentiel') return true;
    return isAdmin || String(e.authorId) === String(session?.userId);
  });
  if (q) list = list.filter(e =>
    (e.contenu  || '').toLowerCase().includes(q) ||
    (e.resident || '').toLowerCase().includes(q) ||
    (e.author   || '').toLowerCase().includes(q)
  );
  if (res) list = list.filter(e => e.residentId === res);
  if (cat) list = list.filter(e => (e.categorie || '').split(',').filter(Boolean).includes(cat));
  if (dateFrom) list = list.filter(e => e.date && e.date.slice(0,10) >= dateFrom);
  if (dateTo) list = list.filter(e => e.date && e.date.slice(0,10) <= dateTo);
  if (filterUnread && session) list = list.filter(e => !e.readBy || !e.readBy.includes(session.userId));
  return list;
}

function renderEntries() {
  const list = getEntries();
  const el = document.getElementById('entriesList');
  const cats = DB.get(DB.keys.categories) || [];
  const journalResidents = _journalResidentsCache;
  if (!list.length) {
    el.innerHTML = `<div class="empty" style="padding:2rem"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div><h3>Aucune entrée</h3><p>Commencez à documenter les événements.</p></div>`;
    return;
  }
  updateUnreadBadge();
  const session = Auth.getSession();
  el.innerHTML = list.map(e => {
    const entryCats = (e.categorie || '').split(',').filter(Boolean).map(id => cats.find(c => String(c.id) === String(id))).filter(Boolean);
    const jRes = journalResidents.find(r => r.id === e.residentId);
    const isSelected = e.id === selectedEntryId;
    const isUnread = session && (!e.readBy || !e.readBy.includes(session.userId));
    const expandedSection = isSelected ? `
      <div onclick="event.stopPropagation()" style="margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--border)">
        <p style="font-size:.88rem;line-height:1.8;white-space:pre-wrap;color:var(--text);margin-bottom:.5rem">${escHtml(e.contenu)||''}</p>
        ${e.editedAt ? `<div style="font-size:.7rem;color:var(--muted);margin-bottom:.6rem;font-style:italic">✎ Modifié par ${escHtml(e.editedBy||'?')} le ${formatDateTime(e.editedAt)}${(e.editHistory&&e.editHistory.length)?` · <a href="#" onclick="event.preventDefault();event.stopPropagation();showEditHistory('${e.id}')" style="color:var(--accent)">historique (${e.editHistory.length})</a>`:''}</div>` : ''}
        ${renderEntryAttachments(e)}
        ${renderReplies(e)}
        <div style="display:flex;gap:.5rem;align-items:flex-end;margin-top:.75rem">
          <textarea id="replyContent_${e.id}" rows="2" class="form-control" style="flex:1;font-size:.82rem;resize:vertical" placeholder="Écrire une réponse…"></textarea>
          <button class="btn btn-primary btn-sm" style="align-self:flex-end;flex-shrink:0" onclick="addReply('${e.id}')">Envoyer</button>
        </div>
        <div style="display:flex;gap:.4rem;justify-content:flex-end;margin-top:.5rem">
          <button class="btn btn-ghost btn-sm" onclick="editEntry('${e.id}')">Modifier</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteEntryById('${e.id}')">Supprimer</button>
        </div>
      </div>` : '';
    return `<div class="entry-card ${isSelected ? 'selected' : ''}" style="${isUnread && !isSelected ? 'box-shadow:0 0 0 3px #3b82f6;border-color:#3b82f6;background:#eff6ff;' : ''}" onclick="selectEntry('${e.id}')">
      <div class="entry-header">
        ${jRes?.photo?`<img src="${jRes.photo}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0" alt=""/>`:`<div class="avatar sm" style="background:${e.residentColor||'var(--blue)'};flex-shrink:0">${(escHtml(e.resident)||'?')[0].toUpperCase()}</div>`}
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
            ${isUnread ? '<span style="width:8px;height:8px;border-radius:50%;background:var(--blue);flex-shrink:0;display:inline-block"></span>' : ''}
            <span style="font-weight:${isUnread ? '800' : '700'};font-size:.875rem">${escHtml(e.resident)||'—'}</span>
            ${entryCats.map(cat => `<span class="badge" style="background:${cat.color}22;color:${cat.color}">${escHtml(cat.name)}</span>`).join('')}
            ${e.visibilite === 'confidentiel' ? '<span class="badge badge-red">Confidentiel</span>' : ''}
            ${e.serafinphType === 'direct' ? '<span class="badge" style="background:#8b5cf622;color:#8b5cf6">📊 Direct</span>' : ''}
            ${e.serafinphType === 'indirect' ? '<span class="badge" style="background:#f9731622;color:#f97316">📊 Indirect</span>' : ''}
          </div>
          <div class="entry-meta">${formatDateTime(e.date)}${isUnread ? '' : ` · <span style="font-weight:500;background:${getAuthorColor(e)}18;color:${getAuthorColor(e)};padding:1px 8px;border-radius:10px;font-size:.75rem">${escHtml(getJournalAuthor(e))}</span>`}</div>
        </div>
      </div>
      ${!isSelected && !isUnread ? `<div class="entry-preview">${escHtml(e.contenu)||''}</div>` : ''}
      ${!isSelected && isUnread ? `<div style="font-size:.78rem;color:var(--muted);margin-top:.5rem;font-style:italic">Cliquez pour lire</div>` : ''}
      ${!isSelected && !isUnread && (e.replies||[]).length ? `<div style="font-size:.7rem;color:var(--blue);margin-top:.4rem;font-weight:600">💬 ${e.replies.length} réponse${e.replies.length>1?'s':''}</div>` : ''}
      ${expandedSection}
    </div>`;
  }).join('');
}

function renderReplies(e) {
  const replies = e.replies || [];
  if (!replies.length) return '';
  return `<div style="margin-top:1.25rem;border-top:1px solid var(--border);padding-top:1rem">
    <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:.75rem">Réponses (${replies.length})</div>
    ${replies.map(r => `
      <div style="display:flex;gap:.6rem;padding:.6rem .75rem;background:var(--g50);border-radius:var(--r-sm);margin-bottom:.5rem;border:1px solid var(--border)">
        <div class="avatar sm" style="background:var(--accent);flex-shrink:0;width:24px;height:24px;font-size:.55rem">${(escHtml(r.author)||'?')[0].toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem">
            <span style="font-weight:700;font-size:.78rem">${escHtml(r.author)}</span>
            <span style="font-size:.65rem;color:var(--muted)">${formatDateTime(r.createdAt)}</span>
          </div>
          <p style="font-size:.82rem;line-height:1.6;margin-top:3px;white-space:pre-wrap">${escHtml(r.content)}</p>
        </div>
      </div>`).join('')}
  </div>`;
}

// ── Historique des modifications ──
function showEditHistory(id) {
  const e = _journalCache.find(x => x.id === id);
  if (!e || !e.editHistory) return;
  const lines = e.editHistory.slice().reverse().map(h =>
    `• ${formatDateTime(h.at)} — ${h.by || '?'}\n   Ancien contenu : « ${(h.contenu || '').slice(0, 200)}${(h.contenu || '').length > 200 ? '…' : ''} »`
  ).join('\n\n');
  alert(`Historique des modifications\n\n${lines}`);
}

// ── Pièces jointes ──
let inlineAttachments = [];

function renderInlineAttachList() {
  const box = document.getElementById('inlineAttachList');
  if (!box) return;
  box.innerHTML = inlineAttachments.length ? inlineAttachments.map(a => `
    <div style="display:flex;align-items:center;gap:.5rem;padding:.35rem .5rem;background:var(--g50);border:1px solid var(--border);border-radius:var(--r-sm);font-size:.78rem">
      <span>${a.type && a.type.includes('image') ? '🖼️' : '📎'}</span>
      <span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(a.name)}</span>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);padding:0 .4rem" onclick="removeInlineAttachment('${a.id}')">✕</button>
    </div>`).join('') : '';
}

async function addInlineAttachment(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) { toast('Fichier trop lourd (max 3 Mo)', 'error'); input.value = ''; return; }
  try {
    const data = await fileToBase64(file);
    inlineAttachments.push({ id: genId(), name: file.name, type: file.type, size: file.size, data });
    renderInlineAttachList();
  } catch (e) { toast('Erreur de chargement', 'error'); }
  input.value = '';
}

function removeInlineAttachment(id) {
  inlineAttachments = inlineAttachments.filter(a => a.id !== id);
  renderInlineAttachList();
}

function renderEntryAttachments(e) {
  const atts = e.attachments || [];
  if (!atts.length) return '';
  return `<div style="margin-bottom:.75rem">
    <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:.4rem">📎 Pièces jointes (${atts.length})</div>
    <div style="display:flex;flex-wrap:wrap;gap:.5rem">
      ${atts.map(a => a.type && a.type.includes('image')
        ? `<a href="${a.data}" download="${escHtml(a.name)}" title="${escHtml(a.name)}"><img src="${a.data}" style="width:64px;height:64px;object-fit:cover;border-radius:var(--r-sm);border:1px solid var(--border)"/></a>`
        : `<a href="${a.data}" download="${escHtml(a.name)}" style="display:flex;align-items:center;gap:.4rem;padding:.4rem .6rem;background:var(--g50);border:1px solid var(--border);border-radius:var(--r-sm);font-size:.78rem;text-decoration:none;color:var(--g700)">📎 ${escHtml(a.name)}</a>`
      ).join('')}
    </div>
  </div>`;
}

async function selectEntry(id) {
  // Toggle: cliquer à nouveau ferme la carte
  if (selectedEntryId === id) { selectedEntryId = null; renderEntries(); return; }
  selectedEntryId = id;

  // Mark as read
  const session = Auth.getSession();
  const e = _journalCache.find(x => x.id === id);
  if (!e) return;
  if (session && (!e.readBy || !e.readBy.includes(session.userId))) {
    const readBy = (e.readBy || []).concat([session.userId]);
    try {
      const updated = await sbSaveJournalEntry({ ...e, readBy });
      const idx = _journalCache.findIndex(x => x.id === id);
      if (idx !== -1) _journalCache[idx] = updated;
    } catch (err) { console.error(err); }
  }

  renderEntries();
  setTimeout(() => {
    const el = document.querySelector('.entry-card.selected');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
}

async function addReply(entryId) {
  const content = document.getElementById('replyContent_'+entryId)?.value?.trim();
  if (!content) { toast('Écrivez une réponse', 'error'); return; }
  const session = Auth.getSession();
  const userName = session ? [session.prenom, session.nom].filter(Boolean).join(' ') || session.username : 'Utilisateur';
  const e = _journalCache.find(x => x.id === entryId);
  if (!e) return;
  const replies = (e.replies || []).concat([{
    id: genId(),
    content,
    author: userName,
    authorId: session?.userId,
    createdAt: new Date().toISOString()
  }]);
  try {
    const updated = await sbSaveJournalEntry({ ...e, replies });
    const idx = _journalCache.findIndex(x => x.id === entryId);
    if (idx !== -1) _journalCache[idx] = updated;
  } catch (err) { toast('Erreur lors de l\'enregistrement', 'error'); console.error(err); return; }
  toast('Réponse ajoutée');
  selectEntry(entryId);
}

function editEntry(id) {
  const e = _journalCache.find(x => x.id === id);
  if (!e) return;
  document.getElementById('modalEntryTitle').textContent = 'Modifier l\'entrée';
  document.getElementById('entryId').value = id;
  document.getElementById('eResident').value = e.residentId || '';
  const eCatIds = (e.categorie || '').split(',').filter(Boolean);
  Array.from(document.getElementById('eCategorie').options).forEach(o => { o.selected = eCatIds.includes(o.value); });
  document.getElementById('eDate').value = e.date ? e.date.slice(0,16) : '';
  document.getElementById('eObjectif').value = e.objectif || '';
  document.getElementById('eContenu').value = e.contenu || '';
  const vis = document.querySelector(`input[name="eVisibilite"][value="${e.visibilite||'equipe'}"]`);
  if (vis) vis.checked = true;
  const sp = document.getElementById('eSerafinph');
  if (sp) sp.value = e.serafinphType || '';
  document.getElementById('btnDeleteEntry').style.display = '';
  openModal('modalEntry');
}

async function saveEntry() {
  const session = Auth.getSession();
  const userName = session ? [session.prenom, session.nom].filter(Boolean).join(' ') || session.username : 'Utilisateur';
  const residentId = document.getElementById('eResident').value;
  const contenu = document.getElementById('eContenu').value.trim();
  if (!residentId) { toast('Sélectionnez un résident', 'error'); return; }
  if (!contenu) { toast('Le contenu est requis', 'error'); return; }

  const residents = _journalResidentsCache;
  const res = residents.find(r => r.id === residentId);
  const visEl = document.querySelector('input[name="eVisibilite"]:checked');

  const data = {
    residentId,
    resident: res ? `${res.prenom||''} ${res.nom||''}`.trim() : '',
    residentColor: res?.color || 'var(--blue)',
    categorie: Array.from(document.getElementById('eCategorie').selectedOptions).map(o => o.value).join(','),
    date: document.getElementById('eDate').value || new Date().toISOString(),
    objectif: document.getElementById('eObjectif').value,
    contenu,
    visibilite: visEl?.value || 'equipe',
    serafinphType: document.getElementById('eSerafinph')?.value || '',
    updatedAt: new Date().toISOString()
  };

  const id = document.getElementById('entryId').value;
  try {
    if (id) {
      const e = _journalCache.find(x => x.id === id);
      if (!e) return;
      // Conserver l'auteur d'origine ; tracer la modification + historiser le contenu
      const history = (e.editHistory || []).concat([{ at: new Date().toISOString(), by: userName, byId: session?.userId, contenu: e.contenu }]);
      await sbSaveJournalEntry({ ...e, ...data, editHistory: history, editedBy: userName, editedById: session?.userId, editedAt: new Date().toISOString() });
      if (typeof auditLog === 'function') auditLog('journal_edit', `Entrée modifiée — ${data.resident}`);
      toast('Entrée mise à jour');
    } else {
      const dup = findJournalDuplicate({ residentId, contenu, date: data.date }, _journalCache);
      if (dup) {
        const e = dup.entry;
        const extrait = (e.contenu || '').slice(0, 140) + ((e.contenu || '').length > 140 ? '…' : '');
        if (!confirm(`⚠️ Doublon possible pour ${e.resident || 'ce résident'} :\n\n« ${extrait} »\n${formatDateTime(e.date)} · ${getJournalAuthor ? getJournalAuthor(e) : (e.author || '')}\n\nEnregistrer quand même cette transmission ?`)) return;
      }
      data.author = userName;
      data.authorId = session?.userId;
      data.replies = [];
      data.readBy = [session?.userId];
      data.createdAt = new Date().toISOString();
      await sbSaveJournalEntry(data);
      toast('Entrée ajoutée');
    }
  } catch (e) {
    toast('Erreur lors de l\'enregistrement', 'error');
    console.error(e);
    return;
  }
  await loadJournalEntries();
  closeAllModals();
  resetEntryForm();
  showJournalList();
  if (id) { selectedEntryId = id; }
  renderEntries();
}

function deleteEntry() { deleteEntryById(document.getElementById('entryId').value); }

function deleteEntryById(id) {
  confirmDialog('Supprimer cette entrée ?', async () => {
    const removed = _journalCache.find(e => e.id === id);
    try {
      await sbDeleteJournalEntry(id);
    } catch (e) {
      toast('Erreur lors de la suppression', 'error');
      console.error(e);
      return;
    }
    await loadJournalEntries();
    if (typeof auditLog === 'function') auditLog('journal_delete', `Entrée supprimée — ${removed?.resident || ''} (${formatDateTime(removed?.date)})`);
    closeAllModals();
    selectedEntryId = null;
    showJournalList();
    renderEntries();
    toast('Entrée supprimée', 'info');
  });
}

function resetEntryForm() {
  document.getElementById('entryId').value = '';
  document.getElementById('modalEntryTitle').textContent = 'Nouvelle entrée';
  document.getElementById('eResident').value = '';
  Array.from(document.getElementById('eCategorie').options).forEach(o => o.selected = false);
  document.getElementById('eDate').value = new Date().toISOString().slice(0,16);
  document.getElementById('eObjectif').value = '';
  document.getElementById('eContenu').value = '';
  document.querySelector('input[name="eVisibilite"][value="equipe"]').checked = true;
  document.getElementById('btnDeleteEntry').style.display = 'none';
}

async function initJournal() {
  if (!requireModule('access_journal')) return;
  document.getElementById('eDate').value = new Date().toISOString().slice(0,16);
  _journalResidentsCache = await sbGetResidents();
  await loadJournalEntries();
  populateSelects();
  renderEntries();
  ['jSearch','jFilterResident','jFilterCat','jFilterDate','jFilterDateEnd'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', renderEntries);
    document.getElementById(id)?.addEventListener('change', renderEntries);
  });
}
document.addEventListener('DOMContentLoaded', initJournal);
if (typeof registerPageInit === 'function') registerPageInit('journal', initJournal);

// ── AI Assist Journal ──
async function aiAssistJournal(action) {
  const ta = document.getElementById('eContenu');
  if (!ta) return;
  const current = ta.value || '';
  const residentId = document.getElementById('eResident')?.value || '';
  const residents = _journalResidentsCache;
  const resident = residents.find(r => r.id === residentId);
  const residentName = resident ? `${resident.prenom||''} ${resident.nom||''}`.trim() : '';
  const hasKey = !!getAiKey();
  const labels = { redaction: 'Rédaction', correction: 'Correction', reformulation: 'Reformulation' };

  if (hasKey) {
    const customSystem = getAiPrompt('journal', action);
    let system = '';
    let prompt = '';
    if (action === 'redaction') {
      system = customSystem || 'Tu es un éducateur spécialisé rédigeant une observation pour le journal de bord d\'un établissement médico-social. Écris en français, de manière professionnelle et factuelle.';
      prompt = `Rédige une courte observation de journal de bord${residentName ? ' pour le résident ' + residentName : ''}. Décris une journée type, une intervention éducative ou un fait notable.` + (current ? '\n\nTexte existant à compléter :\n' + current : '');
    } else if (action === 'correction') {
      if (!current) { toast('Écrivez d\'abord un texte', 'error'); return; }
      system = customSystem || 'Tu es un correcteur professionnel. Corrige les fautes d\'orthographe, de grammaire et de syntaxe sans changer le style.';
      prompt = 'Corrige ce texte de journal de bord :\n\n' + current;
    } else if (action === 'reformulation') {
      if (!current) { toast('Écrivez d\'abord un texte', 'error'); return; }
      system = customSystem || 'Tu es un rédacteur institutionnel. Reformule ce texte de manière professionnelle.';
      prompt = 'Reformule ce texte de manière professionnelle et institutionnelle :\n\n' + current;
    }
    const result = await callMistral(prompt, system);
    if (result) {
      ta.value = result;
      ta.dispatchEvent(new Event('input'));
      toast('✓ ' + labels[action] + ' (Mistral AI)', 'success');
      return;
    }
    toast('API Mistral indisponible, mode local', 'warning');
  }

  // Fallback local
  let result = '';
  if (action === 'redaction') {
    const templates = [
      `Observation éducative du jour : le résident a participé aux activités proposées avec un intérêt marqué pour les ateliers créatifs.`,
      `Suivi quotidien : bonne intégration au sein du groupe, interactions sociales positives avec les pairs.`,
      `Point d'étape : le résident fait preuve d'autonomie dans les gestes du quotidien, à encourager dans la continuité.`
    ];
    result = current ? current + '\n\n' + templates[Math.floor(Math.random() * templates.length)] : templates[Math.floor(Math.random() * templates.length)];
  } else if (action === 'correction') {
    if (!current) { toast('Écrivez d\'abord un texte', 'error'); return; }
    result = current
      .replace(/\bils on\b/g, 'ils ont')
      .replace(/\belle on\b/g, 'elle a')
      .replace(/\bje suis allé\b/g, 'je me suis rendu')
      .replace(/\bil a étais\b/g, 'il a été')
      .replace(/\bau jour d'aujourd'hui\b/g, 'actuellement');
  } else if (action === 'reformulation') {
    if (!current) { toast('Écrivez d\'abord un texte', 'error'); return; }
    result = current
      .replace(/\bgère\b/g, 'assure la gestion de')
      .replace(/\ba besoin de\b/g, 'nécessite')
      .replace(/\bveut\b/g, 'souhaite')
      .replace(/\bpeut\b/g, 'est en mesure de')
      .replace(/\bfait\b/g, 'réalise')
      .replace(/\bva\b/g, 'envisage de');
  }

  if (result) {
    ta.value = result;
    ta.dispatchEvent(new Event('input'));
    toast('✓ ' + labels[action] + ' (mode local)', 'success');
  }
}

// ── EXPORT PDF ──
function exportJournalPDF() {
  const list = getEntries();
  if (!list.length) { toast('Aucune entrée à exporter', 'error'); return; }

  const settings = DB.get(DB.keys.settings) || {};
  const cats = DB.get(DB.keys.categories) || [];
  const session = Auth.getSession();

  const dateFilter = document.getElementById('jFilterDate')?.value || '';
  const dateFilterEnd = document.getElementById('jFilterDateEnd')?.value || '';
  const resFilter  = document.getElementById('jFilterResident')?.value || '';
  const catFilter  = document.getElementById('jFilterCat')?.value || '';

  let periodLabel;
  if (dateFilter && dateFilterEnd) periodLabel = `du ${new Date(dateFilter).toLocaleDateString('fr-FR')} au ${new Date(dateFilterEnd).toLocaleDateString('fr-FR')}`;
  else if (dateFilter) periodLabel = `depuis le ${new Date(dateFilter).toLocaleDateString('fr-FR')}`;
  else if (dateFilterEnd) periodLabel = `jusqu'au ${new Date(dateFilterEnd).toLocaleDateString('fr-FR')}`;
  else periodLabel = `au ${new Date().toLocaleDateString('fr-FR')}`;

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Journal de bord — ${escHtml(settings.etablissement||'FTR')}</title>
<style>
  @page{margin:1.8cm 1.5cm}
  body{font-family:'Inter','Segoe UI',system-ui,sans-serif;font-size:9.5pt;line-height:1.6;color:#334155;max-width:800px;margin:0 auto}
  .top-stripe{height:6px;background:#0f2b4a;border-radius:0 0 4px 4px;margin-bottom:.5cm}
  .doc-header{margin-bottom:.7cm}
  .doc-header .etab{font-size:11pt;font-weight:300;color:#0f2b4a}
  .doc-header .etab strong{font-weight:700}
  .doc-header .doc-title{font-size:15pt;font-weight:800;color:#0f2b4a;margin-top:.05cm}
  .doc-header .doc-meta{font-size:7.5pt;color:#64748b;margin-top:.1cm}
  .day-group{margin-bottom:.5cm}
  .day-label{font-size:8pt;font-weight:700;color:#0f2b4a;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #0f2b4a;padding-bottom:2px;margin-bottom:.25cm}
  .entry{border:1px solid #e2e8f0;border-radius:7px;padding:.4cm .5cm;margin-bottom:.25cm;page-break-inside:avoid}
  .entry-top{display:flex;align-items:flex-start;justify-content:space-between;gap:.3cm;margin-bottom:.2cm}
  .entry-resident{font-weight:700;font-size:9.5pt;color:#0f2b4a}
  .entry-meta{font-size:7pt;color:#64748b;margin-top:1px}
  .entry-cat{display:inline-block;padding:1px 7px;border-radius:100px;font-size:7pt;font-weight:600}
  .entry-body{font-size:8.5pt;color:#334155;line-height:1.6;white-space:pre-wrap}
  .entry-replies{margin-top:.2cm;padding-top:.2cm;border-top:1px solid #f1f5f9}
  .reply{font-size:7.5pt;color:#64748b;padding:.15cm .3cm;background:#f8fafc;border-radius:5px;margin-bottom:.1cm}
  .reply strong{color:#475569}
  .badge-conf{display:inline-block;padding:1px 7px;border-radius:100px;font-size:7pt;font-weight:600;background:#fef2f2;color:#dc2626}
  .footer{margin-top:.8cm;padding-top:.3cm;border-top:1px solid #e2e8f0;text-align:center;font-size:7pt;color:#94a3b8}
  .actions{text-align:center;margin:.4cm 0}
  .actions button{padding:.35rem 1.1rem;border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc;cursor:pointer;font-size:9pt;margin:.2rem}
  @media print{.actions{display:none}}
</style></head><body>
<div class="top-stripe"></div>
<div class="doc-header">
  <div class="etab"><strong>${escHtml(settings.etablissement||'Foyer d\'Hébergement')}</strong></div>
  <div class="doc-title">Journal de bord</div>
  <div class="doc-meta">
    Export ${periodLabel} · ${list.length} entrée${list.length>1?'s':''} · Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
    ${session ? ` · par ${escHtml([session.prenom,session.nom].filter(Boolean).join(' ')||session.username)}` : ''}
  </div>
</div>
<div class="actions">
  <button onclick="window.print()">🖨 Imprimer / Enregistrer en PDF</button>
  <button onclick="window.close()">Fermer</button>
</div>
${(() => {
  // Grouper par date
  const groups = {};
  list.forEach(e => {
    const d = e.date ? e.date.slice(0,10) : 'Sans date';
    if (!groups[d]) groups[d] = [];
    groups[d].push(e);
  });
  return Object.entries(groups).map(([date, entries]) => {
    const label = date === 'Sans date' ? 'Sans date' :
      new Date(date+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    return `<div class="day-group">
      <div class="day-label">${escHtml(label)}</div>
      ${entries.map(e => {
        const entryCats = (e.categorie || '').split(',').filter(Boolean).map(id => cats.find(c => String(c.id) === String(id))).filter(Boolean);
        const timeStr = e.date && e.date.length > 10 ? new Date(e.date).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '';
        return `<div class="entry">
          <div class="entry-top">
            <div>
              <div class="entry-resident">${escHtml(e.resident||'—')}</div>
              <div class="entry-meta">${timeStr ? timeStr+' · ' : ''}${escHtml(e.author||'')}</div>
            </div>
            <div style="display:flex;gap:.2cm;flex-shrink:0;align-items:center">
              ${entryCats.map(cat => `<span class="entry-cat" style="background:${cat.color}22;color:${cat.color}">${escHtml(cat.name)}</span>`).join('')}
              ${e.visibilite==='confidentiel' ? '<span class="badge-conf">Confidentiel</span>' : ''}
            </div>
          </div>
          <div class="entry-body">${escHtml(e.contenu||'')}</div>
          ${(e.replies||[]).length ? `<div class="entry-replies">${e.replies.map(r=>`<div class="reply"><strong>${escHtml(r.author)}</strong> · ${new Date(r.createdAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})} — ${escHtml(r.content)}</div>`).join('')}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
})()}
<div class="footer">${escHtml(settings.etablissement||'Foyer d\'Hébergement')} — Journal de bord — ${new Date().toLocaleDateString('fr-FR')}</div>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}
