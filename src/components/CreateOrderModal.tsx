'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders, useDrivers, useTrips } from '@/hooks/useFirestore';
import { X, FileText, Edit, FileSearch, CheckCircle, User as UserIcon, Image as ImageIcon } from 'lucide-react';
import { parseGestionaleData, parseGestionaleDataManual, parsePDFText, parseImageWithAI } from '@/lib/pdfParser';
import { ParsedPDFData, User, Order } from '@/lib/types';

interface CreateOrderModalProps {
  onClose: () => void;
}

type CreationMode = 'manual' | 'pdf' | 'image';

export default function CreateOrderModal({ onClose }: CreateOrderModalProps) {
  const { userProfile } = useAuth();
  const { addOrder } = useOrders();
  const { drivers } = useDrivers();
  const { addTrip } = useTrips();
  
  const [mode, setMode] = useState<CreationMode>('manual');
  const [formData, setFormData] = useState({
    orderNumber: '',
    product: '',
    quantity: 0,
    quantityUnit: 'lt',
    customerName: '',
    customerCode: '',
    deliveryAddress: '',
    destinationCode: '',
    notes: '',
    assignedDriverId: '',
  });
  
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedPDFData | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParsedData(null);

    if (selectedFile.type.startsWith('image/')) {
        setFilePreview(URL.createObjectURL(selectedFile));
    } else {
        setFilePreview(null);
    }
    
    setParsing(true);
    try {
        let parsed: ParsedPDFData | null = null;
        if (mode === 'pdf' && selectedFile.type === 'application/pdf') {
            const pdfText = await parsePDFText(selectedFile);
            parsed = parseGestionaleData(pdfText) || parseGestionaleDataManual(pdfText);
        } else if (mode === 'image' && selectedFile.type.startsWith('image/')) {
            parsed = await parseImageWithAI(selectedFile);
        } else {
            alert('Formato file non valido per la modalità selezionata.');
            setParsing(false);
            return;
        }
        
        setParsedData(parsed);
        if (!parsed) {
            alert('Impossibile estrarre i dati dal file. Controlla il formato o prova con inserimento manuale.');
        }

    } catch (error) {
        console.error('Error parsing file:', error);
        alert('Errore nel parsing del file. Prova con inserimento manuale.');
    } finally {
        setParsing(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userProfile) return;
    
    setLoading(true);
    
    try {
      const { assignedDriverId, ...orderFields } = formData;
      const newOrderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
        ...orderFields,
        quantity: Number(orderFields.quantity),
        status: assignedDriverId ? 'assegnato' : 'pendente',
        createdBy: userProfile.id,
      };
      const newOrder = await addOrder(newOrderData);
      
      if (assignedDriverId && newOrder.id) {
        const driver = drivers.find(d => d.id === assignedDriverId);
        if (driver) {
          await addTrip({
            orderId: newOrder.id,
            driverId: assignedDriverId,
            driverName: driver.name,
            status: 'assegnato',
            assignedBy: userProfile.id,
          });
        }
      }
      
      onClose();
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Errore durante la creazione dell\'ordine');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSubmit = async () => {
    if (!userProfile || !parsedData) return;
    
    setLoading(true);
    
    try {
      // Cerca automaticamente l'autista dal PDF nel database
      let assignedDriver: User | undefined;
      if (parsedData.driverInfo.autista) {
        const driverName = parsedData.driverInfo.autista.trim();
        const foundDriver = drivers.find(driver => 
          driver.name.toLowerCase().includes(driverName.toLowerCase()) ||
          driverName.toLowerCase().includes(driver.name.toLowerCase())
        );
        
        if (foundDriver) {
          assignedDriver = foundDriver;
          console.log(`Autista trovato automaticamente: ${foundDriver.name} (${foundDriver.email})`);
        } else {
          console.log(`Autista "${driverName}" non trovato nel database`);
        }
      }
      
      // Crea ordini multipli basati sui dati parsed (senza salvare il PDF)
      const createdOrderIds: string[] = [];
      for (const orderData of parsedData.orders) {
        const newOrder = await addOrder({
          orderNumber: orderData.orderNumber,
          customerName: orderData.customerName,
          customerCode: orderData.customerCode,
          deliveryAddress: orderData.deliveryAddress,
          destinationCode: orderData.destinationCode,
          product: orderData.product,
          quantity: orderData.quantity,
          quantityUnit: orderData.quantityUnit,
          identifier: orderData.identifier,
          carrierInfo: parsedData.carrierInfo,
          loadingInfo: parsedData.loadingInfo,
          driverInfo: parsedData.driverInfo,
          bdcNumber: parsedData.bdcNumber,
          notes: `${orderData.product} - Quantità: ${orderData.quantity} ${orderData.quantityUnit}`,
          status: assignedDriver ? 'assegnato' : 'pendente',
          createdBy: userProfile.id,
        });
        
        if (newOrder.id) {
          createdOrderIds.push(newOrder.id);
        }
      }
      
      // Se abbiamo trovato un autista, assegna automaticamente tutti gli ordini
      if (assignedDriver && createdOrderIds.length > 0) {
        for (const orderId of createdOrderIds) {
          await addTrip({
            orderId: orderId,
            driverId: assignedDriver.id,
            driverName: assignedDriver.name,
            status: 'assegnato',
            assignedBy: userProfile.id,
          });
        }
        
        alert(`Creati ${parsedData.orders.length} ordini dal PDF e assegnati automaticamente a ${assignedDriver.name}!`);
      } else {
        const driverNotFoundMsg = parsedData.driverInfo.autista 
          ? `\n\nAutista &quot;${parsedData.driverInfo.autista}&quot; non trovato nel database - ordini lasciati da assegnare.`
          : '';
        alert(`Creati ${parsedData.orders.length} ordini dal PDF!${driverNotFoundMsg}`);
      }
      
      onClose();
    } catch (error) {
      console.error('Error creating orders from PDF:', error);
      alert('Errore durante la creazione degli ordini dal PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Crea Nuovo Ordine
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Mode Selection */}
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`p-4 border-2 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
                mode === 'manual' 
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <Edit className="h-5 w-5" />
              <span className="font-medium">Inserimento Manuale</span>
            </button>
            
            <button
              type="button"
              onClick={() => { setMode('pdf'); setFile(null); setParsedData(null); setFilePreview(null); }}
              className={`p-4 border-2 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
                mode === 'pdf' 
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <FileSearch className="h-5 w-5" />
              <span className="font-medium">Importa da PDF</span>
            </button>

            <button
              type="button"
              onClick={() => { setMode('image'); setFile(null); setParsedData(null); setFilePreview(null); }}
              className={`p-4 border-2 rounded-lg flex items-center justify-center space-x-2 transition-colors ${
                mode === 'image'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <ImageIcon className="h-5 w-5" />
              <span className="font-medium">Importa da Immagine</span>
            </button>
          </div>
        </div>

        {mode === 'manual' ? (
          /* Manual Form */
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label htmlFor="orderNumber" className="block text-sm font-medium text-gray-700">
                Numero Ordine *
              </label>
              <input
                type="text"
                id="orderNumber"
                name="orderNumber"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                value={formData.orderNumber}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label htmlFor="customerName" className="block text-sm font-medium text-gray-700">
                Nome Cliente *
              </label>
              <input
                type="text"
                id="customerName"
                name="customerName"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                value={formData.customerName}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label htmlFor="customerCode" className="block text-sm font-medium text-gray-700">
                Codice Cliente
              </label>
              <input
                type="text"
                id="customerCode"
                name="customerCode"
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                value={formData.customerCode}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label htmlFor="deliveryAddress" className="block text-sm font-medium text-gray-700">
                Indirizzo di Consegna *
              </label>
              <input
                type="text"
                id="deliveryAddress"
                name="deliveryAddress"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                value={formData.deliveryAddress}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label htmlFor="destinationCode" className="block text-sm font-medium text-gray-700">
                Codice Destinazione
              </label>
              <input
                type="text"
                id="destinationCode"
                name="destinationCode"
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                value={formData.destinationCode}
                onChange={handleInputChange}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="product" className="block text-sm font-medium text-gray-700">
                  Prodotto *
                </label>
                <input
                  type="text"
                  id="product"
                  name="product"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.product}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
                  Quantità *
                </label>
                <input
                  type="number"
                  id="quantity"
                  name="quantity"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.quantity}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <label htmlFor="quantityUnit" className="block text-sm font-medium text-gray-700">
                  Unità *
                </label>
                <input
                  type="text"
                  id="quantityUnit"
                  name="quantityUnit"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.quantityUnit}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                Note
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                value={formData.notes}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label htmlFor="assignedDriverId" className="block text-sm font-medium text-gray-700">
                Assegna Autista
              </label>
              <div className="mt-1 relative">
                <select
                  id="assignedDriverId"
                  name="assignedDriverId"
                  className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.assignedDriverId}
                  onChange={handleInputChange}
                >
                  <option value="">Da assegnare successivamente</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name} ({driver.email})
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <UserIcon className="h-4 w-4 text-gray-400" />
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Puoi assegnare l'ordine direttamente a un autista o lasciarlo da assegnare
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400"
              >
                {loading ? 'Creazione...' : 'Crea Ordine'}
              </button>
            </div>
          </form>
        ) : (
          /* PDF/Image Import Mode */
          <div className="space-y-6">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {mode === 'pdf' ? 'Carica PDF Gestionale' : 'Carica Immagine Documento'} *
              </label>
              <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                  {file ? (
                    <div className="flex flex-col items-center space-y-2">
                      {filePreview && <img src={filePreview} alt="Preview" className="max-h-32 rounded-lg mb-2" />}
                      <div className="flex items-center space-x-2">
                        {mode === 'image' ? <ImageIcon className="h-8 w-8 text-gray-400" /> : <FileText className="h-8 w-8 text-gray-400" />}
                        <span className="text-sm text-gray-600">{file.name}</span>
                        {parsing && <span className="text-sm text-blue-600">Analizzando...</span>}
                        {parsedData && <CheckCircle className="h-5 w-5 text-green-500" />}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFile(null);
                          setParsedData(null);
                          setFilePreview(null);
                          if(filePreview) URL.revokeObjectURL(filePreview);
                        }}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Rimuovi file
                      </button>
                    </div>
                  ) : (
                    <>
                      {mode === 'image' ? <ImageIcon className="mx-auto h-12 w-12 text-gray-400" /> : <FileText className="mx-auto h-12 w-12 text-gray-400" />}
                      <div className="flex text-sm text-gray-600">
                        <label
                          htmlFor="fileImport"
                          className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                        >
                          <span>{mode === 'pdf' ? 'Carica PDF gestionale' : 'Carica una immagine'}</span>
                          <input
                            id="fileImport"
                            name="fileImport"
                            type="file"
                            accept={mode === 'pdf' ? '.pdf' : 'image/*'}
                            className="sr-only"
                            onChange={handleFileChange}
                          />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">
                        {mode === 'pdf' ? 'PDF con ordini multipli dal gestionale' : 'Immagine di un documento di trasporto'}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Parsed Data Preview */}
            {parsedData && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Dati Estratti dal PDF</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h5 className="font-medium text-sm text-gray-700">Informazioni Vettore</h5>
                    <p className="text-sm text-gray-600">{parsedData.carrierInfo.vettore}</p>
                    <p className="text-sm text-gray-600">P.IVA: {parsedData.carrierInfo.partitaIva}</p>
                  </div>
                  <div>
                    <h5 className="font-medium text-sm text-gray-700">Autista</h5>
                    <p className="text-sm text-gray-600">{parsedData.driverInfo.autista}</p>
                    {parsedData.driverInfo.targaMotrice && (
                      <p className="text-sm text-gray-600">Targa: {parsedData.driverInfo.targaMotrice}</p>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <h5 className="font-medium text-sm text-gray-700 mb-2">
                    Ordini Trovati ({parsedData.orders.length})
                  </h5>
                  <div className="max-h-40 overflow-y-auto">
                    {parsedData.orders.map((order, index) => (
                      <div key={index} className="border-b border-gray-200 py-2 last:border-b-0">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{order.orderNumber}</p>
                            <p className="text-sm text-gray-600">{order.customerName}</p>
                            <p className="text-sm text-gray-500">{order.deliveryAddress}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{order.quantity} {order.quantityUnit}</p>
                            <p className="text-xs text-gray-500">{order.product}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={handleFileSubmit}
                disabled={loading || !parsedData || parsing}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400"
              >
                {loading ? 'Creazione...' : parsing ? 'Analizzando...' : `Crea ${parsedData?.orders.length || 0} Ordini`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 