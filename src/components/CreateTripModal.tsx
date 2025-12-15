'use client';

import { useState, useRef } from 'react';
import { X, Camera, FileText as FileTextIcon, Loader, CheckCircle, Upload } from 'lucide-react';
import { uploadImageToCloud } from '@/lib/imageProcessing';
import { User } from '@/lib/types';

interface CreateTripModalProps {
  onConfirm?: (imageUrls: {
    edasImageUrl: string;
    loadingNoteImageUrl: string;
    cartelloCounterImageUrl: string;
  }) => void;
  onClose: () => void;
  isCreating: boolean;
  selectedDriver?: User | null; // For operator use - shows which driver is selected
}

interface ImageUploadState {
  isUploading: boolean;
  isComplete: boolean;
  originalUrl?: string;
  cloudUrl?: string;
}


export default function CreateTripModal({ onConfirm, onClose, isCreating, selectedDriver }: CreateTripModalProps) {
  const [error, setError] = useState<string | null>(null);
  
  // Image upload states
  const [edasImageState, setEdasImageState] = useState<ImageUploadState>({
    isUploading: false,
    isComplete: false,
  });
  const [loadingNoteImageState, setLoadingNoteImageState] = useState<ImageUploadState>({
    isUploading: false,
    isComplete: false,
  });
  const [cartelloCounterImageState, setCartelloCounterImageState] = useState<ImageUploadState>({
    isUploading: false,
    isComplete: false,
  });
  
  
  // File input refs
  const edasFileInputRef = useRef<HTMLInputElement>(null);
  const loadingNoteFileInputRef = useRef<HTMLInputElement>(null);
  const cartelloCounterFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, docType: 'edas' | 'loadingNote' | 'cartelloCounter') => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageUpload(file, docType);
    }
    // Reset input value per permettere ricaricamento stesso file
    event.target.value = '';
  };


  const handleImageUpload = async (file: File, docType: 'edas' | 'loadingNote' | 'cartelloCounter') => {
    const setImageState = docType === 'edas' 
      ? setEdasImageState 
      : docType === 'loadingNote' 
        ? setLoadingNoteImageState 
        : setCartelloCounterImageState;
    
    setError(null);
    setImageState(prev => ({ ...prev, isUploading: true, isComplete: false }));
    
    try {
      // Crea preview locale
      const originalUrl = URL.createObjectURL(file);
      setImageState(prev => ({ ...prev, originalUrl }));
      
             // Carica l'immagine su cloud storage
       console.log(`Caricamento ${docType} su cloud...`);
       const cloudUrl = await uploadImageToCloud(file);
       console.log(`${docType} caricato con successo:`, cloudUrl);

      setImageState(prev => ({ 
        ...prev, 
        isUploading: false,
        isComplete: true,
        cloudUrl
      }));
      
    } catch (error) {
      console.error(`${docType} upload error:`, error);
      setError(error instanceof Error ? error.message : "Errore durante il caricamento dell'immagine");
      setImageState(prev => ({ ...prev, isUploading: false }));
    }
  };

  const handleConfirm = () => {
    if (edasImageState.cloudUrl && loadingNoteImageState.cloudUrl && cartelloCounterImageState.cloudUrl && onConfirm) {
      onConfirm({
        edasImageUrl: edasImageState.cloudUrl,
        loadingNoteImageUrl: loadingNoteImageState.cloudUrl,
        cartelloCounterImageUrl: cartelloCounterImageState.cloudUrl,
      });
    }
  };

  
  const isBusy = isCreating;
  const allImagesReady = edasImageState.isComplete && loadingNoteImageState.isComplete && cartelloCounterImageState.isComplete;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative mx-auto border w-full max-w-4xl shadow-lg rounded-md bg-white my-8 max-h-[95vh] flex flex-col">
        <div className="flex justify-between items-center p-5 border-b">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <FileTextIcon className="h-6 w-6 mr-2 text-indigo-600" />
            Avvia Nuovo Viaggio
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={isBusy}>
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="overflow-y-auto flex-grow p-5">
          <div className="space-y-6">
            {/* Simple instruction for mobile */}
            <div className="md:hidden bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-sm text-blue-800">
                Scansiona i 3 documenti richiesti per avviare il viaggio.
              </p>
            </div>

            {selectedDriver && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 hidden md:block">
                <h4 className="font-medium text-green-900 mb-2">🚛 Autista Selezionato</h4>
                <p className="text-sm text-green-800">
                  <strong>Nome:</strong> {selectedDriver.name}
                </p>
                <p className="text-xs text-green-700">
                  Il viaggio sarà assegnato a questo autista
                </p>
              </div>
            )}

            
            <div className="hidden md:block bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">📸 Scansione Documenti</h4>
              <p className="text-sm text-gray-800">
                Scatta le foto dei documenti e il viaggio verrà creato immediatamente. 
                L'analisi dei dati avverrà in background.
              </p>
            </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* e-DAS Uploader */}
                  <DocumentUploader
                    title="1. Scansiona e-DAS"
                    docType="edas"
                    isUploading={edasImageState.isUploading}
                    isComplete={edasImageState.isComplete}
                    fileInputRef={edasFileInputRef}
                    onFileChange={handleFileChange}
                    isBusy={isBusy}
                  />

                  {/* Loading Note Uploader */}
                  <DocumentUploader
                    title="2. Scansiona Nota di Carico"
                    docType="loadingNote"
                    isUploading={loadingNoteImageState.isUploading}
                    isComplete={loadingNoteImageState.isComplete}
                    fileInputRef={loadingNoteFileInputRef}
                    onFileChange={handleFileChange}
                    isBusy={isBusy}
                  />

                  {/* Cartello Conta Litri Uploader */}
                  <DocumentUploader
                    title="3. Scansiona Cartello Conta Litro"
                    docType="cartelloCounter"
                    isUploading={cartelloCounterImageState.isUploading}
                    isComplete={cartelloCounterImageState.isComplete}
                    fileInputRef={cartelloCounterFileInputRef}
                    onFileChange={handleFileChange}
                    isBusy={isBusy}
                  />
                </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-800">
                  <strong>Errore:</strong> {error}
                </p>
              </div>
            )}


          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end items-center gap-4 p-5 border-t bg-gray-50">
          <button onClick={onClose} disabled={isBusy} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-md border hover:bg-gray-100 disabled:opacity-50">
            Annulla
          </button>
          
          <button
            onClick={handleConfirm}
            disabled={!allImagesReady || isBusy}
            className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 disabled:bg-gray-400 flex items-center"
          >
            {isCreating ? (
                <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
            ) : (
                <CheckCircle className="w-5 h-5 mr-3" />
            )}
            {isCreating ? 'Creazione in corso...' : 'Avvia Viaggio'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DocumentUploaderProps {
  title: string;
  docType: 'edas' | 'loadingNote' | 'cartelloCounter';
  isUploading: boolean;
  isComplete: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>, docType: 'edas' | 'loadingNote' | 'cartelloCounter') => void;
  isBusy: boolean;
}

const DocumentUploader = ({ title, docType, isUploading, isComplete, fileInputRef, onFileChange, isBusy }: DocumentUploaderProps) => {
  return (
    <div className={`p-4 rounded-lg border ${isComplete ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
      <h4 className="font-medium text-gray-800 mb-3">{title}</h4>
      <input
        type="file"
        ref={fileInputRef as React.RefObject<HTMLInputElement>}
        onChange={(e) => onFileChange(e, docType)}
        className="hidden"
        accept="image/*"
      />
      {isUploading ? (
        <div className="flex items-center justify-center space-x-2 text-gray-600">
          <Loader className="h-5 w-5 animate-spin" />
          <span>Caricamento in corso...</span>
        </div>
      ) : isComplete ? (
        <div className="flex items-center justify-center space-x-2 text-green-700 font-medium">
          <CheckCircle className="h-6 w-6" />
          <span>Immagine Caricata</span>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            onClick={() => {
              fileInputRef.current?.setAttribute('capture', 'environment');
              fileInputRef.current?.click();
            }}
            disabled={isBusy}
            className="w-full text-sm inline-flex items-center justify-center px-3 py-2 border border-transparent font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400"
          >
            <Camera className="w-4 h-4 mr-2" />
            Scatta Foto
          </button>
          
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.removeAttribute('capture');
              }
              fileInputRef.current?.click();
            }}
            disabled={isBusy}
            className="w-full text-sm inline-flex items-center justify-center px-3 py-2 border border-gray-300 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-200"
          >
            <Upload className="w-4 h-4 mr-2" />
            Carica File
          </button>
        </div>
      )}
    </div>
  );
};