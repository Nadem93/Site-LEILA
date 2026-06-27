// ── DATA ── (source = Supabase, caches dans messages-supabase.js)
function getMessages() { return _msgCache; }
function getUsers() { return DB.get(DB.keys.users) || []; }

let currentConvId = null;
let composeSelected = [];
let composeTargetConv = null;

// ── HELPERS ──
function convId(userIds) {
  return [...userIds].sort().join('_');
}

function getOrCreateConv(userIds) {
  const id = convId(userIds);
  if (!_convCache[id]) {
    const conv = { id, userIds: [...new Set(userIds.map(String))], createdAt: new Date().toISOString() };
    _convCache[id] = conv;
    sbSaveConversation(conv).catch(e => { console.error('[conv]', e); toast('Erreur conversation', 'error'); });
  }
  return id;
}

function getConvParticipants(convId) {
  return _convCache[convId]?.userIds || [];
}

function getConvMessages(convId) {
  return (getMessages().filter(m => m.convId === convId) || []).sort((a,b) => new Date(a.date) - new Date(b.date));
}

// ── RENDER CONVERSATION LIST ──
function renderConvs() {
  const session = Auth.getSession();
  if (!session) return;
  const allMsgs = getMessages();
  const convs = _convCache;
  const q = (document.getElementById('convSearch')?.value || '').trim().toLowerCase();
  const users = getUsers();
  const myUserId = String(session.userId);

  const userConvMap = {};
  const groupConvs = [];

  Object.values(convs).forEach(c => {
    const ids = c.userIds.map(String);
    if (!ids.includes(myUserId)) return;
    if (ids.length === 2) {
      const otherId = ids.find(id => id !== myUserId);
      if (otherId) userConvMap[otherId] = c;
    } else {
      groupConvs.push(c);
    }
  });

  function convToHtml(conv) {
    const msgs = allMsgs.filter(m => m.convId === conv.id).sort((a,b) => new Date(b.date) - new Date(a.date));
    const lastMsg = msgs[0];
    const unread = msgs.some(m => m.from !== session.userId && !m.readBy?.includes(session.userId));
    const unreadCount = msgs.filter(m => m.from !== session.userId && !m.readBy?.includes(session.userId)).length;
    const otherIds = conv.userIds.filter(id => String(id) !== String(session.userId));

    let name, avatar, color;
    if (otherIds.length === 0) {
      name = 'Moi seul';
      avatar = '#';
      color = '#8e8e93';
    } else if (otherIds.length === 1) {
      const u = users.find(x => String(x.id) === String(otherIds[0]));
      name = u ? `${u.prenom||''} ${u.nom||''}`.trim() || u.username : 'Inconnu';
      avatar = ((u?.prenom||'')[0]||'') + ((u?.nom||'')[0]||'') || '?';
      color = '#007aff';
    } else {
      const names = otherIds.map(id => {
        const u = users.find(x => String(x.id) === String(id));
        return u ? `${u.prenom||''} ${u.nom||''}`.trim() || u.username : 'Inconnu';
      });
      name = names.length > 2 ? `Groupe (${names.length})` : names.join(', ');
      avatar = '#';
      color = '#f59e0b';
    }

    if (q && !name.toLowerCase().includes(q)) return '';

    const time = lastMsg ? formatConvTime(new Date(lastMsg.date)) : '';
    const preview = lastMsg ? (lastMsg.body||'') : '';

    const isActive = currentConvId === conv.id;
    const showOnline = otherIds.length === 1;
    return `<div class="chat-conv${isActive?' active':''}" onclick="selectConv('${conv.id}')">
      <div class="chat-conv-av-wrap">
        <div class="chat-conv-avatar" style="background:${color}">${avatar}</div>
        ${showOnline ? '<div class="chat-conv-online"></div>' : ''}
      </div>
      <div class="chat-conv-info">
        <div class="chat-conv-name">${escHtml(name)}</div>
        <div class="chat-conv-preview">${escHtml(preview)}</div>
      </div>
      <div class="chat-conv-meta">
        <div class="chat-conv-time">${time}</div>
        ${unreadCount > 0 ? `<div class="chat-conv-badge">${unreadCount}</div>` : `<div class="chat-conv-pin">📌</div>`}
      </div>
      <button class="chat-conv-del" onclick="event.stopPropagation();deleteConv('${conv.id}')" title="Supprimer"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
    </div>`;
  }

  let groupHtml = '';
  groupConvs.map(convToHtml).filter(Boolean).forEach(h => groupHtml += h);

  let recentHtml = '';
  users.forEach(u => {
    const uid = String(u.id);
    if (uid === myUserId) return;
    const prenom = u.prenom || '';
    const nom = u.nom || '';
    const name = `${prenom} ${nom}`.trim() || u.username;
    if (q && !name.toLowerCase().includes(q)) return;
    const initials = (prenom[0]||'') + (nom[0]||'') || '?';

    const conv = userConvMap[uid];
    if (conv) {
      recentHtml += convToHtml(conv);
    } else {
      recentHtml += `<div class="chat-conv" onclick="openUserChat('${uid}')">
        <div class="chat-conv-av-wrap">
          <div class="chat-conv-avatar" style="background:#5b5fc7">${initials}</div>
        </div>
        <div class="chat-conv-info">
          <div class="chat-conv-name">${escHtml(name)}</div>
          <div class="chat-conv-preview">${escHtml(u.fonction || 'Cliquez pour discuter')}</div>
        </div>
        <div class="chat-conv-meta"></div>
      </div>`;
    }
  });

  let html = '';
  if (groupHtml) html += `<div class="ml-section"><span class="ml-section-label">Épinglés</span><span class="ml-section-chevron">^</span></div>` + groupHtml;
  if (recentHtml) html += `<div class="ml-section"><span class="ml-section-label">Récents</span><span class="ml-section-chevron">^</span></div>` + recentHtml;

  if (!html) {
    html = `<div style="padding:2rem;text-align:center;color:var(--muted);font-size:.85rem">
      <p style="margin:0">${q ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur'}</p>
    </div>`;
  }
  document.getElementById('chatConvs').innerHTML = html;
  const mcEl = document.getElementById('memberCount');
  if (mcEl) {
    const total = getUsers().filter(u => String(u.id) !== String(session.userId)).length;
    mcEl.textContent = `(${total})`;
  }
}

function openUserChat(userId) {
  const session = Auth.getSession();
  if (!session) return;
  const convId = getOrCreateConv([session.userId, userId]);
  selectConv(convId);
}

// ── SELECT CONVERSATION ──
function selectConv(id) {
  currentConvId = id;
  closeCompose();
  renderConvs();
  renderChat();
}

// ── COMPOSE ──
function openCompose(convId) {
  composeSelected = [];
  composeTargetConv = convId || null;
  const overlay = document.getElementById('composeOverlay');
  const title = document.querySelector('#composeOverlay h3');
  const btn = document.getElementById('composeStartBtn');
  if (convId) {
    title.textContent = 'Ajouter des participants';
    btn.textContent = 'Ajouter';
  } else {
    title.textContent = 'Nouveau message';
    btn.textContent = 'Démarrer';
  }
  overlay.style.display = 'flex';
  document.getElementById('composeBackdrop').style.display = 'block';
  document.getElementById('composeSearch').value = '';
  renderComposeUsers();
  setTimeout(() => document.getElementById('composeSearch')?.focus(), 100);
}

function closeCompose() {
  document.getElementById('composeOverlay').style.display = 'none';
  document.getElementById('composeBackdrop').style.display = 'none';
  composeTargetConv = null;
}

function renderComposeUsers() {
  const session = Auth.getSession();
  let users = getUsers().filter(u => String(u.id) !== String(session.userId));
  // If adding to existing conversation, exclude current participants
  if (composeTargetConv) {
    const existing = getConvParticipants(composeTargetConv).map(String);
    users = users.filter(u => !existing.includes(String(u.id)));
  }
  const q = (document.getElementById('composeSearch')?.value || '').trim().toLowerCase();

  const filtered = q
    ? users.filter(u => {
        const name = `${u.prenom||''} ${u.nom||''}`.toLowerCase();
        return name.includes(q) || (u.username||'').toLowerCase().includes(q) || (u.fonction||'').toLowerCase().includes(q);
      })
    : users;

  const title = document.querySelector('#composeOverlay h3');
  if (!composeTargetConv) {
    title.textContent = composeSelected.length > 1 ? `Nouveau groupe (${composeSelected.length})` : 'Nouveau message';
  }

  let html = filtered.map(u => {
    const sel = composeSelected.includes(String(u.id));
    const initials = ((u.prenom||'')[0]||'') + ((u.nom||'')[0]||'');
    const name = `${u.prenom||''} ${u.nom||''}`.trim() || u.username;
    const role = u.fonction || (u.role==='admin' ? 'Administrateur' : 'Utilisateur');
    return `<div class="chat-overlay-user" onclick="toggleComposeUser('${u.id}')">
      <div class="ck ${sel?'checked':''}"></div>
      <div class="avatar" style="background:${u.role==='admin'?'#5856d6':'#007aff'}">${initials||'?'}</div>
      <div class="chat-overlay-user-info">
        <div class="chat-overlay-user-name">${escHtml(name)}</div>
        <div class="chat-overlay-user-role">${escHtml(role)}</div>
      </div>
    </div>`;
  }).join('');

  if (!html) {
    html = `<div style="padding:2rem;text-align:center;color:var(--muted);font-size:.85rem"><p style="margin:0">${q ? 'Aucun utilisateur trouvé' : 'Aucun autre utilisateur'}</p></div>`;
  }
  document.getElementById('composeList').innerHTML = html;
  document.getElementById('composeStartBtn').disabled = composeSelected.length === 0;
}

function toggleComposeUser(id) {
  id = String(id);
  const idx = composeSelected.indexOf(id);
  if (idx >= 0) {
    composeSelected.splice(idx, 1);
  } else {
    composeSelected.push(id);
  }
  renderComposeUsers();
}

async function startComposeConv() {
  if (!composeSelected.length) return;
  const session = Auth.getSession();
  if (composeTargetConv) {
    await addUsersToConv(composeTargetConv, composeSelected);
    closeCompose();
    renderConvs();
    renderChat();
    return;
  }
  const allIds = [String(session.userId), ...composeSelected];
  currentConvId = getOrCreateConv(allIds);
  closeCompose();
  renderConvs();
  renderChat();
  document.getElementById('chatInput').focus();
}

async function addUsersToConv(targetConvId, newUserIds) {
  const conv = _convCache[targetConvId];
  if (!conv) return;
  const oldUserIds = conv.userIds.map(String);
  const allIds = [...new Set([...oldUserIds, ...newUserIds.map(String)])];
  const newConvId = convId(allIds);
  if (newConvId === targetConvId) return; // no change
  try {
    const newConv = { id: newConvId, userIds: allIds, createdAt: conv.createdAt };
    _convCache[newConvId] = newConv;
    await sbSaveConversation(newConv);
    // Réaffecte les messages de l'ancienne conversation à la nouvelle
    const toMove = _msgCache.filter(m => m.convId === targetConvId);
    for (const m of toMove) { await sbUpdateMessageConv(m.id, newConvId); m.convId = newConvId; }
    delete _convCache[targetConvId];
    await sbDeleteConversation(targetConvId);
  } catch (e) { console.error('[addUsersToConv]', e); toast('Erreur : ' + (e?.message || e), 'error'); return; }
  currentConvId = newConvId;
  toast('Participant ajouté');
}

// ── RENDER CHAT ──
function renderChat() {
  const session = Auth.getSession();
  const msgsEl = document.getElementById('chatMsgs');
  const headerEl = document.getElementById('chatMainHeader');
  const headerAvatar = document.getElementById('chatMainAvatar');
  const headerName = document.getElementById('chatMainName');
  const headerStatus = document.getElementById('chatMainStatus');
  const inputBar = document.getElementById('chatInputBar');

  if (!currentConvId) {
    headerEl.style.display = 'none';
    const addBtn = document.getElementById('addParticipantBtn');
    if (addBtn) addBtn.style.display = 'none';
    document.getElementById('chatInput').disabled = true;
    document.getElementById('sendBtn').disabled = true;
    msgsEl.innerHTML = `<div class="chat-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <p>Messages</p>
    </div>`;
    updateConvCount();
    updateChips();
    return;
  }

  headerEl.style.display = 'flex';
  document.getElementById('chatInput').disabled = false;
  document.getElementById('sendBtn').disabled = false;

  const participants = getConvParticipants(currentConvId);
  const otherIds = participants.filter(id => String(id) !== String(session.userId));
  // Show add-participant button
  const addBtn = document.getElementById('addParticipantBtn');
  if (addBtn) addBtn.style.display = '';
  const users = getUsers();

  let name, avatar, color, status;
  if (otherIds.length === 0) {
    name = 'Moi seul';
    avatar = '#';
    color = '#8e8e93';
    status = 'Notes personnelles';
  } else if (otherIds.length === 1) {
    const u = users.find(x => String(x.id) === String(otherIds[0]));
    name = u ? `${u.prenom||''} ${u.nom||''}`.trim() || u.username : 'Inconnu';
    avatar = ((u?.prenom||'')[0]||'') + ((u?.nom||'')[0]||'') || '?';
    color = '#007aff';
    status = u?.fonction || (u?.role==='admin' ? 'Administrateur' : '');
  } else {
    const names = otherIds.map(id => {
      const u = users.find(x => String(x.id) === String(id));
      return u ? `${u.prenom||''} ${u.nom||''}`.trim() || u.username : 'Inconnu';
    });
    name = names.length > 2 ? `Groupe (${names.length})` : names.join(', ');
    avatar = '#';
    color = '#f59e0b';
    status = `${otherIds.length} participants`;
  }

  headerAvatar.style.background = color;
  headerAvatar.textContent = avatar;
  headerName.textContent = name;
  headerStatus.textContent = status;

  const allMsgs = getMessages();
  const msgs = allMsgs.filter(m => m.convId === currentConvId).sort((a,b) => new Date(a.date) - new Date(b.date));
  if (!msgs.length) {
    msgsEl.innerHTML = `<div class="chat-empty"><p style="color:var(--muted)">Aucun message</p></div>`;
    updateConvCount();
    updateChips();
    return;
  }

  const todayStr = new Date().toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit', year:'numeric'});
  const myUser = users.find(x => String(x.id) === String(session.userId));
  const myInitials = ((myUser?.prenom||'')[0]||'') + ((myUser?.nom||'')[0]||'') || 'M';
  const myName = myUser ? `${myUser.prenom||''} ${myUser.nom||''}`.trim() || myUser.username || 'Moi' : 'Moi';

  let curDateGroup = '';
  let html = '';
  const _newlyRead = [];
  for (const m of msgs) {
    const msgDate = new Date(m.date).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
    if (msgDate !== curDateGroup) {
      curDateGroup = msgDate;
      const dateLabel = msgDate === todayStr ? "Aujourd'hui" : msgDate;
      html += `<div class="chat-date-sep"><span>${dateLabel}</span></div>`;
    }
    const isOwn = String(m.from) === String(session.userId);
    const author = users.find(u => String(u.id) === String(m.from));
    const authorName = author ? `${author.prenom||''} ${author.nom||''}`.trim() || author.username : 'Inconnu';
    const time = new Date(m.date).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });

    const readerAvatars = '';

    const isUnread = !isOwn && !m.readBy?.includes(session.userId);

    const av = isOwn ? myInitials : (((author?.prenom||'')[0]||'') + ((author?.nom||'')[0]||'') || '?');
    const avColor = isOwn ? '#6366f1' : '#5b5fc7';
    const dispName = isOwn ? myName : authorName;
    const timeLabel = new Date(m.date).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
    html += `<div class="chat-row ${isOwn?'own':'other'}">
      <div class="chat-msg-av" style="background:${avColor}">${av}</div>
      <div class="chat-msg-content">
        <div class="chat-msg-meta">
          <span class="chat-msg-author">${escHtml(dispName)}</span>
          <span class="chat-msg-time">${timeLabel}</span>
        </div>
        <div class="chat-bubble${isUnread?' unread-bubble':''}">
          ${isUnread ? '<span class="act-new">Nouveau</span>' : ''}${escHtml(m.body)}
        </div>
        ${readerAvatars}
      </div>
    </div>`;

    if (isUnread) {
      if (!m.readBy) m.readBy = [];
      m.readBy.push(session.userId);
      _newlyRead.push(m);
    }
  }
  // Persiste uniquement les messages qui viennent d'être lus (pas à chaque rendu)
  _newlyRead.forEach(m => sbUpdateMessageReadBy(m.id, m.readBy).catch(() => {}));
  renderConvs();
  msgsEl.innerHTML = html;
  msgsEl.scrollTop = msgsEl.scrollHeight;
  updateChips();
  // Store unread count for accueil
  const sessionId = session?.userId;
  const allM = getMessages();
  const unreadTotal = allM.filter(m => String(m.from) !== String(sessionId) && !(m.readBy || []).map(String).includes(String(sessionId))).length;
  localStorage.setItem('ftr_notif_msg_unread_' + sessionId, unreadTotal);
  updateConvCount();
}

function updateConvCount() {
  const session = Auth.getSession();
  const allMsgs = getMessages();
  const unread = allMsgs.filter(m => m.from !== session.userId && !m.readBy?.includes(session.userId)).length;
  document.getElementById('convCount').textContent = unread ? `${unread} non lu${unread>1?'s':''}` : '';
  localStorage.setItem('ftr_notif_msg_unread_' + session.userId, unread);
  // Mise à jour compteur onglet
  const convMsgs = currentConvId ? getConvMessages(currentConvId) : [];
  const ctEl = document.getElementById('tabAllCt');
  if (ctEl) ctEl.textContent = convMsgs.length || 0;
}

function updateChips() {
  const chipsEl = document.getElementById('actChips');
  if (!chipsEl) return;
  if (!currentConvId) { chipsEl.innerHTML = ''; return; }
  const session = Auth.getSession();
  const participants = getConvParticipants(currentConvId).filter(id => String(id) !== String(session.userId));
  const users = getUsers();
  chipsEl.innerHTML = participants.map(id => {
    const u = users.find(x => String(x.id) === String(id));
    const name = u ? `${u.prenom||''} ${u.nom||''}`.trim() || u.username : 'Inconnu';
    return `<div class="act-chip">${escHtml(name)} <span class="act-chip-x">×</span></div>`;
  }).join('');
}

async function sendChatMsg() {
  const session = Auth.getSession();
  if (!currentConvId || !session) return;
  const input = document.getElementById('chatInput');
  const body = input.value.trim();
  if (!body) return;

  try {
    const saved = await sbSaveMessage({
      convId: currentConvId, from: session.userId, body,
      date: new Date().toISOString(), readBy: [session.userId]
    });
    _msgCache.push(saved);
  } catch (e) { console.error('[sendChatMsg]', e); toast('Erreur envoi : ' + (e?.message || e), 'error'); return; }
  input.value = '';
  renderChat();
  renderConvs();
}

function deleteConv(cid) {
  if (!confirm('Supprimer cette conversation et tous ses messages ?')) return;
  (async () => {
    try {
      await sbDeleteMessagesByConv(cid);
      await sbDeleteConversation(cid);
      delete _convCache[cid];
      _msgCache = _msgCache.filter(m => m.convId !== cid);
    } catch (e) { console.error('[deleteConv]', e); toast('Erreur suppression : ' + (e?.message || e), 'error'); return; }
    if (currentConvId === cid) { currentConvId = null; renderChat(); }
    renderConvs();
    toast('Conversation supprimée', 'info');
  })();
}

function formatConvTime(date) {
  const now = new Date();
  const d = new Date(date);
  const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  }
  if (diff < 172800000) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' });
}

// ── AI Assist Message ──
async function aiAssistMessage(action) {
  const input = document.getElementById('chatInput');
  if (!input || input.disabled) return;
  const current = input.value || '';
  const hasKey = !!getAiKey();
  const labels = { redaction: 'Rédaction', correction: 'Correction', reformulation: 'Reformulation' };

  if (hasKey) {
    const customSystem = getAiPrompt('messages', action);
    let system = '';
    let prompt = '';
    if (action === 'redaction') {
      system = customSystem || 'Tu es un professionnel en ESMS qui rédige un message interne court et professionnel. Réponds en français.';
      prompt = 'Rédige un message professionnel court pour communiquer avec un collègue en ESMS.' + (current ? '\n\nComplète ce message :\n' + current : '');
    } else if (action === 'correction') {
      if (!current) { toast('Écrivez d\'abord un texte', 'error'); return; }
      system = customSystem || 'Tu es un correcteur professionnel. Corrige les fautes sans changer le style.';
      prompt = 'Corrige ce message :\n\n' + current;
    } else if (action === 'reformulation') {
      if (!current) { toast('Écrivez d\'abord un texte', 'error'); return; }
      system = customSystem || 'Tu es un rédacteur institutionnel. Reformule ce message de manière professionnelle.';
      prompt = 'Reformule ce message de manière professionnelle :\n\n' + current;
    }
    const result = await callMistral(prompt, system);
    if (result) {
      input.value = result;
      autoResizeTextarea(input);
      toast('✓ ' + labels[action] + ' (Mistral AI)', 'success');
      return;
    }
    toast('API Mistral indisponible, mode local', 'warning');
  }

  // Fallback local
  let result = '';
  if (action === 'redaction') {
    const templates = [
      'Bonjour, je vous confirme le rendez-vous de demain après-midi.',
      'Pour information, l\'atelier de jeudi est maintenu.',
      'Suite à notre échange, voici les points à retenir pour la réunion de demain.'
    ];
    result = current ? current + '\n\n' + templates[Math.floor(Math.random() * templates.length)] : templates[Math.floor(Math.random() * templates.length)];
  } else if (action === 'correction') {
    if (!current) { toast('Écrivez d\'abord un texte', 'error'); return; }
    result = current.replace(/\bils on\b/g, 'ils ont').replace(/\belle on\b/g, 'elle a').replace(/\bau jour d\'aujourd\'hui\b/g, 'actuellement');
  } else if (action === 'reformulation') {
    if (!current) { toast('Écrivez d\'abord un texte', 'error'); return; }
    result = current.replace(/\bveut\b/g, 'souhaite').replace(/\bpeut\b/g, 'est en mesure de').replace(/\bva\b/g, 'envisage de');
  }

  if (result) {
    input.value = result;
    autoResizeTextarea(input);
    toast('✓ ' + labels[action] + ' (mode local)', 'success');
  }
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.max(36, el.scrollHeight) + 'px';
}

// ── INIT ──
async function initMessages() {
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('input', () => autoResizeTextarea(chatInput));
  }
  await loadMessagesData();
  renderConvs();
  renderChat();
}
document.addEventListener('DOMContentLoaded', initMessages);
if (typeof registerPageInit === 'function') registerPageInit('messages', initMessages);
