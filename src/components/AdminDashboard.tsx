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
import CreateInvoiceManagerModal from './CreateInvoiceManagerModal';
import AssignTripModal from './AssignTripModal';
import ManageOrderModal from './ManageOrderModal';
import ImageViewerModal from './ImageViewerModal';
import TripsTable from './TripsTable';
import TripDetailModal from './TripDetailModal';
import { getDisplayCompanyName } from '@/lib/companyUtils';
import * as XLSX from 'xlsx';

export default function AdminDashboard() {
  const { userProfile, logout } = useAuth();
  const { orders, loading: ordersLoading, deleteOrder, updateOrder } = useOrders();
  const { trips, loading: tripsLoading, deleteTrip, updateTrip } = useTrips();
  const { drivers, loading: driversLoading } = useDrivers();
  
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showCreateDriver, setShowCreateDriver] = useState(false);
  const [showCreateOperator, setShowCreateOperator] = useState(false);
  const [showCreateInvoiceManager, setShowCreateInvoiceManager] = useState(false);
  const [showAssignTrip, setShowAssignTrip] = useState(false);
  const [showManageOrder, setShowManageOrder] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedTripForDetail, setSelectedTripForDetail] = useState<Trip | null>(null);

  const completedTrips = trips.filter(trip => trip.status === 'completato');
  const pendingTrips = trips.filter(trip => trip.status !== 'completato');

  const handleViewImages = (trip: Trip) => {
    setSelectedTrip(trip);
    setShowImageViewer(true);
  };

  const handleViewTripDetails = (trip: Trip) => {
    setSelectedTripForDetail(trip);
  };

  const handleCloseDetailModal = () => {
    setSelectedTripForDetail(null);
  };

  const handleDeleteTrip = async (trip: Trip) => {
    if (!confirm('Sei sicuro di voler eliminare questo viaggio? Questa azione non può essere annullata.')) {
      return;
    }

    try {
      // Elimina il viaggio
      await deleteTrip(trip.id);
      
      // Elimina l'ordine associato se esiste
      if (trip.orderId) {
        await deleteOrder(trip.orderId);
      }
      
      alert('Viaggio ed ordine eliminati con successo');
    } catch (error) {
      console.error('Errore durante l\'eliminazione:', error);
      alert('Errore durante l\'eliminazione del viaggio');
    }
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
            onClick={() => setShowCreateInvoiceManager(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Crea Gestore Fatture
          </button>
          <button
            onClick={() => {
              const dataToExport = trips.map(trip => {
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
              XLSX.utils.book_append_sheet(wb, ws, "Viaggi");
              XLSX.writeFile(wb, "report_viaggi.xlsx");
            }}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <FileText className="w-4 h-4 mr-2" />
            Esporta Dati
          </button>
        </div>

        {/* Trips Table */}
        <TripsTable 
          trips={trips} 
          orders={orders} 
          drivers={drivers}
          onViewDetails={handleViewTripDetails}
          onDeleteTrip={handleDeleteTrip}
        />
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

      {showCreateInvoiceManager && (
        <CreateInvoiceManagerModal 
          onClose={() => setShowCreateInvoiceManager(false)}
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

      {/* Trip Detail Modal */}
      <TripDetailModal
        isOpen={!!selectedTripForDetail}
        onClose={handleCloseDetailModal}
        trip={selectedTripForDetail}
        order={selectedTripForDetail ? orders.find(o => o.id === selectedTripForDetail.orderId) || null : null}
        onViewImages={(trip) => {
          handleCloseDetailModal();
          handleViewImages(trip);
        }}
        onSaveChanges={async (tripId: string, changes: any) => {
          try {
            const tripUpdates: any = {};
            const orderUpdates: any = {};
            
            // Separare le modifiche per trip e order
            Object.entries(changes).forEach(([key, value]) => {
              if (key.startsWith('order.')) {
                // Modifiche all'ordine
                const orderKey = key.replace('order.', '');
                orderUpdates[orderKey] = value;
              } else if (key.startsWith('edasData.') || key.startsWith('loadingNoteData.') || ['status', 'driverName', 'dasCode', 'completedAt'].includes(key)) {
                // Modifiche al trip - usa dot notation per Firestore
                tripUpdates[key] = value;
              }
            });
            
            // Aggiornare il trip se ci sono modifiche
            if (Object.keys(tripUpdates).length > 0) {
              await updateTrip(tripId, tripUpdates);
            }
            
            // Aggiornare l'order se ci sono modifiche
            if (Object.keys(orderUpdates).length > 0 && selectedTripForDetail?.orderId) {
              await updateOrder(selectedTripForDetail.orderId, orderUpdates);
            }
            
            console.log('Modifiche salvate con successo');
          } catch (error) {
            console.error('Errore durante il salvataggio:', error);
            throw error;
          }
        }}
      />
    </div>
  );
} 