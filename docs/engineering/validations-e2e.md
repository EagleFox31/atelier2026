# Validations de bout en bout déjà réalisées

Registre des parcours validés à la main ou par script contre la production (garage de test, NotchPay en sandbox), et de leur protection automatique. Un parcours « manuel seulement » est une dette : le convertir en test dès que possible.

| Date | Parcours | Où | Protection automatique |
|------|----------|----|------------------------|
| 2026-10-04 | Abonnement NotchPay : paiement sandbox → garage `ACTIVE` par réconciliation (webhooks non livrés) | Prod, garage de test | Jest `billing`/`subscription` (unit) ; **manuel** pour la sandbox |
| 2026-10-04 | Paiements `cancel` / `double` NotchPay | Prod, sandbox | Aucune (à rejouer, sandbox instable) |
| 2026-10-08 | `POST /subscription/payments/reconcile` expose `expired` (PENDING > 48 h → EXPIRED) | Prod | Jest du registre de paiement (#54) ; **manuel** pour l'API déployée |
| 2026-10-08 | Envoi SMS réel SMS.to vers un numéro vérifié (accepté, reçu, opérateur détecté) | Prod/local | `smsto-sms.provider.spec.ts` (HTTP simulé) ; **manuel** pour l'envoi réel |
| 2026-10-08 | Mot de passe oublié : demande → notification ADMIN → réinitialisation → changement imposé → connexion | Prod, garage jetable | **`src/__tests__/integration/password-reset.integration.spec.ts`** (Jest, CI) |
| continu | Parcours UI publics et connectés (UX/UI/CX) | Prod | `npm run test:qa` (`e2e-qa/`), `qa-ux.yml` quotidien |
| continu | Garde-fous UX avant merge | API simulée | `npm run test:ux` (`e2e-ux/`), `ux-guardrails.yml` |
| continu | Parcours métier (auth, OT, facturation, rôles) | Local | `npm run test:pw` (`e2e/`), Newman (`postman/`) |

## Notes

- Garage de test prod : identifiants uniquement dans `~/.atelier-qa/test-garage.env` (jamais dans le dépôt). L'API de connexion attend `identifier` (e-mail ou code employé) et `password`.
- Limite produit constatée : « mot de passe oublié » ne génère pas d'e-mail ; il notifie l'ADMIN du garage dans l'application. Un ADMIN seul dans son garage ne peut pas se rétablir seul.
- La CI exécute les tests Jest (`npm test -- --ci`) : tout parcours converti en test d'intégration y est donc protégé contre la régression.
