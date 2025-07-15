'use client';

import { useState } from 'react';
import { X, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { Order, User, Trip } from '@/lib/types';

interface ManageOrderModalProps {
  order: Order;
  drivers: User[];
  currentTrip?: (Trip & { driverName: string });
  onClose: () => void;
}

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <span className="text-xs text-gray-500">{label}</span>
    <p className="font-medium text-sm">{value || 'N/D'}</p>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-md mb-3">
      <button
        className="w-full flex justify-between items-center p-3 bg-gray-50 hover:bg-gray-100"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h5 className="font-semibold text-gray-700">{title}</h5>
        {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </button>
      {isOpen && <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4 border-t border-gray-200">{children}</div>}
    </div>
  );
};

export default function ManageOrderModal({ order, currentTrip, onClose }: ManageOrderModalProps) {
  const edas = currentTrip?.edasData;
  const loadingNote = currentTrip?.loadingNoteData;
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative p-5 border w-11/12 md:w-2/3 lg:w-3/4 shadow-lg rounded-md bg-white my-8 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h3 className="text-xl font-bold text-gray-900 flex items-center">
            <FileText className="h-6 w-6 mr-3 text-indigo-600" />
            Dettaglio Viaggio e Ordine
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="overflow-y-auto pr-2 flex-grow">
          {/* Main Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 p-4 bg-gray-50 rounded-lg">
             <DetailRow label="Numero Ordine" value={order.orderNumber} />
             <DetailRow label="Cliente" value={order.customerName} />
             <DetailRow label="Indirizzo Consegna" value={order.deliveryAddress} />
        {currentTrip && (
                <>
                  <DetailRow label="Autista Assegnato" value={currentTrip.driverName} />
                  <DetailRow label="Stato Viaggio" value={<span className="font-bold">{currentTrip.status}</span>} />
                  <DetailRow label="Data Completamento" value={currentTrip.completedAt ? new Date(currentTrip.completedAt).toLocaleString('it-IT') : 'In corso'} />
                </>
             )}
          </div>
          
          {/* Document Details */}
          {edas && (
            <Section title="Dettagli e-DAS">
              <DetailRow label="Numero DAS" value={edas.documentInfo.dasNumber} />
              <DetailRow label="Data Spedizione" value={edas.documentInfo.shippingDateTime} />
              <DetailRow label="Mittente" value={edas.senderInfo.name} />
              <DetailRow label="Destinatario" value={edas.recipientInfo.name} />
              <DetailRow label="Vettore" value={edas.transportInfo.firstCarrierName} />
              <DetailRow label="Targa" value={edas.transportInfo.vehicleId} />
              <DetailRow label="Prodotto" value={edas.productInfo.description} />
              <DetailRow label="Volume a 15°C" value={`${edas.productInfo.volumeAt15CL} L`} />
              <DetailRow label="Peso Netto" value={`${edas.productInfo.netWeightKg} Kg`} />
            </Section>
          )}

          {loadingNote && (
            <Section title="Dettagli Nota di Carico">
              <DetailRow label="Numero Documento" value={loadingNote.documentNumber} />
              <DetailRow label="Data Carico" value={loadingNote.loadingDate} />
              <DetailRow label="Vettore" value={loadingNote.carrierName} />
              <DetailRow label="Spedizioniere" value={loadingNote.shipperName} />
              <DetailRow label="Destinatario" value={loadingNote.consigneeName} />
              <DetailRow label="Prodotto" value={loadingNote.productDescription} />
              <DetailRow label="Volume" value={`${loadingNote.volumeLiters} L`} />
              <DetailRow label="Peso Netto" value={`${loadingNote.netWeightKg} Kg`} />
              <DetailRow label="Peso Lordo" value={`${loadingNote.grossWeightKg} Kg`} />
              <DetailRow label="Note" value={loadingNote.notes} />
            </Section>
          )}

          {!edas && !loadingNote && (
            <div className="text-center py-8 text-gray-500">
              Nessun dato dai documenti scansionati per questo viaggio.
            </div>
          )}

        </div>

        <div className="flex justify-end mt-6 border-t pt-4">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md text-sm font-medium hover:bg-gray-300"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
} 