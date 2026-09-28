import { ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-cream hover:bg-primary-dark disabled:bg-sage-gray/60',
  secondary: 'bg-accent text-primary-dark hover:brightness-95 disabled:bg-sage-gray/40',
  ghost:
    'bg-transparent text-primary border border-primary hover:bg-primary/5 disabled:text-sage-gray disabled:border-sage-gray/40',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={clsx(
        // py-3 + text-sm's 20px line-height = 44px tall, meeting the 44x44
        // minimum touch target size (was py-2.5 / 40px tall).
        'inline-flex items-center justify-center rounded-button px-5 py-3',
        'font-sans text-sm font-medium transition-colors',
        'disabled:cursor-not-allowed',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = 'Button';
