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
  TrendingUp,
  Filter,
  X
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

  const [priceData, setPriceData] = useState<{date: string, [key: string]: string | number}[]>([]);
  const [priceFileName, setPriceFileName] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    currentFileName: string;
    errors: string[];
  }>({ current: 0, total: 0, currentFileName: '', errors: [] });
  
  // Filtri
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [unitPriceFilter, setUnitPriceFilter] = useState<{min: string, max: string}>({min: '', max: ''});
  const [showFilters, setShowFilters] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const priceFileInputRef = useRef<HTMLInputElement>(null);
  


  // Funzioni helper per i filtri
  const getUniqueSuppliers = () => {
    const suppliers = invoices
      .filter(invoice => {
        // Escludere fatture con "/A" o "PA" dalle fatture al passivo quando si creano i filtri
        if (invoiceType === 'passivo' && (invoice.invoiceNumber.includes('/A') || invoice.invoiceNumber.includes('PA'))) {
          return false;
        }
        return true;
      })
      .map(invoice => 
        invoiceType === 'passivo' ? invoice.issuerName : invoice.clientName
      )
      .filter(Boolean);
    return [...new Set(suppliers)].sort();
  };

  const getInvoiceUnitPrice = (invoice: InvoiceData): number => {
    if (invoice.invoiceLines && invoice.invoiceLines.length > 0) {
      return invoice.invoiceLines[0].unitValue;
    }
    return invoice.unitPrice || 0;
  };

  const filteredInvoices = invoices.filter(invoice => {
    // Escludere fatture con "/A" o "PA" dalle fatture al passivo (sono fatture attive di Romabitumi)
    if (invoiceType === 'passivo' && (invoice.invoiceNumber.includes('/A') || invoice.invoiceNumber.includes('PA'))) {
      return false;
    }

    // Filtro fornitore
    if (selectedSuppliers.length > 0) {
      const supplierName = invoiceType === 'passivo' ? invoice.issuerName : invoice.clientName;
      if (!supplierName || !selectedSuppliers.includes(supplierName)) {
        return false;
      }
    }

    // Filtro range prezzo unitario
    const unitPrice = getInvoiceUnitPrice(invoice);
    if (unitPriceFilter.min && unitPrice < parseFloat(unitPriceFilter.min)) {
      return false;
    }
    if (unitPriceFilter.max && unitPrice > parseFloat(unitPriceFilter.max)) {
      return false;
    }

    return true;
  });

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
    
    // Filtra solo fatture con quantità in litri (per il calcolo dei margini)
    const invoicesWithLiters = filteredInvoices.filter(invoice => {
      if (invoice.invoiceLines && invoice.invoiceLines.length > 0) {
        return invoice.invoiceLines.some(line => 
          line.unitOfMeasure && 
          (line.unitOfMeasure.toLowerCase().includes('lt') || 
           line.unitOfMeasure.toLowerCase().includes('litri') ||
           line.unitOfMeasure.toLowerCase().includes('l'))
        );
      } else {
        return invoice.unitOfMeasure && 
               (invoice.unitOfMeasure.toLowerCase().includes('lt') || 
                invoice.unitOfMeasure.toLowerCase().includes('litri') ||
                invoice.unitOfMeasure.toLowerCase().includes('l')) &&
               invoice.quantity && invoice.quantity > 0;
      }
    });

    // Raggruppa le fatture per calcolare i margini
    const invoiceGroups = new Map();
    
    invoicesWithLiters.forEach(invoice => {
      const key = `${invoice.date}_${invoice.dasNumber || 'NO_DAS'}`;
      if (!invoiceGroups.has(key)) {
        invoiceGroups.set(key, { passive: null, active: null });
      }
      
      const group = invoiceGroups.get(key);
      if (invoice.invoiceType === 'passivo') {
        group.passive = invoice;
      } else {
        group.active = invoice;
      }
    });

    // Genera i dati per l'export
    invoiceGroups.forEach((group, key) => {
      const passiveInvoice = group.passive;
      const activeInvoice = group.active;
      
      // Se abbiamo almeno una fattura passiva (acquisto)
      if (passiveInvoice) {
        const processInvoice = (invoice: InvoiceData, isActive: boolean = false) => {
          const lines = invoice.invoiceLines && invoice.invoiceLines.length > 0 
            ? invoice.invoiceLines 
            : [{
                lineNumber: 1,
                description: invoice.productType || invoice.description,
                quantity: invoice.quantity || 0,
                unitOfMeasure: invoice.unitOfMeasure || '',
                unitValue: invoice.unitPrice || 0,
                totalValue: invoice.netAmount,
                vatRate: (invoice.taxAmount / invoice.netAmount * 100),
                productCode: ''
              }];

                     lines.forEach(line => {
             // Calcola prezzi e margini
             const quantityLiters = line.quantity;
             
             // Calcola prezzo di acquisto - prova prima dal foglio basi di carico, poi fallback alla fattura
             let priceAcquisto = 0;
             const baseCarico = extractBaseCarico(passiveInvoice.description);
             priceAcquisto = findSupplierPurchasePrice(
               passiveInvoice.issuerName,
               baseCarico,
               passiveInvoice.description,
               passiveInvoice.date
             );
             
             // Se non trovato nel foglio, fallback al prezzo fattura
             if (priceAcquisto === 0) {
               priceAcquisto = passiveInvoice.invoiceLines && passiveInvoice.invoiceLines.length > 0 
                 ? passiveInvoice.invoiceLines[0].unitValue 
                 : (passiveInvoice.unitPrice || 0);
             }
             
             // Il prezzo di vendita viene dalla fattura attiva se esiste, altrimenti dal valore corrente
             let priceVendita = 0;
             let fatturaVend = '';
             
             if (activeInvoice) {
               priceVendita = activeInvoice.invoiceLines && activeInvoice.invoiceLines.length > 0 
                 ? activeInvoice.invoiceLines[0].unitValue 
                 : (activeInvoice.unitPrice || 0);
               fatturaVend = activeInvoice.invoiceNumber;
      } else {
               // Se non c'è fattura attiva, usa il valore della fattura corrente come prezzo vendita
               priceVendita = line.unitValue;
             }

                         // Calcoli corretti secondo le specifiche
            const marginePerLitro = priceVendita - priceAcquisto; // prezzo vendita - prezzo acquisto
            const margineTotal = marginePerLitro * quantityLiters; // margine/LT * LT
            
            // Ottieni prezzo Platts per la data
            const prices = findPricesForDate(invoice.date);
            const plattsPrice = (prices['PLT AUTO'] as number) || (prices['plattsPrice'] as number) || 0;
            
            // Imponibile vendita: litri * prezzo vendita - prezzo platts
            const imponibileVend = (quantityLiters * priceVendita) - plattsPrice;
            
            // Imponibile acquisto: litri * prezzo d'acquisto  
            const imponibileAcq = quantityLiters * priceAcquisto;
            
            // Ricarico: prezzo di acquisto - prezzo platts
            const ricarico = priceAcquisto - plattsPrice;
        
        const exportRow: any = {
              'DATA CONS.': invoice.date,
              'BASE DI CARICO': passiveInvoice.description,
              'DAS': invoice.dasNumber || passiveInvoice.dasNumber || '',
              'PRODOTTO': line.description,
              'FORNITORE': passiveInvoice.issuerName,
              'CLIENTE': activeInvoice ? activeInvoice.clientName : '',
              'LT': quantityLiters,
              'P.VENDITA': priceVendita.toFixed(5),
              'P.ACQUISTO': priceAcquisto.toFixed(5),
              'MARGINE/LT': marginePerLitro.toFixed(5),
              'MARGINE': margineTotal.toFixed(2),
                           'FATTURA VEND': fatturaVend,
             'FATTURA ACQ': passiveInvoice.invoiceNumber,
             'IMPONIB.VEND.': imponibileVend.toFixed(2),
             'IMPONIB.ACQ': imponibileAcq.toFixed(2),
             'PLATT.S': plattsPrice.toFixed(5),
             'ricarico da acquisto': ricarico.toFixed(3)
            };

            dataToExport.push(exportRow);
          });
        };

        processInvoice(passiveInvoice);
      }
    });

    // Se non ci sono dati con i raggruppamenti, esporta le fatture individuali
    if (dataToExport.length === 0) {
      invoicesWithLiters.forEach(invoice => {
        const lines = invoice.invoiceLines && invoice.invoiceLines.length > 0 
          ? invoice.invoiceLines 
          : [{
              lineNumber: 1,
              description: invoice.productType || invoice.description,
              quantity: invoice.quantity || 0,
              unitOfMeasure: invoice.unitOfMeasure || '',
              unitValue: invoice.unitPrice || 0,
              totalValue: invoice.netAmount,
              vatRate: (invoice.taxAmount / invoice.netAmount * 100),
              productCode: ''
            }];

                 lines.forEach(line => {
           const prices = findPricesForDate(invoice.date);
           const plattsPrice = (prices['PLT AUTO'] as number) || (prices['plattsPrice'] as number) || 0;
           
           // Il prezzo di vendita è sempre il valore unitario della fattura
           let priceVendita = line.unitValue; // Sempre il valore unitario della riga
           let priceAcquisto = 0;
           
        if (invoice.invoiceType === 'passivo') {
             const baseCarico = extractBaseCarico(invoice.description);
             priceAcquisto = findSupplierPurchasePrice(
               invoice.issuerName,
               baseCarico,
               invoice.description,
               invoice.date
             );
             if (priceAcquisto === 0) {
               priceAcquisto = line.unitValue;
             }
           }
           
           // Calcoli per fatture individuali
           const quantityLiters = line.quantity;
           const marginePerLitro = priceVendita - priceAcquisto; // prezzo vendita - prezzo acquisto
           const margineTotal = marginePerLitro * quantityLiters;
           
           // Imponibile vendita: litri * prezzo vendita - prezzo platts
           const imponibileVendCalc = (quantityLiters * priceVendita) - plattsPrice;
           
           // Imponibile acquisto: litri * prezzo d'acquisto
           const imponibileAcqCalc = quantityLiters * priceAcquisto;
           
           // Ricarico: prezzo di acquisto - prezzo platts
           const ricaricoCalc = priceAcquisto - plattsPrice;
           
           const exportRow: any = {
             'DATA CONS.': invoice.date,
             'BASE DI CARICO': invoice.description,
             'DAS': invoice.dasNumber || '',
             'PRODOTTO': line.description,
             'FORNITORE': invoice.invoiceType === 'passivo' ? invoice.issuerName : '',
             'CLIENTE': invoice.invoiceType === 'attivo' ? invoice.clientName : '',
             'LT': line.quantity,
             'P.VENDITA': priceVendita.toFixed(5),
             'P.ACQUISTO': priceAcquisto.toFixed(5),
             'MARGINE/LT': marginePerLitro.toFixed(5),
             'MARGINE': margineTotal.toFixed(2),
             'FATTURA VEND': invoice.invoiceType === 'attivo' ? invoice.invoiceNumber : '',
             'FATTURA ACQ': invoice.invoiceType === 'passivo' ? invoice.invoiceNumber : '',
             'IMPONIB.VEND.': imponibileVendCalc.toFixed(2),
             'IMPONIB.ACQ': imponibileAcqCalc.toFixed(2),
             'PLATT.S': plattsPrice.toFixed(5),
             'ricarico da acquisto': ricaricoCalc.toFixed(3)
           };

        dataToExport.push(exportRow);
    });
      });
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BASE DI CARICO");
    
    const fileName = `data_cons_base_carico_${new Date().toISOString().split('T')[0]}.xlsx`;
    
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
      
      if (data.length < 2) {
        alert('Il foglio Excel deve avere almeno 2 righe (header + dati)');
        return;
      }
      
      // Estrai i nomi delle colonne dalla prima riga (header)
      const headers = data[0] as string[];
      const extractedPrices: {date: string, [key: string]: string | number}[] = [];
      
      // Scorri le righe e estrai tutte le colonne
      for (let i = 1; i < data.length; i++) { // Salta la prima riga (header)
        const row = data[i];
        const dateValue = row[1]; // Colonna B (indice 1) - DATA
        
        if (dateValue) {
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
          
          if (formattedDate) {
            const priceRow: {date: string, [key: string]: string | number} = { date: formattedDate };
            
            // Estrai tutte le colonne di prezzo (dalla C in poi)
            for (let j = 2; j < headers.length && j < row.length; j++) {
              const header = headers[j];
              const value = row[j];
              
              if (header && value !== undefined && value !== null && value !== '') {
                const numericValue = typeof value === 'number' ? value : parseFloat(value);
                if (!isNaN(numericValue) && numericValue > 0) {
                  priceRow[header] = numericValue;
                }
              }
            }
            
            // Aggiungi solo se ha almeno un prezzo oltre alla data
            if (Object.keys(priceRow).length > 1) {
              extractedPrices.push(priceRow);
            }
          }
        }
      }
      
      if (extractedPrices.length === 0) {
        alert('Non sono stati trovati dati validi nel foglio. Assicurati che la colonna B contenga le date e le altre colonne i prezzi.');
        return;
      }
      
      setPriceData(extractedPrices);
      setPriceFileName(file.name);
      
      // Conta il numero di colonne con dati
      const sampleRow = extractedPrices[0];
      const columnCount = Object.keys(sampleRow).length - 1; // -1 per escludere la colonna date
      const totalPrices = extractedPrices.reduce((sum, row) => sum + (Object.keys(row).length - 1), 0);
      
      alert(`✅ Caricati ${extractedPrices.length} record da ${file.name}\n• ${columnCount} colonne di prezzo\n• ${totalPrices} valori totali`);
      
      if (priceFileInputRef.current) {
        priceFileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('Errore durante la lettura del file Excel:', error);
      alert('Errore durante la lettura del file Excel. Verifica che il formato sia corretto.');
    }
  };

  const findPricesForDate = (invoiceDate: string): {date: string | null, [key: string]: number | string | null} => {
    if (priceData.length === 0) return {date: null};
    
    // Cerca data esatta
    const exactMatch = priceData.find(item => item.date === invoiceDate);
    if (exactMatch) {
      return exactMatch;
    }
    
    // Cerca data più vicina (entro 7 giorni)
    const targetDate = new Date(invoiceDate);
    let closestItem: typeof priceData[0] | null = null;
    let minDifference = Infinity;
    
    for (const item of priceData) {
      const itemDate = new Date(item.date as string);
      const difference = Math.abs(targetDate.getTime() - itemDate.getTime());
      const daysDifference = difference / (1000 * 60 * 60 * 24);
      
      if (daysDifference <= 7 && difference < minDifference) {
        minDifference = difference;
        closestItem = item;
      }
    }
    
    if (closestItem) {
      return closestItem;
    }
    
    return {date: null};
  };

  // Funzione per estrarre la base di carico dalla descrizione del prodotto
  const extractBaseCarico = (description: string): string => {
    const descLower = description.toLowerCase();
    
    // Cerca le basi di carico più comuni nella descrizione
    if (descLower.includes('pomezia') || descLower.includes('pom')) {
      return 'POMEZIA';
    } else if (descLower.includes('gaeta')) {
      return 'GAETA';
    } else if (descLower.includes('ortona')) {
      return 'ORTONA';
    } else if (descLower.includes('taranto') || descLower.includes(' ta ') || descLower.endsWith(' ta')) {
      return 'TARANTO';
    } else if (descLower.includes('milazzo')) {
      return 'MILAZZO';
    } else if (descLower.includes('napoli') || descLower.includes(' na ') || descLower.endsWith(' na')) {
      return 'NAPOLI';
    } else if (descLower.includes('roma') || descLower.includes(' rm ') || descLower.endsWith(' rm')) {
      return 'ROMA';
    }
    
    return ''; // Nessuna base di carico trovata
  };

  // Funzione per trovare il prezzo di acquisto corretto per tutti i fornitori
  const findSupplierPurchasePrice = (supplier: string, baseCarico: string, product: string, date: string): number => {
    const prices = findPricesForDate(date);
    if (!prices.date) return 0;

    // Normalizza il nome del fornitore
    let supplierName = '';
    const supplierUpper = supplier.toUpperCase();
    if (supplierUpper.startsWith('ENI')) {
      supplierName = 'ENI';
    } else if (supplierUpper.includes('Q8')) {
      supplierName = 'Q8';
    } else if (supplierUpper.includes('IP')) {
      supplierName = 'IP';
    } else if (supplierUpper.includes('LUDOIL')) {
      supplierName = 'LUDOIL';
    } else if (supplierUpper.includes('PETROLFUEL') || supplierUpper.includes('PETROL FUEL')) {
      supplierName = 'PETROLFUEL';
    }

    if (!supplierName) return 0; // Fornitore non supportato

    // Normalizza il tipo prodotto
    let productType = '';
    const productLower = product.toLowerCase();
    if (productLower.includes('auto') || productLower.includes('gasolio')) {
      productType = 'AUTO';
    } else if (productLower.includes('benzina')) {
      productType = 'BENZ';
    } else if (productLower.includes('agr')) {
      productType = 'AGR';
    } else if (productLower.includes('hvo')) {
      productType = 'HVO';
    }

    if (!productType) return 0;

    // La base di carico è già normalizzata dalla funzione extractBaseCarico
    if (!baseCarico) return 0;
    
    // Usa il nome completo della base di carico per cercare la colonna
    const baseNormalized = baseCarico; // Mantieni il nome completo (ROMA, NAPOLI, POMEZIA, etc.)

    // Costruisci le possibili colonne basate sul fornitore
    const possibleColumns = [];

    if (supplierName === 'ENI') {
      possibleColumns.push(
        `ENI ${productType} ${baseNormalized}`,
        `ENI ${productType}. ${baseNormalized}`,
        `ENI${productType} ${baseNormalized}`,
        `ENI${productType}. ${baseNormalized}`,
        `ENI ${productType}${baseNormalized}`,
        `ENI ${productType}.${baseNormalized}`,
        // Varianti per abbreviazioni comuni nel foglio
        ...(baseNormalized === 'TARANTO' ? [
          `ENI ${productType} TA`,
          `ENI ${productType}. TA`
        ] : []),
        ...(baseNormalized === 'POMEZIA' ? [
          `ENI ${productType} POM`,
          `ENI ${productType}. POM`
        ] : []),
        ...(baseNormalized === 'ROMA' ? [
          `ENI ${productType} RM`,
          `ENI ${productType}. RM`
        ] : []),
        ...(baseNormalized === 'NAPOLI' ? [
          `ENI ${productType} NA`,
          `ENI ${productType}. NA`
        ] : [])
      );
    } else if (supplierName === 'Q8') {
      // Q8 spesso ha formato "Q8 AUTO RM", "Q8 AGR NA", etc.
      const baseAbbrev = baseNormalized === 'ROMA' ? 'RM' : 
                        baseNormalized === 'NAPOLI' ? 'NA' :
                        baseNormalized === 'TARANTO' ? 'TA' :
                        baseNormalized === 'POMEZIA' ? 'POM' :
                        baseNormalized;
      
      possibleColumns.push(
        `Q8 ${productType} ${baseAbbrev}`,
        `Q8 ${productType} ${baseNormalized}`,
        `Q8${productType} ${baseAbbrev}`,
        `Q8${productType} ${baseNormalized}`
      );
    } else if (supplierName === 'IP') {
      // IP spesso ha formato semplice "IP AUTO", "IP AGR"
      possibleColumns.push(
        `IP ${productType}`,
        `IP${productType}`,
        `IP ${productType} ${baseNormalized}`,
        `IP ${productType} ${baseNormalized === 'ROMA' ? 'RM' : baseNormalized}`
      );
    } else if (supplierName === 'LUDOIL') {
      possibleColumns.push(
        `LUDOIL ${productType}`,
        `LUDOIL${productType}`,
        `LUDOIL ${productType} ${baseNormalized}`,
        ...(productType === 'HVO' ? ['LUDOIL HVO'] : [])
      );
    } else if (supplierName === 'PETROLFUEL') {
      possibleColumns.push(
        `PETROLFUEL ${productType}`,
        `PETROLFUEL${productType}`,
        `PETROLFUEL ${productType === 'AUTO' ? 'Auto' : productType}`, // PETROLFUEL usa "Auto" invece di "AUTO"
        `PETROLFUEL AGR` // Caso specifico
      );
    }

    // Cerca la colonna corrispondente
    for (const columnName of possibleColumns) {
      const price = prices[columnName];
      if (price && typeof price === 'number' && price > 0) {
        return price;
      }
    }

    return 0;
  };



  const handlePriceCheck = async (invoice: InvoiceData) => {
    // Ora è solo un modal informativo per mostrare i dettagli
    setSelectedInvoice(invoice);
    setShowPriceCheckModal(true);
  };

  // Funzioni helper per i filtri
  const handleSupplierToggle = (supplier: string) => {
    setSelectedSuppliers(prev => 
      prev.includes(supplier) 
        ? prev.filter(s => s !== supplier)
        : [...prev, supplier]
    );
  };

  const handleSelectAllSuppliers = () => {
    const allSuppliers = getUniqueSuppliers();
    if (selectedSuppliers.length === allSuppliers.length) {
      // Deseleziona tutti
      setSelectedSuppliers([]);
    } else {
      // Seleziona tutti
      setSelectedSuppliers(allSuppliers);
    }
  };

  const clearAllFilters = () => {
    setSelectedSuppliers([]);
    setUnitPriceFilter({min: '', max: ''});
  };

  const hasActiveFilters = selectedSuppliers.length > 0 || unitPriceFilter.min || unitPriceFilter.max;

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
                      {filteredInvoices.length}
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
                      € {filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0).toFixed(2)}
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
                      € {filteredInvoices.reduce((sum, inv) => sum + inv.taxAmount, 0).toFixed(2)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>


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
                  {priceData.length} record • {priceData.length > 0 ? Object.keys(priceData[0]).length - 1 : 0} colonne prezzi
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

        {/* Filtri */}
        <div className="mb-6">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Filter className="w-5 h-5 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900">Filtri</h3>
                  {hasActiveFilters && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {(selectedSuppliers.length + (unitPriceFilter.min || unitPriceFilter.max ? 1 : 0))} attivi
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Pulisci tutti
                    </button>
                  )}
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showFilters ? <X className="w-5 h-5" /> : <Filter className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
            
            {showFilters && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Filtro Fornitore/Cliente */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {invoiceType === 'passivo' ? 'Fornitori' : 'Clienti'}
                      </label>
                      <button
                        onClick={handleSelectAllSuppliers}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        {selectedSuppliers.length === getUniqueSuppliers().length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md">
                      {getUniqueSuppliers().map(supplier => (
                        <label
                          key={supplier}
                          className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSuppliers.includes(supplier)}
                            onChange={() => handleSupplierToggle(supplier)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-900 truncate" title={supplier}>
                            {supplier}
                          </span>
                        </label>
                      ))}
                      {getUniqueSuppliers().length === 0 && (
                        <p className="px-3 py-2 text-sm text-gray-500">
                          Nessun {invoiceType === 'passivo' ? 'fornitore' : 'cliente'} disponibile
                        </p>
                      )}
                    </div>
                    {selectedSuppliers.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {selectedSuppliers.map(supplier => (
                          <span
                            key={supplier}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                          >
                            {supplier}
                            <button
                              onClick={() => handleSupplierToggle(supplier)}
                              className="ml-1 text-indigo-600 hover:text-indigo-800"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Filtro Range Prezzo Unitario */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Valore Unitario (€)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <input
                          type="number"
                          step="0.000001"
                          placeholder="Da (min)"
                          value={unitPriceFilter.min}
                          onChange={(e) => setUnitPriceFilter(prev => ({...prev, min: e.target.value}))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          step="0.000001"
                          placeholder="A (max)"
                          value={unitPriceFilter.max}
                          onChange={(e) => setUnitPriceFilter(prev => ({...prev, max: e.target.value}))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                      </div>
                    </div>
                    {(unitPriceFilter.min || unitPriceFilter.max) && (
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Range: {unitPriceFilter.min || '0'} - {unitPriceFilter.max || '∞'} €
                          <button
                            onClick={() => setUnitPriceFilter({min: '', max: ''})}
                            className="ml-1 text-green-600 hover:text-green-800"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Riepilogo Risultati */}
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    Mostrate <span className="font-medium">{filteredInvoices.length}</span> di <span className="font-medium">{invoices.length}</span> fatture
                    {hasActiveFilters && (
                      <span className="text-blue-600">
                        {' '}(filtrate)
                      </span>
                    )}
                    {invoiceType === 'passivo' && (
                      <span className="text-gray-500">
                        {' '}(escluse fatture /A e PA)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

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
          
          {filteredInvoices.length === 0 ? (
                          <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {invoices.length === 0 ? 'Nessuna fattura' : 'Nessuna fattura trovata'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {invoices.length === 0 
                    ? 'Inizia caricando la tua prima fattura elettronica (PDF o XML).'
                    : 'Prova a modificare i filtri per vedere più risultati.'
                  }
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                  >
                    Rimuovi tutti i filtri
                  </button>
                )}
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
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
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
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Controllo prezzi"
                            >
                              <TrendingUp className="w-4 h-4" />
                            </button>
                            {priceData.length > 0 && (() => {
                              const prices = findPricesForDate(invoice.date);
                              return prices.date !== null && Object.keys(prices).length > 1;
                            })() && (
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
                  ))}
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
                        {selectedInvoice.description && (
                          <p><span className="font-medium">Base di Carico:</span> {selectedInvoice.description}</p>
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
                      
                      const results: React.ReactElement[] = [];
                      
                      // Confronto con tutti i prezzi disponibili
                      if (effectivePrice > 0) {
                        Object.keys(prices).forEach((priceColumn, index) => {
                          if (priceColumn === 'date') return;
                          
                          const referencePrice = prices[priceColumn] as number;
                          if (referencePrice && referencePrice > 0) {
                            const difference = effectivePrice - referencePrice;
                            const differenceColor = difference > 0 ? 'text-green-700' : difference < 0 ? 'text-red-700' : 'text-gray-700';
                            
                            const bgColor = priceColumn.includes('Q8') ? 'bg-blue-50' : 
                                          priceColumn.includes('PLT') ? 'bg-yellow-50' : 
                                          priceColumn.includes('ENI') ? 'bg-green-50' : 'bg-gray-50';
                        
                        results.push(
                              <div key={priceColumn} className={`text-sm mb-2 p-2 ${bgColor} rounded`}>
                            <p className="text-gray-700">
                                  <span className="font-medium">{priceColumn}:</span> € {referencePrice.toFixed(6)}
                                </p>
                                <p className={`${differenceColor} font-medium`}>
                                  <span className="font-medium">Differenza:</span> € {difference.toFixed(6)} 
                                  {difference > 0 ? '(sopra)' : difference < 0 ? '(sotto)' : '(uguale)'}
                            </p>
                          </div>
                        );
                          }
                        });
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