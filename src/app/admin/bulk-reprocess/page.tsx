'use client';

import { useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ReprocessResult {
  tripId: string;
  driverName: string;
  dasNumber: string;
  success: boolean;
  error?: string;
}

interface BulkReprocessResponse {
  success: boolean;
  message: string;
  total: number;
  processed: number;
  failed: number;
  results: ReprocessResult[];
  error?: string;
}

export default function BulkReprocessPage() {
  const [startDate, setStartDate] = useState('2026-02-13');
  const [endDate, setEndDate] = useState('2026-02-17');
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<BulkReprocessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  const handleBulkReprocess = async () => {
    if (!startDate || !endDate) {
      setError('Seleziona entrambe le date');
      return;
    }

    if (!confirm(`Sei sicuro di voler riprocessare TUTTI i viaggi dal ${startDate} al ${endDate} con Google Document AI?\n\nQuesta operazione potrebbe richiedere diversi minuti.`)) {
      return;
    }

    setIsProcessing(true);
    setResponse(null);
    setError(null);
    setProgress('Invio richiesta di riprocessamento...');

    try {
      const res = await fetch('/api/bulk-reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Errore durante il riprocessamento');
      }

      setResponse(data);
      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      setProgress('');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <RefreshCw className="w-7 h-7 text-indigo-600" />
                  Riprocessamento Massivo Documenti
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Riprocessa tutti i documenti dei viaggi in un intervallo di date con Google Document AI
                </p>
              </div>
            </div>
          </div>

          {/* Date Selectors */}
          <div className="flex flex-wrap items-end gap-4 p-4 bg-indigo-50 rounded-lg">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Data Da:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isProcessing}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Data A:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isProcessing}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>
            <button
              onClick={handleBulkReprocess}
              disabled={isProcessing}
              className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Riprocessamento in corso...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Avvia Riprocessamento
                </>
              )}
            </button>
          </div>

          {/* Info Banner */}
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <strong>Nota:</strong> Il riprocessamento utilizza Google Document AI per riscansionare tutti i documenti (e-DAS e Note di Carico).
              Ogni viaggio viene processato sequenzialmente con un ritardo di 1 secondo tra uno e l&apos;altro per evitare limiti di rate.
              L&apos;operazione potrebbe richiedere diversi minuti a seconda del numero di viaggi.
            </div>
          </div>
        </div>

        {/* Progress */}
        {isProcessing && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <div>
                <p className="text-lg font-medium text-gray-900">Riprocessamento in corso...</p>
                <p className="text-sm text-gray-600">{progress || 'Attendere prego, questa operazione potrebbe richiedere diversi minuti...'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center gap-3">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-lg font-medium text-red-900">Errore</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {response && (
          <>
            {/* Summary */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Riepilogo Riprocessamento</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-3xl font-bold text-blue-900">{response.total}</p>
                  <p className="text-sm text-blue-700">Viaggi Totali</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-3xl font-bold text-green-900">{response.processed}</p>
                  <p className="text-sm text-green-700">Successo</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg text-center">
                  <p className="text-3xl font-bold text-red-900">{response.failed}</p>
                  <p className="text-sm text-red-700">Errori</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">{response.message}</p>
            </div>

            {/* Detailed Results */}
            {response.results && response.results.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Dettaglio Risultati</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trip ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Autista</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DAS</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dettagli</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {response.results.map((result, index) => (
                        <tr key={result.tripId} className={result.success ? 'bg-green-50/50' : 'bg-red-50/50'}>
                          <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">{result.tripId.substring(0, 12)}...</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{result.driverName}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{result.dasNumber}</td>
                          <td className="px-4 py-3">
                            {result.success ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3" />
                                Successo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <XCircle className="w-3 h-3" />
                                Errore
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{result.error || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

