'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatKgs } from '@barbershop/shared';
import { apiGet } from '../../lib/api';

interface Charts {
  daily: { date: string; bookings: number; services: number; shop: number }[];
  topProducts: { name: string; qty: number }[];
  byMaster: { name: string; count: number }[];
  totals: { bookings: number; services: number; shop: number; orders: number };
}

const GOLD = 'var(--gold-500)';
const MUTED = 'var(--text-secondary)';
const tooltipStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--line-strong)',
  borderRadius: 2,
  color: 'var(--text-primary)',
};

/** Статистика салона и магазина (recharts). */
export function AdminCharts({ token }: { token: () => Promise<string | null> }) {
  const [days, setDays] = useState(14);
  const [data, setData] = useState<Charts | null>(null);

  useEffect(() => {
    setData(null);
    token()
      .then((t) => apiGet<Charts>(`/api/admin/stats/charts?days=${days}`, t))
      .then(setData)
      .catch(() => setData(null));
  }, [days, token]);

  if (!data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-72 animate-pulse rounded-sm bg-bg-elevated-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[7, 14, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            aria-pressed={days === d}
            className={`h-9 rounded-sm px-4 text-xs ${days === d ? 'bg-gold-500 font-semibold text-black' : 'border border-line'}`}
          >
            {d} дней
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: 'Записей', v: String(data.totals.bookings) },
          { l: 'Выручка услуг', v: formatKgs(data.totals.services) },
          { l: 'Заказов', v: String(data.totals.orders) },
          { l: 'Продажи магазина', v: formatKgs(data.totals.shop) },
        ].map((s) => (
          <div key={s.l} className="rounded-sm border border-line bg-bg-elevated p-4">
            <p className="text-xs uppercase tracking-wide">{s.l}</p>
            <p className="mt-1 font-serif text-2xl text-text-primary">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-sm border border-line bg-bg-elevated p-4">
          <h3 className="mb-4 font-serif text-lg uppercase">Выручка по дням, сом</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data.daily}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="date" stroke={MUTED} fontSize={11} tickLine={false} />
                <YAxis stroke={MUTED} fontSize={11} tickLine={false} width={50} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatKgs(v)} />
                <Legend />
                <Line type="monotone" dataKey="services" name="Услуги" stroke={GOLD} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="shop" name="Магазин" stroke={MUTED} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-sm border border-line bg-bg-elevated p-4">
          <h3 className="mb-4 font-serif text-lg uppercase">Записи по дням</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.daily}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="date" stroke={MUTED} fontSize={11} tickLine={false} />
                <YAxis stroke={MUTED} fontSize={11} tickLine={false} allowDecimals={false} width={30} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--subtle)' }} />
                <Bar dataKey="bookings" name="Записи" fill={GOLD} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-sm border border-line bg-bg-elevated p-4">
          <h3 className="mb-4 font-serif text-lg uppercase">Загрузка мастеров</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={data.byMaster} layout="vertical">
                <XAxis type="number" stroke={MUTED} fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke={MUTED} fontSize={11} width={130} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--subtle)' }} />
                <Bar dataKey="count" name="Записей" fill={GOLD} radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-sm border border-line bg-bg-elevated p-4">
          <h3 className="mb-4 font-serif text-lg uppercase">Топ товаров</h3>
          {data.topProducts.length === 0 ? (
            <p className="py-16 text-center text-sm">Продаж пока нет</p>
          ) : (
            <ul className="space-y-3">
              {data.topProducts.map((p, i) => {
                const max = data.topProducts[0]!.qty || 1;
                return (
                  <li key={p.name}>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-primary">
                        {i + 1}. {p.name}
                      </span>
                      <span>{p.qty} шт.</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-subtle">
                      <div className="h-full rounded-full bg-gold-500" style={{ width: `${(p.qty / max) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
