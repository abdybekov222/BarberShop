'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';

export interface DropdownItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
  danger?: boolean;
  hint?: string;
}

/** Выпадающее меню (шапка: аккаунт, язык, разделы). Закрывается по клику снаружи и Esc. */
export function Dropdown({
  trigger,
  items,
  label,
  align = 'right',
  header,
  hover = false,
}: {
  trigger: ReactNode;
  items: DropdownItem[];
  label: string;
  align?: 'left' | 'right';
  header?: ReactNode;
  hover?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const hoverProps = hover
    ? {
        onMouseEnter: () => {
          if (timer.current) clearTimeout(timer.current);
          setOpen(true);
        },
        onMouseLeave: () => {
          timer.current = setTimeout(() => setOpen(false), 150);
        },
      }
    : {};

  return (
    <div ref={root} className="relative" {...hoverProps}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((v) => !v)} className="flex items-center">
        {trigger}
      </button>
      {open && (
        <div role="menu" className={`dropdown-panel absolute top-full z-[60] mt-2 min-w-[220px] p-1.5 ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {header && <div className="border-b border-line px-3 pb-3 pt-2">{header}</div>}
          {items.map((it) => {
            const cls = `flex w-full items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-subtle ${
              it.danger ? 'text-error' : 'text-text-secondary hover:text-text-primary'
            }`;
            const content = (
              <>
                {it.icon && <span className="shrink-0 opacity-80">{it.icon}</span>}
                <span className="flex-1">{it.label}</span>
                {it.hint && <span className="text-xs text-text-secondary/60">{it.hint}</span>}
              </>
            );
            return it.href ? (
              <Link key={it.label} href={it.href} role="menuitem" className={cls} onClick={() => setOpen(false)}>
                {content}
              </Link>
            ) : (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                className={cls}
                onClick={() => {
                  setOpen(false);
                  it.onClick?.();
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
