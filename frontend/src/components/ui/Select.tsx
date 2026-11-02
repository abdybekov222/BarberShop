'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/**
 * Выпадающий список в стиле сайта (вместо системного <select>).
 * Клавиатура: ↑/↓, Enter, Esc; закрывается кликом снаружи. Роли ARIA listbox/option.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  className = '',
  size = 'md',
  align = 'left',
}: {
  value: T;
  options: SelectOption<T>[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    return () => document.removeEventListener('mousedown', close);
  }, [open, options, value]);

  const pick = (v: T) => {
    onChange(v);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return setOpen(false);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return setOpen(true);
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    }
    if ((e.key === 'Enter' || e.key === ' ') && open) {
      e.preventDefault();
      pick(options[active]!.value);
    }
  };

  const h = size === 'sm' ? 'h-10 text-sm' : 'h-12 text-[15px]';

  return (
    <div ref={root} className={`relative ${open ? "z-50" : ""} ${className}`} onKeyDown={onKey}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        aria-controls={`${id}-list`}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-bg-elevated px-4 text-left text-text-primary transition-colors ${h} ${
          open ? 'border-gold-500' : 'border-line hover:border-line-strong'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {current?.icon}
          {current?.label}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className={`dropdown-panel absolute top-full z-50 mt-2 max-h-72 min-w-full overflow-auto p-1.5 ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(o.value)}
              className={`flex cursor-pointer items-center justify-between gap-6 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm ${
                i === active ? 'bg-subtle text-text-primary' : 'text-text-secondary'
              }`}
            >
              <span className="flex items-center gap-2">
                {o.icon}
                {o.label}
              </span>
              {o.value === value && <Check size={15} className="text-gold-500" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
