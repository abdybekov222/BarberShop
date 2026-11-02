import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Задаёт роли, которым разрешён доступ к эндпоинту. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
