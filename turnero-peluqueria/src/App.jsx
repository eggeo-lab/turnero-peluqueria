import { Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import ClientBookingPage from './pages/ClientBookingPage';
import AdminConfirmPage from './pages/AdminConfirmPage';
import AdminInboxPage from './pages/AdminInboxPage';

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppShell variant="client">
            <ClientBookingPage />
          </AppShell>
        }
      />
      <Route
        path="/admin"
        element={
          <AppShell variant="admin">
            <AdminInboxPage />
          </AppShell>
        }
      />
      <Route
        path="/admin/confirmar/:turnoId"
        element={
          <AppShell variant="admin">
            <AdminConfirmPage />
          </AppShell>
        }
      />
    </Routes>
  );
}
