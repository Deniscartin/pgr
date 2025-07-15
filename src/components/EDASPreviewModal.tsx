'use client';

import { ParsedEDASData, Trip } from '@/lib/types';
import { FileText, X, Truck, User, Package, Calendar, Hash, Home, Briefcase } from 'lucide-react';

interface EDASPreviewModalProps {
  trip?: Trip; // Trip is now optional as we are creating a new one
  edasData: ParsedEDASData;
  onConfirm: () => void;
  onClose: () => void;
}

const DetailItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) => (
  <div className="flex items-start">
    <div className="flex-shrink-0 w-6 h-6 text-gray-400">{icon}</div>
    <div className="ml-3">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value}</dd>
    </div>
  </div>
);

export default function EDASPreviewModal({ trip: _trip, edasData, onConfirm, onClose }: EDASPreviewModalProps) {
  const { documentInfo, senderInfo, recipientInfo, depositorInfo, transportInfo, productInfo } = edasData;

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4 pb-4 border-b">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <FileText className="h-6 w-6 mr-2 text-indigo-600" />
            Conferma Dati e-DAS
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-6">
          {/* Document Info */}
          <div>
            <h4 className="text-base font-medium text-gray-800 mb-3 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-gray-500" /> Documento
            </h4>
            <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-4 border-l border-gray-200 ml-2.5">
              <DetailItem icon={<Hash />} label="Numero DAS" value={documentInfo.dasNumber} />
              <DetailItem icon={<Calendar />} label="Data e Ora Spedizione" value={documentInfo.shippingDateTime} />
            </div>
          </div>

          {/* Sender Info */}
          <div>
            <h4 className="text-base font-medium text-gray-800 mb-3 flex items-center">
              <Home className="h-5 w-5 mr-2 text-gray-500" /> Deposito Mittente
            </h4>
            <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-4 border-l border-gray-200 ml-2.5">
              <DetailItem icon={<Briefcase />} label="Nome" value={senderInfo.name} />
              <DetailItem icon={<Hash />} label="Codice Deposito" value={senderInfo.depositoMittenteCode} />
              <div className="sm:col-span-2">
                <DetailItem icon={<FileText />} label="Indirizzo" value={senderInfo.address} />
              </div>
            </div>
          </div>
          
          {/* Recipient Info */}
          <div>
            <h4 className="text-base font-medium text-gray-800 mb-3 flex items-center">
              <User className="h-5 w-5 mr-2 text-gray-500" /> Destinatario / Impianto Ricevente
            </h4>
            <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-4 border-l border-gray-200 ml-2.5">
              <DetailItem icon={<User />} label="Nome" value={recipientInfo.name} />
              <DetailItem icon={<FileText />} label="Indirizzo" value={recipientInfo.address} />
            </div>
          </div>

          {/* Depositor Info (optional) */}
          {depositorInfo && depositorInfo.name && (
            <div>
              <h4 className="text-base font-medium text-gray-800 mb-3 flex items-center">
                <Briefcase className="h-5 w-5 mr-2 text-gray-500" /> Depositante
              </h4>
              <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-4 border-l border-gray-200 ml-2.5">
                <DetailItem icon={<User />} label="Nome" value={depositorInfo.name} />
              </div>
            </div>
          )}

          {/* Transport Info */}
          <div>
            <h4 className="text-base font-medium text-gray-800 mb-3 flex items-center">
              <Truck className="h-5 w-5 mr-2 text-gray-500" /> Trasporto
            </h4>
            <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-4 border-l border-gray-200 ml-2.5">
              <DetailItem icon={<Briefcase />} label="Primo Vettore" value={transportInfo.firstCarrierName} />
              <DetailItem icon={<User />} label="Primo Incaricato del Trasporto" value={transportInfo.driverName} />
            </div>
          </div>

          {/* Product Info */}
          <div>
            <h4 className="text-base font-medium text-gray-800 mb-3 flex items-center">
              <Package className="h-5 w-5 mr-2 text-gray-500" /> Prodotto
            </h4>
            <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-4 border-l border-gray-200 ml-2.5">
              <div className="sm:col-span-2">
                <DetailItem icon={<Package />} label="Descrizione" value={productInfo.description} />
              </div>
              <DetailItem icon={<Hash />} label="Peso Netto (kg)" value={productInfo.netWeightKg} />
              <DetailItem icon={<Hash />} label="Volume a Temp. Ambiente (lt)" value={productInfo.volumeAtAmbientTempL} />
              <DetailItem icon={<Hash />} label="Volume a 15°C (lt)" value={productInfo.volumeAt15CL} />
              <DetailItem icon={<Hash />} label="Densità a Temp. Ambiente" value={productInfo.densityAtAmbientTemp} />
              <DetailItem icon={<Hash />} label="Densità a 15°C" value={productInfo.densityAt15C} />
            </div>
          </div>
        </div>

        <div className="flex justify-end items-center mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 mr-3 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700"
          >
            Conferma e Crea Viaggio
          </button>
        </div>
      </div>
    </div>
  );
} 