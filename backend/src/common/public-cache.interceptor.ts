import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, of, tap } from 'rxjs';

/** Публичные справочники, которые меняются только из админки. */
const CACHEABLE = ['/api/services', '/api/masters', '/api/gallery', '/api/config', '/api/reviews', '/api/products', '/api/ai/styles'];
const TTL_MS = 60_000;

/**
 * In-memory кэш анонимных GET-ответов справочников: Neon в другом регионе,
 * и каждая страница сайта делает по несколько запросов. Любая запись в админке
 * (не-GET на /api/admin/*) сбрасывает кэш целиком, так что правки видны сразу.
 */
@Injectable()
export class PublicCacheInterceptor implements NestInterceptor {
  private readonly cache = new Map<string, { at: number; body: unknown }>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const url: string = req.originalUrl ?? req.url ?? '';

    if (req.method !== 'GET') {
      if (url.startsWith('/api/admin/') || url.startsWith('/api/products/')) {
        return next.handle().pipe(tap(() => this.cache.clear()));
      }
      return next.handle();
    }

    const path = url.split('?')[0]!;
    const cacheable = !req.headers?.authorization && CACHEABLE.some((p) => path === p || path.startsWith(`${p}/`));
    if (!cacheable) return next.handle();

    const hit = this.cache.get(url);
    if (hit && Date.now() - hit.at < TTL_MS) return of(hit.body);

    return next.handle().pipe(
      tap((body) => {
        if (this.cache.size > 500) this.cache.clear();
        this.cache.set(url, { at: Date.now(), body });
      }),
    );
  }
}
