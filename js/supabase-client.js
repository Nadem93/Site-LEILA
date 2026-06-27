// ── CONNEXION SUPABASE ──
// Clé "publishable" (anon) : volontairement publique, protégée par les règles RLS
// côté base de données. Ne jamais mettre la clé "secret"/"service_role" ici.
const SUPABASE_URL = 'https://udgnbqxabsgcnrtuemca.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_kzmR2wc7ewYTYH0nYL2xbg_cBnMzlju';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
