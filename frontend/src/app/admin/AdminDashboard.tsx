'use client';

import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatKgs } from '@barbershop/shared';
import { useAuth } from '../../lib/auth-context';
import { ApiError, apiGet, apiSend } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { AdminCharts } from './AdminCharts';
import { AdminOrders } from './AdminOrders';
import { AdminProducts } from './AdminProducts';

interface Stats {
  totalBookings: number;
  pendingBookings: number;
  todayBookings: number;
  totalUsers: number;
  revenueWeek: number;
  aiUsersWeek: number;
}

interface AiStatus {
  kill_switch: boolean;
  kill_reason: string | null;
  budget_usd: number;
  spent_usd: number;
  reserved_usd: number;
  est_cost_usd: number;
  remaining_usd: number;
  hourly_cap: number;
  daily_cap: number;
  generations_last_hour: number;
  generations_today: number;
  provider: string;
}

interface Booking {
  id: string;
  starts_at: string;
  status: string;
  total_price: number;
  client_comment: string | null;
  user: { full_name: string; phone: string | null; email: string | null };
  master: { name: string };
  items: { service: { name: string } }[];
  ai_generation: { id: string; style: string; result_url: string | null } | null;
}

interface AdminService {
  id: string;
  name: string;
  base_price: number;
  price_is_from: boolean;
  duration_min: number;
  is_active: boolean;
  category: { name: string };
}

interface AbuseRow {
  id: string;
  ip: string | null;
  rule: string;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Ожидает', cls: 'text-yellow-400' },
  confirmed: { label: 'Подтверждена', cls: 'text-success' },
  completed: { label: 'Завершена', cls: 'text-text-secondary' },
  cancelled_by_client: { label: 'Отменена', cls: 'text-error' },
  cancelled_by_salon: { label: 'Отмена салона', cls: 'text-error' },
  no_show: { label: 'Не пришёл', cls: 'text-error' },
};

const NEXT_STATUSES: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled_by_salon'],
  confirmed: ['completed', 'no_show', 'cancelled_by_salon'],
};

const KILL_REASONS: Record<string, string> = {
  manual: 'вручную',
  budget: 'бюджет исчерпан',
  daily_cap: 'суточный потолок',
  provider_errors: 'ошибки провайдера',
};

const SETTINGS_LABELS: Record<string, string> = {
  slot_step_min: 'Шаг слотов, мин (15/30)',
  cancel_window_hours: 'Окно отмены, ч',
  booking_horizon_days: 'Горизонт записи, дней',
  ai_free_limit: 'Бесплатных ИИ-попыток (новым)',
  ai_ip_generations_per_day: 'ИИ-генераций с IP в сутки',
  ai_uploads_per_day: 'Загрузок фото в сутки',
};

function formatDT(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bishkek',
  });
}

interface AdminMaster {
  id: string;
  name: string;
  is_active: boolean;
  rating: string | null;
  _count: { bookings: number };
}

interface AdminReview {
  id: string;
  rating: number;
  text: string | null;
  is_published: boolean;
  created_at: string;
  user: { full_name: string; phone: string | null };
  master: { name: string };
}

/** «2026-11-05» + «10:00» по Бишкеку → ISO UTC (салон в UTC+6 без перехода на летнее время). */
function bishkekToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+06:00`).toISOString();
}

function MasterRow({
  master,
  busy,
  onToggle,
  onTimeOff,
}: {
  master: AdminMaster;
  busy: boolean;
  onToggle: () => void;
  onTimeOff: (startsAt: string, endsAt: string, reason: string) => void;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('Отпуск');
  return (
    <div className="rounded-sm border border-line bg-bg-elevated p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className={`text-sm font-medium ${master.is_active ? 'text-text-primary' : 'text-text-secondary/50'}`}>
            {master.name}
          </p>
          <p className="text-xs text-text-secondary">
            Рейтинг {master.rating ?? '—'} · записей {master._count.bookings}
            {master.is_active ? '' : ' · скрыт с сайта'}
          </p>
        </div>
        <Button variant="text" className="!h-9 !min-h-0 text-xs" disabled={busy} onClick={onToggle}>
          {master.is_active ? 'Скрыть с сайта' : 'Вернуть на сайт'}
        </Button>
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onTimeOff(bishkekToIso(from, '00:00'), bishkekToIso(to, '23:59'), reason);
        }}
      >
        <label className="text-xs text-text-secondary">
          С
          <input type="date" required value={from} onChange={(e) => setFrom(e.target.value)} className="ml-1 h-9 rounded border border-line bg-bg-primary px-2 text-xs text-text-primary [color-scheme:dark]" />
        </label>
        <label className="text-xs text-text-secondary">
          по
          <input type="date" required min={from} value={to} onChange={(e) => setTo(e.target.value)} className="ml-1 h-9 rounded border border-line bg-bg-primary px-2 text-xs text-text-primary [color-scheme:dark]" />
        </label>
        <Select
          size="sm"
          label="Причина"
          value={reason}
          onChange={setReason}
          options={['Отпуск', 'Больничный', 'Выходной'].map((r) => ({ value: r, label: r }))}
        />
        <Button type="submit" variant="outline" className="!h-9 !min-h-0 text-xs" disabled={busy || !from || !to}>
          Добавить отсутствие
        </Button>
      </form>
    </div>
  );
}

type Tab = 'stats' | 'bookings' | 'orders' | 'products' | 'team' | 'services' | 'reviews' | 'ai' | 'settings';

const TAB_LABELS: Record<Tab, string> = { stats: 'Статистика', bookings: 'Записи', orders: 'Заказы', products: 'Товары', team: 'Мастера', services: 'Услуги и цены', reviews: 'Отзывы', ai: 'ИИ-зеркало', settings: 'Настройки' };

export function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [forbidden, setForbidden] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [abuse, setAbuse] = useState<AbuseRow[]>([]);
  const [masters, setMasters] = useState<AdminMaster[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [dateFilter, setDateFilter] = useState('');
  const initialTab = useSearchParams().get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(initialTab && TAB_LABELS[initialTab] ? initialTab : 'stats');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const token = useCallback(async () => (user ? user.getIdToken() : null), [user]);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const t = await user.getIdToken();
    try {
      setStats(await apiGet<Stats>('/api/admin/bookings/stats', t));
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setForbidden(true);
        return;
      }
    }
    const qs = new URLSearchParams({ take: '50' });
    if (statusFilter) qs.set('status', statusFilter);
    if (dateFilter) qs.set('date', dateFilter);
    const [ai, bk, sv, st, ab, ms, rv] = await Promise.all([
      apiGet<AiStatus>('/api/admin/ai/status', t).catch(() => null),
      apiGet<{ items: Booking[] }>(`/api/admin/bookings?${qs}`, t).catch(() => ({ items: [] })),
      apiGet<AdminService[]>('/api/admin/services', t).catch(() => []),
      apiGet<Record<string, string>>('/api/admin/settings', t).catch(() => ({})),
      apiGet<AbuseRow[]>('/api/admin/ai/log', t).catch(() => []),
      apiGet<AdminMaster[]>('/api/admin/masters', t).catch(() => []),
      apiGet<AdminReview[]>('/api/admin/reviews', t).catch(() => []),
    ]);
    setAiStatus(ai);
    setBookings(bk.items);
    setServices(sv);
    setSettings(st);
    setAbuse(ab);
    setMasters(ms);
    setReviews(rv);
  }, [user, statusFilter, dateFilter]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth?next=/admin');
      return;
    }
    if (user) fetchAll();
  }, [loading, user, fetchAll, router]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      if (ok) setNotice(ok);
      await fetchAll();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = (bookingId: string, status: string) =>
    run(async () => {
      let reason: string | undefined;
      if (status === 'cancelled_by_salon') {
        const r = window.prompt('Причина отмены (увидит клиент):', 'Мастер недоступен');
        if (r === null) return;
        reason = r;
      }
      await apiSend('PATCH', `/api/admin/bookings/${bookingId}/status`, await token(), { status, reason });
    });

  if (loading || !user) return null;

  if (forbidden) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-serif text-text-primary mb-2">Нет доступа</h1>
        <p className="text-text-secondary">Раздел доступен только администраторам салона.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen px-4 py-10">
      <p className="eyebrow mb-5">Управление салоном</p>
      <h1 className="text-4xl sm:text-5xl font-serif text-text-primary mb-8">Админ-панель</h1>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: 'Ожидают', value: stats.pendingBookings, gold: true },
            { label: 'Сегодня', value: stats.todayBookings },
            { label: 'Записей всего', value: stats.totalBookings },
            { label: 'Клиентов', value: stats.totalUsers },
            { label: 'Выручка за 7 дн.', value: formatKgs(stats.revenueWeek) },
            { label: 'ИИ-пользователей за 7 дн.', value: stats.aiUsersWeek },
          ].map((s) => (
            <div key={s.label} className="rounded-sm border border-line bg-bg-elevated p-4">
              <p className="text-xs text-text-secondary/70 uppercase tracking-wide mb-1">{s.label}</p>
              <p className={`text-2xl font-serif ${s.gold ? 'text-gold-500' : 'text-text-primary'}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <Select
        className="mb-6 md:hidden"
        label="Раздел"
        value={tab}
        onChange={setTab}
        options={(Object.keys(TAB_LABELS) as Tab[]).map((t) => ({ value: t, label: TAB_LABELS[t] }))}
      />
      <div className="mb-6 hidden flex-wrap gap-2 md:flex" role="tablist">
        {(['stats', 'bookings', 'orders', 'products', 'team', 'services', 'reviews', 'ai', 'settings'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`h-9 whitespace-nowrap rounded-full px-4 text-sm transition-colors ${
              tab === t ? 'bg-gold-500 text-black font-semibold' : 'bg-subtle text-text-secondary hover:text-text-primary'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {notice && (
        <p role="status" className="mb-4 rounded-sm border border-line bg-bg-elevated p-3 text-sm text-text-secondary">
          {notice}
        </p>
      )}

      {tab === 'stats' && <AdminCharts token={token} />}
      {tab === 'orders' && <AdminOrders token={token} />}
      {tab === 'products' && <AdminProducts token={token} />}

      {/* ═══ Записи ═══ */}
      {tab === 'bookings' && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Select
              size="sm"
              label="Статус"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[{ value: '', label: 'Все статусы' }, ...Object.entries(STATUS_MAP).map(([s, meta]) => ({ value: s, label: meta.label }))]}
            />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Фильтр по дате"
              className="h-8 rounded-sm border border-line bg-bg-elevated px-2 text-xs text-text-primary [color-scheme:dark]"
            />
            {dateFilter && (
              <button onClick={() => setDateFilter('')} className="text-xs text-text-secondary underline">
                сбросить дату
              </button>
            )}
          </div>

          {bookings.length === 0 ? (
            <p className="text-text-secondary py-10 text-center">Записей нет</p>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => {
                const st = STATUS_MAP[b.status];
                return (
                  <div key={b.id} className="rounded-sm border border-line bg-bg-elevated p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary">
                          {b.user.full_name}
                          {b.user.phone && (
                            <a href={`tel:${b.user.phone}`} className="text-gold-500 ml-2 font-normal">
                              {b.user.phone}
                            </a>
                          )}
                        </p>
                        <p className="text-xs text-text-secondary mt-0.5">
                          <span className="inline-block first-letter:uppercase">{formatDT(b.starts_at)}</span> · {b.master.name} ·{' '}
                          {b.items.map((i) => i.service.name).join(', ')}
                        </p>
                        {b.client_comment && (
                          <p className="text-xs text-text-secondary/80 mt-1 break-words">«{b.client_comment}»</p>
                        )}
                        {b.ai_generation && (
                          <p className="text-xs mt-1">
                            Образ ИИ: «{b.ai_generation.style}»{' '}
                            {b.ai_generation.result_url ? (
                              <a href={b.ai_generation.result_url} target="_blank" rel="noopener noreferrer" className="text-gold-500 underline">
                                открыть
                              </a>
                            ) : (
                              <span className="text-text-secondary/60">(срок хранения истёк)</span>
                            )}
                          </p>
                        )}
                        <p className={`text-xs mt-1 font-medium ${st?.cls}`}>{st?.label}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <span className="text-sm text-gold-500 font-semibold">{formatKgs(b.total_price)}</span>
                        {(NEXT_STATUSES[b.status] ?? []).map((ns) => (
                          <button
                            key={ns}
                            disabled={busy}
                            onClick={() => updateStatus(b.id, ns)}
                            className={`rounded px-3 h-9 text-xs border transition-colors ${
                              ns === 'confirmed'
                                ? 'border-success/50 text-success hover:bg-success/10'
                                : ns === 'completed'
                                  ? 'border-gold-500/50 text-gold-500 hover:bg-gold-500/10'
                                  : 'border-error/50 text-error hover:bg-error/10'
                            }`}
                          >
                            {ns === 'confirmed' ? 'Подтвердить' : (STATUS_MAP[ns]?.label ?? ns)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ Услуги и цены ═══ */}
      {tab === 'services' && (
        <div className="space-y-2">
          {services.map((s) => (
            <ServiceRow
              key={s.id}
              service={s}
              busy={busy}
              onSave={(patch) =>
                run(async () => apiSend('PATCH', `/api/admin/services/${s.id}`, await token(), patch), 'Услуга сохранена')
              }
            />
          ))}
        </div>
      )}

      {/* ═══ ИИ-зеркало ═══ */}
      {tab === 'ai' && aiStatus && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-sm border border-line bg-bg-elevated p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-medium text-text-primary">ИИ-зеркало</h2>
                <p className={`text-sm mt-1 ${aiStatus.kill_switch ? 'text-error' : 'text-success'}`}>
                  {aiStatus.kill_switch
                    ? `Выключено (${KILL_REASONS[aiStatus.kill_reason ?? 'manual'] ?? aiStatus.kill_reason})`
                    : 'Включено'}
                </p>
                <p className="text-xs text-text-secondary mt-1">Провайдер: {aiStatus.provider}</p>
              </div>
              <Button
                variant={aiStatus.kill_switch ? 'gold' : 'outline'}
                disabled={busy}
                onClick={() =>
                  run(async () =>
                    apiSend('POST', '/api/admin/ai/kill-switch', await token(), { active: !aiStatus.kill_switch }),
                  )
                }
              >
                {aiStatus.kill_switch ? 'Включить' : 'Выключить'}
              </Button>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-xs text-text-secondary mb-1">
                <span>Расход</span>
                <span>
                  ${aiStatus.spent_usd.toFixed(4)} / ${aiStatus.budget_usd.toFixed(2)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-subtle overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#C9A24B] to-[#8F6F2A]"
                  style={{ width: `${Math.min(100, (aiStatus.spent_usd / Math.max(aiStatus.budget_usd, 0.01)) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-text-secondary mt-1">
                Остаток: ${aiStatus.remaining_usd.toFixed(4)} · Резерв: ${aiStatus.reserved_usd.toFixed(4)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded bg-subtle px-3 py-2">
                <p className="text-xs text-text-secondary/60">За последний час</p>
                <p className="text-text-primary font-medium">
                  {aiStatus.generations_last_hour} / {aiStatus.hourly_cap}
                </p>
              </div>
              <div className="rounded bg-subtle px-3 py-2">
                <p className="text-xs text-text-secondary/60">Сегодня</p>
                <p className="text-text-primary font-medium">
                  {aiStatus.generations_today} / {aiStatus.daily_cap}
                </p>
              </div>
            </div>
          </div>

          <LimitsForm
            status={aiStatus}
            busy={busy}
            onSave={(v) => run(async () => apiSend('PATCH', '/api/admin/ai/limits', await token(), v), 'Лимиты сохранены')}
          />

          <GrantForm
            busy={busy}
            onGrant={(email, amount) =>
              run(async () => apiSend('POST', '/api/admin/ai/grant', await token(), { email, amount }), 'Попытки начислены')
            }
          />

          <div className="rounded-sm border border-line bg-bg-elevated p-6">
            <h3 className="text-sm uppercase tracking-wide text-text-secondary/70 mb-3">Журнал блокировок</h3>
            {abuse.length === 0 ? (
              <p className="text-sm text-text-secondary">Срабатываний нет</p>
            ) : (
              <ul className="space-y-1 text-xs text-text-secondary max-h-64 overflow-auto">
                {abuse.map((a) => (
                  <li key={a.id}>
                    {formatDT(a.created_at)} · {a.rule} · {a.ip ?? '—'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ═══ Мастера ═══ */}
      {tab === 'team' && (
        <div className="space-y-3">
          {masters.map((m) => (
            <MasterRow
              key={m.id}
              master={m}
              busy={busy}
              onToggle={() =>
                run(async () =>
                  apiSend('PATCH', `/api/admin/masters/${m.id}/active`, await token(), { isActive: !m.is_active }),
                )
              }
              onTimeOff={(startsAt, endsAt, reason) =>
                run(
                  async () =>
                    apiSend('POST', `/api/admin/masters/${m.id}/time-off`, await token(), { startsAt, endsAt, reason }),
                  'Отсутствие добавлено — эти слоты скрыты из записи',
                )
              }
            />
          ))}
        </div>
      )}

      {/* ═══ Отзывы ═══ */}
      {tab === 'reviews' && (
        <div className="space-y-3">
          {reviews.length === 0 && <p className="py-10 text-center text-text-secondary">Отзывов пока нет</p>}
          {reviews.map((r) => (
            <div key={r.id} className="rounded-sm border border-line bg-bg-elevated p-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-gold-500">
                    {'★'.repeat(r.rating)}
                    <span className="text-faint">{'★'.repeat(5 - r.rating)}</span>
                  </p>
                  <p className="text-sm text-text-primary mt-1 break-words">{r.text ?? '— без текста —'}</p>
                  <p className="text-xs text-text-secondary mt-1">
                    {r.user.full_name} {r.user.phone ?? ''} · мастер {r.master.name} · {formatDT(r.created_at)}
                  </p>
                </div>
                <Button
                  variant={r.is_published ? 'outline' : 'gold'}
                  className="!h-9 !min-h-0 text-xs shrink-0"
                  disabled={busy}
                  onClick={() =>
                    run(async () =>
                      apiSend('PATCH', `/api/admin/reviews/${r.id}`, await token(), { published: !r.is_published }),
                    )
                  }
                >
                  {r.is_published ? 'Скрыть' : 'Опубликовать'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Настройки салона ═══ */}
      {tab === 'settings' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(SETTINGS_LABELS).map(([key, label]) => (
            <SettingField
              key={key}
              label={label}
              value={settings[key] ?? ''}
              busy={busy}
              onSave={(value) =>
                run(async () => apiSend('PUT', '/api/admin/settings', await token(), { key, value }), 'Настройка сохранена')
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceRow({
  service,
  busy,
  onSave,
}: {
  service: AdminService;
  busy: boolean;
  onSave: (patch: Partial<AdminService>) => void;
}) {
  const [price, setPrice] = useState(String(service.base_price));
  const [duration, setDuration] = useState(String(service.duration_min));
  const dirty = price !== String(service.base_price) || duration !== String(service.duration_min);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-sm border border-line bg-bg-elevated p-3">
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${service.is_active ? 'text-text-primary' : 'text-text-secondary/50 line-through'}`}>
          {service.name}
        </p>
        <p className="text-xs text-text-secondary/60">{service.category.name}</p>
      </div>
      <label className="flex items-center gap-2 text-xs text-text-secondary">
        сом
        <Input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="!w-24 !h-9 !min-h-0" />
      </label>
      <label className="flex items-center gap-2 text-xs text-text-secondary">
        мин
        <Input value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="!w-20 !h-9 !min-h-0" />
      </label>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="!h-9 !min-h-0 !px-3 text-xs"
          disabled={busy || !dirty}
          onClick={() => onSave({ base_price: Number(price), duration_min: Number(duration) })}
        >
          Сохранить
        </Button>
        <Button
          variant="text"
          className="!h-9 !min-h-0 !px-3 text-xs"
          disabled={busy}
          onClick={() => onSave({ is_active: !service.is_active })}
        >
          {service.is_active ? 'Скрыть' : 'Показать'}
        </Button>
      </div>
    </div>
  );
}

function LimitsForm({
  status,
  busy,
  onSave,
}: {
  status: AiStatus;
  busy: boolean;
  onSave: (v: { hourly_cap: number; daily_cap: number; budget_usd: number; est_cost_usd: number }) => void;
}) {
  const [hourly, setHourly] = useState(String(status.hourly_cap));
  const [daily, setDaily] = useState(String(status.daily_cap));
  const [budget, setBudget] = useState(String(status.budget_usd));
  const [est, setEst] = useState(String(status.est_cost_usd));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave({
      hourly_cap: Number(hourly),
      daily_cap: Number(daily),
      budget_usd: Number(budget),
      est_cost_usd: Number(est),
    });
  };
  const fields: [string, string, (v: string) => void][] = [
    ['Потолок генераций в час', hourly, setHourly],
    ['Потолок генераций в сутки', daily, setDaily],
    ['Бюджет, $', budget, setBudget],
    ['Макс. цена генерации, $', est, setEst],
  ];
  return (
    <form onSubmit={submit} className="rounded-sm border border-line bg-bg-elevated p-6">
      <h3 className="text-sm uppercase tracking-wide text-text-secondary/70 mb-3">Лимиты и бюджет</h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {fields.map(([label, value, set]) => (
          <label key={label} className="text-xs text-text-secondary">
            {label}
            <Input value={value} onChange={(e) => set(e.target.value)} inputMode="decimal" className="mt-1" />
          </label>
        ))}
      </div>
      <Button type="submit" variant="outline" disabled={busy}>
        Сохранить лимиты
      </Button>
    </form>
  );
}

function GrantForm({ busy, onGrant }: { busy: boolean; onGrant: (email: string, amount: number) => void }) {
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('1');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onGrant(email.trim(), Number(amount));
      }}
      className="rounded-sm border border-line bg-bg-elevated p-6"
    >
      <h3 className="text-sm uppercase tracking-wide text-text-secondary/70 mb-3">Бонусные попытки</h3>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input type="email" placeholder="email клиента" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="sm:!w-24" />
      </div>
      <Button type="submit" variant="outline" disabled={busy || !email}>
        Начислить
      </Button>
      <p className="mt-2 text-xs text-text-secondary/60">Каждое начисление записывается в журнал квот.</p>
    </form>
  );
}

function SettingField({
  label,
  value,
  busy,
  onSave,
}: {
  label: string;
  value: string;
  busy: boolean;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="rounded-sm border border-line bg-bg-elevated p-4">
      <label className="block text-xs text-text-secondary mb-2">{label}</label>
      <div className="flex gap-2">
        <Input value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        <Button variant="outline" disabled={busy || v === value || !v} onClick={() => onSave(v)}>
          OK
        </Button>
      </div>
    </div>
  );
}
