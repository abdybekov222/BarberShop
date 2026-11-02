import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'gold' | 'outline' | 'text';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  gold: 'bg-gold-500 text-black font-semibold hover:bg-gold-400',
  outline: 'border border-gold-500/70 text-gold-400 hover:bg-gold-500/10 hover:border-gold-500',
  text: 'text-text-secondary hover:text-text-primary',
};

/** Базовая кнопка. Минимальная touch-зона 44×44 px (ТЗ §2.1), scale 0.98 на нажатие (§2.2). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'gold', className = '', ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 h-12 min-h-[44px] text-sm font-semibold transition-[background-color,border-color,color,transform] duration-300 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
