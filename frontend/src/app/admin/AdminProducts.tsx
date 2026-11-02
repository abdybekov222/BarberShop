'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { ImagePlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { formatKgs } from '@barbershop/shared';
import { apiGet, apiSend } from '../../lib/api';
import { CATEGORIES, type Product, type ProductCategory, type ProductPage } from '../../lib/shop';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

const CAT_LABEL: Record<ProductCategory, string> = {
  styling: 'Укладка',
  beard: 'Борода',
  shave: 'Бритьё',
  care: 'Уход',
  tools: 'Инструменты',
  gift: 'Наборы',
};

type Draft = {
  id?: string;
  name: string;
  brand: string;
  category: ProductCategory;
  description: string;
  usage: string;
  volume: string;
  price: string;
  old_price: string;
  stock: string;
  image_url: string;
  is_active: boolean;
  is_featured: boolean;
};

const EMPTY: Draft = {
  name: '',
  brand: 'BARS',
  category: 'styling',
  description: '',
  usage: '',
  volume: '',
  price: '',
  old_price: '',
  stock: '10',
  image_url: '',
  is_active: true,
  is_featured: false,
};

/** Admin CRUD товаров: список с поиском, создание, редактирование, удаление, загрузка фото. */
export function AdminProducts({ token }: { token: () => Promise<string | null> }) {
  const [items, setItems] = useState<Product[] | null>(null);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const data = await apiGet<ProductPage>(`/api/admin/products?q=${encodeURIComponent(q)}`, await token()).catch(() => null);
    setItems(data?.items ?? []);
  }, [q, token]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 300);
    return () => clearTimeout(id);
  }, [load]);

  const edit = (p: Product) =>
    setDraft({
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      description: p.description,
      usage: p.usage ?? '',
      volume: p.volume ?? '',
      price: String(p.price),
      old_price: p.old_price ? String(p.old_price) : '',
      stock: String(p.stock),
      image_url: p.image_url,
      is_active: p.is_active,
      is_featured: p.is_featured,
    });

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const { url } = await apiSend<{ url: string }>('POST', '/api/admin/products/upload', await token(), form);
      setDraft((d) => (d ? { ...d, image_url: url } : d));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setMsg(null);
    const body = {
      name: draft.name.trim(),
      brand: draft.brand.trim() || 'BARS',
      category: draft.category,
      description: draft.description.trim(),
      usage: draft.usage.trim() || undefined,
      volume: draft.volume.trim() || undefined,
      price: Number(draft.price),
      old_price: draft.old_price ? Number(draft.old_price) : null,
      stock: Number(draft.stock || 0),
      image_url: draft.image_url,
      is_active: draft.is_active,
      is_featured: draft.is_featured,
    };
    try {
      if (draft.id) await apiSend('PATCH', `/api/admin/products/${draft.id}`, await token(), body);
      else await apiSend('POST', '/api/admin/products', await token(), body);
      setDraft(null);
      setMsg('Сохранено');
      await load();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Product) => {
    if (!window.confirm(`Удалить «${p.name}»?`)) return;
    const r = await apiSend<{ archived: boolean }>('DELETE', `/api/admin/products/${p.id}`, await token()).catch((e: Error) => {
      setMsg(e.message);
      return null;
    });
    if (r) setMsg(r.archived ? 'Товар есть в заказах — он скрыт с сайта' : 'Товар удалён');
    await load();
  };

  const field = (k: keyof Draft) => ({
    value: String(draft?.[k] ?? ''),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((d) => (d ? { ...d, [k]: e.target.value } : d)),
  });

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию" className="pl-9" />
        </label>
        <Button onClick={() => setDraft({ ...EMPTY })}>
          <Plus size={16} /> Добавить товар
        </Button>
      </div>
      {msg && <p className="mb-3 text-sm">{msg}</p>}

      {items === null ? (
        <div className="h-40 animate-pulse rounded-sm bg-bg-elevated-2" />
      ) : (
        <div className="overflow-x-auto rounded-sm border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-bg-elevated text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="p-3">Товар</th>
                <th className="p-3">Категория</th>
                <th className="p-3 text-right">Цена</th>
                <th className="p-3 text-right">Остаток</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((p) => (
                <tr key={p.id} className={p.is_active ? '' : 'opacity-50'}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-bg-elevated-2">
                        <Image src={p.image_url} alt="" fill sizes="40px" className="object-cover" />
                      </span>
                      <span className="text-text-primary">
                        {p.name}
                        {!p.is_active && <span className="ml-2 text-xs">(скрыт)</span>}
                      </span>
                    </div>
                  </td>
                  <td className="p-3">{CAT_LABEL[p.category]}</td>
                  <td className="p-3 text-right text-text-primary">{formatKgs(p.price)}</td>
                  <td className={`p-3 text-right ${p.stock <= 3 ? 'text-error' : ''}`}>{p.stock}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => edit(p)} aria-label={`Изменить ${p.name}`} className="inline-flex h-9 w-9 items-center justify-center hover:text-gold-500">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => remove(p)} aria-label={`Удалить ${p.name}`} className="inline-flex h-9 w-9 items-center justify-center hover:text-error">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Товар">
          <form onSubmit={save} className="my-8 w-full max-w-2xl rounded-sm border border-line bg-bg-primary p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-serif text-2xl uppercase">{draft.id ? 'Изменить товар' : 'Новый товар'}</h3>
              <button type="button" onClick={() => setDraft(null)} aria-label="Закрыть">
                <X size={20} />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-sm border border-dashed border-line-strong bg-bg-elevated text-text-secondary hover:border-gold-500"
                >
                  {draft.image_url ? <Image src={draft.image_url} alt="" fill sizes="160px" className="object-cover" /> : <ImagePlus size={28} />}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                />
                <p className="mt-2 text-xs">Нажмите, чтобы загрузить фото</p>
              </div>
              <div className="grid gap-3">
                <Input placeholder="Название" required {...field('name')} />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Бренд" {...field('brand')} />
                  <Select
                    label="Категория"
                    value={draft.category}
                    onChange={(c) => setDraft({ ...draft, category: c })}
                    options={CATEGORIES.map((c) => ({ value: c, label: CAT_LABEL[c] }))}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Input placeholder="Цена" inputMode="numeric" required {...field('price')} />
                  <Input placeholder="Старая цена" inputMode="numeric" {...field('old_price')} />
                  <Input placeholder="Остаток" inputMode="numeric" {...field('stock')} />
                </div>
                <Input placeholder="Объём (например, 100 мл)" {...field('volume')} />
              </div>
            </div>
            <Input as="textarea" placeholder="Описание" className="mt-3 h-24 resize-none py-3" {...field('description')} />
            <Input as="textarea" placeholder="Как пользоваться" className="mt-3 h-20 resize-none py-3" {...field('usage')} />
            <div className="mt-3 flex gap-6 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} /> Показывать на сайте
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={draft.is_featured} onChange={(e) => setDraft({ ...draft, is_featured: e.target.checked })} /> Хит
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                Отмена
              </Button>
              <Button type="submit" disabled={busy || !draft.image_url}>
                Сохранить
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
