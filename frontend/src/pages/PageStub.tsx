import { ReactNode } from 'react';
import { Card } from '../components/ui';

export interface PageStubProps {
  title: string;
  children?: ReactNode;
}

/**
 * Placeholder used by every route in Stage 5 Part 1 — real page
 * implementations land in later parts. Kept intentionally minimal so it's
 * obvious at a glance which routes are wired but not yet built.
 */
export function PageStub({ title, children }: PageStubProps): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Card>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 font-sans text-sm text-sage-gray">
          This page will be implemented in a later part of Stage 5.
        </p>
        {children}
      </Card>
    </div>
  );
}
