import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsersService } from '../users/users.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { verifyJwt } from './jwt';

/**
 * Глобальный guard (Private Routes на стороне API): проверяет JWT сайта
 * (Authorization: Bearer …), загружает пользователя из БД и кладёт его в request.user.
 * Роль берётся из БД, а не из токена — смена роли действует сразу.
 * Публичные эндпоинты (@Public) пропускаются.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers?.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Войдите в аккаунт');

    const payload = verifyJwt(header.slice('Bearer '.length).trim());
    if (!payload) throw new UnauthorizedException('Сессия истекла — войдите снова');

    const user = await this.users.findForAuth(payload.sub);
    if (!user || user.deleted_at) throw new UnauthorizedException('Аккаунт не найден');
    if (user.is_blocked) throw new ForbiddenException('Аккаунт заблокирован');

    request.user = await this.users.syncAdminRole(user);
    return true;
  }
}
