-- ============================================================
--  ATELIER-CM · Fonctions & Triggers (PostgreSQL 16)
--  DEPRECATED pour le déploiement : utiliser prisma/full_schema.sql
--  (parité Supabase + audit_logs partitionné + toutes les vues).
--  Ce fichier reste pour référence / exécution manuelle partielle.
-- ============================================================

-- Extensions (uuid-ossp est déjà activé sur Supabase par défaut)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Séquences pour les références métier ────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS seq_ot      START 1;
CREATE SEQUENCE IF NOT EXISTS seq_quote   START 1;
CREATE SEQUENCE IF NOT EXISTS seq_invoice START 1;
CREATE SEQUENCE IF NOT EXISTS seq_asp     START 1;
CREATE SEQUENCE IF NOT EXISTS seq_counter START 1;

-- ─── Fonction de génération de référence ─────────────────────────────────────
-- Génère des identifiants lisibles du type : OT-2026-00001 (fuseau Africa/Douala)
CREATE OR REPLACE FUNCTION fn_next_ref(prefix TEXT, seq_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN prefix || '-' ||
    to_char(now() AT TIME ZONE 'Africa/Douala', 'YYYY') || '-' ||
    lpad(nextval(seq_name::regclass)::text, 5, '0');
END;
$$;

-- ─── Helper : récupère l'utilisateur courant depuis la session PostgreSQL ─────
-- L'application peut définir : SET LOCAL app.current_user_id = '<uuid>';
-- Si non défini, retourne NULL (la fonction est toujours appelée avec un fallback).
CREATE OR REPLACE FUNCTION fn_current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─── Trigger 1 : Historique des statuts OT ───────────────────────────────────
-- Se déclenche sur INSERT (création) et UPDATE du champ status sur service_orders.
-- Enregistre la transition dans ot_status_history.
CREATE OR REPLACE FUNCTION fn_trg_ot_status_history()
RETURNS TRIGGER AS $$
DECLARE
    v_changed_by UUID;
BEGIN
    -- Ignorer si le statut n'a pas changé (UPDATE sans changement de statut)
    IF (TG_OP = 'UPDATE') AND (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
        RETURN NEW;
    END IF;

    -- Priorité : variable de session > opened_by (toujours présent)
    v_changed_by := COALESCE(fn_current_user_id(), NEW.opened_by::UUID);

    INSERT INTO ot_status_history (
        id,
        service_order_id,
        from_status,
        to_status,
        changed_by,
        changed_at
    ) VALUES (
        uuid_generate_v4(),
        NEW.id,
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
        NEW.status,
        v_changed_by,
        CURRENT_TIMESTAMP
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attache le trigger à la table service_orders
DROP TRIGGER IF EXISTS trg_ot_status_history ON service_orders;
CREATE TRIGGER trg_ot_status_history
    AFTER INSERT OR UPDATE OF status ON service_orders
    FOR EACH ROW
    EXECUTE FUNCTION fn_trg_ot_status_history();

-- ─── Trigger 2 : Consommation automatique de stock ───────────────────────────
-- Se déclenche quand une ligne de devis passe au statut CONSUMED.
-- Crée le mouvement de stock et met à jour qty_in_stock dans parts_catalog.
CREATE OR REPLACE FUNCTION fn_trg_stock_consumption()
RETURNS TRIGGER AS $$
DECLARE
    v_qty_before    DECIMAL;
    v_performed_by  UUID;
    v_order_id      UUID;
BEGIN
    -- Uniquement si part_status passe à CONSUMED
    IF (OLD.part_status IS NOT DISTINCT FROM NEW.part_status)
       OR (NEW.part_status <> 'CONSUMED')
       OR (NEW.part_id IS NULL) THEN
        RETURN NEW;
    END IF;

    -- Déjà déstocké par l'app au passage IN_PROGRESS (STOCK_RESERVED → CONSUMED)
    IF OLD.part_status = 'STOCK_RESERVED' THEN
        RETURN NEW;
    END IF;

    -- Résoudre l'utilisateur courant, fallback sur l'ouvreur de l'OT
    v_performed_by := fn_current_user_id();
    IF v_performed_by IS NULL THEN
        SELECT so.opened_by INTO v_performed_by
        FROM quotes q
        JOIN service_orders so ON so.id = q.service_order_id
        WHERE q.id = NEW.quote_id
        LIMIT 1;
    END IF;

    -- Récupérer le service_order_id depuis la quote
    SELECT service_order_id INTO v_order_id
    FROM quotes
    WHERE id = NEW.quote_id;

    -- Verrouillage pessimiste + lecture du stock actuel
    SELECT qty_in_stock INTO v_qty_before
    FROM parts_catalog
    WHERE id = NEW.part_id
    FOR UPDATE;

    -- Vérifier le stock disponible
    IF v_qty_before < NEW.quantity THEN
        RAISE EXCEPTION 'Stock insuffisant pour la pièce % (disponible: %, requis: %)',
            NEW.part_id, v_qty_before, NEW.quantity;
    END IF;

    -- Enregistrer le mouvement de stock
    INSERT INTO stock_movements (
        id,
        part_id,
        movement_type,
        quantity,
        service_order_id,
        quote_line_id,
        performed_by,
        performed_at,
        qty_before,
        qty_after,
        notes
    ) VALUES (
        uuid_generate_v4(),
        NEW.part_id,
        'OT_CONSUMPTION',
        -NEW.quantity,
        v_order_id,
        NEW.id,
        v_performed_by,
        CURRENT_TIMESTAMP,
        v_qty_before,
        v_qty_before - NEW.quantity,
        'Consommation automatique OT'
    );

    -- Mettre à jour le stock
    UPDATE parts_catalog
    SET
        qty_in_stock  = qty_in_stock - NEW.quantity,
        updated_at    = CURRENT_TIMESTAMP
    WHERE id = NEW.part_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attache le trigger à quote_lines (uniquement sur UPDATE de part_status)
DROP TRIGGER IF EXISTS trg_stock_consumption ON quote_lines;
CREATE TRIGGER trg_stock_consumption
    AFTER UPDATE OF part_status ON quote_lines
    FOR EACH ROW
    EXECUTE FUNCTION fn_trg_stock_consumption();

-- ─── Trigger 3 : Audit générique ─────────────────────────────────────────────
-- Trace les INSERT/UPDATE sur les tables sensibles.
-- NestJS écrit aussi dans audit_logs via AuditService (pas de doublon car
-- AuditService cible uniquement les actions métier explicites).
CREATE OR REPLACE FUNCTION fn_trg_audit_generic()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        id,
        entity_type,
        entity_id,
        action,
        performed_by,
        performed_at
    ) VALUES (
        uuid_generate_v4(),
        TG_TABLE_NAME,
        NEW.id,
        TG_OP,
        fn_current_user_id(),
        CURRENT_TIMESTAMP
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note : ce trigger générique est volontairement non attaché par défaut.
-- L'activer sélectivement sur les tables souhaitées, ex :
--
-- DROP TRIGGER IF EXISTS trg_audit_customers ON customers;
-- CREATE TRIGGER trg_audit_customers
--     AFTER INSERT OR UPDATE ON customers
--     FOR EACH ROW EXECUTE FUNCTION fn_trg_audit_generic();

-- ─── Vue : Dashboard OT actifs ───────────────────────────────────────────────
-- Liste tous les OT non clôturés avec infos véhicule, client, avancement travaux
-- et immobilisation en cours. Utilisée par le dashboard NestJS /api/dashboard/stats.
-- IMPORTANT : works_done utilise 'COMPLETED' (enum work_item_status_t), pas 'DONE'.
CREATE OR REPLACE VIEW v_active_ot_dashboard AS
SELECT
    so.id,
    so.reference,
    so.status,
    so.priority,
    v.plate_number,
    vm.name  AS make,
    vmo.name AS model,
    COALESCE((c.first_name || ' ') || c.last_name, c.company_name) AS customer_name,
    c.phone_primary AS customer_phone,
    so.client_complaint,
    so.opened_at,
    so.promised_at,
    so.estimated_ready_at,
    ROUND(EXTRACT(EPOCH FROM now() - so.opened_at) / 3600, 1) AS hours_open,
    (u1.first_name || ' ') || u1.last_name AS conseiller_name,
    (u2.first_name || ' ') || u2.last_name AS chef_name,
    (SELECT COUNT(*)::INTEGER FROM ot_work_items w
     WHERE w.service_order_id = so.id
       AND w.status = 'COMPLETED'::"work_item_status_t") AS works_done,
    (SELECT COUNT(*)::INTEGER FROM ot_work_items w
     WHERE w.service_order_id = so.id)                  AS works_total,
    vi.reason         AS immob_reason,
    vi.immobilized_at AS immob_since,
    ROUND(EXTRACT(EPOCH FROM now() - vi.immobilized_at) / 3600, 1) AS immob_hours
FROM service_orders so
JOIN  vehicles v   ON v.id  = so.vehicle_id
JOIN  customers c  ON c.id  = so.customer_id
LEFT JOIN vehicle_makes  vm  ON vm.id  = v.make_id
LEFT JOIN vehicle_models vmo ON vmo.id = v.model_id
LEFT JOIN users u1 ON u1.id = so.opened_by
LEFT JOIN users u2 ON u2.id = so.assigned_chef
LEFT JOIN vehicle_immobilizations vi
       ON vi.service_order_id = so.id AND vi.resolved_at IS NULL
WHERE so.status <> ALL (ARRAY['CLOSED'::ot_status_t, 'CANCELLED'::ot_status_t]);
