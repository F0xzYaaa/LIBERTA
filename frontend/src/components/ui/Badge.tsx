import { HTMLAttributes } from 'react';
import clsx from 'clsx';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-sage-gray/15 text-sage-gray',
  success: 'bg-primary/10 text-primary',
  warning: 'bg-accent/20 text-accent',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-sage-teal/15 text-sage-teal',
};

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps): JSX.Element {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5',
        'font-sans text-xs font-medium',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
