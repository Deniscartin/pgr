import React, { useState, useMemo } from 'react';
import { Trip, Order, User, UserRole } from '@/lib/types/index';
import { 
  CheckCircle,
  Download,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Camera,
  MapPin,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface CompletedTripItemProps {
  trip: Trip;
  order?: Order;
  driver?: User;
  userRole: UserRole;
  onViewImages?: (trip: Trip) => void;
}

const CompletedTripItem = ({ trip, order, driver, userRole, onViewImages }: CompletedTripItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const validationErrors = trip.validationResults?.filter(r => !r.isMatch && (r.severity === 'error' || r.severity === 'warning')) || [];
  const hasValidationIssues = validationErrors.length > 0;
  const hasImages = trip.edasImageUrl || trip.edasProcessedImageUrl || trip.loadingNoteImageUrl || trip.loadingNoteProcessedImageUrl || trip.cartelloCounterImageUrl;

  return (
    <li className="px-4 py-4 sm:px-6 hover:bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <CheckCircle className="h-6 w-6 text-green-500" />
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900 flex items-center">
              Ordine: {order?.orderNumber || 'N/D'}
              {hasValidationIssues && userRole === 'admin' && (
                <AlertTriangle className="h-4 w-4 text-yellow-500 ml-2" />
              )}
            </div>
            
            {/* Driver info - only for admin */}
            {userRole === 'admin' && (
              <div className="text-sm text-gray-500">
                Autista: {driver?.name || 'N/D'}
              </div>
            )}
            
            {/* Delivery address - for both roles */}
            <div className="text-sm text-gray-500">
              <MapPin className="inline h-4 w-4 mr-1" />
              {order?.deliveryAddress || 'N/D'}
            </div>
            
            {/* Customer - for both roles */}
            <div className="text-sm text-gray-500">
              Cliente: {order?.customerName || 'N/D'}
            </div>
            
            {/* DAS Code - for both roles */}
            {trip.edasData?.documentInfo?.dasNumber && (
              <div className="text-sm text-indigo-600">
                DAS: {trip.edasData.documentInfo.dasNumber}
              </div>
            )}
            
            <div className="text-sm text-gray-500">
              Completato il: {trip.completedAt ? new Date(trip.completedAt).toLocaleDateString() : 'N/A'}
            </div>
            
            {/* Validation issues - only for admin */}
            {hasValidationIssues && userRole === 'admin' && (
              <div className="text-xs text-yellow-600 font-medium">
                {validationErrors.length} discrepanza/e rilevata/e
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Image viewer button - only for admin and only if images exist */}
          {userRole === 'admin' && hasImages && onViewImages && (
            <button 
              onClick={() => onViewImages(trip)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Visualizza Documenti"
            >
              <Camera className="h-5 w-5" />
            </button>
          )}
          
          {/* Expand button - only for admin */}
          {userRole === 'admin' && (
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 rounded-full hover:bg-gray-200">
              {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Details - only for admin */}
      {isExpanded && userRole === 'admin' && (
        <div className="mt-4 bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Dettagli Ordine</h4>
              <div className="space-y-1">
                <p><span className="font-medium">Prodotto:</span> {order?.product || 'N/D'}</p>
                <p><span className="font-medium">Quantità:</span> {order?.quantity || 'N/D'} {order?.quantityUnit || ''}</p>
                <p><span className="font-medium">Indirizzo:</span> {order?.deliveryAddress || 'N/D'}</p>
              </div>
            </div>
            
            {trip.validationResults && trip.validationResults.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Validazione Documenti</h4>
                <div className="space-y-2">
                  {trip.validationResults.map((validation, index) => (
                    <div key={index} className={`text-xs p-2 rounded ${
                      validation.isMatch ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      <div className="font-medium">{validation.field}</div>
                      <div>e-DAS: {validation.edasValue}</div>
                      <div>Nota Carico: {validation.loadingNoteValue}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
};

interface UnifiedTripsTableProps {
  trips: Trip[];
  orders: Order[];
  drivers?: User[];
  userRole: UserRole;
  title: string;
  subtitle?: string;
  showExport?: boolean;
  onExport?: () => void;
  onViewImages?: (trip: Trip) => void;
}

type SortField = 'date' | 'orderNumber' | 'customer' | 'driver' | 'status';
type SortDirection = 'asc' | 'desc';

export default function UnifiedTripsTable({ 
  trips, 
  orders, 
  drivers = [], 
  userRole, 
  title, 
  subtitle,
  showExport = false,
  onExport,
  onViewImages
}: UnifiedTripsTableProps) {
  // State for filtering, sorting, and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const getOrderById = (orderId: string) => orders.find(order => order.id === orderId);
  const getDriverById = (driverId: string) => drivers.find(driver => driver.id === driverId);

  // Filtering and sorting logic
  const filteredAndSortedTrips = useMemo(() => {
    let filtered = trips;

    // Apply search filter
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = trips.filter(trip => {
        const order = getOrderById(trip.orderId);
        const driver = getDriverById(trip.driverId);
        
        return (
          order?.orderNumber?.toLowerCase().includes(lowerSearchTerm) ||
          order?.customerName?.toLowerCase().includes(lowerSearchTerm) ||
          driver?.name?.toLowerCase().includes(lowerSearchTerm) ||
          trip.edasData?.documentInfo?.dasNumber?.toLowerCase().includes(lowerSearchTerm)
        );
      });
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(trip => trip.status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case 'date':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        case 'orderNumber':
          aValue = getOrderById(a.orderId)?.orderNumber || '';
          bValue = getOrderById(b.orderId)?.orderNumber || '';
          break;
        case 'customer':
          aValue = getOrderById(a.orderId)?.customerName || '';
          bValue = getOrderById(b.orderId)?.customerName || '';
          break;
        case 'driver':
          aValue = getDriverById(a.driverId)?.name || '';
          bValue = getDriverById(b.driverId)?.name || '';
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [trips, orders, drivers, searchTerm, statusFilter, sortField, sortDirection, getDriverById, getOrderById]);

  // Pagination logic
  const totalPages = Math.ceil(filteredAndSortedTrips.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTrips = filteredAndSortedTrips.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 text-indigo-500" />
      : <ArrowDown className="h-4 w-4 text-indigo-500" />;
  };

  if (trips.length === 0) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">{title}</h3>
          <p className="mt-2 text-sm text-gray-500">Nessun viaggio trovato.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      {/* Header with title and export */}
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-1 max-w-2xl text-sm text-gray-500 hidden sm:block">
                {subtitle}
              </p>
            )}
          </div>
          
          {/* Export button - only for admin */}
          {showExport && userRole === 'admin' && onExport && (
            <button
              onClick={onExport}
              disabled={filteredAndSortedTrips.length === 0}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4 mr-2" />
              Esporta in Excel
            </button>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      <div className="px-4 py-4 sm:px-6 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Cerca per ordine, cliente, autista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="all">Tutti gli stati</option>
              <option value="elaborazione">In Elaborazione</option>
              <option value="assegnato">Assegnato</option>
              <option value="in_corso">In Corso</option>
              <option value="completato">Completato</option>
            </select>
          </div>

          {/* Items per page */}
          <div>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value={5}>5 per pagina</option>
              <option value={10}>10 per pagina</option>
              <option value={25}>25 per pagina</option>
              <option value={50}>50 per pagina</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sort Headers */}
      <div className="px-4 py-3 sm:px-6 bg-gray-50 border-b border-gray-200">
        <div className="flex gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <button
            onClick={() => handleSort('date')}
            className="flex items-center gap-1 hover:text-indigo-600"
          >
            Data {getSortIcon('date')}
          </button>
          <button
            onClick={() => handleSort('orderNumber')}
            className="flex items-center gap-1 hover:text-indigo-600"
          >
            Ordine {getSortIcon('orderNumber')}
          </button>
          <button
            onClick={() => handleSort('customer')}
            className="flex items-center gap-1 hover:text-indigo-600"
          >
            Cliente {getSortIcon('customer')}
          </button>
          {userRole === 'admin' && (
            <button
              onClick={() => handleSort('driver')}
              className="flex items-center gap-1 hover:text-indigo-600"
            >
              Autista {getSortIcon('driver')}
            </button>
          )}
          <button
            onClick={() => handleSort('status')}
            className="flex items-center gap-1 hover:text-indigo-600"
          >
            Stato {getSortIcon('status')}
          </button>
        </div>
      </div>

      {/* Results count */}
      <div className="px-4 py-2 sm:px-6 bg-gray-50 border-b border-gray-200 text-sm text-gray-700">
        Mostrando {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredAndSortedTrips.length)} di {filteredAndSortedTrips.length} risultati
      </div>
      
      {/* Trip List */}
      {paginatedTrips.length > 0 ? (
        <ul className="divide-y divide-gray-200">
          {paginatedTrips.map((trip) => {
            const order = getOrderById(trip.orderId);
            const driver = getDriverById(trip.driverId);
            return (
              <CompletedTripItem 
                key={trip.id} 
                trip={trip} 
                order={order} 
                driver={driver} 
                userRole={userRole}
                onViewImages={onViewImages}
              />
            );
          })}
        </ul>
      ) : (
        <div className="px-4 py-8 sm:px-6 text-center text-gray-500">
          Nessun viaggio trovato con i filtri applicati.
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 sm:px-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Pagina {currentPage} di {totalPages}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center px-2 py-1 border border-gray-300 text-sm font-medium rounded text-gray-500 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`inline-flex items-center px-3 py-1 border text-sm font-medium rounded ${
                      currentPage === pageNum
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                        : 'border-gray-300 text-gray-500 bg-white hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center px-2 py-1 border border-gray-300 text-sm font-medium rounded text-gray-500 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 