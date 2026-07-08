import { createBrowserRouter } from 'react-router-dom';
import { GuestLayout } from './GuestLayout';
import { AdminLayout } from './AdminLayout';
import { RequireAuth } from './RequireAuth';
import { PageStub } from '../pages/PageStub';
import { HomePage } from '../pages/guest/HomePage';
import { AboutPage } from '../pages/guest/AboutPage';
import { RoomsPage } from '../pages/guest/RoomsPage';
import { RoomDetailPage } from '../pages/guest/RoomDetailPage';
import { BookingNewPage } from '../pages/guest/BookingNewPage';
import { BookingConfirmationPage } from '../pages/guest/BookingConfirmationPage';
import { BookingLookupPage } from '../pages/guest/BookingLookupPage';
import { LoginPage } from '../pages/admin/LoginPage';
import { MfaPage } from '../pages/admin/MfaPage';
import { DashboardPage } from '../pages/admin/DashboardPage';
import { BookingsPage } from '../pages/admin/BookingsPage';
import { BookingDetailPage } from '../pages/admin/BookingDetailPage';
import { RoomsPage as AdminRoomsPage } from '../pages/admin/RoomsPage';
import { RoomTypesPage as AdminRoomTypesPage } from '../pages/admin/RoomTypesPage';
import { EmployeesPage } from '../pages/admin/EmployeesPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <GuestLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'rooms', element: <RoomsPage /> },
      { path: 'rooms/:id', element: <RoomDetailPage /> },
      { path: 'booking/new/:roomTypeId', element: <BookingNewPage /> },
      { path: 'booking/:id/confirmation', element: <BookingConfirmationPage /> },
      { path: 'booking/lookup', element: <BookingLookupPage /> },
      { path: '*', element: <PageStub title="Page Not Found" /> },
    ],
  },
  {
    path: '/admin/login',
    element: <LoginPage />,
  },
  {
    path: '/admin/mfa',
    element: <MfaPage />,
  },
  {
    path: '/admin',
    element: (
      <RequireAuth>
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'bookings', element: <BookingsPage /> },
      { path: 'bookings/:id', element: <BookingDetailPage /> },
      {
        path: 'rooms',
        element: (
          <RequireAuth requiredRole="Admin">
            <AdminRoomsPage />
          </RequireAuth>
        ),
      },
      {
        path: 'room-types',
        element: (
          <RequireAuth requiredRole="Admin">
            <AdminRoomTypesPage />
          </RequireAuth>
        ),
      },
      {
        path: 'employees',
        element: (
          <RequireAuth requiredRole="Admin">
            <EmployeesPage />
          </RequireAuth>
        ),
      },
      { path: '*', element: <PageStub title="Page Not Found" /> },
    ],
  },
]);
