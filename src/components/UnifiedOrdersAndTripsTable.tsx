import React, { useState, useMemo } from 'react';
import { Trip, Order, User } from '@/lib/types/index';
import { 
  FileText,
  Truck,
  CheckCircle,
  Clock,
  AlertTriangle,
  Camera,
  MapPin,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';


interface CombinedItem {
  type: 'order' | 'trip';
  id: string;
  order: Order;
  trip?: Trip;
  driver?: User;
  createdAt: Date;
  status: 'pendente' | 'assegnato' | 'in_corso' | 'completato' | 'annullato';
}

interface UnifiedOrdersAndTripsTableProps {
  orders: Order[];
  trips: Trip[];
  drivers: User[];
  onAssignTrip: (order: Order) => void;
  onManageOrder: (order: Order) => void;
  onViewImages: (trip: Trip) => void;
  onExport: () => void;
}

type SortField = 'date' | 'orderNumber' | 'status' | 'customer' | 'driver';
type SortDirection = 'asc' | 'desc';

export default function UnifiedOrdersAndTripsTable({
  orders,
  trips,
  drivers,
  onAssignTrip,
  onManageOrder,
  onViewImages,
  onExport
}: UnifiedOrdersAndTripsTableProps) {
  // State for filters and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Helper functions
  const getDriverById = (driverId: string) => drivers.find(driver => driver.id === driverId);
  const getTripByOrderId = (orderId: string) => trips.find(trip => trip.orderId === orderId);

  // Create combined data
  const combinedData = useMemo(() => {
    const items: CombinedItem[] = [];

    // Add all orders with their trips (if any)
    orders.forEach(order => {
      const trip = getTripByOrderId(order.id);
      const driver = trip ? getDriverById(trip.driverId) : undefined;
      
      let status: CombinedItem['status'];
      if (trip) {
        status = trip.status as CombinedItem['status'];
      } else {
        status = 'pendente';
      }

      items.push({
        type: trip ? 'trip' : 'order',
        id: trip ? trip.id : order.id,
        order,
        trip,
        driver,
        createdAt: trip ? trip.createdAt : order.createdAt,
        status
      });
    });

    return items;
  }, [orders, trips, drivers]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    const filtered = combinedData.filter(item => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          item.order.orderNumber.toLowerCase().includes(searchLower) ||
          item.order.customerName.toLowerCase().includes(searchLower) ||
          item.order.deliveryAddress.toLowerCase().includes(searchLower) ||
          (item.driver?.name.toLowerCase().includes(searchLower) ?? false);
        
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      // Driver filter
      if (driverFilter !== 'all' && item.driver?.id !== driverFilter) {
        return false;
      }

      return true;
    });

    // Sort data
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'date':
          aValue = a.createdAt;
          bValue = b.createdAt;
          break;
        case 'orderNumber':
          aValue = a.order.orderNumber;
          bValue = b.order.orderNumber;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'customer':
          aValue = a.order.customerName;
          bValue = b.order.customerName;
          break;
        case 'driver':
          aValue = a.driver?.name || '';
          bValue = b.driver?.name || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [combinedData, searchTerm, statusFilter, driverFilter, sortField, sortDirection, getDriverById, getTripByOrderId]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Toggle expanded item
  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  // Get status badge
  const getStatusBadge = (status: string, trip?: Trip) => {
    const validationErrors = trip?.validationResults?.filter(r => !r.isMatch && (r.severity === 'error' || r.severity === 'warning')) || [];
    const hasValidationIssues = validationErrors.length > 0;

    let badgeClass = '';
    let icon = null;

    switch (status) {
      case 'completato':
        badgeClass = 'bg-green-100 text-green-800';
        icon = <CheckCircle className="w-3 h-3 mr-1" />;
        break;
      case 'in_corso':
        badgeClass = 'bg-yellow-100 text-yellow-800';
        icon = <Truck className="w-3 h-3 mr-1" />;
        break;
      case 'assegnato':
        badgeClass = 'bg-blue-100 text-blue-800';
        icon = <Clock className="w-3 h-3 mr-1" />;
        break;
      default:
        badgeClass = 'bg-gray-100 text-gray-800';
        icon = <FileText className="w-3 h-3 mr-1" />;
    }

    return (
      <div className="flex items-center gap-1">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
          {icon}
          {status}
        </span>
        {hasValidationIssues && (
          <span title={`${validationErrors.length} discrepanze rilevate`}>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </span>
        )}
      </div>
    );
  };

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-blue-600" />
      : <ArrowDown className="w-4 h-4 text-blue-600" />;
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      {/* Header with filters */}
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Gestione Ordini e Viaggi
          </h3>
          <button
            onClick={onExport}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Esporta Excel
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Cerca ordini, clienti, indirizzi..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-600 focus:outline-none focus:placeholder-gray-500 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <select
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tutti gli stati</option>
            <option value="pendente">Pendente</option>
            <option value="assegnato">Assegnato</option>
            <option value="in_corso">In corso</option>
            <option value="completato">Completato</option>
            <option value="annullato">Annullato</option>
          </select>

          {/* Driver Filter */}
          <select
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
            value={driverFilter}
            onChange={(e) => setDriverFilter(e.target.value)}
          >
            <option value="all">Tutti gli autisti</option>
            {drivers.map(driver => (
              <option key={driver.id} value={driver.id}>{driver.name}</option>
            ))}
          </select>

          {/* Items per page */}
          <select
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={10}>10 per pagina</option>
            <option value={25}>25 per pagina</option>
            <option value={50}>50 per pagina</option>
            <option value={100}>100 per pagina</option>
          </select>
        </div>

        {/* Results info */}
        <div className="mt-4 text-sm text-gray-900">
          Mostrando <span className="font-medium">{paginatedData.length}</span> di <span className="font-medium">{filteredAndSortedData.length}</span> elementi
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('orderNumber')}
              >
                <div className="flex items-center">
                  Ordine
                  {getSortIcon('orderNumber')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('customer')}
              >
                <div className="flex items-center">
                  Cliente
                  {getSortIcon('customer')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('driver')}
              >
                <div className="flex items-center">
                  Autista
                  {getSortIcon('driver')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center">
                  Stato
                  {getSortIcon('status')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('date')}
              >
                <div className="flex items-center">
                  Data
                  {getSortIcon('date')}
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Azioni
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((item) => {
              const isExpanded = expandedItems.has(item.id);
              const hasImages = item.trip && (item.trip.edasImageUrl || item.trip.edasProcessedImageUrl || item.trip.loadingNoteImageUrl || item.trip.loadingNoteProcessedImageUrl || item.trip.cartelloCounterImageUrl);
              
              return (
                <React.Fragment key={item.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {item.order.orderNumber}
                          </div>
                          <div className="text-sm text-gray-500">
                            {item.order.product} ({item.order.quantity} {item.order.quantityUnit})
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.order.customerName}</div>
                      <div className="text-sm text-gray-500">
                        <MapPin className="inline h-4 w-4 mr-1" />
                        {item.order.deliveryAddress}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {item.driver?.name || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(item.status, item.trip)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.createdAt.toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {/* Image viewer for completed trips */}
                        {hasImages && (
                          <button
                            onClick={() => onViewImages(item.trip!)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Visualizza Documenti"
                          >
                            <Camera className="h-4 w-4" />
                          </button>
                        )}
                        
                        {/* Assign trip button for pending orders */}
                        {item.status === 'pendente' && (
                          <button
                            onClick={() => onAssignTrip(item.order)}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                          >
                            <Truck className="w-4 h-4 mr-1" />
                            Assegna
                          </button>
                        )}
                        
                        {/* Manage order button */}
                        <button
                          onClick={() => onManageOrder(item.order)}
                          className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                          title="Gestisci ordine"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                        
                        {/* Expand button for completed trips */}
                        {item.trip && item.status === 'completato' && (
                          <button
                            onClick={() => toggleExpanded(item.id)}
                            className="p-1 rounded-full hover:bg-gray-200"
                          >
                            {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  
                  {/* Expanded content for completed trips */}
                  {isExpanded && item.trip && (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 bg-gray-50">
                        <div className="text-sm space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2">Dettagli Ordine</h5>
                              <p className="text-gray-800"><strong className="text-gray-900">Cliente:</strong> {item.order.customerName}</p>
                              <p className="text-gray-800"><strong className="text-gray-900">Indirizzo:</strong> {item.order.deliveryAddress}</p>
                              <p className="text-gray-800"><strong className="text-gray-900">Prodotto:</strong> {item.order.product} ({item.order.quantity} {item.order.quantityUnit})</p>
                            </div>
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2">Dettagli Viaggio</h5>
                              {item.trip.edasData && <p className="text-gray-800"><strong className="text-gray-900">N. e-DAS:</strong> {item.trip.edasData.documentInfo.dasNumber}</p>}
                              {item.trip.loadingNoteData && <p className="text-gray-800"><strong className="text-gray-900">N. Nota di Carico:</strong> {item.trip.loadingNoteData.documentNumber}</p>}
                              {item.trip.signatureUrl && (
                                <p className="text-gray-800">
                                  <strong className="text-gray-900">Firma:</strong> 
                                  <a href={item.trip.signatureUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline ml-1">
                                    Visualizza
                                  </a>
                                </p>
                              )}
                              {item.trip.completedAt && (
                                <p className="text-gray-800"><strong className="text-gray-900">Completato:</strong> {new Date(item.trip.completedAt).toLocaleDateString('it-IT')}</p>
                              )}
                            </div>
                          </div>
                          
                          {/* Validation Issues */}
                          {item.trip.validationResults && item.trip.validationResults.some(r => !r.isMatch) && (
                            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                              <h5 className="font-medium text-yellow-900 mb-2 flex items-center">
                                <AlertTriangle className="h-4 w-4 mr-1" />
                                Discrepanze Rilevate
                              </h5>
                              <div className="space-y-1">
                                {item.trip.validationResults.filter(r => !r.isMatch).map((error, idx) => (
                                  <div key={idx} className="text-sm text-yellow-900">
                                    <strong className="text-yellow-900">{error.field}:</strong> e-DAS="{error.edasValue}" ≠ Nota di Carico="{error.loadingNoteValue}"
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-900 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Precedente
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-900 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Successivo
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-900">
                Mostrando <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a{' '}
                <span className="font-medium">
                  {Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)}
                </span>{' '}
                di <span className="font-medium">{filteredAndSortedData.length}</span> risultati
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        currentPage === pageNum
                          ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
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