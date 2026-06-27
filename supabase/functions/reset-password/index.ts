// ── Edge Function : reset-password ──
// Réinitialise le mot de passe d'un compte existant.
// La clé service_role reste côté serveur. Réservé aux administrateurs.

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON          = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 1) Identifier l'appelant
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return json({ ok: false, error: 'Non authentifié' });

    const callerClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser(token);
    if (callerErr || !caller) return json({ ok: false, error: 'Session invalide' });

    // 2) Vérifier que l'appelant est admin
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: callerProfile } = await admin
      .from('profiles').select('role, etablissement_id').eq('id', caller.id).single();
    if (!callerProfile || callerProfile.role !== 'admin') {
      return json({ ok: false, error: 'Accès réservé aux administrateurs' });
    }

    // 3) Lire le corps
    const { userId, password } = await req.json();
    if (!userId || !password) return json({ ok: false, error: 'userId et mot de passe requis' });
    if (String(password).length < 6) return json({ ok: false, error: 'Mot de passe : 6 caractères minimum' });

    // 4) Le compte cible doit appartenir au même établissement que l'admin
    const { data: targetProfile } = await admin
      .from('profiles').select('etablissement_id').eq('id', userId).single();
    if (!targetProfile || targetProfile.etablissement_id !== callerProfile.etablissement_id) {
      return json({ ok: false, error: 'Compte introuvable dans votre établissement' });
    }

    // 5) Mettre à jour le mot de passe + forcer un changement à la prochaine connexion
    //    (on préserve les métadonnées existantes comme prénom / nom)
    const { data: existing } = await admin.auth.admin.getUserById(userId);
    const meta = { ...(existing?.user?.user_metadata || {}), must_change_password: true };
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password, user_metadata: meta });
    if (updErr) return json({ ok: false, error: updErr.message });

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
