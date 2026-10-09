/** Point d'entrée public : ce que les services métier ont le droit d'utiliser. */
export { CustomerNotificationsModule } from './customer-notifications.module';
export {
  CustomerNotificationEmitter,
  type CustomerNotificationInput,
  type EmitResult,
} from './customer-notification.emitter';
export { notificationKeys } from './notification-keys';
export { NOTIFICATION_CATALOG, type NotificationVariable } from './customer-notification-catalog';
export {
  customerDisplayName,
  formatNotificationAmount,
  formatNotificationDate,
  formatNotificationTime,
} from './notification-format';
