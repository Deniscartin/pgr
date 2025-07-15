import React, { useState } from 'react';
import { Trip, Order } from '@/lib/types/index';
import { 
  CheckCircle,
  MapPin,
  Camera,
  X,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import ImageViewerModal from './ImageViewerModal';

interface PastTripsModalProps {
  trips: Trip[];
  orders: Order[];
  isOpen: boolean;
  onClose: () => void;
}

export default function PastTripsModal({ trips, orders, isOpen, onClose }: PastTripsModalProps) {
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());

  const getOrderById = (orderId: string) => orders.find(order => order.id === orderId);

  const toggleExpanded = (tripId: string) => {
    const newExpanded = new Set(expandedTrips);
    if (newExpanded.has(tripId)) {
      newExpanded.delete(tripId);
    } else {
      newExpanded.add(tripId);
    }
    setExpandedTrips(newExpanded);
  };

  const handleViewImages = (trip: Trip) => {
    setSelectedTrip(trip);
    setShowImageViewer(true);
  };

  if (!isOpen) return null;

  // Sort trips by completion date (most recent first)
  const sortedTrips = [...trips].sort((a, b) => {
    const dateA = a.completedAt ? new Date(a.completedAt) : new Date(0);
    const dateB = b.completedAt ? new Date(b.completedAt) : new Date(0);
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-center p-4 sm:p-6 border-b">
            <h2 className="text-xl font-bold text-gray-900">
              Viaggi Passati ({trips.length})
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
            {sortedTrips.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun viaggio completato</h3>
                <p className="mt-1 text-sm text-gray-500">
                  I tuoi viaggi completati appariranno qui.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {sortedTrips.map((trip) => {
                  const order = getOrderById(trip.orderId);
                  const isExpanded = expandedTrips.has(trip.id);
                  const hasImages = trip.edasImageUrl || trip.edasProcessedImageUrl || trip.loadingNoteImageUrl || trip.loadingNoteProcessedImageUrl || trip.cartelloCounterImageUrl;

                  return (
                    <div key={trip.id} className="p-4 sm:p-6">
                      {/* Main trip info */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                            <div className="flex-1">
                              <h3 className="text-base font-medium text-gray-900">
                                {order?.orderNumber || 'N/A'}
                              </h3>
                              <p className="text-sm text-gray-500">
                                <Calendar className="inline h-4 w-4 mr-1" />
                                Completato: {trip.completedAt ? new Date(trip.completedAt).toLocaleDateString('it-IT') : 'N/A'}
                              </p>
                            </div>
                          </div>

                          {/* Customer and address */}
                          <div className="space-y-1 mb-3">
                            <p className="text-sm text-gray-700">
                              <strong>Cliente:</strong> {order?.customerName || 'N/A'}
                            </p>
                            <p className="text-sm text-gray-700">
                              <MapPin className="inline h-4 w-4 mr-1 text-gray-400" />
                              {order?.deliveryAddress || 'N/A'}
                            </p>
                            <p className="text-sm text-gray-700">
                              <strong>Prodotto:</strong> {order?.product} ({order?.quantity} {order?.quantityUnit})
                            </p>
                          </div>

                          {/* DAS info if available */}
                          {trip.edasData?.documentInfo?.dasNumber && (
                            <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-3">
                              <FileText className="w-3 h-3 mr-1" />
                              DAS: {trip.edasData.documentInfo.dasNumber}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 ml-4">
                          {hasImages && (
                            <button
                              onClick={() => handleViewImages(trip)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Visualizza Foto"
                            >
                              <Camera className="h-5 w-5" />
                            </button>
                          )}
                          <button
                            onClick={() => toggleExpanded(trip.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            {isExpanded ? 
                              <ChevronUp className="h-5 w-5 text-gray-500" /> : 
                              <ChevronDown className="h-5 w-5 text-gray-500" />
                            }
                          </button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* e-DAS details */}
                            {trip.edasData && (
                              <div className="bg-gray-50 p-3 rounded-lg">
                                <h4 className="font-medium text-gray-900 mb-2">Dettagli e-DAS</h4>
                                <div className="space-y-1 text-sm text-gray-700">
                                  <p><strong>Numero:</strong> {trip.edasData.documentInfo?.dasNumber}</p>
                                  <p><strong>Mittente:</strong> {trip.edasData.senderInfo?.name}</p>
                                  <p><strong>Destinatario:</strong> {trip.edasData.recipientInfo?.name}</p>
                                  <p><strong>Prodotto:</strong> {trip.edasData.productInfo?.description}</p>
                                  <p><strong>Peso Netto:</strong> {trip.edasData.productInfo?.netWeightKg} kg</p>
                                  <p><strong>Volume:</strong> {trip.edasData.productInfo?.volumeAt15CL} L</p>
                                </div>
                              </div>
                            )}

                            {/* Loading note details */}
                            {trip.loadingNoteData && (
                              <div className="bg-gray-50 p-3 rounded-lg">
                                <h4 className="font-medium text-gray-900 mb-2">Nota di Carico</h4>
                                <div className="space-y-1 text-sm text-gray-700">
                                  <p><strong>Numero:</strong> {trip.loadingNoteData.documentNumber}</p>
                                  <p><strong>Data Carico:</strong> {trip.loadingNoteData.loadingDate}</p>
                                  <p><strong>Vettore:</strong> {trip.loadingNoteData.carrierName}</p>
                                  <p><strong>Mittente:</strong> {trip.loadingNoteData.shipperName}</p>
                                  <p><strong>Destinatario:</strong> {trip.loadingNoteData.consigneeName}</p>
                                  <p><strong>Peso Netto:</strong> {trip.loadingNoteData.netWeightKg} kg</p>
                                  <p><strong>Volume:</strong> {trip.loadingNoteData.volumeLiters} L</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Signature link */}
                          {trip.signatureUrl && (
                            <div className="mt-3">
                              <a
                                href={trip.signatureUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500"
                              >
                                <FileText className="w-4 h-4 mr-1" />
                                Visualizza Firma Cliente
                              </a>
                            </div>
                          )}

                          {/* Image summary */}
                          {hasImages && (
                            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <Camera className="w-4 h-4 text-blue-600 mr-2" />
                                  <span className="text-sm font-medium text-blue-900">
                                    Documenti fotografati disponibili
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleViewImages(trip)}
                                  className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                                >
                                  Visualizza →
                                </button>
                              </div>
                              <div className="mt-2 text-xs text-blue-700">
                                {trip.edasImageUrl && '• e-DAS originale '}
                                {trip.edasProcessedImageUrl && '• e-DAS elaborato '}
                                {trip.loadingNoteImageUrl && '• Nota di carico originale '}
                                {trip.loadingNoteProcessedImageUrl && '• Nota di carico elaborata '}
                                {trip.cartelloCounterImageUrl && '• Cartellino conta litro'}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

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
    </>
  );
} 