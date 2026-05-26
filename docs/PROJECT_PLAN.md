# Plan de Projet : Atelier 2026

Application de gestion d'atelier automobile moderne, conforme aux standards 2026.

## Phase 1 : Initialisation & Design System
- [x] Initialisation de shadcn/ui (`npx shadcn@latest init -d`)
- [x] Configuration du thème (Slate/Zinc, variables CSS Atelier)
- [x] Mise en place du Layout Principal (Sidebar, Header, Command Palette)
- [x] Création des composants partagés (Badges de statut, Skeletons, Empty States)

## Phase 2 : Module Véhicules & Clients (VEH)
- [x] Liste des véhicules avec recherche rapide
- [x] Fiche véhicule détaillée (Historique, Spécifications)
- [x] Formulaire d'ajout/édition (Validation immatriculation CM)

## Phase 3 : Module Ordres de Travail (ORD)
- [x] Tableau de bord de l'atelier (Kanban/Liste des OT en cours)
- [x] Création d'un Ordre de Travail (Réception véhicule)
- [x] Suivi des travaux (Diagnostic, Affectation techniciens)
- [x] Gestion des statuts (REÇU -> EN COURS -> PRÊT -> FACTURÉ)

## Phase 4 : Module Stock & Pièces (STK)
- [x] Inventaire des pièces avec alertes seuil critique
- [x] Sortie de pièces liée aux OT
- [x] Historique des mouvements de stock

## Phase 5 : Module Facturation & Paiement (FAC)
- [x] Génération de devis (Validation signature)
- [x] Transformation Devis -> Facture
- [x] Suivi des paiements (Espèces, Mobile Money)

## Phase 6 : Notifications & Audit (TRX)
- [x] Système de logs d'audit (Historique des modifications)
- [x] Simulation d'envoi de SMS (Orange/MTN CM)
- [x] Rapports de performance atelier

## Phase 8 : Module Équipe (TEAM)
- [x] Page de gestion de l'équipe (Liste des techniciens, spécialités)
- [x] Suivi d'activité en temps réel (Qui fait quoi quand)
- [x] Historique individuel de performance (Qui a fait quoi quand)
- [x] Visualisation de la charge de travail (Histogramme sur le Dashboard)

## Phase 7 : Polissage & Finalisation
- [x] Animations de transition (Motion)
- [x] Raccourcis clavier (Command Palette K)
- [x] Tests de bout en bout et validation UX
