'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTrips, useOrders, useDrivers } from '@/hooks/useFirestore';
import { Trip, Order, User, ParsedPDFData } from '@/lib/types';
import { 
  LogOut, 
  Truck, 
  CheckCircle,
  PlusCircle,
  QrCode,
  Camera,
  FileText,
  History,
  ChevronRight,
  Users,
  Scan,
  Monitor,
  Smartphone,
  UserCheck,
  Clock,
  AlertTriangle,
  Download
} from 'lucide-react';
import CreateTripModal from './CreateTripModal';
import UnifiedOrdersAndTripsTable from './UnifiedOrdersAndTripsTable';
import QRScannerModal from './QRScannerModal';

export default function OperatorDashboard() {
  const { userProfile, logout } = useAuth();
  const { trips, loading: tripsLoading, addTrip, updateTrip, completeTrip } = useTrips();
  const { orders, loading: ordersLoading, addOrder } = useOrders();
  const { drivers, loading: driversLoading } = useDrivers();
  
  const [showCreateTripModal, setShowCreateTripModal] = useState(false);
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [selectedTripForAssignment, setSelectedTripForAssignment] = useState<Trip | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  
  // Detect if we're on mobile
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle QR scan for completing trip (Mobile only)
  const handleQRScanComplete = (qrData: string) => {
    setShowQRScanner(false);
    
    // Parse QR data: format should be "DRIVER:userId:timestamp"
    try {
      const parts = qrData.split(':');
      if (parts.length >= 2 && parts[0] === 'DRIVER') {
        const driverId = parts[1];
        const driver = drivers.find(d => d.id === driverId);
        if (driver && selectedTripForAssignment) {
          // Complete the trip directly with the scanned driver
          handleCompleteTripWithDriver(selectedTripForAssignment, driver);
        } else {
          alert('Driver non trovato. QR code non valido.');
        }
      } else {
        alert('QR code non valido. Formato non riconosciuto.');
      }
    } catch (error) {
      console.error('Errore nel parsing QR:', error);
      alert('Errore nella lettura del QR code.');
    }
  };

  // Handle trip creation from images (Desktop only)
  const handleCreateTrip = async (imageUrls: {
    edasImageUrl: string;
    loadingNoteImageUrl: string;
    cartelloCounterImageUrl: string;
  }, selectedDriver?: User | null) => {
    if (!userProfile) {
      alert('Errore: operatore non trovato.');
      return;
    }
    setIsCreatingTrip(true);
    try {
      // 1. Create temporary Order
      const tempOrderNumber = `OP_${Date.now()}`;
      const newOrderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
        orderNumber: tempOrderNumber,
        product: 'In elaborazione...',
        customerName: 'In elaborazione...',
        customerCode: '',
        deliveryAddress: 'In elaborazione...',
        destinationCode: '',
        quantity: 0,
        quantityUnit: 'lt',
        status: 'completato',
        notes: selectedDriver 
          ? `Ordine creato da operatore ${userProfile.name} per autista ${selectedDriver.name}`
          : `Ordine creato da operatore ${userProfile.name} - non assegnato`,
        createdBy: userProfile.id,
      };
      const newOrder = await addOrder(newOrderData);

      // 2. Create Trip (always in 'elaborazione' status for background processing)
      const newTripData: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'> = {
        orderId: newOrder.id,
        driverId: selectedDriver?.id || '',
        driverName: selectedDriver?.name || '',
        status: 'elaborazione', // Always 'elaborazione' when we have documents to process
        edasImageUrl: imageUrls.edasImageUrl,
        loadingNoteImageUrl: imageUrls.loadingNoteImageUrl,
        cartelloCounterImageUrl: imageUrls.cartelloCounterImageUrl,
        assignedBy: userProfile.id,
      };
      const addedTrip = await addTrip(newTripData);

      // 3. Start background processing
      console.log('Avvio processamento in background...');
      fetch('/api/process-trip-documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tripId: addedTrip.id,
          edasImageUrl: imageUrls.edasImageUrl,
          loadingNoteImageUrl: imageUrls.loadingNoteImageUrl,
          cartelloCounterImageUrl: imageUrls.cartelloCounterImageUrl,
        }),
      }).catch(error => {
        console.error('Errore nel processamento in background:', error);
      });

      // 4. Close modal
      setShowCreateTripModal(false);

    } catch (error) {
      console.error('Error creating trip:', error);
      alert('Si è verificato un errore durante la creazione del viaggio.');
    } finally {
      setIsCreatingTrip(false);
    }
  };

  // Handle trip creation from PDF/Image parsing (Desktop only)
  const handleCreateTripFromPDF = async (parsedData: ParsedPDFData) => {
    if (!userProfile) {
      alert('Errore: operatore non trovato.');
      return;
    }
    setIsCreatingTrip(true);
    try {
      // Cerca automaticamente l'autista dal PDF nel database
      let assignedDriver: User | undefined;
      if (parsedData.driverInfo.autista) {
        const driverName = parsedData.driverInfo.autista.trim();
        const foundDriver = drivers.find(driver => 
          driver.name.toLowerCase().includes(driverName.toLowerCase()) ||
          driverName.toLowerCase().includes(driver.name.toLowerCase())
        );
        
        if (foundDriver) {
          assignedDriver = foundDriver;
          console.log(`Autista trovato automaticamente: ${foundDriver.name} (${foundDriver.email})`);
        } else {
          console.log(`Autista "${driverName}" non trovato nel database`);
        }
      }
      
      // Crea ordini e viaggi multipli basati sui dati parsed
      const createdTripIds: string[] = [];
      for (const orderData of parsedData.orders) {
        // 1. Crea ordine per ogni elemento nel PDF
        const newOrder = await addOrder({
          orderNumber: orderData.orderNumber,
          customerName: orderData.customerName,
          customerCode: orderData.customerCode,
          deliveryAddress: orderData.deliveryAddress,
          destinationCode: orderData.destinationCode,
          product: orderData.product,
          quantity: orderData.quantity,
          quantityUnit: orderData.quantityUnit,
          identifier: orderData.identifier,
          carrierInfo: parsedData.carrierInfo,
          loadingInfo: parsedData.loadingInfo,
          driverInfo: parsedData.driverInfo,
          bdcNumber: parsedData.bdcNumber,
          notes: `${orderData.product} - Quantità: ${orderData.quantity} ${orderData.quantityUnit}`,
          status: 'completato',
          createdBy: userProfile.id,
        });
        
        // 2. Crea viaggio per ogni ordine
        if (newOrder.id) {
          const newTrip = await addTrip({
            orderId: newOrder.id,
            driverId: assignedDriver?.id || '',
            driverName: assignedDriver?.name || '',
            status: assignedDriver ? 'assegnato' : 'completato', // If driver found, assign, otherwise mark as completed
            assignedBy: userProfile.id,
          });
          
          if (newTrip.id) {
            createdTripIds.push(newTrip.id);
          }
        }
      }
      
      // 3. Messaggio di successo
      if (assignedDriver && createdTripIds.length > 0) {
        alert(`Creati ${parsedData.orders.length} viaggi dal PDF e assegnati automaticamente a ${assignedDriver.name}!`);
      } else {
        const driverNotFoundMsg = parsedData.driverInfo.autista 
          ? `\n\nAutista "${parsedData.driverInfo.autista}" non trovato nel database - viaggi lasciati da assegnare.`
          : '';
        alert(`Creati ${parsedData.orders.length} viaggi dal PDF!${driverNotFoundMsg}`);
      }
      
      // 4. Close modal
      setShowCreateTripModal(false);
      
    } catch (error) {
      console.error('Error creating trips from PDF:', error);
      alert('Errore durante la creazione dei viaggi dal PDF');
    } finally {
      setIsCreatingTrip(false);
    }
  };

  // Handle completing trip with driver (Mobile only)
  const handleCompleteTripWithDriver = async (trip: Trip, driver: User) => {
    try {
      // Assign driver and mark as completed
      await updateTrip(trip.id, {
        driverId: driver.id,
        driverName: driver.name,
        status: 'completato',
        completedAt: new Date(),
      });
      
      setSelectedTripForAssignment(null);
      alert(`Viaggio completato e assegnato a ${driver.name}`);
    } catch (error) {
      console.error('Error completing trip:', error);
      alert('Errore durante il completamento del viaggio.');
    }
  };

  // Handle functions for the unified table (Desktop only)
  const handleAssignTrip = (order: Order) => {
    // For operator, this could open a modal to assign drivers
    console.log('Assign trip to order:', order.id);
  };

  const handleManageOrder = (order: Order) => {
    // For operator, this could open order management
    console.log('Manage order:', order.id);
  };

  const handleViewImages = (trip: Trip) => {
    // For operator, this could open image viewer
    console.log('View images for trip:', trip.id);
  };

  const handleExport = () => {
    // For operator, this could export data
    console.log('Export data');
  };

  // Statistics
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayTrips = trips.filter(trip => {
    const tripDate = new Date(trip.createdAt);
    tripDate.setHours(0, 0, 0, 0);
    return tripDate.getTime() === today.getTime();
  });

  const processingTrips = trips.filter(trip => trip.status === 'elaborazione');
  const completedTrips = trips.filter(trip => trip.status === 'completato');
  const unassignedTrips = trips.filter(trip => trip.status === 'completato' && (!trip.driverId || trip.driverId === ''));

  const getOrderById = (orderId: string) => orders.find(order => order.id === orderId);

  if (tripsLoading || ordersLoading || driversLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Mobile Interface - Simple like Driver Dashboard
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Mobile Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="px-4 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Operatore
                </h1>
                <p className="text-sm text-gray-600">Ciao, {userProfile?.name}</p>
              </div>
              <button
                onClick={logout}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 space-y-6">
          {/* Mobile Info Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="font-medium text-blue-900 mb-2">📱 Modalità Mobile</h4>
            <p className="text-sm text-blue-800">
              Seleziona un viaggio da assegnare, poi scansiona il QR dell'autista per completarlo.
            </p>
          </div>

          {/* Unassigned Completed Trips for Mobile */}
          {unassignedTrips.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Viaggi da Assegnare</h2>
              <div className="space-y-3">
                {unassignedTrips.map((trip) => {
                  const order = getOrderById(trip.orderId);
                  return (
                    <div key={trip.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                            <h3 className="font-semibold text-gray-900">{order?.orderNumber}</h3>
                            <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              Da Assegnare
                            </span>
                          </div>
                          <div className="space-y-1 mb-3">
                            <p className="text-sm text-gray-800">
                              <strong>Cliente:</strong> {order?.customerName}
                            </p>
                            <p className="text-sm text-gray-700">
                              <strong>Prodotto:</strong> {order?.product} ({order?.quantity} {order?.quantityUnit})
                            </p>
                            {trip.edasData?.documentInfo?.dasNumber && (
                              <p className="text-sm text-indigo-700">
                                <FileText className="inline w-4 h-4 mr-1" />
                                DAS: {trip.edasData.documentInfo.dasNumber}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          setSelectedTripForAssignment(trip);
                          setShowQRScanner(true);
                        }}
                        className="w-full flex items-center justify-center px-3 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 active:bg-indigo-800 text-sm"
                      >
                        <Scan className="w-4 h-4 mr-2" />
                        Scansiona QR Autista
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun viaggio da assegnare</h3>
              <p className="mt-1 text-sm text-gray-500">
                Tutti i viaggi sono già stati assegnati agli autisti.
              </p>
            </div>
          )}

          {/* Processing Trips Info */}
          {processingTrips.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <h4 className="font-medium text-yellow-900 mb-2">
                ⏳ {processingTrips.length} Viaggio{processingTrips.length !== 1 ? 'i' : ''} in Elaborazione
              </h4>
              <p className="text-sm text-yellow-800">
                I documenti sono in fase di processamento automatico.
              </p>
            </div>
          )}
        </main>

        {/* Mobile Modals */}
        {showQRScanner && selectedTripForAssignment && (
          <QRScannerModal
            trip={selectedTripForAssignment}
            onScanComplete={handleQRScanComplete}
            onClose={() => {
              setShowQRScanner(false);
              setSelectedTripForAssignment(null);
            }}
          />
        )}
      </div>
    );
  }

  // Desktop Interface - Professional like Admin Dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                Dashboard Operatore
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
        {/* Desktop Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
                      {trips.length}
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
                      In Elaborazione
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {processingTrips.length}
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
                      Completati
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {completedTrips.length}
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
                  <AlertTriangle className="h-6 w-6 text-orange-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Non Assegnati
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {unassignedTrips.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Actions */}
        <div className="mb-8 flex flex-wrap gap-4">
          <button
            onClick={() => setShowCreateTripModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Nuovo Viaggio
          </button>
        </div>

        {/* Enhanced Unified Orders and Trips Table */}
        <UnifiedOrdersAndTripsTable
          orders={orders}
          trips={trips}
          drivers={drivers}
          onAssignTrip={handleAssignTrip}
          onManageOrder={handleManageOrder}
          onViewImages={handleViewImages}
          onExport={handleExport}
        />
      </main>

      {/* Desktop Modals */}
      {showCreateTripModal && (
        <CreateTripModal
          onConfirm={(imageUrls) => handleCreateTrip(imageUrls)}
          onConfirmPDF={(parsedData) => handleCreateTripFromPDF(parsedData)}
          onClose={() => setShowCreateTripModal(false)}
          isCreating={isCreatingTrip}
        />
      )}
    </div>
  );
} 