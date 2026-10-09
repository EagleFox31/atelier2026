-- Désabonnement « STOP » reçu par le webhook WhatsApp : numéro de l'expéditeur,
-- conservé seulement jusqu'au traitement de l'événement (effacé ensuite).
ALTER TABLE "whatsapp_webhook_events" ADD COLUMN IF NOT EXISTS "sender_e164" TEXT;
