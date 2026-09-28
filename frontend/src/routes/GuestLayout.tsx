import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import logo from '../assets/LIBERTAR_Logo.png';

interface GuestNavItem {
  to: string;
  label: string;
  end?: boolean;
}

const navItems: GuestNavItem[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/rooms', label: 'Rooms' },
  { to: '/booking/lookup', label: 'Find My Booking' },
];

export function GuestLayout(): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="border-b border-sage-gray/15 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <NavLink to="/" className="flex items-center gap-3">
            <img src={logo} alt="LIBERTA HUAHIN" className="h-10 w-10 rounded-full object-cover" />
            <span className="font-serif text-xl font-semibold text-primary-dark">
              LIBERTA HUAHIN
            </span>
          </NavLink>
          <nav className="flex items-center gap-6 font-sans text-sm font-medium">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'transition-colors',
                    isActive ? 'text-primary' : 'text-sage-gray hover:text-primary',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-sage-gray/15 bg-primary-dark py-8 text-cream">
        <div className="mx-auto max-w-6xl px-6 text-center font-sans text-sm">
          <p className="font-serif text-lg">LIBERTA HUAHIN</p>
          <p className="mt-2 text-cream/70">
            &copy; {new Date().getFullYear()} LIBERTA HUAHIN. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
