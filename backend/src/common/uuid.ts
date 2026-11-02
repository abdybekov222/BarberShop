import { Matches, type ValidationOptions } from 'class-validator';

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * UUID любой версии. Сид генерирует детерминированные id (без версионного бита),
 * которые отвергает IsUUID('all') из свежего validator.js.
 */
export function IsUuidLike(options?: ValidationOptions): PropertyDecorator {
  return Matches(UUID_LIKE, { message: '$property must be a UUID', ...options });
}
