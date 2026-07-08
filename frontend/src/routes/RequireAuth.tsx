import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from '../components/ui';

export interface RequireAuthProps {
  children: ReactNode;
  /**
   * Client-side UX gating only (e.g. hides an "Employees" nav link, redirects
   * away from an obviously-wrong page). This is NOT a security boundary — the
   * real authorization control is the server-side RolesGuard on each service.
   * Never rely on this prop alone to protect sensitive data or actions.
   */
  requiredRole?: string;
}

export function RequireAuth({ children, requiredRole }: RequireAuthProps): JSX.Element {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  if (requiredRole && user?.roleName !== requiredRole) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
}
