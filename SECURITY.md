# Politique de sécurité — Atelier 2026

## Signaler une vulnérabilité

Si vous découvrez une vulnérabilité de sécurité, **ne pas ouvrir d'issue publique**.

Contacter directement : **lawrynnjennifer@gmail.com**

Inclure dans le rapport :
- Description de la vulnérabilité
- Étapes pour la reproduire
- Impact potentiel

Une réponse sera fournie sous 72 heures.

## Bonnes pratiques en production

- Les fichiers `.env` ne doivent jamais être commités
- Les tokens JWT expirent après 24h (`tokenVersion` permet la révocation immédiate)
- Les origines CORS sont restreintes via `ALLOWED_ORIGINS`
- Les connexions Supabase requièrent `sslmode=require`
- Les paiements utilisent une clé d'idempotence pour éviter les doubles enregistrements
