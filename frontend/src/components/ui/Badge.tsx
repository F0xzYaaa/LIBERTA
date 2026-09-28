import { HTMLAttributes } from 'react';
import clsx from 'clsx';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

// Tone backgrounds keep their brand-color tint, but text uses primary-dark
// rather than the tone color itself: at these light tint opacities the tone
// colors (accent/sage-teal/sage-gray) fall below the 4.5:1 contrast ratio
// required for body-size text (verified: accent/20 ~2.3:1, sage-teal/15
// ~3.9:1, sage-gray/15 ~4.1:1). primary-dark on the same tints is ~12.5:1.
const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-sage-gray/15 text-primary-dark',
  success: 'bg-primary/10 text-primary',
  warning: 'bg-accent/20 text-primary-dark',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-sage-teal/15 text-primary-dark',
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
