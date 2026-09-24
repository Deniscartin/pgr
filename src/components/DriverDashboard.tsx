'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTrips, useOrders, useOrdersByIds } from '@/hooks/useFirestore';
import { Trip, Order } from '@/lib/types';
import { 
  LogOut, 
  Plus, 
  FileText, 
  CheckCircle,
  Eye,
  Camera,
  QrCode,
  MapPin,
  Calendar,
  Truck
} from 'lucide-react';
import SignatureModal from './SignatureModal';
import CreateTripModal from './CreateTripModal';
import ImageViewerModal from './ImageViewerModal';
import DriverQRCode from './DriverQRCode';
import QRScannerModal from './QRScannerModal';

export default function DriverDashboard() {
  const { userProfile, logout } = useAuth();
  // L'autista vede unicamente i viaggi della giornata corrente: nessuno
  // storico, ne' in pagina ne' caricabile su richiesta.
  const { trips, loading: tripsLoading, addTrip, updateTrip, completeTrip } = useTrips(
    userProfile?.id,
    { todayOnly: true, requireDriverId: true }
  );
  const { addOrder } = useOrders({ subscribe: false });

  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showCreateTripModal, setShowCreateTripModal] = useState(false);
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);

  const [selectedTripForAction, setSelectedTripForAction] = useState<Trip | null>(null);

  // Gli ordini vengono letti solo per i viaggi effettivamente a schermo.
  const visibleOrderIds = useMemo(
    () => trips.map(trip => trip.orderId),
    [trips]
  );
  const { orders } = useOrdersByIds(visibleOrderIds);

  const handleCreateTripFromImages = async (imageUrls: {
    edasImageUrl: string;
    loadingNoteImageUrl: string;
    cartelloCounterImageUrl:string;
  }) => {
    if (!userProfile) {
      alert('Profilo utente non trovato.');
      return;
    }
    setIsCreatingTrip(true);
    try {
      // 1. Create a placeholder order
      const newOrderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
        orderNumber: `TEMP_${Date.now()}`,
        customerName: 'DA ESTRARRE',
        customerCode: 'TEMP',
        deliveryAddress: 'DA ESTRARRE',
        destinationCode: 'TEMP',
        product: 'DA ESTRARRE',
        quantity: 0,
        quantityUnit: 'LT',
        status: 'completato', // Order is created as completed since trip is being processed
        notes: 'Ordine temporaneo - documenti in elaborazione',
        createdBy: userProfile.id,
      };
      const newOrder = await addOrder(newOrderData);

      // 2. Create the trip, linking it to the new order
      const newTripData: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'> = {
        orderId: newOrder.id,
        driverId: userProfile.id,
        driverName: userProfile.name,
        status: 'elaborazione', // Trip starts in processing status
        // Save only original image URLs for now
        edasImageUrl: imageUrls.edasImageUrl,
        loadingNoteImageUrl: imageUrls.loadingNoteImageUrl,
        cartelloCounterImageUrl: imageUrls.cartelloCounterImageUrl,
        assignedBy: userProfile.id,
      };
      const addedTrip = await addTrip(newTripData);

      // 3. Immediately trigger background processing via API route
      fetch('/api/process-trip-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tripId: addedTrip.id,
          orderId: newOrder.id,
          driverId: userProfile.id,
          edasImageUrl: imageUrls.edasImageUrl, 
          loadingNoteImageUrl: imageUrls.loadingNoteImageUrl,
          cartelloCounterImageUrl: imageUrls.cartelloCounterImageUrl,
        }),
      });

      // 4. Close modal immediately - user can start driving
      setShowCreateTripModal(false);

    } catch (error) {
      console.error("Error creating trip from images:", error);
      alert(error instanceof Error ? error.message : "Si è verificato un errore sconosciuto");
    } finally {
      setIsCreatingTrip(false);
    }
  };

  // `trips` contiene già solo la giornata corrente (filtro lato query).
  const assignedTrips = trips.filter(trip => trip.status === 'assegnato' || trip.status === 'in_corso');
  const completedTrips = trips.filter(trip => trip.status === 'completato');
  const processingTrips = trips.filter(trip => trip.status === 'elaborazione');

  const handleViewImages = (trip: Trip) => {
    setSelectedTripForAction(trip);
    setShowImageViewer(true);
  };

  const handleCompleteTrip = (trip: Trip) => {
    setSelectedTripForAction(trip);
    setShowQRScanner(true);
  };

  const handleQRScanComplete = (_dasCode: string) => {
    setShowQRScanner(false);
    setShowSignatureModal(true);
  };

  const handleSignatureComplete = async (signatureUrl: string) => {
    if (!selectedTripForAction) return;

    try {
      if (selectedTripForAction.status === 'assegnato') {
        await updateTrip(selectedTripForAction.id, { status: 'in_corso' });
      }
      
      await completeTrip(selectedTripForAction.id, '', signatureUrl);
      setShowSignatureModal(false);
      setSelectedTripForAction(null);
    } catch (error) {
      console.error('Error completing trip:', error);
      alert('Errore durante il completamento del viaggio');
    }
  };

  // Gli ordini si risolvono dopo i viaggi e non devono bloccare la dashboard:
  // i viaggi sono gia' utilizzabili senza i dati dell'ordine collegato.
  if (tripsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-First Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Dashboard Autista
              </h1>
              <p className="text-sm text-gray-600">Ciao, {userProfile?.name}</p>
            </div>
            <div className="flex items-center space-x-2">
              {/* <button
                onClick={() => setShowQRCode(true)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                title="Mostra QR Code"
              >
                <QrCode className="w-5 h-5" />
              </button> */}
              <button
                onClick={logout}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 space-y-6">
        {/* Quick Actions - Mobile Optimized */}
        <div className="space-y-3">
          <button
            onClick={() => setShowCreateTripModal(true)}
            className="w-full flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium shadow-sm hover:bg-indigo-700 active:bg-indigo-800"
          >
            <Plus className="w-5 h-5 mr-2" />
            Scansione Viaggio
          </button>

          {/* <button
            onClick={() => setShowQRCode(true)}
            className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-xl font-medium shadow-sm hover:bg-green-700 active:bg-green-800"
          >
            <QrCode className="w-5 h-5 mr-2" />
            Mostra il mio QR Code
          </button> */}
        </div>

        {/* Today's Processing Trips - Mobile Cards */}
        {processingTrips.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Viaggi in Elaborazione</h2>
              <div className="flex items-center text-sm text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-1"></div>
                Processamento in corso...
              </div>
            </div>
            
            <div className="space-y-3">
              {processingTrips.map((trip) => {
                const order = orders.find(order => order.id === trip.orderId);
                return (
                  <div key={trip.id} className="bg-blue-50 rounded-xl p-4 shadow-sm border border-blue-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
                          <h3 className="font-semibold text-gray-900">{order?.orderNumber}</h3>
                          <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Elaborazione
                          </span>
                        </div>
                        <div className="space-y-1 mb-3">
                          <p className="text-sm text-gray-800">
                            <strong>Cliente:</strong> {order?.customerName}
                          </p>
                          <p className="text-sm text-gray-700 flex items-start">
                            <MapPin className="w-4 h-4 mr-1 mt-0.5 text-gray-500 flex-shrink-0" />
                            {order?.deliveryAddress}
                          </p>
                          <p className="text-sm text-gray-700">
                            <strong>Prodotto:</strong> {order?.product} ({order?.quantity} {order?.quantityUnit})
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded-lg border border-blue-200">
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                        <span className="text-sm text-blue-800">
                          Documenti in elaborazione automatica...
                        </span>
                      </div>
                      <p className="text-xs text-blue-600 mt-1">
                        Il viaggio sarà completato automaticamente al termine dell&apos;elaborazione
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Today's Assigned Trips - Mobile Cards */}
        {assignedTrips.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Viaggi di Oggi</h2>
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="w-4 h-4 mr-1" />
                {new Date().toLocaleDateString('it-IT')}
              </div>
            </div>
            
            <div className="space-y-3">
              {assignedTrips.map((trip) => {
                const order = orders.find(order => order.id === trip.orderId);
                return (
                  <div key={trip.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                          <h3 className="font-semibold text-gray-900">{order?.orderNumber}</h3>
                          {trip.status === 'in_corso' && (
                            <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              In corso
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 mb-3">
                          <p className="text-sm text-gray-800">
                            <strong>Cliente:</strong> {order?.customerName}
                          </p>
                          <p className="text-sm text-gray-700 flex items-start">
                            <MapPin className="w-4 h-4 mr-1 mt-0.5 text-gray-500 flex-shrink-0" />
                            {order?.deliveryAddress}
                          </p>
                          <p className="text-sm text-gray-700">
                            <strong>Prodotto:</strong> {order?.product} ({order?.quantity} {order?.quantityUnit})
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleCompleteTrip(trip)}
                      className="w-full flex items-center justify-center px-3 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 active:bg-green-800 text-sm"
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      Completa Viaggio
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Today's Completed Trips - Mobile Cards */}
        {completedTrips.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Completati Oggi</h2>
            
            <div className="space-y-3">
              {completedTrips.map((trip) => {
                const order = orders.find(order => order.id === trip.orderId);
                const hasImages = trip.edasImageUrl || trip.edasProcessedImageUrl || trip.loadingNoteImageUrl || trip.loadingNoteProcessedImageUrl || trip.cartelloCounterImageUrl;
                
                return (
                  <div key={trip.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                          <h3 className="font-semibold text-gray-900">{order?.orderNumber}</h3>
                          <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Completato
                          </span>
                        </div>
                        <div className="space-y-1 mb-3">
                          <p className="text-sm text-gray-800">
                            <strong>Cliente:</strong> {order?.customerName}
                          </p>
                          <p className="text-sm text-gray-700 flex items-start">
                            <MapPin className="w-4 h-4 mr-1 mt-0.5 text-gray-500 flex-shrink-0" />
                            {order?.deliveryAddress}
                          </p>
                          {trip.edasData?.documentInfo?.dasNumber && (
                            <p className="text-sm text-indigo-700">
                              <FileText className="inline w-4 h-4 mr-1" />
                              DAS: {trip.edasData.documentInfo.dasNumber}
                            </p>
                          )}
                          <p className="text-xs text-gray-600">
                            Completato: {trip.completedAt ? new Date(trip.completedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {hasImages && (
                      <div className="bg-blue-50 p-2.5 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center min-w-0">
                            <Camera className="w-4 h-4 text-blue-600 mr-2 flex-shrink-0" />
                            <span className="text-sm font-medium text-blue-900 truncate">
                              Documenti fotografati
                            </span>
                          </div>
                          <button
                            onClick={() => handleViewImages(trip)}
                            className="text-sm text-blue-600 hover:text-blue-500 font-medium flex-shrink-0 ml-2"
                          >
                            Visualizza
                          </button>
                        </div>
                        <div className="mt-1 text-xs text-blue-700">
                          {trip.edasImageUrl && '• e-DAS '}
                          {trip.loadingNoteImageUrl && '• Nota di carico '}
                          {trip.cartelloCounterImageUrl && '• Cartellino conta litro'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {trips.length === 0 && (
          <div className="text-center py-12">
            <Truck className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun viaggio oggi</h3>
            <p className="mt-1 text-sm text-gray-500">
              Avvia un nuovo viaggio scattando le foto dei documenti.
            </p>
          </div>
        )}
      </main>

      {/* Modals */}
      {showQRScanner && selectedTripForAction && (
        <QRScannerModal
          trip={selectedTripForAction}
          onScanComplete={handleQRScanComplete}
          onClose={() => {
            setShowQRScanner(false);
            setSelectedTripForAction(null);
          }}
        />
      )}
      
      {showSignatureModal && selectedTripForAction && (
        <SignatureModal
          trip={selectedTripForAction}
          dasCode={''}
          onSignatureComplete={handleSignatureComplete}
          onClose={() => {
            setShowSignatureModal(false);
            setSelectedTripForAction(null);
          }}
        />
      )}

      {/* New e-DAS Modals */}
      {showCreateTripModal && (
        <CreateTripModal
          onConfirm={handleCreateTripFromImages}
          onClose={() => setShowCreateTripModal(false)}
          isCreating={isCreatingTrip}
        />
      )}

      {/* Image Viewer Modal */}
      {showImageViewer && selectedTripForAction && (
        <ImageViewerModal
          trip={selectedTripForAction}
          isOpen={showImageViewer}
          onClose={() => {
            setShowImageViewer(false);
            setSelectedTripForAction(null);
          }}
        />
      )}

      {/* Driver QR Code Modal */}
      {showQRCode && (
        <DriverQRCode
          isOpen={showQRCode}
          onClose={() => setShowQRCode(false)}
        />
      )}
    </div>
  );
} 