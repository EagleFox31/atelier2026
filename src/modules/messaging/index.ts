/** Point d'entrée public du module de messagerie (contrats, jetons, erreurs, utilitaires). */
export { MessagingModule } from './messaging.module';
export { SMS_PROVIDER, WHATSAPP_PROVIDER } from './messaging.tokens';
export {
  MessagingError,
  PermanentMessagingError,
  TemporaryMessagingError,
  isPermanentMessagingError,
  type MessagingErrorCode,
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
} from './whatsapp/whatsapp-provider.interface';
export { detectCameroonOperator, maskPhone, toE164, type CameroonOperator } from './shared/phone';
