'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import type { TKey } from '../../i18n/dictionaries';

type ConfirmOptions = { title: string; message: string; confirmLabel?: string; danger?: boolean };
type PromptOptions = ConfirmOptions & { defaultValue?: string; placeholder?: string };
type Request =
  | { kind: 'confirm'; options: ConfirmOptions }
  | { kind: 'prompt'; options: PromptOptions };
type Dialogs = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const DialogContext = createContext<Dialogs | null>(null);

export function useDialog(): Dialogs {
  const value = useContext(DialogContext);
  if (!value) throw new Error('useDialog must be used inside DialogProvider');
  return value;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [request, setRequest] = useState<Request | null>(null);
  const resolver = useRef<((value: boolean | string | null) => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    resolver.current = (value) => resolve(value === true);
    setRequest({ kind: 'confirm', options });
  }), []);

  const prompt = useCallback((options: PromptOptions) => new Promise<string | null>((resolve) => {
    resolver.current?.(null);
    resolver.current = (value) => resolve(typeof value === 'string' ? value : null);
    setRequest({ kind: 'prompt', options });
  }), []);

  const finish = useCallback((value: boolean | string | null) => {
    resolver.current?.(value);
    resolver.current = null;
    setRequest(null);
  }, []);

  useEffect(() => {
    if (!request) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(request.kind === 'confirm' ? false : null);
    };
    window.addEventListener('keydown', onKeyDown);
    if (request.kind === 'prompt') inputRef.current?.focus();
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [request, finish]);

  const submitPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    finish(inputRef.current?.value ?? '');
  };

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {request && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => event.target === event.currentTarget && finish(request.kind === 'confirm' ? false : null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-dialog-title"
            className="w-full max-w-md rounded-3xl border border-line bg-bg-elevated p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="app-dialog-title" className="font-serif text-2xl text-text-primary">{request.options.title}</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-text-secondary">{request.options.message}</p>
              </div>
              <button type="button" onClick={() => finish(request.kind === 'confirm' ? false : null)} aria-label={t('common.close')} className="-mr-2 -mt-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-subtle hover:text-text-primary">
                <X size={18} />
              </button>
            </div>
            {request.kind === 'prompt' && (
              <form onSubmit={submitPrompt}>
                <input
                  ref={inputRef}
                  defaultValue={request.options.defaultValue ?? ''}
                  placeholder={request.options.placeholder}
                  className="mt-5 h-12 w-full rounded-xl border border-line bg-bg-primary px-4 text-base text-text-primary outline-none focus:border-gold-500"
                />
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => finish(null)} className="h-11 rounded-full border border-line-strong px-5 text-sm font-medium text-text-primary hover:border-gold-500">
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="h-11 rounded-full bg-gold-500 px-5 text-sm font-semibold text-black hover:bg-gold-400">
                    {request.options.confirmLabel ?? t('common.confirm')}
                  </button>
                </div>
              </form>
            )}
            {request.kind === 'confirm' && (
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => finish(false)} className="h-11 rounded-full border border-line-strong px-5 text-sm font-medium text-text-primary hover:border-gold-500">
                  {t('common.cancel')}
                </button>
                <button type="button" onClick={() => finish(true)} className={`h-11 rounded-full px-5 text-sm font-semibold ${request.options.danger ? 'bg-error text-white hover:bg-error/85' : 'bg-gold-500 text-black hover:bg-gold-400'}`}>
                  {request.options.confirmLabel ?? t('common.confirm')}
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function translateTemplate(t: (key: TKey) => string, key: TKey, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), t(key));
}
