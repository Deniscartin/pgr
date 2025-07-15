'use client';

import { useState, useRef, useEffect } from 'react';
import { Trip } from '@/lib/types';
import { X, QrCode, Keyboard, Camera } from 'lucide-react';

interface QRScannerModalProps {
  trip: Trip | null;
  onScanComplete: (dasCode: string) => void;
  onClose: () => void;
}

export default function QRScannerModal({ trip: _trip, onScanComplete, onClose }: QRScannerModalProps) {
  const [dasCode, setDasCode] = useState('');
  const [manualInput, setManualInput] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<any>(null);

  useEffect(() => {
    // Cleanup when component unmounts
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.destroy();
        qrScannerRef.current = null;
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      setScanning(true);
      setError('');
      
      // Check if we're on HTTPS or localhost (required for camera access)
      if (typeof window !== 'undefined' && 
          window.location.protocol !== 'https:' && 
          !window.location.hostname.includes('localhost') && 
          !window.location.hostname.includes('127.0.0.1')) {
        throw new Error('HTTPS_REQUIRED');
      }

      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MEDIA_NOT_SUPPORTED');
      }

      // Try to get camera permission first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        
        // Stop the test stream
        stream.getTracks().forEach(track => track.stop());
      } catch (mediaError) {
        console.error('Media access error:', mediaError);
        throw new Error('CAMERA_PERMISSION_DENIED');
      }
      
      // Dynamic import of QrScanner to avoid SSR issues
      const QrScanner = (await import('qr-scanner')).default;
      
      // Check if QrScanner has camera access
      const hasCamera = await QrScanner.hasCamera();
      if (!hasCamera) {
        throw new Error('NO_CAMERA_AVAILABLE');
      }
      
      if (videoRef.current) {
        qrScannerRef.current = new QrScanner(
          videoRef.current,
          (result: any) => {
            console.log('QR Code detected:', result.data);
            handleQRResult(result.data);
          },
          {
            onDecodeError: (error: any) => {
              console.log('QR decode error:', error);
              // Non mostrare errori continui di decodifica
            },
            preferredCamera: 'environment',
            highlightScanRegion: true,
            highlightCodeOutline: true,
            maxScansPerSecond: 5,
          }
        );

        await qrScannerRef.current.start();
        console.log('QR Scanner started successfully');
      }
    } catch (error: any) {
      console.error('Error starting QR scanner:', error);
      
      let errorMessage = '';
      switch (error.message) {
        case 'HTTPS_REQUIRED':
          errorMessage = 'La scansione QR richiede una connessione sicura (HTTPS). Usa l\'inserimento manuale.';
          break;
        case 'MEDIA_NOT_SUPPORTED':
          errorMessage = 'Il tuo browser non supporta l\'accesso alla camera. Usa l\'inserimento manuale.';
          break;
        case 'CAMERA_PERMISSION_DENIED':
          errorMessage = 'Accesso alla camera negato. Controlla i permessi del browser e riprova.';
          break;
        case 'NO_CAMERA_AVAILABLE':
          errorMessage = 'Nessuna camera disponibile sul dispositivo. Usa l\'inserimento manuale.';
          break;
        case 'Camera not found.':
          errorMessage = 'Camera non trovata. Verifica che il dispositivo abbia una camera funzionante.';
          break;
        default:
          errorMessage = `Errore nell'accesso alla camera: ${error.message || 'Errore sconosciuto'}. Usa l'inserimento manuale.`;
      }
      
      setError(errorMessage);
      setScanning(false);
      setManualInput(true);
    }
  };

  const stopCamera = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    setScanning(false);
  };

  const handleQRResult = (result: string) => {
    console.log('QR result:', result);
    
    // Valida se il risultato sembra un codice DAS valido
    if (result && result.trim().length > 0) {
      setDasCode(result.trim());
      stopCamera();
      onScanComplete(result.trim());
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (dasCode.trim()) {
      onScanComplete(dasCode.trim());
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };



  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Scansiona Codice DAS
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-4">
            Scansiona il codice QR DAS per completare la consegna dell'ordine.
          </p>
          
          {/* Mobile-first approach */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
            <p className="text-sm text-blue-800">
              📱 <strong>Su dispositivi mobili</strong>: Se hai problemi con la scansione, 
              puoi sempre inserire il codice manualmente cliccando su "Inserimento Manuale" qui sotto.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <p className="text-sm text-red-800 mb-2">{error}</p>
              <div className="text-xs text-red-600">
                <p className="font-medium mb-1">💡 Suggerimenti:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Assicurati di aver dato i permessi alla camera</li>
                  <li>Verifica che nessun'altra app stia usando la camera</li>
                  <li>Ricarica la pagina e riprova</li>
                  <li>Se il problema persiste, usa l'inserimento manuale</li>
                </ul>
              </div>
            </div>
          )}
          
          {!manualInput ? (
            <div className="space-y-4">
              {!scanning ? (
                <div className="text-center">
                  {/* QR Scanner prominente */}
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 mb-4">
                    <QrCode className="h-12 w-12 text-green-600 mx-auto mb-3" />
                    <p className="text-green-800 font-medium mb-3">Scanner QR</p>
                    <p className="text-sm text-green-700 mb-4">Scansiona il codice QR per completare rapidamente</p>
                    <button
                      onClick={startCamera}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Avvia Scanner QR
                    </button>
                  </div>

                  <div className="relative mb-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">oppure</span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-100 rounded-lg p-6 mb-4">
                    <Keyboard className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-4">Inserimento Manuale</p>
                    <button
                      onClick={() => setManualInput(true)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Keyboard className="w-4 h-4 mr-2" />
                      Inserisci Codice DAS
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <video
                    ref={videoRef}
                    className="w-full h-80 bg-black rounded-lg object-cover"
                    style={{ maxHeight: '320px' }}
                  />
                  
                  <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                    Inquadra il codice QR
                  </div>
                  
                  <div className="mt-4 text-center space-x-3">
                    <button
                      onClick={stopCamera}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Ferma Scanner
                    </button>
                    
                    <button
                      onClick={() => {
                        stopCamera();
                        setManualInput(true);
                      }}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Keyboard className="w-4 h-4 mr-2" />
                      Inserimento Manuale
                    </button>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label htmlFor="dasCode" className="block text-sm font-medium text-gray-700">
                  Codice DAS *
                </label>
                <input
                  type="text"
                  id="dasCode"
                  value={dasCode}
                  onChange={(e) => setDasCode(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Inserisci il codice DAS manualmente"
                  autoFocus
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Inserisci il codice alfanumerico presente sulla bolla di consegna
                </p>
              </div>
              
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setManualInput(false);
                    setError('');
                  }}
                  className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  Torna allo Scanner
                </button>
                
                <button
                  type="submit"
                  disabled={!dasCode.trim()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400"
                >
                  Conferma Codice
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
} 