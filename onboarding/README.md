# Onboarding Atelier Maître

Bienvenue. Choisissez votre profil ci-dessous pour accéder à votre guide de prise en main.

| Profil | Rôle dans l'atelier | Guide |
|--------|----------------------|-------|
| Réceptionniste | Accueil, clients, ouverture des OT | [→ receptionniste.md](receptionniste.md) |
| Technicien | Diagnostic, travaux, observations | [→ technicien.md](technicien.md) |
| Chef d'atelier | Pilotage, devis, affectations, QC | [→ chef_atelier.md](chef_atelier.md) |
| Caissier | Facturation, encaissement | [→ caissier.md](caissier.md) |
| Administrateur | Configuration complète du système | [→ admin.md](admin.md) |

---

## Cycle de vie d'un Ordre de Travail (OT)

```
[RECEPTIONNISTE]        [TECHNICIEN]           [CHEF ATELIER]         [CAISSIER]
      │                      │                       │                     │
  Ouvre OT              Diagnostique            Crée le devis        Émet facture
      │                      │                       │                     │
   DRAFT ──► RECEIVED ──► DIAGNOSING ──► QUOTE_PENDING ──► QUOTE_APPROVED
                                                                      │
                                                               IN_PROGRESS ──► QC_PENDING
                                                                                    │
                                                                              QC_DONE ──► READY ──► INVOICED ──► CLOSED
```

Chaque rôle n'intervient qu'à son étape. Le reste est en lecture seule.
