'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTrips, useOrders, useDrivers } from '@/hooks/useFirestore';
import { Trip, Order, User } from '@/lib/types';
import { 
  LogOut, 
  Users, 
  CheckCircle,
  UserPlus,
  FileText,
  Clock,
  AlertTriangle,
  Download,
  Truck
} from 'lucide-react';
import CreateDriverModal from './CreateDriverModal';
import TripsTable from './TripsTable';
import TripDetailModal from './TripDetailModal';
import ImageViewerModal from './ImageViewerModal';
import { getDisplayCompanyName } from '@/lib/companyUtils';
import * as XLSX from 'xlsx';

export default function OperatorDashboard() {
  const { userProfile, logout } = useAuth();
  const { trips, loading: tripsLoading, deleteTrip } = useTrips();
  const { orders, loading: ordersLoading } = useOrders();
  
  // Debug: log dei carriers dell'operatore
  console.log('Operatore carriers:', userProfile?.carriers);
  console.log('Operatore completo:', userProfile);
  
  // Get drivers for all operator's carriers
  const operatorCarriers = userProfile?.carriers || (userProfile?.carrier ? [userProfile.carrier] : []);
  
  // Since we can't use multiple useDrivers hooks, we'll get all drivers and filter
  const { drivers, loading: driversLoading } = useDrivers();
  
  const [showCreateDriver, setShowCreateDriver] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedTripForDetail, setSelectedTripForDetail] = useState<Trip | null>(null);
  const [selectedTripForImages, setSelectedTripForImages] = useState<Trip | null>(null);

  // Filter drivers by operator's carriers
  const myDrivers = useMemo(() => {
    if (operatorCarriers.length === 0) return [];
    return drivers.filter(driver => {
      const driverCarriers = driver.carriers || (driver.carrier ? [driver.carrier] : []);
      return operatorCarriers.some(opCarrier => driverCarriers.includes(opCarrier));
    });
  }, [drivers, operatorCarriers]);
  
  // Filter trips and orders to only show those related to operator's drivers
  const myTrips = useMemo(() => {
    const myDriverIds = myDrivers.map(driver => driver.id);
    return trips.filter(trip => 
      trip.driverId && myDriverIds.includes(trip.driverId)
    );
  }, [trips, myDrivers]);

  const myOrders = useMemo(() => {
    const myTripOrderIds = myTrips.map(trip => trip.orderId);
    return orders.filter(order => myTripOrderIds.includes(order.id));
  }, [orders, myTrips]);

  // Handle trip detail view
  const handleViewTripDetails = (trip: Trip) => {
    setSelectedTripForDetail(trip);
  };

  const handleCloseDetailModal = () => {
    setSelectedTripForDetail(null);
  };

  const handleViewImages = (trip: Trip) => {
    setSelectedTripForImages(trip);
    setShowImageViewer(true);
  };

  // Handle trip deletion (operator can delete trips by their drivers)
  const handleDeleteTrip = async (trip: Trip) => {
    if (!confirm('Sei sicuro di voler eliminare questo viaggio? Questa azione non può essere annullata.')) {
      return;
    }

    try {
      await deleteTrip(trip.id);
      alert('Viaggio eliminato con successo');
    } catch (error) {
      console.error('Errore durante l\'eliminazione:', error);
      alert('Errore durante l\'eliminazione del viaggio');
    }
  };

  // Export function for operator's trips
  const handleExport = () => {
    const dataToExport = myTrips.map(trip => {
      const order = myOrders.find(o => o.id === trip.orderId);
      let dateString = '';
      if (trip.createdAt) {
        try {
          const date = trip.createdAt instanceof Date ? trip.createdAt : new Date(trip.createdAt);
          dateString = date.toLocaleDateString('it-IT');
        } catch {
          dateString = 'N/A';
        }
      }
      
      const driver = drivers.find(d => d.id === trip.driverId);
      const driverCarriers = driver?.carriers || (driver?.carrier ? [driver.carrier] : []);
      
      return {
        'Società': getDisplayCompanyName(trip.loadingNoteData?.companyName),
        'Deposito': trip.loadingNoteData?.depotLocation || 'N/A',
        'Data': trip.loadingNoteData?.loadingDate || 'N/A',
        'Cliente': trip.loadingNoteData?.consigneeName || 'N/A',
        'Prodotto': trip.loadingNoteData?.productDescription || 'N/A',
        'Quantità Consegnata (LITRI)': trip.loadingNoteData?.volumeLiters || 'N/A',
        'Densità a 15°': trip.loadingNoteData?.densityAt15C || 'N/A',
        'Densità Ambiente': trip.edasData?.productInfo?.densityAtAmbientTemp || 'N/A',
        'Quantità in KG': trip.loadingNoteData?.netWeightKg || 'N/A',
        'Vettore': driverCarriers.join(', ') || 'N/A',
        'Autista': trip.loadingNoteData?.driverName || trip.driverName || 'N/A',
        'Numero DAS': trip.loadingNoteData?.documentNumber || 'N/A'
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Viaggi');
    
    const today = new Date().toISOString().split('T')[0];
    const carrierName = userProfile?.carrier || 'Operatore';
    XLSX.writeFile(wb, `viaggi-${carrierName}-${today}.xlsx`);
  };

  // Statistics for operator's data only
  const completedTrips = myTrips.filter(trip => trip.status === 'completato');
  const pendingTrips = myTrips.filter(trip => trip.status !== 'completato');

  if (tripsLoading || ordersLoading || driversLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Se l'operatore non ha vettori assegnati
  if (operatorCarriers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                  Dashboard Operatore
                </h1>
                <p className="text-gray-600">Ciao {userProfile?.name}</p>
              </div>
              <button
                onClick={logout}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Vettore Non Assegnato
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>
                    Il tuo account operatore non ha un vettore assegnato. 
                    Contatta l'amministratore per assegnare un vettore al tuo account.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                Dashboard Operatore - {operatorCarriers.join(', ') || 'Vettore'}
              </h1>
              <p className="text-gray-600">Ciao {userProfile?.name}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        {/* Info Card for Operator */}
        {operatorCarriers.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-medium text-blue-900 mb-2">ℹ️ Gestione Vettori</h4>
            <p className="text-sm text-blue-800">
              Gestisci gli autisti e i viaggi {operatorCarriers.length === 1 ? 'del vettore' : 'dei vettori'} <strong>{operatorCarriers.join(', ')}</strong>. 
              Puoi creare nuovi autisti, visualizzare tutti i viaggi dei tuoi autisti ed esportare i dati.
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Users className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Miei Autisti
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {myDrivers.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Truck className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Viaggi Totali
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {myTrips.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Clock className="h-6 w-6 text-yellow-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Viaggi in Corso
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {pendingTrips.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Viaggi Completati
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {completedTrips.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-8 flex flex-wrap gap-4">
          <button
            onClick={() => setShowCreateDriver(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Crea Nuovo Autista
          </button>
          
          {myTrips.length > 0 && (
            <button
              onClick={handleExport}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Esporta Viaggi Excel
            </button>
          )}
        </div>

        {/* Drivers Table */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              I Miei Autisti ({myDrivers.length})
            </h3>
            
            {myDrivers.length > 0 ? (
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nome
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vettore
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Viaggi Completati
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {myDrivers.map((driver) => {
                      const driverTrips = myTrips.filter(trip => trip.driverId === driver.id);
                      const driverCompletedTrips = driverTrips.filter(trip => trip.status === 'completato');
                      const driverCarriers = driver.carriers || (driver.carrier ? [driver.carrier] : []);
                      
                      return (
                        <tr key={driver.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {driver.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {driver.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {driverCarriers.join(', ') || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {driverCompletedTrips.length} / {driverTrips.length}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun autista trovato</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Non hai ancora autisti associati al tuo vettore. Crea il primo autista.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Trips Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Viaggi dei Miei Autisti ({myTrips.length})
            </h3>
            
            {myTrips.length > 0 ? (
              <TripsTable
                trips={myTrips}
                orders={myOrders}
                drivers={drivers}
                onViewDetails={handleViewTripDetails}
                onDeleteTrip={handleDeleteTrip}
              />
            ) : (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun viaggio trovato</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Non ci sono ancora viaggi per i tuoi autisti.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      {showCreateDriver && (
        <CreateDriverModal
          onClose={() => setShowCreateDriver(false)}
          operatorCarrier={operatorCarriers[0]}
        />
      )}

      {selectedTripForDetail && (
        <TripDetailModal
          isOpen={true}
          trip={selectedTripForDetail}
          order={myOrders.find(o => o.id === selectedTripForDetail.orderId) || null}
          onClose={handleCloseDetailModal}
          onViewImages={handleViewImages}
        />
      )}

      {/* Image Viewer Modal */}
      {showImageViewer && selectedTripForImages && (
        <ImageViewerModal
          trip={selectedTripForImages}
          isOpen={showImageViewer}
          onClose={() => {
            setShowImageViewer(false);
            setSelectedTripForImages(null);
          }}
        />
      )}
    </div>
  );
} 