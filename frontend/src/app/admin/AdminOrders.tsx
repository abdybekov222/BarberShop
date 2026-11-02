'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatKgs } from '@barbershop/shared';
import { apiGet, apiSend } from '../../lib/api';
import { ORDER_STATUS_LABEL } from '../../lib/shop';
import { Select } from '../../components/ui/Select';

interface Order {
  id: string;
  number: number;
  customer_name: string;
  phone: string;
  status: string;
  total: number;
  delivery: 'pickup' | 'courier';
  address: string | null;
  comment: string | null;
  payment_method: string;
  paid_at: string | null;
  created_at: string;
  items: { id: string; name: string; qty: number; price: number }[];
}

const NEXT: Record<string, string[]> = {
  new: ['processing', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
};

/** Управление заказами магазина: фильтр, поиск, пагинация, смена статуса. */
export function AdminOrders({ token }: { token: () => Promise<string | null> }) {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Order[]; pages: number; total: number } | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ page: String(page) });
    if (status) qs.set('status', status);
    if (q) qs.set('q', q);
    setData(await apiGet<{ items: Order[]; pages: number; total: number }>(`/api/admin/orders?${qs}`, await token()).catch(() => null));
  }, [page, status, q, token]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 250);
    return () => clearTimeout(id);
  }, [load]);

  const setOrderStatus = async (id: string, s: string) => {
    if (s === 'cancelled' && !window.confirm('Отменить заказ? Товары вернутся на склад.')) return;
    await apiSend('PATCH', `/api/admin/orders/${id}/status`, await token(), { status: s });
    await load();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Select
          size="sm"
          label="Статус"
          value={status}
          onChange={(s) => {
            setStatus(s);
            setPage(1);
          }}
          options={[{ value: '', label: 'Все статусы' }, ...Object.keys(ORDER_STATUS_LABEL).map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s]! }))]}
        />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="№, имя или телефон"
          className="h-9 rounded-sm border border-line bg-bg-elevated px-3 text-sm text-text-primary sm:ml-auto"
        />
      </div>

      {!data ? (
        <div className="h-40 animate-pulse rounded-sm bg-bg-elevated-2" />
      ) : data.items.length === 0 ? (
        <p className="py-10 text-center">Заказов нет</p>
      ) : (
        <ul className="space-y-3">
          {data.items.map((o) => (
            <li key={o.id} className="rounded-sm border border-line bg-bg-elevated p-4">
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                <div className="min-w-0">
                  <p className="font-medium text-text-primary">
                    №{o.number} · {o.customer_name}{' '}
                    <a href={`tel:${o.phone}`} className="font-normal text-gold-500">
                      {o.phone}
                    </a>
                  </p>
                  <p className="text-xs">
                    {new Date(o.created_at).toLocaleString('ru-RU', { timeZone: 'Asia/Bishkek', dateStyle: 'short', timeStyle: 'short' })} ·{' '}
                    {o.delivery === 'courier' ? `курьер: ${o.address}` : 'самовывоз'} ·{' '}
                    {o.payment_method === 'cash' ? 'при получении' : o.paid_at ? 'оплачен картой' : 'ожидает оплаты'}
                  </p>
                  <p className="mt-2 text-sm">{o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</p>
                  {o.comment && <p className="mt-1 text-xs">«{o.comment}»</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="font-serif text-xl text-text-primary">{formatKgs(o.total)}</span>
                  {(NEXT[o.status] ?? []).length > 0 ? (
                    <Select
                      size="sm"
                      align="right"
                      label="Статус заказа"
                      value={o.status}
                      onChange={(s) => s !== o.status && setOrderStatus(o.id, s)}
                      options={[o.status, ...(NEXT[o.status] ?? [])].map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] ?? s }))}
                    />
                  ) : (
                    <span className="text-xs">{ORDER_STATUS_LABEL[o.status]}</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && data.pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-10 rounded-sm border border-line px-4 disabled:opacity-30">
            Назад
          </button>
          <span>
            {page} / {data.pages}
          </span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="h-10 rounded-sm border border-line px-4 disabled:opacity-30">
            Вперёд
          </button>
        </div>
      )}
    </div>
  );
}
