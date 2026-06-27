// ── COUCHE SUPABASE — MESSAGERIE (messages + conversations) ──
// sbGetEtablissementId() défini dans js/residents-supabase.js

let _msgCache = [];
let _convCache = {}; // objet indexé par convId
async function loadMessagesData() {
  _msgCache = await sbGetMessages();
  _convCache = await sbGetConversations();
}

// ── MESSAGES ──
function _msgToRow(m, etablissementId) {
  return {
    etablissement_id: etablissementId,
    conv_id:   m.convId || '',
    from_user: (m.from != null) ? String(m.from) : null,
    body:      m.body   || '',
    date:      m.date   || new Date().toISOString(),
    read_by:   (m.readBy || []).map(String)
  };
}
function _msgFromRow(r) {
  return {
    id:     r.id,
    convId: r.conv_id   || '',
    from:   r.from_user || '',
    body:   r.body      || '',
    date:   r.date,
    readBy: r.read_by   || []
  };
}

async function sbGetMessages() {
  const { data, error } = await supabaseClient
    .from('messages').select('*').order('date', { ascending: true });
  if (error) { console.error(error); toast('Erreur chargement messages', 'error'); return []; }
  return data.map(_msgFromRow);
}
async function sbSaveMessage(m) {
  const etablissementId = await sbGetEtablissementId();
  const { data, error } = await supabaseClient
    .from('messages').insert(_msgToRow(m, etablissementId)).select();
  if (error) throw error;
  return _msgFromRow(data[0]);
}
async function sbUpdateMessageReadBy(id, readBy) {
  const { error } = await supabaseClient
    .from('messages').update({ read_by: (readBy || []).map(String) }).eq('id', id);
  if (error) throw error;
}
async function sbUpdateMessageConv(id, convId) {
  const { error } = await supabaseClient
    .from('messages').update({ conv_id: convId }).eq('id', id);
  if (error) throw error;
}
async function sbDeleteMessagesByConv(convId) {
  const { error } = await supabaseClient.from('messages').delete().eq('conv_id', convId);
  if (error) throw error;
}

// ── CONVERSATIONS (indexées par convId, qui = userIds triés) ──
async function sbGetConversations() {
  const { data, error } = await supabaseClient.from('conversations').select('*');
  if (error) { console.error(error); toast('Erreur chargement conversations', 'error'); return {}; }
  const out = {};
  (data || []).forEach(r => { out[r.conv_id] = { id: r.conv_id, userIds: r.user_ids || [], createdAt: r.created_at }; });
  return out;
}
async function sbSaveConversation(conv) {
  const etablissementId = await sbGetEtablissementId();
  const { error } = await supabaseClient
    .from('conversations')
    .upsert({ etablissement_id: etablissementId, conv_id: conv.id, user_ids: conv.userIds || [] },
            { onConflict: 'conv_id' });
  if (error) throw error;
}
async function sbDeleteConversation(convId) {
  const { error } = await supabaseClient.from('conversations').delete().eq('conv_id', convId);
  if (error) throw error;
}
