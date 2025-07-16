'use client';

import { useState } from 'react';
import { Trip, Order } from '@/lib/types';
import { X, Image as ImageIcon, AlertTriangle, CheckCircle, Edit3, Save, AlertCircle, FileText, Truck, Package, MapPin } from 'lucide-react';

interface TripDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip | null;
  order: Order | null;
  onViewImages: (trip: Trip) => void;
}

const DetailItem = ({ label, value, isEditable = false, onEdit }: { 
  label: string; 
  value: string | number | undefined | null; 
  isEditable?: boolean;
  onEdit?: (newValue: string) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value || ''));

  const handleSave = () => {
    onEdit?.(editValue);
    setIsEditing(false);
  };

  return (
    <div className="py-3 border-b border-gray-100 last:border-b-0">
      <dt className="text-sm font-semibold text-gray-600 mb-1">{label}</dt>
      <dd className="text-sm text-gray-900 flex items-center gap-2">
        {isEditable && isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button onClick={handleSave} className="text-green-600 hover:text-green-800 p-1">
              <Save className="h-4 w-4" />
            </button>
            <button onClick={() => setIsEditing(false)} className="text-gray-600 hover:text-gray-800 p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <span className="flex-1 font-medium">{value || 'N/A'}</span>
            {isEditable && (
              <button onClick={() => setIsEditing(true)} className="text-indigo-600 hover:text-indigo-800 p-1">
                <Edit3 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </dd>
    </div>
  );
};

const ValidationBadge = ({ result }: { result: any }) => {
  const getColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'bg-red-50 border-red-200 text-red-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info': return 'bg-blue-50 border-blue-200 text-blue-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <AlertCircle className="h-5 w-5" />;
      case 'warning': return <AlertTriangle className="h-5 w-5" />;
      default: return <CheckCircle className="h-5 w-5" />;
    }
  };

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${getColor(result.severity)}`}>
      <div className="flex-shrink-0 mt-0.5">
        {getIcon(result.severity)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-base mb-2">{result.field}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="font-medium text-gray-600">EDAS:</span>
            <span className="ml-2">{result.edasValue}</span>
          </div>
          <div>
            <span className="font-medium text-gray-600">Loading Note:</span>
            <span className="ml-2">{result.loadingNoteValue}</span>
          </div>
        </div>
        <div className="mt-2 text-sm font-medium">
          {result.isMatch ? (
            <span className="text-green-700">✓ Corrispondenza</span>
          ) : (
            <span className="text-red-700">✗ Discordanza</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default function TripDetailModal({ isOpen, onClose, trip, order, onViewImages }: TripDetailModalProps) {
  const [activeTab, setActiveTab] = useState('general');

  if (!isOpen || !trip) return null;

  const createdAt = trip.createdAt ? (trip.createdAt instanceof Date ? trip.createdAt : new Date(trip.createdAt as any)) : null;
  const completedAt = trip.completedAt ? (trip.completedAt instanceof Date ? trip.completedAt : new Date(trip.completedAt as any)) : null;

  const tabs = [
    { id: 'general', label: 'Generale', icon: <FileText className="h-4 w-4" /> },
    { id: 'edas', label: 'EDAS', icon: <Package className="h-4 w-4 ml-4" /> },
    { id: 'loading', label: 'Bolla di Carico', icon: <Truck className="h-4 w-4 ml-4" /> },
    { id: 'validation', label: 'Validazione', icon: <CheckCircle className="h-4 w-4 ml-4" /> },
    { id: 'images', label: 'Immagini', icon: <ImageIcon className="h-4 w-4 ml-4" /> }
  ];

  const handleFieldEdit = (field: string, value: string) => {
    console.log(`Editing ${field} to ${value}`);
    // Here you would implement the actual field update logic
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 id="modal-title" className="text-2xl font-bold text-gray-900 mb-1">
              Dettagli Viaggio
            </h2>
            <p className="text-sm text-gray-600">
              {trip.edasData?.documentInfo?.dasNumber || trip.id.substring(0, 8) + '...'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Status Bar */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                trip.status === 'completato' ? 'bg-green-100 text-green-800' : 
                trip.status === 'in_corso' ? 'bg-yellow-100 text-yellow-800' : 
                trip.status === 'assegnato' ? 'bg-blue-100 text-blue-800' :
                trip.status === 'elaborazione' ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {trip.status.replace('_', ' ').toUpperCase()}
              </span>
              <div className="text-sm text-gray-600">
                <span className="font-medium">Autista:</span>
                <span className="ml-2 font-semibold text-gray-900">{trip.driverName}</span>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              <span className="font-medium">Creato:</span>
              <span className="ml-2">{createdAt?.toLocaleString('it-IT')}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-white">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'general' && (
            <div className="p-6 space-y-8">
              <section>
                <h3 className="text-xl font-semibold text-gray-900 mb-6 pb-2 border-b-2 border-indigo-100">
                  Informazioni Viaggio
                </h3>
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                    <DetailItem label="ID Viaggio" value={trip.id} />
                    <DetailItem label="Stato" value={trip.status} isEditable onEdit={(value) => handleFieldEdit('status', value)} />
                    <DetailItem label="Autista" value={trip.driverName} isEditable onEdit={(value) => handleFieldEdit('driverName', value)} />
                    <DetailItem label="Data di Creazione" value={createdAt?.toLocaleString('it-IT')} />
                    <DetailItem label="Data di Completamento" value={completedAt?.toLocaleString('it-IT')} />
                    <DetailItem label="Codice DAS" value={trip.dasCode} isEditable onEdit={(value) => handleFieldEdit('dasCode', value)} />
                  </div>
                </div>
              </section>

              {order && (
                <section>
                  <h3 className="text-xl font-semibold text-gray-900 mb-6 pb-2 border-b-2 border-indigo-100">
                    Informazioni Ordine
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                      <DetailItem label="Numero Ordine" value={order.orderNumber} />
                      <DetailItem label="Cliente" value={order.customerName} />
                      <DetailItem label="Codice Cliente" value={order.customerCode} />
                      <DetailItem label="Prodotto" value={order.product} />
                      <DetailItem label="Quantità" value={`${order.quantity} ${order.quantityUnit}`} />
                      <DetailItem label="Indirizzo di Consegna" value={order.deliveryAddress} />
                      <DetailItem label="Codice Destinazione" value={order.destinationCode} />
                      <DetailItem label="Note" value={order.notes} />
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === 'edas' && (
            <div className="p-6 space-y-8">
              {trip.edasData ? (
                <>
                  <section>
                    <h3 className="text-xl font-semibold text-gray-900 mb-6 pb-2 border-b-2 border-indigo-100">
                      Informazioni Documento EDAS
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                        <DetailItem label="Numero DAS" value={trip.edasData.documentInfo?.dasNumber} />
                        <DetailItem label="Versione" value={trip.edasData.documentInfo?.version} />
                        <DetailItem label="Riferimento Locale" value={trip.edasData.documentInfo?.localReferenceNumber} />
                        <DetailItem label="Numero Fattura" value={trip.edasData.documentInfo?.invoiceNumber} />
                        <DetailItem label="Data Fattura" value={trip.edasData.documentInfo?.invoiceDate} />
                        <DetailItem label="Data Registrazione" value={trip.edasData.documentInfo?.registrationDateTime} />
                        <DetailItem label="Data Spedizione" value={trip.edasData.documentInfo?.shippingDateTime} />
                        <DetailItem label="Scadenza Validità" value={trip.edasData.documentInfo?.validityExpirationDateTime} />
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-gray-900 mb-6 pb-2 border-b-2 border-green-100">
                      Informazioni Mittente
                    </h3>
                    <div className="bg-green-50 rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                        <DetailItem label="Nome" value={trip.edasData.senderInfo?.name} />
                        <DetailItem label="Codice Deposito" value={trip.edasData.senderInfo?.depositoMittenteCode} />
                        <DetailItem label="Indirizzo" value={trip.edasData.senderInfo?.address} />
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-gray-900 mb-6 pb-2 border-b-2 border-blue-100">
                      Informazioni Destinatario
                    </h3>
                    <div className="bg-blue-50 rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                        <DetailItem label="Nome" value={trip.edasData.recipientInfo?.name} />
                        <DetailItem label="Indirizzo" value={trip.edasData.recipientInfo?.address} />
                        <DetailItem label="Codice Fiscale" value={trip.edasData.recipientInfo?.taxCode} />
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-gray-900 mb-6 pb-2 border-b-2 border-purple-100">
                      Informazioni Prodotto
                    </h3>
                    <div className="bg-purple-50 rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                        <DetailItem label="Codice Prodotto" value={trip.edasData.productInfo?.productCode} />
                        <DetailItem label="Descrizione" value={trip.edasData.productInfo?.description} />
                        <DetailItem label="Codice UN" value={trip.edasData.productInfo?.unCode} />
                        <DetailItem label="Peso Netto (kg)" value={trip.edasData.productInfo?.netWeightKg} />
                        <DetailItem label="Volume a Temp. Ambiente (L)" value={trip.edasData.productInfo?.volumeAtAmbientTempL} />
                        <DetailItem label="Volume a 15°C (L)" value={trip.edasData.productInfo?.volumeAt15CL} />
                        <DetailItem label="Densità a Temp. Ambiente" value={trip.edasData.productInfo?.densityAtAmbientTemp} />
                        <DetailItem label="Densità a 15°C" value={trip.edasData.productInfo?.densityAt15C} />
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-gray-900 mb-6 pb-2 border-b-2 border-orange-100">
                      Informazioni Trasporto
                    </h3>
                    <div className="bg-orange-50 rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                        <DetailItem label="Modalità di Trasporto" value={trip.edasData.transportInfo?.transportMode} />
                        <DetailItem label="Tipo Veicolo" value={trip.edasData.transportInfo?.vehicleType} />
                        <DetailItem label="ID Veicolo" value={trip.edasData.transportInfo?.vehicleId} />
                        <DetailItem label="Durata Stimata" value={trip.edasData.transportInfo?.estimatedDuration} />
                        <DetailItem label="Primo Vettore" value={trip.edasData.transportInfo?.firstCarrierName} />
                        <DetailItem label="ID Primo Vettore" value={trip.edasData.transportInfo?.firstCarrierId} />
                        <DetailItem label="Nome Autista" value={trip.edasData.transportInfo?.driverName} />
                      </div>
                    </div>
                  </section>
                </>
              ) : (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-lg text-gray-500">Nessun dato EDAS disponibile per questo viaggio.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'loading' && (
            <div className="p-6 space-y-8">
              {trip.loadingNoteData ? (
                <section>
                  <h3 className="text-xl font-semibold text-gray-900 mb-6 pb-2 border-b-2 border-indigo-100">
                    Bolla di Carico
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                      <DetailItem label="Numero Documento" value={trip.loadingNoteData.documentNumber} />
                      <DetailItem label="Data di Carico" value={trip.loadingNoteData.loadingDate} />
                      <DetailItem label="Nome Vettore" value={trip.loadingNoteData.carrierName} />
                      <DetailItem label="Nome Spedizioniere" value={trip.loadingNoteData.shipperName} />
                      <DetailItem label="Nome Destinatario" value={trip.loadingNoteData.consigneeName} />
                      <DetailItem label="Descrizione Prodotto" value={trip.loadingNoteData.productDescription} />
                      <DetailItem label="Peso Lordo (kg)" value={trip.loadingNoteData.grossWeightKg} />
                      <DetailItem label="Peso Netto (kg)" value={trip.loadingNoteData.netWeightKg} />
                      <DetailItem label="Volume (L)" value={trip.loadingNoteData.volumeLiters} />
                      <DetailItem label="Note" value={trip.loadingNoteData.notes} />
                    </div>
                  </div>
                </section>
              ) : (
                <div className="text-center py-12">
                  <Truck className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-lg text-gray-500">Nessun dato della bolla di carico disponibile per questo viaggio.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'validation' && (
            <div className="p-6 space-y-8">
              <section>
                <h3 className="text-xl font-semibold text-gray-900 mb-6 pb-2 border-b-2 border-indigo-100">
                  Risultati Validazione
                </h3>
                {trip.validationResults && trip.validationResults.length > 0 ? (
                  <div className="space-y-4">
                    {trip.validationResults.map((result, index) => (
                      <ValidationBadge key={index} result={result} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-lg text-gray-500">Nessun risultato di validazione disponibile per questo viaggio.</p>
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'images' && (
            <div className="p-6 space-y-8">
              <section>
                <h3 className="text-xl font-semibold text-gray-900 mb-6 pb-2 border-b-2 border-indigo-100">
                  Immagini e Documenti
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {trip.edasImageUrl && (
                    <div className="border-2 border-gray-200 rounded-xl p-6 text-center hover:border-indigo-300 transition-colors">
                      <div className="mb-4">
                        <ImageIcon className="h-12 w-12 mx-auto text-gray-400" />
                      </div>
                      <p className="text-base font-semibold text-gray-900 mb-3">Immagine EDAS</p>
                      <button
                        onClick={() => window.open(trip.edasImageUrl, '_blank')}
                        className="w-full px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
                      >
                        Visualizza
                      </button>
                    </div>
                  )}
                  
                  {trip.loadingNoteImageUrl && (
                    <div className="border-2 border-gray-200 rounded-xl p-6 text-center hover:border-indigo-300 transition-colors">
                      <div className="mb-4">
                        <ImageIcon className="h-12 w-12 mx-auto text-gray-400" />
                      </div>
                      <p className="text-base font-semibold text-gray-900 mb-3">Bolla di Carico</p>
                      <button
                        onClick={() => window.open(trip.loadingNoteImageUrl, '_blank')}
                        className="w-full px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
                      >
                        Visualizza
                      </button>
                    </div>
                  )}
                  
                  {trip.cartelloCounterImageUrl && (
                    <div className="border-2 border-gray-200 rounded-xl p-6 text-center hover:border-indigo-300 transition-colors">
                      <div className="mb-4">
                        <ImageIcon className="h-12 w-12 mx-auto text-gray-400" />
                      </div>
                      <p className="text-base font-semibold text-gray-900 mb-3">Cartello Conta Litri</p>
                      <button
                        onClick={() => window.open(trip.cartelloCounterImageUrl, '_blank')}
                        className="w-full px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
                      >
                        Visualizza
                      </button>
                    </div>
                  )}
                </div>
                
                {(trip.edasImageUrl || trip.loadingNoteImageUrl || trip.cartelloCounterImageUrl) && (
                  <div className="mt-8 text-center">
                    <button
                      onClick={() => onViewImages(trip)}
                      className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                    >
                      <ImageIcon className="w-5 h-5 mr-2" />
                      Visualizza Tutte le Immagini
                    </button>
                  </div>
                )}
                
                {!trip.edasImageUrl && !trip.loadingNoteImageUrl && !trip.cartelloCounterImageUrl && (
                  <div className="text-center py-12">
                    <ImageIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-lg text-gray-500">Nessuna immagine caricata per questo viaggio.</p>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Chiudi
          </button>
          <button
            onClick={() => onViewImages(trip)}
            disabled={!trip.edasImageUrl && !trip.loadingNoteImageUrl && !trip.cartelloCounterImageUrl}
            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Visualizza Immagini
          </button>
        </div>
      </div>
    </div>
  );
} 