'use client';

import { useState, useMemo } from 'react';
import { Trip, Order, User } from '@/lib/types';
import { Search, ChevronLeft, ChevronRight, Filter, Calendar, User as UserIcon, FileText, Trash2, Truck } from 'lucide-react';

interface TripsTableProps {
  trips: Trip[];
  orders: Order[];
  drivers: User[];
  onViewDetails: (trip: Trip) => void;
  onDeleteTrip?: (trip: Trip) => void;
}

export default function TripsTable({ trips, orders, drivers, onViewDetails, onDeleteTrip }: TripsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;


  
  // Get unique drivers for filter (same as modal)
  const uniqueDrivers = useMemo(() => {
    const driverSet = new Set<string>();
    trips.forEach(trip => {
      const driverName = trip.loadingNoteData?.driverName || trip.driverName;
      if (driverName && driverName.trim()) {
        driverSet.add(driverName.trim());
      }
    });
    return Array.from(driverSet).sort();
  }, [trips]);

  // Get unique carriers for filter (from driver data, same as modal)
  const uniqueCarriers = useMemo(() => {
    const carrierSet = new Set<string>();
    trips.forEach(trip => {
      const driver = drivers.find(d => d.id === trip.driverId);
      const driverCarriers = driver?.carriers || (driver?.carrier ? [driver.carrier] : []);
      driverCarriers.forEach(carrier => {
        if (carrier && carrier.trim()) {
          carrierSet.add(carrier.trim());
        }
      });
    });
    return Array.from(carrierSet).sort();
  }, [trips, drivers]);

  const filteredAndSortedTrips = useMemo(() => {
    let filtered = trips;

    // Carrier filter (using driver data, same as modal)
    if (carrierFilter !== 'all') {
      filtered = filtered.filter(trip => {
        const driver = drivers.find(d => d.id === trip.driverId);
        const driverCarriers = driver?.carriers || (driver?.carrier ? [driver.carrier] : []);
        return driverCarriers.includes(carrierFilter);
      });
    }

    // Driver filter (same as modal)
    if (driverFilter !== 'all') {
      filtered = filtered.filter(trip => {
        const driverName = trip.loadingNoteData?.driverName || trip.driverName;
        return driverName === driverFilter;
      });
    }

    // Date range filter
    if (dateFromFilter || dateToFilter) {
      filtered = filtered.filter(trip => {
        const tripDate = trip.createdAt ? (trip.createdAt instanceof Date ? trip.createdAt : new Date(trip.createdAt as any)) : null;
        if (!tripDate) return false;
        
        const tripDateString = tripDate.toISOString().split('T')[0];
        
        if (dateFromFilter && tripDateString < dateFromFilter) return false;
        if (dateToFilter && tripDateString > dateToFilter) return false;
        
        return true;
      });
    }

    // Search filter (matching modal fields)
    if (searchTerm) {
      const lowercasedSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(trip => {
        const driver = drivers.find(d => d.id === trip.driverId);
        const driverCarriers = driver?.carriers || (driver?.carrier ? [driver.carrier] : []);
        const driverName = trip.loadingNoteData?.driverName || trip.driverName;
        
        return (
          driverName?.toLowerCase().includes(lowercasedSearchTerm) ||
          trip.loadingNoteData?.documentNumber?.toLowerCase().includes(lowercasedSearchTerm) ||
          trip.loadingNoteData?.consigneeName?.toLowerCase().includes(lowercasedSearchTerm) ||
          trip.loadingNoteData?.productDescription?.toLowerCase().includes(lowercasedSearchTerm) ||
          driverCarriers.some(carrier => carrier?.toLowerCase().includes(lowercasedSearchTerm))
        );
      });
    }

    // Sort by creation date descending
    return filtered.sort((a, b) => {
      const dateA = a.createdAt ? (a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt as any).getTime()) : 0;
      const dateB = b.createdAt ? (b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt as any).getTime()) : 0;
      return dateB - dateA;
    });
  }, [trips, orders, drivers, searchTerm, carrierFilter, driverFilter, dateFromFilter, dateToFilter]);

  const totalPages = Math.ceil(filteredAndSortedTrips.length / itemsPerPage);
  const paginatedTrips = filteredAndSortedTrips.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setCarrierFilter('all');
    setDriverFilter('all');
    setDateFromFilter('');
    setDateToFilter('');
    setCurrentPage(1);
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg mt-8">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">Gestione Viaggi</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Cerca, filtra e gestisci tutti i viaggi. Totale: {filteredAndSortedTrips.length} viaggi
            </p>
          </div>
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Pulisci Filtri
          </button>
        </div>
        
        {/* Enhanced Filters */}
        <div className="mt-4 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Cerca per autista, ordine, cliente, DAS, prodotto, vettore..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Carrier Filter */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Truck className="h-5 w-5 text-gray-400" />
              </div>
              <select
                value={carrierFilter}
                onChange={(e) => {
                  setCarrierFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="all">Tutti i vettori</option>
                {uniqueCarriers.map(carrier => (
                  <option key={carrier} value={carrier}>{carrier}</option>
                ))}
              </select>
            </div>

            {/* Driver Filter */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-gray-400" />
              </div>
              <select
                value={driverFilter}
                onChange={(e) => {
                  setDriverFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="all">Tutti gli autisti</option>
                {uniqueDrivers.map(driver => (
                  <option key={driver} value={driver}>{driver}</option>
                ))}
              </select>
            </div>

            {/* Date From Filter */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="date"
                value={dateFromFilter}
                onChange={(e) => {
                  setDateFromFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Data da"
              />
            </div>

            {/* Date To Filter */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="date"
                value={dateToFilter}
                onChange={(e) => {
                  setDateToFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Data a"
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        {paginatedTrips.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-gray-500">Nessun viaggio trovato con i filtri correnti.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DAS / Ordine</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Autista</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prodotto</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vettore</th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Azioni</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedTrips.map((trip) => {
                const order = orders.find(o => o.id === trip.orderId);
                const driver = drivers.find(d => d.id === trip.driverId);
                const driverCarriers = driver?.carriers || (driver?.carrier ? [driver.carrier] : []);
                const createdAt = trip.createdAt ? (trip.createdAt instanceof Date ? trip.createdAt : new Date(trip.createdAt as any)) : null;

                
                return (
                  <tr key={trip.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onViewDetails(trip)}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {trip.loadingNoteData?.documentNumber || trip.id.substring(0,8) + '...'}
                      </div>
                      {/* <div className="text-sm text-gray-500">
                        {order?.orderNumber || 'N/A'}
                      </div> */}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {trip.loadingNoteData?.driverName || trip.driverName || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{trip.loadingNoteData?.consigneeName || 'N/A'}</div>
                      <div className="text-sm text-gray-500">{trip.edasData?.recipientInfo?.name || ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {trip.loadingNoteData?.productDescription || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {trip.loadingNoteData?.volumeLiters ? `${trip.loadingNoteData.volumeLiters}L` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        trip.status === 'completato' ? 'bg-green-100 text-green-800' : 
                        trip.status === 'in_corso' ? 'bg-yellow-100 text-yellow-800' : 
                        trip.status === 'assegnato' ? 'bg-blue-100 text-blue-800' :
                        trip.status === 'elaborazione' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {trip.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {trip.loadingNoteData?.loadingDate || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {driverCarriers.join(', ') || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onViewDetails(trip); }} 
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Dettagli
                        </button>
                        {onDeleteTrip && (
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              onDeleteTrip(trip); 
                            }} 
                            className="text-red-600 hover:text-red-900 ml-2"
                            title="Elimina viaggio e ordine"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Precedente
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Successivo
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Mostrando da{' '}
                <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>
                {' '}a{' '}
                <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredAndSortedTrips.length)}</span>
                {' '}di{' '}
                <span className="font-medium">{filteredAndSortedTrips.length}</span>
                {' '}risultati
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                
                {/* Page Numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNumber = i + 1;
                  return (
                    <button
                      key={pageNumber}
                      onClick={() => handlePageChange(pageNumber)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        currentPage === pageNumber
                          ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight className="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 