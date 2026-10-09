/** Point d'entrée public du module de messagerie (contrats, jetons, erreurs, utilitaires). */
export { MessagingModule } from './messaging.module';
export { SMS_PROVIDER, WHATSAPP_PROVIDER, WHATSAPP_WEBHOOK_CONFIG } from './messaging.tokens';
export {
  MessagingError,
  PermanentMessagingError,
  TemporaryMessagingError,
  classifyMessagingFailure,
  isPermanentMessagingError,
  type MessagingErrorCode,
  type MessagingFailure,
  type PermanentMessagingErrorCode,
  type TemporaryMessagingErrorCode,
} from './messaging.errors';
export type {
  SendSmsRequest,
  SendSmsResult,
  SmsAcceptedStatus,
  SmsBalance,
  SmsDeliveryStatus,
  SmsProvider,
  SenderValidation,
} from './sms/sms-provider.interface';
export type {
  SendWhatsAppMessageRequest,
  SendWhatsAppResult,
  SendWhatsAppTemplateRequest,
  WhatsAppProvider,
  WhatsAppTemplateUrlButton,
} from './whatsapp/whatsapp-provider.interface';
export { detectCameroonOperator, maskPhone, toE164, type CameroonOperator } from './shared/phone';
export {
  MAX_WEBHOOK_BODY_BYTES,
  MetaWebhookPayloadError,
  WhatsAppWebhookConfigurationError,
  loadWhatsAppWebhookConfig,
  parseMetaWebhook,
  signMetaPayload,
  verifyMetaSignature,
  verifySubscription,
  type MetaDeliveryStatus,
  type MetaStatusEvent,
  type ParsedMetaWebhook,
  type WhatsAppWebhookConfig,
} from './whatsapp/meta-webhook';
