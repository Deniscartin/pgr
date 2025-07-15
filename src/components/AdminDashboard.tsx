'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders, useTrips, useDrivers } from '@/hooks/useFirestore';
import { Order, Trip } from '@/lib/types';
import { 
  LogOut, 
  Plus, 
  FileText, 
  Users, 
  CheckCircle,
  Clock,
  UserPlus
} from 'lucide-react';
import CreateOrderModal from './CreateOrderModal';
import CreateDriverModal from './CreateDriverModal';
import CreateOperatorModal from './CreateOperatorModal';
import AssignTripModal from './AssignTripModal';
import ManageOrderModal from './ManageOrderModal';
import ImageViewerModal from './ImageViewerModal';

export default function AdminDashboard() {
  const { userProfile, logout } = useAuth();
  const { orders, loading: ordersLoading } = useOrders();
  const { trips, loading: tripsLoading } = useTrips();
  const { drivers, loading: driversLoading } = useDrivers();
  
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showCreateDriver, setShowCreateDriver] = useState(false);
  const [showCreateOperator, setShowCreateOperator] = useState(false);
  const [showAssignTrip, setShowAssignTrip] = useState(false);
  const [showManageOrder, setShowManageOrder] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  const completedTrips = trips.filter(trip => trip.status === 'completato');
  const pendingTrips = trips.filter(trip => trip.status !== 'completato');

  const handleViewImages = (trip: Trip) => {
    setSelectedTrip(trip);
    setShowImageViewer(true);
  };

  if (ordersLoading || tripsLoading || driversLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
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
                Dashboard Admin
              </h1>
              <p className="text-gray-600">Benvenuto, {userProfile?.name}</p>
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
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FileText className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Ordini Totali
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {orders.length}
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
                  <Users className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Autisti
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {drivers.length}
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
            onClick={() => setShowCreateOrder(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuovo Ordine
          </button>
          <button
            onClick={() => setShowCreateDriver(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Crea Autista
          </button>
          <button
            onClick={() => setShowCreateOperator(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Crea Operatore
          </button>
          <button
            onClick={() => {
              // Simple export with available trip data  
              const dataToExport = trips.map(trip => {
                let dateString = 'N/A';
                if (trip.createdAt) {
                  try {
                    // Handle both Firestore Timestamp and Date objects
                    const date = trip.createdAt instanceof Date ? trip.createdAt : new Date(trip.createdAt);
                    dateString = date.toLocaleDateString();
                  } catch {
                    dateString = 'N/A';
                  }
                }
                
                return {
                  'ID': trip.id,
                  'Autista': trip.driverName,
                  'Stato': trip.status,
                  'Data Creazione': dateString,
                  'Note di Carico': trip.loadingNoteImageUrl ? 'Presente' : 'Non presente',
                  'Cartello Conta Litro': trip.cartelloCounterImageUrl ? 'Presente' : 'Non presente',
                };
              });
              
              // Use a generic export function or implement a simple one
              console.log('Exporting data:', dataToExport);
              // For now, just log the data. You can implement actual Excel export later
              alert(`Preparazione export di ${dataToExport.length} viaggi completata. Controlla la console.`);
            }}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <FileText className="w-4 h-4 mr-2" />
            Esporta Dati
          </button>
        </div>

        {/* Simple trips list for now */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Viaggi Recenti</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Lista dei viaggi più recenti</p>
          </div>
          <div className="border-t border-gray-200">
            {trips.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-gray-500">Nessun viaggio trovato</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {trips.slice(0, 10).map((trip) => {
                  const order = orders.find(o => o.id === trip.orderId);
                  return (
                    <li key={trip.id} className="px-4 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {trip.driverName} - {order?.orderNumber || 'N/A'}
                          </p>
                          <p className="text-sm text-gray-500">
                            Status: {trip.status} | Cliente: {order?.customerName || 'N/A'}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          {(trip.edasImageUrl || trip.loadingNoteImageUrl || trip.cartelloCounterImageUrl) && (
                            <button
                              onClick={() => handleViewImages(trip)}
                              className="text-indigo-600 hover:text-indigo-900 text-sm"
                            >
                              Visualizza
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      {showCreateOrder && (
        <CreateOrderModal 
          onClose={() => setShowCreateOrder(false)}
        />
      )}
      
      {showCreateDriver && (
        <CreateDriverModal 
          onClose={() => setShowCreateDriver(false)}
        />
      )}

      {showCreateOperator && (
        <CreateOperatorModal 
          onClose={() => setShowCreateOperator(false)}
        />
      )}

      {showAssignTrip && selectedOrder && (
        <AssignTripModal 
          order={selectedOrder}
          drivers={drivers}
          onClose={() => {
            setShowAssignTrip(false);
            setSelectedOrder(null);
          }}
        />
      )}
      
      {showManageOrder && selectedOrder && (
        <ManageOrderModal 
          order={selectedOrder}
          drivers={drivers}
          currentTrip={undefined}
          onClose={() => {
            setShowManageOrder(false);
            setSelectedOrder(null);
          }}
        />
      )}

      {/* Image Viewer Modal */}
      {showImageViewer && selectedTrip && (
        <ImageViewerModal
          trip={selectedTrip}
          isOpen={showImageViewer}
          onClose={() => {
            setShowImageViewer(false);
            setSelectedTrip(null);
          }}
        />
      )}
    </div>
  );
} 