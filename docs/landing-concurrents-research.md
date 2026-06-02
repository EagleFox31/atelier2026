# Recherche landing pages — logiciels garage / atelier (2026)

Synthèse pour la future page marketing **Atelier Maître** (SaaS, marché Cameroun + Afrique).

---

## Concurrents analysés

| Produit | Marché | Positionnement landing | CTA principal | Prix indicatif |
|---------|--------|----------------------|---------------|----------------|
| [AutoLeap](https://autoleap.com/automotive-garage-software/) | USA / CA | « Paperless workflow », multi-sites | Démo / essai | Enterprise |
| [Tekmetric](https://www.tekmetric.com/) | USA | Simplicité, ROI, communication client | Essai gratuit | ~199–439 $/mois |
| [Shop-Ware](https://www.shop-ware.com/) | USA | Gros volumes, workflow équipe | Démo | ~249–799 $/mois |
| [Shopmonkey](https://www.shopmonkey.io/) | USA | Cloud, tout-en-un, mobile | Essai | Mid-market |
| [Garage Hive](https://garagehive.co.uk/) | UK | Multi-location, MOT, intégrations compta | Démo | — |
| [Workshop Software](https://workshopsoftware.com/) | Global (30 ans) | « Transform your business », intégrations | Free trial | — |
| [autoGMS](https://myautogms.com/) | UAE / GCC (+ blog Europe/Afrique) | Un job record, WhatsApp/SMS, mobile-first | Démo 15 min + trial | — |
| [Cilea Mastercar](https://automobile.cilea.fr/) | France | DMS garage, conformité FR, mobilité | Contact commercial | — |
| [EBP MéCa](https://www.ebp.com/) | France | ERP garage, NF525, agents marque | Devis | SaaS modules |
| [Fiducial V-Mobility](https://www.fiducial.fr/) | France | SaaS hébergé FR, ETAI chiffrage | Démo | — |
| Comparatif [Montupet 2026](https://www.montupet.fr/comparateurs/logiciel-dms/) | France | DMS indépendants 1–20 compagnons | — | 30–200 €/poste/mois |

**Afrique (mentions blog / comparatifs)** : SoluxAuto, autoGMS — accent **mobile**, **WhatsApp**, faible infra locale, déploiement cloud.

---

## Patterns récurrents sur les landings qui « en jettent »

### Hero
- **Promesse une phrase** : fini le papier / un seul flux de la réception à la facture.
- **Sous-titre concret** : OT, devis, stock, SMS — pas « solution innovante ».
- **Double CTA** : « Réserver une démo » (primaire) + « Essai gratuit » (secondaire).
- **Visuel produit** : capture dashboard, mockup mobile, ou animation statuts OT.

### Preuve sociale (above the fold ou juste après)
- Nombre d’ateliers / pays / années.
- Logos (réseaux, partenaires) — même légers pour MVP.

### Problème → solution
- Douleur : WhatsApp + carnet + Excel + facture Word.
- Solution : **un dossier par véhicule**, statuts en temps réel.

### Grille fonctionnalités (6–9 blocs)
Thèmes les plus repris :
1. Prise de RDV / planning baies  
2. Ordres de travail / workflow statuts  
3. Devis & factures (TVA, signature)  
4. Stock pièces & alertes  
5. Clients & véhicules (historique)  
6. SMS / WhatsApp / rappels  
7. Tableau de bord / CA  
8. Mobile technicien / réception  
9. Multi-garages (réseaux) — **différenciateur pour Atelier**

### Spécificités régionales (autoGMS le fait bien)
- Devise locale (AED → **XAF** pour nous).
- TVA locale (**19,25 %**).
- Fuseau / langue FR.
- Paiements Mobile Money (mention future).

### Multi-sites
- AutoLeap / Garage Hive : « multi-location networks ».
- **Notre angle** : un patron ouvre **plusieurs garages sous un même compte** (tenant), pas gestion RH multi-emploi.

### FAQ (SEO + objections)
- Qu’est-ce qu’un logiciel garage ?
- Combien de temps pour démarrer ?
- Essai / prix / données / mobile / conformité fiscale.

### Footer CTA
- Répéter démo + essai + contact WhatsApp / email.

---

## Ce que les concurrents **ne** mettent pas en avant (opportunité Atelier)

| Angle | Pourquoi c’est fort au Cameroun |
|-------|----------------------------------|
| **XAF + timbre + TVA 19,25 %** natifs | Les US/UK parlent $ / VAT / MOT |
| **SMS Orange / MTN CM** | Peu de landings « Afrique centrale » |
| **Français, contexte Douala / Yaoundé** | Pas « garage » générique US |
| **Groupe : plusieurs garages, un compte** | Clair pour patrons qui grandissent |
| **Offline-tolerant / faible bande passante** | À mentionner quand PWA stable |
| **Prix en FCFA / forfait atelier** | Pas 199 $/mois opaque |

---

## Recommandations URL (aligné concurrence)

| URL | Rôle | Exemples concurrents |
|-----|------|----------------------|
| **`/`** | Landing marketing | Tekmetric, Shopmonkey, autoGMS — racine = site vitrine |
| **`/login`** | Connexion app | Standard SaaS (pas `/app/login` sauf gros portails type Salesforce) |
| **`/dashboard`** | Tableau de bord connecté | Beaucoup gardent `/` pour l'app *ou* sous-domaine `app.` — nous séparons clairement |
| **`/accueil`** | Redirige → `/` | Alias FR pour anciens liens |

**Pourquoi pas `/app/*` ?** Les DMS garage (Tekmetric, Garage Hive, EBP) utilisent `domain.com` + **Sign in** → pas de préfixe `/app`. Le préfixe `/app` est surtout Notion/Slack avec marketing sur un autre domaine.

**Comportement :**
- Visiteur sur `/` → landing
- Connecté sur `/` → redirect `/dashboard` (ou `/workshop` technicien)
- `/login` avec session → redirect app
- Déconnexion → `/` (landing)

---

## Recommandations design pour `/`

1. **Ton** : pro mais terrain — garage indépendant et petit réseau, pas enterprise US.  
2. **Couleurs** : réutiliser `--brand` (#1D6FA4) + fond clair (cohérent login).  
3. **Hero** : « De la réception à l’encaissement, un seul flux — en francs CFA. »  
4. **CTA** : `Demander une démo` → mailto ou formulaire plus tard ; `Se connecter` → `/login`.  
5. **Section multi-garages** : illustrer tenant → Douala + Yaoundé (schéma simple).  
6. **Ne pas promettre** : chiffrage ETAI, NF525 France, intégrations compta non branchées.  
7. **Pricing** : « Bientôt » ou fourchette FCFA quand défini — les US affichent $ transparent.

---

## Liens utiles

- [autoGMS blog Europe/Afrique](https://myautogms.com/blog/logiciel-de-gestion-de-garage-automobile-guide-complet)
- [Guide logiciel garage (FR)](https://myautogms.com/blog/logiciel-de-gestion-de-garage-automobile-guide-complet)
- Landing live Atelier : `/` (alias `/accueil` → redirect)

*Dernière mise à jour : 2026-05-31*
