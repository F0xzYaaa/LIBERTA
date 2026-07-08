import { HTMLAttributes } from 'react';
import clsx from 'clsx';

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps): JSX.Element {
  return <div className={clsx('rounded-card bg-white p-6 shadow-card', className)} {...props} />;
}
