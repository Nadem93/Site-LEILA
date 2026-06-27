# Edge Function `create-user`

Crée un vrai compte de connexion (Auth + ligne `profiles`) pour un salarié,
appelée depuis le bouton **« 🔑 Créer un compte »** de la page Utilisateurs.

La clé `service_role` reste **uniquement côté serveur** (ici), jamais dans le navigateur.
L'appel n'aboutit que si l'appelant est **administrateur**.

## Déploiement

### Option A — CLI Supabase (recommandé)

```bash
# 1. (une seule fois) se connecter et lier le projet
supabase login
supabase link --project-ref udgnbqxabsgcnrtuemca

# 2. déployer la fonction
supabase functions deploy create-user
```

### Option B — Dashboard Supabase

1. Dashboard → **Edge Functions** → **Create a new function**
2. Nom : `create-user`
3. Coller le contenu de `index.ts`
4. **Deploy**

## Notes

- **Aucun secret à régler** : `SUPABASE_URL`, `SUPABASE_ANON_KEY` et
  `SUPABASE_SERVICE_ROLE_KEY` sont injectés automatiquement par Supabase.
- La vérification JWT par défaut reste activée : le navigateur envoie
  automatiquement la session de l'admin connecté (`functions.invoke`).
- La table `profiles` doit avoir les colonnes : `id`, `prenom`, `nom`,
  `fonction`, `role`, `etablissement_id`. Si l'insertion du profil échoue,
  la fonction supprime le compte Auth créé (pas de compte orphelin) et
  renvoie le message d'erreur.
- Tant que la fonction n'est pas déployée, le bouton renverra une erreur
  « Edge Function » — c'est normal.
