# Onboarding — Réceptionniste

Vous êtes la première et dernière personne que le client voit. Votre travail : transformer une arrivée client en OT propre, et s'assurer que le véhicule ne repart qu'une fois tout réglé.

---

## Connexion

URL : `http://localhost:3005` (ou l'URL de production communiquée par votre admin)
Votre email + mot de passe vous ont été fournis par l'administrateur.

---

## Flux quotidien type

### 1. Un client arrive sans rendez-vous

1. **Clients** → Recherchez le client par nom ou téléphone
2. Pas trouvé ? **→ Nouveau client** : remplissez prénom, nom, téléphone (obligatoire), ville
3. Sur la fiche client → onglet **Véhicules** → vérifiez si le véhicule est déjà enregistré
4. Véhicule absent ? **→ Ajouter un véhicule** : plaque, marque, modèle, année
5. **Ordres de Travail** → **Nouvel OT** : sélectionnez client + véhicule, saisissez la plainte client, choisissez la priorité
6. Validez → l'OT passe en statut **REÇU**

### 2. Un client a un rendez-vous

1. **Planning** → vérifiez le RDV du jour
2. Cliquez sur le RDV → lien direct vers la fiche client/véhicule
3. Ouvrez l'OT depuis le RDV ou depuis **Ordres de Travail → Nouvel OT**

### 3. Check de réception (obligatoire avant de confier le véhicule)

1. Ouvrez l'OT → onglet **Réception**
2. Renseignez : kilométrage à l'entrée, niveau carburant, objets présents dans le véhicule
3. Cochez chaque point d'inspection (carrosserie, vitres, intérieur…)
4. Signature client si présent
5. Validez → le check est enregistré, le technicien peut commencer

### 4. Prendre un rendez-vous

1. **Planning** → **Nouveau RDV**
2. Renseignez client, véhicule (optionnel), date/heure, motif
3. Durée par défaut : 60 min (modifiable)

---

## Pages que vous utilisez

| Page | Accès |
|------|-------|
| `/` | Dashboard — vue du jour |
| `/customers` | Liste et création de clients |
| `/customers/[id]` | Fiche client + ses véhicules |
| `/vehicles` | Tous les véhicules |
| `/workshop` | Tableau des OT |
| `/planning` | Calendrier des RDV |

---

## Ce que vous ne gérez pas

- Devis et factures → Chef d'atelier / Caissier
- Stock → Chef d'atelier
- Techniciens → Chef d'atelier

---

## Points clés

- **Un OT = un véhicule**. Si un client amène deux voitures, deux OT séparés.
- La plainte client est le seul champ libre important : soyez précis, c'est ce que le technicien voit en premier.
- Ne clôturez jamais un OT vous-même — c'est le caissier qui le fait après encaissement.
- Si un client signale une anomalie avant que vous ne la cochiez dans la réception, ajoutez-la en note globale. Ça protège l'atelier.
