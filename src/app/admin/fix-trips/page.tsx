'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Trip } from '@/lib/types';
import { RefreshCw, AlertCircle } from 'lucide-react';

type DocumentType = 'edas' | 'loadingNote' | 'cartelloCounter';

interface ImageAssignment {
  url: string;
  assignedAs: DocumentType;
  originalType: DocumentType;
}

interface TripWithAssignments extends Trip {
  assignments: ImageAssignment[];
}

export default function FixTripsPage() {
  const [trips, setTrips] = useState<TripWithAssignments[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedTrips, setSelectedTrips] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState('2025-11-14');
  const [endDate, setEndDate] = useState('2025-11-15');

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      
      // Date range from user selection
      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T23:59:59`);
      
      const tripsRef = collection(db, 'trips');
      const q = query(
        tripsRef,
        where('createdAt', '>=', Timestamp.fromDate(start)),
        where('createdAt', '<=', Timestamp.fromDate(end))
      );
      
      const querySnapshot = await getDocs(q);
      const tripsData: TripWithAssignments[] = [];
      
      querySnapshot.forEach((doc) => {
        const tripData = { id: doc.id, ...doc.data() } as Trip;
        
        // Initialize assignments
        const assignments: ImageAssignment[] = [];
        
        if (tripData.edasImageUrl) {
          assignments.push({
            url: tripData.edasImageUrl,
            assignedAs: 'edas',
            originalType: 'edas'
          });
        }
        
        if (tripData.loadingNoteImageUrl) {
          assignments.push({
            url: tripData.loadingNoteImageUrl,
            assignedAs: 'loadingNote',
            originalType: 'loadingNote'
          });
        }
        
        if (tripData.cartelloCounterImageUrl) {
          assignments.push({
            url: tripData.cartelloCounterImageUrl,
            assignedAs: 'cartelloCounter',
            originalType: 'cartelloCounter'
          });
        }
        
        tripsData.push({
          ...tripData,
          assignments
        });
      });
      
      // Sort by creation date descending
      tripsData.sort((a, b) => {
        const dateA = a.createdAt ? (a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt as any).getTime()) : 0;
        const dateB = b.createdAt ? (b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt as any).getTime()) : 0;
        return dateB - dateA;
      });
      
      setTrips(tripsData);
    } catch (error) {
      console.error('Error fetching trips:', error);
      alert('Errore nel caricamento dei viaggi');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignmentChange = (tripId: string, imageIndex: number, newType: DocumentType) => {
    setTrips(prevTrips => 
      prevTrips.map(trip => {
        if (trip.id !== tripId) return trip;
        
        const newAssignments = [...trip.assignments];
        
        // Find if another image already has this type assigned
        const existingIndex = newAssignments.findIndex((a, i) => i !== imageIndex && a.assignedAs === newType);
        
        if (existingIndex !== -1) {
          // Switch assignments
          const oldType = newAssignments[imageIndex].assignedAs;
          newAssignments[existingIndex].assignedAs = oldType;
        }
        
        newAssignments[imageIndex].assignedAs = newType;
        
        return {
          ...trip,
          assignments: newAssignments
        };
      })
    );
  };

  const handleSaveAndReprocess = async (tripId: string) => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;
    
    try {
      setProcessing(true);
      
      // Build new URL assignments
      const newUrls: {
        edasImageUrl?: string;
        loadingNoteImageUrl?: string;
        cartelloCounterImageUrl?: string;
      } = {};
      
      trip.assignments.forEach(assignment => {
        if (assignment.assignedAs === 'edas') {
          newUrls.edasImageUrl = assignment.url;
        } else if (assignment.assignedAs === 'loadingNote') {
          newUrls.loadingNoteImageUrl = assignment.url;
        } else if (assignment.assignedAs === 'cartelloCounter') {
          newUrls.cartelloCounterImageUrl = assignment.url;
        }
      });
      
      // Update trip with new assignments
      const tripRef = doc(db, 'trips', tripId);
      await updateDoc(tripRef, newUrls);
      
      console.log(`✅ Trip ${tripId} - Immagini riassegnate, avvio riprocessamento...`);
      
      // Trigger reprocessing
      const response = await fetch('/api/reprocess-trip-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId }),
      });
      
      if (!response.ok) {
        throw new Error('Errore nel riprocessamento');
      }
      
      console.log(`✅ Trip ${tripId} - Riprocessamento completato!`);
      alert(`✅ Trip ${tripId.substring(0, 8)}... riprocessato con successo!`);
      
      // Refresh trip data
      await fetchTrips();
      
    } catch (error) {
      console.error('❌ Errore:', error);
      alert(`Errore durante il riprocessamento del trip ${tripId.substring(0, 8)}...`);
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkReprocess = async () => {
    if (selectedTrips.size === 0) {
      alert('Seleziona almeno un viaggio');
      return;
    }
    
    if (!confirm(`Vuoi riprocessare ${selectedTrips.size} viaggi?`)) {
      return;
    }
    
    setProcessing(true);
    let success = 0;
    let failed = 0;
    
    for (const tripId of Array.from(selectedTrips)) {
      try {
        await handleSaveAndReprocess(tripId);
        success++;
      } catch (error) {
        failed++;
        console.error(`Failed to reprocess trip ${tripId}:`, error);
      }
    }
    
    alert(`Completato!\n✅ Successo: ${success}\n❌ Errori: ${failed}`);
    setSelectedTrips(new Set());
    setProcessing(false);
  };

  const toggleTripSelection = (tripId: string) => {
    setSelectedTrips(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tripId)) {
        newSet.delete(tripId);
      } else {
        newSet.add(tripId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTrips.size === trips.length) {
      setSelectedTrips(new Set());
    } else {
      setSelectedTrips(new Set(trips.map(t => t.id)));
    }
  };

  const hasChanges = (trip: TripWithAssignments) => {
    return trip.assignments.some(a => a.assignedAs !== a.originalType);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento viaggi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-yellow-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Correzione Viaggi - Riassegnazione Documenti
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Riassegna e riprocessa i documenti dei viaggi per date specifiche
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchTrips}
                disabled={loading || processing}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4 inline mr-2" />
                Ricarica
              </button>
              {selectedTrips.size > 0 && (
                <button
                  onClick={handleBulkReprocess}
                  disabled={processing}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4 inline mr-2" />
                  Riprocessa Selezionati ({selectedTrips.size})
                </button>
              )}
            </div>
          </div>

          {/* Date Selectors */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Data Da:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Data A:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={fetchTrips}
              disabled={loading || processing}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Cerca Viaggi
            </button>
          </div>
          
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-blue-900">{trips.length}</p>
              <p className="text-sm text-blue-700">Viaggi Totali</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-yellow-900">
                {trips.filter(hasChanges).length}
              </p>
              <p className="text-sm text-yellow-700">Con Modifiche</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-green-900">{selectedTrips.size}</p>
              <p className="text-sm text-green-700">Selezionati</p>
            </div>
          </div>
        </div>

        {/* Select All */}
        {trips.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={selectedTrips.size === trips.length}
                onChange={toggleSelectAll}
                className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="ml-3 text-sm font-medium text-gray-900">
                Seleziona/Deseleziona Tutti
              </span>
            </label>
          </div>
        )}

        {/* Trips List */}
        {trips.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <p className="text-gray-500">Nessun viaggio trovato per le date 14-15 novembre 2025</p>
          </div>
        ) : (
          <div className="space-y-6">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className={`bg-white rounded-lg shadow-lg p-6 ${
                  hasChanges(trip) ? 'border-2 border-yellow-400' : ''
                }`}
              >
                {/* Trip Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedTrips.has(trip.id)}
                      onChange={() => toggleTripSelection(trip.id)}
                      className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-4"
                    />
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        Trip: {trip.id.substring(0, 12)}...
                      </h3>
                      <p className="text-sm text-gray-600">
                        Autista: {trip.driverName || 'N/A'} | DAS: {trip.edasData?.documentInfo?.dasNumber || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Creato: {trip.createdAt ? new Date(trip.createdAt as any).toLocaleString('it-IT') : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSaveAndReprocess(trip.id)}
                    disabled={processing || !hasChanges(trip)}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing ? 'Elaborazione...' : 'Salva e Riprocessa'}
                  </button>
                </div>

                {/* Images Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {trip.assignments.map((assignment, index) => (
                    <div
                      key={index}
                      className={`border-2 rounded-lg p-4 ${
                        assignment.assignedAs !== assignment.originalType
                          ? 'border-yellow-400 bg-yellow-50'
                          : 'border-gray-200'
                      }`}
                    >
                      {/* Image Preview */}
                      <img
                        src={assignment.url}
                        alt={`Documento ${index + 1}`}
                        className="w-full h-48 object-contain rounded-lg bg-gray-100 mb-3"
                      />

                      {/* Assignment Dropdown */}
                      <select
                        value={assignment.assignedAs}
                        onChange={(e) =>
                          handleAssignmentChange(trip.id, index, e.target.value as DocumentType)
                        }
                        className="block w-full px-3 py-2 text-sm border-2 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg"
                      >
                        <option value="edas">📄 e-DAS</option>
                        <option value="loadingNote">📋 Nota di Carico</option>
                        <option value="cartelloCounter">📷 Cartellino</option>
                      </select>

                      {/* Change Indicator */}
                      {assignment.assignedAs !== assignment.originalType && (
                        <div className="mt-2 text-xs text-yellow-800 font-medium">
                          ⚠️ Modificato da: {
                            assignment.originalType === 'edas' ? '📄 e-DAS' :
                            assignment.originalType === 'loadingNote' ? '📋 Nota' :
                            '📷 Cartellino'
                          }
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

