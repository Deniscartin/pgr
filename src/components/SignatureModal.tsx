'use client';

import { useState, useRef, useEffect } from 'react';
import { Trip } from '@/lib/types';
import { X, PenTool, RotateCcw, Check } from 'lucide-react';

interface SignatureModalProps {
  trip: Trip;
  dasCode: string;
  onSignatureComplete: (signatureData: string) => void;
  onClose: () => void;
}

export default function SignatureModal({ trip: _trip, dasCode, onSignatureComplete, onClose }: SignatureModalProps) {
  const [processing, setProcessing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 200;

    // Set drawing properties
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const isCanvasEmpty = (): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) return true;

    const ctx = canvas.getContext('2d');
    if (!ctx) return true;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Check if all pixels are white (empty canvas)
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) {
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (isCanvasEmpty()) {
      alert('Per favore, firma prima di procedere');
      return;
    }

    setProcessing(true);
    
    try {
      const canvas = canvasRef.current;
      if (canvas) {
        // Get the signature as base64 data URL
        const signatureData = canvas.toDataURL('image/png');
        onSignatureComplete(signatureData);
      }
    } catch (error) {
      console.error('Error processing signature:', error);
      alert('Errore durante l\'elaborazione della firma');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Firma Digitale - Conferma Consegna
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Order Summary */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h4 className="font-medium text-gray-900 mb-2">Riepilogo Consegna</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p><span className="font-medium text-gray-800">Codice DAS:</span> <span className="text-gray-900">{dasCode}</span></p>
              <p><span className="font-medium text-gray-800">Status:</span> <span className="text-green-700 font-medium">Pronto per completamento</span></p>
            </div>
            <div>
              <p><span className="font-medium text-gray-800">Data:</span> <span className="text-gray-900">{new Date().toLocaleDateString()}</span></p>
              <p><span className="font-medium text-gray-800">Ora:</span> <span className="text-gray-900">{new Date().toLocaleTimeString()}</span></p>
            </div>
          </div>
        </div>

        {/* Signature Instructions */}
        <div className="mb-4">
          <h4 className="font-medium text-gray-900 mb-2">Istruzioni per la Firma</h4>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">
              • Firma del cliente nell'area sottostante per confermare la ricezione della merce<br/>
            </p>
          </div>
        </div>

        {/* Signature Canvas */}
        <div className="border-2 border-gray-300 rounded-lg mb-4">
          <div className="bg-gray-100 px-4 py-2 rounded-t-lg border-b border-gray-300">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                <PenTool className="inline h-4 w-4 mr-1" />
                Area di Firma Cliente
              </span>
              <button
                onClick={clearSignature}
                className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Cancella
              </button>
            </div>
          </div>
          <div className="p-4 bg-white rounded-b-lg">
            <canvas
              ref={canvasRef}
              className="w-full border border-gray-200 rounded cursor-crosshair touch-none"
              style={{ height: '200px' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            onClick={handleSubmit}
            disabled={processing}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Elaborando...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Conferma Firma
              </>
            )}
          </button>
        </div>

        {/* Legal Notice */}
        <div className="mt-4 text-xs text-gray-500 text-center">
          La firma digitale ha valore legale equivalente alla firma autografa.
          Procedendo si conferma la ricezione della merce in buone condizioni.
        </div>
      </div>
    </div>
  );
} 