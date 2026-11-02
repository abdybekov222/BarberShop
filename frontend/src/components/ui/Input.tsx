import {
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
} from 'react';

const BASE_CLS =
  'w-full rounded-xl border border-line bg-bg-elevated px-4 text-base text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-gold-500 transition-colors';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  as?: 'input';
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  as: 'textarea';
}

type Props = InputProps | TextareaProps;

/** Базовый инпут или textarea. Шрифт ≥ 16px, чтобы iOS не зумила (ТЗ §2.3). */
export const Input = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  Props
>(({ className = '', as: asEl = 'input', ...props }, ref) => {
  if (asEl === 'textarea') {
    return (
      <textarea
        ref={ref as React.Ref<HTMLTextAreaElement>}
        className={`${BASE_CLS} min-h-[44px] py-2 ${className}`}
        {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)}
      />
    );
  }
  return (
    <input
      ref={ref as React.Ref<HTMLInputElement>}
      className={`${BASE_CLS} h-12 min-h-[44px] ${className}`}
      {...(props as InputHTMLAttributes<HTMLInputElement>)}
    />
  );
});
Input.displayName = 'Input';
