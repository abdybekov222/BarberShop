export { formatKgs } from './format';
export {
  normalizePhone,
  isValidPhone,
  validatePhone,
  phoneSchema,
  DEFAULT_OPERATOR_FAMILIES,
  type PhoneValidateResult,
} from './phone';

// Энумерации ролей и статусов, общие для API и веб-клиента.
export const USER_ROLES = ['client', 'master', 'admin', 'owner'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'completed',
  'cancelled_by_client',
  'cancelled_by_salon',
  'no_show',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const MASTER_RANKS = ['chief', 'top', 'senior', 'barber'] as const;
export type MasterRank = (typeof MASTER_RANKS)[number];
