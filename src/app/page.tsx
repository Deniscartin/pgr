'use client';

import { useAuth } from '@/contexts/AuthContext';
import LoginForm from '@/components/LoginForm';
import AdminDashboard from '@/components/AdminDashboard';
import DriverDashboard from '@/components/DriverDashboard';
import OperatorDashboard from '@/components/OperatorDashboard';
import InvoiceDashboard from '@/components/InvoiceDashboard';

export default function Home() {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!currentUser || !userProfile) {
    return <LoginForm />;
  }

  // Route based on user role
  if (userProfile.role === 'admin') {
    return <AdminDashboard />;
  } else if (userProfile.role === 'autista') {
    return <DriverDashboard />;
  } else if (userProfile.role === 'operatore') {
    return <OperatorDashboard />;
  } else if (userProfile.role === 'gestore_fatture') {
    return <InvoiceDashboard />;
  }

  // Fallback for unknown roles
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Ruolo non riconosciuto
        </h2>
        <p className="text-gray-600 mb-4">
          Il tuo account non ha un ruolo valido assegnato.
        </p>
        <p className="text-gray-600">
          Contatta l&apos;amministratore per assistenza.
        </p>
      </div>
    </div>
  );
}
