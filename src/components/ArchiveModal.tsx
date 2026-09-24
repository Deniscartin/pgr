'use client';

import { useMemo } from 'react';
import { X, Archive, Loader2 } from 'lucide-react';
import { Trip, Order, User } from '@/lib/types';
import { useArchivedTrips, useOrdersByIds } from '@/hooks/useFirestore';
import TripsTable from './TripsTable';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  drivers: User[];
  // L'ordine viene passato insieme al viaggio: quelli dell'archivio non sono
  // tra gli ordini caricati in pagina, quindi la dashboard non saprebbe
  // risolverli da sola.
  onViewDetails: (trip: Trip, order?: Order | null) => void;
  onDeleteTrip?: (trip: Trip) => void;
  // Restringe l'archivio agli autisti dell'operatore. Omesso per l'admin,
  // che vede tutto.
  driverIds?: string[];
}

export default function ArchiveModal({
  isOpen,
  onClose,
  drivers,
  onViewDetails,
  onDeleteTrip,
  driverIds,
}: ArchiveModalProps) {
  // I viaggi si caricano solo a modale aperto: l'archivio e' l'intera
  // collection, non va scaricato per chi non lo apre.
  const { trips, loading, hasMore, loadMore } = useArchivedTrips(isOpen, driverIds);

  const orderIds = useMemo(() => trips.map(trip => trip.orderId).filter(Boolean), [trips]);
  const { orders } = useOrdersByIds(orderIds);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-7xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center">
            <Archive className="mr-3 h-5 w-5 text-gray-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Archivio Ordini</h2>
              <p className="text-sm text-gray-600">
                Tutti gli ordini, senza limite di data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Chiudi archivio"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {trips.length === 0 && loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Caricamento archivio...
            </div>
          ) : trips.length === 0 ? (
            <p className="py-16 text-center text-gray-500">Nessun ordine in archivio.</p>
          ) : (
            <>
              <TripsTable
                trips={trips}
                orders={orders}
                drivers={drivers}
                onViewDetails={(trip) =>
                  onViewDetails(trip, orders.find(o => o.id === trip.orderId) ?? null)
                }
                onDeleteTrip={onDeleteTrip}
              />

              {hasMore && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Carica altri
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
