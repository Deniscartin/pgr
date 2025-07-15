'use client';

import { useState, useRef } from 'react';
import { X, Upload, Camera, FileText as FileTextIcon, Loader, CheckCircle, Eye, FileSearch } from 'lucide-react';
import { uploadImageToCloud } from '@/lib/imageProcessing';
import { parseGestionaleData, parseGestionaleDataManual, parsePDFText, parseImageWithAI } from '@/lib/pdfParser';
import { User, ParsedPDFData } from '@/lib/types';

interface CreateTripModalProps {
  onConfirm?: (imageUrls: {
    edasImageUrl: string;
    loadingNoteImageUrl: string;
    cartelloCounterImageUrl: string;
  }) => void;
  onConfirmPDF?: (parsedData: ParsedPDFData) => void;
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

type CreationMode = 'images' | 'pdf' | 'image-document';

export default function CreateTripModal({ onConfirm, onConfirmPDF, onClose, isCreating, selectedDriver }: CreateTripModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<CreationMode>('images');
  
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
  
  // PDF parsing states
  const [parsedData, setParsedData] = useState<ParsedPDFData | null>(null);
  const [parsing, setParsing] = useState(false);
  
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

  const handlePDFFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // setFile(selectedFile); // This state was unused
    setParsedData(null);

    // This state was unused
    // if (selectedFile.type.startsWith('image/')) {
    //     setFilePreview(URL.createObjectURL(selectedFile));
    // } else {
    //     setFilePreview(null);
    // }
    
    setParsing(true);
    try {
        let parsed: ParsedPDFData | null = null;
        if (mode === 'pdf' && selectedFile.type === 'application/pdf') {
            const pdfText = await parsePDFText(selectedFile);
            parsed = parseGestionaleData(pdfText) || parseGestionaleDataManual(pdfText);
        } else if (mode === 'image-document' && selectedFile.type.startsWith('image/')) {
            parsed = await parseImageWithAI(selectedFile);
        } else {
            alert('Formato file non valido per la modalità selezionata.');
            setParsing(false);
            return;
        }
        
        setParsedData(parsed);
        if (!parsed) {
            alert("Impossibile estrarre i dati dal file. Controlla il formato o prova con caricamento immagini.");
        }

    } catch (error) {
        console.error('Error parsing file:', error);
        alert('Errore nel parsing del file. Prova con caricamento immagini.');
    } finally {
        setParsing(false);
    }
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
    if (mode === 'images' && edasImageState.cloudUrl && loadingNoteImageState.cloudUrl && cartelloCounterImageState.cloudUrl && onConfirm) {
      onConfirm({
        edasImageUrl: edasImageState.cloudUrl,
        loadingNoteImageUrl: loadingNoteImageState.cloudUrl,
        cartelloCounterImageUrl: cartelloCounterImageState.cloudUrl,
      });
    } else if ((mode === 'pdf' || mode === 'image-document') && parsedData && onConfirmPDF) {
      onConfirmPDF(parsedData);
    }
  };

  const handlePDFSubmit = async () => {
    if (!parsedData || !onConfirmPDF) return;
    onConfirmPDF(parsedData);
  };
  
  const isBusy = isCreating;
  const allImagesReady = edasImageState.isComplete && loadingNoteImageState.isComplete && cartelloCounterImageState.isComplete;
  const isFileImportMode = mode === 'pdf' || mode === 'image-document';

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
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

            {/* Mode Selection - Hidden on Mobile */}
            <div className="mb-6 hidden md:block">
              <h4 className="font-medium text-gray-900 mb-3">Seleziona modalità di caricamento:</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setMode('images')}
                  className={`p-4 border-2 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
                    mode === 'images' 
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                      : 'border-gray-300 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  <Camera className="h-5 w-5" />
                  <span className="font-medium">Scatta Foto</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => { 
                    setMode('pdf'); 
                    // setFile(null); // This state was unused
                    setParsedData(null); 
                    // setFilePreview(null); // This state was unused
                  }}
                  className={`p-4 border-2 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
                    mode === 'pdf' 
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                      : 'border-gray-300 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  <FileSearch className="h-5 w-5" />
                  <span className="font-medium">Carica PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => { 
                    setMode('image-document'); 
                    // setFile(null); // This state was unused
                    setParsedData(null); 
                    // setFilePreview(null); // This state was unused
                  }}
                  className={`p-4 border-2 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
                    mode === 'image-document' 
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                      : 'border-gray-300 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  <Eye className="h-5 w-5" />
                  <span className="font-medium">Foto Documento</span>
                </button>
              </div>
            </div>
            
            {/* On mobile, mode is always 'images' so this block is always shown, but the title is hidden */}
            {mode === 'images' && (
              <>
                <div className="hidden md:block bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">📸 Modalità Foto Rapida</h4>
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
              </>
            )}

            {(mode === 'pdf' || mode === 'image-document') && (
              <>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-medium text-purple-900 mb-2">
                    {mode === 'pdf' ? '📄 Modalità PDF con Parser' : '🖼️ Modalità Immagine con AI'}
                  </h4>
                  <p className="text-sm text-gray-800">
                    {mode === 'pdf' 
                      ? 'Carica un file PDF gestionale e i dati verranno estratti automaticamente per creare viaggi.' 
                      : 'Carica una foto di un documento e i dati verranno estratti usando AI.'
                    }
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {mode === 'pdf' ? 'Carica PDF Gestionale' : 'Carica Immagine Documento'} *
                  </label>
                  <input
                    type="file"
                    onChange={handlePDFFileChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    accept={mode === 'pdf' ? '.pdf' : 'image/*'}
                  />
                </div>
              </>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-800">
                  <strong>Errore:</strong> {error}
                </p>
              </div>
            )}

            {isFileImportMode && parsedData && (
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Dati Estratti</h4>
                <pre className="bg-gray-100 p-3 rounded-md text-xs overflow-auto max-h-60">
                  {JSON.stringify(parsedData, null, 2)}
                </pre>
              </div>
            )}

          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end items-center gap-4 p-5 border-t bg-gray-50">
          <button onClick={onClose} disabled={isBusy} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-md border hover:bg-gray-100 disabled:opacity-50">
            Annulla
          </button>
          
          {mode === 'images' && (
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
          )}

          {isFileImportMode && (
             <button
                onClick={handlePDFSubmit}
                disabled={!parsedData || isBusy}
                className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 disabled:bg-gray-400 flex items-center"
             >
                {isCreating ? (
                    <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                ) : parsing ? (
                    <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                ) : (
                    <CheckCircle className="w-5 h-5 mr-3" />
                )}
                {isCreating ? 'Creazione in corso...' : parsing ? 'Analizzando...' : `Crea ${parsedData?.orders.length || 0} Viaggi dal PDF`}
            </button>
          )}
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
        <div className="flex space-x-2">
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