'use client';

import { useState, useEffect } from 'react';
import { Trip, Order } from '@/lib/types';
import { X, Image as ImageIcon, AlertTriangle, CheckCircle, Edit3, Save, AlertCircle, FileText, Truck, Package, MapPin, Download, RefreshCw } from 'lucide-react';

interface TripDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip | null;
  order: Order | null;
  onViewImages: (trip: Trip) => void;
  onSaveChanges?: (tripId: string, changes: any) => Promise<void>;
}

const DetailItem = ({ label, value, isEditable = false, onEdit, type = 'text' }: { 
  label: string; 
  value: string | number | undefined | null; 
  isEditable?: boolean;
  onEdit?: (newValue: string) => void;
  type?: 'text' | 'number' | 'date' | 'textarea' | 'select';
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value || ''));

  const handleSave = () => {
    onEdit?.(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(String(value || ''));
    setIsEditing(false);
  };

  return (
    <div className="py-3 border-b border-gray-100 last:border-b-0">
      <dt className="text-sm font-semibold text-gray-600 mb-1">{label}</dt>
      <dd className="text-sm text-gray-900 flex items-center gap-2">
        {isEditable && isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            {type === 'textarea' ? (
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
                rows={3}
              />
            ) : (
            <input
                type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            )}
            <button onClick={handleSave} className="text-green-600 hover:text-green-800 p-1">
              <Save className="h-4 w-4" />
            </button>
            <button onClick={handleCancel} className="text-gray-600 hover:text-gray-800 p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <span className="flex-1 font-medium break-words">{value || 'N/A'}</span>
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

export default function TripDetailModal({ isOpen, onClose, trip, order, onViewImages, onSaveChanges }: TripDetailModalProps) {
  const [activeTab, setActiveTab] = useState('general');
  const [modifiedFields, setModifiedFields] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setModifiedFields({});
    setHasUnsavedChanges(false);
  }, [trip?.id]);

  if (!isOpen || !trip) return null;

  const createdAt = trip.createdAt ? (trip.createdAt instanceof Date ? trip.createdAt : new Date(trip.createdAt as any)) : null;
  const completedAt = trip.completedAt ? (trip.completedAt instanceof Date ? trip.completedAt : new Date(trip.completedAt as any)) : null;

  const tabs = [
    { id: 'general', label: 'Generale', icon: <FileText className="h-4 w-4" /> },
    { id: 'images', label: 'Immagini', icon: <ImageIcon className="h-4 w-4 ml-4" /> }
  ];

  const handleFieldEdit = (fieldPath: string, value: string) => {
    setModifiedFields(prev => ({
      ...prev,
      [fieldPath]: value
    }));
    setHasUnsavedChanges(true);
  };

  const handleSaveAllChanges = async () => {
    if (!onSaveChanges || !trip?.id) return;
    
    setIsSaving(true);
    try {
      await onSaveChanges(trip.id, modifiedFields);
      setModifiedFields({});
      setHasUnsavedChanges(false);
      // Optionally show success message
    } catch (error) {
      console.error('Error saving changes:', error);
      // Optionally show error message
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    setModifiedFields({});
    setHasUnsavedChanges(false);
  };

  // Helper function to get current value (modified or original)
  const getCurrentValue = (fieldPath: string, originalValue: any) => {
    return modifiedFields[fieldPath] !== undefined ? modifiedFields[fieldPath] : originalValue;
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
              Numero EDAS: {getCurrentValue('loadingNoteData.documentInfo.dasNumber', trip.loadingNoteData?.documentNumber) || trip.id.substring(0, 8) + '...'}
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
                getCurrentValue('status', trip.status) === 'completato' ? 'bg-green-100 text-green-800' : 
                getCurrentValue('status', trip.status) === 'in_corso' ? 'bg-yellow-100 text-yellow-800' : 
                getCurrentValue('status', trip.status) === 'assegnato' ? 'bg-blue-100 text-blue-800' :
                getCurrentValue('status', trip.status) === 'elaborazione' ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {getCurrentValue('status', trip.status).replace('_', ' ').toUpperCase()}
              </span>
              <div className="text-sm text-gray-600">
                <span className="font-medium">Autista:</span>
                <span className="ml-2 font-semibold text-gray-900">{getCurrentValue('driverName', trip.driverName)}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              <span className="font-medium">Creato:</span>
              <span className="ml-2">{createdAt?.toLocaleString('it-IT')}</span>
              </div>
              {hasUnsavedChanges && (
                <div className="text-sm text-orange-600 font-medium">
                  ● Modifiche non salvate
                </div>
              )}
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
              {/* <section>
                <h3 className="text-xl font-semibold text-gray-900 mb-6 pb-2 border-b-2 border-indigo-100">
                  Informazioni Viaggio
                </h3>
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                    <DetailItem label="ID Viaggio" value={trip.id} />
                    <DetailItem 
                      label="Stato" 
                      value={getCurrentValue('status', trip.status)} 
                      isEditable 
                      onEdit={(value) => handleFieldEdit('status', value)} 
                    />
                    <DetailItem 
                      label="Autista" 
                      value={getCurrentValue('driverName', trip.driverName)} 
                      isEditable 
                      onEdit={(value) => handleFieldEdit('driverName', value)} 
                    />
                    <DetailItem label="Data di Creazione" value={createdAt?.toLocaleString('it-IT')} />
                    <DetailItem 
                      label="Data di Completamento" 
                      value={getCurrentValue('completedAt', completedAt?.toLocaleString('it-IT'))} 
                      isEditable 
                      onEdit={(value) => handleFieldEdit('completedAt', value)} 
                      type="date"
                    />
                   
                  </div>
                </div>
              </section> */}

                <section>
                  <h3 className="text-xl font-semibold text-gray-900 mb-6 pb-2 border-b-2 border-indigo-100">
                    Informazioni Ordine
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                    <DetailItem 
                      label="Società" 
                      value={getCurrentValue('loadingNoteData.companyName', trip.loadingNoteData?.companyName)} 
                      isEditable 
                      onEdit={(value) => handleFieldEdit('loadingNoteData.companyName', value)} 
                    />
                    <DetailItem 
                      label="Deposito" 
                      value={getCurrentValue('edasData.depositorInfo.name', trip.edasData?.depositorInfo?.name)} 
                      isEditable 
                      onEdit={(value) => handleFieldEdit('edasData.depositorInfo.name', value)} 
                    />
                    <DetailItem 
                      label="Data" 
                      value={getCurrentValue('loadingNoteData.loadingDate', trip.loadingNoteData?.loadingDate)} 
                      isEditable 
                      onEdit={(value) => handleFieldEdit('loadingNoteData.loadingDate', value)} 
                      type="date"
                    />
                    <DetailItem 
                      label="Cliente" 
                      value={getCurrentValue('loadingNoteData.consigneeName', trip.loadingNoteData?.consigneeName)} 
                      isEditable 
                      onEdit={(value) => handleFieldEdit('loadingNoteData.consigneeName', value)} 
                    />
                    {/* <DetailItem 
                      label="Destinazione" 
                      value={getCurrentValue('edasData.recipientInfo.name', trip.edasData?.recipientInfo?.name)} 
                      isEditable 
                      onEdit={(value) => handleFieldEdit('edasData.recipientInfo.name', value)} 
                      type="textarea"
                    /> */}
                    <DetailItem 
                      label="Prodotto" 
                      value={getCurrentValue('loadingNoteData.productDescription', trip.loadingNoteData?.productDescription)} 
                      isEditable 
                      onEdit={(value) => handleFieldEdit('loadingNoteData.productDescription', value)} 
                      type="textarea"
                    />
                    <DetailItem 
                      label="Quantità Consegnata (LITRI)" 
                      value={getCurrentValue('loadingNoteData.volumeLiters', trip.loadingNoteData?.volumeLiters)} 
                      isEditable 
                      onEdit={(value) => handleFieldEdit('loadingNoteData.volumeLiters', value)} 
                      type="number"
                    />
                    <DetailItem 
                      label="Densità a 15°" 
                      value={getCurrentValue('loadingNoteData.densityAt15C', trip.loadingNoteData?.densityAt15C)} 
                      isEditable 
                      onEdit={(value) => handleFieldEdit('loadingNoteData.densityAt15C', value)} 
                      type="number"
                    />
                    <DetailItem 
                      label="Densità Ambiente" 
                      value={getCurrentValue('edasData.productInfo.densityAtAmbientTemp', trip.edasData?.productInfo?.densityAtAmbientTemp)} 
                      isEditable 
                      onEdit={(value) => handleFieldEdit('edasData.productInfo.densityAtAmbientTemp', value)} 
                      type="number"
                    />
                    <DetailItem 
                      label="Quantità in KG" 
                      value={getCurrentValue('loadingNoteData.netWeightKg', trip.loadingNoteData?.netWeightKg)} 
                      isEditable 
                      onEdit={(value) => handleFieldEdit('loadingNoteData.netWeightKg', value)} 
                      type="number"
                    />
                    <DetailItem 
                      label="Vettore" 
                      value={getCurrentValue('loadingNoteData.carrierName', trip.loadingNoteData?.carrierName)} 
                      isEditable 
                      onEdit={(value) => handleFieldEdit('loadingNoteData.carrierName', value)} 
                    />
                    <DetailItem 
                      label="Autista" 
                      value={getCurrentValue('loadingNoteData.driverName', trip.loadingNoteData?.driverName || trip.driverName)} 
                      isEditable 
                      onEdit={(value) => handleFieldEdit('loadingNoteData.driverName', value)} 
                    />
                  </div>
                  </div>
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
        <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <button
                onClick={handleDiscardChanges}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Scarta Modifiche
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Chiudi
          </button>
            {hasUnsavedChanges && (
              <button
                onClick={handleSaveAllChanges}
                disabled={isSaving}
                className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salva Modifiche
                  </>
                )}
              </button>
            )}
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
    </div>
  );
} 