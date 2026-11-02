export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Ошибка API с HTTP-статусом и кодом/сообщением сервера (например, AI_LIMIT_EXCEEDED). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function parseError(path: string, res: Response): Promise<ApiError> {
  // Сессия истекла или токен отозван — сбрасываем вход (слушает AuthProvider)
  if (res.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('auth:expired'));
  const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  const msg = Array.isArray(body?.message) ? body.message[0] : body?.message;
  return new ApiError(res.status, msg ?? `Ошибка запроса ${path} (${res.status})`);
}

/** GET-запрос к API с Firebase ID-токеном в заголовке Authorization. */
export async function apiGet<T = unknown>(path: string, token: string | null): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  if (!res.ok) throw await parseError(path, res);
  return res.json() as Promise<T>;
}

/** POST/PATCH/PUT/DELETE с JSON-телом (или FormData). */
export async function apiSend<T = unknown>(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  token: string | null,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });
  if (!res.ok) throw await parseError(path, res);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Скачивает файл с авторизацией (например, .ics записи). */
export async function apiDownload(path: string, token: string, filename: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw await parseError(path, res);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface SalonConfig {
  timezone: string;
  slot_step_min: number;
  ai_free_limit: number;
  ai_enabled: boolean;
}
