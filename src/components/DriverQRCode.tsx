'use client';

import { useState, useEffect } from 'react';
import { QrCode, Copy, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface DriverQRCodeProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DriverQRCode({ isOpen, onClose }: DriverQRCodeProps) {
  const { userProfile, refreshUserProfile } = useAuth();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Generate QR code URL using a free service
  const generateQRCode = (text: string) => {
    const size = '300x300';
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(text)}`;
    return qrApiUrl;
  };

  // Generate a new QR code for the driver
  const generateNewQRCode = async () => {
    if (!userProfile || userProfile.role !== 'autista') return;
    
    setIsGenerating(true);
    try {
      // Generate a unique QR code data for this driver
      const qrData = `DRIVER:${userProfile.id}:${Date.now()}`;
      
      // Update the user profile with the new QR code
      await updateDoc(doc(db, 'users', userProfile.id), {
        qrCode: qrData,
        updatedAt: new Date()
      });
      
      // Refresh user profile to get updated data
      await refreshUserProfile();
      
      setQrCodeUrl(generateQRCode(qrData));
    } catch (error) {
      console.error('Errore nella generazione QR code:', error);
      alert('Errore nella generazione del QR code');
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy QR data to clipboard
  const copyQRData = async () => {
    if (userProfile?.qrCode) {
      try {
        await navigator.clipboard.writeText(userProfile.qrCode);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (error) {
        console.error('Errore nella copia:', error);
      }
    }
  };

  // Load QR code when component opens
  useEffect(() => {
    if (isOpen && userProfile?.qrCode) {
      setQrCodeUrl(generateQRCode(userProfile.qrCode));
    }
  }, [isOpen, userProfile?.qrCode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <QrCode className="h-6 w-6 mr-2 text-indigo-600" />
            Il Tuo QR Code
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {userProfile?.name}
            </h3>
            <p className="text-sm text-gray-600">
              Mostra questo QR code all'operatore per associare i viaggi
            </p>
          </div>

          {userProfile?.qrCode && qrCodeUrl ? (
            <div className="text-center mb-6">
              <div className="inline-block p-4 bg-white rounded-lg border-2 border-gray-200 shadow-sm">
                <img
                  src={qrCodeUrl}
                  alt="QR Code Autista"
                  className="w-64 h-64 mx-auto"
                />
              </div>
              
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 font-mono break-all">
                  {userProfile.qrCode}
                </p>
                <button
                  onClick={copyQRData}
                  className="mt-2 inline-flex items-center px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  {copySuccess ? 'Copiato!' : 'Copia'}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center mb-6">
              <div className="w-64 h-64 mx-auto bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Nessun QR code generato</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={generateNewQRCode}
              disabled={isGenerating}
              className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {userProfile?.qrCode ? 'Rigenera QR Code' : 'Genera QR Code'}
            </button>
            
            <button
              onClick={onClose}
              className="w-full px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Chiudi
            </button>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Nota:</strong> L'operatore può scansionare questo QR code per associarti automaticamente ai viaggi che crea.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 