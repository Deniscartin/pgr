import React, { useState } from 'react';
import { Trip } from '../lib/types/index';
import jsPDF from 'jspdf';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RefreshCw } from 'lucide-react';

interface ImageViewerModalProps {
  trip: Trip;
  isOpen: boolean;
  onClose: () => void;
}

type DocumentType = 'edas' | 'loadingNote' | 'cartelloCounter';

interface ImageAssignment {
  url: string;
  assignedAs: DocumentType;
}

export default function ImageViewerModal({ trip, isOpen, onClose }: ImageViewerModalProps) {
  const [loading, setLoading] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  
  // Initialize image assignments
  const [imageAssignments, setImageAssignments] = useState<ImageAssignment[]>(() => {
    const assignments: ImageAssignment[] = [];
    if (trip.edasImageUrl) {
      assignments.push({ url: trip.edasImageUrl, assignedAs: 'edas' });
    }
    if (trip.loadingNoteImageUrl) {
      assignments.push({ url: trip.loadingNoteImageUrl, assignedAs: 'loadingNote' });
    }
    if (trip.cartelloCounterImageUrl) {
      assignments.push({ url: trip.cartelloCounterImageUrl, assignedAs: 'cartelloCounter' });
    }
    return assignments;
  });

  const [hasChanges, setHasChanges] = useState(false);

  if (!isOpen) return null;

  const handleAssignmentChange = (index: number, newType: DocumentType) => {
    const newAssignments = [...imageAssignments];
    
    // Find if another image already has this type assigned
    const existingIndex = newAssignments.findIndex((a, i) => i !== index && a.assignedAs === newType);
    
    if (existingIndex !== -1) {
      // Switch assignments: give the existing image the old type of current image
      const oldType = newAssignments[index].assignedAs;
      newAssignments[existingIndex].assignedAs = oldType;
    }
    
    // Assign new type to current image
    newAssignments[index].assignedAs = newType;
    setImageAssignments(newAssignments);
    setHasChanges(true);
  };

  const handleSaveAndReprocess = async () => {
    setReprocessing(true);
    try {
      // Build new URL assignments
      const newUrls: {
        edasImageUrl?: string;
        loadingNoteImageUrl?: string;
        cartelloCounterImageUrl?: string;
      } = {};

      imageAssignments.forEach(assignment => {
        if (assignment.assignedAs === 'edas') {
          newUrls.edasImageUrl = assignment.url;
        } else if (assignment.assignedAs === 'loadingNote') {
          newUrls.loadingNoteImageUrl = assignment.url;
        } else if (assignment.assignedAs === 'cartelloCounter') {
          newUrls.cartelloCounterImageUrl = assignment.url;
        }
      });

      // Update trip with new assignments
      const tripRef = doc(db, 'trips', trip.id);
      await updateDoc(tripRef, newUrls);

      console.log('✅ Immagini riassegnate, avvio riprocessamento...');

      // Trigger reprocessing
      const response = await fetch('/api/reprocess-trip-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: trip.id }),
      });

      if (!response.ok) {
        throw new Error('Errore nel riprocessamento');
      }

      alert('✅ Documenti riassegnati e riprocessati con successo!');
      setHasChanges(false);
      onClose();
      window.location.reload(); // Refresh to show new data

    } catch (error) {
      console.error('❌ Errore:', error);
      alert('Errore durante il salvataggio e riprocessamento');
    } finally {
      setReprocessing(false);
    }
  };

  const downloadPDF = async () => {
    setLoading(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imageWidth = pageWidth - (margin * 2);
      
      // BASTA CALCOLI DEL CAZZO - USA DIMENSIONI ORIGINALI COME NEL MODALE
      const calculateOptimalDimensions = (originalWidth: number, originalHeight: number, availableHeight: number) => {
        console.log(`📐 ORIGINALE: ${originalWidth}px x ${originalHeight}px`);
        
        // CONVERSIONE SEMPLICE: 1px = 0.75 punti = 0.264583mm (ma chi se ne frega, uso diretto)
        // Semplicemente scala se troppo grande, altrimenti usa dimensioni originali
        
        let finalWidth = originalWidth * 0.264583; // Conversione base px to mm
        let finalHeight = originalHeight * 0.264583;
        
        console.log(`📐 CONVERTITO BASE: ${finalWidth.toFixed(1)}mm x ${finalHeight.toFixed(1)}mm`);
        
        // Solo se VERAMENTE troppo grande, scala proporzionalmente
        if (finalHeight > availableHeight) {
          const scale = availableHeight / finalHeight;
          finalHeight = availableHeight;
          finalWidth = finalWidth * scale;
          console.log(`📏 RIDIMENSIONATO PER ALTEZZA: scala ${scale.toFixed(3)}`);
        }
        
        if (finalWidth > imageWidth) {
          const scale = imageWidth / finalWidth;
          finalWidth = imageWidth;
          finalHeight = finalHeight * scale;
          console.log(`📏 RIDIMENSIONATO PER LARGHEZZA: scala ${scale.toFixed(3)}`);
        }
        
        console.log(`✅ FINALE: ${finalWidth.toFixed(1)}mm x ${finalHeight.toFixed(1)}mm`);
        return { finalWidth, finalHeight };
      };
      
      // Funzione per caricare un'immagine e convertirla in base64 con dimensioni
      const loadImage = (url: string): Promise<{dataUrl: string, width: number, height: number}> => {
        return new Promise(async (resolve, reject) => {
          try {
            // Metodo 1: Usa API server-side per bypassare CORS
            console.log('Downloading image via server-side API:', url);
            const apiResponse = await fetch('/api/download-image', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ imageUrl: url }),
            });

            if (!apiResponse.ok) {
              throw new Error(`API error: ${apiResponse.status}`);
            }

            const result = await apiResponse.json();
            
            if (!result.success) {
              throw new Error(result.error || 'Failed to download image');
            }

            // Ottieni dimensioni dell'immagine
            const img = new Image();
            img.onload = () => {
              resolve({
                dataUrl: result.dataUrl,
                width: img.naturalWidth || img.width,
                height: img.naturalHeight || img.height
              });
            };
            img.onerror = () => {
              // Anche se non riusciamo a ottenere le dimensioni, usiamo valori di default
              console.warn('Could not get image dimensions, using defaults');
              resolve({
                dataUrl: result.dataUrl,
                width: 800,
                height: 600
              });
            };
            img.src = result.dataUrl;

          } catch (apiError) {
            console.warn('Server-side API method failed, trying client-side fallback:', apiError);
            
            // Fallback: Prova metodo client-side
            try {
              const response = await fetch(url, {
                mode: 'cors',
                credentials: 'omit'
              });
              
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              
              const blob = await response.blob();
              const reader = new FileReader();
              
              reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                  resolve({
                    dataUrl: reader.result as string,
                    width: img.naturalWidth || img.width,
                    height: img.naturalHeight || img.height
                  });
                };
                img.onerror = () => {
                  resolve({
                    dataUrl: reader.result as string,
                    width: 800,
                    height: 600
                  });
                };
                img.src = reader.result as string;
              };
              
              reader.onerror = () => {
                console.error('All methods failed, using original URL');
                resolve({
                  dataUrl: url,
                  width: 800,
                  height: 600
                });
              };
              
              reader.readAsDataURL(blob);
              
            } catch (fetchError) {
              console.error('All download methods failed:', fetchError);
              // Ultimo fallback: usa l'URL originale
              resolve({
                dataUrl: url,
                width: 800,
                height: 600
              });
            }
          }
        });
      };

      let yPosition = margin;

      // Titolo del documento
      pdf.setFontSize(16);
      pdf.text(`Documenti Viaggio - DAS: ${trip.edasData?.documentInfo?.dasNumber || 'N/A'}`, margin, yPosition);
      yPosition += 15;

      // Informazioni viaggio
      pdf.setFontSize(10);
      pdf.text(`Data: ${trip.createdAt?.toLocaleDateString?.('it-IT') || new Date(trip.createdAt).toLocaleDateString('it-IT') || 'N/A'}`, margin, yPosition);
      yPosition += 5;
      pdf.text(`Autista: ${trip.driverName}`, margin, yPosition);
      yPosition += 5;
      pdf.text(`Targa: ${trip.edasData?.transportInfo?.vehicleId || 'N/A'}`, margin, yPosition);
      yPosition += 15;

      // e-DAS originale
      if (trip.edasImageUrl) {
        try {
          pdf.setFontSize(12);
          pdf.text('e-DAS - Documento Originale', margin, yPosition);
          yPosition += 10;

          const imageData = await loadImage(trip.edasImageUrl);
          
          // Calcola dimensioni ottimali mantenendo orientamento verticale
          const originalWidth = imageData.width;
          const originalHeight = imageData.height;
          const availableHeight = pageHeight - yPosition - margin - 10;
          const { finalWidth, finalHeight } = calculateOptimalDimensions(originalWidth, originalHeight, availableHeight);
          
          // Centra l'immagine orizzontalmente se è più piccola della larghezza disponibile
          const xPosition = margin + (imageWidth - finalWidth) / 2;
          
          // Controlla se l'immagine entra nella pagina
          if (yPosition + finalHeight > pageHeight - margin) {
            pdf.addPage();
            yPosition = margin + 20; // Spazio per il titolo sulla nuova pagina
            pdf.setFontSize(12);
            pdf.text('e-DAS - Documento Originale', margin, margin + 10);
          }
          
          pdf.addImage(imageData.dataUrl, 'JPEG', xPosition, yPosition, finalWidth, finalHeight);
          yPosition += finalHeight + 20;
        } catch (error) {
          console.error('Errore nel caricamento immagine e-DAS originale:', error);
        }
      }



      // Nota di carico originale
      if (trip.loadingNoteImageUrl) {
        try {
          // Aggiungi nuova pagina per la nota di carico
          pdf.addPage();
          yPosition = margin + 20;

          pdf.setFontSize(12);
          pdf.text('Nota di Carico - Documento Originale', margin, margin + 10);

          const imageData = await loadImage(trip.loadingNoteImageUrl);
          
          // Calcola dimensioni ottimali mantenendo orientamento verticale
          const originalWidth = imageData.width;
          const originalHeight = imageData.height;
          const availableHeight = pageHeight - yPosition - margin - 10;
          const { finalWidth, finalHeight } = calculateOptimalDimensions(originalWidth, originalHeight, availableHeight);
          
          // Centra l'immagine orizzontalmente se è più piccola della larghezza disponibile
          const xPosition = margin + (imageWidth - finalWidth) / 2;
          
          pdf.addImage(imageData.dataUrl, 'JPEG', xPosition, yPosition, finalWidth, finalHeight);
          yPosition += finalHeight + 20;
        } catch (error) {
          console.error('Errore nel caricamento immagine nota di carico originale:', error);
        }
      }

      // Cartellino Conta Litro
      if (trip.cartelloCounterImageUrl) {
        try {
          // Aggiungi nuova pagina per il cartellino conta litro
          pdf.addPage();
          yPosition = margin + 20;

          pdf.setFontSize(12);
          pdf.text('Cartellino Conta Litro - Documento Originale', margin, margin + 10);

          const imageData = await loadImage(trip.cartelloCounterImageUrl);
          
          // Calcola dimensioni ottimali mantenendo orientamento verticale
          const originalWidth = imageData.width;
          const originalHeight = imageData.height;
          const availableHeight = pageHeight - yPosition - margin - 10;
          const { finalWidth, finalHeight } = calculateOptimalDimensions(originalWidth, originalHeight, availableHeight);
          
          // Centra l'immagine orizzontalmente se è più piccola della larghezza disponibile
          const xPosition = margin + (imageWidth - finalWidth) / 2;
          
          pdf.addImage(imageData.dataUrl, 'JPEG', xPosition, yPosition, finalWidth, finalHeight);
          yPosition += finalHeight + 20;
        } catch (error) {
          console.error('Errore nel caricamento immagine cartellino conta litro:', error);
        }
      }



      // Salva il PDF
      const fileName = `DAS_${trip.edasData?.documentInfo?.dasNumber || trip.id}_documenti.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('Errore nella generazione del PDF:', error);
      alert('Errore nella generazione del PDF. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Visualizza Documenti - DAS: {trip.edasData?.documentInfo?.dasNumber || 'N/A'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Autista: {trip.driverName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
              title="Chiudi"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="flex justify-between items-center px-6 py-3 border-b bg-gray-50">
          <div className="text-sm text-gray-600">
            {hasChanges && (
              <span className="text-orange-600 font-medium">
                ⚠️ Hai modifiche non salvate
              </span>
            )}
          </div>
          <div className="flex gap-3">
            {hasChanges && (
              <button
                onClick={handleSaveAndReprocess}
                disabled={reprocessing}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {reprocessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Riprocessamento...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Salva e Riesegui Scansione
                  </>
                )}
              </button>
            )}
            <button
              onClick={downloadPDF}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generando PDF...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Scarica PDF
                </>
              )}
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Info Box */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              🔧 Riassegnazione Documenti
            </h3>
            <p className="text-xs text-blue-800">
              Se l'autista ha caricato i documenti nei campi sbagliati, puoi riassegnarli qui.
              Seleziona il tipo corretto per ogni immagine e clicca "Salva e Riesegui Scansione".
            </p>
          </div>

          {/* Image Assignments */}
          <div className="space-y-6">
            {imageAssignments.map((assignment, index) => (
              <div key={index} className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-indigo-300 transition-colors">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Image Preview */}
                  <div className="lg:w-1/3">
                    <img
                      src={assignment.url}
                      alt={`Documento ${index + 1}`}
                      className="w-full h-auto rounded-lg border border-gray-300 shadow-sm"
                    />
                  </div>

                  {/* Assignment Controls */}
                  <div className="lg:w-2/3 flex flex-col justify-center">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Questo documento è:
                    </label>
                    <select
                      value={assignment.assignedAs}
                      onChange={(e) => handleAssignmentChange(index, e.target.value as DocumentType)}
                      className="block w-full px-4 py-3 text-base border-2 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg"
                    >
                      <option value="edas">📄 e-DAS</option>
                      <option value="loadingNote">📋 Nota di Carico</option>
                      <option value="cartelloCounter">📷 Cartellino Conta Litro</option>
                    </select>

                    {/* Visual indicator */}
                    <div className="mt-4 p-3 rounded-lg bg-gray-50">
                      <p className="text-sm text-gray-600">
                        <strong>Assegnato come:</strong>{' '}
                        <span className="font-semibold text-indigo-600">
                          {assignment.assignedAs === 'edas' && '📄 e-DAS'}
                          {assignment.assignedAs === 'loadingNote' && '📋 Nota di Carico'}
                          {assignment.assignedAs === 'cartelloCounter' && '📷 Cartellino Conta Litro'}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Document Details */}
          {/* {(trip.edasData || trip.loadingNoteData) && (
            <div className="mt-8 bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Dettagli Documenti</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                 {trip.edasData && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">e-DAS</h4>
                    <p><strong>Numero:</strong> {trip.edasData.documentInfo?.dasNumber}</p>
                    <p><strong>Data:</strong> {trip.edasData.documentInfo?.registrationDateTime}</p>
                    <p><strong>Mittente:</strong> {trip.edasData.senderInfo?.name}</p>
                    <p><strong>Destinatario:</strong> {trip.edasData.recipientInfo?.name}</p>
                  </div>
                )}
                {trip.loadingNoteData && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Nota di Carico</h4>
                    <p><strong>Numero:</strong> {trip.loadingNoteData.documentNumber}</p>
                    <p><strong>Data:</strong> {trip.loadingNoteData.loadingDate}</p>
                    <p><strong>Vettore:</strong> {trip.loadingNoteData.carrierName}</p>
                    <p><strong>Prodotto:</strong> {trip.loadingNoteData.productDescription}</p>
                  </div>
                )}
              </div>
            </div>
          )} */}
        </div>
      </div>
    </div>
  );
} 