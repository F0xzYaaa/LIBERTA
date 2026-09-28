import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui';
import logo from '../assets/LIBERTAR_Logo.png';

interface AdminNavItem {
  to: string;
  label: string;
  /** Hidden for the Staff role — an admin-only section. */
  adminOnly?: boolean;
}

const navItems: AdminNavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/bookings', label: 'Bookings' },
  { to: '/admin/rooms', label: 'Rooms', adminOnly: true },
  { to: '/admin/room-types', label: 'Room Types', adminOnly: true },
  { to: '/admin/employees', label: 'Employees', adminOnly: true },
];

export function AdminLayout(): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.roleName === 'Admin';
  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-cream">
      <aside className="flex w-64 flex-col justify-between border-r border-sage-gray/15 bg-primary-dark text-cream">
        <div>
          <div className="flex items-center gap-3 px-6 py-6">
            <img src={logo} alt="LIBERTA HUAHIN" className="h-9 w-9 rounded-full object-cover" />
            <span className="font-serif text-lg font-semibold">LIBERTA Admin</span>
          </div>
          <nav className="mt-4 flex flex-col gap-1 px-3 font-sans text-sm">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'rounded-button px-3 py-2 transition-colors',
                    isActive ? 'bg-accent text-primary-dark' : 'text-cream/80 hover:bg-white/10',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="px-6 py-6">
          {user && (
            <p className="mb-3 font-sans text-xs text-cream/60">
              Signed in as <span className="font-medium text-cream">{user.username}</span> (
              {user.roleName})
            </p>
          )}
          <Button variant="secondary" className="w-full" onClick={() => void handleLogout()}>
            Log out
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
