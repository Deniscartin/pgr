'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTrips } from '@/hooks/useFirestore';
import { Order, User } from '@/lib/types';
import { X, Truck, User as UserIcon } from 'lucide-react';

interface AssignTripModalProps {
  order: Order;
  drivers: User[];
  onClose: () => void;
}

export default function AssignTripModal({ order, drivers, onClose }: AssignTripModalProps) {
  const { userProfile } = useAuth();
  const { addTrip } = useTrips();
  
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDriverId || !userProfile) return;
    
    setLoading(true);
    
    try {
      const selectedDriver = drivers.find(driver => driver.id === selectedDriverId);
      await addTrip({
        orderId: order.id,
        driverId: selectedDriverId,
        driverName: selectedDriver?.name || 'Driver Sconosciuto',
        status: 'assegnato',
        assignedBy: userProfile.id,
      });
      
      onClose();
    } catch (error) {
      console.error('Error assigning trip:', error);
      alert('Errore durante l\'assegnazione del viaggio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 lg:w-1/3 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Assegna Viaggio
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Order Details */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h4 className="font-medium text-gray-900 mb-2">Dettagli Ordine</h4>
          <div className="space-y-1 text-sm text-gray-600">
            <p><span className="font-medium">Numero:</span> {order.orderNumber}</p>
            <p><span className="font-medium">Cliente:</span> {order.customerName}</p>
            <p><span className="font-medium">Indirizzo:</span> {order.deliveryAddress}</p>
            {order.notes && (
              <p><span className="font-medium">Note:</span> {order.notes}</p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="driver" className="block text-sm font-medium text-gray-700 mb-3">
              Seleziona Autista *
            </label>
            <div className="space-y-2">
              {drivers.map((driver) => (
                <label
                  key={driver.id}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedDriverId === driver.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="driver"
                    value={driver.id}
                    checked={selectedDriverId === driver.id}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="sr-only"
                  />
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 w-4 h-4 rounded-full border-2 ${
                      selectedDriverId === driver.id
                        ? 'border-indigo-500 bg-indigo-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedDriverId === driver.id && (
                        <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
                      )}
                    </div>
                    <UserIcon className="h-5 w-5 text-gray-400 ml-3 mr-2" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {driver.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {driver.email}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {drivers.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                <UserIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p>Nessun autista disponibile</p>
                <p className="text-sm">Crea prima un autista per assegnare i viaggi</p>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading || !selectedDriverId || drivers.length === 0}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400"
            >
              <Truck className="w-4 h-4 mr-2" />
              {loading ? 'Assegnazione...' : 'Assegna Viaggio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 