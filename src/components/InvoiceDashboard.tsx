'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInvoices, usePriceChecks } from '@/hooks/useFirestore';
import { InvoiceData } from '@/lib/types';
import { 
  LogOut, 
  Plus, 
  FileText, 
  Upload,
  Download,
  Trash2,
  Eye,
  Edit3,
  CheckCircle,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function InvoiceDashboard() {
  const { userProfile, logout } = useAuth();
  const [invoiceType, setInvoiceType] = useState<'attivo' | 'passivo'>('passivo');
  const { invoices, loading: invoicesLoading, addInvoice, deleteInvoice } = useInvoices(invoiceType);
  const { priceChecks, addPriceCheck } = usePriceChecks();
  
  const [isUploading, setIsUploading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [showPriceCheckModal, setShowPriceCheckModal] = useState(false);

  const [priceData, setPriceData] = useState<{date: string, q8Price: number, plattsPrice: number}[]>([]);
  const [priceFileName, setPriceFileName] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    currentFileName: string;
    errors: string[];
  }>({ current: 0, total: 0, currentFileName: '', errors: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const priceFileInputRef = useRef<HTMLInputElement>(null);
  
  // Soglie per variazioni significative
  const SIGNIFICANT_VARIANCE_THRESHOLD = 0.01; // €0.01 per litro
  const SIGNIFICANT_PERCENTAGE_THRESHOLD = 2; // 2%

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isValidFile = file.type === 'application/pdf' || 
                       file.type === 'application/xml' || 
                       file.type === 'text/xml' || 
                       file.name.toLowerCase().endsWith('.xml');
    
    if (!isValidFile) {
      alert('Per favore carica solo file PDF o XML della fattura elettronica');
      return;
    }

    await processFile(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBulkFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    // Validate all files first
    Array.from(files).forEach(file => {
      const isValidFile = file.type === 'application/pdf' || 
                         file.type === 'application/xml' || 
                         file.type === 'text/xml' || 
                         file.name.toLowerCase().endsWith('.xml');
      
      if (isValidFile) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      alert(`I seguenti file hanno formato non supportato e saranno saltati:\n${invalidFiles.join('\n')}`);
    }

    if (validFiles.length === 0) {
      alert('Nessun file valido da processare');
      return;
    }

    setIsUploading(true);
    setUploadProgress({
      current: 0,
      total: validFiles.length,
      currentFileName: '',
      errors: []
    });

    const errors: string[] = [];
    let successCount = 0;

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      
      setUploadProgress(prev => ({
        ...prev,
        current: i + 1,
        currentFileName: file.name
      }));

      try {
        await processFile(file);
        successCount++;
      } catch (error) {
        const errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`;
        errors.push(errorMessage);
        console.error(`Errore processando ${file.name}:`, error);
      }
    }

    setIsUploading(false);
    setUploadProgress({ current: 0, total: 0, currentFileName: '', errors: [] });

    // Show summary
    let message = `Caricamento completato!\n`;
    message += `✅ ${successCount} fatture processate con successo\n`;
    
    if (errors.length > 0) {
      message += `❌ ${errors.length} errori:\n`;
      message += errors.slice(0, 5).join('\n');
      if (errors.length > 5) {
        message += `\n... e altri ${errors.length - 5} errori`;
      }
    }

    alert(message);

    // Reset file input
    if (bulkFileInputRef.current) {
      bulkFileInputRef.current.value = '';
    }
  };

  const processFile = async (file: File): Promise<void> => {
    // Use API for processing both PDF and XML files
    const formData = new FormData();
    formData.append('invoice', file);

    const response = await fetch('/api/parse-invoice', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || 'Errore durante l\'elaborazione del file');
    }

    const parsedData = await response.json();
    
    if (!parsedData) {
      throw new Error('Impossibile estrarre i dati dalla fattura');
    }

    // Create invoice data with transport details
    const invoiceData: Omit<InvoiceData, 'id' | 'createdAt' | 'updatedAt'> = {
      invoiceNumber: parsedData.invoiceNumber,
      date: parsedData.date,
      issuerName: parsedData.issuerInfo.name,
      issuerTaxCode: parsedData.issuerInfo.taxCode,
      issuerAddress: parsedData.issuerInfo.address,
      clientName: parsedData.clientInfo.name,
      clientTaxCode: parsedData.clientInfo.taxCode,
      clientAddress: parsedData.clientInfo.address,
      totalAmount: parsedData.amounts.totalAmount,
      taxAmount: parsedData.amounts.taxAmount,
      netAmount: parsedData.amounts.netAmount,
      description: parsedData.description,
      paymentTerms: parsedData.paymentTerms,
      dueDate: parsedData.dueDate,
      createdBy: userProfile?.id || '',
      filePath: file.name,
      invoiceType: invoiceType, // Usa il tipo selezionato
      // Campi specifici trasporti
      productType: parsedData.transportDetails?.productType,
      quantity: parsedData.transportDetails?.quantity,
      unitPrice: parsedData.transportDetails?.unitPrice,
      dasNumber: parsedData.transportDetails?.dasNumber,
      deliveryAddress: parsedData.transportDetails?.deliveryAddress,
      unitOfMeasure: parsedData.transportDetails?.unitOfMeasure,
      // Linee di dettaglio
      invoiceLines: parsedData.invoiceLines,
    };

    // Save to database
    await addInvoice(invoiceData);
  };

  const handleDeleteInvoice = async (invoice: InvoiceData) => {
    if (!confirm(`Sei sicuro di voler eliminare la fattura ${invoice.invoiceNumber}?`)) {
      return;
    }

    try {
      await deleteInvoice(invoice.id);
      alert('Fattura eliminata con successo');
    } catch (error) {
      console.error('Errore durante l\'eliminazione:', error);
      alert('Errore durante l\'eliminazione della fattura');
    }
  };

  const handleExportToExcel = () => {
    const dataToExport: any[] = [];
    
    invoices.forEach(invoice => {
      // Funzione per calcolare differenze con Platts e Q8 (solo per fatture passive)
      const getPriceComparisons = (unitPrice: number) => {
        const result = {
          plattsPrice: 'N/A',
          plattsDifference: 'N/A', 
          plattsStatus: 'N/A',
          q8Price: 'N/A',
          q8Difference: 'N/A',
          q8Status: 'N/A'
        };

        if (invoice.invoiceType === 'passivo' && priceData.length > 0 && unitPrice > 0) {
          const prices = findPricesForDate(invoice.date);
          
          // Confronto con Platts
          if (prices.plattsPrice) {
            const plattsDiff = unitPrice - prices.plattsPrice;
            result.plattsPrice = `€ ${prices.plattsPrice.toFixed(6)}`;
            result.plattsDifference = `€ ${plattsDiff.toFixed(6)}`;
            result.plattsStatus = plattsDiff > 0 ? 'Sopra Platts' : plattsDiff < 0 ? 'Sotto Platts' : 'Uguale Platts';
          }

          // Confronto con Q8
          if (prices.q8Price) {
            const q8Diff = unitPrice - prices.q8Price;
            result.q8Price = `€ ${prices.q8Price.toFixed(6)}`;
            result.q8Difference = `€ ${q8Diff.toFixed(6)}`;
            result.q8Status = q8Diff > 0 ? 'Sopra Q8' : q8Diff < 0 ? 'Sotto Q8' : 'Uguale Q8';
          }
        }

        return result;
      };

      if (invoice.invoiceLines && invoice.invoiceLines.length > 0) {
        // Per fatture con linee multiple, esporta ogni linea separatamente
        invoice.invoiceLines.forEach(line => {
          const priceComparisons = getPriceComparisons(line.unitValue);
          
          const exportRow: any = {
            'Numero Fattura': invoice.invoiceNumber,
            'Tipo Fattura': invoice.invoiceType,
            'Data': invoice.date,
            'Cedente/Prestatore': invoice.issuerName,
            'P.IVA Cedente': invoice.issuerTaxCode,
            'Cessionario/Committente': invoice.clientName,
            'P.IVA Cessionario': invoice.clientTaxCode,
            'Linea': line.lineNumber,
            'Codice Prodotto': line.productCode || 'N/A',
            'Descrizione Prodotto': line.description,
            'Quantità': line.quantity.toLocaleString(),
            'Unità Misura': line.unitOfMeasure,
            'Prezzo Fatturato': `€ ${line.unitValue.toFixed(6)}`,
            'Valore Totale': `€ ${line.totalValue.toFixed(2)}`,
            'IVA %': `${line.vatRate}%`,
            'Importo Totale Fattura': `€ ${invoice.totalAmount.toFixed(2)}`,
            'Data Caricamento': invoice.createdAt.toLocaleDateString('it-IT'),
            'Nome File': invoice.filePath || 'N/A'
          };

          // Aggiungi colonne confronti prezzi solo per fatture passive
          if (invoice.invoiceType === 'passivo') {
            exportRow['Prezzo ACQ'] = priceComparisons.q8Price;
            exportRow['Differenza vs Q8'] = priceComparisons.q8Difference;
            exportRow['Status vs Q8'] = priceComparisons.q8Status;
            exportRow['Prezzo Platts'] = priceComparisons.plattsPrice;
            exportRow['Differenza vs Platts'] = priceComparisons.plattsDifference;
            exportRow['Status vs Platts'] = priceComparisons.plattsStatus;
          }

          dataToExport.push(exportRow);
        });
      } else {
        // Per fatture semplici
        const unitPrice = invoice.unitPrice || 0;
        const priceComparisons = getPriceComparisons(unitPrice);
        
        const exportRow: any = {
          'Numero Fattura': invoice.invoiceNumber,
          'Tipo Fattura': invoice.invoiceType,
          'Data': invoice.date,
          'Cedente/Prestatore': invoice.issuerName,
          'P.IVA Cedente': invoice.issuerTaxCode,
          'Cessionario/Committente': invoice.clientName,
          'P.IVA Cessionario': invoice.clientTaxCode,
          'Linea': 1,
          'Codice Prodotto': 'N/A',
          'Descrizione Prodotto': invoice.productType || invoice.description,
          'Quantità': invoice.quantity || 'N/A',
          'Unità Misura': invoice.unitOfMeasure || 'N/A',
          'Prezzo Fatturato': unitPrice > 0 ? `€ ${unitPrice.toFixed(6)}` : 'N/A',
          'Valore Totale': `€ ${invoice.totalAmount.toFixed(2)}`,
          'IVA %': `${(invoice.taxAmount / invoice.netAmount * 100).toFixed(0)}%`,
          'Importo Totale Fattura': `€ ${invoice.totalAmount.toFixed(2)}`,
          'Data Caricamento': invoice.createdAt.toLocaleDateString('it-IT'),
          'Nome File': invoice.filePath || 'N/A'
        };

        // Aggiungi colonne confronti prezzi solo per fatture passive
        if (invoice.invoiceType === 'passivo') {
          exportRow['Prezzo ACQ'] = priceComparisons.q8Price;
          exportRow['Differenza vs Q8'] = priceComparisons.q8Difference;
          exportRow['Status vs Q8'] = priceComparisons.q8Status;
          exportRow['Prezzo Platts'] = priceComparisons.plattsPrice;
          exportRow['Differenza vs Platts'] = priceComparisons.plattsDifference;
          exportRow['Status vs Platts'] = priceComparisons.plattsStatus;
        }

        dataToExport.push(exportRow);
      }
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fatture");
    
    const fileName = invoiceType === 'passivo' 
      ? `fatture_passive_${new Date().toISOString().split('T')[0]}.xlsx`
      : `fatture_attive_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
  };

  const handleViewDetails = (invoice: InvoiceData) => {
    setSelectedInvoice(invoice);
    setShowInvoiceDetails(true);
  };

  const handlePriceFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      alert('Per favore carica un file Excel (.xlsx o .xls)');
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Converti il foglio in array di array
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      const extractedPrices: {date: string, q8Price: number, plattsPrice: number}[] = [];
      
      // Scorri le righe e estrai colonna B (date), C (platts) e T (q8)
      for (let i = 1; i < data.length; i++) { // Salta la prima riga (header)
        const row = data[i];
        const dateValue = row[1]; // Colonna B (indice 1)
        const plattsValue = row[2]; // Colonna C (indice 2) - Platts Auto
        const q8Value = row[19]; // Colonna T (indice 19) - Q8
        
        if (dateValue && (plattsValue || q8Value)) {
          let formattedDate = '';
          
          // Gestisci diversi formati di data
          if (typeof dateValue === 'number') {
            // Excel date serial number
            const excelDate = XLSX.SSF.parse_date_code(dateValue);
            formattedDate = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
          } else if (typeof dateValue === 'string') {
            // Gestisci formato americano mm/gg/yy o mm/gg/yyyy
            const americanDateMatch = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
            if (americanDateMatch) {
              const [, month, day, yearStr] = americanDateMatch;
              let year = parseInt(yearStr);
              
              // Se anno a 2 cifre, converti assumendo 20xx per 00-30, 19xx per 31-99
              if (year < 100) {
                year = year <= 30 ? 2000 + year : 1900 + year;
              }
              
              formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
              console.log(`Conversione data: ${dateValue} -> ${formattedDate}`);
            } else {
              // Prova parsing generico
              const parsedDate = new Date(dateValue);
              if (!isNaN(parsedDate.getTime())) {
                formattedDate = parsedDate.toISOString().split('T')[0];
              }
            }
          }
          
          const numericQ8Price = q8Value ? (typeof q8Value === 'number' ? q8Value : parseFloat(q8Value)) : 0;
          const numericPlattsPrice = plattsValue ? (typeof plattsValue === 'number' ? plattsValue : parseFloat(plattsValue)) : 0;
          
          if (formattedDate && (numericQ8Price > 0 || numericPlattsPrice > 0)) {
            extractedPrices.push({
              date: formattedDate,
              q8Price: numericQ8Price,
              plattsPrice: numericPlattsPrice
            });
          }
        }
      }
      
      if (extractedPrices.length === 0) {
        alert('Non sono stati trovati dati validi nelle colonne B (date), C (platts) e T (q8)');
        return;
      }
      
      setPriceData(extractedPrices);
      setPriceFileName(file.name);
      
      const q8Count = extractedPrices.filter(p => p.q8Price > 0).length;
      const plattsCount = extractedPrices.filter(p => p.plattsPrice > 0).length;
      alert(`✅ Caricati ${extractedPrices.length} record da ${file.name}\n• Q8: ${q8Count} prezzi\n• Platts: ${plattsCount} prezzi`);
      
      if (priceFileInputRef.current) {
        priceFileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('Errore durante la lettura del file Excel:', error);
      alert('Errore durante la lettura del file Excel. Verifica che il formato sia corretto.');
    }
  };

  const findPricesForDate = (invoiceDate: string): {q8Price: number | null, plattsPrice: number | null, date: string | null} => {
    if (priceData.length === 0) return {q8Price: null, plattsPrice: null, date: null};
    
    // Cerca data esatta
    const exactMatch = priceData.find(item => item.date === invoiceDate);
    if (exactMatch) {
      return {
        q8Price: exactMatch.q8Price > 0 ? exactMatch.q8Price : null,
        plattsPrice: exactMatch.plattsPrice > 0 ? exactMatch.plattsPrice : null,
        date: exactMatch.date
      };
    }
    
    // Cerca data più vicina (entro 7 giorni)
    const targetDate = new Date(invoiceDate);
    let closestItem: typeof priceData[0] | null = null;
    let minDifference = Infinity;
    
    for (const item of priceData) {
      const itemDate = new Date(item.date);
      const difference = Math.abs(targetDate.getTime() - itemDate.getTime());
      const daysDifference = difference / (1000 * 60 * 60 * 24);
      
      if (daysDifference <= 7 && difference < minDifference) {
        minDifference = difference;
        closestItem = item;
      }
    }
    
    if (closestItem) {
      return {
        q8Price: closestItem.q8Price > 0 ? closestItem.q8Price : null,
        plattsPrice: closestItem.plattsPrice > 0 ? closestItem.plattsPrice : null,
        date: closestItem.date
      };
    }
    
    return {q8Price: null, plattsPrice: null, date: null};
  };

  // Funzione per calcolare le variazioni significative
  const calculatePriceVariances = (invoice: InvoiceData) => {
    if (invoice.invoiceType !== 'passivo' || priceData.length === 0) {
      return { hasSignificantVariance: false, variances: [] };
    }

    const prices = findPricesForDate(invoice.date);
    const effectivePrice = invoice.invoiceLines && invoice.invoiceLines.length > 0 
      ? invoice.invoiceLines[0].unitValue 
      : (invoice.unitPrice || 0);

    if (effectivePrice <= 0) {
      return { hasSignificantVariance: false, variances: [] };
    }

    const variances = [];

    // Controllo variazione Q8
    if (prices.q8Price) {
      const q8Difference = effectivePrice - prices.q8Price;
      const q8PercentageDiff = Math.abs((q8Difference / prices.q8Price) * 100);
      
      if (Math.abs(q8Difference) >= SIGNIFICANT_VARIANCE_THRESHOLD || q8PercentageDiff >= SIGNIFICANT_PERCENTAGE_THRESHOLD) {
        variances.push({
          type: 'Q8',
          referencePrice: prices.q8Price,
          invoicePrice: effectivePrice,
          difference: q8Difference,
          percentageDiff: q8PercentageDiff,
          status: q8Difference > 0 ? 'above' : 'below'
        });
      }
    }

    // Controllo variazione Platts
    if (prices.plattsPrice) {
      const plattsDifference = effectivePrice - prices.plattsPrice;
      const plattsPercentageDiff = Math.abs((plattsDifference / prices.plattsPrice) * 100);
      
      if (Math.abs(plattsDifference) >= SIGNIFICANT_VARIANCE_THRESHOLD || plattsPercentageDiff >= SIGNIFICANT_PERCENTAGE_THRESHOLD) {
        variances.push({
          type: 'Platts',
          referencePrice: prices.plattsPrice,
          invoicePrice: effectivePrice,
          difference: plattsDifference,
          percentageDiff: plattsPercentageDiff,
          status: plattsDifference > 0 ? 'above' : 'below'
        });
      }
    }

    return {
      hasSignificantVariance: variances.length > 0,
      variances
    };
  };

  // Ottieni tutte le fatture con variazioni significative
  const getInvoicesWithSignificantVariances = () => {
    return invoices
      .map(invoice => ({
        invoice,
        ...calculatePriceVariances(invoice)
      }))
      .filter(item => item.hasSignificantVariance)
      .sort((a, b) => {
        // Ordina per maggiore variazione assoluta
        const maxVarianceA = Math.max(...a.variances.map(v => Math.abs(v.difference)));
        const maxVarianceB = Math.max(...b.variances.map(v => Math.abs(v.difference)));
        return maxVarianceB - maxVarianceA;
      });
  };

  const handlePriceCheck = async (invoice: InvoiceData) => {
    // Ora è solo un modal informativo per mostrare i dettagli
    setSelectedInvoice(invoice);
    setShowPriceCheckModal(true);
  };

  if (invoicesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                Amministrazione e Fatture
              </h1>
              <p className="text-gray-600">Ciao {userProfile?.name}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        {/* Avvisi Variazioni Prezzi */}
        {invoiceType === 'passivo' && priceData.length > 0 && (() => {
          const invoicesWithVariances = getInvoicesWithSignificantVariances();
          
          if (invoicesWithVariances.length === 0) return null;
          
          return (
            <div className="mb-8">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                <div className="flex items-center mb-4">
                  <AlertTriangle className="h-6 w-6 text-yellow-600 mr-2" />
                  <h3 className="text-lg font-medium text-yellow-800">
                    Avvisi Variazioni Prezzi ({invoicesWithVariances.length})
                  </h3>
                </div>
                
                <div className="space-y-3">
                  {invoicesWithVariances.slice(0, 5).map(({ invoice, variances }) => (
                    <div key={invoice.id} className="bg-white p-4 rounded-lg shadow-sm border">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-4">
                            <span className="font-medium text-gray-900">
                              Fattura {invoice.invoiceNumber}
                            </span>
                            <span className="text-sm text-gray-500">
                              {invoice.date}
                            </span>
                            <span className="text-sm text-gray-600">
                              {invoice.issuerName}
                            </span>
                          </div>
                          
                          <div className="mt-2 flex flex-wrap gap-2">
                            {variances.map((variance, index) => (
                              <div
                                key={index}
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  variance.status === 'above'
                                    ? variance.type === 'Q8' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-red-100 text-red-800'
                                    : variance.type === 'Q8'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-green-100 text-green-800'
                                }`}
                              >
                                {variance.type}: {variance.status === 'above' ? '+' : ''}€{variance.difference.toFixed(4)}
                                ({variance.status === 'above' ? '+' : ''}{variance.percentageDiff.toFixed(1)}%)
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setShowPriceCheckModal(true);
                          }}
                          className="ml-4 inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-yellow-600 hover:bg-yellow-700"
                        >
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Dettagli
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {invoicesWithVariances.length > 5 && (
                    <div className="text-center pt-2">
                      <p className="text-sm text-yellow-700">
                        ... e altre {invoicesWithVariances.length - 5} fatture con variazioni
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FileText className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Fatture Totali
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {invoices.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FileText className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Valore Totale
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      € {invoices.reduce((sum, inv) => sum + inv.totalAmount, 0).toFixed(2)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FileText className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      IVA Totale
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      € {invoices.reduce((sum, inv) => sum + inv.taxAmount, 0).toFixed(2)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Stat Variazioni Prezzi - Solo per fatture passive con dati prezzi */}
          {invoiceType === 'passivo' && priceData.length > 0 && (
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <AlertTriangle className={`h-6 w-6 ${getInvoicesWithSignificantVariances().length > 0 ? 'text-red-400' : 'text-green-400'}`} />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Variazioni Prezzi
                      </dt>
                      <dd className={`text-lg font-medium ${getInvoicesWithSignificantVariances().length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {getInvoicesWithSignificantVariances().length} su {invoices.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

                {/* Actions */}
        {/* Toggle Fatture Attive/Passive */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">Tipo Fatture:</span>
            <div className="flex rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setInvoiceType('passivo')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  invoiceType === 'passivo'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Al Passivo
              </button>
              <button
                onClick={() => setInvoiceType('attivo')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  invoiceType === 'attivo'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                All'Attivo
              </button>
            </div>
          </div>

          {/* Pulsanti Controllo Prezzi per Fatture Passive */}
          {invoiceType === 'passivo' && (
            <div className="flex space-x-2">
              <button
                onClick={() => priceFileInputRef.current?.click()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                Carica Excel Prezzi
              </button>
              <button
                onClick={() => setShowPriceCheckModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Controllo Prezzi
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mb-8 flex flex-wrap gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? 'Caricamento...' : 'Carica Singola Fattura'}
          </button>

          <button
            onClick={() => bulkFileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            {isUploading ? 'Processando...' : 'Caricamento Massivo'}
          </button>
          
          <button
            onClick={handleExportToExcel}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Esporta Excel
          </button>
        </div>

        {/* Upload Progress */}
        {isUploading && uploadProgress.total > 1 && (
          <div className="mb-6 bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Processamento in corso...
              </span>
              <span className="text-sm text-gray-500">
                {uploadProgress.current} di {uploadProgress.total}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
              ></div>
            </div>
            {uploadProgress.currentFileName && (
              <p className="text-sm text-gray-600">
                File corrente: {uploadProgress.currentFileName}
              </p>
            )}
          </div>
        )}

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.xml"
          onChange={handleFileUpload}
          className="hidden"
        />
        
        <input
          ref={bulkFileInputRef}
          type="file"
          accept=".pdf,.xml"
          multiple
          onChange={handleBulkFileUpload}
          className="hidden"
        />

        {/* Hidden price file input */}
        <input
          ref={priceFileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handlePriceFileUpload}
          className="hidden"
        />

        {/* Price Data Status */}
        {invoiceType === 'passivo' && priceData.length > 0 && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  File prezzi caricato: {priceFileName}
                </p>
                <p className="text-xs text-green-600">
                  {priceData.length} record • Q8: {priceData.filter(p => p.q8Price > 0).length} • Platts: {priceData.filter(p => p.plattsPrice > 0).length}
                </p>
              </div>
              <button
                onClick={() => {
                  setPriceData([]);
                  setPriceFileName('');
                }}
                className="ml-auto text-green-600 hover:text-green-800"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Invoices Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Fatture {invoiceType === 'passivo' ? 'al Passivo' : "all'Attivo"}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Elenco di tutte le fatture {invoiceType === 'passivo' ? 'ricevute' : 'emesse'}
            </p>
          </div>
          
          {invoices.length === 0 ? (
                          <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Nessuna fattura</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Inizia caricando la tua prima fattura elettronica (PDF o XML).
                </p>
              </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Numero
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {invoiceType === 'passivo' ? 'Fornitore' : 'Cliente'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prodotti
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valore Unitario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Importo
                    </th>
                    {invoiceType === 'passivo' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Controllo
                      </th>
                    )}
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoices.map((invoice) => {
                    const priceVariance = calculatePriceVariances(invoice);
                    const hasVariance = priceVariance.hasSignificantVariance;
                    
                    return (
                    <tr key={invoice.id} className={`hover:bg-gray-50 ${hasVariance ? 'bg-yellow-50 border-l-4 border-yellow-300' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invoice.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invoiceType === 'passivo' ? invoice.issuerName : invoice.clientName || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invoice.invoiceLines && invoice.invoiceLines.length > 0 
                          ? `${invoice.invoiceLines.length} prodotti`
                          : (invoice.productType || 'N/A')
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invoice.invoiceLines && invoice.invoiceLines.length > 0
                          ? `€ ${invoice.invoiceLines[0].unitValue.toFixed(6)}`
                          : (invoice.unitPrice ? `€ ${invoice.unitPrice.toFixed(6)}` : 'N/A')
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        € {invoice.totalAmount.toFixed(2)}
                      </td>
                      {invoiceType === 'passivo' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setShowPriceCheckModal(true);
                              }}
                              className={`${hasVariance ? 'text-red-600 hover:text-red-900' : 'text-yellow-600 hover:text-yellow-900'}`}
                              title="Controllo prezzi"
                            >
                              <TrendingUp className="w-4 h-4" />
                            </button>
                            {hasVariance && (
                              <div title="Variazione significativa rilevata">
                                <AlertTriangle className="w-3 h-3 text-red-500" />
                              </div>
                            )}
                            {priceData.length > 0 && (findPricesForDate(invoice.date).q8Price || findPricesForDate(invoice.date).plattsPrice) && (
                              <div title="Prezzi disponibili da Excel">
                                <CheckCircle className="w-3 h-3 text-green-500" />
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleViewDetails(invoice)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteInvoice(invoice)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Invoice Details Modal */}
      {showInvoiceDetails && selectedInvoice && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-medium text-gray-900">
                  Dettagli Fattura {selectedInvoice.invoiceNumber}
                </h3>
                <button
                  onClick={() => setShowInvoiceDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900">Informazioni Generali</h4>
                  <div className="space-y-2">
                    <p><span className="font-medium">Numero:</span> {selectedInvoice.invoiceNumber}</p>
                    <p><span className="font-medium">Data:</span> {selectedInvoice.date}</p>
                    <p><span className="font-medium">Scadenza:</span> {selectedInvoice.dueDate || 'N/A'}</p>
                    <p><span className="font-medium">Termini Pagamento:</span> {selectedInvoice.paymentTerms || 'N/A'}</p>
                  </div>

                  <h4 className="font-semibold text-gray-900 mt-6">Cedente/Prestatore</h4>
                  <div className="space-y-2">
                    <p><span className="font-medium">Nome:</span> {selectedInvoice.issuerName}</p>
                    <p><span className="font-medium">P.IVA/C.F.:</span> {selectedInvoice.issuerTaxCode}</p>
                    <p><span className="font-medium">Indirizzo:</span> {selectedInvoice.issuerAddress}</p>
                  </div>

                  <h4 className="font-semibold text-gray-900 mt-6">Importi</h4>
                  <div className="space-y-2">
                    <p><span className="font-medium">Netto:</span> € {selectedInvoice.netAmount.toFixed(2)}</p>
                    <p><span className="font-medium">IVA:</span> € {selectedInvoice.taxAmount.toFixed(2)}</p>
                    <p><span className="font-medium text-lg">Totale:</span> <span className="text-lg font-bold">€ {selectedInvoice.totalAmount.toFixed(2)}</span></p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900">Cessionario/Committente</h4>
                  <div className="space-y-2">
                    <p><span className="font-medium">Nome:</span> {selectedInvoice.clientName}</p>
                    <p><span className="font-medium">P.IVA/C.F.:</span> {selectedInvoice.clientTaxCode}</p>
                    <p><span className="font-medium">Indirizzo:</span> {selectedInvoice.clientAddress}</p>
                  </div>

                  {/* Dettagli Trasporto */}
                  {(selectedInvoice.productType || selectedInvoice.quantity || selectedInvoice.dasNumber) && (
                    <>
                      <h4 className="font-semibold text-gray-900 mt-6">Dettagli Trasporto</h4>
                      <div className="space-y-2">
                        {selectedInvoice.productType && (
                          <p><span className="font-medium">Prodotto:</span> {selectedInvoice.productType}</p>
                        )}
                        {selectedInvoice.quantity && (
                          <p><span className="font-medium">Quantità:</span> {selectedInvoice.quantity.toLocaleString()} {selectedInvoice.unitOfMeasure || 'L'}</p>
                        )}
                        {selectedInvoice.unitPrice && (
                          <p><span className="font-medium">Prezzo Unitario:</span> € {selectedInvoice.unitPrice.toFixed(3)}</p>
                        )}
                        {selectedInvoice.dasNumber && (
                          <p><span className="font-medium">Numero DAS:</span> {selectedInvoice.dasNumber}</p>
                        )}
                        {selectedInvoice.deliveryAddress && (
                          <p><span className="font-medium">Base di Carico:</span> {selectedInvoice.deliveryAddress}</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Linee di Dettaglio */}
              {selectedInvoice.invoiceLines && selectedInvoice.invoiceLines.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Linee di Dettaglio ({selectedInvoice.invoiceLines.length} prodotti)</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Linea</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prodotto</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantità</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Valore Unit.</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Totale</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedInvoice.invoiceLines.map((line) => (
                          <tr key={line.lineNumber}>
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                              {line.lineNumber}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              <div>
                                <p className="font-medium">{line.description}</p>
                                {line.productCode && (
                                  <p className="text-xs text-gray-500">Cod: {line.productCode}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">
                              {line.quantity.toLocaleString()} {line.unitOfMeasure}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-mono text-gray-900">
                              € {line.unitValue.toFixed(6)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                              € {line.totalValue.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedInvoice.description && (
                <div className="mt-6">
                  <h4 className="font-semibold text-gray-900">Descrizione</h4>
                  <p className="mt-2 text-gray-700">{selectedInvoice.description}</p>
                </div>
              )}

              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setShowInvoiceDetails(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Price Check Modal */}
      {showPriceCheckModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-6 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Controllo Prezzi
                </h3>
                <button
                  onClick={() => {
                    setShowPriceCheckModal(false);
                    setSelectedInvoice(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {selectedInvoice && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Fattura:</span> {selectedInvoice.invoiceNumber}
                  </p>
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Data:</span> {selectedInvoice.date}
                  </p>
                                      {selectedInvoice.invoiceLines && selectedInvoice.invoiceLines.length > 0 && (
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Prezzo Fatturato:</span> € {selectedInvoice.invoiceLines[0].unitValue.toFixed(6)}
                      </p>
                    )}
                    
                    {priceData.length > 0 && selectedInvoice && (() => {
                      const prices = findPricesForDate(selectedInvoice.date);
                      const effectivePrice = selectedInvoice.invoiceLines && selectedInvoice.invoiceLines.length > 0 
                        ? selectedInvoice.invoiceLines[0].unitValue 
                        : (selectedInvoice.unitPrice || 0);
                      
                      const results = [];
                      
                      // Confronto con Q8 (prezzo di acquisto)
                      if (prices.q8Price && effectivePrice > 0) {
                        const q8Difference = effectivePrice - prices.q8Price;
                        const q8Color = q8Difference > 0 ? 'text-green-700' : q8Difference < 0 ? 'text-red-700' : 'text-gray-700';
                        
                        results.push(
                          <div key="q8" className="text-sm mb-2 p-2 bg-blue-50 rounded">
                            <p className="text-gray-700">
                              <span className="font-medium">Q8 (ACQ COMUNICATO):</span> € {prices.q8Price.toFixed(6)}
                            </p>
                            <p className={`${q8Color} font-medium`}>
                              <span className="font-medium">Margine vs Q8:</span> € {q8Difference.toFixed(6)} 
                              {q8Difference > 0 }
                            </p>
                          </div>
                        );
                      }
                      
                      // Confronto con Platts
                      if (prices.plattsPrice && effectivePrice > 0) {
                        const plattsDifference = effectivePrice - prices.plattsPrice;
                        const plattsColor = plattsDifference > 0 ? 'text-red-700' : plattsDifference < 0 ? 'text-green-700' : 'text-gray-700';
                        
                        results.push(
                          <div key="platts" className="text-sm p-2 bg-yellow-50 rounded">
                            <p className="text-gray-700">
                              <span className="font-medium">Platts (Mercato):</span> € {prices.plattsPrice.toFixed(6)}
                            </p>
                            <p className={`${plattsColor} font-medium`}>
                              <span className="font-medium">Differenza vs Platts:</span> € {plattsDifference.toFixed(6)} 
                              {plattsDifference > 0 }
                            </p>
                          </div>
                        );
                      }
                      
                      return results.length > 0 ? <div className="space-y-2">{results}</div> : null;
                    })()}
                </div>
                              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setShowPriceCheckModal(false);
                    setSelectedInvoice(null);
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}