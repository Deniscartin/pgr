export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'autista' | 'operatore' | 'gestore_fatture';
  qrCode?: string; // QR code associato al driver (solo per autisti)  
  carrier?: string; // Vettore associato (per autisti e operatori)
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  orderNumber: string;
  product: string;
  customerName: string;
  customerCode: string;
  deliveryAddress: string;
  destinationCode: string;
  quantity: number;
  quantityUnit: string;
  status: 'pendente' | 'assegnato' | 'completato' | 'annullato';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  // Optional fields from PDF parsing
  carrierInfo?: any;
  loadingInfo?: any;
  driverInfo?: any;
  bdcNumber?: string;
  identifier?: string;
}

export type OrderStatus = 'pendente' | 'assegnato' | 'completato' | 'annullato';

export interface Trip {
  id: string;
  orderId: string;
  driverId: string;
  driverName: string;
  status: 'assegnato' | 'in_corso' | 'completato' | 'annullato' | 'elaborazione';
  assignedBy: string;
  dasCode?: string;
  signatureUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  edasData?: ParsedEDASData;
  loadingNoteData?: ParsedLoadingNoteData;
  validationResults?: ValidationResult[];
  // Image storage URLs
  edasImageUrl?: string;
  edasProcessedImageUrl?: string;
  loadingNoteImageUrl?: string;
  loadingNoteProcessedImageUrl?: string;
  cartelloCounterImageUrl?: string;
}

export interface ValidationResult {
  field: string;
  edasValue: string | number;
  loadingNoteValue: string | number;
  isMatch: boolean;
  severity: 'error' | 'warning' | 'info';
}

export interface Invoice {
  id: string;
  tripId: string;
  invoiceNumber: string;
  amount: number;
  signatureUrl: string;
  createdAt: Date;
}

export interface ParsedPDFOrder {
  orderNumber: string;
  product: string;
  customerName: string;
  customerCode: string;
  deliveryAddress: string;
  destinationCode: string;
  quantity: number;
  quantityUnit: string;
  identifier: string;
}

export interface ParsedPDFData {
  carrierInfo: {
    vettore: string;
    partitaIva: string;
    address: string;
  };
  loadingInfo: {
    dataCarico: string;
    luogoCarico: string;
    stato: string;
  };
  driverInfo: {
    autista: string;
    codiceAutista?: string;
    targaMotrice?: string;
    targaRimorchio?: string;
    tankContainer?: string;
  };
  bdcNumber: string;
  orders: ParsedPDFOrder[];
}

export interface ParsedLoadingNoteData {
  documentNumber: string;
  loadingDate: string;
  carrierName: string;
  shipperName: string;
  consigneeName: string;
  productDescription: string;
  grossWeightKg: number;
  netWeightKg: number;
  volumeLiters: number;
  notes: string;
  // Campi aggiuntivi dalle entità estratte
  densityAt15C?: number; // densita-15
  committenteName?: string; // committente
  companyName?: string; // societa
  depotLocation?: string; // Deposito
  supplierLocation?: string; // fornitore
  driverName?: string; // autista
  destinationName?: string; // Destinatario
}

export interface ParsedEDASData {
  documentInfo: {
    dasNumber: string;
    version: string;
    localReferenceNumber: string;
    invoiceNumber: string;
    invoiceDate: string;
    registrationDateTime: string;
    shippingDateTime: string;
    validityExpirationDateTime: string;
  };
  senderInfo: {
    depositoMittenteCode: string;
    name: string;
    address: string;
    organizationName?: string; // ENI SPA, etc.
  };
  depositorInfo: {
    name: string;
    id: string;
    location?: string; // VILLA S. LUCIA, etc.
  };
  recipientInfo: {
    name: string;
    address: string;
    taxCode: string;
    facilityCode?: string; // impianto-ricevente code
  };
  transportInfo: {
    transportManager: string;
    transportMode: string;
    vehicleType: string;
    vehicleId: string;
    estimatedDuration: string;
    firstCarrierName: string;
    firstCarrierId: string;
    driverName: string;
  };
  productInfo: {
    productCode: string;
    description: string;
    unCode: string;
    netWeightKg: number;
    volumeAtAmbientTempL: number;
    volumeAt15CL: number;
    densityAtAmbientTemp: number;
    densityAt15C: number;
  };
}

// Types for Invoice Management
export interface InvoiceData {
  id: string;
  invoiceNumber: string;
  date: string;
  issuerName: string;
  issuerTaxCode: string;
  issuerAddress: string;
  clientName: string;
  clientTaxCode: string;
  clientAddress: string;
  totalAmount: number;
  taxAmount: number;
  netAmount: number;
  description: string;
  paymentTerms: string;
  dueDate: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  filePath?: string;
  // Campi specifici per fatture elettroniche trasporti
  productType?: string;
  quantity?: number;
  unitPrice?: number;
  dasNumber?: string;
  deliveryAddress?: string;
  unitOfMeasure?: string;
  // Nuovo campo per tipo fattura
  invoiceType: 'attivo' | 'passivo';
  // Dettagli linee fattura per fatture complesse
  invoiceLines?: InvoiceLine[];
}

export interface InvoiceLine {
  lineNumber: number;
  productCode?: string;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitValue: number;
  totalValue: number;
  vatRate: number;
  additionalData?: string;
}

export interface PriceCheck {
  id: string;
  date: string;
  productType: string;
  expectedPrice: number;
  actualPrice: number;
  variance: number;
  status: 'ok' | 'variance';
  createdAt: Date;
  createdBy: string;
}

export interface ParsedInvoiceData {
  invoiceNumber: string;
  date: string;
  issuerInfo: {
    name: string;
    taxCode: string;
    address: string;
  };
  clientInfo: {
    name: string;
    taxCode: string;
    address: string;
  };
  amounts: {
    netAmount: number;
    taxAmount: number;
    totalAmount: number;
  };
  description: string;
  paymentTerms: string;
  dueDate: string;
  // Campi specifici per fatture elettroniche trasporti
  transportDetails?: {
    productType: string; // es. GASOLIO AUTOTRAZIONE 10PPM
    quantity: number; // litri trasportati
    unitPrice: number; // prezzo unitario
    dasNumber: string; // numero DAS
    deliveryAddress: string; // base di carico (indirizzo committente)
    unitOfMeasure: string; // LITRI
  };
  // Linee di dettaglio per fatture complesse
  invoiceLines?: InvoiceLine[];
}

export type UserRole = 'admin' | 'autista' | 'operatore' | 'gestore_fatture';
export type TripStatus = 'assegnato' | 'in_corso' | 'completato' | 'annullato' | 'elaborazione'; 