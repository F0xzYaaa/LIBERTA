import { AnchorHTMLAttributes, forwardRef } from 'react';
import { Link, LinkProps } from 'react-router-dom';
import clsx from 'clsx';
import type { ButtonVariant } from './Button';

export interface LinkButtonProps
  extends LinkProps, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-cream hover:bg-primary-dark',
  secondary: 'bg-accent text-primary-dark hover:brightness-95',
  ghost: 'bg-transparent text-primary border border-primary hover:bg-primary/5',
};

/**
 * Same visual treatment as `Button`, but renders an `<a>` (react-router
 * `Link`) instead of a `<button>` -- for navigation CTAs, where nesting a
 * `<button>` inside an `<a>` would be invalid HTML.
 */
export const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(
  ({ variant = 'primary', className, ...props }, ref) => (
    <Link
      ref={ref}
      className={clsx(
        // Match Button's 44px touch target (py-3 + text-sm's 20px line-height).
        'inline-flex items-center justify-center rounded-button px-5 py-3',
        'font-sans text-sm font-medium transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  ),
);

LinkButton.displayName = 'LinkButton';
