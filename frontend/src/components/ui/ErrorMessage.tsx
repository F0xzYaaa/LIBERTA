import { HTMLAttributes } from 'react';
import clsx from 'clsx';

export interface ErrorMessageProps extends HTMLAttributes<HTMLDivElement> {
  message: string;
}

export function ErrorMessage({ message, className, ...props }: ErrorMessageProps): JSX.Element {
  return (
    <div
      role="alert"
      className={clsx(
        'rounded-card border border-red-200 bg-red-50 px-4 py-3',
        'font-sans text-sm text-red-700',
        className,
      )}
      {...props}
    >
      {message}
    </div>
  );
}
