# Modèles WhatsApp Utility — Atelier Maître (FR/EN)

**Statut : brouillons à soumettre, non approuvés. Aucune activation du canal.**

Source des contenus et exemples : [`whatsapp-utility-templates.json`](whatsapp-utility-templates.json).
Source métier de vérité : [`customer-notification-catalog.ts`](../src/modules/customer-notifications/customer-notification-catalog.ts).
Le test `whatsapp-template-manifest.spec.ts` exige la correspondance exacte des huit événements, des noms et de l'ordre des variables.

## Dépôt dans Meta

1. Ouvrir Meta Business Suite → WhatsApp Manager → **Modèles de messages**, en sélectionnant le compte réel **Trigenys Group** associé au MTN +237 670 75 43 72, et **pas** le compte de test.
2. Vérifier qu'aucun modèle du même nom n'existe déjà avant de tenter une création. Ne jamais écraser un modèle approuvé existant sans migration.
3. Pour chacun des huit noms du manifeste, choisir **Utility / Utilitaire**, créer les langues **French (`fr`)** et **English (`en`)**, puis saisir **le corps exact** et les exemples de chaque variante du manifeste.
4. N'ajouter **aucun en-tête média**, aucune promotion et **aucun bouton** sauf pour `am_quote_approval_v1` : un bouton URL dynamique à l'index 0, libellé « Consulter le devis » / « View quote », adresse `https://atelier.trigenys.com/devis/{{1}}`. Fournir l'exemple de suffixe opaque indiqué dans le manifeste. Le jeton réel n'est créé que lors de l'envoi depuis Atelier et jamais enregistré dans Meta ou dans Git.
5. Soumettre les deux langues à la revue Meta. Les statuts **APPROVED** doivent être vérifiés sur le bon compte WhatsApp, par nom *et* langue, avant toute utilisation. Une soumission n'est pas une approbation. Si Meta choisit un code régional (`fr_FR`, `en_US`) au lieu de `fr`, `en`, **ne pas activer** : revoir les contrats existants de Notify et d'Atelier et les tests de correspondance de codes.
6. Après approbation, définir manuellement et strictement l'allowlist `ATELIER_META_APPROVED_TEMPLATES` dans Notify et `WHATSAPP_APPROVED_TEMPLATES` dans Atelier **uniquement pour les couples réellement approuvés**. Chaque paire doit avoir la forme `nom:fr` ou `nom:en`. Ne pas déduire l'approbation de la présence d'un brouillon dans GitHub.
7. Réaliser la recette staging avec un destinataire consentant, les limites de coût, les accusés Meta et les erreurs. Laisser `ATELIER_META_DISPATCH_ENABLED=false` et `CUSTOMER_NOTIFICATIONS_MODE=off` tant que la recette de bascule n'est pas validée.

## Principes de sécurité et de coût

- Catégorie Utility uniquement : notifications transactionnelles attendues, sans publicité.
- Le consentement client, la limitation des coûts par garage, la déduplication, les statuts et le webhook signé restent dans Atelier Maître.
- Les modèles sortants peuvent faire l'objet d'une facturation Meta **par message livré**, selon catégorie et pays du destinataire ; une conversation initiée par le client pendant la fenêtre de 24 h ne valide pas à elle seule l'envoi de ces modèles. Vérifier les tarifs officiels et la configuration de paiement avant tout test qui peut engendrer des frais.
- Ne jamais partager le token Meta ou les clés interservices, ni les recopier dans le manifeste.
- Les valeurs d'exemple du manifeste sont fictives et uniquement destinées à la validation Meta.

## Documents de référence

- [Meta Business — Manage Message Templates](https://whatsappbusiness.com/blog/manage-message-templates-whatsapp-business-api/)
- [Meta Developers — WhatsApp pricing](https://developers.facebook.com/docs/whatsapp/pricing/)
- [Meta — Create templates for WhatsApp Business](https://www.facebook.com/business/help/2055875911147364)
