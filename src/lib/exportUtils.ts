import { Trip, Order, User } from '@/lib/types';
import { getDisplayCompanyName } from './companyUtils';
import * as XLSX from 'xlsx';

export const exportTripsToExcel = (trips: Trip[], orders: Order[], drivers: User[]) => {
  const getOrderById = (orderId: string) => orders.find(order => order.id === orderId);
  const getDriverById = (driverId: string) => drivers.find(driver => driver.id === driverId);

  const dataToExport = trips.map(trip => {
    const order = getOrderById(trip.orderId);
    const driver = getDriverById(trip.driverId);
    const edas = trip.edasData;
    const loadingNote = trip.loadingNoteData;
    
    // Calcola le discrepanze di validazione
    const validationErrors = trip.validationResults?.filter(r => !r.isMatch && (r.severity === 'error' || r.severity === 'warning')) || [];
    const validationSummary = validationErrors.length > 0 
      ? validationErrors.map(e => `${e.field}: e-DAS="${e.edasValue}" ≠ Nota="${e.loadingNoteValue}"`).join('; ')
      : 'Nessuna discrepanza';

    return {
      'ID Viaggio': trip.id,
      'Stato Viaggio': trip.status,
      'Data Creazione Viaggio': trip.createdAt.toLocaleDateString('it-IT'),
      'Data Completamento': trip.completedAt ? trip.completedAt.toLocaleDateString('it-IT') : 'N/A',
      
      // Nuovi dati richiesti - basati sui campi della bolla di carico
      'Società': getDisplayCompanyName(loadingNote?.companyName),
      'Deposito': loadingNote?.depotLocation || loadingNote?.shipperName || 'N/A',
      'Data': loadingNote?.loadingDate || 'N/A',
      'Cliente': loadingNote?.carrierName || 'N/A',
      'Destinazione': loadingNote?.destinationName || edas?.recipientInfo.address || 'N/A',
      'Prodotto': loadingNote?.productDescription || 'N/A',
      'Quantità Consegnata (LITRI)': loadingNote?.volumeLiters || 'N/A',
      'Densità a 15°': loadingNote?.densityAt15C || edas?.productInfo.densityAt15C || 'N/A',
      'Densità Ambiente': loadingNote?.densityAtAmbientTemp || edas?.productInfo.densityAtAmbientTemp || 'N/A',
      'Quantità in KG': loadingNote?.netWeightKg || 'N/A',
      'Vettore': loadingNote?.carrierName || edas?.transportInfo.firstCarrierName || 'N/A',
      'Autista': loadingNote?.driverName || edas?.transportInfo.driverName || trip.driverName || 'N/A',
      
      // Informazioni aggiuntive
      'ID Autista': driver?.id,
      'ID Ordine': order?.id,
      'Numero Ordine': order?.orderNumber,
      'Stato Ordine': order?.status,
      
      // Validazione
      'Numero Discrepanze': validationErrors.length,
      'Dettaglio Discrepanze': validationSummary,
      
      // E-DAS Data completi
      'e-DAS: Numero Documento': edas?.documentInfo.dasNumber,
      'e-DAS: Versione': edas?.documentInfo.version,
      'e-DAS: Riferimento Locale': edas?.documentInfo.localReferenceNumber,
      'e-DAS: Numero Fattura': edas?.documentInfo.invoiceNumber,
      'e-DAS: Data Fattura': edas?.documentInfo.invoiceDate,
      'e-DAS: Data Registrazione': edas?.documentInfo.registrationDateTime,
      'e-DAS: Data Spedizione': edas?.documentInfo.shippingDateTime,
      'e-DAS: Scadenza': edas?.documentInfo.validityExpirationDateTime,
      'e-DAS: Mittente': edas?.senderInfo.name,
      'e-DAS: Indirizzo Mittente': edas?.senderInfo.address,
      'e-DAS: Destinatario': edas?.recipientInfo.name,
      'e-DAS: Codice Fiscale Destinatario': edas?.recipientInfo.taxCode,
      'e-DAS: ID Vettore': edas?.transportInfo.firstCarrierId,
      'e-DAS: Targa Veicolo': edas?.transportInfo.vehicleId,
      'e-DAS: Codice Prodotto': edas?.productInfo.productCode,
      'e-DAS: Codice UN': edas?.productInfo.unCode,
      'e-DAS: Volume a 15°C (L)': edas?.productInfo.volumeAt15CL,
      'e-DAS: Peso Netto (Kg)': edas?.productInfo.netWeightKg,
      
      // Loading Note Data completi
      'Nota Carico: Numero': loadingNote?.documentNumber,
      'Nota Carico: Data': loadingNote?.loadingDate,
      'Nota Carico: Vettore': loadingNote?.carrierName,
      'Nota Carico: Spedizioniere': loadingNote?.shipperName,
      'Nota Carico: Destinatario': loadingNote?.consigneeName,
      'Nota Carico: Prodotto': loadingNote?.productDescription,
      'Nota Carico: Peso Lordo (Kg)': loadingNote?.grossWeightKg,
      'Nota Carico: Peso Netto (Kg)': loadingNote?.netWeightKg,
      'Nota Carico: Volume (L)': loadingNote?.volumeLiters,
      'Nota Carico: Densità 15°C': loadingNote?.densityAt15C,
      'Nota Carico: Densità Ambiente': loadingNote?.densityAtAmbientTemp,
      'Nota Carico: Committente': loadingNote?.committenteName,
      'Nota Carico: Società': loadingNote?.companyName,
      'Nota Carico: Deposito': loadingNote?.depotLocation,
      'Nota Carico: Fornitore': loadingNote?.supplierLocation,
      'Nota Carico: Autista': loadingNote?.driverName,
      'Nota Carico: Destinazione': loadingNote?.destinationName,
      'Nota Carico: Note': loadingNote?.notes,

      'URL Firma': trip.signatureUrl,
    };
  });

  if (dataToExport.length === 0) {
    console.warn("No data to export.");
    return;
  }
  
  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Viaggi Completati');

  // Auto-fit columns
  const cols = Object.keys(dataToExport[0] || {});
  const colWidths = cols.map(col => ({
    wch: Math.max(
      col.length,
      ...dataToExport.map(row => (row[col as keyof typeof row] || '').toString().length)
    ) + 2
  }));
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, `Viaggi_Completati_${new Date().toISOString().split('T')[0]}.xlsx`);
}; 